# ROUTE: Routes d'authentification Google OAuth
# OBJECTIF: Vérifier le JWT Google, créer/mettre à jour l'utilisateur, poser le cookie de session

import os
import re
import json
import unicodedata
from datetime import datetime, date
from flask import Blueprint, request, jsonify, session
from google.oauth2 import id_token
from google.auth.transport import requests as grequests
from backend.models import db, User


def _make_unique_slug(name, email):
    """Génère un slug unique depuis le nom ou l'email."""
    base = name or email.split('@')[0]
    slug = unicodedata.normalize('NFKD', base).encode('ascii', 'ignore').decode('ascii')
    slug = re.sub(r'[^\w\s-]', '', slug.lower())
    slug = re.sub(r'[\s_-]+', '-', slug).strip('-') or 'user'
    # Vérifier l'unicité et ajouter un suffixe si nécessaire
    candidate = slug
    counter   = 1
    while User.query.filter_by(slug=candidate).first():
        candidate = f'{slug}-{counter}'
        counter  += 1
    return candidate

auth_bp = Blueprint('auth', __name__)

ADMIN_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'admin')

# Domaines email académiques acceptés (Maroc + international)
ACADEMIC_DOMAINS = (
    '.ac.ma',       # Domaine académique marocain générique
    '.edu.ma',      # Éducation Maroc
    'um6p.ma',      # Université Mohammed VI Polytechnique
    'ines.ma',      # INES
    'uae.ac.ma',    # Université Abdelmalek Essaâdi
)


def _is_academic_email(email: str) -> bool:
    """Retourne True si l'email appartient à un domaine académique reconnu."""
    if not email or '@' not in email:
        return False
    domain = email.split('@')[-1].lower()
    return any(domain == d.lstrip('.') or domain.endswith(d) for d in ACADEMIC_DOMAINS)


# ROUTE: GET /api/auth/config
# OBJECTIF: Exposer le client_id Google au frontend sans mettre la clé en dur dans le JS
# EDITABLE: GOOGLE_CLIENT_ID dans .env
@auth_bp.route('/api/auth/config', methods=['GET'])
def get_config():
    return jsonify({'google_client_id': os.getenv('GOOGLE_CLIENT_ID', '')})

# ROUTE: POST /api/auth/google
# OBJECTIF: Vérifier le JWT Google et créer/mettre à jour la session
# Ne jamais stocker le token JWT dans la réponse — cookie httpOnly uniquement
@auth_bp.route('/api/auth/google', methods=['POST'])
def google_auth():
    data = request.get_json()
    credential = data.get('credential') if data else None

    if not credential:
        return jsonify({'error': 'credential manquant'}), 400

    client_id = os.getenv('GOOGLE_CLIENT_ID', '')

    try:
        # Vérification du JWT Google via google-auth
        id_info = id_token.verify_oauth2_token(
            credential,
            grequests.Request(),
            client_id if client_id else None,
            clock_skew_in_seconds=10
        )
    except ValueError as e:
        return jsonify({'error': f'JWT invalide : {str(e)}'}), 401

    google_id  = id_info.get('sub')
    email      = id_info.get('email', '')
    name       = id_info.get('name', '')
    avatar_url = id_info.get('picture', '')

    # Vérification email académique obligatoire
    if not _is_academic_email(email):
        return jsonify({
            'error': 'email_non_academique',
            'message': (
                f"L'email « {email} » n'est pas un email académique reconnu. "
                "Utilise ton adresse institutionnelle (ex : prenom.nom@uca.ac.ma)."
            )
        }), 403

    # Chercher ou créer l'utilisateur en base
    user = User.query.filter_by(google_id=google_id).first()
    is_new = user is None

    if is_new:
        # Vérifier si le mode Fondateur est actif et si on est sous la limite
        # EDITABLE: max_founders dans admin/content.json → rules.max_founders
        founder_count = User.query.filter_by(is_founder=True).count()
        content_path  = os.path.join(ADMIN_DIR, 'content.json')
        max_founders  = 50
        founder_active = True
        if os.path.exists(content_path):
            with open(content_path, 'r', encoding='utf-8') as f:
                content = json.load(f)
            max_founders   = content.get('rules', {}).get('max_founders', 50)
            founder_active = True  # founder_mode géré dans settings.json features

        user = User(
            google_id          = google_id,
            email              = email,
            name               = name,
            avatar_url         = avatar_url,
            is_founder         = founder_count < max_founders,
            monthly_reset_date = date.today().replace(day=1),
            slug               = _make_unique_slug(name, email),
        )
        db.session.add(user)
    else:
        user.name       = name
        user.avatar_url = avatar_url
        user.last_active = datetime.utcnow()

    db.session.commit()

    if is_new:
        try:
            from backend.services.email_service import send_welcome_email
            send_welcome_email(user)
        except Exception:
            pass

    # Session httpOnly — jamais de token dans la réponse JSON
    session['user_id']  = user.id
    session['google_id'] = user.google_id
    session.permanent   = True

    redirect_to = '/onboarding.html' if is_new or not user.onboarding_complete else '/dashboard.html'

    return jsonify({
        'success':     True,
        'redirect':    redirect_to,
        'is_new':      is_new,
        'is_founder':  user.is_founder,
        'user':        user.to_dict()
    })


