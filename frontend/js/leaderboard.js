/* ═══════════════════════════════════════════════════════════
   SCICONNECT — Classement (Leaderboard)
   ═══════════════════════════════════════════════════════════ */

/* EDITABLE: couleurs des badges */
const BADGE_ICONS = { novice: '⭐', contributor: '🎯', expert: '🏆', master: '👑' };

/* EDITABLE: couleurs par domaine */
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

const lbState = { user: null, items: [], myRank: null, schools: null };

/* ─── Initialisation ─── */
document.addEventListener('DOMContentLoaded', async () => {
  await loadContent();

  const me = await fetch('/api/auth/me', { credentials: 'include' })
                    .then(r => r.json()).catch(() => null);

  if (me?.authenticated) {
    lbState.user = me.user;
    renderSidebarIdentity(me.user);

    const navProfile = document.getElementById('nav-profile');
    if (navProfile && me.user.slug) {
      navProfile.href = `/profil/${me.user.slug}`;
    }
  } else {
    const nameEl = document.getElementById('identity-name');
    const metaEl = document.getElementById('identity-meta');
    if (nameEl) nameEl.textContent = 'Visiteur public';
    if (metaEl) metaEl.textContent = 'Non connecté';
  }

  /* EDITABLE: chargement depuis admin/schools.json pour les noms d'écoles */
  const schoolsData = await loadSchools();
  if (schoolsData) {
    lbState.schools = schoolsData.universities;
  }

  await loadLeaderboard();
});

/* ─── Sidebar identité ─── */
function renderSidebarIdentity(user) {
  const avatarEl = document.getElementById('identity-avatar');
  const nameEl   = document.getElementById('identity-name');
  const metaEl   = document.getElementById('identity-meta');
  const ptsEl    = document.getElementById('identity-pts');
  const fill     = document.getElementById('ring-fill');
  const badgeTxt = document.getElementById('ring-badge-text');

  if (avatarEl) {
    avatarEl.innerHTML = user.avatar_url
      ? `<img src="${esc(user.avatar_url)}" alt="${esc(user.name || '')}" loading="lazy">`
      : (user.name || 'U')[0].toUpperCase();
  }
  if (nameEl) nameEl.textContent = user.name || user.email || '';
  if (metaEl) metaEl.textContent = [user.school_id, user.level].filter(Boolean).join(' · ');
  if (ptsEl)  ptsEl.textContent  = `★ ${user.points || 0} pts`;

  const badgePct = { novice: 20, contributor: 40, expert: 70, master: 100 };
  const pct      = badgePct[user.badge_level] || 20;
  if (fill) {
    const circ   = 2 * Math.PI * 22;
    fill.style.strokeDashoffset = circ * (1 - pct / 100);
  }
  if (badgeTxt) badgeTxt.textContent = BADGE_ICONS[user.badge_level] || '⭐';
}

/* ─── Chargement classement ─── */
async function loadLeaderboard() {
  try {
    const resp = await fetch('/api/leaderboard?limit=20', { credentials: 'include' });
    if (!resp.ok) throw new Error('API error');
    const data = await resp.json();

    lbState.items  = data.items  || [];
    lbState.myRank = data.my_rank;

    const metaEl = document.getElementById('lb-meta');
    if (metaEl && data.total) {
      metaEl.textContent = `${data.total} membre${data.total > 1 ? 's' : ''} actifs`;
    }

    renderMyRankCard(data.my_rank);
    renderPodium(lbState.items.slice(0, 3));
    renderTable(lbState.items);
  } catch {
    const body = document.getElementById('lb-table-body');
    if (body) body.innerHTML = `
      <div style="text-align:center;padding:40px;color:var(--color-text-muted)">
        <div style="font-size:1.5rem;margin-bottom:8px">⚠️</div>
        <div>Impossible de charger le classement. Vérifiez que le serveur est démarré.</div>
      </div>`;
  }
}

/* ─── Mon rang ─── */
function renderMyRankCard(myRank) {
  const card   = document.getElementById('lb-my-rank-card');
  const posEl  = document.getElementById('lb-my-rank-pos');
  const subEl  = document.getElementById('lb-my-rank-sub');
  const linkEl = document.getElementById('lb-my-profile-link');

  if (!card || !lbState.user) return;

  card.style.display = 'flex';

  if (myRank) {
    if (posEl) posEl.textContent = `${myRank}${myRank === 1 ? 'er' : 'ème'}`;
    if (subEl) subEl.textContent = `${lbState.user.points || 0} points · badge ${(lbState.user.badge_level || 'novice')}`;
  } else {
    if (posEl) posEl.textContent = '—';
    if (subEl) subEl.textContent = 'Réponds à des questionnaires pour apparaître dans le classement';
  }

  if (linkEl && lbState.user.slug) {
    linkEl.href = `/profil/${lbState.user.slug}`;
  }
}

