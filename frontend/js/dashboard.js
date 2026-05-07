/* EDITABLE: Dashboard JS V3 — SciConnect
   Modifier admin/content.json pour changer les textes */

const DOMAIN_COLORS = {
  'Sciences de gestion': '#005F54',
  'Marketing':           '#E67E22',
  'Finance':             '#2980B9',
  'Informatique':        '#8E44AD',
  'Médecine':            '#C0392B',
  'Droit':               '#D4AC0D',
  'Ingénierie':          '#1ABC9C',
  'Sciences sociales':   '#E91E63',
  'Psychologie':         '#FF5722',
};

let currentUser  = null;
let activeFilter = '';
let savedForms   = new Set(JSON.parse(sessionStorage.getItem('sc_saved') || '[]'));
let subscribedTo = new Set(JSON.parse(sessionStorage.getItem('sc_subs') || '[]'));

document.addEventListener('DOMContentLoaded', async () => {
  const ok = await initDashboard();
  if (!ok) return; // User not authenticated — redirect happened
  startActiveCounter();
  bindSidebarToggle();
  bindTopbarActions();
  bindFilterChips();
  bindLogout();
});

async function initDashboard() {
  try {
    const res  = await fetch('/api/auth/me', { credentials: 'include' });
    const data = await res.json();
    if (!data.authenticated) {
      // Clear cached user data and redirect to login
      localStorage.removeItem('sc_user_cache');
      window.location.replace('login.html');
      return false;
    }

    currentUser = data.user;
    // Cache user data locally for faster reloads
    try { localStorage.setItem('sc_user_cache', JSON.stringify(currentUser)); } catch(_) {}
    renderUserUI(currentUser);

    /* V3: popup connexion quotidienne */
    if (data.is_first_login_today && data.points_earned > 0) {
      showDailyPopup(data.points_earned, currentUser.streak || 0, data.streak_bonus, currentUser.points);
    }

    renderPointsBanner(currentUser);

    await Promise.all([loadRecommendedBanner(), loadFeed()]);
    return true;
  } catch (e) {
    console.error('Erreur init dashboard:', e);
    // Try to use cached data to prevent redirect loop
    const cached = localStorage.getItem('sc_user_cache');
    if (cached) {
      try {
        currentUser = JSON.parse(cached);
        renderUserUI(currentUser);
        renderPointsBanner(currentUser);
        await loadFeed();
        return true;
      } catch(_) {}
    }
    window.location.replace('login.html');
    return false;
  }
}

/* ── Rendu utilisateur ── */
function renderUserUI(user) {
  const first = (user.name || '').split(' ')[0] || 'toi';
  document.getElementById('topbar-greeting').textContent = `Bonjour, ${first} 👋`;

  renderAvatar('topbar-avatar', user);
  document.getElementById('topbar-name').textContent = first;
  renderAvatar('rail-avatar-img', user);
  renderAvatar('sb-avatar', user);

  document.getElementById('sb-name').textContent = user.name || '';
  document.getElementById('sb-meta').textContent = [user.school_id, user.level].filter(Boolean).join(' · ');

  const pts = user.points || 0;
  document.getElementById('sb-pts').textContent = pts;
  const barPct = Math.min(100, Math.round(pts / 20 * 100));
  const bar = document.getElementById('sb-pts-bar');
  bar.style.width = barPct + '%';
  if (pts >= 20) bar.style.background = 'var(--color-success, #1A7A5E)';
  const ptsStatus = document.getElementById('sb-pts-status');
  if (pts >= 20) {
    ptsStatus.innerHTML = '<span class="pts-ok-badge">\u2713 D\u00e9p\u00f4t disponible !</span>';
    ptsStatus.className = 'points-status ok';
  } else {
    ptsStatus.innerHTML = `<span class="pts-need">Encore <strong>${20 - pts} pts</strong> pour d\u00e9poser</span>`;
    ptsStatus.className = 'points-status';
  }

  const streak = user.streak || 0;
  document.getElementById('sb-streak-num').textContent = streak;
  renderStreakDots(streak);

  renderAvatar('pp-avatar', user);
  document.getElementById('pp-name').textContent = user.name || '';
  document.getElementById('pp-meta').textContent = user.school_id || '';
  document.getElementById('pp-pts').textContent  = pts + ' pts';
  document.getElementById('pp-responses').textContent = user.total_responses_given || 0;
  document.getElementById('pp-forms').textContent     = user.total_forms_posted || 0;
  document.getElementById('pp-streak').textContent    = streak + '🔥';

  const profileSlug = user.slug || user.id;
  const profileUrl = `profile.html?slug=${profileSlug}`;
  ['pp-profile-link', 'sb-profile-link'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.href = profileUrl;
  });
  /* Rail profile button */
  const railBtn = document.getElementById('rail-profile-btn');
  if (railBtn) {
    railBtn.onclick = () => { window.location.href = profileUrl; };
  }

  /* Bio */
  const sbBio = document.getElementById('sb-bio');
  if (sbBio) sbBio.textContent = user.bio || '';
  const bioInput = document.getElementById('pp-bio-input');
  if (bioInput) bioInput.value = user.bio || '';

  /* Bio save button */
  const bioSave = document.getElementById('pp-bio-save');
  if (bioSave && !bioSave._bound) {
    bioSave._bound = true;
    bioSave.addEventListener('click', async function() {
      const newBio = (document.getElementById('pp-bio-input').value || '').trim();
      bioSave.disabled = true;
      bioSave.textContent = 'Enregistrement...';
      try {
        const res = await fetch('/api/auth/me', {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bio: newBio }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            currentUser.bio = data.user.bio;
            const sb = document.getElementById('sb-bio');
            if (sb) sb.textContent = data.user.bio || '';
          }
          bioSave.textContent = '\u2713 Enregistr\u00e9';
          bioSave.classList.add('saved');
          setTimeout(function() {
            bioSave.textContent = 'Enregistrer';
            bioSave.classList.remove('saved');
          }, 2000);
        }
      } catch (e) {
        bioSave.textContent = 'Erreur';
      }
      bioSave.disabled = false;
    });
  }

  loadUserFormsCount();
}

