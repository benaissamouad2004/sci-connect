/* ═══════════════════════════════════════════════════════════
   SCICONNECT — respond.js (Redesigned)
   Embed Google Forms iframe + real completion tracking
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

/* EDITABLE: minimum time (seconds) before confirm button activates */
const MIN_TIME_SECONDS = 30;

const rsp = {
  formId:     null,
  form:       null,
  user:       null,
  subscribed: false,
  startTime:  null,
  timerInterval: null,
  confirmed:  false,
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

/* ─── Load form from API ─── */
async function loadForm() {
  try {
    const resp = await fetch(`/api/forms/${rsp.formId}`, { credentials: 'include' });
    if (!resp.ok) throw new Error(resp.status);
    rsp.form = await resp.json();
  } catch {
    showError('Impossible de charger le questionnaire. V\u00e9rifie le lien.');
    return;
  }

  rsp.startTime = Date.now();

  /* Hide loading, show content */
  document.getElementById('rsp-loading').style.display = 'none';
  document.getElementById('rsp-content').style.display = 'block';

  renderInfoCard();
  embedGoogleForm();
  startTimer();
  checkAlreadyResponded();
}

/* ─── Info card ─── */
function renderInfoCard() {
  const f = rsp.form;

  /* Author avatar */
  const avatarEl = document.getElementById('rsp-info-avatar');
  if (f.author_avatar) {
    avatarEl.innerHTML = `<img src="${escapeAttr(f.author_avatar)}" alt="${escapeAttr(f.author_name || '')}">`;
  } else {
    avatarEl.textContent = (f.author_name || '?')[0].toUpperCase();
  }

  document.getElementById('rsp-info-author-name').textContent = f.author_name || 'Anonyme';
  document.getElementById('rsp-info-school').textContent = f.school_id || f.author_school || '';
  document.getElementById('rsp-info-title').textContent = f.title || 'Sans titre';
  document.getElementById('rsp-info-desc').textContent = f.description || '';

  /* Stripe color */
  const color = DOMAIN_COLORS[f.domain] || 'var(--color-primary)';
  document.getElementById('rsp-info-stripe').style.background = color;

  /* Chips */
  const chips = [
    f.domain,
    f.target_level,
    f.response_count !== undefined ? `${f.response_count} r\u00e9ponses` : null,
  ].filter(Boolean);
  document.getElementById('rsp-info-chips').innerHTML =
    chips.map(c => `<span class="rsp-chip">${c}</span>`).join('');

  /* Publisher profile link */
  if (f.author_slug) {
    const link = document.getElementById('rsp-publisher-link');
    link.href = `profile.html?slug=${f.author_slug}`;
    link.textContent = `Voir le profil de ${f.author_name || 'le publieur'} \u2192`;
  }

  /* Points pill */
  document.getElementById('rsp-pts-text').textContent = '+10 pts';
}

/* ─── Embed Google Forms iframe ─── */
function embedGoogleForm() {
  const url = rsp.form.google_forms_url;
  if (!url) {
    showError('Ce questionnaire n\'a pas de lien Google Forms.');
    return;
  }

  /* Convert viewform URL to embedded format */
  let embedUrl = url;
  if (url.includes('docs.google.com/forms')) {
    /* Ensure URL ends with /viewform?embedded=true */
    embedUrl = url.replace(/\/viewform.*$/, '').replace(/\/$/, '');
    embedUrl += '/viewform?embedded=true';
  }

  const iframe = document.getElementById('rsp-iframe');
  iframe.src = embedUrl;
}

/* ─── Timer + button activation ─── */
function startTimer() {
  const elapsedEl = document.getElementById('rsp-elapsed');
  const confirmBtn = document.getElementById('rsp-confirm-btn');
  const confirmLabel = document.getElementById('rsp-confirm-label');
  const confirmNote = document.getElementById('rsp-confirm-note');

  rsp.timerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - rsp.startTime) / 1000);
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    elapsedEl.textContent = `${mins}:${secs.toString().padStart(2, '0')} \u00e9coul\u00e9`;

    if (elapsed >= MIN_TIME_SECONDS && !rsp.confirmed) {
      confirmBtn.disabled = false;
      confirmLabel.textContent = "J'ai termin\u00e9 \u2014 valider ma r\u00e9ponse \u2713";
      confirmNote.textContent = "En cliquant, tu confirmes avoir rempli le formulaire.";
    } else if (!rsp.confirmed) {
      const remaining = MIN_TIME_SECONDS - elapsed;
      confirmLabel.textContent = `Patiente encore ${remaining}s...`;
    }
  }, 1000);
}

