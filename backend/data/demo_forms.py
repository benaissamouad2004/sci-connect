from datetime import datetime, timedelta

DEMO_AUTHOR_ID = 'system-sciconnect-demo'

DEMO_QUESTIONNAIRES = [
    {
        'title': 'Comportements numériques des étudiants marocains',
        'description': "Étude sur l'utilisation des outils numériques (smartphones, IA, e-learning) dans le parcours universitaire.",
        'google_forms_url': 'https://docs.google.com/forms/d/e/1FAIpQLSdDemo0001SciConnectMaroc/viewform',
        'form_id': '1FAIpQLSdDemo0001SciConnectMaroc',
        'domain': 'Informatique & IA',
        'target_level': 'L3',
        'target_count': 150,
        'university_id': 'UCA',
        'school_id': 'fst-marrakech',
        'response_count': 47,
        'completion_rate': 0.92,
        'image_url': 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=600&q=80',
    },
    {
        'title': "L'impact du stress sur les résultats académiques",
        'description': 'Questionnaire sur le bien-être mental et les facteurs de stress chez les étudiants en médecine.',
        'google_forms_url': 'https://docs.google.com/forms/d/e/1FAIpQLSdDemo0002SciConnectMaroc/viewform',
        'form_id': '1FAIpQLSdDemo0002SciConnectMaroc',
        'domain': 'Médecine & Santé',
        'target_level': 'L3',
        'target_count': 200,
        'university_id': 'UCA',
        'school_id': 'fmpm-marrakech',
        'response_count': 83,
        'completion_rate': 0.89,
        'image_url': 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=600&q=80',
    },
    {
        'title': "L'entrepreneuriat étudiant au Maroc",
        'description': "Analyse des intentions entrepreneuriales et des obstacles perçus par les étudiants en gestion.",
        'google_forms_url': 'https://docs.google.com/forms/d/e/1FAIpQLSdDemo0003SciConnectMaroc/viewform',
        'form_id': '1FAIpQLSdDemo0003SciConnectMaroc',
        'domain': 'Économie & Gestion',
        'target_level': 'M1',
        'target_count': 120,
        'university_id': 'UH2',
        'school_id': 'encg-casablanca',
        'response_count': 34,
        'completion_rate': 0.94,
        'image_url': 'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=600&q=80',
    },
    {
        'title': 'Habitudes de lecture et accès aux bibliothèques',
        'description': "Enquête sur les pratiques de lecture académique et l'utilisation des ressources documentaires universitaires.",
        'google_forms_url': 'https://docs.google.com/forms/d/e/1FAIpQLSdDemo0004SciConnectMaroc/viewform',
        'form_id': '1FAIpQLSdDemo0004SciConnectMaroc',
        'domain': 'Lettres & Sciences Humaines',
        'target_level': 'Tous niveaux',
        'target_count': 100,
        'university_id': 'UCA',
        'school_id': 'flsh-marrakech',
        'response_count': 61,
        'completion_rate': 0.87,
        'image_url': 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=600&q=80',
    },
    {
        'title': "L'intelligence artificielle dans l'enseignement supérieur",
        'description': "Perception et usage de l'IA (ChatGPT, Copilot) par les étudiants en informatique et ingénierie.",
        'google_forms_url': 'https://docs.google.com/forms/d/e/1FAIpQLSdDemo0005SciConnectMaroc/viewform',
        'form_id': '1FAIpQLSdDemo0005SciConnectMaroc',
        'domain': 'Informatique & IA',
        'target_level': 'M1',
        'target_count': 80,
        'university_id': 'UH2',
        'school_id': 'fst-mohammedia',
        'response_count': 29,
        'completion_rate': 0.96,
        'image_url': 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=600&q=80',
    },
    {
        'title': "Perception de l'égalité des chances dans les grandes écoles",
        'description': "Étude sur l'équité d'accès aux grandes écoles marocaines selon l'origine géographique et sociale.",
        'google_forms_url': 'https://docs.google.com/forms/d/e/1FAIpQLSdDemo0006SciConnectMaroc/viewform',
        'form_id': '1FAIpQLSdDemo0006SciConnectMaroc',
        'domain': 'Droit & Sciences Politiques',
        'target_level': 'L3',
        'target_count': 180,
        'university_id': 'UCA',
        'school_id': 'fsjes-marrakech',
        'response_count': 72,
        'completion_rate': 0.91,
        'image_url': 'https://images.unsplash.com/photo-1589994965851-a8f479c573a9?w=600&q=80',
    },
    {
        'title': 'Les réseaux sociaux et la santé mentale des jeunes',
        'description': "Impact de l'utilisation d'Instagram, TikTok et Twitter sur l'anxiété et l'estime de soi.",
        'google_forms_url': 'https://docs.google.com/forms/d/e/1FAIpQLSdDemo0007SciConnectMaroc/viewform',
        'form_id': '1FAIpQLSdDemo0007SciConnectMaroc',
        'domain': 'Médecine & Santé',
        'target_level': 'Tous niveaux',
        'target_count': 250,
        'university_id': 'UH2',
        'school_id': 'fsac-casablanca',
        'response_count': 118,
        'completion_rate': 0.85,
        'image_url': 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=600&q=80',
    },
    {
        'title': 'Comportements financiers des étudiants marocains',
        'description': "Analyse des habitudes d'épargne, de dépense et d'endettement chez les étudiants en finance.",
        'google_forms_url': 'https://docs.google.com/forms/d/e/1FAIpQLSdDemo0008SciConnectMaroc/viewform',
        'form_id': '1FAIpQLSdDemo0008SciConnectMaroc',
        'domain': 'Finance & Comptabilité',
        'target_level': 'L2',
        'target_count': 100,
        'university_id': 'UH2',
        'school_id': 'encg-casablanca',
        'response_count': 41,
        'completion_rate': 0.93,
        'image_url': 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&q=80',
    },
    {
        'title': 'Mobilité internationale et étudiants marocains',
        'description': "Enquête sur les motivations, freins et expériences de mobilité à l'étranger (Erasmus, stages, master).",
        'google_forms_url': 'https://docs.google.com/forms/d/e/1FAIpQLSdDemo0009SciConnectMaroc/viewform',
        'form_id': '1FAIpQLSdDemo0009SciConnectMaroc',
        'domain': 'Économie & Gestion',
        'target_level': 'M1',
        'target_count': 130,
        'university_id': 'UCA',
        'school_id': 'ens-marrakech',
        'response_count': 56,
        'completion_rate': 0.90,
        'image_url': 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=600&q=80',
    },
    {
        'title': 'Pratiques sportives et bien-être étudiant',
        'description': 'Lien entre activité physique régulière et performance académique, stress et qualité de vie.',
        'google_forms_url': 'https://docs.google.com/forms/d/e/1FAIpQLSdDemo0010SciConnectMaroc/viewform',
        'form_id': '1FAIpQLSdDemo0010SciConnectMaroc',
        'domain': 'Médecine & Santé',
        'target_level': 'Tous niveaux',
        'target_count': 200,
        'university_id': 'UCA',
        'school_id': 'fst-marrakech',
        'response_count': 94,
        'completion_rate': 0.88,
        'image_url': 'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=600&q=80',
    },
]