function renderAvatar(elId, user) {
  const el = document.getElementById(elId);
  if (!el) return;
  if (user.avatar_url) {
    const img = document.createElement('img');
    img.src = user.avatar_url;
    img.alt = user.name || '';
    img.referrerPolicy = 'no-referrer';
    img.onerror = function() {
      /* Google avatar expired or blocked — show initial */
      el.innerHTML = '';
      el.textContent = (user.name || '?')[0].toUpperCase();
    };
    el.innerHTML = '';
    el.appendChild(img);
  } else {
    el.textContent = (user.name || '?')[0].toUpperCase();
  }
}

function renderStreakDots(streak) {
  const dots    = document.querySelectorAll('.streak-dot');
  const today   = new Date().getDay();
  const dayOrder = [1,2,3,4,5,6,0];
  const todayIdx = dayOrder.indexOf(today);
  dots.forEach((dot, i) => {
    dot.classList.toggle('done', i <= todayIdx && streak >= (todayIdx - i + 1));
  });
  if (streak >= 7) document.getElementById('sb-streak-bonus').hidden = false;
}

async function loadUserFormsCount() {
  try {
    const res  = await fetch('/api/forms?limit=50', { credentials: 'include' });
    const data = await res.json();
    const mine = (data.items || []).filter(f => f.author_id === currentUser?.id);
    const el   = document.getElementById('sb-qst-count');
    if (el) el.textContent = mine.length + ' actifs';
  } catch (_) {}
}

/* ── Popup connexion quotidienne ── */
function showDailyPopup(pointsEarned, streak, streakBonus, totalPts) {
  const overlay = document.getElementById('daily-overlay');
  overlay.hidden = false;
  document.getElementById('daily-pts').textContent = `+${pointsEarned} pts gagnés aujourd'hui !`;
  document.getElementById('daily-total-pts').textContent = totalPts;
  if (streakBonus && streak > 0) {
    const streakEl = document.getElementById('daily-streak');
    streakEl.hidden = false;
    document.getElementById('streak-num').textContent = streak;
  }
  const close = () => { overlay.hidden = true; };
  document.getElementById('daily-close').addEventListener('click', close);
  setTimeout(close, 4000);
}

