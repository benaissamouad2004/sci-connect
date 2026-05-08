# ROUTE: Endpoints admin live-edit + panneau d'administration secret
# OBJECTIF: Permettre de modifier content.json, settings.json, schools.json sans redémarrer
#           + Dashboard admin protégé par login/mot de passe
# Tous les POST sont protégés par session (admin uniquement en production)

import os
import json
import hmac
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify, session, send_from_directory
from backend.models import db, User, Questionnaire
from backend.config import FRONTEND_DIR

admin_bp  = Blueprint('admin', __name__)
ADMIN_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'admin')

ALLOWED_FILES = {'content', 'settings', 'schools'}


def _path(name):
    return os.path.join(ADMIN_DIR, f'{name}.json')


def _read(name):
    with open(_path(name), 'r', encoding='utf-8') as f:
        return json.load(f)


def _write(name, data):
    with open(_path(name), 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def _require_admin():
    """Vérifie qu'un utilisateur est connecté (et fondateur en guise d'admin simple)."""
    user_id = session.get('user_id')
    if not user_id:
        return None, jsonify({'error': 'non authentifié'}), 401
    user = User.query.filter_by(id=user_id).first()
    if not user:
        return None, jsonify({'error': 'utilisateur introuvable'}), 404
    # EDITABLE: restreindre aux fondateurs ou à un rôle admin dédié
    if not user.is_founder:
        return None, jsonify({'error': 'accès réservé aux administrateurs'}), 403
    return user, None, None


# ─── GET routes (déjà dans app.py — ici les aliases sous /admin/api/) ─────────

# ROUTE: GET /admin/content
@admin_bp.route('/admin/content', methods=['GET'])
def get_content():
    if not os.path.exists(_path('content')):
        return jsonify({'error': 'content.json introuvable'}), 404
    return jsonify(_read('content'))


# ROUTE: GET /admin/settings
@admin_bp.route('/admin/settings', methods=['GET'])
def get_settings():
    if not os.path.exists(_path('settings')):
        return jsonify({'error': 'settings.json introuvable'}), 404
    return jsonify(_read('settings'))


# ROUTE: GET /admin/schools
@admin_bp.route('/admin/schools', methods=['GET'])
def get_schools():
    if not os.path.exists(_path('schools')):
        return jsonify({'error': 'schools.json introuvable'}), 404
    return jsonify(_read('schools'))


# ─── POST routes (écriture protégée) ──────────────────────────────────────────

# ROUTE: POST /admin/content
# OBJECTIF: Mettre à jour admin/content.json — live-edit sans redémarrage
@admin_bp.route('/admin/content', methods=['POST'])
def update_content():
    user, err, code = _require_admin()
    if err:
        return err, code
    data = request.get_json()
    if not data:
        return jsonify({'error': 'données JSON manquantes'}), 400
    _write('content', data)
    return jsonify({'success': True, 'message': 'content.json mis à jour'})


# ROUTE: POST /admin/settings
# OBJECTIF: Mettre à jour admin/settings.json — labels boutons, feature flags
@admin_bp.route('/admin/settings', methods=['POST'])
def update_settings():
    user, err, code = _require_admin()
    if err:
        return err, code
    data = request.get_json()
    if not data:
        return jsonify({'error': 'données JSON manquantes'}), 400
    _write('settings', data)
    return jsonify({'success': True, 'message': 'settings.json mis à jour'})


# ROUTE: POST /admin/schools
# OBJECTIF: Mettre à jour admin/schools.json — ajouter/modifier des écoles
# EDITABLE: ajouter une université ou une école sans redémarrage
@admin_bp.route('/admin/schools', methods=['POST'])
def update_schools():
    user, err, code = _require_admin()
    if err:
        return err, code
    data = request.get_json()
    if not data or 'universities' not in data:
        return jsonify({'error': 'format invalide — champ "universities" requis'}), 400
    _write('schools', data)
    return jsonify({'success': True, 'message': 'schools.json mis à jour'})


# ROUTE: PUT /admin/demo-forms/:id
# OBJECTIF: Modifier un questionnaire de démonstration (admin uniquement)
@admin_bp.route('/admin/demo-forms/<string:form_id>', methods=['PUT'])
def update_demo_form(form_id):
    user, err, code = _require_admin()
    if err:
        return err, code

    from backend.models import db, Questionnaire
    from backend.data.demo_forms import DEMO_AUTHOR_ID

    q = Questionnaire.query.filter_by(id=form_id).first()
    if not q:
        return jsonify({'error': 'questionnaire introuvable'}), 404
    if q.author_id != DEMO_AUTHOR_ID:
        return jsonify({'error': 'ce questionnaire n\'est pas un questionnaire de démonstration'}), 403

    data = request.get_json() or {}
    if 'is_active' in data:
        q.is_active = bool(data['is_active'])
    if 'target_count' in data:
        q.target_count = int(data['target_count'])
    if 'response_count' in data:
        q.response_count = int(data['response_count'])

    db.session.commit()
    return jsonify({'success': True, 'questionnaire': q.to_dict()})


# ROUTE: GET /admin/status
# OBJECTIF: Vérifier l'état du serveur et des fichiers JSON
@admin_bp.route('/admin/status', methods=['GET'])
def status():
    files_ok = {name: os.path.exists(_path(name)) for name in ALLOWED_FILES}
    return jsonify({
        'server': 'ok',
        'files':  files_ok,
        'authenticated': bool(session.get('user_id')),
    })


# ═══ PANNEAU D'ADMINISTRATION SECRET ═══

ADMIN_PANEL_USERNAME = 'admin'
ADMIN_PANEL_PASSWORD = 'sciconnect-admin-2025'
ADMIN_SESSION_DURATION = 3600


def _check_admin_session():
    if not session.get('admin_panel_auth'):
        return False
    login_time = session.get('admin_panel_login_time')
    if not login_time:
        return False
    try:
        login_dt = datetime.fromisoformat(login_time)
        if (datetime.utcnow() - login_dt).total_seconds() > ADMIN_SESSION_DURATION:
            session.pop('admin_panel_auth', None)
            session.pop('admin_panel_login_time', None)
            return False
    except (ValueError, TypeError):
        return False
    return True


@admin_bp.route('/admin')
def admin_panel_page():
    return send_from_directory(FRONTEND_DIR, 'admin.html')


@admin_bp.route('/admin/panel/login', methods=['POST'])
def admin_panel_login():
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Données manquantes'}), 400
    username = data.get('username', '')
    password = data.get('password', '')
    if (hmac.compare_digest(username, ADMIN_PANEL_USERNAME) and
            hmac.compare_digest(password, ADMIN_PANEL_PASSWORD)):
        session['admin_panel_auth'] = True
        session['admin_panel_login_time'] = datetime.utcnow().isoformat()
        return jsonify({'success': True})
    return jsonify({'error': 'Identifiants incorrects'}), 401


@admin_bp.route('/admin/panel/logout', methods=['POST'])
def admin_panel_logout():
    session.pop('admin_panel_auth', None)
    session.pop('admin_panel_login_time', None)
    return jsonify({'success': True})


@admin_bp.route('/admin/panel/check', methods=['GET'])
def admin_panel_check():
    return jsonify({'authenticated': _check_admin_session()})


@admin_bp.route('/admin/panel/data', methods=['GET'])
def admin_panel_data():
    if not _check_admin_session():
        return jsonify({'error': 'Non authentifié'}), 401
    total_users = User.query.count()
    total_questionnaires = Questionnaire.query.count()
    today = datetime.utcnow().date()
    new_today = User.query.filter(db.func.date(User.created_at) == today).count()
    week_ago = today - timedelta(days=7)
    new_this_week = User.query.filter(
        User.created_at >= datetime.combine(week_ago, datetime.min.time())
    ).count()
    users = User.query.order_by(User.created_at.desc()).all()
    users_list = [{
        'name': u.name or 'Sans nom',
        'email': u.email,
        'created_at': u.created_at.strftime('%d/%m/%Y %H:%M') if u.created_at else '—'
    } for u in users]
    daily_signups = []
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        count = User.query.filter(db.func.date(User.created_at) == day).count()
        daily_signups.append({
            'date': day.strftime('%d/%m'),
            'day_name': ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'][day.weekday()],
            'count': count
        })
    return jsonify({
        'total_users': total_users,
        'total_questionnaires': total_questionnaires,
        'new_today': new_today,
        'new_this_week': new_this_week,
        'users': users_list,
        'daily_signups': daily_signups
    })