/* ─── Check if already responded ─── */
function checkAlreadyResponded() {
  if (!rsp.form.already_responded) return;

  /* Show a banner */
  const banner = document.createElement('div');
  banner.className = 'rsp-already-banner';
  banner.innerHTML = `
    <span style="font-size:1.2rem">&#x2705;</span>
    <div>
      <strong>Tu as d\u00e9j\u00e0 r\u00e9pondu \u00e0 ce questionnaire.</strong><br>
      Tu peux r\u00e9pondre \u00e0 nouveau mais les points ne seront pas compt\u00e9s une seconde fois.
    </div>
  `;
  const content = document.getElementById('rsp-content');
  content.insertBefore(banner, content.querySelector('.rsp-instructions'));
}

/* ─── Confirm response ─── */
async function confirmResponse() {
  if (rsp.confirmed) return;
  rsp.confirmed = true;

  const confirmBtn = document.getElementById('rsp-confirm-btn');
  confirmBtn.disabled = true;
  confirmBtn.querySelector('#rsp-confirm-label').textContent = 'Envoi en cours...';

  clearInterval(rsp.timerInterval);

  const endTime = Date.now();
  let result = null;

  try {
    const resp = await fetch('/api/responses', {
      method:      'POST',
      credentials: 'include',
      headers:     { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        form_id:    rsp.formId,
        answers:    {},
        start_time: rsp.startTime,
        end_time:   endTime,
        duration_seconds: Math.floor((endTime - rsp.startTime) / 1000),
      }),
    });
    if (resp.ok) result = await resp.json();
  } catch { /* non-blocking */ }

  showSuccess(result);
}

/* ─── Success screen ─── */
function showSuccess(result) {
  document.getElementById('rsp-content').style.display = 'none';

  const screen = document.getElementById('rsp-success-screen');
  screen.style.display = 'flex';

  const ptsEarned = result?.points_earned ?? 10;
  const totalPts  = result?.total_points  ?? (rsp.user?.points ?? 0) + ptsEarned;

  document.getElementById('rsp-pts-earned').textContent = `+${ptsEarned} pts gagn\u00e9s !`;
  document.getElementById('rsp-total-pts-val').textContent = totalPts;

  /* Trigger points animation if available */
  if (window.SciConnectAnimations) {
    const streakBonus = result?.streak_bonus || false;
    if (streakBonus && result?.streak_days) {
      window.SciConnectAnimations.showStreakAnimation(result.streak_days, 25);
      setTimeout(() => {
        window.SciConnectAnimations.showPointsAnimation(ptsEarned, totalPts, true);
      }, 4500);
    } else {
      window.SciConnectAnimations.showPointsAnimation(ptsEarned, totalPts, false);
    }
  }

  /* Unlock progress bar */
  const MIN_DEPOT = 20;
  const pct = Math.min(100, Math.round((totalPts / MIN_DEPOT) * 100));
  const unlocked = totalPts >= MIN_DEPOT;

  setTimeout(() => {
    document.getElementById('rsp-unlock-fill').style.width = pct + '%';
  }, 200);

  document.getElementById('rsp-unlock-status').textContent =
    unlocked ? '\u2713 D\u00e9p\u00f4t disponible !' : `${totalPts} / ${MIN_DEPOT} pts`;
  document.getElementById('rsp-unlock-status').style.color =
    unlocked ? 'var(--color-primary)' : '';
  document.getElementById('rsp-unlock-note').textContent =
    unlocked ? '\uD83D\uDEE1 Tu peux maintenant d\u00e9poser ton questionnaire !'
             : `Encore ${MIN_DEPOT - totalPts} pts pour d\u00e9verrouiller le d\u00e9p\u00f4t.`;

  if (!unlocked) {
    const depositBtn = document.getElementById('rsp-deposit-btn');
    depositBtn.style.opacity = '0.5';
    depositBtn.style.pointerEvents = 'none';
  }
}

/* ─── Subscribe toggle ─── */
function toggleSubscribe() {
  if (!rsp.user) { window.location.replace('login.html'); return; }
  rsp.subscribed = !rsp.subscribed;
  const btn = document.getElementById('rsp-subscribe-btn');
  btn.textContent = rsp.subscribed ? "Suivi \u2713" : "S'abonner";
  btn.classList.toggle('subscribed', rsp.subscribed);

  const slug = rsp.form?.author_slug;
  if (!slug) return;
  const method = rsp.subscribed ? 'POST' : 'DELETE';
  fetch(`/api/profiles/${slug}/subscribe`, { method, credentials: 'include' }).catch(() => {});
}

/* ─── Error display ─── */
function showError(msg) {
  document.getElementById('rsp-loading').style.display = 'none';
  const errEl = document.getElementById('rsp-error');
  errEl.style.display = 'flex';
  document.getElementById('rsp-error-msg').textContent = msg;
}

/* ─── Utility ─── */
function escapeAttr(s) { return (s || '').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }