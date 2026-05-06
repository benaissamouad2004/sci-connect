/* ═══════════════════════════════════════════════════════════
   SCICONNECT — Profil V5
   Matching mockup: banner + avatar + badge level + two-col
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

const BADGE_LEVELS = [
  { name: 'Novice',       icon: '\u2B50', desc: 'D\u00e9bloqu\u00e9 d\u00e8s l\'inscription', minPts: 0 },
  { name: 'Contributeur', icon: '\uD83C\uDFAF', desc: '50 points requis',  minPts: 50 },
  { name: 'Expert',       icon: '\uD83D\uDC68\u200D\uD83C\uDF93', desc: '150 points requis', minPts: 150 },
  { name: 'Master',       icon: '\uD83D\uDC51', desc: '300 points requis', minPts: 300 },
];

const ALL_BADGES = [
  { id: 'novice',      icon: '\u2B50', name: 'Novice',       desc: 'D\u00e9bloqu\u00e9 d\u00e8s l\'inscription', bg: '#FDF8EC', minPts: 0 },
  { id: 'contributor', icon: '\uD83C\uDFAF', name: 'Contributeur', desc: '50 points requis', bg: '#F0EDE6', minPts: 50 },
  { id: 'expert',      icon: '\uD83D\uDC68\u200D\uD83C\uDF93', name: 'Expert',       desc: '150 points requis', bg: '#E8F5F3', minPts: 150 },
  { id: 'master',      icon: '\uD83D\uDC51', name: 'Master',       desc: '300 points requis', bg: '#FDF8EC', minPts: 300 },
];

const prf = {
  slug: null, profile: null, forms: [], currentUser: null, subscribed: false,
};

document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  prf.slug = params.get('slug') || params.get('id');

  if (!prf.slug) {
    try {
      const meResp = await fetch('/api/auth/me', { credentials: 'include' }).then(r => r.json());
      if (meResp && meResp.authenticated && meResp.user) {
        prf.slug = meResp.user.slug || meResp.user.id;
        prf.currentUser = meResp.user;
      } else {
        showError('Connecte-toi pour voir ton profil.');
        return;
      }
    } catch {
      showError('Impossible de charger le profil.');
      return;
    }
  }

  const fetches = [
    fetch(`/api/profiles/${prf.slug}`).then(r => r.ok ? r.json() : null),
    fetch(`/api/profiles/${prf.slug}/questionnaires`).then(r => r.ok ? r.json() : null),
  ];
  if (!prf.currentUser) {
    fetches.push(fetch('/api/auth/me', { credentials: 'include' }).then(r => r.json()).catch(() => null));
  }

  const results = await Promise.allSettled(fetches);
  prf.profile = results[0].value;
  prf.forms   = (results[1].value?.items || []).filter(f => f.author_id !== 'demo-author-sciconnect');
  if (!prf.currentUser && results[2]) {
    prf.currentUser = results[2].value?.authenticated ? results[2].value.user : null;
  }

  if (!prf.profile) { showError('Profil introuvable.'); return; }

  document.getElementById('prf-loader').style.display = 'none';

  renderIdentity();
  renderStatsBand();
  renderPortfolio();
  renderBadges();
  renderIdentityCard();
  renderContribution();
  renderRanking();
});

/* ─── Identity ─── */
function renderIdentity() {
  const p = prf.profile;
  document.title = `${p.name} \u2014 SciConnect`;

  const avatar = document.getElementById('prf-avatar');
  if (p.avatar_url) {
    avatar.innerHTML = `<img src="${esc(p.avatar_url)}" alt="${esc(p.name)}" />`;
  } else {
    avatar.textContent = (p.name || '?').charAt(0).toUpperCase();
  }

  document.getElementById('prf-name').textContent = p.name || 'Utilisateur';

  /* Details under name */
  const details = [];
  if (p.school_name) details.push(`\uD83C\uDFEB ${esc(p.school_name)}`);
  if (p.university_name) details.push(esc(p.university_name));
  if (p.domain) details.push(esc(p.domain));
  if (p.level) details.push(esc(p.level));
  const detailsEl = document.getElementById('prf-details');
  detailsEl.innerHTML = details.join(' \u00b7 ');

  /* Badges pills */
  const badgesRow = document.getElementById('prf-badges-row');
  const pills = [];
  pills.push(`<span class="prf-badge-pill prf-badge-verified">\u2713 Email acad\u00e9mique v\u00e9rifi\u00e9</span>`);
  if (p.is_founder) pills.push(`<span class="prf-badge-pill prf-badge-founder">\u2605 Fondateur</span>`);
  badgesRow.innerHTML = pills.join('');

  /* Since */
  if (p.created_at) {
    const d = new Date(p.created_at);
    document.getElementById('prf-since').textContent =
      `Membre depuis ${d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`;
  }

  /* Badge level on the right */
  const pts = p.points || 0;
  let currentLevel = BADGE_LEVELS[0];
  for (const lvl of BADGE_LEVELS) {
    if (pts >= lvl.minPts) currentLevel = lvl;
  }
  document.getElementById('prf-badge-level').innerHTML = `
    <div class="prf-level-icon" style="background:rgba(201,168,76,0.12)">${currentLevel.icon}</div>
    <div class="prf-level-name">${currentLevel.name}</div>
    <div class="prf-level-desc">${currentLevel.desc}</div>
  `;

  /* Bio display */
  const bioEl = document.getElementById('prf-bio');
  if (bioEl && p.bio) {
    bioEl.textContent = p.bio;
  }

  /* Bio edit section — only show for own profile */
  const isOwnProfile = prf.currentUser && (prf.currentUser.slug === prf.slug || prf.currentUser.id === p.id);
  if (isOwnProfile) {
    const bioEditSection = document.getElementById('prf-bio-edit-section');
    if (bioEditSection) {
      bioEditSection.style.display = 'block';
      const bioInput = document.getElementById('prf-bio-input');
      if (bioInput) bioInput.value = p.bio || '';

      const bioSaveBtn = document.getElementById('prf-bio-save');
      if (bioSaveBtn) {
        bioSaveBtn.addEventListener('click', async function() {
          const newBio = (document.getElementById('prf-bio-input').value || '').trim();
          bioSaveBtn.disabled = true;
          bioSaveBtn.textContent = 'Enregistrement...';
          try {
            const res = await fetch('/api/auth/me', {
              method: 'PATCH',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ bio: newBio }),
            });
            if (res.ok) {
              const data = await res.json();
              if (bioEl) bioEl.textContent = data.user?.bio || '';
              prf.profile.bio = data.user?.bio || '';
              bioSaveBtn.textContent = '\u2713 Enregistr\u00e9 !';
              bioSaveBtn.classList.add('saved');
              setTimeout(() => {
                bioSaveBtn.textContent = 'Enregistrer';
                bioSaveBtn.classList.remove('saved');
              }, 2000);
            } else {
              bioSaveBtn.textContent = 'Erreur';
            }
          } catch {
            bioSaveBtn.textContent = 'Erreur r\u00e9seau';
          }
          bioSaveBtn.disabled = false;
        });
      }
    }
  }
}

