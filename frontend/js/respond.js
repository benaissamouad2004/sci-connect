/* ═══════════════════════════════════════════════════════════
   SCICONNECT — respond.js V4
   2-column layout with REAL form completion detection
   
   HOW IT WORKS:
   When a Google Form is submitted, the iframe navigates from
   the form page to a "Thank you" confirmation page. This 
   triggers a second 'load' event on the iframe. We use this
   to detect that the user actually submitted the form.
   
   The confirm button activates ONLY when BOTH conditions met:
   1. iframe loaded at least 2 times (= form was submitted)
   2. Minimum time elapsed (30 seconds)
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

const MIN_TIME_SECONDS = 30;

const rsp = {
  formId:          null,
  form:            null,
  user:            null,
  startTime:       null,
  timerInterval:   null,
  confirmed:       false,
  btnReady:        false,
  iframeLoadCount: 0,       // Track iframe loads: 1=form loaded, 2+=form submitted
  formSubmitted:   false,    // True after Google Form submission detected
  timeReady:       false,    // True after minimum time elapsed
};

/* ─── Boot ─── */
document.addEventListener('DOMContentLoaded', async function() {
  var params = new URLSearchParams(window.location.search);
  rsp.formId = params.get('id');

  if (!rsp.formId) {
    showError('Lien invalide \u2014 aucun questionnaire sp\u00e9cifi\u00e9.');
    return;
  }

  var me = await fetch('/api/auth/me', { credentials: 'include' })
                 .then(function(r) { return r.json(); }).catch(function() { return null; });
  if (me && me.authenticated) rsp.user = me.user;

  await loadForm();
});

/* ─── Load form ─── */
async function loadForm() {
  try {
    var resp = await fetch('/api/forms/' + rsp.formId, { credentials: 'include' });
    if (!resp.ok) throw new Error(resp.status);
    rsp.form = await resp.json();
  } catch (e) {
    showError('Impossible de charger le questionnaire. V\u00e9rifie le lien.');
    return;
  }

  rsp.startTime = Date.now();

  document.getElementById('rsp-loading').style.display = 'none';
  document.getElementById('rsp-layout').style.display = 'grid';

  renderTitleCard();
  embedGoogleForm();
  startTimer();
  checkAlreadyResponded();
  setupMobileBar();
}

/* ─── Title card ─── */
function renderTitleCard() {
  var f = rsp.form;

  document.getElementById('rsp-title').textContent = f.title || 'Sans titre';
  document.title = (f.title || 'Questionnaire') + ' \u2014 SciConnect';

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
  if (f.response_count !== undefined) metaParts.push(f.response_count + '/' + (f.target_count || 100) + ' r\u00e9ponses');
  if (f.school_id) metaParts.push(f.school_id.toUpperCase());
  document.getElementById('rsp-meta').textContent = metaParts.join(' \u00b7 ');

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

  /* ═══ KEY: Track iframe load events ═══
     Load #1 = Google Form page loaded
     Load #2 = User submitted the form (iframe navigated to confirmation page)
  */
  iframe.addEventListener('load', function() {
    rsp.iframeLoadCount++;

    if (rsp.iframeLoadCount === 1) {
      /* Form loaded — update step 1 */
      updateStep(1, 'completed');
      updateStep(2, 'active');
    }

    if (rsp.iframeLoadCount >= 2) {
      /* Form SUBMITTED — the iframe navigated to the confirmation page */
      rsp.formSubmitted = true;
      onFormSubmitted();
    }
  });

  iframe.src = embedUrl;
}

/* ─── Called when Google Form submission is detected ─── */
function onFormSubmitted() {
  /* Update step 2 to completed */
  updateStep(2, 'completed');

  /* Update submission status in sidebar */
  var statusEl = document.getElementById('rsp-submission-status');
  if (statusEl) {
    statusEl.style.display = 'flex';
  }

  /* Check if we can enable the button */
  checkCanConfirm();
}

/* ─── Check if both conditions are met ─── */
function checkCanConfirm() {
  if (rsp.confirmed || rsp.btnReady) return;

  /* Both conditions required */
  if (!rsp.formSubmitted || !rsp.timeReady) return;

  /* BOTH conditions met — enable the button! */
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
  confirmLabel.textContent = "Valider ma r\u00e9ponse";
  confirmHint.textContent = 'Formulaire soumis \u2014 clique pour confirmer';

  timerLabelEl.textContent = '\u2713 Pr\u00eat \u00e0 valider';
  timerLabelEl.style.color = 'var(--color-primary)';

  /* Enable mobile button */
  var mobileConfirm = document.getElementById('rsp-mobile-confirm');
  var mobileLabel   = document.getElementById('rsp-mobile-label');
  if (mobileConfirm) {
    mobileConfirm.disabled = false;
    mobileConfirm.classList.add('ready');
    mobileLabel.textContent = "\u2713 Valider ma r\u00e9ponse";
  }

  /* Hide warning */
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
  } else if (state === 'done') {
    step.classList.add('done');
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

    if (elapsed >= MIN_TIME_SECONDS && !rsp.timeReady) {
      rsp.timeReady = true;
      checkCanConfirm();
    }

    /* Update button text based on current state */
    if (!rsp.confirmed && !rsp.btnReady) {
      if (!rsp.formSubmitted && elapsed < MIN_TIME_SECONDS) {
        var remaining = MIN_TIME_SECONDS - elapsed;
        confirmLabel.textContent = 'Remplis le formulaire... (' + remaining + 's)';
        if (mobileLabel) mobileLabel.textContent = '\u23f3 Remplis le formulaire...';
      } else if (!rsp.formSubmitted && elapsed >= MIN_TIME_SECONDS) {
        confirmLabel.textContent = 'En attente de soumission du formulaire...';
        if (mobileLabel) mobileLabel.textContent = '\u23f3 Soumets le formulaire';
        timerLabelEl.textContent = 'Temps OK \u2014 soumets le formulaire';
        timerLabelEl.style.color = '#D97706';
      } else if (rsp.formSubmitted && elapsed < MIN_TIME_SECONDS) {
        var remaining2 = MIN_TIME_SECONDS - elapsed;
        confirmLabel.textContent = 'Formulaire soumis ! Encore ' + remaining2 + 's...';
        if (mobileLabel) mobileLabel.textContent = '\u2713 Soumis ! Encore ' + remaining2 + 's';
      }
    }
  }, 1000);
}

