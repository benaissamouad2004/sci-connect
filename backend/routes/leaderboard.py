# ROUTE: GET /api/leaderboard — classement top utilisateurs
from flask import Blueprint, jsonify, request, session
from backend.models import db, User, Response, Questionnaire

leaderboard_bp = Blueprint('leaderboard', __name__)

@leaderboard_bp.route('/api/leaderboard', methods=['GET'])
def get_leaderboard():
    scope = request.args.get('scope', 'global')
    limit = min(int(request.args.get('limit', 20)), 50)
    user_id = session.get('user_id')

    q = User.query.filter(User.points > 0)
    users = q.order_by(User.points.desc()).limit(limit).all()

    items = []
    for i, u in enumerate(users):
        total_resp = Response.query.filter_by(respondent_id=u.id).count()
        total_forms = Questionnaire.query.filter_by(author_id=u.id, is_active=True).count()
        domain = (u.domains or [None])[0] if u.domains else None
        items.append({
            'rank': i + 1,
            'id': u.id,
            'name': u.name or 'Anonyme',
            'avatar_url': u.avatar_url,
            'school_id': u.school_id,
            'university_id': u.university_id,
            'domain': domain,
            'points': u.points or 0,
            'badge_level': u.badge_level or 'novice',
            'total_responses': total_resp,
            'total_forms': total_forms,
            'slug': u.slug,
            'is_me': u.id == user_id,
        })

    # Rang de l'utilisateur actuel
    my_rank = None
    if user_id:
        all_users = User.query.order_by(User.points.desc()).all()
        my_rank = next((i + 1 for i, u in enumerate(all_users) if u.id == user_id), None)

    return jsonify({'items': items, 'my_rank': my_rank, 'total': User.query.count()})