# ROUTE: Export Excel
import os
import json
from flask import Blueprint, session, jsonify, send_file
from backend.models import Questionnaire, Response

export_bp = Blueprint('export', __name__)

ADMIN_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'admin')


# ROUTE: GET /api/forms/:id/export
# OBJECTIF: Générer et télécharger le fichier Excel des réponses
# EDITABLE: bouton export depuis admin/settings.json → buttons.export_button_label
@export_bp.route('/api/forms/<string:form_id>/export', methods=['GET'])
def export_excel(form_id):
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'non authentifié'}), 401

    q = Questionnaire.query.filter_by(id=form_id).first()
    if not q:
        return jsonify({'error': 'questionnaire introuvable'}), 404

    if q.author_id != user_id:
        return jsonify({'error': 'accès non autorisé'}), 403

    responses = Response.query.filter_by(questionnaire_id=form_id)\
                              .order_by(Response.created_at.desc()).all()

    # Charger schools.json pour les noms lisibles
    schools_data = None
    schools_path = os.path.join(ADMIN_DIR, 'schools.json')
    if os.path.exists(schools_path):
        with open(schools_path, 'r', encoding='utf-8') as f:
            schools_data = json.load(f)

    from backend.services.export import generate_excel
    output = generate_excel(q, responses, schools_data)

    safe_title = ''.join(c for c in q.title if c.isalnum() or c in ' _-')[:40].strip()
    filename   = f"SciConnect_{safe_title}.xlsx"

    return send_file(
        output,
        mimetype    = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        as_attachment = True,
        download_name = filename,
    )


# ROUTE: GET /api/forms/:id/benchmark
# OBJECTIF: Retourner les métriques comparatives avec la moyenne communauté SciConnect
# EDITABLE: modifier les valeurs de référence communauté ci-dessous
@export_bp.route('/api/forms/<string:form_id>/benchmark', methods=['GET'])
def get_benchmark(form_id):
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'non authentifié'}), 401

    q = Questionnaire.query.filter_by(id=form_id).first()
    if not q:
        return jsonify({'error': 'questionnaire introuvable'}), 404

    if q.author_id != user_id:
        return jsonify({'error': 'accès non autorisé'}), 403

    responses = Response.query.filter_by(questionnaire_id=form_id).all()
    total     = len(responses)
    verified  = sum(1 for r in responses if r.respondent_type == 'verified')
    avg_compl = (sum(r.completion_percentage or 0 for r in responses) / total) if total > 0 else 0
    pct_verif = round((verified / total * 100), 1) if total > 0 else 0

    # Réponses par jour (depuis la création)
    from datetime import datetime
    days_active = max(1, (datetime.utcnow() - q.created_at).days) if q.created_at else 1
    resp_per_day = round(total / days_active, 1)

    # EDITABLE: moyennes communauté SciConnect — mettre à jour avec de vraies données
    community_avg = {
        'completion_rate': 78.0,
        'responses_per_day': 3.2,
        'verified_pct': 62.0,
        'avg_duration_sec': 240,
    }

    return jsonify({
        'my': {
            'completion_rate':   round(avg_compl, 1),
            'responses_per_day': resp_per_day,
            'verified_pct':      pct_verif,
        },
        'community': community_avg,
        'total':     total,
        'days_active': days_active,
    })


# ROUTE: GET /api/forms/:id/stats
# OBJECTIF: Retourner les statistiques agrégées anonymisées d'un questionnaire
# Aucune donnée personnelle identifiable n'est retournée — données agrégées uniquement
# EDITABLE: ajouter ou retirer des métriques agrégées selon les besoins
@export_bp.route('/api/forms/<string:form_id>/stats', methods=['GET'])
def get_stats(form_id):
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'non authentifié'}), 401

    q = Questionnaire.query.filter_by(id=form_id).first()
    if not q:
        return jsonify({'error': 'questionnaire introuvable'}), 404

    if q.author_id != user_id:
        return jsonify({'error': 'accès non autorisé'}), 403

    responses = Response.query.filter_by(questionnaire_id=form_id).all()
    total     = len(responses)
    verified  = sum(1 for r in responses if r.respondent_type == 'verified')
    public    = sum(1 for r in responses if r.respondent_type == 'public')
    validated = sum(1 for r in responses if r.validated_by_emitter)
    complete  = sum(1 for r in responses if r.is_complete)
    suspects  = sum(1 for r in responses if r.is_suspect or False)
    avg_completion = (
        sum(r.completion_percentage or 0 for r in responses) / total
        if total > 0 else 0
    )

    pct_of_goal = round((total / q.target_count) * 100, 1) if q.target_count > 0 else 0

    # Durée moyenne (agrégée — pas de données individuelles)
    durations = [r.duration_seconds for r in responses if r.duration_seconds and r.duration_seconds > 0]
    avg_duration = round(sum(durations) / len(durations)) if durations else 0

    # Dernière réponse (timestamp seulement, pas d'identité)
    last_response_at = None
    dated = [r for r in responses if r.created_at]
    if dated:
        last_response_at = max(r.created_at for r in dated).isoformat()

    # Réponses par jour — 7 derniers jours (comptages uniquement)
    from datetime import datetime, timedelta
    daily = {}
    for i in range(7):
        day = (datetime.utcnow() - timedelta(days=i)).strftime('%Y-%m-%d')
        daily[day] = 0
    for r in responses:
        if r.created_at:
            day = r.created_at.strftime('%Y-%m-%d')
            if day in daily:
                daily[day] += 1
    daily_list = [{'date': k, 'count': v} for k, v in sorted(daily.items())]

    # Répartition par université et niveau (agrégée, pas d'emails)
    from collections import Counter
    from backend.models import User as UserModel

    respondent_ids = [r.respondent_id for r in responses if r.respondent_id]
    by_university  = {}
    by_level       = {}

    if respondent_ids:
        respondents = UserModel.query.filter(UserModel.id.in_(respondent_ids)).all()

        # Charger les noms lisibles depuis schools.json
        uni_names   = {}
        schools_path = os.path.join(ADMIN_DIR, 'schools.json')
        if os.path.exists(schools_path):
            try:
                with open(schools_path, 'r', encoding='utf-8') as f:
                    schools_local = json.load(f)
                for uni in schools_local.get('universities', []):
                    uni_names[uni['id']] = uni['name']
            except Exception:
                pass

        uni_counts   = Counter(uni_names.get(u.university_id, u.university_id or '—') for u in respondents)
        level_counts = Counter(u.level or '—' for u in respondents)
        by_university = dict(uni_counts.most_common())
        by_level      = dict(level_counts.most_common())

    # Inclure les répondants publics dans la répartition
    public_count = sum(1 for r in responses if not r.respondent_id)
    if public_count > 0:
        by_university['Public général'] = by_university.get('Public général', 0) + public_count

    return jsonify({
        'questionnaire':    q.to_dict(),
        'total_responses':  total,
        'complete_count':   complete,
        'verified':         verified,
        'public':           public,
        'validated':        validated,
        'suspect_count':    suspects,
        'avg_completion':   round(avg_completion, 1),
        'pct_of_goal':      pct_of_goal,
        'avg_duration_sec': avg_duration,
        'last_response_at': last_response_at,
        'by_university':    by_university,
        'by_level':         by_level,
        'daily_responses':  daily_list,
    })
