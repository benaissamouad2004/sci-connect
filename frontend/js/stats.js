/* ═══════════════════════════════════════════════════════════
   SCICONNECT — Statistiques v2
   ═══════════════════════════════════════════════════════════ */

const statsState = {
  formId:        null,
  questionnaire: null,
  responses:     [],
  stats:         null,
  benchmark:     null,
  settings:      null,
  content:       null,
  chart:         null,
  currentPage:   1,
  perPage:       10,
  user:          null,
};

/* EDITABLE: couleurs domaine */
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

/* ─── Initialisation ─── */
document.addEventListener('DOMContentLoaded', async () => {
  const loaded = await loadContent();
  if (loaded) {
    statsState.settings = loaded.settings;
    statsState.content  = loaded.content;
  }

  const params = new URLSearchParams(window.location.search);
  statsState.formId = params.get('id');

  const me = await fetch('/api/auth/me', { credentials: 'include' })
                    .then(r => r.json()).catch(() => null);

  if (!me || !me.authenticated) {
    window.location.href = '/login.html';
    return;
  }

  statsState.user = me.user;
  renderIdentityCard(me.user);
  renderSidebarReciprocity(me.user.monthly_responses_given || 0);

  /* Lien profil public dans la nav */
  const navProfile = document.getElementById('nav-profile');
  if (navProfile) {
    navProfile.href = me.user.slug ? `profile.html?slug=${me.user.slug}` : 'profile.html';
  }

  if (!statsState.formId) {
    await findMyQuestionnaire(me.user.id);
  } else {
    await Promise.all([loadStats(), loadResponses()]);
    loadBenchmark();
  }
});

async function findMyQuestionnaire(userId) {
  try {
    const resp = await fetch('/api/forms?limit=50', { credentials: 'include' });
    if (!resp.ok) return showNoForm();
    const data  = await resp.json();
    const mine  = (data.items || []).find(f => f.author_id === userId);
    if (!mine)  return showNoForm();
    statsState.formId = mine.id;
    await Promise.all([loadStats(), loadResponses()]);
    loadBenchmark();
  } catch {
    showNoForm();
  }
}

/* ─── Stats ─── */
async function loadStats() {
  try {
    const resp = await fetch(`/api/forms/${statsState.formId}/stats`, { credentials: 'include' });
    if (!resp.ok) {
      if (resp.status === 403) return showToast('Accès non autorisé.', 'error');
      return;
    }
    const data = await resp.json();
    statsState.stats         = data;
    statsState.questionnaire = data.questionnaire;
    renderHeader(data);
    renderMetricCards(data);
    renderChart(data);
    renderMethodoParagraph(data);
    renderExportNote(data);
    renderCityMap(data);
  } catch (err) {
    console.error('Erreur stats:', err);
  }
}

/* ─── Responses ─── */
async function loadResponses() {
  try {
    const resp = await fetch(`/api/forms/${statsState.formId}/responses`, { credentials: 'include' });
    if (!resp.ok) return;
    const data = await resp.json();
    statsState.responses  = data.items || [];
    statsState.currentPage = 1;
    renderResponsesTable();
  } catch (err) {
    console.error('Erreur réponses:', err);
  }
}

/* ─── Benchmark ─── */
async function loadBenchmark() {
  try {
    const resp = await fetch(`/api/forms/${statsState.formId}/benchmark`, { credentials: 'include' });
    if (!resp.ok) return;
    const data = await resp.json();
    statsState.benchmark = data;
    renderBenchmark(data);
  } catch (err) {
    console.error('Erreur benchmark:', err);
  }
}

/* ─── Sidebar identity (copié de dashboard.js) ─── */
function renderIdentityCard(user) {
  const avatarEl = document.getElementById('identity-avatar');
  const nameEl   = document.getElementById('identity-name');
  const metaEl   = document.getElementById('identity-meta');
  const ptsEl    = document.getElementById('identity-pts');

  if (avatarEl) {
    if (user.avatar_url) {
      avatarEl.innerHTML = `<img src="${escAttr(user.avatar_url)}" alt="${escAttr(user.name || '')}" loading="lazy">`;
    } else {
      avatarEl.textContent = (user.name || 'U')[0].toUpperCase();
    }
  }
  if (nameEl) nameEl.textContent = user.name || user.email || '';
  if (metaEl) metaEl.textContent = [user.school_id, user.level].filter(Boolean).join(' · ');
  if (ptsEl)  ptsEl.textContent  = `★ ${user.points || 0} pts`;

  const pct = { novice: 20, contributor: 40, expert: 70, master: 100 }[user.badge_level] || 20;
  const fill = document.getElementById('ring-fill');
  const txt  = document.getElementById('ring-badge-text');
  if (fill) fill.style.strokeDashoffset = 138.2 * (1 - pct / 100);
  if (txt) {
    const icons = { novice: '⭐', contributor: '🎯', expert: '🏆', master: '👑' };
    txt.textContent = icons[user.badge_level] || '⭐';
  }
}

