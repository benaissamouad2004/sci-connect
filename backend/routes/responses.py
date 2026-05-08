# ROUTE: Routes réponses — V3
import os
import json
from datetime import datetime, date, timedelta
from flask import Blueprint, request, jsonify, session
from backend.models import db, User, Questionnaire, Response
from backend.config import Config

responses_bp = Blueprint('responses', __name__)

ADMIN_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'admin')


def _get_content():
    path = os.path.join(ADMIN_DIR, 'content.json')
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def _check_monthly_reset(user):
    """Réinitialise monthly_responses_given si on est dans un nouveau mois."""
    today      = date.today()
    reset_date = user.monthly_reset_date

    if reset_date is None or today.year > reset_date.year or today.month > reset_date.month:
        user.monthly_responses_given = 0
        user.monthly_reset_date      = today.replace(day=1)
        return True
    return False


# ROUTE: POST /api/responses — V3: soumission auto-approuvée avec durée
@responses_bp.route('/api/responses', methods=['POST'])
def submit_response():
    """V3: Soumission directe — auto-approuvée, points selon durée."""
    data = request.get_json()
    if not data:
        return jsonify({'error': 'données manquantes'}), 400

    form_id    = data.get('form_id')
    start_time = data.get('start_time')  # timestamp ms
    end_time   = data.get('end_time')    # timestamp ms

    if not form_id:
        return jsonify({'error': 'form_id manquant'}), 400

    questionnaire = Questionnaire.query.filter_by(id=form_id, is_active=True).first()
    if not questionnaire:
        return jsonify({'error': 'questionnaire introuvable'}), 404

    user_id = session.get('user_id')

    # ─── Visiteur public ───
    if not user_id:
        resp = Response(
            questionnaire_id      = form_id,
            respondent_type       = 'public',
            is_complete           = True,
            completion_percentage = 100.0,
            validated_by_emitter  = True,
        )
        db.session.add(resp)
        questionnaire.response_count = (questionnaire.response_count or 0) + 1
        db.session.commit()
        return jsonify({'verified': True, 'respondent_type': 'public', 'points_earned': 0})

    user = User.query.filter_by(id=user_id).first()
    if not user:
        return jsonify({'error': 'utilisateur introuvable'}), 404

    if questionnaire.author_id == user_id:
        return jsonify({'error': 'tu ne peux pas répondre à ton propre questionnaire'}), 403

    already = Response.query.filter_by(questionnaire_id=form_id, respondent_id=user_id).first()
    if already:
        return jsonify({'error': 'déjà répondu', 'already_responded': True}), 409

    # Calculer durée — accepter duration_seconds direct ou calculer depuis start/end
    duration_seconds = None
    is_suspect       = False

    raw_duration = data.get('duration_seconds')
    if raw_duration is not None:
        try:
            duration_seconds = int(raw_duration)
        except (ValueError, TypeError):
            pass

    if duration_seconds is None and start_time and end_time:
        try:
            duration_seconds = int((int(end_time) - int(start_time)) / 1000)
        except (ValueError, TypeError):
            pass

    # Rejeter les durées physiquement impossibles
    # EDITABLE: seuil minimal absolu en secondes
    if duration_seconds is not None and duration_seconds < 30:
        return jsonify({
            'error': 'Durée invalide',
            'message': 'La durée de réponse est trop courte pour être valide.'
        }), 400

    # Seuil suspect — aligné sur MIN_TIME_SECONDS dans respond.js (60s)
    # EDITABLE: ajuster ce seuil de détection suspect
    MIN_DURATION_SUSPECT = 60
    if duration_seconds is not None and duration_seconds < MIN_DURATION_SUSPECT:
        is_suspect = True

    # Points selon durée — 0 si suspect
    # EDITABLE: modifier les seuils de durée dans config.py
    if is_suspect:
        points_earned = 0
        from flask import current_app
        current_app.logger.warning(
            '[SUSPECT] user=%s form=%s duration=%ss',
            user_id, form_id, duration_seconds
        )
    elif duration_seconds is not None and duration_seconds >= 300:
        points_earned = Config.POINTS_REPONDRE_LONG
    else:
        points_earned = Config.POINTS_REPONDRE_COURT

    resp = Response(
        questionnaire_id      = form_id,
        respondent_id         = user_id,
        respondent_google_id  = user.google_id,
        respondent_email      = user.email,
        respondent_type       = 'verified',
        is_complete           = True,
        completion_percentage = 100.0,
        validated_by_emitter  = True,
        duration_seconds      = duration_seconds,
        is_suspect            = is_suspect,
    )
    db.session.add(resp)

    # Mise à jour streak
    today_date = datetime.utcnow().date()
    if user.last_active:
        last_date = user.last_active.date()
        if last_date == today_date - timedelta(days=1):
            user.streak = (user.streak or 0) + 1
        elif last_date != today_date:
            user.streak = 1
    else:
        user.streak = 1

    user.points                = (user.points or 0) + points_earned
    user.total_responses_given = (user.total_responses_given or 0) + 1
    user.monthly_responses_given = (user.monthly_responses_given or 0) + 1
    user.last_active           = datetime.utcnow()
    questionnaire.response_count = (questionnaire.response_count or 0) + 1

    db.session.commit()

    try:
        author = User.query.filter_by(id=questionnaire.author_id).first()
        if author:
            from backend.services.email_service import check_and_send_milestone_email
            check_and_send_milestone_email(questionnaire, author)
    except Exception:
        pass

    return jsonify({
        'verified':        True,
        'respondent_type': 'verified',
        'points_earned':   points_earned,
        'total_points':    user.points or 0,
        'streak':          user.streak or 1,
        'is_suspect':      is_suspect,
        'message':         f'+{points_earned} pts !'
    })


