# ROUTE: Profils publics — accessibles sans connexion
import os
import json
from flask import Blueprint, jsonify
from backend.models import db, User, Questionnaire, Response

profiles_bp = Blueprint('profiles', __name__)

ADMIN_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'admin')


def _get_user_by_slug(slug):
    """Cherche par slug d'abord, puis par ID en fallback."""
    user = User.query.filter_by(slug=slug).first()
    if not user:
        user = User.query.filter_by(id=slug).first()
    return user


def _load_schools():
    path = os.path.join(ADMIN_DIR, 'schools.json')
    if not os.path.exists(path):
        return {}, {}
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    school_names = {}
    uni_names    = {}
    for uni in data.get('universities', []):
        uni_names[uni['id']] = uni['name']
        for s in uni.get('schools', []):
            school_names[s['id']] = s['name']
    return school_names, uni_names


# ROUTE: GET /api/profiles/:slug
# OBJECTIF: Données publiques du profil — accessible sans login
@profiles_bp.route('/api/profiles/<string:slug>', methods=['GET'])
def get_profile(slug):
    user = _get_user_by_slug(slug)
    if not user:
        return jsonify({'error': 'profil introuvable'}), 404

    school_names, uni_names = _load_schools()

    total_responses      = Response.query.filter_by(respondent_id=user.id).count()
    total_questionnaires = Questionnaire.query.filter_by(author_id=user.id, is_active=True).count()

    # Complétion moyenne des réponses données
    responses  = Response.query.filter_by(respondent_id=user.id).all()
    avg_compl  = (sum(r.completion_percentage or 0 for r in responses) / len(responses)
                  if responses else 0)

    # Rang par école (points décroissants)
    school_rank  = None
    school_total = 0
    if user.school_id:
        peers       = User.query.filter_by(school_id=user.school_id)\
                               .order_by(User.points.desc()).all()
        school_total = len(peers)
        school_rank  = next((i + 1 for i, u in enumerate(peers) if u.id == user.id), None)

    # Rang général
    total_users  = User.query.count()
    all_users    = User.query.order_by(User.points.desc()).all()
    general_rank = next((i + 1 for i, u in enumerate(all_users) if u.id == user.id), None)
    top_pct      = round((general_rank / total_users) * 100, 1) if (general_rank and total_users) else None

    domain = (user.domains or [None])[0] if user.domains else None

    return jsonify({
        'slug':               user.slug or user.id,
        'name':               user.name or 'Utilisateur',
        'avatar_url':         user.avatar_url,
        'email':              user.email,
        'school_id':          user.school_id,
        'school_name':        school_names.get(user.school_id or '', user.school_id or '—'),
        'university_id':      user.university_id,
        'university_name':    uni_names.get(user.university_id or '', user.university_id or '—'),
        'domain':             domain,
        'level':              user.level,
        'points':             user.points or 0,
        'badge_level':        user.badge_level or 'novice',
        'is_founder':         user.is_founder or False,
        'monthly_responses':  user.monthly_responses_given or 0,
        'created_at':         user.created_at.isoformat() if user.created_at else None,
        'total_responses':    total_responses,
        'total_questionnaires': total_questionnaires,
        'avg_completion':     round(avg_compl, 1),
        'school_rank':        school_rank,
        'school_total':       school_total,
        'general_rank':       general_rank,
        'top_pct':            top_pct,
    })


# ROUTE: GET /api/profiles/:slug/questionnaires
# OBJECTIF: Portfolio de recherche public de l'utilisateur
@profiles_bp.route('/api/profiles/<string:slug>/questionnaires', methods=['GET'])
def get_profile_questionnaires(slug):
    user = _get_user_by_slug(slug)
    if not user:
        return jsonify({'error': 'profil introuvable'}), 404

    forms = Questionnaire.query.filter_by(author_id=user.id, is_active=True)\
                               .order_by(Questionnaire.created_at.desc()).all()
    return jsonify({'items': [q.to_dict() for q in forms], 'total': len(forms)})