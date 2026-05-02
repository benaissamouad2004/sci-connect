# SERVICE: Système de recommandation de formulaires
# OBJECTIF: Calculer un score de pertinence pour chaque formulaire selon le profil utilisateur
# EDITABLE: modifier les poids ci-dessous pour ajuster l'algorithme

from datetime import datetime
from backend.models import Questionnaire, Response


def get_recommended_forms(user, limit=6):
    """
    Retourne les formulaires recommandés pour un utilisateur avec leur score.
    Exclut les formulaires déjà répondus et ceux déposés par l'utilisateur lui-même.
    EDITABLE: modifier les poids de chaque critère ci-dessous
    Retourne : liste de tuples (Questionnaire, score)
    """
    if not user:
        items = Questionnaire.query.filter_by(is_active=True)\
                                   .order_by(Questionnaire.created_at.desc())\
                                   .limit(limit).all()
        return [(f, 0) for f in items]

    # Formulaires déjà répondus
    answered_ids = {
        r.questionnaire_id
        for r in Response.query.filter_by(respondent_id=user.id).all()
    }

    # Domaine principal de l'utilisateur
    user_domain = (user.domains or [None])[0] if user.domains else None

    scored = {}
    for form in Questionnaire.query.filter_by(is_active=True).all():
        # Exclure ses propres formulaires et ceux déjà répondus
        if form.author_id == user.id or form.id in answered_ids:
            continue

        score = 0

        # Critère 1 — Même domaine (poids fort)
        if user_domain and form.domain == user_domain:
            score += 30  # EDITABLE: poids domaine

        # Critère 2 — Même université
        if user.university_id and form.university_id == user.university_id:
            score += 20  # EDITABLE: poids université

        # Critère 3 — Même niveau ou "Tous niveaux"
        if user.level and form.target_level in (user.level, 'Tous niveaux'):
            score += 15  # EDITABLE: poids niveau

        # Bonus récence — moins de 7 jours
        age_days = (datetime.utcnow() - form.created_at).days if form.created_at else 999
        if age_days < 7:
            score += 10  # EDITABLE: bonus récence

        # Bonus popularité — beaucoup de réponses
        if (form.response_count or 0) > 20:
            score += 5   # EDITABLE: bonus popularité

        scored[form] = score

    sorted_forms = sorted(scored.items(), key=lambda x: x[1], reverse=True)
    return sorted_forms[:limit]