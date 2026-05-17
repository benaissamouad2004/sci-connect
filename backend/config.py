# ROUTE: Configuration Flask — variables d'environnement et paramètres
import os
from dotenv import load_dotenv

load_dotenv()

BASE_DIR    = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ADMIN_DIR   = os.path.join(BASE_DIR, 'admin')
FRONTEND_DIR = os.path.join(BASE_DIR, 'frontend')

class Config:
    SECRET_KEY          = os.getenv('SECRET_KEY', 'sciconnect-dev-secret-change-in-prod')
    SQLALCHEMY_DATABASE_URI = os.getenv('DATABASE_URL', f'sqlite:///{os.path.join(BASE_DIR, "sciconnect.db")}')
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # EDITABLE: Client ID Google OAuth — mettre dans .env en production
    GOOGLE_CLIENT_ID    = os.getenv('GOOGLE_CLIENT_ID', '')

    # EDITABLE: URL publique de l'app — utilisée dans les emails et les redirections
    # En prod : APP_URL=https://votre-domaine.com  (sans slash final)
    APP_URL = os.getenv('APP_URL', 'https://sciconnect.pythonanywhere.com')

    # Cookie de session httpOnly — jamais localStorage
    SESSION_COOKIE_HTTPONLY  = True
    SESSION_COOKIE_SAMESITE  = 'Lax'
    # True automatiquement si APP_URL commence par https://
    SESSION_COOKIE_SECURE    = os.getenv('APP_URL', '').startswith('https://')
    PERMANENT_SESSION_LIFETIME = 86400 * 30   # 30 jours

    # ═══ CONFIGURATION EMAIL ═══
    # EDITABLE: changer selon ton fournisseur SMTP
    MAIL_SERVER   = os.getenv('MAIL_SERVER', 'smtp.gmail.com')
    MAIL_PORT     = int(os.getenv('MAIL_PORT', 587))
    MAIL_USE_TLS  = True
    MAIL_USE_SSL  = False
    MAIL_USERNAME = os.getenv('MAIL_USERNAME')
    MAIL_PASSWORD = os.getenv('MAIL_PASSWORD')
    MAIL_DEFAULT_SENDER = ('SciConnect', os.getenv('MAIL_USERNAME', 'noreply@sciconnect.ma'))

    # EDITABLE: basculer en True pour dev (Mailtrap), False pour prod
    _use_mailtrap = os.getenv('FLASK_ENV') == 'development' or os.getenv('USE_MAILTRAP', '').lower() == 'true'
    if _use_mailtrap and os.getenv('MAILTRAP_USERNAME'):
        MAIL_SERVER   = os.getenv('MAILTRAP_SERVER', 'sandbox.smtp.mailtrap.io')
        MAIL_PORT     = int(os.getenv('MAILTRAP_PORT', 2525))
        MAIL_USE_TLS  = False
        MAIL_USERNAME = os.getenv('MAILTRAP_USERNAME')
        MAIL_PASSWORD = os.getenv('MAILTRAP_PASSWORD')

    # ═══ SYSTÈME DE POINTS ═══
    # EDITABLE: modifier les valeurs ici pour ajuster le système
    POINTS_REPONDRE_COURT   = 10   # questionnaire < 5 min
    POINTS_REPONDRE_LONG    = 15   # questionnaire > 5 min
    POINTS_LOGIN_QUOTIDIEN  = 5    # connexion chaque jour
    POINTS_STREAK_7_JOURS   = 25   # bonus 7 jours consécutifs
    POINTS_50_REPONSES      = 20   # jalon 50 réponses reçues
    POINTS_MIN_DEPOT        = 20   # minimum requis pour déposer
    POINTS_DEPOSER          = 20   # coût d'un dépôt (soustrait)
