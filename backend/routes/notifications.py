# ROUTE: GET /api/notifications — liste des notifications utilisateur
# Les notifications sont générées depuis les événements (milestones, suggestions)
from flask import Blueprint, jsonify, session
from backend.models import db, User, Response, Questionnaire
from datetime import datetime

notifications_bp = Blueprint('notifications', __name__)

@notifications_bp.route('/api/notifications', methods=['GET'])
def get_notifications():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'non authentifié'}), 401

    user = User.query.filter_by(id=user_id).first()
    if not user:
        return jsonify({'error': 'introuvable'}), 404

    notifs = []

    # Notifications basées sur les milestones des questionnaires
    forms = Questionnaire.query.filter_by(author_id=user_id, is_active=True).all()
    for form in forms:
        count = form.response_count or 0
        for milestone in [10, 25, 50, 75, 100]:
            if count >= milestone:
                notifs.append({
                    'id': f'milestone-{form.id}-{milestone}',
                    'type': 'milestone',
                    'icon': '🎉',
                    'title': f'{milestone} réponses atteintes !',
                    'body': f'"{form.title}" a reçu {milestone} réponses.',
                    'time': form.created_at.isoformat() if form.created_at else None,
                    'read': count > milestone,
                })
                break

    # Notification de bienvenue
    if user.is_founder:
        notifs.append({
            'id': 'welcome-founder',
            'type': 'badge',
            'icon': '✦',
            'title': 'Badge Fondateur débloqué !',
            'body': 'Tu fais partie des premiers membres de SciConnect.',
            'time': user.created_at.isoformat() if user.created_at else None,
            'read': True,
        })

    # Suggestion hebdomadaire
    notifs.append({
        'id': 'suggestion-weekly',
        'type': 'suggestion',
        'icon': '💡',
        'title': 'Nouvelles études disponibles',
        'body': 'Des questionnaires dans ton domaine t\'attendent.',
        'time': datetime.utcnow().isoformat(),
        'read': False,
    })

    return jsonify({'items': notifs, 'unread': sum(1 for n in notifs if not n['read'])})