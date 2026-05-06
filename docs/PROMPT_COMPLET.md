# SciConnect — Prompt Complet pour Claude Code

> Lis ce fichier en entier avant de commencer quoi que ce soit.
> Toutes les instructions sont ici. Rien ne doit être omis.

---

## Présentation du projet

Tu construis "SciConnect" — une plateforme web collaborative pour les étudiants marocains.
Ils déposent des liens Google Forms, d'autres étudiants y répondent, les réponses sont
vérifiées via l'API Google Forms, et l'émetteur peut suivre ses statistiques et exporter en Excel.

Stack obligatoire :
- Frontend : HTML + CSS + JavaScript vanilla (pas de React, pas de Vue)
- Backend : Python Flask UNIQUEMENT (pas Django, pas FastAPI)
- Base de données : SQLite via SQLAlchemy
- Auth : Google Identity Services (GIS) — OAuth Google uniquement, pas d'email/password
- Export : pandas + openpyxl

Langue de l'interface : français intégral
Slogan : "Par les étudiants, pour les étudiants"

---

## Structure complète du projet

    sciconnect/
    ├── CLAUDE.md                    ← lu automatiquement par Claude Code
    ├── docs/
    │   └── PROMPT_COMPLET.md        ← CE FICHIER
    ├── admin/
    │   ├── content.json             ← textes éditables sans redémarrage serveur
    │   ├── settings.json            ← labels boutons + feature flags
    │   └── schools.json             ← universités et écoles
    ├── frontend/
    │   ├── index.html               ← LANDING PAGE (première page visible)
    │   ├── login.html
    │   ├── onboarding.html
    │   ├── dashboard.html
    │   ├── respond.html
    │   ├── stats.html
    │   ├── css/
    │   │   ├── main.css             ← design system complet + toutes variables CSS
    │   │   ├── landing.css
    │   │   ├── dashboard.css
    │   │   └── components.css
    │   └── js/
    │       ├── main.js              ← utilitaires globaux : loadContent, applyContent
    │       ├── auth.js              ← Google OAuth
    │       ├── dashboard.js
    │       ├── respond.js
    │       └── stats.js
    └── backend/
        ├── app.py                   ← point d'entrée Flask
        ├── config.py
        ├── models.py
        ├── routes/
        │   ├── auth.py
        │   ├── forms.py
        │   ├── responses.py
        │   ├── export.py
        │   └── admin.py
        ├── services/
        │   ├── google_forms.py      ← intégration API Google Forms + cache 30s
        │   └── export.py            ← génération Excel pandas/openpyxl
        └── requirements.txt

---

## Design System — appliquer partout sans exception

### Variables CSS (définir dans :root de main.css)

Copier-coller exactement ce bloc dans main.css :

    :root {
      /* COULEURS PRIMAIRES
         Changer --color-primary pour modifier tous les boutons principaux */
      --color-primary:        #005F54;
      --color-primary-hover:  #004A41;
      --color-primary-light:  #E8F5F3;

      /* COULEURS ACCENT OR
         Changer --color-accent pour modifier tous les accents dorés */
      --color-accent:         #C9A84C;
      --color-accent-light:   #FDF8EC;

      /* ARRIÈRE-PLANS
         Changer --color-bg pour la couleur de fond de toutes les pages */
      --color-bg:             #F7F6F2;
      --color-surface:        #FFFFFF;
      --color-surface-2:      #F0EDE6;

      /* TEXTES */
      --color-text:           #181816;
      --color-text-secondary: #57564F;
      --color-text-muted:     #9A9890;

      /* BORDURES */
      --color-border:         #E2DED6;

      /* STATUTS — ne pas modifier ces valeurs */
      --color-success:        #1A7A5E;
      --color-warning:        #BA6A1A;
      --color-danger:         #C0392B;

      /* ÉTAT VERROUILLÉ 0/2 réponses
         Changer pour modifier l'apparence du dépôt verrouillé */
      --color-locked-bg:      #FEF3F2;
      --color-locked-border:  #C0392B;
      --color-locked-text:    #C0392B;

      /* ÉTAT À MOITIÉ 1/2 réponses */
      --color-half-bg:        #FFF8EC;
      --color-half-border:    #BA6A1A;
      --color-half-text:      #BA6A1A;

      /* ÉTAT DÉVERROUILLÉ 2/2 réponses */
      --color-unlocked-bg:    #E8F5F3;
      --color-unlocked-border:#005F54;
      --color-unlocked-text:  #1A7A5E;

      /* TYPOGRAPHIE */
      --font-display: 'Fraunces', Georgia, serif;
      --font-ui:      'DM Sans', system-ui, sans-serif;
      --font-mono:    'Courier New', monospace;

      /* ESPACEMENTS */
      --radius-sm: 6px;
      --radius-md: 10px;
      --radius-lg: 12px;
      --radius-xl: 20px;
    }

Règle absolue : aucune couleur ne doit jamais être codée en dur dans le HTML ou le JS.
Toujours utiliser les variables CSS définies ci-dessus.

---

## Système live-edit (sans redémarrer le serveur)

### admin/content.json — créer avec exactement ce contenu :

    {
      "landing": {
        "hero_title_line1": "La recherche étudiante,",
        "hero_title_line2": "rendue collaborative.",
        "hero_subtitle": "Dépose ton questionnaire Google Forms, touche les bons répondants, suis les réponses en temps réel et valide chaque contribution. Une seule règle : réponds à 2 questionnaires avant de déposer.",
        "slogan": "Par les étudiants, pour les étudiants",
        "cta_primary": "Continuer avec Google — c'est gratuit",
        "cta_secondary": "Explorer les questionnaires",
        "stats_students": "1 200+",
        "stats_students_label": "étudiants inscrits",
        "stats_questionnaires": "340",
        "stats_questionnaires_label": "questionnaires actifs",
        "stats_completion": "92%",
        "stats_completion_label": "taux de complétion moyen",
        "stats_rule": "2 réponses",
        "stats_rule_label": "pour déposer le vôtre"
      },
      "dashboard": {
        "welcome_message": "Bonjour",
        "feed_title": "Pour toi",
        "feed_subtitle": "Selon tes intérêts",
        "deposit_locked_message": "Réponds à 2 questionnaires pour débloquer le dépôt.",
        "deposit_half_message": "Encore 1 réponse avant de déposer !",
        "deposit_unlocked_message": "Dépôt autorisé ce mois ✓"
      },
      "rules": {
        "responses_required": 2,
        "points_per_response": 10,
        "founder_free_deposits": 1,
        "max_founders": 50
      }
    }

### admin/settings.json — créer avec exactement ce contenu :

    {
      "buttons": {
        "respond_button_label": "Répondre",
        "deposit_button_locked_label": "Dépôt verrouillé 🔒",
        "deposit_button_half_label": "Presque là... (1/2) 🔓",
        "deposit_button_unlocked_label": "Publier mon questionnaire →",
        "export_button_label": "⬇ Exporter en Excel",
        "google_signin_label": "Continuer avec Google",
        "validate_button_label": "Valider",
        "ignore_button_label": "Ignorer"
      },
      "features": {
        "public_responses_enabled": true,
        "founder_mode_active": true,
        "monthly_reset_day": 1,
        "live_counter_refresh_seconds": 30
      },
      "points": {
        "response_complete": 10,
        "response_bonus_fast": 5,
        "streak_bonus": 20,
        "deposit_reward": 5
      }
    }

### admin/schools.json — créer avec exactement ce contenu :

    {
      "universities": [
        {
          "id": "uca",
          "name": "Université Cadi Ayyad",
          "short": "UCA",
          "city": "Marrakech",
          "color": "#005F54",
          "schools": [
            {"id": "encg-mk",      "name": "ENCG Marrakech",                      "short": "ENCG MK"},
            {"id": "fsjes-gueliz", "name": "FSJES Guéliz",                         "short": "FSJES"},
            {"id": "fs-semlalia",  "name": "Faculté des Sciences Semlalia",        "short": "FS Semlalia"},
            {"id": "fmpm",         "name": "Faculté de Médecine et Pharmacie",     "short": "FMPM"},
            {"id": "flsh",         "name": "FLSH Marrakech",                       "short": "FLSH"},
            {"id": "estav",        "name": "ESTAV Marrakech",                      "short": "ESTAV"},
            {"id": "enp",          "name": "ENP Marrakech",                        "short": "ENP"},
            {"id": "fst",          "name": "FST Marrakech",                        "short": "FST"},
            {"id": "ensa-mk",      "name": "ENSA Marrakech",                       "short": "ENSA MK"}
          ]
        },
        {
          "id": "uh2",
          "name": "Université Hassan II",
          "short": "UH2",
          "city": "Casablanca",
          "color": "#C9A84C",
          "schools": [
            {"id": "encg-casa",  "name": "ENCG Casablanca",               "short": "ENCG Casa"},
            {"id": "fsjes-bm",   "name": "FSJES Ben M'Sik",               "short": "FSJES BM"},
            {"id": "fsjes-ac",   "name": "FSJES Aïn Chock",               "short": "FSJES AC"},
            {"id": "fmp-uh2",    "name": "Faculté de Médecine UH2",       "short": "FMP UH2"},
            {"id": "fs-uh2",     "name": "Faculté des Sciences UH2",      "short": "FS UH2"},
            {"id": "emi",        "name": "EMI Casablanca",                "short": "EMI"},
            {"id": "insa-casa",  "name": "INSA Casablanca",               "short": "INSA"},
            {"id": "est-casa",   "name": "EST Casablanca",                "short": "EST"},
            {"id": "hem",        "name": "HEM Business School",           "short": "HEM"}
          ]
        }
      ]
    }

### Chargement du contenu dans chaque page HTML

Chaque page HTML doit appeler loadContent() au démarrage :

    /* main.js — utilitaires globaux de chargement du contenu */

    /* EDITABLE: fonction centrale de chargement — charge content.json et settings.json
       Appelée au démarrage de chaque page */
    async function loadContent() {
      try {
        const [content, settings] = await Promise.all([
          fetch('/admin/content').then(r => r.json()),
          fetch('/admin/settings').then(r => r.json())
        ]);
        applyContent(content);
        applySettings(settings);
        return { content, settings };
      } catch (error) {
        console.error('Erreur chargement contenu:', error);
      }
    }

    /* EDITABLE: remplace le texte de tous les éléments avec data-content="clé" */
    function applyContent(content) {
      document.querySelectorAll('[data-content]').forEach(el => {
        const key = el.dataset.content;
        const value = key.split('.').reduce((obj, k) => obj?.[k], content);
        if (value !== undefined) el.textContent = value;
      });
    }

    /* EDITABLE: applique les labels de boutons depuis settings.json */
    function applySettings(settings) {
      document.querySelectorAll('[data-setting]').forEach(el => {
        const key = el.dataset.setting;
        const value = key.split('.').reduce((obj, k) => obj?.[k], settings);
        if (value !== undefined) el.textContent = value;
      });
    }

Dans le HTML, chaque texte éditable porte un attribut data-content ou data-setting :

    <!-- EDITABLE: chargé depuis admin/content.json → landing.hero_title_line1 -->
    <h1 data-content="landing.hero_title_line1"></h1>

    <!-- EDITABLE: chargé depuis admin/settings.json → buttons.respond_button_label -->
    <button data-setting="buttons.respond_button_label"></button>

---

## Règles absolues — NE JAMAIS violer

1.  Ne jamais coder une couleur en dur dans HTML ou JS — toujours les variables CSS
2.  Ne jamais utiliser des styles inline pour les couleurs ou polices
3.  Ne jamais mélanger appels DB synchrones et asynchrones dans Flask
4.  Ne jamais stocker un token Google dans localStorage — cookies httpOnly uniquement
5.  Ne jamais appeler Google Forms API sans vérifier le cache de 30 secondes
6.  Ne jamais mettre clés API ou credentials dans un fichier frontend
7.  Ne jamais faire SELECT * en SQL — toujours nommer les colonnes
8.  Ne jamais sauter la gestion d'erreur sur les appels fetch() en JavaScript
9.  Ne jamais construire une partie sans avoir vérifié la partie précédente
10. Ne jamais utiliser document.write() — manipulation du DOM uniquement
11. Ne jamais bloquer le serveur Flask sur un appel API long — background threads
12. Ne jamais oublier la configuration CORS sur toutes les routes API
13. Ne jamais utiliser l'ancienne bibliothèque Google Sign-In — GIS uniquement
14. Ne jamais coder en dur les noms d'écoles dans le HTML — charger depuis schools.json
15. Ne jamais oublier les commentaires EDITABLE au-dessus de chaque texte visible

---

## Standards de commentaires dans le code

Dans CSS :
    /* ═══ COULEUR BOUTON PRINCIPAL ═══
       Changer --color-primary dans :root pour modifier tous les boutons principaux */

    /* ═══ FOND DES CARTES ═══
       Changer --color-surface dans :root pour modifier le fond de toutes les cartes */

Dans JavaScript :
    /* EDITABLE: texte du bouton CTA principal
       Modifier dans admin/settings.json → buttons.respond_button_label */

Dans Python :
    # ROUTE: POST /api/auth/google
    # OBJECTIF: Vérifier le JWT Google et créer/mettre à jour la session
    # EDITABLE: points_per_response dans admin/settings.json → points.response_complete

Dans HTML :
    <!-- EDITABLE: chargé depuis admin/content.json → landing.hero_title_line1 -->
    <!-- EDITABLE: chargé depuis admin/settings.json → buttons.google_signin_label -->

---