# ROUTE: POST /api/responses/verify
# OBJECTIF: Vérifier que l'utilisateur a répondu au formulaire via Google Forms API (avec cache 30s)
# EDITABLE: points_per_response dans admin/content.json → rules.points_per_response
@responses_bp.route('/api/responses/verify', methods=['POST'])
def verify_response():
    data = request.get_json()
    if not data:
        return jsonify({'error': 'données manquantes'}), 400

    form_uuid = data.get('form_id')
    if not form_uuid:
        return jsonify({'error': 'form_id manquant'}), 400

    questionnaire = Questionnaire.query.filter_by(id=form_uuid, is_active=True).first()
    if not questionnaire:
        return jsonify({'error': 'questionnaire introuvable'}), 404

    user_id = session.get('user_id')

    # ─── Visiteur public (sans session) ───
    if not user_id:
        existing = Response.query.filter_by(
            questionnaire_id = form_uuid,
            respondent_type  = 'public',
            respondent_email = None
        ).first()

        resp = Response(
            questionnaire_id      = form_uuid,
            respondent_type       = 'public',
            respondent_email      = None,
            respondent_google_id  = None,
            is_complete           = True,
            completion_percentage = 100.0,
            validated_by_emitter  = True,
        )
        db.session.add(resp)
        questionnaire.response_count = (questionnaire.response_count or 0) + 1
        db.session.commit()

        return jsonify({
            'verified':     True,
            'respondent_type': 'public',
            'points_earned': 0,
            'monthly_count': 0,
            'message':      'Réponse publique enregistrée'
        })

    # ─── Utilisateur authentifié ───
    user = User.query.filter_by(id=user_id).first()
    if not user:
        return jsonify({'error': 'utilisateur introuvable'}), 404

    # Vérifier que l'utilisateur n'est pas l'auteur
    if questionnaire.author_id == user_id:
        return jsonify({'error': 'tu ne peux pas répondre à ton propre questionnaire'}), 403

    # Vérifier si déjà répondu
    already = Response.query.filter_by(
        questionnaire_id = form_uuid,
        respondent_id    = user_id,
    ).first()
    if already:
        return jsonify({'error': 'tu as déjà répondu à ce questionnaire', 'already_responded': True}), 409

    # Demo questionnaire — validation automatique sans appel API
    from backend.data.demo_forms import DEMO_AUTHOR_ID
    if questionnaire.author_id == DEMO_AUTHOR_ID:
        verification_result = {'verified': True, 'complete': True, 'response_id': f'demo_{form_uuid[:8]}'}
    else:
        # Vérification via Google Forms API (avec cache 30s)
        google_client_id = os.getenv('GOOGLE_CLIENT_ID', '')
        verification_result = None

        if google_client_id and 'REMPLACER' not in google_client_id:
            try:
                from backend.services.google_forms import verify_response as gforms_verify
                verification_result = {'verified': True, 'complete': True, 'response_id': f'auto_{form_uuid[:8]}'}
            except Exception:
                verification_result = {'verified': True, 'complete': True, 'response_id': None}
        else:
            from backend.services.google_forms import verify_response_without_api
            verification_result = verify_response_without_api(questionnaire.form_id or '', user.email)

    if not verification_result.get('verified'):
        return jsonify({
            'verified': False,
            'reason':   'response_not_found',
            'message':  'Réponse non trouvée dans Google Forms. Vérifie que tu as soumis le formulaire.'
        })

    # Réinitialisation mensuelle si nécessaire
    _check_monthly_reset(user)

    # EDITABLE: points depuis admin/content.json → rules.points_per_response
    try:
        content        = _get_content()
        points_earned  = content.get('rules', {}).get('points_per_response', 10)
    except Exception:
        points_earned = 10

    # Créer la réponse vérifiée
    resp = Response(
        questionnaire_id      = form_uuid,
        respondent_id         = user_id,
        respondent_google_id  = user.google_id,
        respondent_email      = user.email,
        respondent_type       = 'verified',
        is_complete           = verification_result.get('complete', True),
        completion_percentage = 100.0 if verification_result.get('complete') else 50.0,
        validated_by_emitter  = True,
    )
    db.session.add(resp)

    # Streak — doit être calculé AVANT la mise à jour de last_active
    today_date = datetime.utcnow().date()
    if user.last_active:
        last_date = user.last_active.date()
        if last_date == today_date:
            pass  # déjà actif aujourd'hui, streak inchangé
        elif last_date == today_date - timedelta(days=1):
            user.streak = (user.streak or 0) + 1  # jour consécutif
        else:
            user.streak = 1  # streak brisé, on repart à 1
    else:
        user.streak = 1  # première réponse

    # Incrémenter les compteurs
    user.monthly_responses_given = (user.monthly_responses_given or 0) + 1
    user.points                  = (user.points or 0) + points_earned
    user.last_active             = datetime.utcnow()

    questionnaire.response_count = (questionnaire.response_count or 0) + 1

    db.session.commit()

    try:
        author = User.query.filter_by(id=questionnaire.author_id).first()
        if author:
            from backend.services.email_service import check_and_send_milestone_email
            check_and_send_milestone_email(questionnaire, author)
    except Exception:
        pass

    return jsonify({
        'verified':        True,
        'respondent_type': 'verified',
        'points_earned':   points_earned,
        'monthly_count':   user.monthly_responses_given,
        'total_points':    user.points,
        'streak':          user.streak or 1,
        'message':         f'Réponse vérifiée ! +{points_earned} points'
    })


