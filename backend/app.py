# ROUTE: Flask app — point d'entrée principal SciConnect
# Lance avec : python backend/app.py (depuis la racine du projet)
# Port : 5000

import os
import sys

# Ajouter la racine au path pour les imports relatifs
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask import Flask, send_from_directory, abort
from flask_cors import CORS

from backend.config import Config, FRONTEND_DIR
from backend.models import db, User, Questionnaire
# Demo questionnaires désactivés à la demande de l'utilisateur
# from backend.data.demo_forms import seed_demo_questionnaires

# ─── Flask-Mail ───
from backend.services.email_service import mail

app = Flask(__name__, static_folder=FRONTEND_DIR, static_url_path='')
app.config.from_object(Config)
CORS(app, supports_credentials=True)
db.init_app(app)
mail.init_app(app)

# ─── Remember-me : rendre toutes les sessions permanentes (30 jours) ───
from datetime import timedelta
app.permanent_session_lifetime = timedelta(days=30)

@app.before_request
def make_session_permanent():
    from flask import session
    session.permanent = True

# ─── Blueprints ───
from backend.routes.admin    import admin_bp
from backend.routes.auth     import auth_bp
from backend.routes.forms    import forms_bp
from backend.routes.responses import responses_bp
from backend.routes.export   import export_bp
from backend.routes.profiles import profiles_bp
from backend.routes.leaderboard import leaderboard_bp
from backend.routes.notifications import notifications_bp
from backend.routes.users_settings import users_settings_bp

app.register_blueprint(admin_bp)
app.register_blueprint(auth_bp)
app.register_blueprint(forms_bp)
app.register_blueprint(responses_bp)
app.register_blueprint(export_bp)
app.register_blueprint(profiles_bp)
app.register_blueprint(leaderboard_bp)
app.register_blueprint(notifications_bp)
app.register_blueprint(users_settings_bp)

# ─── Pages HTML statiques ───
@app.route('/')
def index():
    return send_from_directory(FRONTEND_DIR, 'index.html')

# EDITABLE: route profil public — sert profile.html pour /profil/<slug>
@app.route('/profil/<string:slug>')
def public_profile(slug):
    return send_from_directory(FRONTEND_DIR, 'profile.html')

@app.route('/<path:filename>')
def static_files(filename):
    if filename.startswith('admin/'):
        abort(403)
    return send_from_directory(FRONTEND_DIR, filename)

# ─── Route test email (dev uniquement) ───
# EDITABLE: désactiver en production
@app.route('/api/test/send-suggestions', methods=['POST'])
def test_send_suggestions():
    """Route de test pour envoyer les suggestions manuellement."""
    from backend.services.email_service import send_suggestion_email
    from datetime import datetime, timedelta
    with app.app_context():
        inactive_users = User.query.filter(
            User.last_active < datetime.utcnow() - timedelta(days=7)
        ).all()
        count = 0
        for user in inactive_users:
            domain = (user.domains or [None])[0]
            forms_q = Questionnaire.query.filter_by(is_active=True)
            if domain:
                forms_q = forms_q.filter_by(domain=domain)
            forms = forms_q.order_by(Questionnaire.created_at.desc()).limit(3).all()
            send_suggestion_email(user, forms)
            count += 1
    from flask import jsonify
    return jsonify({'sent': count})

# ─── APScheduler — envoi hebdomadaire de suggestions ───
# EDITABLE: changer day_of_week et hour pour modifier la fréquence
def _start_scheduler():
    try:
        from apscheduler.schedulers.background import BackgroundScheduler
        from datetime import datetime, timedelta

        scheduler = BackgroundScheduler()

        @scheduler.scheduled_job('cron', day_of_week='mon', hour=9, minute=0)
        def send_weekly_suggestions():
            """
            Chaque lundi à 9h : envoyer suggestions aux utilisateurs
            inactifs depuis 7 jours, filtrées selon leur domaine.
            EDITABLE: changer day_of_week et hour pour modifier la fréquence
            """
            from backend.services.email_service import send_suggestion_email
            with app.app_context():
                inactive = User.query.filter(
                    User.last_active < datetime.utcnow() - timedelta(days=7)
                ).all()
                for user in inactive:
                    domain = (user.domains or [None])[0]
                    q = Questionnaire.query.filter_by(is_active=True)
                    if domain:
                        q = q.filter_by(domain=domain)
                    forms = q.order_by(Questionnaire.created_at.desc()).limit(3).all()
                    send_suggestion_email(user, forms)

        scheduler.start()
    except Exception as e:
        import logging
        logging.warning(f'[Scheduler] APScheduler non démarré : {e}')

# ─── Initialisation DB + données de démonstration ───
with app.app_context():
    db.create_all()

    # Migrations SQLite — ajouter colonnes absentes sans casser les données existantes
    try:
        from sqlalchemy import inspect as sa_inspect, text
        q_cols = [c['name'] for c in sa_inspect(db.engine).get_columns('questionnaires')]
        if 'image_url' not in q_cols:
            with db.engine.connect() as conn:
                conn.execute(text('ALTER TABLE questionnaires ADD COLUMN image_url VARCHAR(500)'))
                conn.commit()
        u_cols = [c['name'] for c in sa_inspect(db.engine).get_columns('users')]
        with db.engine.connect() as conn:
            if 'slug' not in u_cols:
                conn.execute(text('ALTER TABLE users ADD COLUMN slug VARCHAR(100)'))
                conn.commit()
            if 'streak' not in u_cols:
                conn.execute(text('ALTER TABLE users ADD COLUMN streak INTEGER DEFAULT 0'))
                conn.commit()
            # V3 migrations
            if 'last_login_date' not in u_cols:
                conn.execute(text('ALTER TABLE users ADD COLUMN last_login_date DATE'))
                conn.commit()
            if 'total_responses_given' not in u_cols:
                conn.execute(text('ALTER TABLE users ADD COLUMN total_responses_given INTEGER DEFAULT 0'))
                conn.commit()
            if 'total_forms_posted' not in u_cols:
                conn.execute(text('ALTER TABLE users ADD COLUMN total_forms_posted INTEGER DEFAULT 0'))
                conn.commit()
        # V3: colonnes Response
        r_cols = [c['name'] for c in sa_inspect(db.engine).get_columns('responses')]
        with db.engine.connect() as conn:
            if 'duration_seconds' not in r_cols:
                conn.execute(text('ALTER TABLE responses ADD COLUMN duration_seconds INTEGER'))
                conn.commit()
            if 'is_suspect' not in r_cols:
                conn.execute(text('ALTER TABLE responses ADD COLUMN is_suspect BOOLEAN DEFAULT 0'))
                conn.commit()
    except Exception:
        pass

    # seed_demo_questionnaires(db, User, Questionnaire)  # désactivé

if __name__ == '__main__':
    _start_scheduler()
    port = int(os.getenv('PORT', 5000))
    debug = os.getenv('FLASK_ENV') == 'development'
    print(f'SciConnect démarré sur http://localhost:{port}')
    app.run(debug=debug, port=port, host='0.0.0.0')