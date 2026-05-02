/* ═══════════════════════════════════════════════════════════
   SCICONNECT — Page de réponse
   ═══════════════════════════════════════════════════════════ */

const respondState = {
  formId:        null,
  questionnaire: null,
  user:          null,
  isPublic:      false,
  submitted:     false,
  verifying:     false,
};

/* Timer d'activité sur le formulaire */
let _timerElapsed  = 0;
let _timerInterval = null;
let _minRespondSec = 90; /* EDITABLE: settings.json → features.min_respond_seconds */

/* ─── Initialisation ─── */
document.addEventListener('DOMContentLoaded', async () => {
  const loaded = await loadContent();
  if (loaded?.settings?.features?.min_respond_seconds) {
    _minRespondSec = loaded.settings.features.min_respond_seconds;
  }

  const params = new URLSearchParams(window.location.search);
  respondState.formId = params.get('id');

  if (!respondState.formId) {
    showError('Lien invalide. Aucun questionnaire spécifié.');
    return;
  }

  const me = await fetch('/api/auth/me', { credentials: 'include' })
                    .then(r => r.json()).catch(() => null);
  if (me && me.authenticated) {
    respondState.user     = me.user;
    respondState.isPublic = false;
  } else {
    respondState.isPublic = true;
  }

  await loadQuestionnaire();
});

/* ─── Chargement du questionnaire ─── */
async function loadQuestionnaire() {
  try {
    const resp = await fetch(`/api/forms/${respondState.formId}`, { credentials: 'include' });
    if (!resp.ok) {
      showError('Questionnaire introuvable ou désactivé.');
      return;
    }
    const q = await resp.json();
    respondState.questionnaire = q;
    renderQuestionnaire(q);
  } catch (err) {
    showError('Erreur réseau. Vérifie que le serveur est démarré.');
  }
}

/* ─── Rendu de la page questionnaire ─── */
function renderQuestionnaire(q) {
  const pct    = q.target_count > 0
    ? Math.min((q.response_count / q.target_count) * 100, 100)
    : 0;
  const pctStr = Math.round(pct) + '%';

  /* Titre dans la navbar */
  const navTitle = document.getElementById('nav-title');
  if (navTitle) navTitle.textContent = q.title || 'Questionnaire';

  /* Badge domaine */
  const tagEl = document.getElementById('rp-domain-tag');
  if (tagEl) tagEl.textContent = q.domain || 'Questionnaire';

  /* Infos principales */
  const titleEl = document.getElementById('q-title');
  const descEl  = document.getElementById('q-desc');
  const metaEl  = document.getElementById('q-meta');

  if (titleEl) titleEl.textContent = q.title || 'Questionnaire';
  if (descEl && q.description) {
    descEl.textContent   = q.description;
    descEl.style.display = 'block';
  }
  if (metaEl) {
    const parts = [];
    if (q.target_level) parts.push(q.target_level);
    if (q.author_name)  parts.push(`par ${q.author_name}`);
    if (q.school_id)    parts.push(q.school_id);
    metaEl.textContent = parts.join(' · ');
  }

  /* Progression collective */
  const fillEl  = document.getElementById('q-progress-fill');
  const lblEl   = document.getElementById('q-progress-label');
  const pctEl   = document.getElementById('q-progress-pct');
  const ifrFill = document.getElementById('iframe-progress-fill');

  if (fillEl)  fillEl.style.width  = pctStr;
  if (lblEl)   lblEl.textContent   = `${q.response_count} / ${q.target_count}`;
  if (pctEl)   pctEl.textContent   = pctStr;
  if (ifrFill) ifrFill.style.width = pctStr;

  /* Vérifier si déjà répondu (utilisateur connecté) */
  if (!respondState.isPublic && respondState.user) {
    checkAlreadyResponded();
  }

  /* Visiteur public */
  if (respondState.isPublic) {
    renderPublicBanner();
    return;
  }

  /* Charger le contenu du formulaire */
  if (q.is_demo) {
    renderDemoPlaceholder(q);
  } else {
    loadIframe(q.google_forms_url);
  }
}