function renderSidebarReciprocity(count) {
  const el = document.getElementById('sidebar-recip-content');
  if (!el) return;
  const state = count >= 2 ? 'unlocked' : count === 1 ? 'half' : 'locked';
  if (state === 'unlocked') {
    el.innerHTML = `<div class="recip-state-card unlocked">
      <div class="recip-state-header">
        <span class="recip-state-icon">🔓</span>
        <span class="recip-state-title">Dépôt déverrouillé</span>
      </div>
      <div class="recip-progress-track"><div class="recip-progress-fill" style="width:100%"></div></div>
      <a href="deposit.html" class="recip-link">Déposer un questionnaire →</a>
    </div>`;
  } else if (state === 'half') {
    el.innerHTML = `<div class="recip-state-card half">
      <div class="recip-state-header">
        <span class="recip-state-icon">⏳</span>
        <span class="recip-state-title">1 réponse donnée sur 2</span>
      </div>
      <div class="recip-progress-track"><div class="recip-progress-fill half" style="width:50%"></div></div>
      <a href="dashboard.html#feed-grid" class="recip-link">Répondre à 1 de plus →</a>
    </div>`;
  } else {
    el.innerHTML = `<div class="recip-state-card locked">
      <div class="recip-state-header">
        <span class="recip-state-icon">🔒</span>
        <span class="recip-state-title">Dépôt verrouillé</span>
      </div>
      <div class="recip-progress-track"><div class="recip-progress-fill locked" style="width:0%"></div></div>
      <a href="dashboard.html#feed-grid" class="recip-link">Répondre maintenant →</a>
    </div>`;
  }
}

/* ─── Header ─── */
function renderHeader(data) {
  const q = data.questionnaire;
  const titleEl = document.getElementById('st-title');
  const metaEl  = document.getElementById('st-meta');
  if (titleEl) titleEl.textContent = q.title || 'Statistiques';
  if (metaEl) {
    const parts = [q.domain, q.target_level].filter(Boolean);
    metaEl.textContent = parts.join(' · ');
  }
  document.title = `${q.title || 'Statistiques'} — SciConnect`;
}

/* ─── 4 Metric Cards ─── */
function renderMetricCards(data) {
  const total     = data.total_responses || 0;
  const target    = data.questionnaire?.target_count || 100;
  const verified  = data.verified || 0;
  const pub       = data.public || 0;
  const anon      = total - verified - pub;
  const validated = data.validated || 0;
  const pctGoal   = data.pct_of_goal || 0;
  const avgComp   = data.avg_completion || 0;
  const complete  = Math.round(total * avgComp / 100);
  const abandoned = total - complete;

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

  set('metric-total',     total);
  set('metric-goal-sub',  `sur ${target} visées`);
  set('metric-completion', `${avgComp.toFixed(0)}%`);
  set('metric-complete-sub', `${complete} complètes · ${Math.max(0, abandoned)} abandonnées`);
  set('metric-verified',  `${verified}`);
  set('dot-verified',     `${verified} vérifiés`);
  set('dot-public',       `${pub} public général`);
  set('dot-anon',         `${Math.max(0, anon)} anonymes`);
  set('metric-goal',      `${pctGoal.toFixed(0)}%`);
  set('metric-validated-sub', `${validated} validées par émetteur`);

  const barEl = document.getElementById('metric-goal-bar');
  if (barEl) barEl.style.width = Math.min(pctGoal, 100) + '%';
}

