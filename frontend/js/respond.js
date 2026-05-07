/* ═══════════════════════════════════════════════════════════
   SCICONNECT — respond.js V6 — STRICT VALIDATION
   
   The confirm button activates ONLY when:
   1. The Google Form was ACTUALLY SUBMITTED (iframe navigated
      to the "Your response has been recorded" page)
   2. Minimum time elapsed (60 seconds)
   
   NO FALLBACK — user MUST submit the Google Form.
   If they don't submit, the button stays permanently locked.
   
   How detection works:
   - iframe load #1 = Google Form page loaded
   - iframe load #2+ = Form submitted → confirmation page shown
   - We wait 3 seconds after last load to confirm it's final
     (handles multi-section forms where "Next" triggers loads)
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

var MIN_TIME_SECONDS = 60;

var rsp = {
  formId:              null,
  form:                null,
  user:                null,
  startTime:           null,
  timerInterval:       null,
  confirmed:           false,
  btnReady:            false,
  iframeLoadCount:     0,
  formSubmitted:       false,
  timeReady:           false,
  submitCheckTimeout:  null,
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
      rsp.form = form;
      rsp.startTime = Date.now();

      document.getElementById('rsp-loading').style.display = 'none';
      document.getElementById('rsp-layout').style.display = 'grid';

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
  else { desc.style.display = 'none'; }

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

/* ═══════════════════════════════════════════════════════
   EMBED + STRICT SUBMISSION DETECTION
   
   When the user submits a Google Form, the iframe navigates
   from the form page to the confirmation page. This triggers
   a new 'load' event. 
   
   For multi-section forms, "Next" also triggers loads.
   We use a 3-second debounce: after each load #2+, we wait
   3 seconds. If no more loads happen, it's the final submit.
   ═══════════════════════════════════════════════════════ */
function embedGoogleForm() {
  var url = rsp.form.google_forms_url;
  if (!url) { showError("Ce questionnaire n'a pas de lien Google Forms."); return; }

  var embedUrl = url;
  if (url.includes('docs.google.com/forms')) {
    embedUrl = url.replace(/\/viewform.*$/, '').replace(/\/$/, '') + '/viewform?embedded=true';
  }

  var iframe = document.getElementById('rsp-iframe');

  iframe.addEventListener('load', function() {
    rsp.iframeLoadCount++;

    if (rsp.iframeLoadCount === 1) {
      /* Form page loaded */
      updateStep(1, 'completed');
      updateStep(2, 'active');
      return;
    }

    /* Load #2+ : could be "Next" in multi-section OR final submit
       Use a 3-second debounce to detect the FINAL navigation */
    if (rsp.submitCheckTimeout) {
      clearTimeout(rsp.submitCheckTimeout);
    }

    rsp.submitCheckTimeout = setTimeout(function() {
      /* No more loads for 3 seconds = this was the FINAL page (confirmation) */
      rsp.formSubmitted = true;
      onFormSubmitted();
    }, 3000);
  });

  iframe.src = embedUrl;
}

/* ─── Called when Google Form submission is confirmed ─── */
function onFormSubmitted() {
  updateStep(2, 'completed');

  var statusEl = document.getElementById('rsp-submission-status');
  if (statusEl) statusEl.style.display = 'flex';

  checkCanConfirm();
}

/* ─── Check if ALL conditions are met ─── */
function checkCanConfirm() {
  if (rsp.confirmed || rsp.btnReady) return;

  /* STRICT: Both conditions MUST be true */
  if (!rsp.formSubmitted) return;
  if (!rsp.timeReady) return;

  /* ALL CONDITIONS MET */
  rsp.btnReady = true;
  updateStep(3, 'active');

  var confirmBtn   = document.getElementById('rsp-confirm-btn');
  var confirmLabel = document.getElementById('rsp-confirm-label');
  var confirmIcon  = document.getElementById('rsp-confirm-icon');
  var confirmHint  = document.getElementById('rsp-confirm-hint');
  var timerLabelEl = document.getElementById('rsp-timer-label');

  confirmBtn.disabled = false;
  confirmBtn.classList.add('ready');
  confirmIcon.textContent = '\u2713';
  confirmLabel.textContent = "Valider ma reponse";
  confirmHint.textContent = 'Formulaire soumis — clique pour confirmer';
  timerLabelEl.textContent = '\u2713 Pret a valider';
  timerLabelEl.style.color = 'var(--color-primary)';

  var mobileConfirm = document.getElementById('rsp-mobile-confirm');
  var mobileLabel   = document.getElementById('rsp-mobile-label');
  if (mobileConfirm) {
    mobileConfirm.disabled = false;
    mobileConfirm.classList.add('ready');
    mobileLabel.textContent = "\u2713 Valider ma reponse";
  }

  document.getElementById('rsp-warning').style.display = 'none';
}

