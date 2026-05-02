/* ═══════════════════════════════════════════════════════════
   SCICONNECT — Profil Public
   Accessible sans connexion — lecture seule
   ═══════════════════════════════════════════════════════════ */

/* EDITABLE: définitions des badges — points minimum requis pour chaque niveau */
const BADGE_DEFS = [
  { id: 'novice',      icon: '⭐', name: 'Novice',       min_pts: 0,   label: 'Débloqué dès l\'inscription'  },
  { id: 'contributor', icon: '🎯', name: 'Contributeur', min_pts: 50,  label: '50 points requis'              },
  { id: 'expert',      icon: '🏆', name: 'Expert',       min_pts: 150, label: '150 points requis'             },
  { id: 'master',      icon: '👑', name: 'Master',       min_pts: 300, label: '300 points requis'             },
];

/* EDITABLE: couleurs par domaine de recherche */
const DOMAIN_COLORS = {
  'Économie & Gestion':          '#2D7A5E',
  'Informatique & IA':           '#2563EB',
  'Sciences & Ingénierie':       '#D97706',
  'Médecine & Santé':            '#DC2626',
  'Droit & Sciences Politiques': '#4B5563',
  'Lettres & Sciences Humaines': '#7C3AED',
  'Marketing & Communication':   '#BE185D',
  'Finance & Comptabilité':      '#0891B2',
  'Autre':                       '#6B7280',
};

const profState = {
  slug:    null,
  profile: null,
  forms:   [],
};

/* ─── Initialisation ─── */
document.addEventListener('DOMContentLoaded', async () => {
  await loadContent();

  /* Slug depuis ?slug=... ou /profil/[slug] dans le chemin */
  const params = new URLSearchParams(window.location.search);
  const pathParts = window.location.pathname.split('/profil/');
  profState.slug = params.get('slug') || pathParts[1] || null;

  /* Si pas de slug dans l'URL, charger le profil de l'utilisateur connecté */
  if (!profState.slug) {
    try {
      const me = await fetch('/api/auth/me', { credentials: 'include' }).then(r => r.json());
      if (me && me.authenticated && me.user.slug) {
        profState.slug = me.user.slug;
      }
    } catch { /* silencieux */ }
  }

  if (!profState.slug) {
    showError('Profil introuvable. Connecte-toi pour accéder à ton profil.');
    return;
  }

  checkSession();
  await Promise.all([loadProfile(), loadPortfolio()]);
});

/* ─── Session check (lecture seule si non connecté) ─── */
async function checkSession() {
  try {
    const me = await fetch('/api/auth/me', { credentials: 'include' }).then(r => r.json());
    if (me && me.authenticated) {
      const dash = document.getElementById('nav-dashboard');
      const login = document.getElementById('nav-login');
      if (dash)  dash.style.display  = 'inline-flex';
      if (login) login.style.display = 'none';
    }
  } catch {
    /* pas de session — afficher le bouton login */
  }
}

/* ─── Chargement du profil ─── */
async function loadProfile() {
  try {
    const resp = await fetch(`/api/profiles/${profState.slug}`);
    if (!resp.ok) {
      if (resp.status === 404) return showError('Ce profil n\'existe pas ou a été supprimé.');
      return showError('Impossible de charger ce profil.');
    }
    const data = await resp.json();
    profState.profile = data;
    renderProfile(data);
  } catch {
    showError('Erreur réseau lors du chargement du profil.');
  }
}

/* ─── Chargement du portfolio ─── */
async function loadPortfolio() {
  try {
    const resp = await fetch(`/api/profiles/${profState.slug}/questionnaires`);
    if (!resp.ok) return;
    const data = await resp.json();
    profState.forms = data.items || [];
    renderPortfolio(profState.forms);
  } catch {
    renderPortfolio([]);
  }
}

/* ─── Rendu complet du profil ─── */
function renderProfile(data) {
  document.title = `${data.name} — SciConnect`;

  renderAvatar(data);
  renderHeroInfo(data);
  renderStatsRow(data);
  renderBadges(data);
  renderContribution(data);
  renderRanking(data);
  renderIdentity(data);
}

/* ── Avatar ── */
function renderAvatar(data) {
  const el = document.getElementById('prof-avatar');
  if (!el) return;
  if (data.avatar_url) {
    el.innerHTML = `<img src="${escAttr(data.avatar_url)}" alt="${escAttr(data.name)}" loading="lazy">`;
  } else {
    el.textContent = (data.name || 'U')[0].toUpperCase();
  }
}

