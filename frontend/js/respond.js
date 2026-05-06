/* ═══════════════════════════════════════════════════════════
   SCICONNECT — respond.js V3
   2-column layout: sticky sidebar + scrollable iframe
   Steps, progress bar, mobile bar, clear validation states
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
  formId:        null,
  form:          null,
  user:          null,
  startTime:     null,
  timerInterval: null,
  confirmed:     false,
  btnReady:      false,
};

/* ─── Boot ─── */
document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  rsp.formId = params.get('id');

  if (!rsp.formId) {
    showError('Lien invalide \u2014 aucun questionnaire sp\u00e9cifi\u00e9.');
    return;
  }

  const me = await fetch('/api/auth/me', { credentials: 'include' })
                   .then(r => r.json()).catch(() => null);
  if (me && me.authenticated) rsp.user = me.user;

  await loadForm();
});

/* ─── Load form ─── */
async function loadForm() {
  try {
    const resp = await fetch('/api/forms/' + rsp.formId, { credentials: 'include' });
    if (!resp.ok) throw new Error(resp.status);
    rsp.form = await resp.json();
  } catch {
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
  const f = rsp.form;

  document.getElementById('rsp-title').textContent = f.title || 'Sans titre';
  document.title = (f.title || 'Questionnaire') + ' \u2014 SciConnect';

  const desc = document.getElementById('rsp-desc');
  if (f.description) {
    desc.textContent = f.description;
  } else {
    desc.style.display = 'none';
  }

  const color = DOMAIN_COLORS[f.domain] || 'var(--color-primary)';
  document.getElementById('rsp-title-stripe').style.background = color;

  const chips = [f.domain, f.target_level].filter(Boolean);
  document.getElementById('rsp-title-chips').innerHTML =
    chips.map(c => '<span class="rsp-chip">' + esc(c) + '</span>').join('');

  const metaParts = [];
  if (f.response_count !== undefined) metaParts.push(f.response_count + '/' + (f.target_count || 100) + ' r\u00e9ponses');
  if (f.school_id) metaParts.push(f.school_id.toUpperCase());
  document.getElementById('rsp-meta').textContent = metaParts.join(' \u00b7 ');

  document.getElementById('rsp-pts-text').textContent = '+10 pts';
}

/* ─── Embed Google Forms ─── */
function embedGoogleForm() {
  const url = rsp.form.google_forms_url;
  if (!url) { showError("Ce questionnaire n'a pas de lien Google Forms."); return; }

  let embedUrl = url;
  if (url.includes('docs.google.com/forms')) {
    embedUrl = url.replace(/\/viewform.*$/, '').replace(/\/$/, '') + '/viewform?embedded=true';
  }
  document.getElementById('rsp-iframe').src = embedUrl;
}

/* ─── Timer + progress + step updates ─── */
function startTimer() {
  const timerEl       = document.getElementById('rsp-timer');
  const timerLabelEl  = document.getElementById('rsp-timer-label');
  const progressBar   = document.getElementById('rsp-progress-bar');
  const confirmBtn    = document.getElementById('rsp-confirm-btn');
  const confirmLabel  = document.getElementById('rsp-confirm-label');
  const confirmIcon   = document.getElementById('rsp-confirm-icon');
  const confirmHint   = document.getElementById('rsp-confirm-hint');
  const mobileTimer   = document.getElementById('rsp-mobile-timer');
  const mobileConfirm = document.getElementById('rsp-mobile-confirm');
  const mobileLabel   = document.getElementById('rsp-mobile-label');

  rsp.timerInterval = setInterval(function() {
    var elapsed = Math.floor((Date.now() - rsp.startTime) / 1000);
    var mins = Math.floor(elapsed / 60);
    var secs = elapsed % 60;
    var timeStr = mins + ':' + String(secs).padStart(2, '0');

    timerEl.textContent = timeStr;
    if (mobileTimer) mobileTimer.textContent = timeStr;

    var progress = Math.min(100, Math.round((elapsed / MIN_TIME_SECONDS) * 100));
    progressBar.style.width = progress + '%';

    if (elapsed >= MIN_TIME_SECONDS && !rsp.confirmed) {
      if (!rsp.btnReady) {
        rsp.btnReady = true;

        /* Update step indicators */
        var step2 = document.getElementById('rsp-step-2');
        var step3 = document.getElementById('rsp-step-3');
        var check2 = document.getElementById('rsp-check-2');

        step2.classList.remove('active');
        step2.classList.add('completed');
        check2.textContent = '\u2713';

        step3.classList.add('active');

        /* Enable desktop button */
        confirmBtn.disabled = false;
        confirmBtn.classList.add('ready');
        confirmIcon.textContent = '\u2713';
        confirmLabel.textContent = "J'ai termin\u00e9 \u2014 Valider";
        confirmHint.textContent = 'Clique pour confirmer ta r\u00e9ponse';

        timerLabelEl.textContent = '\u2713 Temps atteint';
        timerLabelEl.style.color = 'var(--color-primary)';

        /* Enable mobile button */
        if (mobileConfirm) {
          mobileConfirm.disabled = false;
          mobileConfirm.classList.add('ready');
          mobileLabel.textContent = "\u2713 Confirmer ma r\u00e9ponse";
        }

        /* Hide warning if shown */
        document.getElementById('rsp-warning').style.display = 'none';
      }
    } else if (!rsp.confirmed) {
      var remaining = MIN_TIME_SECONDS - elapsed;
      confirmLabel.textContent = 'Patiente encore ' + remaining + 's...';
      if (mobileLabel) mobileLabel.textContent = '\u23f3 Encore ' + remaining + 's...';
    }
  }, 1000);
}

/* ─── Mobile bar setup ─── */
function setupMobileBar() {
  var mobileBar = document.getElementById('rsp-mobile-bar');
  if (window.innerWidth <= 860) {
    mobileBar.style.display = 'flex';
  }
  window.addEventListener('resize', function() {
    mobileBar.style.display = window.innerWidth <= 860 ? 'flex' : 'none';
  });
}

/* ─── Already responded ─── */
function checkAlreadyResponded() {
  if (!rsp.form.already_responded) return;
  document.getElementById('rsp-already-banner').style.display = 'flex';
}

/* ─── Confirm response ─── */
async function confirmResponse() {
  if (rsp.confirmed) return;

  var elapsed = Math.floor((Date.now() - rsp.startTime) / 1000);
  if (elapsed < MIN_TIME_SECONDS) {
    var warning = document.getElementById('rsp-warning');
    warning.style.display = 'flex';
    warning.style.animation = 'none';
    void warning.offsetWidth;
    warning.style.animation = 'rspShake 0.5s ease';
    return;
  }

  rsp.confirmed = true;
  clearInterval(rsp.timerInterval);

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

  /* Update step 3 */
  var step3 = document.getElementById('rsp-step-3');
  step3.classList.add('active');

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
        showFailScreen("Tu as d\u00e9j\u00e0 r\u00e9pondu \u00e0 ce questionnaire. Les points ne sont compt\u00e9s qu'une seule fois.");
        return;
      }
      if (errData.error) {
        showFailScreen(errData.error);
        return;
      }
    }
  } catch {
    /* Network error */
  }

  if (result && result.is_suspect) {
    showFailScreen("Ta r\u00e9ponse a \u00e9t\u00e9 d\u00e9tect\u00e9e comme trop rapide. R\u00e9ponds s\u00e9rieusement pour gagner des points.");
    return;
  }

  showSuccess(result);
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
  rsp.startTime = Date.now();

  document.getElementById('rsp-fail-overlay').style.display = 'none';
  document.getElementById('rsp-layout').style.display = 'grid';

  /* Reset steps */
  document.getElementById('rsp-step-2').classList.add('active');
  document.getElementById('rsp-step-2').classList.remove('completed');
  document.getElementById('rsp-check-2').textContent = '';
  document.getElementById('rsp-step-3').classList.remove('active');

  /* Reset button */
  var confirmBtn = document.getElementById('rsp-confirm-btn');
  confirmBtn.disabled = true;
  confirmBtn.classList.remove('ready', 'loading');
  document.getElementById('rsp-confirm-icon').textContent = '\u23f3';
  document.getElementById('rsp-confirm-label').textContent = 'Patiente encore...';
  document.getElementById('rsp-confirm-hint').textContent = "Le bouton s'active apr\u00e8s 30s minimum";
  document.getElementById('rsp-timer-label').textContent = 'min. 30s requis';
  document.getElementById('rsp-timer-label').style.color = '';
  document.getElementById('rsp-warning').style.display = 'none';
  document.getElementById('rsp-progress-bar').style.width = '0%';

  /* Reset mobile */
  var mobileConfirm = document.getElementById('rsp-mobile-confirm');
  if (mobileConfirm) {
    mobileConfirm.disabled = true;
    mobileConfirm.classList.remove('ready');
    document.getElementById('rsp-mobile-label').textContent = '\u23f3 Patiente encore...';
  }

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