/* ─── Graphique Chart.js ─── */
function renderChart(data) {
  const canvas = document.getElementById('completion-chart');
  if (!canvas) return;
  if (statsState.chart) { statsState.chart.destroy(); statsState.chart = null; }

  /* EDITABLE: couleur barres depuis --color-primary */
  const primaryColor = getComputedStyle(document.documentElement)
    .getPropertyValue('--color-primary').trim() || '#005F54';
  const orangeColor = getComputedStyle(document.documentElement)
    .getPropertyValue('--color-warning').trim() || '#BA6A1A';

  const total = data.total_responses || 0;

  /* Simuler des données par question (en attente de l'API Forms détaillée) */
  const labels = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'Q8'];
  const base   = Math.max(total, 1);
  const values = [
    base,
    Math.round(base * 0.96),
    Math.round(base * 0.91),
    Math.round(base * 0.87),
    Math.round(base * 0.78),
    Math.round(base * 0.74),
    Math.round(base * 0.72),
    Math.round(base * 0.70),
  ];

  /* Détecter la question avec le plus fort écart (point de chute) */
  let dropQ = -1;
  let maxDrop = 0;
  for (let i = 1; i < values.length; i++) {
    const drop = values[i - 1] - values[i];
    if (drop > maxDrop) { maxDrop = drop; dropQ = i; }
  }

  /* EDITABLE: seuil de chute — 15% du total minimum pour déclencher le conseil */
  const dropThreshold = Math.max(2, total * 0.15);
  const dropDetected  = maxDrop >= dropThreshold && total > 0;

  const colors = values.map((_, i) =>
    (dropDetected && i === dropQ) ? orangeColor : primaryColor
  );

  statsState.chart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Réponses',
        data: values,
        /* EDITABLE: couleurs des barres — teal sauf question de chute en orange */
        backgroundColor: colors,
        borderRadius: 4,
        borderSkipped: false,
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => {
              const pct = total > 0 ? ((ctx.parsed.x / total) * 100).toFixed(0) : 0;
              return ` ${ctx.parsed.x} rép. (${pct}%)`;
            }
          }
        }
      },
      scales: {
        x: {
          beginAtZero: true,
          max: Math.max(total, 1),
          grid: { color: 'var(--color-border)' },
          ticks: { color: '#9A9890', font: { family: 'DM Sans, sans-serif', size: 11 } }
        },
        y: {
          grid: { display: false },
          ticks: { color: '#57564F', font: { family: 'DM Sans, sans-serif', size: 11 } }
        }
      }
    }
  });

  /* Afficher/masquer le conseil prescriptif */
  renderConseilPrescriptif(dropDetected, dropQ, values, total);
}

function renderConseilPrescriptif(detected, dropQ, values, total) {
  const pill    = document.getElementById('dropoff-pill');
  const conseil = document.getElementById('st-conseil');
  const title   = document.getElementById('conseil-title');
  const body    = document.getElementById('conseil-body');

  if (!detected || !conseil) {
    if (pill)    pill.style.display    = 'none';
    if (conseil) conseil.style.display = 'none';
    return;
  }

  const qNum  = dropQ + 1;
  const lost  = values[dropQ - 1] - values[dropQ];
  const pct   = total > 0 ? Math.round((lost / total) * 100) : 0;

  if (pill)   { pill.style.display = 'inline-block'; }
  if (conseil) { conseil.style.display = 'block'; }
  if (title)  title.textContent = `⚠ Point de chute détecté à la Q${qNum}`;
  if (body)   body.textContent  = `La question ${qNum} fait perdre ${pct}% de tes répondants (−${lost} abandons).`;
}

/* ─── Carte SVG Maroc ─── */
/* EDITABLE: villes et proportions — ajuster selon les vraies données démographiques */
function renderCityMap(data) {
  const total = data.total_responses || 0;
  if (total === 0) {
    const el = document.getElementById('map-empty');
    if (el) el.style.display = 'block';
    return;
  }

  /* Répartition approximative selon l'échantillon marocain type */
  const CITY_WEIGHTS = {
    casablanca: 0.30,
    rabat:      0.20,
    fes:        0.18,
    marrakech:  0.22,
    agadir:     0.10,
  };

  /* Rayon min/max des cercles en SVG px */
  const R_MIN = 4;
  const R_MAX = 22;

  Object.entries(CITY_WEIGHTS).forEach(([city, weight]) => {
    const count  = Math.round(total * weight);
    const radius = R_MIN + (R_MAX - R_MIN) * weight;

    const circle = document.getElementById(`city-${city}`);
    const label  = document.getElementById(`city-${city}-label`);

    if (circle) {
      circle.setAttribute('r', radius.toFixed(1));
      circle.setAttribute('title', `${city}: ${count} rép.`);
    }
    if (label) {
      const cityName = city.charAt(0).toUpperCase() + city.slice(1);
      label.textContent = `${cityName} · ${count} rép.`;
      label.style.display = 'block';
    }
  });
}

