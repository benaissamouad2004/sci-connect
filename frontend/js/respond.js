/* ═══════════════════════════════════════════════════════════
   SCICONNECT — respond.js V7 — CHECKBOX VALIDATION

   La détection de soumission via événements iframe (load events)
   est IMPOSSIBLE à fiabiliser pour les formulaires multi-sections :
   le bouton "Suivant" déclenche le même événement que la soumission
   finale (restriction cross-origin — on ne peut pas lire le contenu).

   Solution : confirmation explicite par case à cocher après 60s.
   L'utilisateur atteste avoir soumis le formulaire en entier.
   Le backend valide la durée minimale (>=30s).
   ═══════════════════════════════════════════════════════════ */

var DOMAIN_COLORS = {
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

/* EDITABLE: durée minimale en secondes avant que la case à cocher apparaisse */
var MIN_TIME_SECONDS = 60;

var rsp = {
  formId:        null,
  form:          null,
  user:          null,
  startTime:     null,
  timerInterval: null,
  confirmed:     false,
  btnReady:      false,
  timeReady:     false,
  checkboxReady: false,
};

/* ─── Boot ─── */
document.addEventListener('DOMContentLoaded', function() {
  var params = new URLSearchParams(window.location.search);
  rsp.formId = params.get('id');

  if (!rsp.formId) {
    showError('Lien invalide — aucun questionnaire specifie.');
    return;
  }

  fetch('/api/auth/me', { credentials: 'include' })
    .then(function(r) { return r.json(); })
    .then(function(me) {
      if (me && me.authenticated) rsp.user = me.user;
      loadForm();
    })
    .catch(function() { loadForm(); });
});

/* ─── Load form ─── */
function loadForm() {
  fetch('/api/forms/' + rsp.formId, { credentials: 'include' })
    .then(function(r) {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    })
    .then(function(form) {
      rsp.form      = form;
      rsp.startTime = Date.now();

      document.getElementById('rsp-loading').style.display = 'none';
      document.getElementById('rsp-layout').style.display  = 'grid';

      renderTitleCard();
      embedGoogleForm();
      startTimer();
      checkAlreadyResponded();
      setupMobileBar();
    })
    .catch(function() {
      showError('Impossible de charger le questionnaire. Verifie le lien.');
    });
}

/* ─── Title card ─── */
function renderTitleCard() {
  var f = rsp.form;
  document.getElementById('rsp-title').textContent = f.title || 'Sans titre';
  document.title = (f.title || 'Questionnaire') + ' — SciConnect';

  var desc = document.getElementById('rsp-desc');
  if (f.description) { desc.textContent = f.description; }
  else               { desc.style.display = 'none'; }

  var color = DOMAIN_COLORS[f.domain] || 'var(--color-primary)';
  document.getElementById('rsp-title-stripe').style.background = color;

  var chips = [f.domain, f.target_level].filter(Boolean);
  document.getElementById('rsp-title-chips').innerHTML =
    chips.map(function(c) { return '<span class="rsp-chip">' + esc(c) + '</span>'; }).join('');

  var metaParts = [];
  if (f.response_count !== undefined) metaParts.push(f.response_count + '/' + (f.target_count || 100) + ' reponses');
  if (f.school_id) metaParts.push(f.school_id.toUpperCase());
  document.getElementById('rsp-meta').textContent = metaParts.join(' · ');
  document.getElementById('rsp-pts-text').textContent = '+10 pts';
}

/* ─── Embed Google Form ───
   Note : On n'écoute plus les événements de chargement de l'iframe.
   La détection cross-origin est impossible — un bouton "Suivant" et
   une vraie soumission déclenchent le même événement.
   La validation passe par la case à cocher explicite (voir ci-dessous).
*/
function embedGoogleForm() {
  var url = rsp.form.google_forms_url;
  if (!url) { showError("Ce questionnaire n'a pas de lien Google Forms."); return; }

  var embedUrl = url;
  if (url.includes('docs.google.com/forms')) {
    embedUrl = url.replace(/\/viewform.*$/, '').replace(/\/$/, '') + '/viewform?embedded=true';
  }

  var iframe = document.getElementById('rsp-iframe');
  iframe.src = embedUrl;

  /* Marquer l'étape 1 comme terminée, étape 2 active */
  updateStep(1, 'completed');
  updateStep(2, 'active');
}

/* ─── Case à cocher — déclenchée quand l'utilisateur coche ─── */
function onCheckboxChange() {
  var cb = document.getElementById('rsp-checkbox');
  if (!cb) return;

  rsp.checkboxReady = cb.checked;

  if (rsp.checkboxReady) {
    updateStep(2, 'completed');
  } else {
    updateStep(2, 'active');
    /* Redésactiver le bouton si décochage */
    if (rsp.btnReady && !rsp.confirmed) {
      rsp.btnReady = false;
      var confirmBtn   = document.getElementById('rsp-confirm-btn');
      var confirmLabel = document.getElementById('rsp-confirm-label');
      var confirmIcon  = document.getElementById('rsp-confirm-icon');
      confirmBtn.disabled = true;
      confirmBtn.classList.remove('ready');
      confirmIcon.textContent = '⏳';
      confirmLabel.textContent = 'Coche la case ci-dessus pour confirmer';
      var mobileConfirm = document.getElementById('rsp-mobile-confirm');
      if (mobileConfirm) {
        mobileConfirm.disabled = true;
        mobileConfirm.classList.remove('ready');
        document.getElementById('rsp-mobile-label').textContent = '⏳ Coche la case...';
      }
    }
  }

  checkCanConfirm();
}

/* ─── Vérifier si toutes les conditions sont réunies ─── */
function checkCanConfirm() {
  if (rsp.confirmed || rsp.btnReady) return;

  /* Les DEUX conditions doivent être vraies */
  if (!rsp.timeReady)     return;  /* 60 secondes écoulées */
  if (!rsp.checkboxReady) return;  /* Case cochée par l'utilisateur */

  /* Toutes conditions remplies → activer le bouton */
  rsp.btnReady = true;
  updateStep(3, 'active');

  var confirmBtn   = document.getElementById('rsp-confirm-btn');
  var confirmLabel = document.getElementById('rsp-confirm-label');
  var confirmIcon  = document.getElementById('rsp-confirm-icon');
  var confirmHint  = document.getElementById('rsp-confirm-hint');
  var timerLabelEl = document.getElementById('rsp-timer-label');

  confirmBtn.disabled = false;
  confirmBtn.classList.add('ready');
  confirmIcon.textContent  = '✓';
  confirmLabel.textContent = 'Valider ma reponse';
  confirmHint.textContent  = 'Soumission confirmee — clique pour valider';
  timerLabelEl.textContent = '✓ Pret a valider';
  timerLabelEl.style.color = 'var(--color-primary)';

  var mobileConfirm = document.getElementById('rsp-mobile-confirm');
  var mobileLabel   = document.getElementById('rsp-mobile-label');
  if (mobileConfirm) {
    mobileConfirm.disabled = false;
    mobileConfirm.classList.add('ready');
    mobileLabel.textContent = '✓ Valider ma reponse';
  }

  document.getElementById('rsp-warning').style.display = 'none';
}

/* ─── Step indicator ─── */
function updateStep(num, state) {
  var step  = document.getElementById('rsp-step-' + num);
  var check = document.getElementById('rsp-check-' + num);
  if (!step) return;
  step.classList.remove('active', 'completed', 'done');
  if (state === 'completed') {
    step.classList.add('completed');
    if (check) check.textContent = '✓';
  } else if (state === 'active') {
    step.classList.add('active');
  }
}

/* ─── Timer ─── */
function startTimer() {
  var timerEl       = document.getElementById('rsp-timer');
  var timerLabelEl  = document.getElementById('rsp-timer-label');
  var progressBar   = document.getElementById('rsp-progress-bar');
  var confirmLabel  = document.getElementById('rsp-confirm-label');
  var mobileTimer   = document.getElementById('rsp-mobile-timer');
  var mobileLabel   = document.getElementById('rsp-mobile-label');

  rsp.timerInterval = setInterval(function() {
    var elapsed  = Math.floor((Date.now() - rsp.startTime) / 1000);
    var mins     = Math.floor(elapsed / 60);
    var secs     = elapsed % 60;
    var timeStr  = mins + ':' + String(secs).padStart(2, '0');

    timerEl.textContent = timeStr;
    if (mobileTimer) mobileTimer.textContent = timeStr;

    var progress = Math.min(100, Math.round((elapsed / MIN_TIME_SECONDS) * 100));
    progressBar.style.width = progress + '%';

    if (elapsed < MIN_TIME_SECONDS) {
      /* Compte à rebours */
      var remaining = MIN_TIME_SECONDS - elapsed;
      if (!rsp.confirmed && !rsp.btnReady) {
        confirmLabel.textContent = 'Remplis le formulaire... (' + remaining + 's)';
        if (mobileLabel) mobileLabel.textContent = '⏳ ' + remaining + 's restantes';
      }
    } else if (!rsp.timeReady) {
      /* 60s écoulées — afficher la case à cocher */
      rsp.timeReady = true;

      var checkSection = document.getElementById('rsp-check-section');
      if (checkSection) checkSection.style.display = 'block';

      timerLabelEl.textContent = 'Coche la case pour valider';
      timerLabelEl.style.color = 'var(--color-accent, #C9A84C)';

      if (!rsp.confirmed && !rsp.btnReady) {
        confirmLabel.textContent = 'Coche la case ci-dessus';
        if (mobileLabel) mobileLabel.textContent = '✓ Coche la case';
      }

      checkCanConfirm();
    }
  }, 1000);
}

/* ─── Mobile bar ─── */
function setupMobileBar() {
  var mobileBar = document.getElementById('rsp-mobile-bar');
  function update() { mobileBar.style.display = window.innerWidth <= 860 ? 'flex' : 'none'; }
  update();
  window.addEventListener('resize', update);
}

/* ─── Already responded ─── */
function checkAlreadyResponded() {
  if (!rsp.form.already_responded) return;
  document.getElementById('rsp-already-banner').style.display = 'flex';
}

/* ─── Confirm response ─── */
function confirmResponse() {
  if (rsp.confirmed) return;

  /* Vérification finale — durée minimale */
  var elapsed = Math.floor((Date.now() - rsp.startTime) / 1000);
  if (elapsed < MIN_TIME_SECONDS) {
    showWarning('Patiente encore ' + (MIN_TIME_SECONDS - elapsed) + ' secondes...');
    return;
  }

  /* Vérification finale — case cochée */
  var cb = document.getElementById('rsp-checkbox');
  if (!cb || !cb.checked) {
    showWarning('Coche la case pour confirmer que tu as soumis le formulaire Google Forms.');
    return;
  }

  rsp.confirmed = true;
  clearInterval(rsp.timerInterval);
  updateStep(3, 'completed');

  var confirmBtn = document.getElementById('rsp-confirm-btn');
  confirmBtn.disabled = true;
  confirmBtn.classList.remove('ready');
  confirmBtn.classList.add('loading');
  document.getElementById('rsp-confirm-icon').textContent  = '⏳';
  document.getElementById('rsp-confirm-label').textContent = 'Envoi en cours...';

  var mobileConfirm = document.getElementById('rsp-mobile-confirm');
  if (mobileConfirm) {
    mobileConfirm.disabled = true;
    mobileConfirm.classList.remove('ready');
    document.getElementById('rsp-mobile-label').textContent = '⏳ Envoi...';
  }

  var endTime  = Date.now();
  var duration = Math.floor((endTime - rsp.startTime) / 1000);

  fetch('/api/responses', {
    method:      'POST',
    credentials: 'include',
    headers:     { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      form_id:          rsp.formId,
      answers:          {},
      start_time:       rsp.startTime,
      end_time:         endTime,
      duration_seconds: duration,
    }),
  })
  .then(function(resp2) {
    if (resp2.ok) return resp2.json();
    return resp2.json().catch(function() { return {}; }).then(function(errData) {
      if (errData.already_responded) {
        showFailScreen("Tu as deja repondu. Les points ne sont comptes qu'une seule fois.");
        return null;
      }
      if (errData.error) { showFailScreen(errData.message || errData.error); return null; }
      return null;
    });
  })
  .then(function(result) {
    if (result === null || result === undefined) return;
    if (result.is_suspect) {
      showFailScreen("Reponse trop rapide. Reponds serieusement pour gagner des points.");
      return;
    }
    showSuccess(result);
  })
  .catch(function() {
    showSuccess(null);
  });
}

