# ROUTE: PATCH /api/users/me — mise à jour des préférences utilisateur
from flask import Blueprint, jsonify, request, session
from backend.models import db, User

users_settings_bp = Blueprint('users_settings', __name__)

@users_settings_bp.route('/api/users/me', methods=['PATCH'])
def update_settings():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'non authentifié'}), 401

    user = User.query.filter_by(id=user_id).first()
    if not user:
        return jsonify({'error': 'introuvable'}), 404

    data = request.get_json() or {}
    if 'domains' in data:
        user.domains = data['domains']
    if 'level' in data:
        user.level = data['level']
    if 'available_time' in data:
        user.available_time = data['available_time']

    db.session.commit()
    return jsonify({'success': True, 'user': user.to_dict()})