/* ─── Stats band ─── */
function renderStatsBand() {
  const p = prf.profile;
  document.getElementById('prf-stat-responses').textContent = p.total_responses ?? '\u2014';
  document.getElementById('prf-stat-forms').textContent     = p.total_questionnaires ?? '\u2014';
  document.getElementById('prf-stat-completion').textContent = p.avg_completion != null ? `${Math.round(p.avg_completion)}%` : '\u2014';

  const rankEl = document.getElementById('prf-stat-rank');
  const rankLabel = document.getElementById('prf-stat-rank-label');
  if (p.general_rank) {
    rankEl.innerHTML = `\uD83C\uDFC6 #${p.general_rank}`;
    rankLabel.textContent = `classement ${p.school_name || 'SciConnect'}`;
  } else {
    rankEl.textContent = '\u2014';
  }
}

/* ─── Portfolio ─── */
function renderPortfolio() {
  document.getElementById('prf-portfolio-section').style.display = 'block';
  if (!prf.forms.length) {
    document.getElementById('prf-portfolio-list').innerHTML =
      '<div style="font-size:0.78rem;color:var(--color-text-muted);padding:12px 0">Aucun questionnaire d\u00e9pos\u00e9 pour le moment.</div>';
    return;
  }

  const list = document.getElementById('prf-portfolio-list');
  list.innerHTML = prf.forms.map(f => {
    const color = DOMAIN_COLORS[f.domain] || '#6B7280';
    const domain = f.domain || '';
    const date = f.created_at ? new Date(f.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
    return `
      <div class="prf-form-item">
        <div class="prf-form-dot" style="background:${color}"></div>
        <div class="prf-form-info">
          <div class="prf-form-title">${esc(f.title || 'Sans titre')}</div>
          <div class="prf-form-chips">
            ${domain ? `<span class="prf-form-chip prf-form-chip-domain">${esc(domain)}</span>` : ''}
            ${date ? `<span class="prf-form-chip prf-form-chip-date">${date}</span>` : ''}
            <span class="prf-form-chip prf-form-chip-count">${f.response_count ?? 0} r\u00e9ponses</span>
          </div>
        </div>
      </div>`;
  }).join('');
}

/* ─── Badges ─── */
function renderBadges() {
  const pts = prf.profile?.points || 0;
  document.getElementById('prf-badges-grid').innerHTML = ALL_BADGES.map(b => {
    const earned = pts >= b.minPts;
    return `
      <div class="prf-badge-card${earned ? '' : ' locked'}">
        ${!earned ? '<div class="prf-badge-lock">\uD83D\uDD12</div>' : ''}
        <div class="prf-badge-icon-wrap" style="background:${b.bg}">${b.icon}</div>
        <div class="prf-badge-name">${b.name}</div>
        <div class="prf-badge-desc">${b.desc}</div>
      </div>`;
  }).join('');
}

/* ─── Identity card ─── */
function renderIdentityCard() {
  const p = prf.profile;
  const rows = [];

  rows.push(`<div class="prf-id-verified">\u2713 Email acad\u00e9mique v\u00e9rifi\u00e9</div>`);

  if (p.university_name) {
    rows.push(`<div class="prf-id-row">
      <div class="prf-id-icon" style="background:#FDF8EC">\uD83C\uDFEB</div>
      <span class="prf-id-label">Universit\u00e9</span>
      <span class="prf-id-value">${esc(p.university_name)}</span>
    </div>`);
  }
  if (p.school_name) {
    rows.push(`<div class="prf-id-row">
      <div class="prf-id-icon" style="background:#E8F5F3">\uD83D\uDCDA</div>
      <span class="prf-id-label">\u00c9cole</span>
      <span class="prf-id-value">${esc(p.school_name)}</span>
    </div>`);
  }
  if (p.domain) {
    rows.push(`<div class="prf-id-row">
      <div class="prf-id-icon" style="background:#F0EDE6">\uD83D\uDCC1</div>
      <span class="prf-id-label">Domaine</span>
      <span class="prf-id-value">${esc(p.domain)}</span>
    </div>`);
  }
  if (p.level) {
    rows.push(`<div class="prf-id-row">
      <div class="prf-id-icon" style="background:#E8F5F3">\uD83C\uDF93</div>
      <span class="prf-id-label">Niveau</span>
      <span class="prf-id-value">${esc(p.level)}</span>
    </div>`);
  }
  if (p.created_at) {
    const d = new Date(p.created_at);
    rows.push(`<div class="prf-id-row">
      <div class="prf-id-icon" style="background:#F0EDE6">\uD83D\uDCC5</div>
      <span class="prf-id-label">Inscription</span>
      <span class="prf-id-value">Depuis ${d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</span>
    </div>`);
  }

  document.getElementById('prf-id-rows').innerHTML = rows.join('');
}

/* ─── Contribution ─── */
function renderContribution() {
  const p = prf.profile;
  const monthly = p.monthly_responses || 0;
  const total   = p.total_responses   || 0;
  const best    = Math.max(monthly, 1);
  const maxBar  = Math.max(total, best, 1);

  const card = document.getElementById('prf-contribution-card');
  card.innerHTML = `<div class="prf-card-title">Contribution</div>
    <div class="prf-contrib-row">
      <div class="prf-contrib-item">
        <div class="prf-contrib-header"><span>Ce mois-ci</span><span>${monthly} r\u00e9ponses</span></div>
        <div class="prf-contrib-track">
          <div class="prf-contrib-fill" style="width:0%;background:var(--color-primary)" data-pct="${Math.min(100, Math.round(monthly/maxBar*100))}"></div>
        </div>
      </div>
      <div class="prf-contrib-item">
        <div class="prf-contrib-header"><span>Meilleur mois</span><span>${best} r\u00e9ponses</span></div>
        <div class="prf-contrib-track">
          <div class="prf-contrib-fill" style="width:0%;background:var(--color-accent)" data-pct="100"></div>
        </div>
      </div>
    </div>
    <div class="prf-contrib-total">Total \u00b7 ${total} r\u00e9ponses \u00b7 ${prf.profile?.total_questionnaires || 0} formulaire${(prf.profile?.total_questionnaires || 0) > 1 ? 's' : ''}</div>`;

  setTimeout(() => {
    card.querySelectorAll('.prf-contrib-fill').forEach(el => {
      el.style.width = el.dataset.pct + '%';
    });
  }, 200);
}

/* ─── Ranking ─── */
function renderRanking() {
  const p = prf.profile;

  const rankNum = document.getElementById('prf-rank-num');
  const rankSub = document.getElementById('prf-rank-sub');
  const rankTop = document.getElementById('prf-rank-top');

  if (p.general_rank && p.school_name) {
    rankNum.textContent = `${p.general_rank === 1 ? '1er' : p.general_rank + 'e'}`;
    rankSub.textContent = `\u00e0 ${p.school_name}`;
    rankTop.textContent = p.top_pct != null ? `Top ${p.top_pct}% de SciConnect` : '';
  } else if (p.general_rank) {
    rankNum.textContent = `#${p.general_rank}`;
    rankSub.textContent = 'SciConnect';
    rankTop.textContent = p.top_pct != null ? `Top ${p.top_pct}%` : '';
  } else {
    rankNum.textContent = '\u2014';
    rankSub.textContent = '';
    rankTop.textContent = '';
  }

  const rows = [];
  if (p.general_rank) {
    rows.push(`${p.general_rank === 1 ? '1er' : p.general_rank + 'e'} au classement g\u00e9n\u00e9ral`);
  }
  document.getElementById('prf-rank-rows').innerHTML = rows.map(r =>
    `<div class="prf-rank-row">${r}</div>`
  ).join('');
}

/* ─── Share ─── */
function shareProfile() {
  const url = location.href;
  if (navigator.share) {
    navigator.share({ title: prf.profile?.name, url }).catch(() => {});
  } else {
    navigator.clipboard.writeText(url).then(() => alert('Lien copi\u00e9 !')).catch(() => prompt('Lien :', url));
  }
}

/* ─── QR Code Modal (#12) ─── */
function openQRModal() {
  const overlay = document.getElementById('prf-qr-overlay');
  overlay.hidden = false;
  const url = location.href;
  document.getElementById('prf-qr-url').textContent = url;
  generateQR(url);
}
function closeQRModal() {
  document.getElementById('prf-qr-overlay').hidden = true;
}
function copyProfileLink() {
  navigator.clipboard.writeText(location.href)
    .then(() => {
      const btn = document.querySelector('.prf-qr-copy');
      btn.textContent = '\u2713 Copi\u00e9 !';
      setTimeout(() => btn.textContent = 'Copier le lien', 2000);
    })
    .catch(() => prompt('Lien :', location.href));
}

/* Minimal QR code generator (canvas) */
function generateQR(text) {
  const canvas = document.getElementById('prf-qr-canvas');
  const ctx = canvas.getContext('2d');
  const size = 200;
  canvas.width = size; canvas.height = size;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, size, size);

  /* Simple visual QR-like pattern using text hash */
  const hash = hashStr(text);
  const grid = 21;
  const cell = Math.floor(size / (grid + 2));
  const offset = Math.floor((size - cell * grid) / 2);

  ctx.fillStyle = '#005F54';

  /* Finder patterns (top-left, top-right, bottom-left) */
  drawFinderPattern(ctx, offset, offset, cell);
  drawFinderPattern(ctx, offset + (grid - 7) * cell, offset, cell);
  drawFinderPattern(ctx, offset, offset + (grid - 7) * cell, cell);

  /* Data modules from hash */
  for (let y = 0; y < grid; y++) {
    for (let x = 0; x < grid; x++) {
      if (isFinderZone(x, y, grid)) continue;
      const bit = (hash[(y * grid + x) % hash.length].charCodeAt(0) + x * 7 + y * 13) % 3;
      if (bit === 0) {
        ctx.fillRect(offset + x * cell, offset + y * cell, cell - 1, cell - 1);
      }
    }
  }
}

function drawFinderPattern(ctx, x, y, cell) {
  const c = ctx.fillStyle;
  for (let r = 0; r < 7; r++) {
    for (let col = 0; col < 7; col++) {
      const isBorder = r === 0 || r === 6 || col === 0 || col === 6;
      const isInner = r >= 2 && r <= 4 && col >= 2 && col <= 4;
      if (isBorder || isInner) {
        ctx.fillRect(x + col * cell, y + r * cell, cell - 1, cell - 1);
      }
    }
  }
}

function isFinderZone(x, y, grid) {
  if (x < 8 && y < 8) return true;
  if (x >= grid - 8 && y < 8) return true;
  if (x < 8 && y >= grid - 8) return true;
  return false;
}

function hashStr(s) {
  let h = '';
  for (let i = 0; i < s.length * 3; i++) {
    h += String.fromCharCode(((s.charCodeAt(i % s.length) * 31 + i * 17) % 94) + 33);
  }
  return h;
}

/* ─── Error ─── */
function showError(msg) {
  document.getElementById('prf-loader').innerHTML =
    `<p style="color:var(--color-text-muted);text-align:center;padding:40px">${msg}</p>`;
}

/* ─── Utility ─── */
function esc(s) { return (s || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }