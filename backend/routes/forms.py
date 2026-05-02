# ROUTE: Routes questionnaires
import re
import json
import os
from datetime import datetime
from flask import Blueprint, request, jsonify, session
from backend.models import db, User, Questionnaire, Response

forms_bp = Blueprint('forms', __name__)

ADMIN_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'admin')

# EDITABLE: regex validation URL Google Forms — accepte /d/e/, /d/, et forms.gle
GOOGLE_FORMS_REGEX = re.compile(r'(?:docs\.google\.com/forms/d/(?:e/)?|forms\.gle/)([^/?&#\s]+)')


def extract_form_id(url):
    match = GOOGLE_FORMS_REGEX.search(url)
    return match.group(1) if match else None


def _get_content():
    path = os.path.join(ADMIN_DIR, 'content.json')
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


# ROUTE: GET /api/forms
# OBJECTIF: Retourner la liste des questionnaires actifs, filtrés
# Exclut les formulaires déjà répondus par l'utilisateur connecté
@forms_bp.route('/api/forms', methods=['GET'])
def list_forms():
    university_id = request.args.get('university_id')
    school_id     = request.args.get('school_id')
    domain        = request.args.get('domain')
    level         = request.args.get('level')
    limit         = min(int(request.args.get('limit', 20)), 50)
    offset        = int(request.args.get('offset', 0))

    q = Questionnaire.query.filter_by(is_active=True)
    if university_id:
        q = q.filter_by(university_id=university_id)
    if school_id:
        q = q.filter_by(school_id=school_id)
    if domain:
        q = q.filter_by(domain=domain)
    if level:
        q = q.filter_by(target_level=level)

    # Récupérer les questionnaires déjà répondus (pour les marquer, sans les cacher)
    user_id = session.get('user_id')
    answered_ids = set()
    if user_id:
        answered_ids = {
            r.questionnaire_id
            for r in Response.query.filter_by(respondent_id=user_id).all()
        }

    total = q.count()
    items = q.order_by(Questionnaire.created_at.desc()).offset(offset).limit(limit).all()

    results = []
    for item in items:
        d = item.to_dict()
        d['already_responded'] = item.id in answered_ids
        author = User.query.filter_by(id=item.author_id).first()
        if author:
            d['author_name']   = author.name
            d['author_school'] = author.school_id
            d['author_level']  = author.level
        results.append(d)

    # Tri : questionnaires non répondus en premier
    results.sort(key=lambda x: x.get('already_responded', False))

    return jsonify({'items': results, 'total': total, 'limit': limit, 'offset': offset})


# ROUTE: POST /api/forms
# OBJECTIF: Créer un questionnaire (nécessite monthly_responses_given >= 2 ou is_founder)
# EDITABLE: responses_required dans admin/content.json → rules.responses_required
@forms_bp.route('/api/forms', methods=['POST'])
def create_form():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'non authentifié'}), 401

    user = User.query.filter_by(id=user_id).first()
    if not user:
        return jsonify({'error': 'utilisateur introuvable'}), 404

    # Vérifier la règle multi-dépôt : chaque dépôt nécessite 2 réponses supplémentaires
    try:
        content = _get_content()
        responses_per_deposit = content.get('rules', {}).get('responses_required', 2)
    except Exception:
        responses_per_deposit = 2

    # Compter les dépôts effectués ce mois-ci
    now = datetime.utcnow()
    first_of_month = datetime(now.year, now.month, 1)
    monthly_deposits = Questionnaire.query.filter(
        Questionnaire.author_id == user_id,
        Questionnaire.created_at >= first_of_month
    ).count()

    # Réponses requises = (dépôts_ce_mois + 1) × responses_per_deposit
    required = (monthly_deposits + 1) * responses_per_deposit
    is_founder_first = user.is_founder and Questionnaire.query.filter_by(author_id=user_id).count() == 0

    can_deposit = user.monthly_responses_given >= required or is_founder_first

    if not can_deposit:
        return jsonify({
            'error': 'règle des 2 non remplie',
            'monthly_responses_given': user.monthly_responses_given,
            'required': required,
            'monthly_deposits': monthly_deposits,
        }), 403

    data = request.get_json()
    if not data:
        return jsonify({'error': 'données manquantes'}), 400

    url = data.get('google_forms_url', '').strip()
    if not url:
        return jsonify({'error': 'URL Google Forms manquante'}), 400

    form_id = extract_form_id(url)
    if not form_id:
        return jsonify({'error': 'URL Google Forms invalide'}), 400

    title = data.get('title', '').strip()
    if not title:
        return jsonify({'error': 'titre manquant'}), 400

    image_url = (data.get('image_url') or '').strip() or None

    q = Questionnaire(
        title            = title,
        description      = data.get('description', '').strip(),
        google_forms_url = url,
        form_id          = form_id,
        domain           = data.get('domain'),
        target_level     = data.get('target_level'),
        target_count     = int(data.get('target_count', 100)),
        author_id        = user_id,
        school_id        = user.school_id,
        university_id    = user.university_id,
        image_url        = image_url,
    )
    db.session.add(q)
    db.session.commit()

    # EMAIL 1 : confirmation à l'auteur
    try:
        from backend.services.email_service import send_deposit_confirmation_email
        send_deposit_confirmation_email(q, user)
    except Exception:
        pass

    # EMAIL 2 : notification aux utilisateurs du même domaine
    try:
        if q.domain:
            from backend.services.email_service import send_new_questionnaire_domain_notification

            try:
                points_per_response = content.get('rules', {}).get('points_per_response', 10)
            except Exception:
                points_per_response = 10

            # Trouver les utilisateurs ayant ce domaine dans leurs centres d'intérêt
            # et exclure l'auteur lui-même
            all_users = User.query.filter(
                User.id != user_id,
                User.onboarding_complete == True,
                User.email != None,
            ).limit(300).all()

            matching_users = [
                u for u in all_users
                if u.domains and q.domain in (u.domains if isinstance(u.domains, list) else [])
            ]

            send_new_questionnaire_domain_notification(q, user, matching_users, points_per_response)
    except Exception:
        pass

    return jsonify({'success': True, 'questionnaire': q.to_dict()}), 201


# ROUTE: GET /api/forms/recommended
# OBJECTIF: Retourner les formulaires recommandés selon le profil utilisateur
# DOIT être défini AVANT /api/forms/<string:form_id> pour éviter les conflits de routing
@forms_bp.route('/api/forms/recommended', methods=['GET'])
def get_recommended():
    user_id = session.get('user_id')
    limit   = min(int(request.args.get('limit', 6)), 12)

    if not user_id:
        items = Questionnaire.query.filter_by(is_active=True)\
                                   .order_by(Questionnaire.created_at.desc())\
                                   .limit(limit).all()
        return jsonify({'items': [q.to_dict() for q in items], 'authenticated': False})

    user = User.query.filter_by(id=user_id).first()
    if not user:
        return jsonify({'items': [], 'authenticated': False})

    from backend.services.recommendation import get_recommended_forms
    scored = get_recommended_forms(user, limit=limit)

    results = []
    for form, score in scored:
        d = form.to_dict()
        d['recommendation_score'] = score
        author = User.query.filter_by(id=form.author_id).first()
        if author:
            d['author_name']  = author.name
            d['author_school'] = author.school_id
        results.append(d)

    return jsonify({'items': results, 'authenticated': True})


# ROUTE: GET /api/forms/:id
# OBJECTIF: Détail d'un questionnaire
@forms_bp.route('/api/forms/<string:form_id>', methods=['GET'])
def get_form(form_id):
    q = Questionnaire.query.filter_by(id=form_id, is_active=True).first()
    if not q:
        return jsonify({'error': 'questionnaire introuvable'}), 404

    author = User.query.filter_by(id=q.author_id).first()
    return jsonify(q.to_dict(author=author))


# ROUTE: GET /api/schools
# OBJECTIF: Retourner schools.json (alias pratique pour le dashboard)
@forms_bp.route('/api/schools', methods=['GET'])
def get_schools():
    path = os.path.join(ADMIN_DIR, 'schools.json')
    if not os.path.exists(path):
        return jsonify({'universities': []}), 200
    with open(path, 'r', encoding='utf-8') as f:
        return jsonify(json.load(f))