/* ── Banner état points ── */
function renderPointsBanner(user) {
  const pts    = user.points || 0;
  const banner = document.getElementById('points-banner');
  if (!banner) return; /* safety: element may not exist */
  if (pts >= 40) { banner.hidden = true; return; }
  banner.hidden = false;
  const msg     = document.getElementById('pb-msg');
  const tracker = document.getElementById('pb-tracker');
  const icon    = document.getElementById('pb-icon');
  if (!msg || !tracker || !icon) return;
  if (pts === 0) {
    banner.className = 'points-banner locked';
    icon.textContent = '\uD83D\uDD12';
    msg.textContent = 'R\u00e9ponds \u00e0 des questionnaires pour gagner des points';
    tracker.innerHTML = `
      <span class="tracker-step pending">\u25CB R\u00e9ponse 1</span>
      <span class="tracker-step pending">\u25CB R\u00e9ponse 2</span>
      <span class="tracker-step locked">\uD83D\uDD12 D\u00e9p\u00f4t</span>`;
  } else if (pts < 20) {
    banner.className = 'points-banner halfway';
    icon.textContent = '\uD83D\uDD13';
    msg.innerHTML = `Encore <strong>${20 - pts} pts</strong> pour d\u00e9bloquer le d\u00e9p\u00f4t`;
    tracker.innerHTML = `
      <span class="tracker-step done">\u2713 ${pts} pts gagn\u00e9s</span>
      <span class="tracker-step locked">\uD83D\uDD12 D\u00e9p\u00f4t (20 pts)</span>`;
  } else {
    banner.className = 'points-banner halfway';
    icon.textContent = '\u2705';
    msg.innerHTML = `<strong>${pts} pts</strong> \u2014 tu peux d\u00e9poser ton questionnaire !`;
    tracker.innerHTML = `<span class="tracker-step done">\u2713 D\u00e9p\u00f4t d\u00e9verrouill\u00e9</span>`;
  }
}

/* ── Banner recommandation ── */
async function loadRecommendedBanner() {
  try {
    const res  = await fetch('/api/forms/recommended?limit=1', { credentials: 'include' });
    const data = await res.json();
    const form = (data.items || [])[0];
    if (!form) return;
    document.getElementById('rec-banner').hidden = false;
    document.getElementById('rec-title').textContent = form.title || '';
    document.getElementById('rec-sub').textContent = [
      form.author_name && `Par ${form.author_name}`, form.school_id, form.domain
    ].filter(Boolean).join(' · ');
    const recMeta = document.getElementById('rec-meta');
    if (recMeta) recMeta.textContent = [
      form.target_level, form.response_count && `${form.response_count} réponses`
    ].filter(Boolean).join(' · ');
    document.getElementById('rec-btn').href = `/respond.html?id=${form.id}`;
  } catch (e) {
    console.error('Erreur recommandation:', e);
  }
}

/* ── Feed questionnaires ── */
async function loadFeed(filter) {
  const grid    = document.getElementById('feed-grid');
  const loading = document.getElementById('feed-loading');
  if (loading) loading.style.display = 'flex';

  const params = new URLSearchParams({ limit: '30' });
  if (filter === 'domain' && currentUser?.domains?.[0]) params.set('domain', currentUser.domains[0]);
  if (filter === 'recent') params.set('sort', 'recent');
  if (filter === 'popular') params.set('sort', 'popular');

  try {
    const res   = await fetch(`/api/forms?${params}`, { credentials: 'include' });
    const data  = await res.json();
    /* Filter out demo questionnaires */
    const items = (data.items || []).filter(f => f.author_id !== 'demo-author-sciconnect' && f.author_id !== 'system-sciconnect-demo' && f.author_name !== 'SciConnect Demo');

    const countEl = document.getElementById('filter-count');
    if (countEl) countEl.textContent = `${items.length} résultats`;

    Array.from(grid.children).forEach(c => { if (c.id !== 'feed-loading') c.remove(); });
    if (loading) loading.style.display = 'none';

    if (!items.length) {
      grid.insertAdjacentHTML('beforeend',
        `<div style="column-span:all;text-align:center;padding:40px;color:var(--color-text-muted);font-size:13px;">
          Aucun questionnaire trouvé.</div>`);
      return;
    }

    items.forEach((form, i) => {
      const card = buildCard(form, currentUser);
      card.style.animationDelay = `${i * 60}ms`;
      grid.appendChild(card);
    });

    initScrollReveal();
  } catch (e) {
    console.error('Erreur feed:', e);
    if (loading) loading.style.display = 'none';
  }
}

