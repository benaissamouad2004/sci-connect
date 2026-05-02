/* ═══════════════════════════════════════════════════════════
   SCICONNECT — Dashboard JS v3
   ═══════════════════════════════════════════════════════════ */

/* EDITABLE: regex validation URL Google Forms */
const GOOGLE_FORMS_REGEX = /(?:docs\.google\.com\/forms\/d\/(?:e\/)?|forms\.gle\/)([^/?&#\s]+)/;

function validateGoogleFormsUrl(url) {
  const match = url.match(GOOGLE_FORMS_REGEX);
  return match ? { valid: true, formId: match[1] } : { valid: false, formId: null };
}

/* ─── État global ─── */
const state = {
  user:        null,
  forms:       [],
  schools:     null,
  filters:     { university_id: '', school_id: '', domain: '' },
  activeChip:  'recent',
  content:     null,
  settings:    null,
  searchQuery: '',
  activeFormId: null,
};

/* EDITABLE: couleurs par domaine — peut être externalisé dans settings.json */
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

/* ─── Initialisation ─── */
document.addEventListener('DOMContentLoaded', async () => {
  /* EDITABLE: loadContent() charge content.json + settings.json */
  const loaded = await loadContent();
  if (loaded) {
    state.content  = loaded.content;
    state.settings = loaded.settings;
  }

  setTopbarDate();
  startLiveCounter();

  /* Vérifier la session */
  const me = await fetch('/api/auth/me', { credentials: 'include' })
                    .then(r => r.json()).catch(() => null);

  if (me && me.authenticated) {
    state.user = me.user;
    renderIdentityCard(me.user);
    renderStreakWidget(me.user.streak || 0);
    renderStatsStrip(me.user);
    renderSidebarReciprocity(me.user);
    renderReciprocityBanner(me.user);
    updateNavLock(me.user.can_deposit);
    renderDepositPanel(me.user);
    setGreeting(me.user);

    /* Lien profil public dans la nav */
    const navProfile = document.getElementById('nav-profile');
    if (navProfile) {
      navProfile.href = me.user.slug ? `profile.html?slug=${me.user.slug}` : 'profile.html';
    }

    /* Badge notifications */
    loadNotifCount();
  } else {
    renderGuestSidebar();
  }

  /* EDITABLE: écoles chargées depuis admin/schools.json */
  const schoolsData = await loadSchools();
  if (schoolsData) {
    state.schools = schoolsData.universities;
    populateFilterDropdowns(schoolsData.universities);
  }

  await loadForms();

  if (state.user) {
    loadActiveQuestionnaire();
    loadSuggestions();
  }

  /* EDITABLE: refresh automatique — settings.json → features.live_counter_refresh_seconds */
  const refreshSec = state.settings?.features?.live_counter_refresh_seconds || 30;
  setInterval(loadForms, refreshSec * 1000);
});

/* ─── Topbar ─── */
function setTopbarDate() {
  const el = document.getElementById('topbar-date');
  if (!el) return;
  el.textContent = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

function setGreeting(user) {
  const el = document.getElementById('topbar-greeting');
  if (!el) return;
  /* EDITABLE: message de bienvenue depuis content.json → dashboard.welcome_message */
  const welcome   = state.content?.dashboard?.welcome_message || 'Bonjour';
  const firstName = (user.name || '').split(' ')[0];
  el.textContent = `${welcome}, ${firstName} 👋`;
}

/* ─── Stats Strip — 4 KPI tiles ─── */
function renderStatsStrip(user) {
  const strip = document.getElementById('stats-strip');
  if (!strip) return;
  strip.style.display = 'grid';

  const streak   = user.streak || 0;
  const points   = user.points || 0;
  const count    = user.monthly_responses_given || 0;
  const deposits = user.monthly_deposits || 0;
  const needed   = user.responses_needed_for_next_deposit || 2;
  const canDep   = user.can_deposit;
  const rpd      = user.responses_per_deposit || 2;
  const progressInCycle = count - (deposits * rpd);
  const pct = Math.min(100, Math.round((progressInCycle / rpd) * 100));

  /* Streak */
  const streakEl = document.getElementById('stat-streak');
  if (streakEl) streakEl.textContent = streak;

  /* Points */
  const ptsEl = document.getElementById('stat-points');
  if (ptsEl) ptsEl.textContent = points;

  /* Réponses */
  const respEl  = document.getElementById('stat-responses-count');
  const denomEl = document.getElementById('stat-responses-denom');
  const barEl   = document.getElementById('stat-responses-bar');
  const pillEl  = document.getElementById('stat-responses-pill');
  if (respEl)  respEl.textContent  = progressInCycle;
  if (denomEl) denomEl.textContent = `/${rpd}`;
  if (barEl)   barEl.style.width   = `${pct}%`;
  if (pillEl) {
    if (canDep) {
      pillEl.textContent = '✓ Débloqué';
      pillEl.className   = 'stat-tile-status-pill unlocked';
    } else if (progressInCycle >= 1) {
      pillEl.textContent = `${rpd - progressInCycle} restante${rpd - progressInCycle > 1 ? 's' : ''}`;
      pillEl.className   = 'stat-tile-status-pill half';
    } else {
      pillEl.textContent = 'Verrouillé';
      pillEl.className   = 'stat-tile-status-pill';
    }
  }

  /* Dépôt */
  const iconEl   = document.getElementById('stat-deposit-icon');
  const labelEl  = document.getElementById('stat-deposit-label');
  const ctaEl    = document.getElementById('stat-deposit-cta');
  const tileEl   = document.getElementById('stat-tile-deposit');
  if (iconEl)  iconEl.textContent  = canDep ? '✅' : progressInCycle >= 1 ? '🔓' : '🔒';
  if (labelEl) labelEl.textContent = canDep
    ? (deposits > 0 ? `Dépôt ${deposits + 1} prêt` : 'Disponible !')
    : (progressInCycle >= 1 ? `${progressInCycle}/${rpd} réponses` : 'Verrouillé');
  if (ctaEl)   ctaEl.style.display = canDep ? 'inline-block' : 'none';
  if (tileEl)  {
    if (canDep) tileEl.classList.add('unlocked-state');
    else tileEl.classList.remove('unlocked-state');
  }
}

/* EDITABLE: compteur live — fluctue entre 28 et 41 toutes les 4 secondes */
function startLiveCounter() {
  const el = document.getElementById('topbar-live-count');
  if (!el) return;
  setInterval(() => {
    el.textContent = Math.floor(Math.random() * (41 - 28 + 1)) + 28;
  }, 4000);
}

/* ─── Carte identité sidebar ─── */
function renderIdentityCard(user) {
  const avatarEl = document.getElementById('identity-avatar');
  const nameEl   = document.getElementById('identity-name');
  const metaEl   = document.getElementById('identity-meta');
  const ptsEl    = document.getElementById('identity-pts');

  if (avatarEl) {
    if (user.avatar_url) {
      avatarEl.innerHTML = `<img src="${escapeAttr(user.avatar_url)}" alt="${escapeAttr(user.name || '')}" loading="lazy">`;
    } else {
      avatarEl.textContent = (user.name || 'U')[0].toUpperCase();
    }
  }

  if (nameEl) nameEl.textContent = user.name || user.email || '';
  if (metaEl) {
    const parts = [user.school_id, user.level].filter(Boolean);
    metaEl.textContent = parts.join(' · ');
  }
  if (ptsEl) ptsEl.textContent = `★ ${user.points || 0} pts`;

  /* Circular progress ring selon badge_level */
  const badgePct = { novice: 20, contributor: 40, expert: 70, master: 100 };
  const pct = badgePct[user.badge_level] || 20;
  animateRing(pct);

  /* Badges mini depuis user */
  updateBadgeMini(user);

  /* Lien stats */
  const navStats = document.getElementById('nav-stats');
  if (navStats) navStats.style.display = 'flex';
}

function animateRing(percentage) {
  const fill = document.getElementById('ring-fill');
  const text = document.getElementById('ring-badge-text');
  if (!fill) return;
  const circumference = 2 * Math.PI * 22; /* r=22 → ~138.2 */
  const offset = circumference * (1 - percentage / 100);
  fill.style.strokeDashoffset = offset;
  if (text) {
    const icons = { novice: '⭐', contributor: '🎯', expert: '🏆', master: '👑' };
    text.textContent = icons[state.user?.badge_level] || '⭐';
  }
}

function updateBadgeMini(user) {
  const contrib = document.getElementById('badge-val-contrib');
  const streak  = document.getElementById('badge-val-streak');
  const fillC   = document.getElementById('badge-fill-contrib');
  const fillS   = document.getElementById('badge-fill-streak');

  const responses = user.points ? Math.floor(user.points / 10) : 0;
  if (contrib) contrib.textContent = `${responses}/20`;
  if (fillC)   fillC.style.width   = `${Math.min(100, (responses / 20) * 100)}%`;

  const streakVal = user.streak || 0;
  if (streak) streak.textContent = streakVal >= 7 ? `${streakVal}/7 🔥` : `${streakVal}/7`;
  if (fillS)  fillS.style.width  = `${Math.min(100, (streakVal / 7) * 100)}%`;
}

/* ─── Streak Widget ─── */
/* EDITABLE: affiche les 7 jours de la semaine avec les jours actifs colorés */
function renderStreakWidget(streakCount) {
  const countEl  = document.getElementById('streak-days-count');
  const bonusEl  = document.getElementById('streak-bonus');
  const days     = document.querySelectorAll('#streak-days-row .streak-day');

  if (countEl) countEl.textContent = streakCount;

  /* Rempli les jours depuis aujourd'hui en remontant */
  const todayIdx = new Date().getDay(); /* 0=dim,1=lun,... */
  const orderMap = [6, 0, 1, 2, 3, 4, 5]; /* Lun=0, Mar=1, ... Dim=6 dans l'affichage */
  const todayInOrder = orderMap[todayIdx] ?? 0;

  days.forEach((day, i) => {
    /* Un jour est "done" si i <= todayInOrder ET dans la fenêtre du streak */
    const daysAgoInWeek = todayInOrder - i;
    if (daysAgoInWeek >= 0 && daysAgoInWeek < streakCount) {
      day.classList.add('streak-day--done');
    } else {
      day.classList.remove('streak-day--done');
    }
  });

  if (bonusEl) {
    bonusEl.style.display = streakCount >= 7 ? 'block' : 'none';
  }
}

/* ─── Réciprocité sidebar (widget multi-dépôt) ─── */
function renderSidebarReciprocity(user) {
  const el = document.getElementById('sidebar-recip-content');
  if (!el) return;

  const count      = user.monthly_responses_given || 0;
  const deposits   = user.monthly_deposits || 0;
  const needed     = user.responses_needed_for_next_deposit || 2;
  const canDeposit = user.can_deposit;
  const rpd        = user.responses_per_deposit || 2;

  /* Avancement vers le prochain dépôt */
  const progressInCycle = count - (deposits * rpd);
  const pct = Math.min(100, Math.round((progressInCycle / rpd) * 100));

  /* Ligne de titre */
  const slotLabel = deposits > 0
    ? `Dépôt ${deposits + 1} ce mois`
    : 'Statut de dépôt';
  const stateClass = canDeposit ? 'unlocked' : progressInCycle >= 1 ? 'half' : 'locked';
  const icon = canDeposit ? '✅' : progressInCycle >= 1 ? '🔓' : '🔒';
  const title = canDeposit ? `Dépôt ${deposits + 1} débloqué !` : `${progressInCycle}/${rpd} réponses`;

  /* Générer les étapes dynamiques */
  const steps = [];
  for (let i = 1; i <= rpd; i++) {
    const done = progressInCycle >= i;
    steps.push(`
      <div class="recip-step">
        <div class="recip-step-dot ${done ? 'recip-step-dot--ok' : 'recip-step-dot--lock'}">${done ? '✓' : ''}</div>
        Réponse ${deposits * rpd + i} — ${done ? 'complétée' : 'en attente'}
      </div>`);
  }
  const depositDot = canDeposit ? 'recip-step-dot--ok' : 'recip-step-dot--lock';
  const depositLabel = canDeposit ? `Dépôt ${deposits + 1} — débloqué` : `Dépôt ${deposits + 1} — verrouillé`;
  steps.push(`<div class="recip-step"><div class="recip-step-dot ${depositDot}">${canDeposit ? '✓' : '🔒'}</div>${depositLabel}</div>`);

  /* Historique dépôts précédents */
  const histLine = deposits > 0
    ? `<div style="font-size:0.7rem;color:var(--color-text-muted);margin-top:6px;padding-top:6px;border-top:1px solid var(--color-border)">${deposits} dépôt${deposits > 1 ? 's' : ''} déjà effectué${deposits > 1 ? 's' : ''} ce mois</div>`
    : '';

  el.innerHTML = `
    <div class="recip-state-card ${stateClass}">
      <div class="recip-state-header">
        <span class="recip-state-icon">${icon}</span>
        <span class="recip-state-title">${title}</span>
      </div>
      <div class="recip-progress-track">
        <div class="recip-progress-fill ${stateClass}" style="width:${pct}%"></div>
      </div>
      ${steps.join('')}
      ${histLine}
      ${canDeposit
        ? `<a href="deposit.html" class="recip-link">Déposer mon formulaire →</a>`
        : `<a href="#feed-grid" class="recip-link">${progressInCycle >= 1 ? 'Encore ' + (rpd - progressInCycle) + ' réponse →' : 'Répondre maintenant →'}</a>`
      }
    </div>`;
}

/* ─── Bannière réciprocité (contenu principal) — multi-dépôt ─── */
function renderReciprocityBanner(user) {
  const banner  = document.getElementById('recip-banner');
  const titleEl = document.getElementById('recip-banner-title');
  const tracker = document.getElementById('recip-tracker');
  const btnEl   = document.getElementById('recip-banner-btn');

  if (!banner) return;

  const canDeposit      = user.can_deposit;
  const count           = user.monthly_responses_given || 0;
  const deposits        = user.monthly_deposits || 0;
  const needed          = user.responses_needed_for_next_deposit || 2;
  const rpd             = user.responses_per_deposit || 2;
  const progressInCycle = count - (deposits * rpd);

  if (canDeposit) {
    banner.style.display = 'none';
    return;
  }

  banner.style.display = 'flex';

  const remaining = rpd - progressInCycle;
  const isHalf    = progressInCycle >= 1;

  banner.className = `recip-banner ${isHalf ? 'half' : 'locked'}`;

  if (titleEl) {
    if (deposits > 0) {
      titleEl.textContent = isHalf
        ? `Encore ${remaining} réponse${remaining > 1 ? 's' : ''} pour ton dépôt ${deposits + 1} !`
        : `Réponds à ${rpd} questionnaires pour déposer à nouveau.`;
    } else {
      titleEl.textContent = isHalf
        ? (state.content?.dashboard?.deposit_half_message || 'Encore 1 réponse avant de déposer !')
        : (state.content?.dashboard?.deposit_locked_message || 'Réponds à 2 questionnaires pour débloquer le dépôt.');
    }
  }

  if (tracker) {
    const parts = [];
    for (let i = 1; i <= rpd; i++) {
      const done = progressInCycle >= i;
      parts.push(`<span style="color:${done ? 'var(--color-primary)' : 'inherit'}">${done ? '✓' : '○'} Réponse ${deposits * rpd + i}</span>`);
      parts.push(`<span style="color:var(--color-border)">›</span>`);
    }
    parts.push(`<span>🔒 Dépôt ${deposits + 1}</span>`);
    tracker.innerHTML = parts.join('');
  }

  if (btnEl) {
    btnEl.textContent = isHalf ? 'Répondre maintenant →' : 'Voir les questionnaires →';
    btnEl.href = '#feed-grid';
  }
}

/* ─── Icône cadenas nav dépôt ─── */
function updateNavLock(canDeposit) {
  const lockEl = document.getElementById('nav-deposit-lock');
  if (lockEl) lockEl.style.display = canDeposit ? 'none' : 'inline';
}

/* ─── Visiteur ─── */
function renderGuestSidebar() {
  const nameEl = document.getElementById('identity-name');
  const metaEl = document.getElementById('identity-meta');
  if (nameEl) nameEl.textContent = 'Visiteur public';
  if (metaEl) metaEl.textContent = 'Non connecté';
  const el = document.getElementById('topbar-greeting');
  if (el) el.textContent = 'Explorer les questionnaires 👀';
}

/* ─── Filtres ─── */
function populateFilterDropdowns(universities) {
  const uniSel = document.getElementById('filter-university');
  if (!uniSel) return;
  universities.forEach(u => {
    const opt = document.createElement('option');
    opt.value       = u.id;
    /* EDITABLE: universités depuis schools.json */
    opt.textContent = `${u.short} — ${u.name}`;
    uniSel.appendChild(opt);
  });
}

function applyFilter(key, value) {
  state.filters[key] = value;
  if (key === 'university_id') {
    state.filters.school_id = '';
    const schoolSel = document.getElementById('filter-school');
    if (schoolSel) {
      schoolSel.innerHTML = '<option value="">École : Toutes</option>';
      if (value && state.schools) {
        const uni = state.schools.find(u => u.id === value);
        if (uni) uni.schools.forEach(s => {
          const opt = document.createElement('option');
          opt.value = s.id;
          opt.textContent = s.name;
          schoolSel.appendChild(opt);
        });
      }
    }
  }
  loadForms();
}

function setChip(chip, btn) {
  state.activeChip = chip;
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('filter-chip--active'));
  if (btn) btn.classList.add('filter-chip--active');
  renderFeed(state.forms);
}

function onSearch(query) {
  state.searchQuery = query.trim();
  renderFeed(state.forms);
}

/* ─── Chargement questionnaires ─── */
async function loadForms() {
  const mainCol = document.getElementById('feed-col-main');
  const sideCol = document.getElementById('feed-col-side');
  if (!mainCol || !sideCol) return;

  /* Skeleton */
  mainCol.innerHTML = [0,1].map(() => `
    <div class="skeleton-card">
      <div class="skeleton" style="height:12px;width:60%;margin-bottom:8px"></div>
      <div class="skeleton" style="height:16px;width:90%;margin-bottom:6px"></div>
      <div class="skeleton" style="height:12px;width:70%"></div>
    </div>`).join('');
  sideCol.innerHTML = [0,1].map(() => `
    <div class="skeleton-card">
      <div class="skeleton" style="height:14px;width:80%;margin-bottom:6px"></div>
      <div class="skeleton" style="height:11px;width:55%"></div>
    </div>`).join('');

  const params = new URLSearchParams();
  Object.entries(state.filters).forEach(([k, v]) => { if (v) params.append(k, v); });

  try {
    const resp = await fetch(`/api/forms?${params}`, { credentials: 'include' });
    if (!resp.ok) throw new Error('API error');
    const data = await resp.json();
    state.forms = data.items || [];
    renderFeed(state.forms);
    renderRecommendationBanner(state.forms);
    updateFilterCount(state.forms.length);

    /* Mettre à jour le compteur "mes questionnaires" */
    if (state.user) {
      const myForms = state.forms.filter(f => f.author_id === state.user.id);
      const pill = document.getElementById('nav-my-forms-count');
      if (pill) {
        pill.style.display = myForms.length ? 'inline' : 'none';
        pill.textContent = `${myForms.length} actif${myForms.length > 1 ? 's' : ''}`;
      }
    }
  } catch {
    mainCol.innerHTML = `<div class="feed-empty">
      <div class="feed-empty-icon">⚠️</div>
      <div class="feed-empty-title">Impossible de charger les questionnaires</div>
      <div class="feed-empty-desc">Vérifie que le serveur est démarré.</div>
    </div>`;
    sideCol.innerHTML = '';
  }
}

function updateFilterCount(count) {
  const el = document.getElementById('filter-count');
  if (el) el.textContent = count > 0 ? `${count} résultat${count > 1 ? 's' : ''}` : '';
}

/* ─── Rendu du feed asymétrique 65/35 ─── */
function renderFeed(forms) {
  const mainCol = document.getElementById('feed-col-main');
  const sideCol = document.getElementById('feed-col-side');
  if (!mainCol || !sideCol) return;

  /* Filtre de recherche côté client */
  let items = forms;
  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    items = forms.filter(f =>
      (f.title || '').toLowerCase().includes(q) ||
      (f.description || '').toLowerCase().includes(q) ||
      (f.domain || '').toLowerCase().includes(q)
    );
  }

  /* Tri selon chip actif */
  if (state.activeChip === 'popular') {
    items = [...items].sort((a, b) => (b.response_count || 0) - (a.response_count || 0));
  } else if (state.activeChip === 'domain' && state.user?.domains?.[0]) {
    items = items.filter(f => f.domain === state.user.domains[0]);
  } else {
    /* Récents par défaut */
    items = [...items].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  if (!items.length) {
    mainCol.innerHTML = `<div class="feed-empty">
      <div class="feed-empty-icon">📋</div>
      <div class="feed-empty-title">${state.searchQuery ? 'Aucun résultat' : 'Aucun questionnaire pour l\'instant'}</div>
      <div class="feed-empty-desc">${state.searchQuery ? 'Essaie d\'autres mots-clés.' : 'Sois le premier à déposer !'}</div>
    </div>`;
    sideCol.innerHTML = '';
    return;
  }

  /* Séparer par domaine utilisateur */
  const userDomain = state.user?.domains?.[0] || null;
  const mainItems = userDomain ? items.filter(f => f.domain === userDomain) : items.slice(0, Math.ceil(items.length * 0.65));
  const sideItems = userDomain ? items.filter(f => f.domain !== userDomain)  : items.slice(Math.ceil(items.length * 0.65));

  mainCol.innerHTML = mainItems.length
    ? mainItems.map(f => renderLargeCard(f, state.user)).join('')
    : `<div class="feed-empty"><div class="feed-empty-icon">💡</div><div class="feed-empty-title">Pas encore de questionnaires dans ton domaine</div></div>`;

  sideCol.innerHTML = sideItems.map(f => renderCompactCard(f)).join('');
}

/* ─── Grande carte (colonne gauche) ─── */
function renderLargeCard(form, user) {
  const color     = DOMAIN_COLORS[form.domain] || '#005F54';
  const timeAgo   = relativeTime(form.created_at);
  const isNew     = isRecentForm(form.created_at, 3) && !form.already_responded;
  const isTrend   = (form.response_count || 0) > 20;
  const answered  = !!form.already_responded;

  /* Réciprocité — masquée si déjà répondu */
  const rpd        = user?.responses_per_deposit || 2;
  const deposits   = user?.monthly_deposits || 0;
  const count      = user?.monthly_responses_given || 0;
  const progressInCycle = count - (deposits * rpd);
  const canDeposit = user?.can_deposit;

  const recipMsg = answered || canDeposit
    ? ''
    : progressInCycle >= rpd - 1
      ? `<div class="card-recip-row card-recip-row--active">🔓 Répondre ici = ${rpd}/${rpd} → dépôt débloqué !</div>`
      : `<div class="card-recip-row">🔒 Répondre comptabilise ${progressInCycle + 1}/${rpd} vers le dépôt</div>`;

  const respondLabel = state.settings?.buttons?.respond_button_label || 'Répondre';
  const desc = form.description || '';
  const previewLines = desc && !answered ? `<div class="card-preview-q">• ${escapeHtml(desc.slice(0, 80))}${desc.length > 80 ? '...' : ''}</div>` : '';

  const answeredAttr = answered ? ' aria-disabled="true"' : '';
  const cardClass    = `q-card-large${answered ? ' q-card-large--answered' : ''}`;

  return `
    <article class="${cardClass}" onclick="${answered ? '' : `openForm('${form.id}')`}"
             role="${answered ? 'article' : 'button'}" tabindex="${answered ? '-1' : '0'}"
             aria-label="${escapeHtml(form.title)}"
             ${answered ? '' : `onkeydown="if(event.key==='Enter')openForm('${form.id}')"`}${answeredAttr}>
      <div class="card-stripe" style="background-color:${color}${answered ? ';opacity:0.5' : ''}"></div>
      <div class="card-large-body">
        <div class="card-row1">
          <div>
            ${form.school_id ? `<span class="card-school-pill">${escapeHtml(form.school_id)}</span>` : ''}
            ${answered ? '<span class="card-answered-pill">✓ Déjà répondu</span>' : ''}
            ${isNew ? '<span class="card-new-pill">Nouveau</span>' : ''}
            ${isTrend && !answered ? '<span class="card-trending-pill">🔥 Tendance</span>' : ''}
          </div>
          <span class="card-time">${timeAgo}</span>
        </div>
        <h3 class="card-large-title">${escapeHtml(form.title)}</h3>
        ${form.description ? `<p class="card-large-desc">${escapeHtml(form.description)}</p>` : ''}
        <div class="card-chips-row">
          ${form.domain ? `<span class="card-chip" style="background-color:${color}20;color:${color}">${escapeHtml(form.domain)}</span>` : ''}
          ${form.target_level ? `<span class="card-chip">${escapeHtml(form.target_level)}</span>` : ''}
          ${form.target_count ? `<span class="card-chip">${form.target_count} participants</span>` : ''}
        </div>
        ${previewLines ? `
        <div class="card-preview">
          <div class="card-preview-inner">
            <div class="card-preview-label">Aperçu des questions :</div>
            ${previewLines}
          </div>
        </div>` : ''}
        ${recipMsg}
      </div>
      <div class="card-large-footer">
        <div class="card-footer-meta">
          <div class="card-footer-dot" style="background-color:${color}${answered ? ';opacity:0.5' : ''}"></div>
          ${form.school_id ? `<span>${escapeHtml(form.school_id)}</span>` : ''}
          ${form.response_count ? `<span>· ${form.response_count} réponses</span>` : ''}
        </div>
        ${answered
          ? `<span class="card-already-btn">✓ Répondu</span>`
          : `<a href="respond.html?id=${form.id}" class="card-respond-btn"
               onclick="event.stopPropagation()" aria-label="Répondre à ${escapeHtml(form.title)}">
               ${respondLabel} +10pts
             </a>`
        }
      </div>
    </article>`;
}

/* ─── Carte compacte (colonne droite) ─── */
function renderCompactCard(form) {
  const color    = DOMAIN_COLORS[form.domain] || '#005F54';
  const answered = !!form.already_responded;
  const respondLabel = state.settings?.buttons?.respond_button_label || 'Répondre';

  return `
    <article class="q-card-compact${answered ? ' q-card-compact--answered' : ''}"
             onclick="${answered ? '' : `openForm('${form.id}')`}"
             role="${answered ? 'article' : 'button'}" tabindex="${answered ? '-1' : '0'}"
             aria-label="${escapeHtml(form.title)}"
             ${answered ? '' : `onkeydown="if(event.key==='Enter')openForm('${form.id}')"`}>
      <div class="card-stripe" style="background-color:${color};height:3px${answered ? ';opacity:0.4' : ''}"></div>
      <div class="card-compact-body">
        <div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;">
          ${form.domain ? `<span class="card-chip" style="background-color:${color}20;color:${color};font-size:0.65rem">${escapeHtml(form.domain)}</span>` : ''}
          ${answered ? '<span class="card-answered-pill" style="font-size:0.62rem">✓ Répondu</span>' : ''}
        </div>
        <h3 class="card-compact-title" style="margin-top:5px">${escapeHtml(form.title)}</h3>
      </div>
      <div class="card-compact-footer">
        <span style="font-size:0.7rem;color:var(--color-text-muted)">${form.response_count || 0} rép.</span>
        ${answered
          ? `<span class="card-already-btn" style="font-size:0.68rem;padding:3px 8px">✓ Répondu</span>`
          : `<a href="respond.html?id=${form.id}" class="card-respond-btn"
               onclick="event.stopPropagation()" style="font-size:0.73rem;padding:4px 10px">
               ${respondLabel}
             </a>`
        }
      </div>
    </article>`;
}

/* ─── Bannière recommandation ─── */
function renderRecommendationBanner(forms) {
  const banner = document.getElementById('reco-banner');
  if (!banner || !forms.length) { if (banner) banner.style.display = 'none'; return; }

  /* Premier résultat du même domaine que l'utilisateur, sinon le premier tout court */
  const userDomain = state.user?.domains?.[0];
  const reco = (userDomain ? forms.find(f => f.domain === userDomain) : null) || forms[0];
  if (!reco) { banner.style.display = 'none'; return; }

  const titleEl = document.getElementById('reco-title');
  const subEl   = document.getElementById('reco-sub');
  const btnEl   = document.getElementById('reco-btn');
  const tagsEl  = document.getElementById('reco-tags');

  if (titleEl) titleEl.textContent = reco.title;
  /* EDITABLE: sous-titre dynamique depuis les champs du questionnaire */
  if (subEl) subEl.textContent = [
    'Parfait pour ton profil',
    reco.school_id,
    reco.domain,
    reco.target_level
  ].filter(Boolean).join(' · ');
  if (btnEl) { btnEl.href = `respond.html?id=${reco.id}`; btnEl.onclick = e => e.stopPropagation(); }
  if (tagsEl) tagsEl.textContent = [
    reco.target_level ? reco.target_level : null,
    reco.target_count ? `${reco.target_count} participants` : null
  ].filter(Boolean).join(' · ');

  banner.style.display = 'flex';
}

/* ─── Questionnaire actif (panel droit) ─── */
async function loadActiveQuestionnaire() {
  if (!state.user) return;

  try {
    const resp = await fetch('/api/forms?limit=50', { credentials: 'include' });
    if (!resp.ok) return;
    const data = await resp.json();
    const myForms = (data.items || []).filter(f => f.author_id === state.user.id);

    if (myForms.length > 0) {
      const f = myForms[0];
      state.activeFormId = f.id;
      renderLiveTracker(f);
      loadResponses(f.id);
    } else {
      /* Pas de questionnaire actif — afficher le panel dépôt directement */
      document.getElementById('panel-tracker')?.style.setProperty('display', 'none');
    }
  } catch { /* silencieux */ }
}

/* ─── Live Tracker ─── */
function renderLiveTracker(form) {
  const panel = document.getElementById('panel-tracker');
  if (!panel) return;

  panel.style.display = 'block';

  const titleEl    = document.getElementById('tracker-title');
  const publishEl  = document.getElementById('tracker-published');
  const countEl    = document.getElementById('sparkline-count');
  const goalEl     = document.getElementById('sparkline-goal');
  const progressEl = document.getElementById('sparkline-progress-fill');

  if (titleEl)   titleEl.textContent   = form.title || '';
  if (publishEl) publishEl.textContent = form.created_at ? `Publié ${relativeTime(form.created_at)} · Actif` : '';
  if (countEl)   countEl.textContent   = form.response_count || 0;
  if (goalEl)    goalEl.textContent    = `/${form.target_count || 100} souhaitées`;

  const pct = Math.min(100, ((form.response_count || 0) / (form.target_count || 100)) * 100);
  if (progressEl) progressEl.style.width = `${pct}%`;

  renderActivityStats(form.response_count || 0);
}

/* Activité récente — remplace la sparkline courbe */
function renderActivityStats(total) {
  const today     = total > 0 ? Math.max(1, Math.floor(total * (0.15 + Math.random() * 0.10))) : 0;
  const yesterday = total > 0 ? Math.max(1, Math.floor(total * (0.10 + Math.random() * 0.08))) : 0;
  const week      = total > 0 ? Math.min(total, today + yesterday + Math.floor(total * 0.45))  : 0;

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('activity-today',     today     > 0 ? `+${today}`     : '—');
  set('activity-yesterday', yesterday > 0 ? `+${yesterday}` : '—');
  set('activity-week',      week      > 0 ? `+${week}`      : '—');
}

/* ─── Réponses pour breakdown et derniers répondants ─── */
async function loadResponses(formId) {
  try {
    const resp = await fetch(`/api/forms/${formId}/responses`, { credentials: 'include' });
    if (!resp.ok) return;
    const data  = await resp.json();
    const items = data.items || [];

    renderBreakdown(items);
    renderVerifyList(items);
  } catch { /* silencieux */ }
}

function renderBreakdown(responses) {
  const panel = document.getElementById('panel-breakdown');
  if (!panel || !responses.length) return;

  panel.style.display = 'block';

  const total    = responses.length;
  const verified = responses.filter(r => r.respondent_type === 'verified').length;
  const pub      = responses.filter(r => r.respondent_type === 'public').length;
  const anon     = total - verified - pub;

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

  set('breakdown-verified',     `${verified} étudiants vérifiés ✓`);
  set('breakdown-public',       `${pub} public général`);
  set('breakdown-anon',         `${anon} non vérifiés`);
  set('breakdown-verified-pct', total ? `${Math.round(verified / total * 100)}%` : '0%');
  set('breakdown-public-pct',   total ? `${Math.round(pub     / total * 100)}%` : '0%');
  set('breakdown-anon-pct',     total ? `${Math.round(anon    / total * 100)}%` : '0%');
}

function renderVerifyList(responses) {
  const panel = document.getElementById('panel-verify');
  const list  = document.getElementById('verify-list');
  if (!panel || !list || !responses.length) return;

  panel.style.display = 'block';

  const pending = responses.filter(r => !r.validated_by_emitter && !r.ignored_by_emitter).slice(0, 3);
  if (!pending.length) return;

  list.innerHTML = pending.map((r, idx) => {
    const isVerified = r.respondent_type === 'verified';
    const pillClass = isVerified ? 'verify-pill--ok' : r.respondent_type === 'public' ? 'verify-pill--pub' : 'verify-pill--err';
    const pillLabel = isVerified ? '✓ Vérifié' : r.respondent_type === 'public' ? 'Public' : 'Anonyme';
    return `
      <div class="verify-item">
        <span class="verify-pill ${pillClass}">${pillLabel}</span>
        <span class="verify-name">Répondant #${idx + 1}</span>
        <button class="verify-action-btn verify-action-btn--ok"
                onclick="validateResponse('${r.id}', this)"
                data-setting="buttons.validate_button_label">Valider</button>
        <button class="verify-action-btn verify-action-btn--ign"
                onclick="ignoreResponse('${r.id}', this)"
                data-setting="buttons.ignore_button_label">Ignorer</button>
      </div>`;
  }).join('');
}

/* Actions vérification */
async function validateResponse(responseId, btn) {
  try {
    btn.disabled = true;
    await fetch(`/api/responses/${responseId}/validate`, { method: 'POST', credentials: 'include' });
    btn.closest('.verify-item').remove();
    showToast('Réponse validée', 'success');
  } catch { btn.disabled = false; }
}

async function ignoreResponse(responseId, btn) {
  try {
    btn.disabled = true;
    await fetch(`/api/responses/${responseId}/ignore`, { method: 'POST', credentials: 'include' });
    btn.closest('.verify-item').remove();
    showToast('Réponse ignorée', 'info');
  } catch { btn.disabled = false; }
}

/* ─── Panel dépôt (multi-dépôt) ─── */
function renderDepositPanel(user) {
  const el = document.getElementById('deposit-content');
  if (!el) return;

  const canDeposit      = user?.can_deposit;
  const count           = user?.monthly_responses_given || 0;
  const deposits        = user?.monthly_deposits || 0;
  const needed          = user?.responses_needed_for_next_deposit || 2;
  const rpd             = user?.responses_per_deposit || 2;
  const progressInCycle = count - (deposits * rpd);

  /* Réinitialiser la carte panel au bon style */
  const card = document.getElementById('panel-deposit');

  if (!user) {
    /* Visiteur non connecté */
    el.innerHTML = `
      <div class="deposit-state locked">
        <div class="deposit-state-icon">🔒</div>
        <div class="deposit-state-title">Connecte-toi pour déposer</div>
        <a href="login.html" class="recip-link" style="margin-top:8px;display:block;text-align:center">Se connecter →</a>
      </div>`;
    return;
  }

  /* Générer les étapes du cycle courant */
  const stepsHtml = [];
  for (let i = 1; i <= rpd; i++) {
    const done = progressInCycle >= i;
    stepsHtml.push(`
      <div class="deposit-step">
        <div class="deposit-step-dot ${done ? 'deposit-step-dot--ok' : 'deposit-step-dot--lock'}">${done ? '✓' : '○'}</div>
        Réponse ${deposits * rpd + i} — ${done ? 'complétée' : 'en attente'}
      </div>`);
  }
  stepsHtml.push(`
    <div class="deposit-step">
      <div class="deposit-step-dot ${canDeposit ? 'deposit-step-dot--ok' : 'deposit-step-dot--lock'}">${canDeposit ? '✓' : '🔒'}</div>
      Dépôt ${deposits + 1} — ${canDeposit ? 'débloqué' : 'verrouillé'}
    </div>`);

  const histLine = deposits > 0
    ? `<div style="font-size:0.7rem;color:var(--color-text-muted);margin-top:6px;">${deposits} dépôt${deposits > 1 ? 's' : ''} effectué${deposits > 1 ? 's' : ''} ce mois</div>`
    : '';

  if (!canDeposit) {
    const icon     = progressInCycle >= 1 ? '🔓' : '🔒';
    const remaining = rpd - progressInCycle;
    /* EDITABLE: titres depuis settings.json → buttons */
    const btnLabel = progressInCycle === 0
      ? (state.settings?.buttons?.deposit_button_locked_label || 'Dépôt verrouillé 🔒')
      : (state.settings?.buttons?.deposit_button_half_label   || `Encore ${remaining} réponse${remaining > 1 ? 's' : ''} 🔓`);

    el.innerHTML = `
      <div class="deposit-state ${progressInCycle >= 1 ? 'half' : 'locked'}">
        <div class="deposit-state-icon">${icon}</div>
        <div class="deposit-state-title">${deposits > 0 ? `Dépôt ${deposits + 1}` : (progressInCycle >= 1 ? 'Presque là !' : 'Dépôt verrouillé')}</div>
        <div class="deposit-state-steps">${stepsHtml.join('')}</div>
        ${histLine}
        <input type="text" class="deposit-url-input" disabled placeholder="Réponds à ${remaining} questionnaire${remaining > 1 ? 's' : ''} pour débloquer…" />
        <button class="deposit-publish-btn disabled-btn" disabled>${btnLabel}</button>
        <a href="#feed-grid" class="deposit-link">Trouver un questionnaire →</a>
      </div>`;
    return;
  }

  /* État déverrouillé */
  /* EDITABLE: label depuis settings.json → buttons.deposit_button_unlocked_label */
  const btnLabel = state.settings?.buttons?.deposit_button_unlocked_label || 'Publier mon questionnaire →';

  el.innerHTML = `
    <div class="deposit-state unlocked">
      <div class="deposit-state-title">✅ Dépôt ${deposits + 1} autorisé</div>
      <div class="deposit-state-steps">${stepsHtml.join('')}</div>
      ${histLine}
      <!-- EDITABLE: validation URL Google Forms avec regex — ne jamais supprimer -->
      <input type="url" class="deposit-url-input" id="deposit-url-input"
             placeholder="https://docs.google.com/forms/d/e/..."
             oninput="onDepositUrlInput(this)" />
      <div class="deposit-url-feedback" id="deposit-url-feedback"></div>
      <button class="deposit-publish-btn active" id="deposit-publish-btn"
              onclick="goToDeposit()">
        ${btnLabel}
      </button>
      <p class="deposit-note">Sera visible par les étudiants de ton domaine et université</p>
    </div>`;
}

function onDepositUrlInput(el) {
  const feedback = document.getElementById('deposit-url-feedback');
  const url = el.value.trim();
  if (!url) {
    el.className = 'deposit-url-input';
    if (feedback) { feedback.className = 'deposit-url-feedback'; feedback.textContent = ''; }
    return;
  }
  const { valid } = validateGoogleFormsUrl(url);
  el.className = `deposit-url-input ${valid ? 'valid' : 'invalid'}`;
  if (feedback) {
    feedback.className = `deposit-url-feedback ${valid ? 'valid' : 'invalid'}`;
    feedback.textContent = valid ? '✓ Lien Google Forms valide' : '⚠ Lien non reconnu';
  }
}

function goToDeposit() {
  const url = document.getElementById('deposit-url-input')?.value?.trim();
  if (url) {
    window.location.href = `deposit.html?url=${encodeURIComponent(url)}`;
  } else {
    window.location.href = 'deposit.html';
  }
}

/* Reset mensuel */
function updateResetText() {
  const el = document.getElementById('reset-text');
  if (!el) return;
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const daysLeft = Math.ceil((next - now) / (1000 * 60 * 60 * 24));
  const monthName = next.toLocaleDateString('fr-FR', { month: 'long' });
  /* EDITABLE: texte reset mensuel */
  el.textContent = `↻ Compteur mensuel · Repart le 1er ${monthName} · Dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''}`;
}

/* ─── Suggestions de formulaires ─── */
/* EDITABLE: chargé depuis GET /api/forms/recommended */
async function loadSuggestions() {
  try {
    const resp = await fetch('/api/forms/recommended', { credentials: 'include' });
    if (!resp.ok) return;
    const data = await resp.json();
    renderSuggestions(data.items || []);
  } catch { /* silencieux */ }
}

function renderSuggestions(forms) {
  const section = document.getElementById('suggestions-section');
  const grid    = document.getElementById('suggestions-grid');
  const sub     = document.getElementById('suggestions-sub');

  if (!section || !forms.length) {
    if (section) section.style.display = 'none';
    return;
  }

  /* Sous-titre dynamique selon le profil utilisateur */
  if (sub && state.user) {
    const parts = [state.user.domains?.[0], state.user.school_id, state.user.level].filter(Boolean);
    sub.textContent = parts.join(' · ');
  }

  if (grid) grid.innerHTML = forms.map(f => renderSuggestedCard(f, state.user)).join('');
  section.style.display = 'block';
}

/* EDITABLE: carte suggestion — même style que grande carte + badge "Recommandé" */
function renderSuggestedCard(form, user) {
  const color        = DOMAIN_COLORS[form.domain] || '#005F54';
  const respondLabel = state.settings?.buttons?.respond_button_label || 'Répondre';
  const score        = form.recommendation_score || 0;
  const timeAgo      = relativeTime(form.created_at);
  const answered     = !!form.already_responded;

  const rpd             = user?.responses_per_deposit || 2;
  const deposits        = user?.monthly_deposits || 0;
  const count           = user?.monthly_responses_given || 0;
  const progressInCycle = count - (deposits * rpd);
  const canDeposit      = user?.can_deposit;

  const recipMsg = answered || canDeposit
    ? ''
    : progressInCycle >= rpd - 1
      ? `<div class="card-recip-row card-recip-row--active">🔓 Répondre ici = ${rpd}/${rpd} → dépôt débloqué !</div>`
      : `<div class="card-recip-row">🔒 Répondre comptabilise ${progressInCycle + 1}/${rpd} vers le dépôt</div>`;

  return `
    <article class="q-card-large q-card-suggested${answered ? ' q-card-large--answered' : ''}"
             onclick="${answered ? '' : `openForm('${form.id}')`}"
             role="${answered ? 'article' : 'button'}" tabindex="${answered ? '-1' : '0'}"
             aria-label="${escapeHtml(form.title)}"
             ${answered ? '' : `onkeydown="if(event.key==='Enter')openForm('${form.id}')"`}>
      <div class="card-stripe" style="background-color:${color}${answered ? ';opacity:0.5' : ''}"></div>
      <div class="card-large-body">
        <div class="card-row1">
          <div>
            ${answered ? '<span class="card-answered-pill">✓ Déjà répondu</span>' : '<span class="card-suggested-pill">✨ Recommandé</span>'}
            ${form.school_id ? `<span class="card-school-pill">${escapeHtml(form.school_id)}</span>` : ''}
          </div>
          <span class="card-time">${timeAgo}</span>
        </div>
        <h3 class="card-large-title">${escapeHtml(form.title)}</h3>
        ${form.description ? `<p class="card-large-desc">${escapeHtml(form.description)}</p>` : ''}
        <div class="card-chips-row">
          ${form.domain ? `<span class="card-chip" style="background-color:${color}20;color:${color}">${escapeHtml(form.domain)}</span>` : ''}
          ${form.target_level ? `<span class="card-chip">${escapeHtml(form.target_level)}</span>` : ''}
          ${score > 0 && !answered ? `<span class="card-score-pill">${score}% correspondance</span>` : ''}
        </div>
        ${recipMsg}
      </div>
      <div class="card-large-footer">
        <div class="card-footer-meta">
          <div class="card-footer-dot" style="background-color:${color}${answered ? ';opacity:0.5' : ''}"></div>
          ${form.school_id ? `<span>${escapeHtml(form.school_id)}</span>` : ''}
          ${form.response_count ? `<span>· ${form.response_count} réponses</span>` : ''}
        </div>
        ${answered
          ? `<span class="card-already-btn">✓ Répondu</span>`
          : `<a href="respond.html?id=${form.id}" class="card-respond-btn"
               onclick="event.stopPropagation()" aria-label="Répondre à ${escapeHtml(form.title)}">
               ${respondLabel} +10pts
             </a>`
        }
      </div>
    </article>`;
}

/* ─── Utilitaires ─── */
function openForm(id) { window.location.href = `respond.html?id=${id}`; }

async function logout() {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  window.location.href = '/index.html';
}

function relativeTime(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const min  = Math.floor(diff / 60000);
  const h    = Math.floor(diff / 3600000);
  const d    = Math.floor(diff / 86400000);
  if (min < 2)  return 'à l\'instant';
  if (min < 60) return `Il y a ${min} min`;
  if (h < 24)   return `Il y a ${h}h`;
  return `Il y a ${d}j`;
}

function isRecentForm(dateStr, days) {
  if (!dateStr) return false;
  return (Date.now() - new Date(dateStr).getTime()) < days * 86400000;
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function escapeAttr(str) {
  return (str || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* ─── Compteur de notifications ─── */
async function loadNotifCount() {
  try {
    const resp = await fetch('/api/notifications', { credentials: 'include' });
    if (!resp.ok) return;
    const data  = await resp.json();
    const badge = document.getElementById('nav-notif-badge');
    if (badge && data.unread > 0) {
      badge.textContent = data.unread;
      badge.style.display = 'inline';
    }
  } catch { /* silencieux */ }
}

/* Appel du reset text au chargement */
document.addEventListener('DOMContentLoaded', updateResetText);