/* ─── Warning ─── */
function showWarning(msg) {
  var warning  = document.getElementById('rsp-warning');
  var warnText = document.getElementById('rsp-warning-text');
  if (warnText) warnText.textContent = msg;
  warning.style.display = 'flex';
  warning.style.animation = 'none';
  void warning.offsetWidth;
  warning.style.animation = 'rspShake 0.5s ease';
}

/* ─── Success ─── */
function showSuccess(result) {
  document.getElementById('rsp-layout').style.display         = 'none';
  document.getElementById('rsp-mobile-bar').style.display     = 'none';
  document.getElementById('rsp-success-overlay').style.display = 'flex';

  var ptsEarned = (result && result.points_earned) || 10;
  var totalPts  = (result && result.total_points)  || ((rsp.user && rsp.user.points) || 0) + ptsEarned;

  document.getElementById('rsp-success-pts').textContent       = '+' + ptsEarned + ' pts gagnes !';
  document.getElementById('rsp-success-total-val').textContent = totalPts;

  if (window.SciConnectAnimations) {
    var streakBonus = result && result.streak_bonus;
    if (streakBonus && result.streak_days) {
      window.SciConnectAnimations.showStreakAnimation(result.streak_days, 25);
      setTimeout(function() { window.SciConnectAnimations.showPointsAnimation(ptsEarned, totalPts, true); }, 4500);
    } else {
      window.SciConnectAnimations.showPointsAnimation(ptsEarned, totalPts, false);
    }
  }

  var MIN_DEPOT = 20;
  var pct       = Math.min(100, Math.round((totalPts / MIN_DEPOT) * 100));
  var unlocked  = totalPts >= MIN_DEPOT;

  setTimeout(function() { document.getElementById('rsp-unlock-fill').style.width = pct + '%'; }, 300);
  document.getElementById('rsp-unlock-status').textContent = unlocked ? '✓ Depot disponible !' : totalPts + ' / ' + MIN_DEPOT + ' pts';
  document.getElementById('rsp-unlock-status').style.color = unlocked ? 'var(--color-primary)' : '';
  document.getElementById('rsp-unlock-note').textContent   = unlocked
    ? 'Tu peux maintenant deposer ton questionnaire !'
    : 'Encore ' + (MIN_DEPOT - totalPts) + ' pts pour deverrouiller le depot.';

  if (!unlocked) {
    var depositBtn = document.getElementById('rsp-deposit-btn');
    depositBtn.style.opacity       = '0.5';
    depositBtn.style.pointerEvents = 'none';
  }
}

