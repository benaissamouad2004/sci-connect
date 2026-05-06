/* ═══════════════════════════════════════════════════════════
   SCICONNECT — deposit.js
   Page de dépôt de questionnaire
   ═══════════════════════════════════════════════════════════ */

/* EDITABLE: regex validation URL Google Forms — accepte /d/e/, /d/, et forms.gle */
const GOOGLE_FORMS_REGEX = /(?:docs\.google\.com\/forms\/d\/(?:e\/)?|forms\.gle\/)([^/?&#\s]+)/;

/* EDITABLE: couleurs par domaine — doit rester synchronisé avec dashboard.js */
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

/* EDITABLE: audiences estimées selon le ciblage sélectionné */
const AUDIENCE_ESTIMATES = {
  all:        '1 247',
  university: '680',
  school:     '340',
  public:     '∞',
};

/* ─── État global ─── */
const depState = {
  user:         null,
  content:      null,
  settings:     null,
  formValid:    false,
  tags:         [],
  selectedLevel:'Tous niveaux',
  targeting:    'all',
  urlDebounce:  null,
};

/* ─── Initialisation ─── */
document.addEventListener('DOMContentLoaded', async () => {
  /* EDITABLE: loadContent() charge content.json + settings.json */
  const loaded = await loadContent();
  if (loaded) {
    depState.content  = loaded.content;
    depState.settings = loaded.settings;
  }

  applySettingsLabels();
  updateMonthlyCard();

  /* Vérifier la session */
  const me = await fetch('/api/auth/me', { credentials: 'include' })
                    .then(r => r.json()).catch(() => null);

  if (!me || !me.authenticated) {
    window.location.replace('login.html');
    return;
  }

  depState.user = me.user;

  /* Populate topbar user info */
  renderTopbarUser(me.user);
  renderDepositStatus(me.user);

  /* Pré-remplir depuis l'URL si fournie (depuis deposit-url-input du dashboard) */
  const params = new URLSearchParams(window.location.search);
  const preUrl = params.get('url');
  if (preUrl) {
    const input = document.getElementById('dep-url-input');
    if (input) { input.value = preUrl; onUrlInput(preUrl); }
  }

  /* Initialiser la preview */
  updatePreview();
});

/* ─── Topbar user rendering ─── */
function renderTopbarUser(user) {
  const avatarEl = document.getElementById('dep-topbar-avatar');
  const nameEl   = document.getElementById('dep-topbar-name');

  if (avatarEl) {
    if (user.avatar_url) {
      avatarEl.innerHTML = `<img src="${escapeAttr(user.avatar_url)}" alt="${escapeAttr(user.name || '')}" loading="lazy">`;
    } else {
      avatarEl.textContent = (user.name || 'U')[0].toUpperCase();
    }
  }
  if (nameEl) nameEl.textContent = user.name || user.email || '';
}

/* ─── Déconnexion ─── */
function logout() {
  fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
  localStorage.removeItem('sc_user_cache');
  window.location.href = 'login.html';
}

/* ─── Labels depuis settings.json ─── */
function applySettingsLabels() {
  const label = depState.settings?.buttons?.deposit_button_unlocked_label
    || 'Publier mon questionnaire →';
  const el = document.getElementById('dep-publish-label');
  if (el) el.textContent = label;

  const respondLabel = depState.settings?.buttons?.respond_button_label || 'Répondre';
  const prevBtn = document.getElementById('prev-btn');
  if (prevBtn) prevBtn.textContent = `${respondLabel} +10pts`;
}

/* ─── Rappel mensuel ─── */
function updateMonthlyCard() {
  const el = document.getElementById('dep-monthly-text');
  if (!el) return;
  const now  = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const mois = ['janvier','février','mars','avril','mai','juin',
                 'juillet','août','septembre','octobre','novembre','décembre'];
  /* EDITABLE: texte rappel mensuel */
  el.textContent = `Le 1er ${mois[next.getMonth()]} ${next.getFullYear()}, ton compteur repart à 0/2.`;
}

/* ─── Carte identité sidebar ─── */
function renderSidebarIdentity(user) {
  const avatarEl = document.getElementById('identity-avatar');
  const nameEl   = document.getElementById('identity-name');
  const metaEl   = document.getElementById('identity-meta');
  const ptsEl    = document.getElementById('identity-pts');
  const fillEl   = document.getElementById('ring-fill');
  const textEl   = document.getElementById('ring-badge-text');

  if (avatarEl) {
    if (user.avatar_url) {
      avatarEl.innerHTML = `<img src="${escapeAttr(user.avatar_url)}" alt="${escapeAttr(user.name || '')}" loading="lazy">`;
    } else {
      avatarEl.textContent = (user.name || 'U')[0].toUpperCase();
    }
  }
  if (nameEl) nameEl.textContent = user.name || user.email || '';
  if (metaEl) metaEl.textContent = [user.school_id, user.level].filter(Boolean).join(' · ');
  if (ptsEl)  ptsEl.textContent  = `★ ${user.points || 0} pts`;

  /* Circular progress ring */
  if (fillEl) {
    const pcts = { novice: 20, contributor: 40, expert: 70, master: 100 };
    const pct  = pcts[user.badge_level] || 20;
    const circumference = 2 * Math.PI * 22;
    fillEl.style.strokeDashoffset = circumference * (1 - pct / 100);
  }
  if (textEl) {
    const icons = { novice: '⭐', contributor: '🎯', expert: '🏆', master: '👑' };
    textEl.textContent = icons[user.badge_level] || '⭐';
  }
}

/* ─── Widget réciprocité sidebar — multi-dépôt ─── */
function renderSidebarReciprocity(user) {
  const el = document.getElementById('sidebar-recip-content');
  if (!el) return;

  const count           = user.monthly_responses_given || 0;
  const deposits        = user.monthly_deposits || 0;
  const rpd             = user.responses_per_deposit || 2;
  const canDeposit      = user.can_deposit;
  const progressInCycle = count - (deposits * rpd);
  const pct             = Math.min(100, Math.round((progressInCycle / rpd) * 100));

  const stateClass = canDeposit ? 'unlocked' : progressInCycle >= 1 ? 'half' : 'locked';
  const icon = canDeposit ? '✅' : progressInCycle >= 1 ? '🔓' : '🔒';
  const title = canDeposit
    ? `Dépôt ${deposits + 1} débloqué !`
    : `${progressInCycle}/${rpd} réponses`;

  const steps = [];
  for (let i = 1; i <= rpd; i++) {
    const done = progressInCycle >= i;
    steps.push(`
      <div class="recip-step">
        <div class="recip-step-dot ${done ? 'recip-step-dot--ok' : 'recip-step-dot--lock'}">${done ? '✓' : ''}</div>
        Réponse ${deposits * rpd + i} — ${done ? 'complétée' : 'en attente'}
      </div>`);
  }
  steps.push(`
    <div class="recip-step">
      <div class="recip-step-dot ${canDeposit ? 'recip-step-dot--ok' : 'recip-step-dot--lock'}">${canDeposit ? '✓' : '🔒'}</div>
      Dépôt ${deposits + 1} — ${canDeposit ? 'débloqué' : 'verrouillé'}
    </div>`);

  const histLine = deposits > 0
    ? `<div style="font-size:0.7rem;color:var(--color-text-muted);margin-top:6px;padding-top:6px;border-top:1px solid var(--color-border)">${deposits} dépôt${deposits > 1 ? 's' : ''} ce mois</div>`
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
      ${!canDeposit ? `<a href="dashboard.html#feed-grid" class="recip-link">Répondre maintenant →</a>` : ''}
    </div>`;
}

/* ─── État de dépôt (header badge + cartes unlock/locked) — multi-dépôt ─── */
function renderDepositStatus(user) {
  const count           = user.monthly_responses_given || 0;
  const deposits        = user.monthly_deposits || 0;
  const rpd             = user.responses_per_deposit || 2;
  const canDeposit      = user.can_deposit;
  const progressInCycle = count - (deposits * rpd);
  const remaining       = rpd - progressInCycle;

  const statusBadge = document.getElementById('dep-status-badge');
  const statusText  = document.getElementById('dep-status-text');
  const unlockCard  = document.getElementById('dep-unlock-card');
  const lockedCard  = document.getElementById('dep-locked-card');
  const publishBtn  = document.getElementById('dep-publish-btn');

  /* Badge état */
  if (statusBadge && statusText) {
    if (canDeposit) {
      statusBadge.className = 'dep-status-badge unlocked';
      statusText.textContent = deposits > 0 ? `Dépôt ${deposits + 1} autorisé ✓` : 'Dépôt autorisé ✓';
    } else if (progressInCycle >= 1) {
      statusBadge.className = 'dep-status-badge half';
      statusText.textContent = `${progressInCycle}/${rpd} réponses`;
    } else {
      statusBadge.className = 'dep-status-badge locked';
      statusText.textContent = deposits > 0 ? `Dépôt ${deposits + 1} verrouillé 🔒` : 'Dépôt verrouillé 🔒';
    }
  }

  if (canDeposit) {
    /* Carte unlock : afficher le numéro de dépôt et l'historique */
    if (unlockCard) {
      unlockCard.style.display = 'flex';
      const sub      = document.getElementById('dep-unlock-sub');
      const right    = document.getElementById('dep-unlock-right');
      const cycleRow = document.getElementById('dep-cycle-progress');
      const barFill  = document.getElementById('dep-cycle-bar-fill');
      const cycleLabel = document.getElementById('dep-cycle-label');
      const mois = ['janvier','février','mars','avril','mai','juin',
                    'juillet','août','septembre','octobre','novembre','décembre'];
      const next = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1);

      if (sub) sub.textContent = deposits > 0
        ? `Dépôt ${deposits + 1} débloqué ce mois · Renouvellement le 1er ${mois[next.getMonth()]}.`
        : `Tu peux déposer 1 questionnaire ce mois. Renouvellement le 1er ${mois[next.getMonth()]}.`;

      if (right) right.textContent = deposits > 0
        ? `${deposits} dépôt${deposits > 1 ? 's' : ''} effectué${deposits > 1 ? 's' : ''} ce mois`
        : (user.is_founder && count < rpd ? '⭐ Fondateur — 1 dépôt gratuit' : '');

      /* Barre de progression vers le dépôt suivant (si des dépôts existent déjà) */
      if (cycleRow && deposits >= 0 && count >= rpd) {
        const pctNextCycle = Math.min(100, Math.round((progressInCycle / rpd) * 100));
        cycleRow.style.display = 'flex';
        if (barFill) barFill.style.width = `${pctNextCycle}%`;
        if (cycleLabel) cycleLabel.textContent = `${progressInCycle}/${rpd} réponses vers dépôt ${deposits + 2}`;
      }
    }
    if (lockedCard) lockedCard.style.display = 'none';
  } else {
    /* Carte locked : message adapté au cycle courant */
    if (lockedCard) {
      lockedCard.style.display = 'flex';
      const titleEl = document.getElementById('dep-locked-title');
      const subEl   = document.getElementById('dep-locked-sub');
      if (titleEl) titleEl.textContent = progressInCycle >= 1
        ? `Encore ${remaining} réponse${remaining > 1 ? 's' : ''} pour débloquer`
        : (deposits > 0 ? `Dépôt ${deposits + 1} verrouillé` : (depState.content?.dashboard?.deposit_locked_message || 'Dépôt verrouillé'));
      if (subEl) subEl.textContent = deposits > 0
        ? `${progressInCycle}/${rpd} réponses depuis ton dernier dépôt.`
        : (progressInCycle >= 1 ? `${progressInCycle} réponse donnée sur ${rpd} requises.` : `Réponds à ${rpd} questionnaires pour débloquer.`);
    }
    if (unlockCard) unlockCard.style.display = 'none';
    /* Désactiver le bouton publier et tous les champs */
    if (publishBtn) {
      publishBtn.disabled = true;
      const labelEl = document.getElementById('dep-publish-label');
      if (labelEl) labelEl.textContent = progressInCycle >= 1
        ? (depState.settings?.buttons?.deposit_button_half_label || `Encore ${remaining} réponse${remaining > 1 ? 's' : ''} 🔓`)
        : (depState.settings?.buttons?.deposit_button_locked_label || 'Dépôt verrouillé 🔒');
    }
    _disableDepositForm(true);
  }
}

/* ─── Désactivation complète de tous les champs du formulaire ─── */
function _disableDepositForm(disabled) {
  const ids = [
    'dep-url-input', 'dep-title', 'dep-desc', 'dep-domain',
    'dep-duration', 'dep-questions', 'dep-tags-input',
    'dep-target-count', 'dep-deadline',
  ];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = disabled;
  });
  document.querySelectorAll('.dep-chip, .dep-target-card input[type="radio"]').forEach(el => {
    el.disabled = disabled;
  });
}

/* ─── Validation URL Google Forms ─── */
/* EDITABLE: délai de validation 400ms après dernière frappe */
function onUrlInput(value) {
  clearTimeout(depState.urlDebounce);
  const wrap     = document.getElementById('dep-url-wrap');
  const feedback = document.getElementById('dep-url-feedback');
  const success  = document.getElementById('dep-url-success');
  const meta     = document.getElementById('dep-url-success-meta');

  if (!value.trim()) {
    if (wrap)     { wrap.className = 'dep-url-wrap'; }
    if (feedback) { feedback.className = 'dep-url-feedback'; feedback.textContent = ''; }
    if (success)  success.style.display = 'none';
    depState.formValid = false;
    updateStepIndicator(1);
    return;
  }

  /* État "scan" pendant la frappe */
  if (wrap)     wrap.className = 'dep-url-wrap';
  if (feedback) { feedback.className = 'dep-url-feedback scanning'; feedback.textContent = 'Vérification du lien...'; }

  depState.urlDebounce = setTimeout(() => {
    const match = value.match(GOOGLE_FORMS_REGEX);
    if (match) {
      if (wrap)     wrap.className = 'dep-url-wrap valid';
      if (feedback) { feedback.className = 'dep-url-feedback valid'; feedback.textContent = '✓ Lien Google Forms reconnu'; }
      if (success)  success.style.display = 'block';
      if (meta)     meta.textContent = `ID formulaire : ${match[1].slice(0, 40)}${match[1].length > 40 ? '...' : ''}`;
      depState.formValid = true;
      updateStepIndicator(2);
    } else {
      if (wrap)     wrap.className = 'dep-url-wrap invalid';
      if (feedback) { feedback.className = 'dep-url-feedback invalid'; feedback.textContent = '⚠ Lien non reconnu — utilise un lien docs.google.com/forms/...'; }
      if (success)  success.style.display = 'none';
      depState.formValid = false;
      updateStepIndicator(1);
    }
  }, 400);
}

/* ─── Mise à jour de l'indicateur d'étapes ─── */
function updateStepIndicator(activeStep) {
  [1, 2, 3].forEach(n => {
    const el = document.getElementById(`step-ind-${n}`);
    if (!el) return;
    el.className = n < activeStep
      ? 'dep-step-item dep-step-item--done'
      : n === activeStep
        ? 'dep-step-item dep-step-item--active'
        : 'dep-step-item';
  });
}

/* ─── Compteur de caractères description ─── */
function onDescInput(el) {
  const count = document.getElementById('dep-desc-count');
  if (count) count.textContent = el.value.length;
  updatePreview();
}

/* ─── Chips de niveau — multi-sélection ─── */
function toggleChip(btn, group) {
  if (group === 'level') {
    /* Désélectionner tous, sélectionner celui cliqué */
    document.querySelectorAll('#dep-level-chips .dep-chip').forEach(c => {
      c.classList.remove('dep-chip--active');
    });
    btn.classList.add('dep-chip--active');
    depState.selectedLevel = btn.dataset.value;
    updatePreview();
  }
}

/* ─── Tags — ajout par touche Entrée ─── */
function onTagKeydown(event) {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  const input = event.target;
  const value = input.value.trim();
  if (!value || depState.tags.includes(value) || depState.tags.length >= 8) return;
  depState.tags.push(value);
  input.value = '';
  renderTags();
}

function removeTag(value) {
  depState.tags = depState.tags.filter(t => t !== value);
  renderTags();
}

function renderTags() {
  const list = document.getElementById('dep-tags-list');
  if (!list) return;
  list.innerHTML = depState.tags.map(t => `
    <span class="dep-tag">
      ${escapeHtml(t)}
      <button class="dep-tag-remove" onclick="removeTag('${escapeAttr(t)}')"
              aria-label="Supprimer le tag ${escapeAttr(t)}">&times;</button>
    </span>`).join('');
}

/* ─── Ciblage — radio cards ─── */
function onTargetChange(value) {
  depState.targeting = value;

  /* Mettre à jour le style des cartes */
  ['all', 'uni', 'school', 'public'].forEach(key => {
    const card = document.getElementById(`target-${key}`);
    if (card) card.classList.remove('dep-target-card--selected');
  });
  const selected = document.getElementById(`target-${value === 'university' ? 'uni' : value}`);
  if (selected) selected.classList.add('dep-target-card--selected');

  /* Mettre à jour le compteur audience */
  const countEl = document.getElementById('dep-audience-count');
  /* EDITABLE: audiences depuis AUDIENCE_ESTIMATES */
  if (countEl) countEl.textContent = AUDIENCE_ESTIMATES[value] || '—';
}

/* ─── Mise à jour de la carte preview en temps réel ─── */
function updatePreview() {
  const title    = (document.getElementById('dep-title')?.value || '').trim();
  const desc     = (document.getElementById('dep-desc')?.value || '').trim();
  const domain   = document.getElementById('dep-domain')?.value || '';
  const duration = document.getElementById('dep-duration')?.value || '';
  const questions= document.getElementById('dep-questions')?.value || '';
  const color    = DOMAIN_COLORS[domain] || 'var(--color-primary)';

  /* Stripe de couleur domaine */
  const stripe = document.getElementById('prev-stripe');
  if (stripe) stripe.style.backgroundColor = color;

  /* Titre */
  const titleEl = document.getElementById('prev-title');
  if (titleEl) {
    if (title) {
      titleEl.textContent = title;
      titleEl.classList.remove('placeholder');
    } else {
      titleEl.textContent = 'Titre de ton questionnaire...';
      titleEl.classList.add('placeholder');
    }
  }

  /* Description */
  const descEl = document.getElementById('prev-desc');
  if (descEl) descEl.textContent = desc ? desc.slice(0, 100) + (desc.length > 100 ? '...' : '') : '';

  /* École depuis l'utilisateur */
  const schoolEl = document.getElementById('prev-school');
  if (schoolEl) schoolEl.textContent = depState.user?.school_id || '';

  /* Chips */
  const chipsEl = document.getElementById('prev-chips');
  if (chipsEl) {
    const chips = [];
    if (domain) chips.push(`<span class="dep-preview-chip" style="background-color:${color}20;color:${color}">${escapeHtml(domain)}</span>`);
    if (depState.selectedLevel && depState.selectedLevel !== 'Tous niveaux') {
      chips.push(`<span class="dep-preview-chip">${escapeHtml(depState.selectedLevel)}</span>`);
    }
    if (duration) chips.push(`<span class="dep-preview-chip">~${duration} min</span>`);
    if (questions) chips.push(`<span class="dep-preview-chip">${questions} questions</span>`);
    chipsEl.innerHTML = chips.join('');
  }

  /* Meta footer */
  const metaEl = document.getElementById('prev-meta');
  if (metaEl) {
    const metaParts = [depState.user?.school_id].filter(Boolean);
    metaEl.textContent = metaParts.join(' · ');
  }

  /* Nombre de réponses objectif */
  const target = parseInt(document.getElementById('dep-target-count')?.value) || 100;
}

/* ─── Publication du formulaire ─── */
async function publishForm() {
  const user = depState.user;
  if (!user) { window.location.href = 'login.html'; return; }

  /* Vérification stricte de l'éligibilité — indépendante de l'état du bouton */
  if (!user.can_deposit) {
    const rpd             = user.responses_per_deposit || 2;
    const deposits        = user.monthly_deposits || 0;
    const progressInCycle = (user.monthly_responses_given || 0) - (deposits * rpd);
    const remaining       = rpd - progressInCycle;
    const errorEl         = document.getElementById('dep-form-error');
    showError(errorEl,
      `Dépôt bloqué : réponds à ${remaining} questionnaire${remaining > 1 ? 's' : ''} supplémentaire${remaining > 1 ? 's' : ''} pour déposer le questionnaire ${deposits + 1}.`
    );
    return;
  }

  const url       = document.getElementById('dep-url-input')?.value?.trim() || '';
  const title     = document.getElementById('dep-title')?.value?.trim() || '';
  const desc      = document.getElementById('dep-desc')?.value?.trim() || '';
  const domain    = document.getElementById('dep-domain')?.value || '';
  const target    = parseInt(document.getElementById('dep-target-count')?.value) || 100;

  /* Validation côté client */
  const errorEl = document.getElementById('dep-form-error');

  if (!url) {
    showError(errorEl, 'Le lien Google Forms est requis.');
    return;
  }
  if (!GOOGLE_FORMS_REGEX.test(url)) {
    showError(errorEl, 'Le lien Google Forms n\'est pas reconnu. Vérifie l\'URL.');
    return;
  }
  if (!title) {
    showError(errorEl, 'Le titre de la recherche est requis.');
    document.getElementById('dep-title')?.focus();
    return;
  }
  if (!domain) {
    showError(errorEl, 'Sélectionne un domaine principal.');
    return;
  }

  /* Masquer erreur précédente */
  if (errorEl) errorEl.style.display = 'none';

  /* État chargement */
  const btn      = document.getElementById('dep-publish-btn');
  const labelEl  = document.getElementById('dep-publish-label');
  if (btn)     btn.disabled = true;
  if (labelEl) labelEl.textContent = 'Publication en cours...';

  try {
    const resp = await fetch('/api/forms', {
      method:      'POST',
      credentials: 'include',
      headers:     { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        google_forms_url: url,
        title,
        description:   desc,
        domain,
        target_level:  depState.selectedLevel || 'Tous niveaux',
        target_count:  target,
      }),
    });

    if (resp.status === 403) {
      const data = await resp.json();
      showError(errorEl, `Dépôt non autorisé : tu as répondu à ${data.monthly_responses_given || 0}/2 questionnaires ce mois.`);
      return;
    }

    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}));
      showError(errorEl, data.error || 'Une erreur est survenue. Réessaie.');
      return;
    }

    const data = await resp.json();
    /* Email de confirmation envoyé automatiquement par le backend (email_service.py) */
    showToast('Questionnaire publié avec succès ! 🎉', 'success');

    /* EDITABLE: redirection vers stats après publication */
    setTimeout(() => {
      window.location.href = `stats.html?id=${data.questionnaire?.id || ''}`;
    }, 1500);

  } catch {
    showError(errorEl, 'Erreur réseau. Vérifie ta connexion et réessaie.');
  } finally {
    if (btn)     btn.disabled = false;
    if (labelEl) labelEl.textContent =
      depState.settings?.buttons?.deposit_button_unlocked_label || 'Publier mon questionnaire →';
  }
}

/* ─── Helpers ─── */
function showError(el, msg) {
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function showToast(msg, type = '') {
  const t = document.createElement('div');
  t.className = `dep-toast${type ? ' ' + type : ''}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

function escapeHtml(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function escapeAttr(str) {
  return (str || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

async function logout() {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  window.location.href = '/index.html';
}