/* ─── Benchmark ─── */
function renderBenchmark(data) {
  const el = document.getElementById('benchmark-body');
  if (!el) return;

  const my   = data.my   || {};
  const comm = data.community || {};

  const metrics = [
    {
      label: 'Taux de complétion',
      mine:  my.completion_rate   || 0,
      comm:  comm.completion_rate || 78,
      unit:  '%',
      max:   100,
    },
    {
      label: 'Réponses / jour',
      mine:  my.responses_per_day   || 0,
      comm:  comm.responses_per_day || 3.2,
      unit:  '',
      max:   Math.max((my.responses_per_day || 0), (comm.responses_per_day || 3.2)) * 1.3,
    },
    {
      label: 'Profils vérifiés',
      mine:  my.verified_pct   || 0,
      comm:  comm.verified_pct || 62,
      unit:  '%',
      max:   100,
    },
  ];

  el.innerHTML = metrics.map(m => {
    const myPct   = Math.min(100, (m.mine / m.max) * 100).toFixed(1);
    const commPct = Math.min(100, (m.comm / m.max) * 100).toFixed(1);
    const diff    = m.mine - m.comm;
    const diffStr = diff >= 0
      ? `+${diff.toFixed(1)}${m.unit} au-dessus 🎉`
      : `${diff.toFixed(1)}${m.unit} en dessous`;
    const verdictClass = diff >= 0 ? 'st-bench-verdict--good' : 'st-bench-verdict--low';

    return `<div class="st-bench-row">
      <div class="st-bench-label">
        <span>${m.label}</span>
        <span class="st-bench-verdict ${verdictClass}">${diffStr}</span>
      </div>
      <div class="st-bench-bars">
        <div class="st-bench-bar-wrap">
          <div class="st-bench-bar-track">
            <div class="st-bench-bar-fill st-bench-bar-fill--mine" style="width:${myPct}%"></div>
          </div>
          <span class="st-bench-bar-val">${m.mine.toFixed(1)}${m.unit}</span>
        </div>
        <div class="st-bench-bar-wrap">
          <div class="st-bench-bar-track">
            <div class="st-bench-bar-fill st-bench-bar-fill--comm" style="width:${commPct}%"></div>
          </div>
          <span class="st-bench-bar-val" style="color:var(--color-text-muted)">${m.comm.toFixed(1)}${m.unit}</span>
        </div>
      </div>
    </div>`;
  }).join('');

  /* Légende */
  el.innerHTML += `<div style="display:flex;gap:16px;font-size:0.72rem;color:var(--color-text-muted);margin-top:4px">
    <span style="display:flex;align-items:center;gap:5px">
      <span style="width:12px;height:4px;border-radius:2px;background:var(--color-primary);display:inline-block"></span>
      Mon questionnaire
    </span>
    <span style="display:flex;align-items:center;gap:5px">
      <span style="width:12px;height:4px;border-radius:2px;background:var(--color-border);display:inline-block"></span>
      Moyenne SciConnect
    </span>
  </div>`;
}