function buildCard(form, user) {
  const card       = document.createElement('div');
  card.className   = 'form-card';
  card.dataset.id  = form.id;

  const stripeColor  = DOMAIN_COLORS[form.domain] || 'var(--color-primary)';
  const timeAgo      = relativeTime(form.created_at);
  const authorInit   = form.author_name ? form.author_name[0].toUpperCase() : '?';
  const pts          = user?.points || 0;
  const ptsOk        = pts >= 20;
  const already      = form.already_responded;
  const isSubscribed = subscribedTo.has(form.author_id);
  const isSaved      = savedForms.has(form.id);
  const isOwn        = form.author_id === user?.id;

  let publisherHtml = '';
  if (form.author_name) {
    const profileHref = form.author_slug ? `profile.html?slug=${form.author_slug}` : '#';
    const avatarHtml  = form.author_avatar
      ? `<img src="${escHtml(form.author_avatar)}" alt="${escHtml(form.author_name)}" referrerPolicy="no-referrer" onerror="this.parentNode.textContent='${authorInit}'">`
      : authorInit;
    const subBtnHtml  = !isOwn
      ? `<button class="subscribe-btn${isSubscribed ? ' subscribed' : ''}" data-author-id="${form.author_id}">
           ${isSubscribed ? 'Suivi ✓' : "S'abonner"}
         </button>`
      : '';
    publisherHtml = `
      <div class="card-publisher">
        <div class="publisher-avatar">${avatarHtml}</div>
        <a href="${profileHref}" class="publisher-name">${escHtml(form.author_name)}</a>
        ${subBtnHtml}
      </div>`;
  }

  card.innerHTML = `
    <div class="card-stripe" style="background:${stripeColor}"></div>
    <div class="card-body">
      <div class="card-header">
        <span class="card-school-pill">${escHtml(form.school_id || 'SciConnect')}</span>
        ${form.response_count > 20 ? '<span class="card-trending-pill">🔥 Tendance</span>' : ''}
        <span class="card-time">${timeAgo}</span>
      </div>
      <div class="card-title">${escHtml(form.title)}</div>
      ${form.description ? `<div class="card-desc">${escHtml(form.description)}</div>` : ''}
      <div class="card-chips">
        ${form.domain ? `<span class="card-chip">${escHtml(form.domain)}</span>` : ''}
        ${form.target_level ? `<span class="card-chip">${escHtml(form.target_level)}</span>` : ''}
        ${form.response_count !== undefined ? `<span class="card-chip">${form.response_count}/${form.target_count || 100} rép.</span>` : ''}
      </div>
      ${publisherHtml}
    </div>
    <div class="card-footer">
      <a href="/respond.html?id=${form.id}"
         class="btn-respond${already ? ' already-done' : ''}">
        ${already ? '✓ Déjà répondu' : 'Répondre · +10pts'}
      </a>
      ${isOwn ? `<button class="btn-delete" data-id="${form.id}" title="Supprimer ce questionnaire">🗑</button>` : ''}
      <button class="btn-save${isSaved ? ' saved' : ''}" data-id="${form.id}" title="Sauvegarder">
        ${isSaved ? '♥' : '♡'}
      </button>
    </div>`;

  const subBtn = card.querySelector('.subscribe-btn');
  if (subBtn) {
    subBtn.addEventListener('click', e => {
      e.preventDefault(); e.stopPropagation();
      toggleSubscribe(subBtn, form.author_id);
    });
  }
  card.querySelector('.btn-save').addEventListener('click', e => {
    e.preventDefault(); e.stopPropagation();
    toggleSave(e.currentTarget, form.id);
  });

  const delBtn = card.querySelector('.btn-delete');
  if (delBtn) {
    delBtn.addEventListener('click', async e => {
      e.preventDefault(); e.stopPropagation();
      if (!confirm('Supprimer ce questionnaire ? Cette action est irréversible.')) return;
      try {
        const res = await fetch(`/api/forms/${form.id}`, { method: 'DELETE', credentials: 'include' });
        const data = await res.json();
        if (data.success) {
          card.style.transition = 'opacity 300ms, transform 300ms';
          card.style.opacity = '0';
          card.style.transform = 'scale(0.95)';
          setTimeout(() => card.remove(), 300);
        } else {
          alert(data.error || 'Erreur lors de la suppression');
        }
      } catch { alert('Erreur réseau'); }
    });
  }

  return card;
}

async function toggleSubscribe(btn, authorId) {
  const isSubscribed = btn.classList.contains('subscribed');
  btn.classList.toggle('subscribed', !isSubscribed);
  btn.textContent = isSubscribed ? "S'abonner" : 'Suivi ✓';
  if (isSubscribed) subscribedTo.delete(authorId);
  else              subscribedTo.add(authorId);
  sessionStorage.setItem('sc_subs', JSON.stringify([...subscribedTo]));
}

