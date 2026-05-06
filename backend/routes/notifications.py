# ROUTE: GET /api/notifications — enhanced notifications with response events
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

    # ─── Badge level notifications ───
    pts = user.points or 0
    badge_thresholds = [
        (50,  'Contributeur', '🎯', 'Tu as atteint 50 points ! Badge Contributeur débloqué.'),
        (150, 'Expert',       '🏆', 'Tu as atteint 150 points ! Badge Expert débloqué.'),
        (300, 'Master',       '👑', 'Tu as atteint 300 points ! Badge Master débloqué.'),
    ]
    for threshold, name, icon, body in badge_thresholds:
        if pts >= threshold:
            notifs.append({
                'id': f'badge-{name.lower()}',
                'type': 'badge',
                'icon': icon,
                'title': f'Badge {name} débloqué !',
                'body': body,
                'time': user.last_active.isoformat() if user.last_active else None,
                'read': True,
            })

    # ─── Response notifications for questionnaire authors ───
    forms = Questionnaire.query.filter_by(author_id=user_id, is_active=True).all()
    for form in forms:
        # Recent responses (last 24h)
        recent = Response.query.filter_by(questionnaire_id=form.id)\
                    .filter(Response.created_at >= datetime.utcnow().replace(hour=0, minute=0, second=0))\
                    .count()
        if recent > 0:
            notifs.append({
                'id': f'responses-today-{form.id}',
                'type': 'response',
                'icon': '📬',
                'title': f'{recent} nouvelle{"s" if recent > 1 else ""} réponse{"s" if recent > 1 else ""}',
                'body': f'"{form.title}" a reçu {recent} réponse{"s" if recent > 1 else ""} aujourd\'hui.',
                'time': datetime.utcnow().isoformat(),
                'read': False,
            })

        # Milestone notifications
        count = form.response_count or 0
        for milestone in [5, 10, 25, 50, 75, 100]:
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

    # ─── Founder badge ───
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

    # ─── Streak notifications ───
    streak = user.streak or 0
    if streak >= 3:
        notifs.append({
            'id': f'streak-{streak}',
            'type': 'streak',
            'icon': '🔥',
            'title': f'Streak de {streak} jours !',
            'body': 'Continue de répondre chaque jour pour maintenir ton streak.',
            'time': user.last_active.isoformat() if user.last_active else None,
            'read': True,
        })

    # ─── Suggestion ───
    notifs.append({
        'id': 'suggestion-weekly',
        'type': 'suggestion',
        'icon': '💡',
        'title': 'Nouvelles études disponibles',
        'body': 'Des questionnaires dans ton domaine t\'attendent.',
        'time': datetime.utcnow().isoformat(),
        'read': False,
    })

    # Sort: unread first, then by time
    notifs.sort(key=lambda n: (n['read'], n.get('time', '') or ''), reverse=False)

    return jsonify({'items': notifs, 'unread': sum(1 for n in notifs if not n['read'])})


# ROUTE: GET /api/forms/:id/stats — stats for questionnaire owner (#9)
@notifications_bp.route('/api/forms/<string:form_id>/stats', methods=['GET'])
def form_stats(form_id):
    q = Questionnaire.query.filter_by(id=form_id).first()
    if not q:
        return jsonify({'error': 'questionnaire introuvable'}), 404

    responses = Response.query.filter_by(questionnaire_id=form_id).all()
    total = len(responses)
    verified = sum(1 for r in responses if r.respondent_type == 'verified')
    public = sum(1 for r in responses if r.respondent_type == 'public')
    suspect = sum(1 for r in responses if r.is_suspect)

    # Average duration
    durations = [r.duration_seconds for r in responses if r.duration_seconds and r.duration_seconds > 0]
    avg_duration = round(sum(durations) / len(durations)) if durations else None

    # Daily breakdown (last 7 days)
    from datetime import timedelta
    daily = {}
    for i in range(7):
        day = (datetime.utcnow() - timedelta(days=i)).strftime('%Y-%m-%d')
        daily[day] = 0
    for r in responses:
        if r.created_at:
            day_key = r.created_at.strftime('%Y-%m-%d')
            if day_key in daily:
                daily[day_key] += 1

    return jsonify({
        'form_id': form_id,
        'title': q.title,
        'total_responses': total,
        'verified_responses': verified,
        'public_responses': public,
        'suspect_responses': suspect,
        'avg_duration_seconds': avg_duration,
        'daily_breakdown': daily,
        'created_at': q.created_at.isoformat() if q.created_at else None,
    })