/* ─── Tableau répondants ─── */
function renderResponsesTable() {
  const tbody    = document.getElementById('responses-tbody');
  const pagEl    = document.getElementById('st-pagination');
  const infoEl   = document.getElementById('pagination-info');
  const pagesEl  = document.getElementById('pagination-pages');
  const btnPrev  = document.getElementById('btn-prev');
  const btnNext  = document.getElementById('btn-next');

  if (!tbody) return;

  const all    = statsState.responses;
  const total  = all.length;
  const pages  = Math.max(1, Math.ceil(total / statsState.perPage));
  const page   = statsState.currentPage;
  const start  = (page - 1) * statsState.perPage;
  const slice  = all.slice(start, start + statsState.perPage);

  /* EDITABLE: labels boutons depuis admin/settings.json */
  const validateLabel = statsState.settings?.buttons?.validate_button_label || 'Valider';
  const ignoreLabel   = statsState.settings?.buttons?.ignore_button_label   || 'Ignorer';

  if (!slice.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--color-text-muted)">
      Aucune réponse pour l'instant.
    </td></tr>`;
    if (pagEl) pagEl.style.display = 'none';
    return;
  }

  tbody.innerHTML = slice.map((r, idx) => {
    const dateStr = r.created_at
      ? new Date(r.created_at).toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })
      : '—';

    const typeBadge = {
      verified:  '<span class="pill pill-teal">Étudiant vérifié ✓</span>',
      public:    '<span class="pill pill-gold">Public général</span>',
      anonymous: '<span class="pill pill-grey">Anonyme</span>',
    }[r.respondent_type] || `<span class="pill pill-grey">Anonyme</span>`;

    const statusBadge = r.validated_by_emitter
      ? '<span class="pill pill-teal">Validé ✓</span>'
      : r.ignored_by_emitter
        ? '<span class="pill pill-grey">Ignoré</span>'
        : '<span class="pill pill-gold">En attente</span>';

    const actions = (!r.validated_by_emitter && !r.ignored_by_emitter)
      ? `<div style="display:flex;gap:5px">
           <button class="st-action-btn st-action-btn--validate" onclick="validateResp('${r.id}', this)">${escHtml(validateLabel)}</button>
           <button class="st-action-btn st-action-btn--ignore"   onclick="ignoreResp('${r.id}', this)">${escHtml(ignoreLabel)}</button>
         </div>`
      : '—';

    return `<tr data-id="${r.id}">
      <td>${typeBadge}</td>
      <td style="font-size:0.76rem;color:var(--color-text-secondary);white-space:nowrap">${dateStr}</td>
      <td>
        <div style="display:flex;align-items:center;gap:7px">
          <div style="flex:1;height:5px;background:var(--color-surface-2);border-radius:100px;overflow:hidden;min-width:50px">
            <div style="height:100%;background:var(--color-primary);width:${r.completion_percentage || 0}%"></div>
          </div>
          <span style="font-size:0.72rem;color:var(--color-text-muted);white-space:nowrap">${(r.completion_percentage || 0).toFixed(0)}%</span>
        </div>
      </td>
      <td>${statusBadge}</td>
      <td>${actions}</td>
    </tr>`;
  }).join('');

  /* Pagination */
  if (pagEl) pagEl.style.display = total > statsState.perPage ? 'flex' : 'none';
  if (infoEl)  infoEl.textContent  = `${start + 1}–${Math.min(start + statsState.perPage, total)} sur ${total}`;
  if (pagesEl) pagesEl.textContent = `${page} / ${pages}`;
  if (btnPrev) btnPrev.disabled = page <= 1;
  if (btnNext) btnNext.disabled = page >= pages;
}

function changePage(delta) {
  const pages = Math.ceil(statsState.responses.length / statsState.perPage);
  statsState.currentPage = Math.max(1, Math.min(pages, statsState.currentPage + delta));
  renderResponsesTable();
}

/* ─── Onglets export ─── */
function switchTab(name, btn) {
  document.querySelectorAll('.st-tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.st-tab-btn').forEach(b => b.classList.remove('active'));
  const panel = document.getElementById(`tab-${name}`);
  if (panel) panel.classList.add('active');
  if (btn)   btn.classList.add('active');
}

/* ─── Paragraphe méthodologique ─── */
function renderMethodoParagraph(data) {
  const el = document.getElementById('methodo-text');
  if (!el) return;

  const q         = data.questionnaire;
  const total     = data.total_responses || 0;
  const verified  = data.verified || 0;
  const avgComp   = (data.avg_completion || 0).toFixed(1);
  const pctVerif  = total > 0 ? ((verified / total) * 100).toFixed(1) : 0;
  const complete  = Math.round(total * (data.avg_completion || 0) / 100);

  const dateDebut = q?.created_at
    ? new Date(q.created_at).toLocaleDateString('fr-FR', { day:'numeric', month:'long', year:'numeric' })
    : '[date de début]';
  const dateFin = new Date().toLocaleDateString('fr-FR', { day:'numeric', month:'long', year:'numeric' });

  el.textContent = `Les données ont été collectées via SciConnect entre le ${dateDebut} et le ${dateFin}. Sur ${total} répondants, ${complete} ont fourni des réponses complètes, représentant un taux de complétion de ${avgComp}%. ${verified} répondants ont été vérifiés via email académique institutionnel, représentant ${pctVerif}% de l'échantillon.`;
}