/* ─── Podium top 3 ─── */
function renderPodium(top3) {
  const el = document.getElementById('lb-podium');
  if (!el || !top3.length) return;

  /* Ordre d'affichage : 2e, 1er, 3e */
  const order = [
    top3[1] ? { ...top3[1], podiumRank: 2 } : null,
    top3[0] ? { ...top3[0], podiumRank: 1 } : null,
    top3[2] ? { ...top3[2], podiumRank: 3 } : null,
  ].filter(Boolean);

  const medals = { 1: '🥇', 2: '🥈', 3: '🥉' };

  el.innerHTML = order.map(u => {
    const initials = (u.name || 'U').split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
    const avatar   = u.avatar_url
      ? `<img src="${esc(u.avatar_url)}" alt="${esc(u.name || '')}" loading="lazy">`
      : initials;
    const isMe     = lbState.user && u.id === lbState.user.id;
    const meLabel  = isMe ? ' (moi)' : '';
    const badge    = BADGE_ICONS[u.badge_level] || '⭐';
    const profileLink = u.slug ? `/profil/${u.slug}` : '#';

    return `
      <div class="lb-podium-item lb-podium-item--${u.podiumRank}">
        <a href="${profileLink}" class="lb-podium-avatar">${avatar}</a>
        <div class="lb-podium-name">${escHtml(u.name || 'Anonyme')}${escHtml(meLabel)}</div>
        <div class="lb-podium-pts">${u.points} pts</div>
        <div class="lb-podium-badge">${badge} ${u.badge_level || 'novice'}</div>
        <div class="lb-podium-block">${medals[u.podiumRank] || u.podiumRank}</div>
      </div>`;
  }).join('');
}

/* ─── Tableau classement ─── */
function renderTable(items) {
  const body = document.getElementById('lb-table-body');
  if (!body) return;

  if (!items.length) {
    body.innerHTML = `
      <div style="text-align:center;padding:40px;color:var(--color-text-muted)">
        <div style="font-size:1.5rem;margin-bottom:8px">🏆</div>
        <div>Le classement sera visible dès que des étudiants accumuleront des points.</div>
      </div>`;
    return;
  }

  body.innerHTML = items.map(u => {
    const isMe     = lbState.user && u.id === lbState.user.id;
    const initials = (u.name || 'U').split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
    const avatar   = u.avatar_url
      ? `<img src="${esc(u.avatar_url)}" alt="${esc(u.name || '')}" loading="lazy">`
      : initials;

    const rankClass = u.rank === 1 ? 'lb-row-rank--gold'
                    : u.rank === 2 ? 'lb-row-rank--silver'
                    : u.rank === 3 ? 'lb-row-rank--bronze'
                    : '';

    const schoolName = getSchoolName(u.school_id);
    const badge      = BADGE_ICONS[u.badge_level] || '⭐';
    const profileLink = u.slug ? `/profil/${u.slug}` : '#';

    return `
      <div class="lb-row ${isMe ? 'lb-row--me' : ''}" role="listitem">
        <div class="lb-row-rank ${rankClass}">${u.rank}</div>
        <div class="lb-row-user">
          <div class="lb-row-avatar">${avatar}</div>
          <div class="lb-row-info">
            <div class="lb-row-name">
              ${u.slug
                ? `<a href="${profileLink}">${escHtml(u.name || 'Anonyme')}</a>`
                : escHtml(u.name || 'Anonyme')
              }${isMe ? ' <span style="color:var(--color-primary);font-size:0.7rem">(moi)</span>' : ''}
            </div>
            <div class="lb-row-badge">${badge} ${u.badge_level || 'novice'}</div>
          </div>
        </div>
        <div class="lb-row-school">${escHtml(schoolName || '—')}</div>
        <div class="lb-row-domain">${escHtml(u.domain || '—')}</div>
        <div class="lb-row-pts">${u.points}</div>
        <div class="lb-row-stats">
          <span>${u.total_responses || 0} rép.</span>
          <span>${u.total_forms || 0} form.</span>
        </div>
      </div>`;
  }).join('');
}

/* ─── Résolution du nom d'école ─── */
function getSchoolName(schoolId) {
  if (!schoolId || !lbState.schools) return schoolId || '';
  for (const uni of lbState.schools) {
    for (const school of (uni.schools || [])) {
      if (school.id === schoolId) return school.name;
    }
  }
  return schoolId;
}

/* ─── Déconnexion ─── */
async function logout() {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  window.location.href = '/index.html';
}

/* ─── Utilitaires ─── */
function escHtml(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function esc(str) {
  return (str || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}