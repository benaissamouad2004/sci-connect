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
    window.location.href = 'login.html';
    return;
  }

  depState.user = me.user;
  renderSidebarIdentity(me.user);
  renderSidebarReciprocity(me.user.monthly_responses_given || 0);
  renderDepositStatus(me.user);

  /* Lien profil public dans la nav */
  const navProfile = document.getElementById('nav-profile');
  if (navProfile && me.user.slug) {
    navProfile.href = `/profil/${me.user.slug}`;
  }

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

/* ─── Widget réciprocité sidebar ─── */
/* EDITABLE: 3 états selon monthly_responses_given */
function renderSidebarReciprocity(count) {
  const el = document.getElementById('sidebar-recip-content');
  if (!el) return;

  if (count >= 2) {
    el.innerHTML = `
      <div class="recip-state-card unlocked">
        <div class="recip-state-header">
          <span class="recip-state-icon">✅</span>
          <span class="recip-state-title">Dépôt autorisé ✓</span>
        </div>
        <div class="recip-progress-track"><div class="recip-progress-fill unlocked" style="width:100%"></div></div>
        <div class="recip-steps">
          <div class="recip-step"><div class="recip-step-dot recip-step-dot--ok">✓</div>Réponse 1 — complétée</div>
          <div class="recip-step"><div class="recip-step-dot recip-step-dot--ok">✓</div>Réponse 2 — complétée</div>
          <div class="recip-step"><div class="recip-step-dot recip-step-dot--ok">✓</div>Dépôt — débloqué</div>
        </div>
      </div>`;
  } else if (count === 1) {
    el.innerHTML = `
      <div class="recip-state-card half">
        <div class="recip-state-header">
          <span class="recip-state-icon">🔓</span>
          <span class="recip-state-title">Presque là !</span>
        </div>
        <div class="recip-progress-track"><div class="recip-progress-fill half" style="width:50%"></div></div>
        <div class="recip-steps">
          <div class="recip-step"><div class="recip-step-dot recip-step-dot--ok">✓</div>Réponse 1 — complétée</div>
          <div class="recip-step"><div class="recip-step-dot recip-step-dot--half"></div>Réponse 2 — en attente</div>
          <div class="recip-step"><div class="recip-step-dot recip-step-dot--lock">🔒</div>Dépôt — bientôt</div>
        </div>
      </div>`;
  } else {
    el.innerHTML = `
      <div class="recip-state-card locked">
        <div class="recip-state-header">
          <span class="recip-state-icon">🔒</span>
          <span class="recip-state-title">Dépôt verrouillé</span>
        </div>
        <div class="recip-progress-track"><div class="recip-progress-fill locked" style="width:0%"></div></div>
        <div class="recip-steps">
          <div class="recip-step"><div class="recip-step-dot recip-step-dot--lock"></div>Réponse 1 — en attente</div>
          <div class="recip-step"><div class="recip-step-dot recip-step-dot--lock"></div>Réponse 2 — en attente</div>
          <div class="recip-step"><div class="recip-step-dot recip-step-dot--lock">🔒</div>Dépôt — verrouillé</div>
        </div>
        <a href="dashboard.html#feed-grid" class="recip-link">Répondre maintenant →</a>
      </div>`;
  }
}

/* ─── État de dépôt (header badge + cartes unlock/locked) ─── */
function renderDepositStatus(user) {
  const count      = user.monthly_responses_given || 0;
  const isFounder  = user.is_founder;
  const statusBadge = document.getElementById('dep-status-badge');
  const statusText  = document.getElementById('dep-status-text');
  const unlockCard  = document.getElementById('dep-unlock-card');
  const lockedCard  = document.getElementById('dep-locked-card');
  const publishBtn  = document.getElementById('dep-publish-btn');

  const canDeposit = count >= 2 || isFounder;

  /* Badge état */
  if (statusBadge && statusText) {
    if (canDeposit) {
      statusBadge.className = 'dep-status-badge unlocked';
      statusText.textContent = 'Dépôt autorisé ✓';
    } else if (count === 1) {
      statusBadge.className = 'dep-status-badge half';
      statusText.textContent = '1/2 réponses';
    } else {
      statusBadge.className = 'dep-status-badge locked';
      statusText.textContent = 'Dépôt verrouillé 🔒';
    }
  }

  if (canDeposit) {
    if (unlockCard) {
      unlockCard.style.display = 'flex';
      const sub   = document.getElementById('dep-unlock-sub');
      const right = document.getElementById('dep-unlock-right');
      const mois  = ['janvier','février','mars','avril','mai','juin',
                     'juillet','août','septembre','octobre','novembre','décembre'];
      const next  = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1);
      /* EDITABLE: message unlock — calcul du reset */
      if (sub)   sub.textContent   = `Tu peux déposer 1 questionnaire ce mois. Renouvellement le 1er ${mois[next.getMonth()]}.`;
      if (right) right.textContent = isFounder && count < 2 ? '⭐ Fondateur — 1 dépôt gratuit' : '';
    }
    if (lockedCard) lockedCard.style.display = 'none';
  } else {
    if (lockedCard) {
      lockedCard.style.display = 'flex';
      const titleEl = document.getElementById('dep-locked-title');
      const subEl   = document.getElementById('dep-locked-sub');
      /* EDITABLE: messages locked depuis content.json */
      if (titleEl) titleEl.textContent = count === 1
        ? (depState.content?.dashboard?.deposit_half_message || 'Encore 1 réponse avant de déposer !')
        : (depState.content?.dashboard?.deposit_locked_message || 'Dépôt verrouillé');
      if (subEl) subEl.textContent = count === 1
        ? '1 réponse donnée sur 2 requises.'
        : 'Réponds à 2 questionnaires pour débloquer.';
    }
    if (unlockCard) unlockCard.style.display = 'none';
    /* Désactiver le bouton publier si dépôt interdit */
    if (publishBtn) {
      publishBtn.disabled = true;
      const labelEl = document.getElementById('dep-publish-label');
      if (labelEl) labelEl.textContent = count === 1
        ? (depState.settings?.buttons?.deposit_button_half_label   || 'Presque là... (1/2) 🔓')
        : (depState.settings?.buttons?.deposit_button_locked_label || 'Dépôt verrouillé 🔒');
    }
  }
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