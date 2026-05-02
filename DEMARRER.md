# SciConnect — Démarrage rapide

## Lancer le serveur

```
C:\Users\user\AppData\Local\Programs\Python\Python314\python.exe backend/app.py
```

Puis ouvrir : **http://localhost:5000**

## Parcours utilisateur complet

1. **http://localhost:5000** → Landing Page
2. Cliquer "Continuer avec Google" → **login.html**
3. Se connecter avec Google → **onboarding.html** (5 questions)
4. Compléter l'onboarding → **dashboard.html**
5. Cliquer "Répondre" sur une carte → **respond.html**
6. Soumettre le formulaire + vérifier → points attribués
7. Après 2 réponses → dépôt déverrouillé
8. Déposer son questionnaire → visible dans le feed
9. Voir ses stats → **stats.html** (graphique + export Excel)

## Fichiers éditables sans redémarrage

| Fichier                  | Contenu                          |
|--------------------------|----------------------------------|
| `admin/content.json`     | Textes visibles (héro, stats...) |
| `admin/settings.json`    | Labels boutons, feature flags    |
| `admin/schools.json`     | Universités et écoles            |

## Variables d'environnement (.env)

```
GOOGLE_CLIENT_ID=174005181980-v50bpg2gtbiisakuj23f2q5krrtmgllg.apps.googleusercontent.com
SECRET_KEY=sciconnect-dev-secret-change-in-prod
```
