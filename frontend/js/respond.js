/* ═══════════════════════════════════════════════════════════
   SCICONNECT — respond.js V5
   STRONG FORM COMPLETION VERIFICATION
   
   The confirm button activates ONLY when ALL conditions met:
   1. iframe loaded >= 2 times (Google Form submitted → confirmation page)
   2. User interacted with iframe (clicked/focused inside it)
   3. Minimum time elapsed (30 seconds)
   
   If iframe load detection fails (some Google Forms handle
   submission via AJAX), a fallback allows confirmation after
   the user has interacted with the iframe for 60+ seconds.
   ═══════════════════════════════════════════════════════════ */

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

var MIN_TIME_SECONDS = 30;
var INTERACTION_FALLBACK_SECONDS = 90; // fallback if iframe load detection fails

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
  iframeInteracted:    false,    // user clicked inside iframe at least once
  iframeFocusTime:     0,        // total seconds iframe had focus
  iframeHasFocus:      false,    // currently focused
  lastFocusStart:      null,
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
      trackIframeInteraction();
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
  if (f.description) {
    desc.textContent = f.description;
  } else {
    desc.style.display = 'none';
  }

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

/* ─── Embed Google Forms + track submission via load events ─── */
function embedGoogleForm() {
  var url = rsp.form.google_forms_url;
  if (!url) { showError("Ce questionnaire n'a pas de lien Google Forms."); return; }

  var embedUrl = url;
  if (url.includes('docs.google.com/forms')) {
    embedUrl = url.replace(/\/viewform.*$/, '').replace(/\/$/, '') + '/viewform?embedded=true';
  }

  var iframe = document.getElementById('rsp-iframe');

  /* Track iframe load events:
     Load #1 = Google Form page loaded
     Load #2+ = User submitted (iframe navigated to confirmation page) */
  iframe.addEventListener('load', function() {
    rsp.iframeLoadCount++;

    if (rsp.iframeLoadCount === 1) {
      updateStep(1, 'completed');
      updateStep(2, 'active');
    }

    if (rsp.iframeLoadCount >= 2) {
      rsp.formSubmitted = true;
      onFormSubmitted();
    }
  });

  iframe.src = embedUrl;
}

/* ─── Track iframe interaction via focus/blur ─── */
function trackIframeInteraction() {
  /* When user clicks inside the iframe, the parent window loses focus.
     When they click outside, parent regains focus.
     We track this to know the user actually interacted with the form. */

  window.addEventListener('blur', function() {
    /* Check if iframe is the active element */
    setTimeout(function() {
      if (document.activeElement && document.activeElement.tagName === 'IFRAME') {
        rsp.iframeHasFocus = true;
        rsp.iframeInteracted = true;
        rsp.lastFocusStart = Date.now();
      }
    }, 100);
  });

  window.addEventListener('focus', function() {
    if (rsp.iframeHasFocus && rsp.lastFocusStart) {
      var focusDuration = Math.floor((Date.now() - rsp.lastFocusStart) / 1000);
      rsp.iframeFocusTime += focusDuration;
    }
    rsp.iframeHasFocus = false;
    rsp.lastFocusStart = null;
  });
}

/* ─── Called when Google Form submission is detected ─── */
function onFormSubmitted() {
  updateStep(2, 'completed');

  var statusEl = document.getElementById('rsp-submission-status');
  if (statusEl) statusEl.style.display = 'flex';

  checkCanConfirm();
}