/* ── Infos hero ── */
function renderHeroInfo(data) {
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

  set('prof-name',    data.name || 'Utilisateur');
  set('prof-school',  data.school_name || '—');
  set('prof-university', data.university_name || '—');

  const domainLevel = [data.domain, data.level].filter(Boolean).join(' · ');
  set('prof-domain-level', domainLevel || '—');

  /* Date d'inscription */
  const since = data.created_at
    ? new Date(data.created_at).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    : null;
  set('prof-since', since ? `Membre depuis ${since}` : '');

  /* Badge fondateur */
  const founderEl = document.getElementById('prof-founder');
  if (founderEl) founderEl.style.display = data.is_founder ? 'inline-flex' : 'none';

  /* Badge actuel */
  const currentBadge = BADGE_DEFS.find(b => b.id === data.badge_level) || BADGE_DEFS[0];
  set('prof-badge-icon', currentBadge.icon);
  set('prof-badge-name', currentBadge.name);
  set('prof-badge-sub',  currentBadge.label);

  /* URL profil */
  const url = `${window.location.origin}/profil/${data.slug}`;
  set('prof-url', url);
}

/* ── Stats row ── */
function renderStatsRow(data) {
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

  set('stat-responses',      data.total_responses    || 0);
  set('stat-questionnaires', data.total_questionnaires || 0);
  set('stat-completion',     data.avg_completion > 0 ? `${data.avg_completion}%` : '—');

  if (data.school_rank) {
    set('stat-rank', `🥇 #${data.school_rank}`);
    const label = document.getElementById('stat-rank-label');
    if (label) label.textContent = `classement ${data.school_name || 'école'}`;
  } else {
    set('stat-rank', '—');
  }
}

/* ── Badges ── */
function renderBadges(data) {
  const el = document.getElementById('prof-badges-grid');
  if (!el) return;

  const pts          = data.points || 0;
  const currentLevel = BADGE_DEFS.findIndex(b => b.id === data.badge_level);

  el.innerHTML = BADGE_DEFS.map((badge, i) => {
    const unlocked    = i <= currentLevel;
    const itemClass   = unlocked ? 'prof-badge-item--unlocked' : 'prof-badge-item--locked';
    const circleStyle = unlocked ? '' : '';
    const sub         = unlocked ? badge.label : badge.label;

    return `<div class="prof-badge-item ${itemClass}" aria-label="${escHtml(badge.name)} — ${unlocked ? 'obtenu' : 'verrouillé'}">
      ${!unlocked ? `<div class="prof-badge-lock-overlay">🔒</div>` : ''}
      <div class="prof-badge-item-circle">${badge.icon}</div>
      <div class="prof-badge-item-name">${escHtml(badge.name)}</div>
      <div class="prof-badge-item-sub">${escHtml(sub)}</div>
    </div>`;
  }).join('');
}

/* ── Contribution ── */
function renderContribution(data) {
  const el = document.getElementById('contribution-body');
  if (!el) return;

  const monthly = data.monthly_responses || 0;
  const total   = data.total_responses   || 0;

  /* EDITABLE: "meilleur mois" approximé à partir du total si non disponible */
  const bestMonth = Math.max(monthly, Math.ceil(total / 3));
  const maxBar    = Math.max(bestMonth, 1);

  const monthPct = Math.min(100, (monthly / maxBar) * 100).toFixed(0);
  const bestPct  = 100;

  el.innerHTML = `
    <div class="prof-contrib-row">
      <div class="prof-contrib-label">
        <span class="prof-contrib-label-bold">Ce mois-ci</span>
        <span>${monthly} réponse${monthly > 1 ? 's' : ''}</span>
      </div>
      <div class="prof-contrib-bar-track">
        <div class="prof-contrib-bar-fill prof-contrib-bar-fill--teal" style="width:${monthPct}%"></div>
      </div>
    </div>
    <div class="prof-contrib-row">
      <div class="prof-contrib-label">
        <span class="prof-contrib-label-bold">Meilleur mois</span>
        <span>${bestMonth} réponse${bestMonth > 1 ? 's' : ''}</span>
      </div>
      <div class="prof-contrib-bar-track">
        <div class="prof-contrib-bar-fill prof-contrib-bar-fill--gold" style="width:${bestPct}%"></div>
      </div>
    </div>
    <div class="prof-contrib-total">
      Total · <strong>${total} réponse${total > 1 ? 's' : ''}</strong> · <strong>${data.total_questionnaires || 0} formulaire${(data.total_questionnaires || 0) > 1 ? 's' : ''}</strong>
    </div>`;
}

