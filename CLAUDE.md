# SciConnect — Instructions Claude Code

> Ce fichier est lu automatiquement par Claude Code à chaque démarrage.
> Lis-le intégralement AVANT de faire quoi que ce soit.

## Instruction principale

Lis immédiatement le fichier suivant en entier :

    docs/PROMPT_COMPLET.md

Ce fichier contient toutes les instructions détaillées du projet :
architecture, design system, règles absolues, ordre des parties,
checklists de vérification, et structure complète du code.

## Ce que tu dois faire au démarrage

1. Lire docs/PROMPT_COMPLET.md en entier, sans sauter aucune section
2. Confirmer avec ce message exact :

    ✅ J'ai lu CLAUDE.md et docs/PROMPT_COMPLET.md en entier.

    Voici ce que j'ai compris :
    - Projet : SciConnect (plateforme académique marocaine)
    - Stack : HTML/CSS/JS + Python Flask
    - Je dois construire 6 parties dans l'ordre strict
    - Je dois vérifier chaque partie avant de passer à la suivante
    - Je ne commence aucune partie sans ta permission explicite

    Puis-je démarrer la Partie 1 — Landing Page ?

3. Attendre la confirmation de l'utilisateur
4. Ne créer AUCUN fichier avant cette confirmation

## Règles non négociables (résumé)

- Commencer TOUJOURS par la Partie 1 (Landing Page)
- Demander la permission avant chaque nouvelle partie
- Vérifier la checklist complète de chaque partie avant de continuer
- Ne jamais coder une couleur en dur — toujours les variables CSS de main.css
- Ne jamais stocker un token Google dans localStorage
- Ne jamais appeler Google Forms API sans cache de 30 secondes
- Tous les textes visibles chargés depuis admin/content.json
- Tous les labels de boutons chargés depuis admin/settings.json
- Toutes les écoles chargées depuis admin/schools.json

## Format de permission obligatoire après chaque partie

    ✅ Partie X — [Nom] terminée et vérifiée.
    Checklist :
      ✓ Item 1
      ✓ Item 2
      ...
    Puis-je passer à la Partie X+1 — [Nom suivante] ?

## Ordre des parties

    Partie 1 : Landing Page
    Partie 2 : Google OAuth + Onboarding
    Partie 3 : Dashboard principal
    Partie 4 : Page réponse + vérification Google Forms API
    Partie 5 : Statistiques + export Excel
    Partie 6 : Intégration finale + système live-edit

---
Pour toute la logique détaillée → docs/PROMPT_COMPLET.md