/* ─── Check if all conditions are met ─── */
function checkCanConfirm() {
  if (rsp.confirmed || rsp.btnReady) return;

  /* Primary path: iframe load detected + time ready */
  var primaryOk = rsp.formSubmitted && rsp.timeReady;

  /* Fallback path: user interacted for 90+ seconds + time ready
     (for Google Forms that don't trigger a second load event) */
  var currentFocusTime = rsp.iframeFocusTime;
  if (rsp.iframeHasFocus && rsp.lastFocusStart) {
    currentFocusTime += Math.floor((Date.now() - rsp.lastFocusStart) / 1000);
  }
  var fallbackOk = rsp.iframeInteracted && currentFocusTime >= INTERACTION_FALLBACK_SECONDS && rsp.timeReady;

  if (!primaryOk && !fallbackOk) return;

  /* CONDITIONS MET — enable the button */
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

/* ─── Step indicator update ─── */
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

/* ─── Timer + progress ─── */
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

    /* Check time condition */
    if (elapsed >= MIN_TIME_SECONDS && !rsp.timeReady) {
      rsp.timeReady = true;
      checkCanConfirm();
    }

    /* Periodically check fallback (interaction time) */
    if (elapsed % 5 === 0 && !rsp.btnReady) {
      checkCanConfirm();
    }

    /* Update button text based on current state */
    if (!rsp.confirmed && !rsp.btnReady) {
      var currentFocusTime = rsp.iframeFocusTime;
      if (rsp.iframeHasFocus && rsp.lastFocusStart) {
        currentFocusTime += Math.floor((Date.now() - rsp.lastFocusStart) / 1000);
      }

      if (!rsp.formSubmitted && !rsp.iframeInteracted) {
        /* User hasn't even clicked in the form */
        confirmLabel.textContent = 'Clique dans le formulaire pour commencer';
        if (mobileLabel) mobileLabel.textContent = '\u23f3 Remplis le formulaire';
      } else if (!rsp.formSubmitted && rsp.iframeInteracted && elapsed < MIN_TIME_SECONDS) {
        var remaining = MIN_TIME_SECONDS - elapsed;
        confirmLabel.textContent = 'En cours... encore ' + remaining + 's';
        if (mobileLabel) mobileLabel.textContent = '\u23f3 Encore ' + remaining + 's';
      } else if (!rsp.formSubmitted && rsp.iframeInteracted && elapsed >= MIN_TIME_SECONDS) {
        if (currentFocusTime < INTERACTION_FALLBACK_SECONDS) {
          confirmLabel.textContent = 'Soumets le formulaire pour valider';
          if (mobileLabel) mobileLabel.textContent = '\u23f3 Soumets le formulaire';
          timerLabelEl.textContent = 'Temps OK — soumets le formulaire';
          timerLabelEl.style.color = '#D97706';
        }
      } else if (rsp.formSubmitted && elapsed < MIN_TIME_SECONDS) {
        var remaining2 = MIN_TIME_SECONDS - elapsed;
        confirmLabel.textContent = 'Soumis ! Encore ' + remaining2 + 's...';
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

  if (!rsp.formSubmitted && rsp.iframeFocusTime < INTERACTION_FALLBACK_SECONDS) {
    showWarning("Soumets le formulaire Google Forms d'abord !");
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

  var overlay = document.getElementById('rsp-success-overlay');
  overlay.style.display = 'flex';

  var ptsEarned = (result && result.points_earned) || 10;
  var totalPts  = (result && result.total_points) || ((rsp.user && rsp.user.points) || 0) + ptsEarned;

  document.getElementById('rsp-success-pts').textContent = '+' + ptsEarned + ' pts gagnes !';
  document.getElementById('rsp-success-total-val').textContent = totalPts;

  if (window.SciConnectAnimations) {
    var streakBonus = result && result.streak_bonus;
    if (streakBonus && result.streak_days) {
      window.SciConnectAnimations.showStreakAnimation(result.streak_days, 25);
      setTimeout(function() {
        window.SciConnectAnimations.showPointsAnimation(ptsEarned, totalPts, true);
      }, 4500);
    } else {
      window.SciConnectAnimations.showPointsAnimation(ptsEarned, totalPts, false);
    }
  }

  var MIN_DEPOT = 20;
  var pct = Math.min(100, Math.round((totalPts / MIN_DEPOT) * 100));
  var unlocked = totalPts >= MIN_DEPOT;

  setTimeout(function() {
    document.getElementById('rsp-unlock-fill').style.width = pct + '%';
  }, 300);

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
  rsp.iframeInteracted = false;
  rsp.iframeFocusTime = 0;
  rsp.iframeHasFocus = false;
  rsp.lastFocusStart = null;
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
  document.getElementById('rsp-confirm-label').textContent = 'Clique dans le formulaire pour commencer';
  document.getElementById('rsp-confirm-hint').textContent = 'Soumets le formulaire + 30s minimum';
  document.getElementById('rsp-timer-label').textContent = 'min. 30s requis';
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

/* ─── Utility ─── */
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