function toggleSave(btn, formId) {
  const isSaved = btn.classList.contains('saved');
  btn.classList.toggle('saved', !isSaved);
  btn.textContent = isSaved ? '♡' : '♥';
  if (isSaved) savedForms.delete(formId);
  else         savedForms.add(formId);
  sessionStorage.setItem('sc_saved', JSON.stringify([...savedForms]));
}

/* ── Sidebar toggle ── */
function bindSidebarToggle() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');

  const openSB  = () => { sidebar.classList.add('open'); sidebar.setAttribute('aria-hidden','false'); overlay.hidden = false; };
  const closeSB = () => { sidebar.classList.remove('open'); sidebar.setAttribute('aria-hidden','true'); overlay.hidden = true; };

  document.getElementById('toggle-sidebar')?.addEventListener('click', () =>
    sidebar.classList.contains('open') ? closeSB() : openSB());
  document.getElementById('topbar-toggle')?.addEventListener('click', () =>
    sidebar.classList.contains('open') ? closeSB() : openSB());
  document.getElementById('close-sidebar')?.addEventListener('click', closeSB);
  overlay?.addEventListener('click', closeSB);
}

/* ── Topbar notifs/profil ── */
function bindTopbarActions() {
  const notifBtn     = document.getElementById('notif-btn');
  const profileBtn   = document.getElementById('profile-btn');
  const notifPanel   = document.getElementById('notif-panel');
  const profilePanel = document.getElementById('profile-panel');

  notifBtn.addEventListener('click', e => {
    e.stopPropagation();
    notifPanel.hidden = !notifPanel.hidden;
    profilePanel.hidden = true;
    notifBtn.classList.toggle('active', !notifPanel.hidden);
  });
  profileBtn.addEventListener('click', e => {
    e.stopPropagation();
    profilePanel.hidden = !profilePanel.hidden;
    notifPanel.hidden = true;
  });
  document.getElementById('rail-profile-btn')?.addEventListener('click', e => {
    e.stopPropagation();
    profilePanel.hidden = !profilePanel.hidden;
    notifPanel.hidden = true;
  });
  document.addEventListener('click', () => {
    notifPanel.hidden = true;
    profilePanel.hidden = true;
    notifBtn.classList.remove('active');
  });
  document.getElementById('mark-all-read').addEventListener('click', () => {
    document.querySelectorAll('.notif-dot').forEach(d => d.classList.add('read'));
    document.querySelectorAll('.notif-item').forEach(i => i.classList.remove('unread'));
    ['notif-badge','rail-notif-badge'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.hidden = true;
    });
  });
}

/* ── Filtres ── */
function bindFilterChips() {
  document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      activeFilter = chip.dataset.filter || '';
      loadFeed(activeFilter);
    });
  });
}

/* ── Compteur actifs fluctue 28-41 toutes 4s ── */
function startActiveCounter() {
  const el = document.getElementById('active-count');
  setInterval(() => {
    const n = Math.floor(Math.random() * (41 - 28 + 1)) + 28;
    if (el) el.textContent = n;
  }, 4000);
}

/* ── Déconnexion ── */
function bindLogout() {
  const doLogout = async () => {
    try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }); } catch (_) {}
    // Clear cached user data
    localStorage.removeItem('sc_user_cache');
    sessionStorage.removeItem('sc_saved');
    sessionStorage.removeItem('sc_subs');
    window.location.href = '/login.html';
  };
  document.getElementById('sb-logout')?.addEventListener('click', doLogout);
  document.getElementById('pp-logout')?.addEventListener('click', doLogout);
}

/* ── Scroll reveal ── */
function initScrollReveal() {
  if (!('IntersectionObserver' in window)) return;
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.style.opacity = '1';
        e.target.style.transform = 'translateY(0)';
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll('.form-card').forEach(card => {
    obs.observe(card);
  });
}

/* ── Helpers ── */
function relativeTime(iso) {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60)    return "à l'instant";
  if (diff < 3600)  return `il y a ${Math.floor(diff/60)}min`;
  if (diff < 86400) return `il y a ${Math.floor(diff/3600)}h`;
  return `il y a ${Math.floor(diff/86400)}j`;
}

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}