## Modèles de base de données (models.py)

    class User(db.Model):
        __tablename__ = 'users'
        id                       = db.Column(db.String(36), primary_key=True)   # UUID
        google_id                = db.Column(db.String(100), unique=True, nullable=False)
        email                    = db.Column(db.String(200), nullable=False)
        name                     = db.Column(db.String(200))
        avatar_url               = db.Column(db.String(500))
        school_id                = db.Column(db.String(50))
        university_id            = db.Column(db.String(10))    # 'uca' ou 'uh2'
        level                    = db.Column(db.String(20))    # L1 L2 L3 M1 M2 etc.
        domains                  = db.Column(db.JSON)          # liste de domaines
        points                   = db.Column(db.Integer, default=0)
        badge_level              = db.Column(db.String(20), default='novice')
        monthly_responses_given  = db.Column(db.Integer, default=0)
        monthly_reset_date       = db.Column(db.Date)
        is_founder               = db.Column(db.Boolean, default=False)
        onboarding_complete      = db.Column(db.Boolean, default=False)
        created_at               = db.Column(db.DateTime, default=datetime.utcnow)
        last_active              = db.Column(db.DateTime)

    class Questionnaire(db.Model):
        __tablename__ = 'questionnaires'
        id               = db.Column(db.String(36), primary_key=True)
        title            = db.Column(db.String(300), nullable=False)
        description      = db.Column(db.Text)
        google_forms_url = db.Column(db.String(500), nullable=False)
        form_id          = db.Column(db.String(200))
        domain           = db.Column(db.String(100))
        target_level     = db.Column(db.String(50))
        target_count     = db.Column(db.Integer, default=100)
        author_id        = db.Column(db.String(36), db.ForeignKey('users.id'))
        school_id        = db.Column(db.String(50))
        university_id    = db.Column(db.String(10))
        response_count   = db.Column(db.Integer, default=0)
        completion_rate  = db.Column(db.Float, default=0.0)
        is_active        = db.Column(db.Boolean, default=True)
        created_at       = db.Column(db.DateTime, default=datetime.utcnow)

    class Response(db.Model):
        __tablename__ = 'responses'
        id                    = db.Column(db.String(36), primary_key=True)
        questionnaire_id      = db.Column(db.String(36), db.ForeignKey('questionnaires.id'))
        respondent_google_id  = db.Column(db.String(100))   # null si public
        respondent_email      = db.Column(db.String(200))   # null si anonyme
        respondent_type       = db.Column(db.String(20))    # verified / public / anonymous
        is_complete           = db.Column(db.Boolean, default=False)
        completion_percentage = db.Column(db.Float, default=0.0)
        validated_by_emitter  = db.Column(db.Boolean, default=False)
        ignored_by_emitter    = db.Column(db.Boolean, default=False)
        created_at            = db.Column(db.DateTime, default=datetime.utcnow)

---

## Flux Google OAuth (détail technique)

    1. Utilisateur clique "Continuer avec Google"
    2. Google Identity Services (GIS) affiche le popup Google
    3. Google retourne un JWT credential côté frontend
    4. Frontend envoie le JWT vers POST /api/auth/google
    5. Flask vérifie avec google.oauth2.id_token.verify_oauth2_token()
    6. Flask crée ou met à jour l'enregistrement User
    7. Flask crée un cookie de session httpOnly
    8. Nouvel utilisateur → redirection vers /onboarding.html
    9. Utilisateur existant → redirection vers /dashboard.html

    Script GIS à inclure dans le HTML :
    <script src="https://accounts.google.com/gsi/client"></script>

    NE PAS utiliser l'ancienne bibliothèque platform.js — elle est dépréciée.

---

## Service Google Forms — cache obligatoire (services/google_forms.py)

    import time
    from googleapiclient.discovery import build

    # Cache simple — max 1 appel API par 30 secondes par formulaire
    _response_cache = {}
    CACHE_DURATION = 30   # secondes — EDITABLE: changer dans settings.json

    def get_form_responses(form_id, credentials):
        """
        Récupère les réponses depuis Google Forms API avec cache.
        Ne jamais appeler sans ce cache — risque de quota dépassé.
        """
        now = time.time()
        cached = _response_cache.get(form_id)
        if cached and (now - cached['timestamp']) < CACHE_DURATION:
            return cached['data']

        service = build('forms', 'v1', credentials=credentials)
        result = service.forms().responses().list(formId=form_id).execute()
        responses = result.get('responses', [])
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
                    'verified': True,
                    'complete': len(answers) > 0,
                    'response_id': response.get('responseId')
                }
        return {'verified': False, 'complete': False, 'response_id': None}

---

## Service export Excel (services/export.py)

    import pandas as pd
    from openpyxl.styles import PatternFill, Font
    import io

    def generate_excel(questionnaire, responses, questions):
        """
        Génère un fichier Excel en mémoire.
        En-tête : fond #005F54 (teal primaire), texte blanc.
        Lignes alternées : #FFFFFF et #F7F6F2.
        Colonnes : Email | Type | Université | École | Filière | Niveau |
                   Date | Complétion | Statut | Q1 | Q2 | ...
        """
        rows = []
        for r in responses:
            row = {
                'Email':           r.respondent_email or 'Anonyme',
                'Type':            r.respondent_type,
                'Université':      getattr(r, 'university_name', '—'),
                'École':           getattr(r, 'school_name', '—'),
                'Filière':         getattr(r, 'domain', '—'),
                'Niveau':          getattr(r, 'level', '—'),
                'Date':            r.created_at.strftime('%d/%m/%Y %H:%M'),
                'Complétion (%)':  f"{r.completion_percentage:.0f}%",
                'Statut':          'Validé' if r.validated_by_emitter else 'En attente'
            }
            for i, q in enumerate(questions, 1):
                row[f'Q{i}'] = getattr(r, f'answer_q{i}', '')
            rows.append(row)

        df = pd.DataFrame(rows)
        output = io.BytesIO()

        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='Réponses')
            wb = writer.book
            ws = writer.sheets['Réponses']

            # En-tête teal
            header_fill = PatternFill(start_color='005F54', fill_type='solid')
            header_font = Font(color='FFFFFF', bold=True)
            for cell in ws[1]:
                cell.fill = header_fill
                cell.font = header_font

            # Lignes alternées
            for i, row in enumerate(ws.iter_rows(min_row=2), start=2):
                if i % 2 == 0:
                    for cell in row:
                        cell.fill = PatternFill(start_color='F7F6F2', fill_type='solid')

            # Largeur automatique
            for col in ws.columns:
                max_len = max(len(str(cell.value or '')) for cell in col) + 4
                ws.column_dimensions[col[0].column_letter].width = min(max_len, 50)

        output.seek(0)
        return output

---

## Requirements Python (requirements.txt)

    flask==3.0.0
    flask-cors==4.0.0
    flask-sqlalchemy==3.1.1
    google-auth==2.27.0
    google-api-python-client==2.116.0
    pandas==2.2.0
    openpyxl==3.1.2
    python-dotenv==1.0.0
    requests==2.31.0

Démarrage : python backend/app.py
Port : 5000

---

## PARTIE 1 — Landing Page

Fichiers à créer :
- admin/content.json
- admin/settings.json
- admin/schools.json
- frontend/css/main.css (design system complet avec toutes les variables CSS)
- frontend/css/landing.css
- frontend/index.html
- frontend/js/main.js (utilitaires : loadContent, applyContent, applySettings)

La landing page DOIT :
1. Être la première page que voit l'utilisateur — aucune redirection avant elle
2. Charger tout le contenu depuis admin/content.json dynamiquement
3. Charger la liste des écoles depuis admin/schools.json
4. Avoir une barre de navigation collante avec bouton Google Sign-In
5. Afficher hero : titre (2 lignes), sous-titre, slogan, 2 boutons CTA
6. Afficher bande statistiques : 4 chiffres depuis content.json
7. Afficher "Comment ça marche" : 5 étapes avec la règle des 2 surlignée en or
8. Afficher "Ouvert à tous" : compte Google vs visiteur public (2 cartes)
9. Afficher "Pourquoi la règle des 2" : 3 cartes + 3 questions FAQ
10. Afficher les 2 blocs universités chargés depuis schools.json
11. Afficher 3 témoignages
12. Afficher bande CTA finale avec bouton Google
13. Afficher footer avec slogan
14. Bouton "Continuer avec Google" → navigue vers login.html
15. Bouton "Explorer les questionnaires" → navigue vers dashboard.html

Checklist de vérification Partie 1 (vérifier TOUS avant de demander permission) :
    □ index.html s'ouvre dans le navigateur sans erreurs console
    □ Tout le texte se charge depuis content.json (modifier, actualiser, voir le changement)
    □ Les écoles se chargent dynamiquement depuis schools.json
    □ La barre de navigation reste visible au défilement
    □ Les 2 boutons CTA naviguent correctement
    □ La page est correcte à 1440px, 1280px, 1024px
    □ Toutes les variables CSS sont définies dans main.css
    □ Aucune couleur codée en dur dans HTML ou CSS
    □ Aucune erreur 404 dans l'onglet Réseau du navigateur
    □ Commentaires EDITABLE présents au-dessus de chaque texte visible

---

## PARTIE 2 — Google OAuth + Onboarding

Fichiers à créer :
- frontend/login.html
- frontend/onboarding.html
- frontend/js/auth.js
- backend/app.py (Flask setup + CORS)
- backend/config.py
- backend/models.py (modèle User uniquement)
- backend/routes/auth.py
- backend/requirements.txt

Quiz d'onboarding (5 questions, une par écran) :
- Q1 : Niveau d'études — sélection unique (L1/L2/L3/M1/M2/Doctorat/Ingénieur/BTS)
- Q2 : Domaine principal — grille de cartes (9 options)
- Q3 : Pourquoi rejoindre — multi-sélection (5 options)
- Q4 : Temps disponible — 4 chips horizontaux
- Q5 : Domaines pour répondre — multi-sélection jusqu'à 3

Checklist Partie 2 :
    □ Bouton Google Sign-In déclenche le popup GIS
    □ Après auth Google, enregistrement User créé en base
    □ Nouveaux utilisateurs voient le quiz
    □ Utilisateurs existants passent directement au dashboard
    □ Les 5 réponses du quiz se sauvegardent correctement
    □ La liste des écoles se charge depuis schools.json via API
    □ Cookie de session défini (httpOnly)
    □ Aucun token stocké dans localStorage
    □ POST /api/auth/google retourne 200 sur JWT Google valide
    □ Flask démarre sans erreurs : python backend/app.py

---

## PARTIE 3 — Dashboard principal

Fichiers à créer :
- frontend/dashboard.html
- frontend/css/dashboard.css
- frontend/css/components.css
- frontend/js/dashboard.js
- backend/models.py (ajouter Questionnaire + Response)
- backend/routes/forms.py
- backend/routes/responses.py (partiel)

Layout 1440px avec sidebar :
- Sidebar fixe 260px : logo, carte utilisateur, widget réciprocité, menu navigation
- Contenu principal fluide : topbar, bannière réciprocité, filtres, grille 2 colonnes
- Panel droit 300px sticky : suivi questionnaire actif, compteur live, panel dépôt

Le widget réciprocité doit afficher les 3 états avec commentaires CSS :
    /* ÉTAT VERROUILLÉ 0/2 : fond var(--color-locked-bg), bordure var(--color-locked-border) */
    /* ÉTAT À MOITIÉ 1/2  : fond var(--color-half-bg), bordure var(--color-half-border) */
    /* ÉTAT DÉVERROUILLÉ  : fond var(--color-unlocked-bg), bordure var(--color-unlocked-border) */

Validation URL Google Forms (frontend) :
    const GOOGLE_FORMS_REGEX = /docs\.google\.com\/forms\/d\/e\/([^/]+)/;
    function validateGoogleFormsUrl(url) {
      const match = url.match(GOOGLE_FORMS_REGEX);
      return match ? { valid: true, formId: match[1] } : { valid: false, formId: null };
    }

Routes backend :
    GET  /api/forms      → liste questionnaires filtrés
    POST /api/forms      → créer questionnaire (nécessite 2/2)
    GET  /api/forms/:id  → détail questionnaire
    GET  /api/schools    → retourner schools.json

Checklist Partie 3 :
    □ Dashboard se charge avec sidebar, contenu, panel droit
    □ Carte utilisateur affiche nom, école, points depuis la session
    □ Widget réciprocité affiche l'état correct (tester 0/2, 1/2, 2/2)
    □ Cartes questionnaires s'affichent avec les bonnes couleurs de bande
    □ Les filtres fonctionnent (université, école, domaine)
    □ L'input de dépôt valide l'URL Google Forms avec retour visuel
    □ Le bouton de dépôt affiche l'état correct selon monthly_responses_given
    □ Les données se chargent depuis GET /api/forms
    □ Aucune erreur console au chargement
    □ Le compteur live du panel droit s'affiche (données fictives acceptées pour l'instant)

---

## PARTIE 4 — Page de réponse + vérification

Fichiers à créer :
- frontend/respond.html
- frontend/js/respond.js
- backend/services/google_forms.py
- backend/routes/responses.py (complet)

Intégration iframe Google Forms :
    function getEmbedUrl(formUrl) {
      /* EDITABLE: ne jamais supprimer embedded=true — requis pour l'iframe Google Forms */
      return formUrl.includes('?') ? formUrl + '&embedded=true' : formUrl + '?embedded=true';
    }

Flux de vérification :
    1. Utilisateur soumet le formulaire Google (détecté via clic bouton submit)
    2. Frontend appelle POST /api/responses/verify avec {form_id, user_google_id}
    3. Backend appelle get_form_responses() avec cache 30s
    4. Recherche l'email dans les réponses
    5. Vérifie que toutes les questions ont été répondues
    6. Si vérifié : crée Response, incrémente monthly_responses_given, ajoute points
    7. Retourne {verified: true, points_earned: 10, monthly_count: X}
    8. Si non trouvé : retourne {verified: false, reason: "response_not_found"}

Visiteurs publics (sans compte Google) :
    - Accès à respond.html via lien partagé sans authentification
    - Pas d'appel API de vérification
    - Réponse enregistrée avec type "public" sans email
    - Pas de points, compteur mensuel non incrémenté

Checklist Partie 4 :
    □ respond.html se charge avec le formulaire en iframe
    □ La barre de progression s'affiche correctement
    □ L'iframe Google Forms se charge sans erreurs
    □ Après soumission : API de vérification appelée
    □ Réponse vérifiée : état succès + points attribués
    □ monthly_responses_given s'incrémente en base
    □ Le widget réciprocité se met à jour après réponse réussie
    □ Visiteur public accède à respond.html sans connexion
    □ Réponse publique sauvegardée avec type "public" sans email
    □ Cache API Google fonctionne (max 1 appel par 30s par formulaire)