def seed_demo_questionnaires(db, User, Questionnaire):
    """Crée ou réactive les questionnaires de démonstration."""
    existing_demos = Questionnaire.query.filter_by(author_id=DEMO_AUTHOR_ID).all()

    if existing_demos:
        # Réactiver les demos désactivés
        for demo in existing_demos:
            demo.is_active = True
        db.session.commit()
        print(f'[SciConnect] {len(existing_demos)} questionnaires de démonstration réactivés.')
        return

    system_user = User.query.filter_by(id=DEMO_AUTHOR_ID).first()
    if not system_user:
        system_user = User(
            id                  = DEMO_AUTHOR_ID,
            google_id           = DEMO_AUTHOR_ID,
            email               = 'demo@sciconnect.ma',
            name                = 'SciConnect Démo',
            school_id           = 'fst-marrakech',
            university_id       = 'UCA',
            level               = 'M2',
            points              = 500,
            badge_level         = 'expert',
            is_founder          = True,
            onboarding_complete = True,
        )
        db.session.add(system_user)

    base_date = datetime(2024, 9, 1)
    for i, q_data in enumerate(DEMO_QUESTIONNAIRES):
        q = Questionnaire(
            title            = q_data['title'],
            description      = q_data['description'],
            google_forms_url = q_data['google_forms_url'],
            form_id          = q_data['form_id'],
            domain           = q_data['domain'],
            target_level     = q_data['target_level'],
            target_count     = q_data['target_count'],
            author_id        = DEMO_AUTHOR_ID,
            university_id    = q_data['university_id'],
            school_id        = q_data['school_id'],
            response_count   = q_data['response_count'],
            completion_rate  = q_data['completion_rate'],
            image_url        = q_data['image_url'],
            is_active        = True,
            created_at       = base_date + timedelta(days=i * 7),
        )
        db.session.add(q)

    db.session.commit()
    print(f'[SciConnect] {len(DEMO_QUESTIONNAIRES)} questionnaires de démonstration insérés.')
