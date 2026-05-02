# SERVICE: Emails automatiques SciConnect
# RÈGLE ABSOLUE: tous les emails s'envoient dans un Thread séparé — JAMAIS synchrone

import os
import json
import logging
from threading import Thread
from datetime import datetime

from flask import render_template, current_app
from flask_mail import Mail, Message

# Instance unique Flask-Mail — initialisée dans app.py via mail.init_app(app)
mail = Mail()

# EDITABLE: seuils de jalons — modifier pour changer les notifications
MILESTONES = [10, 25, 50, 75, 100]

ADMIN_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    'admin'
)

# URL de base de l'application — définie dans .env via APP_URL
def _app_url():
    return os.getenv('APP_URL', 'http://localhost:5000').rstrip('/')


# ─── Helpers écoles ───

def _load_schools():
    path = os.path.join(ADMIN_DIR, 'schools.json')
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f).get('universities', [])
    except Exception:
        return []


# EDITABLE: noms d'écoles chargés depuis admin/schools.json
def get_school_name(school_id):
    if not school_id:
        return ''
    for uni in _load_schools():
        for school in uni.get('schools', []):
            if school['id'] == school_id:
                return school['name']
    return school_id


def get_university_name(university_id):
    if not university_id:
        return ''
    for uni in _load_schools():
        if uni['id'].lower() == university_id.lower():
            return uni['name']
    return university_id


def get_next_month_name():
    """Retourne le nom du mois suivant en français."""
    now = datetime.utcnow()
    if now.month == 12:
        next_dt = datetime(now.year + 1, 1, 1)
    else:
        next_dt = datetime(now.year, now.month + 1, 1)
    mois = ['janvier','février','mars','avril','mai','juin',
            'juillet','août','septembre','octobre','novembre','décembre']
    return f"{mois[next_dt.month - 1]} {next_dt.year}"


# ─── Envoi asynchrone ───

def _send_async(app, msg):
    # RÈGLE: envoi dans un Thread séparé avec contexte app
    with app.app_context():
        try:
            mail.send(msg)
        except Exception as e:
            logging.warning(f'[Email] Échec envoi "{msg.subject}" : {e}')


def send_email(subject, recipients, template, **kwargs):
    """
    Envoie un email HTML en arrière-plan.
    RÈGLE: ne jamais appeler sans Thread — bloque le serveur Flask sinon.
    """
    try:
        app = current_app._get_current_object()
        html_body = render_template(template, **kwargs)
        msg = Message(
            subject    = subject,
            recipients = recipients,
            html       = html_body
        )
        Thread(target=_send_async, args=[app, msg], daemon=True).start()
    except Exception as e:
        logging.warning(f'[Email] Impossible de préparer "{subject}" : {e}')


# ═══ EMAIL 1 — BIENVENUE À L'INSCRIPTION ═══
def send_welcome_email(user):
    """
    Envoyé dès qu'un nouvel utilisateur se connecte via Google.
    Déclenché dans POST /api/auth/google après création User.
    EDITABLE: modifier backend/templates/emails/welcome.html
    """
    if not user.email:
        return
    send_email(
        subject    = f"Bienvenue sur SciConnect, {(user.name or '').split()[0]} !",
        recipients = [user.email],
        template   = 'emails/welcome.html',
        user            = user,
        school_name     = get_school_name(user.school_id),
        university_name = get_university_name(user.university_id),
        is_founder      = user.is_founder,
        dashboard_url   = f'{_app_url()}/dashboard.html'
    )


# ═══ EMAIL 2 — CONFIRMATION DE DÉPÔT ═══
def send_deposit_confirmation_email(questionnaire, author):
    """
    Envoyé dès qu'un questionnaire est publié avec succès.
    Déclenché dans POST /api/forms après création Questionnaire.
    EDITABLE: modifier backend/templates/emails/deposit_confirm.html
    """
    if not author.email:
        return
    send_email(
        subject       = "Ton questionnaire est en ligne · SciConnect",
        recipients    = [author.email],
        template      = 'emails/deposit_confirm.html',
        user          = author,
        questionnaire = questionnaire,
        school_name   = get_school_name(author.school_id),
        stats_url     = f'{_app_url()}/stats.html?id={questionnaire.id}',
        respond_url   = f'{_app_url()}/respond.html?id={questionnaire.id}',
        next_month    = get_next_month_name()
    )


# ═══ EMAIL 3 — JALONS DE RÉPONSES ═══
def check_and_send_milestone_email(questionnaire, author):
    """
    Vérifie si un seuil de réponses est atteint et envoie la notif.
    Appelée après chaque réponse validée dans responses.py.
    EDITABLE: modifier MILESTONES ci-dessus pour changer les seuils
    """
    if questionnaire.response_count not in MILESTONES:
        return
    if not author.email:
        return
    send_email(
        subject       = f"🎉 Ton questionnaire a atteint {questionnaire.response_count} réponses !",
        recipients    = [author.email],
        template      = 'emails/milestone.html',
        user          = author,
        questionnaire = questionnaire,
        milestone     = questionnaire.response_count,
        stats_url     = f'{_app_url()}/stats.html?id={questionnaire.id}'
    )


# ═══ EMAIL 4 — SUGGESTIONS HEBDOMADAIRES ═══
def send_suggestion_email(user, suggested_forms):
    """
    Envoyé chaque lundi matin à 9h aux utilisateurs inactifs depuis 7 jours.
    Les formulaires sont filtrés selon le domaine de l'utilisateur.
    EDITABLE: modifier backend/templates/emails/suggestion.html
    EDITABLE: modifier la fréquence dans le scheduler APScheduler (app.py)
    """
    if not suggested_forms or not user.email:
        return
    send_email(
        subject       = "3 questionnaires dans ton domaine t'attendent · SciConnect",
        recipients    = [user.email],
        template      = 'emails/suggestion.html',
        user          = user,
        forms         = suggested_forms[:3],
        school_name   = get_school_name(user.school_id),
        dashboard_url = f'{_app_url()}/dashboard.html'
    )