---

## PARTIE 5 — Statistiques + export Excel

Fichiers à créer :
- frontend/stats.html
- frontend/js/stats.js
- backend/services/export.py
- backend/routes/export.py

Graphique de complétion par question :
    Utiliser Chart.js (barres horizontales)
    Axe Y : Q1 Q2 Q3... | Axe X : nombre de réponses
    Couleur des barres depuis var(--color-primary) via Chart.js getComputedStyle

Tableau des répondants — colonnes :
    Répondant | Type | Université | Filière | Niveau | Date | Complétion | Statut | Action

Badges de type :
    "Étudiant vérifié ✓" → pill teal
    "Public général"     → pill or
    "Anonyme"            → pill gris

Route export :
    GET /api/forms/:id/export → fichier Excel en pièce jointe

Checklist Partie 5 :
    □ stats.html se charge avec les 4 cartes métriques correctes
    □ Graphique de complétion par question s'affiche avec Chart.js
    □ Tableau des répondants se charge depuis GET /api/forms/:id/responses
    □ Les badges de type affichent la bonne couleur et le bon libellé
    □ Bouton Valider met à jour validated_by_emitter en base
    □ Bouton Export appelle GET /api/forms/:id/export
    □ Fichier Excel téléchargé s'ouvre avec toutes les colonnes
    □ En-tête Excel a le fond teal (#005F54) et texte blanc
    □ Lignes alternées fonctionnent (#FFFFFF / #F7F6F2)
    □ Les réponses aux questions apparaissent dans les bonnes colonnes

---

## PARTIE 6 — Intégration finale + système live-edit

Fichiers à compléter :
- backend/app.py (ajouter routes /admin)
- backend/routes/admin.py (endpoints admin protégés)
- Tous les fichiers JS (vérifier que content.json se charge partout)

Endpoints live-edit (lecture des fichiers JSON en temps réel) :
    GET  /admin/content   → lire admin/content.json
    POST /admin/content   → écrire admin/content.json (protégé)
    GET  /admin/settings  → lire admin/settings.json
    POST /admin/settings  → écrire admin/settings.json (protégé)
    GET  /admin/schools   → lire admin/schools.json
    POST /admin/schools   → écrire admin/schools.json (protégé)

Checklist Partie 6 :
    □ Modifier une valeur dans content.json, actualiser, voir le changement immédiat
    □ Modifier un label de bouton dans settings.json, actualiser, voir le changement
    □ Ajouter une école dans schools.json, actualiser, la voir dans les filtres
    □ Toutes les pages chargent le contenu dynamiquement (aucun texte en dur dans HTML)
    □ Les endpoints admin nécessitent une authentification
    □ Flask fonctionne stable avec toutes les routes actives
    □ Parcours complet : Landing → Login → Onboarding → Dashboard → Répondre → Stats → Export
    □ Aucune erreur console sur l'ensemble du parcours

---

## Format de message obligatoire après chaque partie

Après avoir vérifié qu'une partie fonctionne entièrement, utiliser EXACTEMENT ce format :

    ✅ Partie X — [Nom de la partie] terminée et vérifiée.

    Checklist complète :
      ✓ Item 1
      ✓ Item 2
      ✓ [tous les items cochés]

    Puis-je passer à la Partie X+1 — [Nom de la partie suivante] ?

Ne jamais commencer une nouvelle partie sans recevoir une confirmation
explicite de l'utilisateur : "oui", "continue", "go" ou équivalent.

---

Fin du fichier PROMPT_COMPLET.md
Projet SciConnect — Plateforme collaborative académique marocaine
══════════════════════════════════════════
MISE À JOUR MAJEURE — PARTIE 2 À 6
INSTRUCTIONS POUR CLAUDE CODE
══════════════════════════════════════════

Tu travailles sur le projet SciConnect déjà existant.
La landing page (frontend/index.html) ne doit PAS être modifiée.
Tu vas uniquement modifier et améliorer toutes les autres pages.

Tu travailles en PARTIES SÉQUENTIELLES.
Après chaque partie : vérifie tout, puis demande permission avant de continuer.

══════════════════════════════════════════
PARTIE 1 — DASHBOARD PRINCIPAL (redesign complet)
══════════════════════════════════════════

FICHIERS À MODIFIER :
- frontend/dashboard.html
- frontend/css/dashboard.css
- frontend/js/dashboard.js

NE PAS TOUCHER :
- frontend/index.html
- frontend/css/main.css (sauf ajouter des variables si manquantes)

LAYOUT DASHBOARD (1440px, 3 colonnes) :

SIDEBAR GAUCHE 280px (white bg, 1px right border) :

USER IDENTITY CARD (bg #E8F5F3, border teal, 12px radius, padding 16px) :
- Google avatar photo circle 48px, border 2px teal
- Badge pill sous avatar : "✓ Étudiant vérifié" teal bg white text 10px
- Nom : DM Sans 600 15px
- École + niveau : muted 12px
- CIRCULAR PROGRESS RING SVG 56px à droite :
  stroke-dashoffset animé sur le badge actuel
  Centre : icône badge + niveau "Contributeur" 10px
  Pill or sous ring : "★ 240 pts"

STREAK WIDGET (white card border 10px radius padding 12px margin-top 12px) :
- 🔥 + "Streak · 7 jours" DM Sans 500 13px
- 7 petits cercles jour Mon→Dim, remplis teal si complétés
- "Bonus ×2 pts aujourd'hui !" gold 11px si streak actif

RECIPROCITY WIDGET (toujours visible, margin-top 12px) :
Title : "STATUT DE DÉPÔT" caps muted 10px tracking

3 ÉTATS (afficher selon monthly_responses_given de l'utilisateur) :

LOCKED (0/2) :
bg #FEF3F2, border 1px #C0392B, 10px radius, padding 12px
Icône cadenas rouge 18px + "Dépôt verrouillé" 600 13px rouge
Barre 0% fill rouge, hauteur 8px
[○ rouge] "Réponse 1 — en attente"
[○ rouge] "Réponse 2 — en attente"
[🔒 gris] "Dépôt — verrouillé"
Lien teal : "Répondre maintenant →"

HALFWAY (1/2) :
bg #FFF8EC, border orange
[✓ teal] "Réponse 1 — [École] · Il y a Xj"
[○ orange] "Réponse 2 — en attente"
[🔒] "Dépôt — bientôt"
Barre 50% orange

UNLOCKED (2/2) :
bg #E8F5F3, border teal
[✓][✓][✓] tous teal
"Dépôt autorisé ✓" vert 600
Bouton teal small : "Déposer mon formulaire →"

Reset note : "↻ Compteur mensuel · Repart le 1er du mois" muted 10px

NAVIGATION MENU :
Section "PRINCIPAL" caps muted 10px :
[home] "Mon feed" ACTIVE teal bg #E8F5F3 teal left bar 3px
[compass] "Explorer"
[bell] "Notifications" + badge rouge "3"
Section "MES QUESTIONNAIRES" :
[upload] "Déposer un formulaire" — icône cadenas si locked
[bar-chart] "Mes questionnaires" + "2 actifs" teal pill
[users] "Mes répondants"
[star] "Mon profil public"
Section "PROGRESSION" :
[trophy] "Mes badges"
[ranking] "Classement"
Section "COMPTE" :
[settings] "Paramètres"
[logout] "Déconnexion"

CONTENU PRINCIPAL (padding 28px 32px) :

TOP BAR :
Gauche : "Bonjour, [Prénom] 👋" Fraunces 24px + date muted droite
Droite : search input 300px white border teal focus + filtre icon
+ "34 étudiants actifs maintenant" green pulsing dot 7px + muted 12px
(chiffre fluctue via JS setInterval random 28-41 toutes les 4s)

SMART RECOMMENDATION BANNER (bg #005F54, 14px radius, padding 18px 24px, mb 20px) :
Gauche :
"⭐ Recommandé pour toi" gold pill 10px
Titre questionnaire recommandé Fraunces 18px white
(calculé selon domain + school de l'utilisateur — 1er résultat GET /api/forms?recommended=true)
Sub : "Parfait pour ton profil · [École] · [Domaine] · [Niveau]" rgba(white,0.7) 13px
Droite :
"Répondre maintenant → +10 pts" white fill teal text button
Tags : "X min" · "Y questions" white 70%

RECIPROCITY BANNER (affiché si 0/2 ou 1/2, caché si 2/2) :
LOCKED bg #FEF3F2 border rouge 1px 12px radius padding 16px 20px mb 16px :
Cadenas rouge 20px + "Réponds à 2 questionnaires pour débloquer le dépôt" 500 14px rouge
Tracker inline : [○ Réponse 1] [○ Réponse 2] [🔒 Dépôt]
Bouton outline rouge droite : "Voir les questionnaires →"

HALFWAY bg #FFF8EC border orange :
[✓ Réponse 1] [○ Réponse 2] [🔒]
"Encore 1 réponse avant de déposer !"
Bouton orange : "Répondre maintenant →"

FILTER ROW :
Dropdowns : "Université : Toutes" · "École : Toutes" · "Domaine : Tous"
Chips : "Récents" ACTIVE teal · "Flash < 2 min" · "Populaires" · "Mon domaine" · "Sauvegardés ♡"
Droite : "X résultats" muted

FEED QUESTIONNAIRES — GRILLE 2 COLONNES ASYMÉTRIQUE :
Colonne gauche 65% : questionnaires du même domaine que l'user — GRANDES cartes
Colonne droite 35% : autres domaines — CARTES COMPACTES

GRANDE CARTE (colonne gauche) :
white bg, 1px border #E2DED6, 12px radius
Stripe top 4px = couleur du domaine
HEAT INDICATOR droite du stripe :
  Chaud (beaucoup de réponses aujourd'hui) : tinte rouge #E74C3C sur bord droit
  Froid (peu) : tinte bleue #3498DB
  "🔥 Tendance" pill gold si trending
Padding 20px :
Row 1 : badge école pill + "Nouveau" rouge optionnel + heure muted droite
Row 2 : Titre DM Sans 500 16px 2 lignes max
Row 3 : Description 13px muted 2 lignes
Row 4 : chips (domaine · niveau · durée · nb questions)
Row 5 APERÇU QUESTIONS (visible au hover — slide down) :
  "Aperçu des questions :" muted 11px caps
  Q1, Q2, Q3 : "..." 12px muted
  "+ X autres questions" gold link
ROW RÉCIPROCITÉ :
  Cadenas gris 12px + "Répondre comptabilise 1/2 vers le dépôt" muted
  OU teal si halfway : "Répondre ici = 2/2 → dépôt débloqué !"
Divider 1px
Footer : dot coloré + nom école muted | ♡ save button + "Répondre · +Xpts" teal chip

CARTE COMPACTE (colonne droite) :
Même structure condensée — pas de description ni aperçu questions
Stripe 3px, padding 14px, titre 13px

PANNEAU DROIT STICKY 320px :

LIVE TRACKER (white card teal left border 3px 10px radius padding 16px) :
"Mon questionnaire actif" DM Sans 500 14px
Titre tronqué 13px 500 + "Publié il y a 3 jours · Actif"

SPARKLINE MINI CHART (bg #E8F5F3 8px radius padding 12px) :
"RÉPONSES EN TEMPS RÉEL" teal caps 10px
"47" Fraunces 56px teal bold + "/100 souhaitées" muted 12px inline
SPARKLINE : mini line chart 200px large 40px haut — dernières 24h de réponses
(Chart.js LineChart, dataset mis à jour toutes les 30s via GET /api/forms/:id/stats)
Barre progrès teal 47% hauteur 8px
Green pulsing dot + "Mis à jour il y a 28s" muted 11px

BREAKDOWN RÉPONDANTS (bg #F0EDE6 8px radius padding 10px mt 8px) :
"Profils répondants" caps 10px muted
teal dot · "28 étudiants vérifiés ✓" · "60%" droite
gold dot · "14 public général" · "30%"
gris dot · "5 non vérifiés" · "10%"

DERNIERS RÉPONDANTS (white card border padding 12px mt 8px) :
"Dernières réponses" muted 12px
3 lignes : avatar Google 28px + nom 500 12px + "École · Niveau · ✓ Vérifié" muted 11px + heure droite
"Voir tous les répondants →" teal link 12px

VÉRIFICATION (white card border 10px radius padding 14px mt 8px) :
"Vérification" 500 13px
Ligne : "✓ Vérifié" green pill + nom + "Valider" teal button
Ligne : "Public" gold pill + "Anonyme" + "Voir" muted
Ligne : "✗ Email non vérifié" rouge + "Ignorer" gris
"Tableau complet →" teal 11px

DEPOSIT PANEL (mt 8px) :
Afficher l'état correct selon monthly_responses_given :

LOCKED (bg #FEF3F2 border rouge padding 16px) :
Cadenas rouge 24px centré
"Dépôt verrouillé" 600 15px rouge
Tracker vertical : [○][○][🔒]
Input DISABLED gris : "Verrouillé · Réponds à 2 questionnaires d'abord…"
Button DISABLED gris : "Dépôt verrouillé 🔒"
Lien teal : "Trouver un questionnaire →"

HALFWAY (bg #FFF8EC border orange padding 16px) :
Cadenas à moitié orange
[✓][○][🔒]
Input DISABLED tinte orange
Button orange disabled : "Presque là… (1/2) 🔓"

UNLOCKED (white teal left border 3px padding 16px) :
Unlock vert + "Dépôt autorisé ce mois ✓" teal 600
[✓ École 1 · date][✓ École 2 · date][✓ débloqué]
Input ACTIF teal focus : placeholder "https://docs.google.com/forms/d/e/..."
Validation live URL Google Forms :
  Regex : /docs\.google\.com\/forms\/d\/e\/([^/]+)/
  Valide : pill vert "✓ Lien Google Forms valide"
  Invalide : rouge "⚠ Lien non reconnu"
Champs supplémentaires : "Titre", "Domaine" select, "Public cible" chips, "Objectif réponses" number
Button teal pleine largeur : "Publier mon questionnaire →"
Note muted 11px : "Sera visible par les étudiants de ton domaine et université"

MENSUEL RESET (bg #F0EDE6 8px radius padding 10px mt 8px) :
Icône calendrier + "Repart le 1er [mois] · Dans X jours" muted 11px

BADGES MINI (white card border padding 12px mt 8px) :
"Progression" 500 13px
star teal + "Contributeur" + barre 40% teal + "8/20"
flame gold + "Streak" + barre 100% gold + "7/7 🔥"
lock gris + "Expert" + barre vide + "50 rép. requis"

CHECKLIST VÉRIFICATION PARTIE 1 :
□ Dashboard charge sans erreur console
□ Sidebar affiche les 3 états reciprocity correctement selon DB
□ Feed charge depuis GET /api/forms
□ Grille asymétrique 65/35 visible
□ Aperçu questions visible au hover sur grandes cartes
□ Sparkline Chart.js s'affiche dans le panneau droit
□ Tous les boutons deposit ont le bon état selon monthly_responses_given
□ Streak widget s'affiche
□ Circular progress ring animé

══════════════════════════════════════════
PARTIE 2 — SYSTÈME D'EMAILS AUTOMATIQUES
══════════════════════════════════════════

FICHIERS À CRÉER/MODIFIER :
- backend/requirements.txt (ajouter flask-mail==0.10.0)
- backend/config.py (ajouter config mail)
- backend/templates/emails/base_email.html
- backend/templates/emails/welcome.html
- backend/templates/emails/deposit_confirm.html
- backend/templates/emails/milestone.html
- backend/templates/emails/suggestion.html (NOUVEAU)
- backend/services/email_service.py
- backend/routes/auth.py (ajouter appel welcome email)
- backend/routes/forms.py (ajouter appel deposit email)
- backend/routes/responses.py (ajouter milestone check)
- .env.example (ajouter variables mail)

CONFIG EMAIL (backend/config.py) :
# ═══ CONFIGURATION EMAIL ═══
# EDITABLE: changer selon ton fournisseur SMTP
MAIL_SERVER   = os.getenv('MAIL_SERVER', 'smtp.gmail.com')
MAIL_PORT     = int(os.getenv('MAIL_PORT', 587))
MAIL_USE_TLS  = True
MAIL_USERNAME = os.getenv('MAIL_USERNAME')
MAIL_PASSWORD = os.getenv('MAIL_PASSWORD')
MAIL_DEFAULT_SENDER = ('SciConnect', os.getenv('MAIL_USERNAME'))

# Dev : utiliser Mailtrap
# EDITABLE: basculer en True pour dev, False pour prod
USE_MAILTRAP = os.getenv('FLASK_ENV') == 'development'
if USE_MAILTRAP:
    MAIL_SERVER   = os.getenv('MAILTRAP_SERVER', 'sandbox.smtp.mailtrap.io')
    MAIL_PORT     = int(os.getenv('MAILTRAP_PORT', 2525))
    MAIL_USERNAME = os.getenv('MAILTRAP_USERNAME')
    MAIL_PASSWORD = os.getenv('MAILTRAP_PASSWORD')

.env.example :
MAIL_USERNAME=ton_adresse@gmail.com
MAIL_PASSWORD=ton_mot_de_passe_application_google
MAILTRAP_USERNAME=
MAILTRAP_PASSWORD=

RÈGLE : tous les emails s'envoient dans un Thread séparé — JAMAIS synchrone

backend/services/email_service.py :

from flask_mail import Message
from threading import Thread
from flask import render_template, current_app

def send_async(app, msg):
    with app.app_context():
        mail.send(msg)

def send_email(subject, recipients, template, **kwargs):
    app = current_app._get_current_object()
    msg = Message(subject=subject, recipients=recipients,
                  html=render_template(template, **kwargs))
    Thread(target=send_async, args=[app, msg]).start()

# ═══ EMAIL 1 — BIENVENUE À L'INSCRIPTION ═══
def send_welcome_email(user):
    """
    Envoyé dès qu'un nouvel utilisateur se connecte via Google.
    Déclenché dans POST /api/auth/google après création User.
    EDITABLE: modifier templates/emails/welcome.html
    """
    send_email(
        subject=f"Bienvenue sur SciConnect, {user.name.split()[0]} !",
        recipients=[user.email],
        template='emails/welcome.html',
        user=user,
        school_name=get_school_name(user.school_id),
        university_name=get_university_name(user.university_id),
        is_founder=user.is_founder,
        dashboard_url='https://sciconnect.ma/dashboard'
    )

# ═══ EMAIL 2 — CONFIRMATION DE DÉPÔT ═══
def send_deposit_confirmation_email(questionnaire, author):
    """
    Envoyé dès qu'un questionnaire est publié avec succès.
    Déclenché dans POST /api/forms après création Questionnaire.
    EDITABLE: modifier templates/emails/deposit_confirm.html
    """
    send_email(
        subject="Ton questionnaire est en ligne · SciConnect",
        recipients=[author.email],
        template='emails/deposit_confirm.html',
        user=author,
        questionnaire=questionnaire,
        school_name=get_school_name(author.school_id),
        stats_url=f'https://sciconnect.ma/stats/{questionnaire.id}',
        respond_url=f'https://sciconnect.ma/respond/{questionnaire.id}',
        next_month=get_next_month_name()
    )

# ═══ EMAIL 3 — JALONS DE RÉPONSES ═══
MILESTONES = [10, 25, 50, 75, 100]

def check_and_send_milestone_email(questionnaire, author):
    """
    Vérifie si un seuil de réponses est atteint.
    Appelée après chaque réponse validée dans responses.py.
    EDITABLE: modifier MILESTONES pour changer les seuils
    """
    if questionnaire.response_count in MILESTONES:
        send_email(
            subject=f"🎉 Ton questionnaire a atteint {questionnaire.response_count} réponses !",
            recipients=[author.email],
            template='emails/milestone.html',
            user=author,
            questionnaire=questionnaire,
            milestone=questionnaire.response_count,
            stats_url=f'https://sciconnect.ma/stats/{questionnaire.id}'
        )

# ═══ EMAIL 4 — SUGGESTIONS DE FORMULAIRES (NOUVEAU) ═══
def send_suggestion_email(user, suggested_forms):
    """
    Envoyé chaque lundi matin à 9h si l'utilisateur n'a pas répondu
    à un questionnaire depuis 7 jours.
    Les formulaires suggérés sont filtrés selon le domaine de l'utilisateur.
    EDITABLE: modifier templates/emails/suggestion.html
    EDITABLE: modifier la fréquence dans le scheduler (APScheduler)
    """
    if not suggested_forms:
        return
    send_email(
        subject=f"3 questionnaires dans ton domaine t'attendent · SciConnect",
        recipients=[user.email],
        template='emails/suggestion.html',
        user=user,
        forms=suggested_forms[:3],
        school_name=get_school_name(user.school_id),
        dashboard_url='https://sciconnect.ma/dashboard'
    )

TEMPLATES HTML EMAIL :

base_email.html — template parent :
Structure table HTML email compatible tous clients
En-tête : bg #005F54, logo "SciConnect" Fraunces blanc, slogan or italic
Corps : fond blanc, padding 36px
Pied : bg #F7F6F2, border-top #E2DED6
Note confidentialité muted 11px
"© 2025 SciConnect · Marrakech, Maroc · Projet académique ENCGM"

welcome.html (extends base) :
Bloc bienvenue : "Bonjour [Prénom]," gros + "Ton compte SciConnect est créé !"
Bloc école détectée (bg #E8F5F3 border teal) :
  🏛 Établissement : [Nom école]
  🎓 Université : [UCA ou Hassan II]
  📚 Niveau : [niveau]
Bloc règle des 2 (bg #FDF8EC border or) :
  🔒 "Ta prochaine étape"
  "Réponds à 2 questionnaires avant de déposer le tien."
  Tracker visuel : [○ Réponse 1] [○ Réponse 2] [🔒 Dépôt]
Bloc Fondateur SI is_founder=True (bg #FDF8EC border or) :
  ⭐ "Tu fais partie des 50 premiers Fondateurs !"
  "Badge Fondateur débloqué — 1 dépôt gratuit ce mois."
Bouton principal teal : "Voir les questionnaires disponibles →"
Slogan or italic en bas

deposit_confirm.html (extends base) :
"Ton questionnaire est publié !" titre teal
Bloc récapitulatif (bg #E8F5F3 border teal) :
  Titre en gras
  Domaine · Public cible · Objectif réponses
  Lien Google Forms tronqué en teal cliquable
Bloc progression (bg #F7F6F2) :
  "Objectif : X réponses"
  Barre HTML/CSS 0% (sera mise à jour en visitant le lien)
  "0 / X réponses reçues · Temps réel sur le dashboard"
Bloc comment les répondants te trouvent (bg #FDF8EC border or) :
  ✓ Affiché dans le feed [domaine]
  ✓ Filtré pour [université] et [école]
  ✓ Notification envoyée aux profils compatibles
Rappel mensuel SI compteur utilisé (bg #FEF3F2 border rouge) :
  "Ton compteur repart le 1er [mois prochain]."
2 boutons côte à côte :
  Teal : "Voir mes statistiques →"
  Blanc border teal : "Partager le lien →"
URL partageable : https://sciconnect.ma/respond/[id]

milestone.html (extends base) :
"🎉 [X] réponses reçues !" Fraunces grand
Barre progression : X / objectif
"Dernière réponse : il y a X min · [École]"
Bouton teal : "Voir les statistiques →"

suggestion.html (extends base) — NOUVEAU :
"3 questionnaires dans ton domaine t'attendent" titre
"Bonjour [Prénom], voici les questionnaires de la semaine en [Domaine] :"
3 cartes questionnaire inline (table HTML) :
  Chaque carte : titre + école + durée + "+Xpts" badge
  Bouton teal sous chaque : "Répondre →"
Note bas : "Réponds à 2 pour débloquer ton droit de dépôt ce mois."
Bouton principal : "Voir tous les questionnaires →"
Lien désinscription : "Ne plus recevoir ces suggestions"

SCHEDULER POUR EMAILS SUGGESTION :
Ajouter APScheduler dans requirements.txt : apscheduler==3.10.4
Dans app.py :
from apscheduler.schedulers.background import BackgroundScheduler

scheduler = BackgroundScheduler()

@scheduler.scheduled_job('cron', day_of_week='mon', hour=9, minute=0)
def send_weekly_suggestions():
    """
    Chaque lundi à 9h : envoyer suggestions aux utilisateurs
    inactifs depuis 7 jours, filtrées selon leur domaine.
    EDITABLE: changer day_of_week et hour pour modifier la fréquence
    """
    inactive_users = User.query.filter(
        User.last_active < datetime.utcnow() - timedelta(days=7)
    ).all()
    for user in inactive_users:
        forms = Questionnaire.query.filter_by(
            domain=user.domain,
            is_active=True
        ).order_by(Questionnaire.created_at.desc()).limit(3).all()
        send_suggestion_email(user, forms)

scheduler.start()

CHECKLIST VÉRIFICATION PARTIE 2 :
□ flask-mail installé sans erreur
□ Mailtrap reçoit l'email de bienvenue après test inscription
□ Mailtrap reçoit l'email de dépôt après test publication formulaire
□ Email milestone envoyé quand response_count atteint 10
□ Email suggestion envoyé manuellement via route test POST /api/test/send-suggestions
□ Tous les templates HTML s'affichent correctement dans Mailtrap preview
□ Aucun email n'est envoyé de façon synchrone (vérifier que Thread est utilisé partout)
□ Variables MAIL_USERNAME et MAIL_PASSWORD dans .env
□ APScheduler démarre sans erreur avec Flask

══════════════════════════════════════════
PARTIE 3 — SYSTÈME DE SUGGESTIONS DE FORMULAIRES
══════════════════════════════════════════

FICHIERS À CRÉER/MODIFIER :
- backend/services/recommendation.py (NOUVEAU)
- backend/routes/forms.py (ajouter endpoint recommended)
- frontend/dashboard.html (ajouter section suggestions)
- frontend/js/dashboard.js (charger suggestions)

LOGIQUE DE SUGGESTION (backend/services/recommendation.py) :

def get_recommended_forms(user, limit=6):
    """
    Retourne les formulaires recommandés pour un utilisateur
    selon son domaine, niveau et université.
    EDITABLE: modifier les poids de chaque critère ci-dessous
    """
    # Critère 1 — Même domaine que l'utilisateur (poids fort)
    same_domain = Questionnaire.query.filter_by(
        domain=user.domain,
        is_active=True
    ).all()

    # Critère 2 — Même université
    same_uni = Questionnaire.query.filter_by(
        university_id=user.university_id,
        is_active=True
    ).all()

    # Critère 3 — Même niveau
    same_level = Questionnaire.query.filter(
        Questionnaire.target_level.in_([user.level, 'Tous niveaux']),
        Questionnaire.is_active == True
    ).all()

    # Score de pertinence pour chaque formulaire
    scored = {}
    for form in Questionnaire.query.filter_by(is_active=True).all():
        score = 0
        if form in same_domain: score += 30  # EDITABLE: poids domaine
        if form in same_uni:    score += 20  # EDITABLE: poids université
        if form in same_level:  score += 15  # EDITABLE: poids niveau
        # Bonus récence (moins de 7 jours)
        if (datetime.utcnow() - form.created_at).days < 7:
            score += 10  # EDITABLE: bonus récence
        # Bonus popularité (beaucoup de réponses)
        if form.response_count > 20:
            score += 5   # EDITABLE: bonus popularité
        # Exclure formulaires déjà répondus par cet utilisateur
        already_answered = Response.query.filter_by(
            questionnaire_id=form.id,
            respondent_google_id=user.google_id
        ).first()
        if already_answered:
            continue
        scored[form] = score

    # Trier par score décroissant
    sorted_forms = sorted(scored.items(), key=lambda x: x[1], reverse=True)
    return [f for f, s in sorted_forms[:limit]]

ENDPOINT (backend/routes/forms.py) :
GET /api/forms/recommended
- Authentification requise
- Appelle get_recommended_forms(current_user, limit=6)
- Retourne JSON liste formulaires avec score de correspondance

AFFICHAGE DASHBOARD :

Section "Suggestions pour toi" dans le feed principal :

SECTION HEADER :
"💡 Suggestions basées sur ton profil" DM Sans 500 14px
"[Domaine] · [École] · [Niveau]" muted 12px
Lien droite : "Voir tout →" teal

CARDS SUGGESTIONS (même style que les grandes cartes du feed) :
Badge supplémentaire sur chaque carte : "✨ Recommandé" teal pill 10px
Score de pertinence discret : "95% correspondance" muted 10px

Afficher au-dessus du feed principal si utilisateur est nouveau (< 5 réponses)
Afficher en section séparée sinon (après les 4 premières cartes du feed)

CHECKLIST VÉRIFICATION PARTIE 3 :
□ GET /api/forms/recommended retourne des résultats filtrés par domaine
□ Formulaires déjà répondus n'apparaissent pas dans les suggestions
□ Section suggestions visible dans le dashboard
□ Badge "Recommandé" s'affiche sur les cartes suggérées
□ Score de pertinence calculé correctement

══════════════════════════════════════════
PARTIE 4 — PAGE DE DÉPÔT COMPLÈTE
══════════════════════════════════════════

FICHIERS À CRÉER/MODIFIER :
- frontend/deposit.html (NOUVEAU)
- frontend/css/deposit.css (NOUVEAU)
- frontend/js/deposit.js (NOUVEAU)

LAYOUT : sidebar gauche + contenu centré max-width 1000px

BREADCRUMB : "Tableau de bord → Déposer un questionnaire"

HEADER PAGE :
Gauche : "Déposer un questionnaire" Fraunces 30px
Sub : "Ton lien Google Forms sera enrichi, ciblé et partagé avec la communauté."
Droite : badge unlock état courant (vert/rouge/orange selon état)

UNLOCK CONFIRMATION CARD (bg #E8F5F3 border teal 12px radius padding 16px mb 28px) :
Unlock icon teal 20px + "Condition de dépôt remplie" 600 14px teal
Réponse 1 et 2 avec école et date
"Tu peux déposer 1 questionnaire ce mois. Renouvellement le 1er [mois]."

INDICATEUR 3 ÉTAPES :
"01 · Lien & Validation" ACTIVE teal
"02 · Enrichissement" pending
"03 · Ciblage & Publication" pending
Connecteur tirets entre étapes

LAYOUT 2 COLONNES (form gauche 58% / preview droite 42%) :

COLONNE GAUCHE :

ÉTAPE 1 (white card border 12px radius padding 28px mb 20px) :
"Ton lien Google Forms" DM Sans 600 16px
Input URL 52px hauteur full width :
  Gauche : icône lien muted
  Droite : checkmark animé teal si valide
ÉTATS VALIDATION :
  Vide : border normal
  Frappe : border teal animation scan (3 points pulsants)
  Valide : border teal bg #E8F5F3
    Carte succès : "✓ Formulaire Google détecté"
    Titre récupéré depuis l'API Google Forms si disponible
    "X questions · Durée estimée : ~Y minutes"
  Invalide : border rouge + "⚠ Lien non reconnu" rouge 12px

ÉTAPE 2 (white card border 12px radius padding 28px mb 20px) :
"Enrichis ton questionnaire" DM Sans 600 16px
Champs :
  "Titre de la recherche" — pré-rempli depuis API Google si dispo, éditable
  "Description courte" — textarea 3 lignes, compteur 0/300
  "Domaine principal" — select stylisé
  "Niveau d'études cible" — multi-select chips
  "Durée estimée" — pré-remplie, éditable
  "Tags" — chips input (Enter pour ajouter)

ÉTAPE 3 (white card border 12px radius padding 28px) :
"Qui peut voir ton questionnaire ?" DM Sans 600 16px
4 radio cards 2x2 grid :
  🌐 "Toute la communauté SciConnect" — ~1 247 répondants
  🏛 "Mon université" SELECTED par défaut — ~680 répondants
  🏫 "Mon école uniquement" — ~340 répondants
  🔗 "Lien public partageable" — illimité
COMPTEUR AUDIENCE (bg #FDF8EC border or padding 12px mt 12px) :
  Target icon or + "Environ " + compteur or Fraunces 28px + " répondants qualifiés"
  Mis à jour JS selon option sélectionnée
"Objectif réponses" number input + "Date limite" date picker optionnel
BOUTON PUBLIER (full width teal 52px) :
  "Publier mon questionnaire →" DM Sans 600 15px
  Hover : bg #004A41 translateY -1px

COLONNE DROITE STICKY :
"Aperçu en temps réel" muted 13px caps mb 12px
PREVIEW CARD (identique aux cartes du feed, mise à jour live à chaque frappe) :
  Stripe domaine change avec select
  Titre live depuis champ titre
  Tags live
  Pied : école · université | "+10 pts"
"Voilà ce que verront les répondants" muted 11px

WHAT HAPPENS NEXT (white card border padding 16px mt 16px) :
· Notification envoyée aux étudiants du domaine
· Apparaît dans leur feed immédiatement
· Réponses vérifiables en temps réel
· Email de confirmation envoyé à ton adresse Google ← NOUVEAU

RAPPEL MENSUEL (bg #FDF8EC border or padding 12px mt 12px) :
"Le 1er [mois], ton compteur repart à 0/2."
"C'est le contrat communautaire SciConnect." italic muted

CHECKLIST VÉRIFICATION PARTIE 4 :
□ deposit.html charge depuis sidebar "Déposer un formulaire"
□ Validation URL Google Forms fonctionne avec regex
□ Preview card se met à jour en temps réel à chaque frappe
□ Compteur audience change selon option ciblage
□ POST /api/forms crée le questionnaire en DB
□ Redirect vers stats.html après publication
□ Email deposit_confirm.html envoyé après publication (vérifier Mailtrap)

══════════════════════════════════════════
PARTIE 5 — PAGE STATISTIQUES + EXPORT EXCEL
══════════════════════════════════════════

FICHIERS À CRÉER/MODIFIER :
- frontend/stats.html (refonte complète)
- frontend/js/stats.js (refonte)
- backend/services/export.py (améliorer)
- backend/routes/export.py (améliorer)

LAYOUT : sidebar + contenu full width

BREADCRUMB + HEADER :
"Tableau de bord → Mes questionnaires → Statistiques"
Titre Fraunces 28px tronqué
Boutons droite :
  "↗ Partager le lien" white border teal
  "📄 Rapport PDF" white border purple
  "⬇ Exporter en Excel" teal + green pulsing dot

4 METRIC CARDS top :
Card 1 bg #E8F5F3 : réponses totales / objectif / barre progression
Card 2 bg #F0EDE6 : taux complétion / complètes vs abandonnées
Card 3 bg #FDF8EC : types répondants (3 mini lignes dot)
Card 4 bg #F0EDE6 : dernière réponse / heure / école

LAYOUT 2 COLONNES (55% gauche / 45% droite) :

COLONNE GAUCHE :

GRAPHIQUE COMPLÉTION PAR QUESTION (Chart.js horizontal bar, white card) :
Titre : "Avancement par question" + "⚠ Point de chute identifié" orange pill si détecté
8 barres : Q1→Q8, couleur teal sauf question de chute = orange
Chaque barre : texte question tronqué + count + %
Q avec chute surlignée + "⚠ -X% ici" orange badge

CONSEIL PRESCRIPTIF sous le graphique (bg #FFF8EC border orange padding 14px) :
⚠ "Point de chute détecté à la Q[X]"
"La question X fait perdre Y% de tes répondants."
"💡 Essaie de la rendre facultative ou reformule-la."

CARTE SVG MAROC (white card border padding 20px) :
SVG Maroc simplifié outline blanc/gris
Cercles proportionnels teal sur chaque ville selon nb répondants :
  Marrakech · Casablanca · Fès · Rabat · Agadir
Labels : "Ville · X rép."
Légende : teal = étudiant vérifié · or = public

BENCHMARK COMPARAISON (white card border padding 20px) :
Titre : "Comparaison avec la communauté"
Métriques avec double barre :
  Mon questionnaire [teal] vs Moyenne SciConnect [gris]
  Taux complétion / Réponses par jour / Profils vérifiés / Temps complétion
Verdict coloré : "+17% au-dessus 🎉" vert ou "En dessous de la moyenne" orange

COLONNE DROITE :

TABLEAU RÉPONDANTS (white card border padding 20px full height) :
Header bg #E8F5F3 11px caps
Colonnes : Répondant | Email vérifié | Université | École | Niveau | Date | Complétion | Statut | Action
Badges type :
  "Étudiant vérifié ✓" teal pill
  "Public général" or pill
  "Email non vérifié" rouge pill
Actions : "Valider" teal / "Ignorer" gris / "Voir" muted
Pagination : 10 par page

EXPORT PANEL (white card border or gauche 4px padding 20px mt 16px) :
Titre : "Exporter les données enrichies"
4 ONGLETS VISUELS :
  [📊 Données brutes] [📈 Statistiques auto] [👥 Profils démo] [✅ Fiabilité & Qualité]
  Onglet actif : teal bg blanc / inactifs : blanc border

Contenu accordion par feuille :

Feuille 1 "Données brutes" :
Email · Prénom · Type · Université · École · Filière · Niveau · Date · Durée · Complétion · Statut · Q1→Qn

Feuille 2 "Statistiques automatiques" (NOUVEAU) :
Pour chaque QCM : tableau croisé + graphique camembert intégré Excel
Pour chaque échelle : moyenne, médiane, écart-type
Pour chaque ouverte : réponses regroupées
"Graphiques prêts à copier dans Word/PowerPoint"

Feuille 3 "Profils démographiques" (NOUVEAU) :
Répartition par université (barres auto-générées)
Par niveau (camembert)
Par domaine (barres horizontales)
Par ville (tableau)

Feuille 4 "Fiabilité & Qualité" (NOUVEAU) :
Complètes vs abandonnées avec taux
Temps moyen complétion par répondant
Par statut vérification
Question avec plus fort abandon surlignée rouge
Répondants suspects (temps < 30s)

PARAGRAPHE MÉTHODOLOGIQUE (bg #F0EDE6 border padding 14px mt 12px) :
Texte copiable pré-rédigé :
"Les données ont été collectées via SciConnect entre le [date_debut]
et le [date_fin]. Sur [total] répondants, [complets] ont fourni des
réponses complètes, représentant un taux de complétion de [taux]%.
[verifies] répondants ont été vérifiés via email académique institutionnel,
représentant [pct_verifies]% de l'échantillon."
Bouton : "Copier ce paragraphe" teal small

OPTIONS EXPORT :
Dropdown format : "Excel (.xlsx)"
Dropdown filtre : "Toutes les réponses"
Button teal full width : "⬇ Télécharger le fichier Excel complet"
Note : "(X lignes · 4 feuilles · graphiques inclus · ~XXX Ko)"
Lien : "📄 Générer aussi le rapport PDF" teal

BACKEND EXPORT AMÉLIORÉ (backend/services/export.py) :

def generate_excel(questionnaire_id):
    """
    Génère le fichier Excel avec 4 feuilles.
    EDITABLE: modifier les colonnes dans chaque feuille ci-dessous
    """
    wb = Workbook()

    # Feuille 1 — Données brutes
    ws1 = wb.active
    ws1.title = "Données brutes"
    headers = ['#', 'Email Google', 'Prénom', 'Nom', 'Type',
               'Université', 'Établissement', 'Filière', 'Niveau',
               'Date', 'Durée (sec)', 'Complétion (%)', 'Statut validation']
    # Ajouter colonnes Q1→Qn dynamiquement
    # Style header : bg #005F54 blanc
    # Lignes alternées : blanc / #F7F6F2
    # Largeurs auto-fit

    # Feuille 2 — Statistiques auto
    ws2 = wb.create_sheet("Statistiques auto")
    # Pour chaque question : résumé statistique
    # QCM : count par option + % + graphique camembert openpyxl
    # Échelle : moyenne, médiane, écart-type
    # Ouverte : liste réponses

    # Feuille 3 — Profils démographiques
    ws3 = wb.create_sheet("Profils démographiques")
    # Répartitions avec graphiques openpyxl BarChart / PieChart

    # Feuille 4 — Fiabilité & Qualité
    ws4 = wb.create_sheet("Fiabilité & Qualité")
    # Métriques qualité + suspects surlignés rouge

    filename = f"/tmp/sciconnect_export_{questionnaire_id}.xlsx"
    wb.save(filename)
    return filename

CHECKLIST VÉRIFICATION PARTIE 5 :
□ stats.html charge avec 4 metric cards
□ Chart.js graphique complétion par question s'affiche
□ Conseil prescriptif apparaît si taux chute détecté
□ Carte SVG Maroc visible avec cercles proportionnels
□ Tableau répondants avec badges type s'affiche
□ Export Excel télécharge un .xlsx valide
□ Fichier Excel a bien 4 feuilles
□ Feuille "Statistiques auto" a des graphiques openpyxl
□ Paragraphe méthodologique copié dans presse-papiers au clic
□ Benchmark comparaison charge depuis GET /api/forms/:id/benchmark

══════════════════════════════════════════
PARTIE 6 — PROFIL PUBLIC
══════════════════════════════════════════

FICHIERS À CRÉER :
- frontend/profile.html
- frontend/css/profile.css
- frontend/js/profile.js
- backend/routes/profiles.py

URL permanente : /profil/[username-slug]
Accessible sans connexion (lecture seule)

LAYOUT : navbar minimaliste + contenu centré max-width 900px bg #F7F6F2

PROFILE HERO (white card border 16px radius overflow hidden mb 24px) :

BANNER TOP (bg #005F54 height 120px) :
Motif : petits points géométriques opacity 0.06
Bouton partage top-right : icône share + "Partager ce profil" blanc 12px

AVATAR (position absolute bottom -40px left 32px) :
Photo Google 88px circle border 4px white
Badge sous avatar : "✓ Email académique vérifié" green pill 10px

PROFILE INFO (padding 56px 32px 28px) :
Gauche :
  Nom : Fraunces 700 26px
  École : shield icon + "ENCG Marrakech" teal 14px + " · " + "Université Cadi Ayyad" muted
  Domaine + niveau : muted 13px
  Date + badge fondateur si applicable : "Membre depuis [mois] [année]" + "★ Fondateur" or
Droite :
  Badge actuel : icône 32px dans cercle or-light 52px
  Nom badge Fraunces 600 18px or
  Date débloqué muted 11px
  URL profil muted 11px monospace

STATS ROW (4 cols bg #F7F6F2 border-top padding 20px 32px) :
"47" / "réponses données"
"3" / "questionnaires déposés"
"89%" / "taux de complétion"
"🥇 #8" / "classement ENCG MK"

BODY 2 COLONNES (60% gauche / 40% droite) :

GAUCHE :

PORTFOLIO RECHERCHE (white card border 12px radius padding 20px mb 16px) :
"Portfolio de recherche" 500 15px
"Questionnaires déposés sur SciConnect" muted 12px
3 items séparés par 1px border :
  dot domaine + titre tronqué 500 13px
  chips : domaine + date + "X réponses" teal pill

IDENTITÉ ACADÉMIQUE (white card border 12px radius padding 20px) :
"Identité académique" 500 15px
✓ "Email académique vérifié" teal
Infos rows : 🎓 Université · 🏫 École · 📚 Domaine · 🎯 Niveau · 📅 Inscription
Note muted 11px italic : "Informations vérifiées via email institutionnel"

DROITE :

BADGES (white card border 12px radius padding 20px mb 16px) :
"Badges obtenus" 500 15px
Grid 2 colonnes :
  Obtenu : cercle or-light 48px + icône + nom + date muted tiny
  Verrouillé : gris + overlay cadenas + "X rép. requis"

CONTRIBUTION (white card border 12px radius padding 20px mb 16px) :
"Contribution" 500 15px
"Ce mois-ci" : barre teal 65% + "13 réponses"
"Meilleur mois" : barre or 100% + "20 réponses"
"Total" : "47 réponses · 3 formulaires"

CLASSEMENT (white card or border gauche 4px padding 16px) :
"Classement" 500 14px
"8ème à l'ENCG Marrakech" or Fraunces 20px
"Top 3% de SciConnect" teal 12px
"23ème au niveau UCA" muted

BACKEND :
GET /api/profiles/:slug → données profil public
GET /api/profiles/:slug/questionnaires → portfolio recherche

CHECKLIST VÉRIFICATION PARTIE 6 :
□ /profil/[slug] charge sans login
□ Avatar Google et badge vérifié visibles
□ Stats row affiche les vraies données
□ Portfolio recherche liste les questionnaires déposés
□ Badges obtenus et verrouillés s'affichent
□ Classement charge depuis GET /api/profiles/:slug/ranking
□ Bouton partage copie l'URL dans le presse-papiers

══════════════════════════════════════════
RÈGLES GLOBALES — NE JAMAIS VIOLER
══════════════════════════════════════════

1. NE JAMAIS toucher frontend/index.html — la landing page reste intacte
2. NE JAMAIS envoyer un email de façon synchrone — toujours Thread séparé
3. NE JAMAIS hardcoder les couleurs — toujours utiliser les CSS variables de main.css
4. NE JAMAIS appeler l'API Google Forms plus d'une fois par 30 secondes par form_id
5. NE JAMAIS stocker les tokens OAuth dans localStorage — httpOnly cookies uniquement
6. NE JAMAIS oublier les commentaires /* EDITABLE: */ avant chaque texte modifiable
7. TOUJOURS vérifier la checklist de chaque partie avant de demander permission
8. TOUJOURS demander "✅ Partie X terminée. Puis-je passer à la Partie X+1 ?" avant de continuer

FORMAT MESSAGE FIN DE PARTIE :
"✅ Partie X ([Nom]) terminée et vérifiée.
Checklist complète :
✓ [item 1]
✓ [item 2]
...
Puis-je pass
er à la Partie X+1 ([Nom]) ?"

══════════════════════════════════════════
REFONTE COMPLÈTE V3 — TOUTES LES PAGES SAUF LANDING
DERNIÈRES MODIFICATIONS VALIDÉES
══════════════════════════════════════════

RÈGLE ABSOLUE NUMÉRO 1 :
NE JAMAIS TOUCHER frontend/index.html
NE JAMAIS TOUCHER frontend/css/landing.css
NE JAMAIS TOUCHER frontend/js/landing.js
La landing page est gelée définitivement.

RÈGLE ABSOLUE NUMÉRO 2 :
Lire DESIGN.md à la racine avant toute ligne de code.
Appliquer les skills emilkowalski et pbakaus pour toutes les animations.

RÈGLE ABSOLUE NUMÉRO 3 :
Travailler en parties séquentielles.
Arrêter après chaque partie et attendre "oui" pour continuer.

DESIGN SYSTEM GLOBAL :
Teal primaire : #005F54
Teal hover : #004A41
Teal light : #E8F5F3
Teal mid : #9FE1CB
Or : #C9A84C
Or light : #FDF8EC
Bg global : #F7F6F2
Surface : #FFFFFF
Surface 2 : #F0EDE6
Texte : #181816
Texte 2 : #57564F
Muted : #9A9890
Border : #E2DED6
Success : #1A7A5E
Warning : #BA6A1A
Danger : #C0392B

Typographie :
Display/titres : Fraunces (Google Fonts) via CDN
Corps/UI : DM Sans (Google Fonts) via CDN
Monospace : system mono pour codes, durées, compteurs

Animations globales (emilkowalski style) :
Spring entrée : cubic-bezier(0.32, 0.72, 0, 1) 300-400ms
Spring sortie : cubic-bezier(0.4, 0, 0.6, 1) 200ms
Hover boutons : translateY(-1px) à translateY(-2px) 150ms
Hover cartes : translateY(-3px) à translateY(-4px) 180ms
Scale bouton actif : scale(0.98) au mousedown
Focus inputs : box-shadow 0 0 0 3px rgba(0,95,84,0.08) + border teal
Stagger éléments : 60ms entre chaque enfant
Scroll reveal : translateY(16px) opacity(0) → 0 opacity(1) 400ms IntersectionObserver threshold 0.12

══════════════════════════════════════════
PARTIE 1 — BACKEND : NOUVEAU SYSTÈME DE POINTS
══════════════════════════════════════════

FICHIERS À MODIFIER :
- backend/models.py
- backend/routes/auth.py
- backend/routes/forms.py
- backend/routes/responses.py

SUPPRIMER COMPLÈTEMENT :
- Tout le système monthly_responses_given
- Toute logique d'approbation manuelle des réponses
- Toute référence à monthly_responses_given dans le code

NOUVEAU MODÈLE User (ajouter ces colonnes) :
points                  = db.Column(db.Integer, default=0)
streak_days             = db.Column(db.Integer, default=0)
last_login_date         = db.Column(db.Date, nullable=True)
total_responses_given   = db.Column(db.Integer, default=0)
total_forms_posted      = db.Column(db.Integer, default=0)

NOUVEAU MODÈLE Subscription :
class Subscription(db.Model):
    id              = db.Column(db.Integer, primary_key=True)
    subscriber_id   = db.Column(db.Integer, db.ForeignKey('user.id'))
    publisher_id    = db.Column(db.Integer, db.ForeignKey('user.id'))
    created_at      = db.Column(db.DateTime, default=datetime.utcnow)
    notify_email    = db.Column(db.Boolean, default=True)
    notify_inapp    = db.Column(db.Boolean, default=True)

CONSTANTES DE POINTS (backend/config.py) :
# EDITABLE: modifier les valeurs ici pour ajuster le système
POINTS_REPONDRE_COURT   = 10   # questionnaire < 5 min
POINTS_REPONDRE_LONG    = 15   # questionnaire > 5 min
POINTS_LOGIN_QUOTIDIEN  = 5    # connexion chaque jour
POINTS_STREAK_7_JOURS   = 25   # bonus 7 jours consécutifs
POINTS_50_REPONSES      = 20   # jalon 50 réponses reçues
POINTS_DEPOSER          = -20  # coût d'un dépôt
POINTS_MIN_DEPOT        = 20   # minimum requis pour déposer

LOGIQUE CONNEXION QUOTIDIENNE dans routes/auth.py :
Après chaque login Google ou email réussi :
  today = date.today()
  if user.last_login_date != today:
      user.points += POINTS_LOGIN_QUOTIDIEN
      if user.last_login_date == today - timedelta(days=1):
          user.streak_days += 1
          if user.streak_days % 7 == 0:
              user.points += POINTS_STREAK_7_JOURS
              streak_bonus = True
      else:
          user.streak_days = 1
          streak_bonus = False
      user.last_login_date = today
      db.session.commit()
  Retourner dans le JSON :
      points_earned: POINTS_LOGIN_QUOTIDIEN,
      streak: user.streak_days,
      total_points: user.points,
      streak_bonus: streak_bonus (True/False),
      is_first_login_today: True/False

LOGIQUE RÉPONSE AUTOMATIQUE dans routes/responses.py :
Supprimer tout système d'approbation manuelle
Toute réponse POST /api/responses → approuvée immédiatement
Calculer durée = timestamp_fin - timestamp_début (en secondes)
Si durée < 30 secondes → is_suspect = True (flag seulement, ne bloque pas)
Attribuer points selon durée :
    if duration_seconds < 300:  # moins de 5 min
        points = POINTS_REPONDRE_COURT
    else:
        points = POINTS_REPONDRE_LONG
user.points += points
user.total_responses_given += 1
db.session.commit()
Retourner : { points_earned, total_points, is_suspect }

LOGIQUE DÉPÔT dans routes/forms.py :
Remplacer la vérification monthly_responses_given par :
    if current_user.points < POINTS_MIN_DEPOT:
        return { error: "Points insuffisants",
                 points_needed: POINTS_MIN_DEPOT - current_user.points }, 403
Après publication réussie :
    current_user.points -= POINTS_DEPOSER  # soustraction de 20
    current_user.total_forms_posted += 1
    db.session.commit()
    Envoyer email deposit_confirm (via email_service.py)
    Envoyer notifications aux abonnés :
        subscribers = Subscription.query.filter_by(
            publisher_id=current_user.id,
            notify_email=True
        ).all()
        for sub in subscribers:
            send_subscription_notification(sub.subscriber, current_user, questionnaire)

ABONNEMENTS routes/profiles.py :
GET  /api/profiles/:slug                    → profil public
POST /api/profiles/:slug/subscribe          → s'abonner
DELETE /api/profiles/:slug/subscribe        → se désabonner
GET  /api/profiles/:slug/questionnaires     → questionnaires publiés
GET  /api/profiles/:slug/stats              → stats publiques

CHECKLIST PARTIE 1 :
□ Migration DB appliquée sans perte de données
□ monthly_responses_given supprimé partout
□ Points connexion quotidienne attribués et retournés dans JSON
□ Streak calculé correctement
□ Réponses approuvées automatiquement sans action manuelle
□ is_suspect flag fonctionne pour durée < 30s
□ Dépôt conditionné par points >= 20
□ -20 points déduits après publication
□ Modèle Subscription créé en DB
□ Notifications abonnés envoyées à la publication

══════════════════════════════════════════
PARTIE 2 — DASHBOARD (refonte totale)
══════════════════════════════════════════

FICHIERS À MODIFIER :
- frontend/dashboard.html (refonte totale)
- frontend/css/dashboard.css (refonte totale)
- frontend/js/dashboard.js (refonte totale)

LAYOUT GLOBAL :
Rail gauche 68px fixe + Sidebar 252px cachée + Contenu flex-1
bg global #F7F6F2
Pas de panneau droit — SUPPRIMÉ DÉFINITIVEMENT

RAIL GAUCHE (68px, bg #FAFAF8, border-right 1px #E2DED6) :
Toujours visible, ne disparaît jamais
Padding 14px 0 10px

Logo SciConnect en haut (40px carré arrondi bg teal) :
SVG deux cercles Venn blancs + cercle or au centre
Cliquable → ouvre/ferme sidebar
Hover : scale(1.05) 150ms

Séparateur 1px #E2DED6 width 28px

Boutons rail (44px × 44px border-radius 12px) :
Chaque bouton : icône SVG 18px + label texte 8px en dessous
Gap entre icon et label : 3px
Hover : background #E8F5F3
Active : background #E8F5F3 + pseudo-element ::before barre teal 3px gauche 24px hauteur border-radius 0 3px 3px 0

Icônes SVG (tracer à la main, stroke sans fill) :
Feed : path maison M3 9L9 3L15 9V15H11V11H7V15H3V9Z
Explorer : circle + path horloge
Notifications : path cloche + arc bas
Profil : circle tête + arc corps
Déposer : rect + path plus
Mes questionnaires : 3 barres croissantes
Badges : path étoile 5 branches
Paramètres : circle centre + 8 lignes autour
Déconnexion : path porte avec flèche

Badge notifications rouge 8px sur l'icône cloche (si non lus > 0)

Spacer flex:1 entre les icônes de navigation et le bas

Avatar utilisateur en bas (28px circle border teal + label "Profil" 8px)
Cliquable → ouvre panneau profil dans topbar

SIDEBAR (252px, bg blanc, border-right 1px #E2DED6) :
Cachée par défaut : translateX(-252px)
Ouverte : translateX(0)
Animation : cubic-bezier(0.32, 0.72, 0, 1) 300ms
S'ouvre au clic sur n'importe quelle icône du rail
Se ferme au clic outside ou sur bouton ✕

Header sidebar :
Logo SciConnect texte + bouton ✕ fermeture
Border-bottom 1px #E2DED6

Carte identité (bg #E8F5F3 border teal 12px radius padding 12px) :
Avatar Google 42px circle border teal
Nom DM Sans 500 13px
École + niveau muted 11px
Badge "✓ Étudiant vérifié" teal bg blanc 9px

Widget points (blanc border padding 10px radius 10px) :
"240 pts" Fraunces 700 24px teal + "points accumulés" muted 10px
Barre progrès teal fill
"✓ Dépôt disponible !" vert si points >= 20
"Il te manque X pts" rouge si points < 20

Widget streak (blanc border padding 10px radius 10px) :
"🔥 Streak X jours" DM Sans 500 11px
7 cercles jours L M M J V S D, remplis teal si complétés
"×2 pts aujourd'hui !" or si streak actif

Navigation même structure que le rail mais avec labels texte

POPUP CONNEXION QUOTIDIENNE :
Déclencher si API auth retourne is_first_login_today: true
Overlay rgba(0,0,0,0.4) avec card centrée
Animation : scale(0.8) opacity(0) → scale(1) opacity(1) 400ms spring
Contenu :
    Étoile animée (pulse gold)
    "+ X pts gagnés aujourd'hui !" Fraunces 700 32px teal
    Si streak_bonus: "🔥 Streak de X jours ! Bonus +25 pts" or
    "Tu as maintenant X pts" muted
    Bouton teal "C'est parti !" → ferme
    Auto-ferme après 4 secondes

TOPBAR (bg blanc border-bottom 1px #E2DED6 hauteur 56px padding 0 18px) :
Gauche :
    Bouton ☰ (34×34px border radius 9px) → toggle sidebar
    Animation hover : background #E8F5F3 border teal
    "Bonjour, [Prénom] 👋" Fraunces 17px

Centre (flex:1) :
    Input recherche avec icône loupe gauche (svg 14px)
    Width 190px, height 32px, border radius 8px bg #F7F6F2
    Focus : border teal bg blanc box-shadow 3px ring

Droite :
    Pill "X actifs" (bg #E8F5F3 border #9FE1CB) :
        Point vert 6px pulsant + nombre fluctuant JS 28-41 toutes 4s
    
    Bouton notifications (34×34px border radius 9px) :
        Icône cloche SVG 16px stroke #57564F
        Badge rouge nombre en haut droite si non lus
        Clic → panneau notifications slide down sous topbar
        État actif : bg #E8F5F3 border #9FE1CB
    
    Bouton profil pill (avatar 28px circle teal + prénom 12px + chevron) :
        Hover : bg #E8F5F3 border teal
        Clic → panneau profil slide down sous topbar

PANNEAU NOTIFICATIONS (slide down, bg blanc border radius 12px margin 14px 18px) :
Visible au clic sur cloche, caché au clic outside
Header : "Notifications" 13px 500 + "Tout marquer comme lu" teal 11px droite
Items :
    Point bleu teal 8px (non lu) ou gris (lu)
    Texte notification 12px + heure muted 10px
    4 notifications exemple dont streak bonus et réponse reçue
Bouton "Tout marquer comme lu" → tous points deviennent gris

PANNEAU PROFIL (slide down, bg blanc border radius 12px) :
Avatar 48px + nom + école + badge vérifié + pts
Grid 3 stats : réponses données / questionnaires / taux complétion
2 boutons : "Voir mon profil public" teal + "Déposer" outline
Bouton déconnexion ghost

CONTENU PRINCIPAL :

Banner recommandation smart (bg teal border-radius 14px padding 16px 20px) :
GET /api/forms/recommended → premier résultat
Gauche :
    "⭐ Recommandé pour toi" pill or
    Titre Fraunces 15px blanc
    Avatar publieur 20px + nom + école muted
Droite :
    "+10 pts" pill or
    Bouton "Répondre →" blanc
    "X min · Y questions" muted
Animation entrée : slideUp + fadeIn 400ms delay 200ms

Banner état points (visible si points < 40) :
Si points = 0 : bg #FEF3F2 border rouge
    Cadenas rouge + "Réponds à des questionnaires pour gagner des points"
    Tracker [○ Réponse 1] [○ Réponse 2] [🔒 Dépôt]
Si 0 < points < 20 : bg #FFF8EC border orange
    "Il te manque X pts pour déposer"
Si points >= 20 : ne pas afficher ce banner

Filtres (chips scrollables) :
"Tous" · "Mon domaine" · "Récents" · "Flash < 2min" · "Populaires" · "Mes abonnements 🔔" · "Sauvegardés ♡"
Chip active : bg teal blanc
Hover : border teal couleur teal

GRILLE QUESTIONNAIRES — MASONRY 3 COLONNES :
gap 12px, columns:3
Cartes de hauteurs variées selon contenu

CARTE QUESTIONNAIRE :
bg blanc border 0.5px #E2DED6 border-radius 14px overflow hidden
Hover : translateY(-3px) border-color teal 180ms spring

Stripe top 3px couleur du domaine

Header (padding 12px 14px 0) :
    Badge école pill + badge domaine + heure muted droite
    Si trending : pill "🔥 Tendance" rouge clair

Titre DM Sans 500 12px line-height 1.4 margin-bottom 5px
Description 11px muted si disponible margin-bottom 6px

Chips domaine · niveau · durée · nb questions (9px bg #F0EDE6)

Publieur row (border-top + border-bottom #F7F6F2 padding 6px 0 margin 7px 0) :
    Avatar publieur 22px circle couleur domaine
    Nom cliquable → page profil, hover underline
    Bouton "S'abonner" / "Suivi ✓" toggle côté droit :
        Non abonné : border teal couleur teal bg transparent
        Abonné : bg teal blanc "Suivi ✓"
        Animation clic : ripple teal scale 0.95→1

Points état (selon user.points) :
    points >= 20 : "✓ Dépôt disponible" vert 10px
    points < 20 : "Il te manque X pts" rouge 10px

Footer :
    Bouton "Répondre · +10pts" teal full-width height 36px radius 8px
    Icône ♡ save 28×28px radius 7px border côté droit

JAVASCRIPT DASHBOARD :
1. Appel API auth → détecter is_first_login_today → afficher popup
2. Appel GET /api/forms/recommended → banner smart
3. Appel GET /api/forms → charger grille masonry
4. Toggle sidebar avec animation spring
5. Toggle panneaux notif et profil
6. Compteur actifs fluctuation 28-41 toutes 4s
7. Toggle abonnement sur chaque carte
8. Filtre chips → recharger feed depuis API
9. Scroll reveal IntersectionObserver
10. Popup connexion auto-ferme 4s

CHECKLIST PARTIE 2 :
□ Rail 68px toujours visible
□ Sidebar s'ouvre/ferme avec animation spring
□ Popup connexion quotidienne s'affiche si first_login_today
□ Points affichés correctement dans sidebar
□ Panneau notifications fonctionnel
□ Panneau profil fonctionnel avec stats réelles
□ Banner recommandation charge depuis API
□ Grille masonry 3 colonnes
□ Avatar + nom publieur sur chaque carte
□ Bouton abonnement toggle
□ Panneau droit ABSENT (supprimé)
□ Animations spring partout

══════════════════════════════════════════
PARTIE 3 — PAGE LOGIN (refonte centrée)
══════════════════════════════════════════

FICHIERS À MODIFIER :
- frontend/login.html (refonte totale)
- frontend/css/login.css
- backend/routes/auth.py (ajouter email auth)
- backend/services/email_service.py (code vérif)

LAYOUT :
bg #F7F6F2 full page
Navbar minimale : logo gauche + "← Retour à l'accueil" bouton droit (border radius 7px)

Tagline centrée (fadeIn delay 100ms) :
"Tu es à quelques pts d'avoir des données pour ton mémoire."
Fraunces italic 18px teal centré
Soulignement or animé 44px

CARTE CENTRALE SEULEMENT (max-width 420px centré) :
bg blanc border 0.5px #E2DED6 border-radius 20px overflow:hidden
Animation entrée : fadeUp 400ms spring

Stripe teal 6px top

Padding 32px :

Logo centré :
    Box teal 48px radius 13px avec SVG Venn
    "SciConnect" Fraunces 22px teal/or
    "Plateforme académique marocaine · UCA · Hassan II" muted 12px

Aperçu 3 étapes :
    3 cercles : Connexion (teal rempli ✓) → Profil (teal outline) → Feed (gris)
    Connecteurs ligne gris
    Labels 9px muted sous chaque cercle
    bg #F7F6F2 border-radius 10px padding 10px 16px

Tabs (2 onglets, bg #F7F6F2 border-radius 10px padding 3px) :
    Tab Google | Tab Email académique
    Active : bg teal blanc border-radius 8px
    Transition background 200ms

ONGLET GOOGLE :
Bouton Google DOMINANT (full width height 50px bg teal radius 12px) :
    Vrai logo Google SVG multicolore 20px
    "Continuer avec Google" DM Sans 500 14px
    Flèche → droite opacity 0.5
    Hover : bg #004A41 translateY(-2px) 150ms
    Active : scale(0.99) translateY(0)

Boîte confidentialité (bg #F7F6F2 radius 10px padding 10px 12px) :
    3 lignes avec icônes SVG 14px :
    Bouclier teal : "Uniquement ton nom et email · aucun accès à Gmail ou Drive."
    Cadenas gris : "Connexion sécurisée OAuth 2.0."
Séparateur "ou"
Lien non-étudiant : "Tu n'es pas étudiant ? Accède directement via un lien →"

ONGLET EMAIL ACADÉMIQUE :
Description : "Pour les étudiants dont Google ne fonctionne pas."
Input email avec icône enveloppe gauche (36px input icon)
DÉTECTION DOMAINE EN TEMPS RÉEL (debounce 300ms) :
    @uca.ac.ma → pill terracotta "UCA Cadi Ayyad détectée" bg #FDF5F0
    @univh2c.ma ou @um5.ac.ma → pill navy "Hassan II détectée" bg #EBF0FB
    @gmail.com hotmail yahoo → pill rouge "Email non académique"
    *.ac.ma inconnu → pill orange "Domaine non répertorié — nous vérifierons"
Bouton "Recevoir le code →" teal
    Disabled si email invalide ou domaine non académique

ÉCRAN CODE 6 CHIFFRES (remplace le formulaire) :
Transition slide : form → code section avec fadeIn
"Code envoyé à [email]" 13px 500 + "Vérifie tes spams" italic muted
6 inputs 46×58px gap 8px centré :
    Border 1.5px #E2DED6 radius 10px
    Focus : border teal box-shadow 3px ring
    Rempli : border teal bg #E8F5F3 texte teal 24px mono
    Auto-focus case suivante à chaque chiffre
    Backspace → retourne case précédente
    Coller 6 chiffres → remplit tout automatiquement
Countdown or : "Renvoyer dans 00:45" → devient lien "Renvoyer" à 0
Bouton "Confirmer →" teal
    Disabled jusqu'à 6 cases remplies
Note sécurité muted 10px : cadenas icon + "Code à usage unique · 10 minutes"

Séparateur "ou"
Lien non-étudiant

SOCIAL PROOF (sous la carte) :
5 avatars chevauchants + "1 247 étudiants · 20 établissements · UCA + Hassan II"
fadeIn delay 300ms

BACKEND EMAIL AUTH :
POST /api/auth/email/send-code :
    Vérifier domaine dans ACADEMIC_DOMAINS list
    Générer code 6 chiffres random
    Stocker en cache/DB avec expiry 10 min
    Envoyer email Flask-Mail : "Votre code SciConnect : XXXXXX"

POST /api/auth/email/verify-code :
    Vérifier code + expiry
    Si valide : créer session (même logique Google OAuth)
    Attribuer points connexion quotidienne

ACADEMIC_DOMAINS = [
    'uca.ac.ma', 'encg-marrakech.ac.ma', 'um5.ac.ma',
    'univh2c.ma', 'ump.ac.ma', 'uae.ac.ma', 'uit.ac.ma',
    'usms.ac.ma', 'usmba.ac.ma', 'ui.ac.ma'
    # EDITABLE: ajouter d'autres domaines ici
]

CHECKLIST PARTIE 3 :
□ Carte centrale seule, pas de sidebar gauche ni droite
□ Tab Google/Email toggle fonctionnel
□ Vrai logo Google SVG multicolore
□ Détection domaine temps réel avec les 4 états de couleur
□ 6 cases code avec auto-focus et coller automatique
□ Countdown timer fonctionne
□ Backend envoie email avec code
□ Session créée après vérification email
□ Points connexion attribués aussi pour login email

══════════════════════════════════════════
PARTIE 4 — PAGE DE RÉPONSE (refonte UX)
══════════════════════════════════════════

FICHIERS À MODIFIER :
- frontend/respond.html (refonte totale)
- frontend/css/respond.css
- frontend/js/respond.js

LAYOUT : max-width 580px centré, bg #F7F6F2

TOPBAR (bg blanc border-bottom 1px #E2DED6 padding 10px 16px) :
Bouton ← retour (30×30px border radius 7px hover teal)
Barre progression :
    Label "Question X / Y" 11px muted + pourcentage teal droit
    Track 5px height bg #F0EDE6 border-radius 3px
    Fill teal transition 500ms spring
Timer restant : icône horloge SVG 12px + "~X min" muted, se met à jour par question
Bouton "Quitter" (11px muted border radius 6px hover bg #F0EDE6)

CARTE PUBLIEUR (bg teal padding 12px 16px) :
Avatar publieur 38px circle bg rgba(white,0.15) border rgba(white,0.3)
Nom 12px blanc 500 + badge "✓ Vérifiée" pill rgba(white,0.2)
École muted rgba(white,0.6) 11px
Titre questionnaire Fraunces 16px blanc line-height 1.35
Chips (bg rgba(white,0.12)) : domaine · durée · nb questions
Badge "+10 pts" bg rgba(or,0.2) couleur or
Bouton S'abonner côté droit (bg rgba(white,0.12) border rgba(white,0.25) blanc)
Toggle : "S'abonner" → "Suivi ✓" bg rgba(white,0.2)

ÉTAPES (bg blanc border-bottom 1px #E2DED6 padding 10px 16px) :
5 cercles 26px avec lignes connectrices flex
Cercle complété : bg teal border teal blanc ✓
Cercle actuel : bg #E8F5F3 border teal couleur teal animation pulse 2s ring
Cercle à venir : bg #F7F6F2 border #E2DED6 muted
Lignes : 2px height bg #E2DED6, se colorent en teal quand question complétée
Cliquable : revenir à une question déjà complétée

CARTE QUESTION (bg blanc border 0.5px #E2DED6 border-radius 14px margin 14px 0) :
Animation question : translateX(18px) opacity(0) → 0 opacity(1) 280ms spring
En sortie : translateX(-18px) opacity(0) 200ms ease-in

Badge haut : "Q1" teal 500 11px + type question muted bg #F7F6F2 droite
Titre : Fraunces 17px 700 line-height 1.4
Hint si applicable : 11px muted

TYPE CHOIX UNIQUE :
Options empilées (gap 7px) :
    bg blanc border 1.5px #E2DED6 radius 10px padding 11px 14px
    Icon radio 18px circle gauche
    Hover : border #9FE1CB bg #E8F5F3 translateX(2px) 150ms
    Sélectionné : border teal bg #E8F5F3 couleur teal 500
    Radio rempli teal + point blanc centre

TYPE ÉCHELLE 1-5 :
Labels extrêmes muted 11px
5 boutons égaux height 46px radius 9px border 1.5px #E2DED6
    Hover : border teal bg #E8F5F3 scale(1.04) 150ms
    Sélectionné : bg teal blanc scale(1.06)
    Adjacent sélectionné : bg #E8F5F3 border #9FE1CB

TYPE CHOIX MULTIPLE :
Même style que choix unique mais avec checkbox 17×17px radius 5px
Sélectionné : checkbox bg teal border teal + icône ✓ SVG blanc

TYPE TEXTE LIBRE :
Textarea min-height 100px bg #F7F6F2 border 1.5px #E2DED6 radius 10px
Focus : border teal bg blanc box-shadow 3px ring
Compteur bas droit 10px muted "X / 400"
Label "Question facultative" vert 10px bas gauche

NAVIGATION (flex row gap 8px) :
"← Précédent" : border 1.5px #E2DED6 radius 9px height 42px
    Disabled : opacity 0.35
    Hover : border teal couleur teal bg #E8F5F3
"Suivant →" ou "Envoyer ✓" : bg teal blanc radius 9px height 42px flex-1
    Disabled : bg #E2DED6 muted
    Hover actif : bg #004A41 translateY(-1px)
Lien discret : "Sauvegarder et continuer plus tard" muted 11px centré

ÉCRAN SUCCÈS :
Cercle check (72px bg #E8F5F3 border teal) :
    Path ✓ SVG stroke-dashoffset animation 600ms ease-out delay 300ms
"+10 pts gagnés !" Fraunces 40px or
"merci pour ta contribution !" 13px muted
"Total : X pts" muted + fort teal

Carte déverrouillage (bg blanc border 1.5px teal radius 12px padding 14px) :
    "Progression vers le dépôt" + "✓ Dépôt disponible !" vert
    Barre teal fill transition 1.2s spring (0 → 100% si points >= 20)
    Note : bouclier vert + "Tu peux maintenant déposer ton questionnaire !"

3 boutons action :
    "Déposer mon questionnaire →" teal primary height 46px
    "Répondre à un autre" outline teal height 44px
    "Voir le profil de [Publieur] →" ghost muted 12px

JAVASCRIPT RESPOND :
1. Charger questionnaire depuis GET /api/forms/:id
2. Gérer state machine questions (current, answers array)
3. POST /api/responses à la fin avec timestamps
4. Recevoir points_earned dans réponse
5. Afficher écran succès avec animation

CHECKLIST PARTIE 4 :
□ Barre progression et timer mis à jour à chaque question
□ Carte publieur teal avec infos correctes
□ Étapes bulles avec animation pulse sur active
□ Animation spring entre questions (slide in/out)
□ 4 types de questions rendus correctement
□ Bouton suivant disabled si pas de réponse sauf texte
□ Écran succès avec animation ✓ stroke-dashoffset
□ Barre progression déverrouillage animée
□ POST /api/responses avec timestamps

══════════════════════════════════════════
PARTIE 5 — PAGE STATISTIQUES (refonte)
══════════════════════════════════════════

FICHIERS À MODIFIER :
- frontend/stats.html (refonte totale)
- frontend/js/stats.js
- backend/routes/export.py
- backend/services/export.py

LAYOUT : max-width 680px centré bg #F7F6F2

TOPBAR (bg blanc border-bottom) :
Bouton ← retour
Info questionnaire : titre tronqué 14px 500 + point vert pulsant + "Mis à jour il y a Xs"
Actions droite :
    "Partager" (border, icon SVG partage)
    "Export Excel" (bg teal, icon téléchargement, PRIMARY)

4 MÉTRIQUES (grid 4 colonnes gap 8px padding 14px 16px) :
Chaque carte (bg blanc border radius 12px padding 12px) :
    Valeur Fraunces 24px teal (ou or pour temps moyen)
    Label 10px muted
    Barre progrès 4px
    Sous-label 10px muted

Valeurs réelles depuis GET /api/forms/:id/stats :
    Réponses totales / objectif
    Taux complétion + détail complètes/abandons
    Temps moyen complétion
    Dernière réponse heure relative + école

GRAPHIQUE 1 — Réponses par jour (Line Chart.js) :
bg blanc border radius 12px padding 14px
Height wrapper : 140px
Dataset : données réelles 7 derniers jours depuis DB
borderColor : #005F54
backgroundColor : #E8F5F3
fill: true
tension: 0.4
Axes : grid #F0EDE6, ticks muted 11px

GRAPHIQUE 2 — Complétion par question (Bar Chart.js) :
bg blanc border radius 12px padding 14px
Height wrapper : 220px
Données réelles : pour chaque question % répondants qui y ont répondu
Couleur barre :
    >= 75% → #005F54 teal
    < 75% → #E67E22 orange (point de chute)
Border-radius barres : 6px
Alerte automatique si une barre < 75% :
    Box rouge clair bg #FEF3F2 border #E8A9A0 radius 10px padding 10px
    "Point de chute à Q[X] (Y%). Reformule ou rends facultative."

GRAPHIQUES RÉPONDANTS (grid 2 colonnes gap 10px) :
Donut Chart.js gauche : par université
    UCA #005F54 · Hassan II #C9A84C · Autres #E2DED6
    cutout 60%, hauteur wrapper 130px
    Légende custom HTML sous le donut (carrés colorés + label + %)

Donut Chart.js droit : par niveau
    M1 teal · M2 teal clair · L3 or · autres gris
    Même style

TABLEAU RÉPONDANTS RÉEL :
bg blanc border radius 12px overflow hidden
Données réelles depuis DB
En-têtes : Répondant · Établissement · Niveau · Durée · Statut
Durée en monospace
Status pills :
    "✓ Vérifié" bg #E8F5F3 couleur #085041
    "Public" bg #FDF8EC couleur #633806
    "Suspect" bg #FEF3F2 couleur #922B21 (durée < 30s)
Hover row : bg #F7F6F2
Bouton "Voir les X répondants →" pleine largeur bas

EXPORT EXCEL RÉEL :
Section bg blanc border radius 12px padding 14px
4 feuilles présentées en grid 2×2 :
    📋 bg #E8F5F3 "Données brutes" "Toutes les réponses avec profils"
    📊 bg #FDF8EC "Statistiques auto" "Graphiques QCM + moyennes"
    👥 bg #E8F5F3 "Profils démographiques" "Répartition par université"
    ✅ bg #F0EDE6 "Fiabilité & Qualité" "Taux, suspects, points de chute"
Hover sheet : border teal bg #E8F5F3

Bouton export teal full-width height 42px :
    Icon téléchargement + nom fichier "SciConnect_Export_[titre]_[date].xlsx"
    Clic → GET /api/export/:id → téléchargement réel
    Animation : texte change en "✓ Téléchargement en cours..." bg vert 2s

Paragraphe méthodologique auto-généré :
    bg #FDF8EC border or radius 10px padding 12px
    Texte généré depuis les vraies données :
    "Les données ont été collectées via SciConnect entre le [date_debut]
    et le [date_fin]. Sur [total] participants, [complets] ont fourni
    des réponses complètes ([taux]%). [verifies] répondants ([pct_v]%)
    ont été vérifiés via email académique institutionnel."
    Bouton "Copier ce paragraphe →" blanc border teal
    Clic → navigator.clipboard.writeText() + animation "✓ Copié !"

BACKEND EXPORT (backend/services/export.py) :
Générer avec openpyxl depuis vraies données DB
Feuille 1 "Données brutes" :
    Toutes les réponses réelles avec colonnes :
    # · Email · Prénom · Type · Université · École · Niveau · Date · Durée(sec) · Complétion(%) · Statut
    Header bg #005F54 blanc
    Lignes alternées blanc/#F7F6F2
    Auto-fit colonnes

Feuille 2 "Statistiques auto" :
    Pour chaque question QCM : COUNT par option + PieChart openpyxl
    Pour chaque échelle : AVERAGE(), MEDIAN(), STDEV()
    Pour texte ouvert : liste des réponses

Feuille 3 "Profils démographiques" :
    Répartition université avec BarChart openpyxl
    Répartition niveau avec PieChart
    Répartition domaine

Feuille 4 "Fiabilité & Qualité" :
    Complètes vs abandonnées avec taux
    Suspects surlignés rouge (durée < 30s)
    Temps moyen par répondant
    Question avec plus fort abandon surlignée orange
    Paragraphe méthodologique texte dans cette feuille aussi

CHECKLIST PARTIE 5 :
□ 4 métriques avec vraies données depuis API
□ Line chart réponses par jour vraies données
□ Bar chart complétion par question vraies données
□ Barres orange si < 75%, teal sinon
□ Alerte point de chute automatique
□ 2 donuts université et niveau vraies données
□ Tableau répondants vraies données triable
□ Export .xlsx télécharge un vrai fichier
□ 4 feuilles Excel avec vraies données
□ Graphiques openpyxl dans feuilles 2 et 3
□ Paragraphe méthodologique généré depuis vraies données
□ Copier paragraphe fonctionne clipboard

══════════════════════════════════════════
PARTIE 6 — PROFIL PUBLIC
══════════════════════════════════════════

FICHIERS À CRÉER :
- frontend/profile.html
- frontend/css/profile.css
- frontend/js/profile.js

URL : /profil/:slug
Accessible sans connexion (lecture seule)

TOPBAR :
"← Retour au feed" bouton gauche
"Partager" bouton droit (icon SVG + "Partager")

BANNER (bg teal height 90px) :
SVG décoratif : 3 cercles blancs opacity 0.06 tailles variées

AVATAR (position relative margin 0 16px top -40px) :
80px circle bg teal border 3px blanc Fraunces 24px initiales
Badge vérifié absolu bas-droite : 20px circle bg #1A7A5E border 2px blanc SVG ✓

IDENTITÉ + ACTIONS :
Flex entre infos gauche et boutons droite
Infos :
    Nom Fraunces 22px 700
    École + domaine + niveau muted 13px
    Badges : "✓ Email vérifié" bg #E8F5F3 + "★ Fondateur" bg #FDF8EC + "240 pts" bg #F0EDE6
    Depuis [mois] [année] · URL profil muted 11px
Boutons (margin-top 40px) :
    "S'abonner" / "Abonné ✓" toggle border teal
    Icône message (border #E2DED6 hover teal)

BANDE STATS (grid 4 colonnes border-top border-bottom bg blanc) :
Réponses données / Questionnaires / Taux complétion / Classement #X
Données depuis GET /api/profiles/:slug/stats

PORTFOLIO QUESTIONNAIRES (section padding 0 16px) :
Titre "Questionnaires publiés" + "Voir tout →" teal
Cartes (bg blanc border radius 12px padding 12px 14px gap 8px) :
    Stripe gauche 4px couleur domaine (border-radius 0)
    Info : titre tronqué 12px 500 + meta muted 11px
    Droite : nombre Fraunces 14px teal + "réponses" muted 10px
    Hover : border teal bg #E8F5F3

BADGES GRID (4 colonnes) :
Obtenus : bg blanc border radius 10px padding 10px centré
    Icon 36px circle colored bg + emoji
    Nom 10px 500 + date/description 9px muted
Verrouillés : même structure opacity 0.45

CONTRIBUTION (bg blanc border radius 12px padding 14px) :
3 barres :
    Ce mois-ci : fill teal 65%
    Meilleur mois : fill or 100%
    Total : fill teal clair 47%
Labels + valeurs

CLASSEMENT (bg blanc border radius 12px padding 14px) :
Nombre principal Fraunces 36px or + établissement + "Top X%"
3 lignes : ENCG / UCA / Global avec badges teal

CHECKLIST PARTIE 6 :
□ /profil/:slug charge sans login
□ Avatar + badge vérifié visibles
□ Toggle abonnement POST/DELETE API
□ Stats band avec vraies données
□ Portfolio questionnaires depuis API
□ Badges obtenus vs verrouillés
□ Barres contribution animées
□ Classement depuis API

══════════════════════════════════════════
RÈGLES GLOBALES ABSOLUES
══════════════════════════════════════════

1. NE JAMAIS toucher index.html / landing.css / landing.js
2. NE JAMAIS envoyer email de façon synchrone — threading.Thread
3. NE JAMAIS hardcoder des données fictives dans les stats
4. NE JAMAIS utiliser monthly_responses_given (supprimé)
5. NE JAMAIS approuver manuellement les réponses (auto-approuvé)
6. TOUJOURS utiliser les CSS variables teal/or définies
7. TOUJOURS Fraunces pour titres + DM Sans pour corps
8. TOUJOURS spring cubic-bezier(0.32,0.72,0,1) pour animations entrée
9. TOUJOURS commenter /* EDITABLE: */ avant textes modifiables
10. TOUJOURS vérifier la checklist avant de passer à la partie suivante

FORMAT MESSAGE FIN DE PARTIE :
"✅ Partie X ([Nom]) terminée.
Checklist :
✓ item 1
✓ item 2
...
Puis-je passer à la Partie X+1 ([Nom]) ?"