/* ─── Mobile bar setup ─── */
function setupMobileBar() {
  var mobileBar = document.getElementById('rsp-mobile-bar');
  function updateBar() {
    mobileBar.style.display = window.innerWidth <= 860 ? 'flex' : 'none';
  }
  updateBar();
  window.addEventListener('resize', updateBar);
}

/* ─── Already responded ─── */
function checkAlreadyResponded() {
  if (!rsp.form.already_responded) return;
  document.getElementById('rsp-already-banner').style.display = 'flex';
}

/* ─── Confirm response ─── */
async function confirmResponse() {
  if (rsp.confirmed) return;

  /* Double-check both conditions */
  if (!rsp.formSubmitted) {
    showWarning('Soumets le formulaire Google Forms d\'abord !');
    return;
  }

  var elapsed = Math.floor((Date.now() - rsp.startTime) / 1000);
  if (elapsed < MIN_TIME_SECONDS) {
    showWarning('Patiente encore quelques secondes...');
    return;
  }

  rsp.confirmed = true;
  clearInterval(rsp.timerInterval);

  /* Update step 3 */
  updateStep(3, 'completed');

  /* Update buttons */
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
  var result = null;

  try {
    var resp2 = await fetch('/api/responses', {
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
    });

    if (resp2.ok) {
      result = await resp2.json();
    } else {
      var errData = await resp2.json().catch(function() { return {}; });
      if (errData.already_responded) {
        showFailScreen("Tu as d\u00e9j\u00e0 r\u00e9pondu. Les points ne sont compt\u00e9s qu'une seule fois.");
        return;
      }
      if (errData.error) {
        showFailScreen(errData.error);
        return;
      }
    }
  } catch (e) {
    /* Network error — still show success with default */
  }

  if (result && result.is_suspect) {
    showFailScreen("R\u00e9ponse trop rapide. R\u00e9ponds s\u00e9rieusement pour gagner des points.");
    return;
  }

  showSuccess(result);
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

  document.getElementById('rsp-success-pts').textContent = '+' + ptsEarned + ' pts gagn\u00e9s !';
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

  document.getElementById('rsp-unlock-status').textContent =
    unlocked ? '\u2713 D\u00e9p\u00f4t disponible !' : totalPts + ' / ' + MIN_DEPOT + ' pts';
  document.getElementById('rsp-unlock-status').style.color =
    unlocked ? 'var(--color-primary)' : '';
  document.getElementById('rsp-unlock-note').textContent =
    unlocked ? '\ud83d\udee1 Tu peux maintenant d\u00e9poser ton questionnaire !'
             : 'Encore ' + (MIN_DEPOT - totalPts) + ' pts pour d\u00e9verrouiller le d\u00e9p\u00f4t.';

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
  rsp.startTime = Date.now();

  document.getElementById('rsp-fail-overlay').style.display = 'none';
  document.getElementById('rsp-layout').style.display = 'grid';

  /* Reset steps */
  updateStep(1, 'completed');
  updateStep(2, 'active');
  updateStep(3, 'done');

  /* Reset button */
  var confirmBtn = document.getElementById('rsp-confirm-btn');
  confirmBtn.disabled = true;
  confirmBtn.classList.remove('ready', 'loading');
  document.getElementById('rsp-confirm-icon').textContent = '\u23f3';
  document.getElementById('rsp-confirm-label').textContent = 'Remplis le formulaire...';
  document.getElementById('rsp-confirm-hint').textContent = "Soumets le formulaire + 30s minimum";
  document.getElementById('rsp-timer-label').textContent = 'min. 30s requis';
  document.getElementById('rsp-timer-label').style.color = '';
  document.getElementById('rsp-warning').style.display = 'none';
  document.getElementById('rsp-progress-bar').style.width = '0%';

  var statusEl = document.getElementById('rsp-submission-status');
  if (statusEl) statusEl.style.display = 'none';

  /* Reset mobile */
  var mobileConfirm = document.getElementById('rsp-mobile-confirm');
  if (mobileConfirm) {
    mobileConfirm.disabled = true;
    mobileConfirm.classList.remove('ready');
    document.getElementById('rsp-mobile-label').textContent = '\u23f3 Remplis le formulaire...';
  }

  /* Re-embed form */
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