/* ── Classement ── */
function renderRanking(data) {
  const mainEl  = document.getElementById('rank-main');
  const tealEl  = document.getElementById('rank-teal');
  const mutedEl = document.getElementById('rank-muted');

  if (data.school_rank && data.school_name) {
    if (mainEl) mainEl.textContent  = `${data.school_rank}${_ordinal(data.school_rank)} à ${data.school_name}`;
  } else {
    if (mainEl) mainEl.textContent  = `${data.points || 0} points`;
  }

  if (data.top_pct !== null && data.top_pct !== undefined) {
    if (tealEl) tealEl.textContent = `Top ${data.top_pct}% de SciConnect`;
  }

  if (data.general_rank) {
    if (mutedEl) mutedEl.textContent = `${data.general_rank}${_ordinal(data.general_rank)} au classement général`;
  }
}

function _ordinal(n) {
  return n === 1 ? 'er' : 'ème';
}

/* ── Identité académique ── */
function renderIdentity(data) {
  const el = document.getElementById('prof-identity-rows');
  if (!el) return;

  const rows = [
    { icon: '🎓', label: 'Université', value: data.university_name || '—' },
    { icon: '🏫', label: 'École',       value: data.school_name     || '—' },
    { icon: '📚', label: 'Domaine',     value: data.domain          || '—' },
    { icon: '🎯', label: 'Niveau',      value: data.level           || '—' },
  ];

  if (data.created_at) {
    const date = new Date(data.created_at).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    rows.push({ icon: '📅', label: 'Inscription', value: `Depuis ${date}` });
  }

  el.innerHTML = rows.map(r => `
    <div class="prof-identity-row">
      <span class="prof-identity-icon">${r.icon}</span>
      <span style="color:var(--color-text-muted);font-size:0.78rem;min-width:70px">${escHtml(r.label)}</span>
      <span style="font-weight:500">${escHtml(r.value)}</span>
    </div>`).join('');
}

/* ── Portfolio ── */
function renderPortfolio(forms) {
  const el = document.getElementById('portfolio-list');
  if (!el) return;

  if (!forms.length) {
    el.innerHTML = `<div class="prof-portfolio-empty">
      Aucun questionnaire déposé pour l'instant.
    </div>`;
    return;
  }

  el.innerHTML = forms.map(q => {
    const color   = DOMAIN_COLORS[q.domain] || 'var(--color-primary)';
    const dateStr = q.created_at
      ? new Date(q.created_at).toLocaleDateString('fr-FR', { day:'numeric', month:'short', year:'numeric' })
      : '';
    const count = q.response_count || 0;

    return `<div class="prof-portfolio-item">
      <div class="prof-portfolio-dot" style="background:${color}"></div>
      <div style="flex:1;min-width:0">
        <div class="prof-portfolio-title">${escHtml(q.title)}</div>
        <div class="prof-portfolio-chips">
          ${q.domain ? `<span class="prof-chip prof-chip--domain">${escHtml(q.domain)}</span>` : ''}
          ${dateStr  ? `<span class="prof-chip prof-chip--date">${dateStr}</span>` : ''}
          <span class="prof-chip prof-chip--count">${count} réponse${count > 1 ? 's' : ''}</span>
        </div>
      </div>
    </div>`;
  }).join('');
}

/* ── Partager le profil ── */
function shareProfile() {
  const url = `${window.location.origin}/profil/${profState.slug}`;
  navigator.clipboard.writeText(url).then(() => {
    showToast('Lien de profil copié !', 'success');
  }).catch(() => {
    showToast(`Lien : ${url}`, 'info');
  });
}

/* ── État d'erreur ── */
function showError(msg) {
  const el = document.getElementById('prof-shell');
  if (!el) return;
  el.innerHTML = `
    <div style="text-align:center;padding:80px 24px;color:var(--color-text-muted)">
      <div style="font-size:2.5rem;margin-bottom:16px">🔍</div>
      <div style="font-size:1rem;font-weight:600;color:var(--color-text-secondary);margin-bottom:8px">${escHtml(msg)}</div>
      <a href="index.html" style="display:inline-flex;align-items:center;gap:8px;padding:10px 20px;background:var(--color-primary);color:#fff;border-radius:var(--radius-md);text-decoration:none;font-weight:600;margin-top:16px">
        ← Retour à l'accueil
      </a>
    </div>`;
}

/* ─── Utilitaires ─── */
function escHtml(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function escAttr(str) {
  return (str || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}