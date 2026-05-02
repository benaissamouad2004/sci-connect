# SERVICE: Google Forms API — cache obligatoire 30 secondes
# Ne jamais appeler sans ce cache — risque de quota dépassé
import time
import os
import json

# Cache simple — max 1 appel API par 30 secondes par formulaire
_response_cache = {}

# EDITABLE: durée du cache — changer dans admin/settings.json → features.live_counter_refresh_seconds
CACHE_DURATION = 30   # secondes

ADMIN_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'admin')


def _get_cache_duration():
    """Lit la durée du cache depuis settings.json si disponible."""
    try:
        path = os.path.join(ADMIN_DIR, 'settings.json')
        with open(path, 'r', encoding='utf-8') as f:
            s = json.load(f)
        return s.get('features', {}).get('live_counter_refresh_seconds', CACHE_DURATION)
    except Exception:
        return CACHE_DURATION


def get_form_responses(form_id, credentials):
    """
    Récupère les réponses depuis Google Forms API avec cache.
    Ne jamais appeler sans ce cache — risque de quota dépassé.
    """
    now      = time.time()
    duration = _get_cache_duration()
    cached   = _response_cache.get(form_id)

    if cached and (now - cached['timestamp']) < duration:
        return cached['data']

    try:
        from googleapiclient.discovery import build
        service   = build('forms', 'v1', credentials=credentials)
        result    = service.forms().responses().list(formId=form_id).execute()
        responses = result.get('responses', [])
    except Exception as e:
        # En cas d'erreur API, retourner le cache expiré plutôt que planter
        if cached:
            return cached['data']
        raise e

    _response_cache[form_id] = {'data': responses, 'timestamp': now}
    return responses


def verify_response(form_id, user_email, credentials):
    """
    Vérifie si l'email a répondu au formulaire et si la réponse est complète.
    Retourne : {'verified': bool, 'complete': bool, 'response_id': str|None}
    """
    responses = get_form_responses(form_id, credentials)
    for response in responses:
        if response.get('respondentEmail') == user_email:
            answers = response.get('answers', {})
            return {
                'verified':    True,
                'complete':    len(answers) > 0,
                'response_id': response.get('responseId')
            }
    return {'verified': False, 'complete': False, 'response_id': None}


def verify_response_without_api(form_id, user_email):
    """
    Vérification simulée quand les credentials Google ne sont pas disponibles.
    Utilisée en mode développement sans OAuth complet.
    Retourne toujours verified=True pour ne pas bloquer le dev.
    """
    return {
        'verified':    True,
        'complete':    True,
        'response_id': f'simulated_{form_id[:8]}'
    }


def invalidate_cache(form_id):
    """Force le rafraîchissement du cache pour un formulaire donné."""
    _response_cache.pop(form_id, None)