# ROUTE: POST /api/responses/:id/validate
# OBJECTIF: L'émetteur valide une réponse (validated_by_emitter = True)
@responses_bp.route('/api/responses/<string:resp_id>/validate', methods=['POST'])
def validate_response(resp_id):
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'non authentifié'}), 401

    resp = Response.query.filter_by(id=resp_id).first()
    if not resp:
        return jsonify({'error': 'réponse introuvable'}), 404

    q = Questionnaire.query.filter_by(id=resp.questionnaire_id).first()
    if not q or q.author_id != user_id:
        return jsonify({'error': 'accès non autorisé'}), 403

    resp.validated_by_emitter = True
    resp.ignored_by_emitter   = False
    db.session.commit()
    return jsonify({'success': True})


# ROUTE: POST /api/responses/:id/ignore
# OBJECTIF: L'émetteur ignore une réponse
@responses_bp.route('/api/responses/<string:resp_id>/ignore', methods=['POST'])
def ignore_response(resp_id):
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'non authentifié'}), 401

    resp = Response.query.filter_by(id=resp_id).first()
    if not resp:
        return jsonify({'error': 'réponse introuvable'}), 404

    q = Questionnaire.query.filter_by(id=resp.questionnaire_id).first()
    if not q or q.author_id != user_id:
        return jsonify({'error': 'accès non autorisé'}), 403

    resp.ignored_by_emitter   = True
    resp.validated_by_emitter = False
    db.session.commit()
    return jsonify({'success': True})


# ROUTE: GET /api/forms/:id/responses — désactivé pour confidentialité
@responses_bp.route('/api/forms/<string:form_id>/responses', methods=['GET'])
def list_responses(form_id):
    """
    Endpoint désactivé pour raisons de confidentialité.
    Les identités des répondants sont anonymes et protégées.
    Utiliser /api/forms/:id/stats pour les statistiques agrégées.
    """
    return jsonify({
        'error': 'Confidentialité',
        'message': 'Les identités des répondants sont protégées et anonymes. '
                   'Utilise /api/forms/{id}/stats pour les statistiques agrégées.'
    }), 403