# ROUTE: POST /api/auth/onboarding
# OBJECTIF: Sauvegarder les 5 réponses du quiz d'onboarding
@auth_bp.route('/api/auth/onboarding', methods=['POST'])
def save_onboarding():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'non authentifié'}), 401

    data = request.get_json()
    if not data:
        return jsonify({'error': 'données manquantes'}), 400

    user = User.query.filter_by(id=user_id).first()
    if not user:
        return jsonify({'error': 'utilisateur introuvable'}), 404

    # Q1 : niveau
    user.level           = data.get('level')
    # Q2 : domaine principal
    user.domains         = data.get('domains', [])
    # Q3 : pourquoi rejoindre
    user.why_join        = data.get('why_join', [])
    # Q4 : temps disponible
    user.available_time  = data.get('available_time')
    # Q5 : domaines pour répondre
    user.respond_domains = data.get('respond_domains', [])
    # École + université sélectionnées lors de l'onboarding
    user.school_id       = data.get('school_id')
    user.university_id   = data.get('university_id')

    user.onboarding_complete = True
    user.last_active         = datetime.utcnow()
    db.session.commit()

    return jsonify({'success': True, 'redirect': '/dashboard.html'})


# ROUTE: GET /api/auth/me
# OBJECTIF: Retourner l'utilisateur connecté depuis la session
@auth_bp.route('/api/auth/me', methods=['GET'])
def get_me():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'authenticated': False}), 200

    user = User.query.filter_by(id=user_id).first()
    if not user:
        session.clear()
        return jsonify({'authenticated': False}), 200

    user_dict = user.to_dict()

    # Calculer le nombre de dépôts effectués ce mois-ci
    from backend.models import Questionnaire
    now = datetime.utcnow()
    first_of_month = datetime(now.year, now.month, 1)
    monthly_deposits = Questionnaire.query.filter(
        Questionnaire.author_id == user_id,
        Questionnaire.created_at >= first_of_month
    ).count()

    # Nombre de réponses requises pour le prochain dépôt
    try:
        content_path = os.path.join(ADMIN_DIR, 'content.json')
        with open(content_path, 'r', encoding='utf-8') as f:
            content = json.load(f)
        responses_per_deposit = content.get('rules', {}).get('responses_required', 2)
    except Exception:
        responses_per_deposit = 2

    responses_needed = (monthly_deposits + 1) * responses_per_deposit
    is_founder_first = user.is_founder and Questionnaire.query.filter_by(author_id=user_id).count() == 0
    can_deposit = user.monthly_responses_given >= responses_needed or is_founder_first

    user_dict['monthly_deposits']                = monthly_deposits
    user_dict['responses_needed_for_next_deposit'] = responses_needed
    user_dict['responses_per_deposit']           = responses_per_deposit
    user_dict['can_deposit']                     = can_deposit

    return jsonify({'authenticated': True, 'user': user_dict})


# ROUTE: POST /api/auth/logout
# OBJECTIF: Effacer la session
@auth_bp.route('/api/auth/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'success': True, 'redirect': '/index.html'})
