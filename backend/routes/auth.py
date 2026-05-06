# ROUTE: Routes d'authentification Google OAuth
# OBJECTIF: Vérifier le JWT Google, créer/mettre à jour l'utilisateur, poser le cookie de session

import os
import re
import json
import unicodedata
from datetime import datetime, date, timedelta
from flask import Blueprint, request, jsonify, session
from google.oauth2 import id_token
from google.auth.transport import requests as grequests
from backend.models import db, User
from backend.config import Config


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
    """Retourne True si l'email appartient à un domaine académique reconnu, ou est un admin autorisé."""
    if not email or '@' not in email:
        return False
    # Bypass pour les admins définis dans ADMIN_EMAILS (liste séparée par virgules)
    admin_emails = [e.strip().lower() for e in os.getenv('ADMIN_EMAILS', '').split(',') if e.strip()]
    if email.lower() in admin_emails:
        return True
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

    # V3: Système de connexion quotidienne + streak
    today = date.today()
    is_first_login_today = False
    points_earned        = 0
    streak_bonus         = False

    if not is_new:
        if user.last_login_date != today:
            is_first_login_today = True
            points_earned        = Config.POINTS_LOGIN_QUOTIDIEN
            user.points          = (user.points or 0) + points_earned

            if user.last_login_date == today - timedelta(days=1):
                user.streak = (user.streak or 0) + 1
                if user.streak % 7 == 0:
                    user.points += Config.POINTS_STREAK_7_JOURS
                    streak_bonus = True
            else:
                user.streak = 1

            user.last_login_date = today

    db.session.commit()

    if is_new:
        try:
            from backend.services.email_service import send_welcome_email
            send_welcome_email(user)
        except Exception:
            pass

    # Session httpOnly — jamais de token dans la réponse JSON
    session['user_id']   = user.id
    session['google_id'] = user.google_id
    # V3: stocker infos popup pour le dashboard
    session['first_login_today'] = is_first_login_today
    session['login_points']      = points_earned
    session['streak_bonus']      = streak_bonus
    session['streak_days']       = user.streak or 0
    session.permanent            = True

    redirect_to = '/onboarding.html' if is_new or not user.onboarding_complete else '/dashboard.html'

    return jsonify({
        'success':              True,
        'redirect':             redirect_to,
        'is_new':               is_new,
        'is_founder':           user.is_founder,
        'is_first_login_today': is_first_login_today,
        'points_earned':        points_earned,
        'streak':               user.streak or 0,
        'streak_bonus':         streak_bonus,
        'total_points':         user.points or 0,
        'user':                 user.to_dict()
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

    # V3: can_deposit basé sur les points
    can_deposit = (user.points or 0) >= Config.POINTS_MIN_DEPOT
    user_dict['can_deposit']   = can_deposit
    user_dict['points_min_deposit'] = Config.POINTS_MIN_DEPOT

    # V3: infos popup connexion quotidienne (lues une seule fois depuis session)
    first_login_today = session.pop('first_login_today', False)
    login_points      = session.pop('login_points', 0)
    streak_bonus      = session.pop('streak_bonus', False)

    return jsonify({
        'authenticated':        True,
        'user':                 user_dict,
        'is_first_login_today': first_login_today,
        'points_earned':        login_points,
        'streak_bonus':         streak_bonus,
    })


# ROUTE: POST /api/auth/logout
@auth_bp.route('/api/auth/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'success': True, 'redirect': '/index.html'})


# ═══════════════════════════════════════════════
# V3 — AUTH PAR EMAIL ACADÉMIQUE (code 6 chiffres)
# ═══════════════════════════════════════════════

import random
import string
from datetime import datetime, date, timedelta

# Cache en mémoire des codes (en prod utiliser Redis)
# Structure : { email: { code, expires_at } }
_email_codes = {}

# EDITABLE: domaines académiques acceptés
ACADEMIC_DOMAINS_LIST = [
    '.ac.ma', '.edu.ma', 'um6p.ma', 'ines.ma',
]

def _is_academic_email_v3(email: str) -> bool:
    if not email or '@' not in email:
        return False
    admin_emails = [e.strip().lower() for e in os.getenv('ADMIN_EMAILS', '').split(',') if e.strip()]
    if email.lower() in admin_emails:
        return True
    domain = email.split('@')[-1].lower()
    return any(domain == d.lstrip('.') or domain.endswith(d) for d in ACADEMIC_DOMAINS_LIST)


# ROUTE: POST /api/auth/email/send-code
@auth_bp.route('/api/auth/email/send-code', methods=['POST'])
def email_send_code():
    """V3: Envoie un code 6 chiffres à l'email académique."""
    data  = request.get_json()
    email = (data or {}).get('email', '').strip().lower()

    if not email:
        return jsonify({'error': 'Email manquant'}), 400
    if not _is_academic_email_v3(email):
        return jsonify({'error': 'Email non académique reconnu'}), 400

    # Générer code 6 chiffres
    code    = ''.join(random.choices(string.digits, k=6))
    expires = datetime.utcnow() + timedelta(minutes=10)
    _email_codes[email] = {'code': code, 'expires_at': expires}

    # Détecter mode dev : pas de SMTP configuré
    smtp_configured = bool(os.getenv('MAIL_USERNAME', '').strip())
    email_sent = False

    if smtp_configured:
        try:
            from backend.services.email_service import send_email
            send_email(
                subject    = f'Votre code SciConnect : {code}',
                recipients = [email],
                template   = 'emails/code_verif.html',
                code       = code,
                email      = email,
            )
            email_sent = True
        except Exception:
            pass

    import logging
    logging.info(f'[DEV] Code de vérification pour {email} : {code}')
    print(f'\n>>> [DEV EMAIL CODE] {email} → {code} <<<\n')

    # En mode dev (pas de SMTP) : retourner le code pour pré-remplissage
    dev_code = code if not smtp_configured else None

    return jsonify({
        'success':    True,
        'message':    f'Code envoyé à {email}' if email_sent else f'[DEV] Code : {code} (visible dans les logs)',
        'dev_code':   dev_code,
        'email_sent': email_sent,
    })


# ROUTE: POST /api/auth/email/verify-code
@auth_bp.route('/api/auth/email/verify-code', methods=['POST'])
def email_verify_code():
    """V3: Vérifie le code 6 chiffres et crée la session."""
    data  = request.get_json()
    email = (data or {}).get('email', '').strip().lower()
    code  = (data or {}).get('code', '').strip()

    if not email or not code:
        return jsonify({'error': 'Email et code requis'}), 400

    cached = _email_codes.get(email)
    if not cached:
        return jsonify({'error': 'Aucun code envoyé pour cet email'}), 400
    if datetime.utcnow() > cached['expires_at']:
        del _email_codes[email]
        return jsonify({'error': 'Code expiré — demande un nouveau code'}), 400
    if cached['code'] != code:
        return jsonify({'error': 'Code incorrect'}), 400

    # Code valide — supprimer du cache
    del _email_codes[email]

    # Trouver ou créer utilisateur (google_id synthétique pour email auth)
    synthetic_google_id = f'email_{email}'
    user   = User.query.filter_by(google_id=synthetic_google_id).first()
    is_new = user is None

    if is_new:
        founder_count = User.query.filter_by(is_founder=True).count()
        user = User(
            google_id  = synthetic_google_id,
            email      = email,
            name       = email.split('@')[0].replace('.', ' ').title(),
            is_founder = founder_count < 50,
            slug       = _make_unique_slug(email.split('@')[0], email),
            last_login_date = date.today(),
        )
        db.session.add(user)
    else:
        user.last_active = datetime.utcnow()

    # Points connexion quotidienne
    today                = date.today()
    is_first_login_today = False
    points_earned        = 0
    streak_bonus         = False

    if user.last_login_date != today:
        is_first_login_today = True
        points_earned        = Config.POINTS_LOGIN_QUOTIDIEN
        user.points          = (user.points or 0) + points_earned
        if user.last_login_date == today - timedelta(days=1):
            user.streak = (user.streak or 0) + 1
            if user.streak % 7 == 0:
                user.points += Config.POINTS_STREAK_7_JOURS
                streak_bonus = True
        else:
            user.streak = 1
        user.last_login_date = today

    db.session.commit()

    session['user_id']           = user.id
    session['first_login_today'] = is_first_login_today
    session['login_points']      = points_earned
    session['streak_bonus']      = streak_bonus
    session.permanent            = True

    redirect_to = '/onboarding.html' if is_new or not user.onboarding_complete else '/dashboard.html'
    return jsonify({
        'success':  True,
        'redirect': redirect_to,
        'is_new':   is_new,
    })