/* ─── Step indicator ─── */
function updateStep(num, state) {
  var step = document.getElementById('rsp-step-' + num);
  var check = document.getElementById('rsp-check-' + num);
  if (!step) return;
  step.classList.remove('active', 'completed', 'done');
  if (state === 'completed') {
    step.classList.add('completed');
    if (check) check.textContent = '\u2713';
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
    var elapsed = Math.floor((Date.now() - rsp.startTime) / 1000);
    var mins = Math.floor(elapsed / 60);
    var secs = elapsed % 60;
    var timeStr = mins + ':' + String(secs).padStart(2, '0');

    timerEl.textContent = timeStr;
    if (mobileTimer) mobileTimer.textContent = timeStr;

    var progress = Math.min(100, Math.round((elapsed / MIN_TIME_SECONDS) * 100));
    progressBar.style.width = progress + '%';

    /* Time condition */
    if (elapsed >= MIN_TIME_SECONDS && !rsp.timeReady) {
      rsp.timeReady = true;
      checkCanConfirm();
    }

    /* Update button text — ALWAYS show what's missing */
    if (!rsp.confirmed && !rsp.btnReady) {
      if (!rsp.formSubmitted && elapsed < MIN_TIME_SECONDS) {
        /* Both missing */
        var remaining = MIN_TIME_SECONDS - elapsed;
        confirmLabel.textContent = 'Remplis et soumets le formulaire (' + remaining + 's)';
        if (mobileLabel) mobileLabel.textContent = '\u23f3 Remplis le formulaire';
      } else if (!rsp.formSubmitted && elapsed >= MIN_TIME_SECONDS) {
        /* Time OK but form NOT submitted */
        confirmLabel.textContent = '\u26a0 Soumets le formulaire Google Forms !';
        if (mobileLabel) mobileLabel.textContent = '\u26a0 Soumets le formulaire';
        timerLabelEl.textContent = 'Temps OK — soumets le formulaire';
        timerLabelEl.style.color = '#D97706';
      } else if (rsp.formSubmitted && elapsed < MIN_TIME_SECONDS) {
        /* Form submitted but time not met */
        var remaining2 = MIN_TIME_SECONDS - elapsed;
        confirmLabel.textContent = '\u2713 Soumis ! Encore ' + remaining2 + 's...';
        if (mobileLabel) mobileLabel.textContent = '\u2713 Soumis ! ' + remaining2 + 's';
      }
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

  /* STRICT double-check */
  if (!rsp.formSubmitted) {
    showWarning("Tu dois d'abord remplir et soumettre le formulaire Google Forms !");
    return;
  }
  var elapsed = Math.floor((Date.now() - rsp.startTime) / 1000);
  if (elapsed < MIN_TIME_SECONDS) {
    showWarning('Patiente encore quelques secondes...');
    return;
  }

  rsp.confirmed = true;
  clearInterval(rsp.timerInterval);
  updateStep(3, 'completed');

  var confirmBtn = document.getElementById('rsp-confirm-btn');
  confirmBtn.disabled = true;
  confirmBtn.classList.remove('ready');
  confirmBtn.classList.add('loading');
  document.getElementById('rsp-confirm-icon').textContent = '\u23f3';
  document.getElementById('rsp-confirm-label').textContent = 'Envoi en cours...';

  var mobileConfirm = document.getElementById('rsp-mobile-confirm');
  if (mobileConfirm) {
    mobileConfirm.disabled = true;
    mobileConfirm.classList.remove('ready');
    document.getElementById('rsp-mobile-label').textContent = '\u23f3 Envoi...';
  }

  var endTime = Date.now();
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
      if (errData.error) { showFailScreen(errData.error); return null; }
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
  var warning = document.getElementById('rsp-warning');
  var warnText = document.getElementById('rsp-warning-text');
  if (warnText) warnText.textContent = msg;
  warning.style.display = 'flex';
  warning.style.animation = 'none';
  void warning.offsetWidth;
  warning.style.animation = 'rspShake 0.5s ease';
}

/* ─── Success ─── */
function showSuccess(result) {
  document.getElementById('rsp-layout').style.display = 'none';
  document.getElementById('rsp-mobile-bar').style.display = 'none';
  document.getElementById('rsp-success-overlay').style.display = 'flex';

  var ptsEarned = (result && result.points_earned) || 10;
  var totalPts  = (result && result.total_points) || ((rsp.user && rsp.user.points) || 0) + ptsEarned;

  document.getElementById('rsp-success-pts').textContent = '+' + ptsEarned + ' pts gagnes !';
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
  var pct = Math.min(100, Math.round((totalPts / MIN_DEPOT) * 100));
  var unlocked = totalPts >= MIN_DEPOT;

  setTimeout(function() { document.getElementById('rsp-unlock-fill').style.width = pct + '%'; }, 300);
  document.getElementById('rsp-unlock-status').textContent = unlocked ? '\u2713 Depot disponible !' : totalPts + ' / ' + MIN_DEPOT + ' pts';
  document.getElementById('rsp-unlock-status').style.color = unlocked ? 'var(--color-primary)' : '';
  document.getElementById('rsp-unlock-note').textContent = unlocked ? 'Tu peux maintenant deposer ton questionnaire !' : 'Encore ' + (MIN_DEPOT - totalPts) + ' pts pour deverrouiller le depot.';

  if (!unlocked) {
    var depositBtn = document.getElementById('rsp-deposit-btn');
    depositBtn.style.opacity = '0.5';
    depositBtn.style.pointerEvents = 'none';
  }
}

/* ─── Fail ─── */
function showFailScreen(message) {
  document.getElementById('rsp-layout').style.display = 'none';
  document.getElementById('rsp-mobile-bar').style.display = 'none';
  document.getElementById('rsp-fail-overlay').style.display = 'flex';
  document.getElementById('rsp-fail-text').textContent = message;
}

/* ─── Retry ─── */
function retryResponse() {
  rsp.confirmed = false;
  rsp.btnReady = false;
  rsp.timeReady = false;
  rsp.formSubmitted = false;
  rsp.iframeLoadCount = 0;
  rsp.submitCheckTimeout = null;
  rsp.startTime = Date.now();

  document.getElementById('rsp-fail-overlay').style.display = 'none';
  document.getElementById('rsp-layout').style.display = 'grid';

  updateStep(1, 'completed');
  updateStep(2, 'active');
  updateStep(3, 'done');

  var confirmBtn = document.getElementById('rsp-confirm-btn');
  confirmBtn.disabled = true;
  confirmBtn.classList.remove('ready', 'loading');
  document.getElementById('rsp-confirm-icon').textContent = '\u23f3';
  document.getElementById('rsp-confirm-label').textContent = 'Remplis et soumets le formulaire';
  document.getElementById('rsp-confirm-hint').textContent = 'Le bouton s\'active apres soumission du formulaire';
  document.getElementById('rsp-timer-label').textContent = 'min. 60s requis';
  document.getElementById('rsp-timer-label').style.color = '';
  document.getElementById('rsp-warning').style.display = 'none';
  document.getElementById('rsp-progress-bar').style.width = '0%';

  var statusEl = document.getElementById('rsp-submission-status');
  if (statusEl) statusEl.style.display = 'none';

  var mobileConfirm = document.getElementById('rsp-mobile-confirm');
  if (mobileConfirm) {
    mobileConfirm.disabled = true;
    mobileConfirm.classList.remove('ready');
    document.getElementById('rsp-mobile-label').textContent = '\u23f3 Remplis le formulaire...';
  }

  embedGoogleForm();
  setupMobileBar();
  startTimer();
}

/* ─── Error ─── */
function showError(msg) {
  document.getElementById('rsp-loading').style.display = 'none';
  document.getElementById('rsp-error').style.display = 'flex';
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