/* ─── Placeholder questionnaire de démonstration ─── */
function renderDemoPlaceholder(q) {
  const container = document.getElementById('iframe-container');
  const loader    = document.getElementById('iframe-loader');

  if (loader)    loader.style.display = 'none';
  if (container) {
    container.innerHTML = `
      <div class="demo-placeholder">
        <div class="demo-placeholder-icon">📋</div>
        <div class="demo-placeholder-title">Questionnaire de démonstration</div>
        <p class="demo-placeholder-desc">
          Ce questionnaire fait partie des données de démonstration SciConnect.<br>
          Il te permet de tester la plateforme et de débloquer ton droit de dépôt.
        </p>
      </div>
    `;
  }

  /* Timer widget → mode démo */
  const timerEl  = document.getElementById('rp-timer');
  const labelEl  = document.getElementById('rp-timer-label');
  const statusEl = document.getElementById('rp-timer-status');
  const fillEl   = document.getElementById('rp-timer-fill');
  const elapsedEl = document.getElementById('rp-timer-elapsed');

  if (labelEl)   labelEl.textContent  = 'Mode démonstration';
  if (statusEl)  statusEl.textContent = 'Validation automatique — pas de formulaire à remplir.';
  if (fillEl)    fillEl.style.width   = '100%';
  if (elapsedEl) elapsedEl.textContent = '—';
  if (timerEl)   timerEl.classList.add('ready');

  enableSubmitButton(true);
}

/* ─── Chargement de l'iframe ─── */
function loadIframe(formUrl) {
  const container = document.getElementById('iframe-container');
  if (!container || !formUrl) return;

  /* EDITABLE: ne jamais supprimer embedded=true — requis pour l'iframe Google Forms */
  const embedUrl = formUrl.includes('?')
    ? formUrl + '&embedded=true'
    : formUrl + '?embedded=true';

  container.innerHTML = `
    <iframe
      src="${escapeAttr(embedUrl)}"
      id="forms-iframe"
      title="Questionnaire Google Forms"
      frameborder="0"
      marginheight="0"
      marginwidth="0"
      style="width:100%;height:100%;border:none;display:block;"
      onload="onIframeLoad()"
      aria-label="Formulaire Google Forms"
    >Chargement…</iframe>
  `;
}

function onIframeLoad() {
  const loader = document.getElementById('iframe-loader');
  if (loader) loader.style.display = 'none';

  /* Démarrer le timer uniquement pour les utilisateurs connectés, formulaires réels */
  if (!respondState.isPublic && !respondState.questionnaire?.is_demo) {
    startFormTimer();
  }
}

/* ─── Système de timer ─── */
function startFormTimer() {
  if (_timerInterval) return;
  _timerElapsed = 0;
  updateTimerDisplay();

  _timerInterval = setInterval(() => {
    _timerElapsed++;
    updateTimerDisplay();
    if (_timerElapsed >= _minRespondSec) {
      clearInterval(_timerInterval);
      _timerInterval = null;
      enableSubmitButton(false);
    }
  }, 1000);
}