/* ─── Fail ─── */
function showFailScreen(message) {
  document.getElementById('rsp-layout').style.display        = 'none';
  document.getElementById('rsp-mobile-bar').style.display    = 'none';
  document.getElementById('rsp-fail-overlay').style.display  = 'flex';
  document.getElementById('rsp-fail-text').textContent       = message;
}

/* ─── Retry ─── */
function retryResponse() {
  rsp.confirmed     = false;
  rsp.btnReady      = false;
  rsp.timeReady     = false;
  rsp.checkboxReady = false;
  rsp.startTime     = Date.now();

  /* Décocher la case */
  var cb = document.getElementById('rsp-checkbox');
  if (cb) cb.checked = false;

  /* Cacher la case à cocher */
  var checkSection = document.getElementById('rsp-check-section');
  if (checkSection) checkSection.style.display = 'none';

  document.getElementById('rsp-fail-overlay').style.display = 'none';
  document.getElementById('rsp-layout').style.display       = 'grid';

  updateStep(1, 'completed');
  updateStep(2, 'active');
  updateStep(3, 'done');

  var confirmBtn = document.getElementById('rsp-confirm-btn');
  confirmBtn.disabled = true;
  confirmBtn.classList.remove('ready', 'loading');
  document.getElementById('rsp-confirm-icon').textContent  = '⏳';
  document.getElementById('rsp-confirm-label').textContent = 'Remplis et soumets le formulaire';
  document.getElementById('rsp-confirm-hint').textContent  = 'Coche la case ci-dessus apres avoir soumis le formulaire';
  document.getElementById('rsp-timer-label').textContent   = 'min. 60s requis';
  document.getElementById('rsp-timer-label').style.color   = '';
  document.getElementById('rsp-warning').style.display     = 'none';
  document.getElementById('rsp-progress-bar').style.width  = '0%';

  var mobileConfirm = document.getElementById('rsp-mobile-confirm');
  if (mobileConfirm) {
    mobileConfirm.disabled = true;
    mobileConfirm.classList.remove('ready');
    document.getElementById('rsp-mobile-label').textContent = '⏳ Remplis le formulaire...';
  }

  embedGoogleForm();
  setupMobileBar();
  startTimer();
}

/* ─── Error ─── */
function showError(msg) {
  document.getElementById('rsp-loading').style.display = 'none';
  document.getElementById('rsp-error').style.display   = 'flex';
  document.getElementById('rsp-error-msg').textContent = msg;
}

function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* ─── Wire up buttons ─── */
document.addEventListener('DOMContentLoaded', function() {
  var btn = document.getElementById('rsp-confirm-btn');
  if (btn) btn.addEventListener('click', confirmResponse);
  var mobileBtn = document.getElementById('rsp-mobile-confirm');
  if (mobileBtn) mobileBtn.addEventListener('click', confirmResponse);
});