function copyParagraph() {
  const el = document.getElementById('methodo-text');
  if (!el) return;
  navigator.clipboard.writeText(el.textContent).then(() => {
    showToast('Paragraphe copié dans le presse-papiers !', 'success');
  }).catch(() => {
    /* Fallback pour les navigateurs sans clipboard API */
    const ta = document.createElement('textarea');
    ta.value = el.textContent;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('Paragraphe copié !', 'success');
  });
}

/* ─── Note d'export ─── */
function renderExportNote(data) {
  const el = document.getElementById('export-note');
  if (!el) return;
  const total = data.total_responses || 0;
  el.textContent = `${total} ligne${total > 1 ? 's' : ''} · 4 feuilles · graphiques inclus`;
}

/* ─── Export Excel ─── */
async function exportExcel() {
  if (!statsState.formId) return;
  const btns = ['export-btn', 'export-btn-main'].map(id => document.getElementById(id)).filter(Boolean);
  btns.forEach(b => { b.disabled = true; });

  try {
    const link  = document.createElement('a');
    link.href   = `/api/forms/${statsState.formId}/export`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Export Excel en cours de téléchargement…', 'success');
  } catch {
    showToast("Erreur lors de l'export.", 'error');
  } finally {
    btns.forEach(b => { b.disabled = false; });
  }
}

/* ─── Partager le lien ─── */
function shareLink() {
  if (!statsState.formId) return;
  const url = `${window.location.origin}/respond.html?id=${statsState.formId}`;
  navigator.clipboard.writeText(url).then(() => {
    showToast('Lien de partage copié !', 'success');
  }).catch(() => {
    showToast(`Lien : ${url}`, 'info');
  });
}

/* ─── PDF ─── */
function generatePdf() {
  showToast('Rapport PDF — fonctionnalité bientôt disponible.', 'info');
}

/* ─── Déconnexion ─── */
async function logout() {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
  window.location.href = '/login.html';
}

/* ─── Valider / Ignorer réponses ─── */
async function validateResp(id, btn) {
  try {
    const resp = await fetch(`/api/responses/${id}/validate`, { method: 'POST', credentials: 'include' });
    if (resp.ok) {
      const row = btn.closest('tr');
      if (row) {
        row.querySelector('td:nth-child(5)').innerHTML = '<span class="pill pill-teal">Validé ✓</span>';
        row.querySelector('td:nth-child(6)').textContent = '—';
      }
      showToast('Réponse validée.', 'success');
    }
  } catch {
    showToast('Erreur réseau.', 'error');
  }
}

async function ignoreResp(id, btn) {
  try {
    const resp = await fetch(`/api/responses/${id}/ignore`, { method: 'POST', credentials: 'include' });
    if (resp.ok) {
      const row = btn.closest('tr');
      if (row) {
        row.querySelector('td:nth-child(5)').innerHTML = '<span class="pill pill-grey">Ignoré</span>';
        row.querySelector('td:nth-child(6)').textContent = '—';
      }
      showToast('Réponse ignorée.', 'info');
    }
  } catch {
    showToast('Erreur réseau.', 'error');
  }
}

/* ─── État vide ─── */
function showNoForm() {
  const main = document.getElementById('st-main-content');
  if (main) main.innerHTML = `
    <div style="text-align:center;padding:80px 24px;color:var(--color-text-muted)">
      <div style="font-size:2.5rem;margin-bottom:16px">📋</div>
      <div style="font-size:1rem;font-weight:600;color:var(--color-text-secondary);margin-bottom:8px">Aucun questionnaire actif</div>
      <div style="font-size:0.88rem;margin-bottom:24px">Dépose ton premier questionnaire pour voir tes statistiques ici.</div>
      <a href="deposit.html" style="display:inline-flex;align-items:center;gap:8px;padding:10px 20px;background:var(--color-primary);color:#fff;border-radius:var(--radius-md);text-decoration:none;font-weight:600">
        ↑ Déposer un questionnaire
      </a>
    </div>`;
}

/* ─── Utilitaires ─── */
function escHtml(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function escAttr(str) {
  return (str || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}