function updateTimerDisplay() {
  const elapsedEl = document.getElementById('rp-timer-elapsed');
  const fillEl    = document.getElementById('rp-timer-fill');
  const statusEl  = document.getElementById('rp-timer-status');

  const pct     = Math.min((_timerElapsed / _minRespondSec) * 100, 100);
  const secs    = _timerElapsed % 60;
  const mins    = Math.floor(_timerElapsed / 60);
  const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${_timerElapsed}s`;

  if (elapsedEl) elapsedEl.textContent = timeStr;
  if (fillEl)    fillEl.style.width    = pct + '%';

  if (statusEl) {
    const remaining = Math.max(_minRespondSec - _timerElapsed, 0);
    if (remaining > 0) {
      const remStr = remaining >= 60
        ? `${Math.ceil(remaining / 60)}min`
        : `${remaining}s`;
      statusEl.textContent = `Encore ${remStr} sur le formulaire pour valider`;
    } else {
      statusEl.textContent = 'Temps minimum atteint — tu peux maintenant vérifier';
    }
  }
}

function enableSubmitButton(isDemo) {
  const btn      = document.getElementById('submit-btn');
  const btnText  = document.getElementById('submit-btn-text');
  const timerEl  = document.getElementById('rp-timer');
  const labelEl  = document.getElementById('rp-timer-label');
  const statusEl = document.getElementById('rp-timer-status');

  if (btn) {
    btn.disabled = false;
    const iconSpan = btn.querySelector('span:first-child');
    if (iconSpan) iconSpan.textContent = '✓';
  }
  if (btnText) {
    btnText.textContent = isDemo
      ? 'Valider (démonstration)'
      : 'J\'ai répondu — Vérifier ma réponse';
  }
  if (!isDemo && timerEl) {
    timerEl.classList.add('ready');
    if (labelEl)  labelEl.textContent  = 'Temps minimum atteint ✓';
    if (statusEl) statusEl.textContent = 'Tu peux maintenant vérifier ta réponse.';
  }
}

/* ─── Vérification déjà répondu ─── */
async function checkAlreadyResponded() {
  try {
    const resp = await fetch(`/api/forms/${respondState.formId}/responses`, { credentials: 'include' });
    if (!resp.ok) return;
    const data = await resp.json();
    const mine = (data.items || []).find(r =>
      r.respondent_email === respondState.user?.email && r.respondent_type === 'verified'
    );
    if (mine) showAlreadyResponded();
  } catch (err) { /* silencieux */ }
}

function showAlreadyResponded() {
  const banner  = document.getElementById('already-responded-banner');
  const btn     = document.getElementById('submit-btn');
  const btnText = document.getElementById('submit-btn-text');

  if (banner)  banner.style.display = 'flex';
  if (btn)     btn.disabled         = true;
  if (btnText) btnText.textContent  = 'Déjà répondu ce mois-ci';

  if (_timerInterval) {
    clearInterval(_timerInterval);
    _timerInterval = null;
  }
}

/* ─── Bannière visiteur public ─── */
function renderPublicBanner() {
  const banner = document.getElementById('public-banner');
  if (banner) banner.style.display = 'flex';

  /* Timer widget → mode public */
  const timerEl   = document.getElementById('rp-timer');
  const labelEl   = document.getElementById('rp-timer-label');
  const statusEl  = document.getElementById('rp-timer-status');
  const fillEl    = document.getElementById('rp-timer-fill');
  const elapsedEl = document.getElementById('rp-timer-elapsed');

  if (labelEl)   labelEl.textContent   = 'Visiteur public';
  if (statusEl)  statusEl.textContent  = 'Connecte-toi pour gagner des points de crédit.';
  if (fillEl)    fillEl.style.width    = '100%';
  if (elapsedEl) elapsedEl.textContent = '—';
  if (timerEl)   timerEl.classList.add('ready');

  enableSubmitButton(true);

  /* Charger tout de même le formulaire */
  const q = respondState.questionnaire;
  if (q?.is_demo) {
    renderDemoPlaceholder(q);
  } else if (q?.google_forms_url) {
    loadIframe(q.google_forms_url);
  }
}

/* ─── Soumission et vérification ─── */
async function onSubmitClicked() {
  if (respondState.submitted || respondState.verifying) return;

  const q      = respondState.questionnaire;
  const isDemo = q?.is_demo;

  /* Garde : timer non atteint pour les utilisateurs connectés sur formulaire réel */
  if (!isDemo && !respondState.isPublic && _timerElapsed < _minRespondSec) {
    showToast('Passe encore un peu de temps sur le formulaire avant de valider.', 'error');
    return;
  }

  respondState.verifying = true;

  const btn     = document.getElementById('submit-btn');
  const btnText = document.getElementById('submit-btn-text');

  if (isDemo) {
    if (btn)     btn.disabled        = true;
    if (btnText) btnText.textContent = 'Validation en cours...';
    showVerifyState('demo_loading');
    await new Promise(resolve => setTimeout(resolve, 3000));
  } else {
    if (btn)     btn.disabled        = true;
    if (btnText) btnText.textContent = 'Vérification en cours...';
    showVerifyState('loading');
  }

  try {
    const resp = await fetch('/api/responses/verify', {
      method:      'POST',
      headers:     { 'Content-Type': 'application/json' },
      credentials: 'include',
      body:        JSON.stringify({ form_id: respondState.formId }),
    });

    const data = await resp.json();

    if (!resp.ok) {
      if (resp.status === 409) {
        showVerifyState('already');
      } else if (resp.status === 403) {
        showVerifyState('author');
      } else {
        showVerifyState('error', data.message || data.error || 'Erreur inconnue.');
      }
      return;
    }

    if (data.verified || data.respondent_type === 'public') {
      respondState.submitted = true;
      if (data.respondent_type === 'public') {
        showVerifyState('public_success');
      } else {
        showVerifyState('success', data);
      }
    } else {
      showVerifyState('not_found', data.message);
    }

  } catch (err) {
    showVerifyState('error', 'Erreur réseau. Réessaie.');
  } finally {
    respondState.verifying = false;
    if (btn && !respondState.submitted) {
      btn.disabled = false;
      if (btnText) btnText.textContent = isDemo
        ? 'Valider (démonstration)'
        : 'J\'ai répondu — Vérifier ma réponse';
    }
  }
}

/* ─── États de vérification ─── */
function showVerifyState(state, data) {
  const el = document.getElementById('verify-result');
  if (!el) return;
  el.style.display = 'flex';

  const states = {
    loading: {
      icon: '⏳', cls: 'info',
      title: 'Vérification en cours…',
      body: 'On vérifie ta réponse dans Google Forms. Patiente quelques secondes.'
    },
    demo_loading: {
      icon: '🎓', cls: 'info',
      title: 'Questionnaire de démonstration — validation dans 3 secondes…',
      body: 'Les questionnaires de démonstration sont validés automatiquement pour te permettre de tester la plateforme.'
    },
    success: {
      icon: '✅', cls: 'success',
      title: `Réponse vérifiée ! +${data?.points_earned || 10} points`,
      body: `Tu as maintenant ${data?.monthly_count || 1}/2 réponse${(data?.monthly_count || 1) > 1 ? 's' : ''} ce mois-ci.
             ${(data?.monthly_count || 0) >= 2 ? '<strong>Le dépôt est maintenant déverrouillé !</strong>' : ''}`
    },
    public_success: {
      icon: '✅', cls: 'success',
      title: 'Réponse publique enregistrée',
      body: 'Connecte-toi pour gagner des points et débloquer le dépôt de tes propres questionnaires.'
    },
    not_found: {
      icon: '🔍', cls: 'warning',
      title: 'Réponse non trouvée',
      body: (typeof data === 'string' ? data : 'Soumets d\'abord le formulaire Google, puis clique sur Vérifier.') +
            '<br><small>L\'API Google met parfois 1-2 minutes à enregistrer la réponse.</small>'
    },
    already: {
      icon: '✓', cls: 'success',
      title: 'Tu as déjà répondu',
      body: 'Ta réponse à ce questionnaire a déjà été comptabilisée.'
    },
    author: {
      icon: '🚫', cls: 'error',
      title: 'Réponse impossible',
      body: 'Tu ne peux pas répondre à ton propre questionnaire.'
    },
    error: {
      icon: '⚠️', cls: 'error',
      title: 'Erreur',
      body: typeof data === 'string' ? data : 'Une erreur est survenue.'
    },
  };

  const s = states[state] || states.error;
  el.className = `verify-result verify-result--${s.cls}`;
  el.innerHTML = `
    <div class="verify-result-icon">${s.icon}</div>
    <div class="verify-result-body">
      <strong class="verify-result-title">${s.title}</strong>
      <p class="verify-result-desc">${s.body}</p>
      ${(state === 'success' || state === 'public_success') ? `<a href="dashboard.html" class="btn-primary" style="margin-top:12px;font-size:0.88rem">Retour au dashboard →</a>` : ''}
    </div>
  `;
}

/* ─── Affichage erreur globale ─── */
function showError(msg) {
  const main = document.getElementById('respond-main');
  if (main) main.innerHTML = `
    <div class="empty-state" style="padding:80px 24px;grid-column:1/-1">
      <span class="empty-state-icon">⚠️</span>
      <div class="empty-state-title">${msg}</div>
      <a href="dashboard.html" style="margin-top:16px;display:inline-block">← Retour au dashboard</a>
    </div>
  `;
}

function escapeAttr(str) {
  return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
