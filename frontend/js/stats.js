/* ═══════════════════════════════════════════════════════════
   SCICONNECT — Statistiques V4
   Multi-questionnaire selector + per-form stats + Excel export
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

const st = {
  formId:       null,
  form:         null,
  stats:        null,
  responses:    [],
  myForms:      [],
  user:         null,
  showAll:      false,
  charts:       {},
  selectedIdx:  -1,
};

const PREVIEW_COUNT = 5;

document.addEventListener('DOMContentLoaded', async () => {
  /* Check auth */
  try {
    const meResp = await fetch('/api/auth/me', { credentials: 'include' });
    const meData = await meResp.json();
    if (!meData.authenticated) {
      window.location.replace('login.html');
      return;
    }
    st.user = meData.user;
  } catch {
    window.location.replace('login.html');
    return;
  }

  /* Check if a specific form ID was provided in URL */
  const params = new URLSearchParams(window.location.search);
  const urlFormId = params.get('id');

  /* Load user's forms */
  await loadMyForms();

  if (urlFormId) {
    /* Direct link to a specific form's stats */
    const idx = st.myForms.findIndex(f => f.id === urlFormId);
    if (idx >= 0) {
      selectForm(idx);
    } else {
      /* Form ID not in user's list — try loading directly */
      st.formId = urlFormId;
      await loadFormStats(urlFormId);
    }
  } else if (st.myForms.length === 1) {
    /* Auto-select if only one form */
    selectForm(0);
  }
});

/* ─── Load user's questionnaires ─── */
async function loadMyForms() {
  try {
    const res = await fetch('/api/forms?limit=50', { credentials: 'include' });
    const data = await res.json();
    st.myForms = (data.items || []).filter(f => f.author_id === st.user?.id);
  } catch {
    st.myForms = [];
  }

  document.getElementById('st-loader').style.display = 'none';

  if (st.myForms.length === 0) {
    showEmptyState();
    return;
  }

  renderSelector();
}

/* ─── Empty state ─── */
function showEmptyState() {
  const selector = document.getElementById('st-selector');
  selector.style.display = 'block';
  selector.innerHTML = `
    <div class="st-empty">
      <div class="st-empty-icon">📊</div>
      <p><strong>Aucun questionnaire déposé</strong></p>
      <p>Dépose ton premier questionnaire pour voir les statistiques ici.</p>
      <a href="deposit.html" class="st-empty-link">+ Déposer un questionnaire</a>
    </div>
  `;
}

/* ─── Render questionnaire selector ─── */
function renderSelector() {
  const selector = document.getElementById('st-selector');
  selector.style.display = 'block';
  document.getElementById('st-selector-count').textContent =
    `${st.myForms.length} questionnaire${st.myForms.length > 1 ? 's' : ''}`;

  const list = document.getElementById('st-form-list');
  list.innerHTML = st.myForms.map((f, i) => {
    const color = DOMAIN_COLORS[f.domain] || '#6B7280';
    const date = f.created_at
      ? new Date(f.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
      : '';
    const isActive = i === st.selectedIdx;

    return `
      <div class="st-form-item${isActive ? ' active' : ''}" onclick="selectForm(${i})" id="st-form-item-${i}">
        <div class="st-form-dot" style="background:${color}"></div>
        <div class="st-form-item-info">
          <div class="st-form-item-title">${escHtml(f.title || 'Sans titre')}</div>
          <div class="st-form-item-meta">${[f.domain, date].filter(Boolean).join(' · ')}</div>
        </div>
        <div class="st-form-item-stats">
          <div class="st-form-item-stat">
            <div class="st-form-item-stat-val">${f.response_count ?? 0}</div>
            <div class="st-form-item-stat-label">réponses</div>
          </div>
          <div class="st-form-item-stat">
            <div class="st-form-item-stat-val">${f.target_count || 100}</div>
            <div class="st-form-item-stat-label">objectif</div>
          </div>
        </div>
        <div class="st-form-item-arrow">→</div>
      </div>
    `;
  }).join('');
}

/* ─── Select a form ─── */
async function selectForm(idx) {
  st.selectedIdx = idx;
  const form = st.myForms[idx];
  st.formId = form.id;

  /* Update active state in selector */
  document.querySelectorAll('.st-form-item').forEach((el, i) => {
    el.classList.toggle('active', i === idx);
  });

  await loadFormStats(form.id);
}

/* ─── Load stats for a specific form ─── */
async function loadFormStats(formId) {
  /* Show topbar actions */
  document.getElementById('st-topbar-actions').style.display = 'flex';

  /* Destroy existing charts */
  Object.values(st.charts).forEach(c => { if (c && c.destroy) c.destroy(); });
  st.charts = {};
  st.showAll = false;

  try {
    const [formResp, statsResp, respResp] = await Promise.all([
      fetch(`/api/forms/${formId}`,          { credentials: 'include' }),
      fetch(`/api/forms/${formId}/stats`,    { credentials: 'include' }),
      fetch(`/api/forms/${formId}/responses`, { credentials: 'include' }),
    ]);

    if (!formResp.ok) throw new Error('form');
    st.form = await formResp.json();
    if (statsResp.ok)  st.stats     = await statsResp.json();
    if (respResp.ok)   { const d = await respResp.json(); st.responses = d.items || []; }
  } catch {
    showError('Impossible de charger les statistiques pour ce questionnaire.');
    return;
  }

  /* Show stats content */
  const content = document.getElementById('st-stats-content');
  content.classList.add('visible');

  renderTopbar();
  renderMetrics();
  renderLineChart();
  renderBarChart();
  renderDonuts();
  renderTable();
  renderExportSection();
  renderMethodParagraph();

  /* Scroll to stats */
  content.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ─── Topbar ─── */
function renderTopbar() {
  document.title = `Stats — ${st.form.title || 'Questionnaire'} — SciConnect`;
  document.getElementById('st-form-title').textContent = st.form.title || 'Sans titre';

  const last = st.responses[0]?.created_at;
  if (last) {
    const diff = Math.round((Date.now() - new Date(last).getTime()) / 1000);
    const rel  = diff < 60 ? `${diff}s` : diff < 3600 ? `${Math.round(diff/60)}min` : `${Math.round(diff/3600)}h`;
    document.getElementById('st-updated').textContent = `Mis à jour il y a ${rel}`;
  } else {
    document.getElementById('st-updated').textContent = '';
  }

  const slug  = st.form.title ? st.form.title.toLowerCase().replace(/\s+/g, '_').slice(0, 20) : 'form';
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  document.getElementById('st-filename-label').textContent = `${slug}_${today}.xlsx`;
}

/* ─── Metrics ─── */
function renderMetrics() {
  const s = st.stats || {};
  const total    = s.total_responses    ?? st.responses.length;
  const complete = s.complete_count     ?? st.responses.filter(r => r.is_complete).length;
  const abandoned = total - complete;
  const avgSec   = s.avg_duration_sec   ?? computeAvgDuration();
  const lastResp = st.responses[0];
  const target   = st.form.target_count || 100;

  const metrics = [
    { val: total,      label: 'Réponses totales', sub: `/ ${target} objectif`,       pct: Math.min(100, Math.round(total/target*100)), gold: false },
    { val: `${complete > 0 && total > 0 ? Math.round(complete/total*100) : 0}%`,
                       label: 'Taux complétion',  sub: `${complete} complètes · ${abandoned} abandons`, pct: complete > 0 && total > 0 ? Math.round(complete/total*100) : 0, gold: false },
    { val: formatDur(avgSec), label: 'Temps moyen', sub: avgSec < 300 ? 'Questionnaire court' : 'Questionnaire long', pct: Math.min(100, Math.round(avgSec/600*100)), gold: true },
    { val: lastResp ? relTime(lastResp.created_at) : '—',
                       label: 'Dernière réponse', sub: lastResp?.respondent_university || lastResp?.respondent_email?.split('@')[1] || '—', pct: 100, gold: false },
  ];

  document.getElementById('st-metrics').innerHTML = metrics.map(m => `
    <div class="st-metric">
      <div class="st-metric-val${m.gold ? ' gold' : ''}">${m.val}</div>
      <div class="st-metric-label">${m.label}</div>
      <div class="st-metric-bar"><div class="st-metric-fill" style="width:0%" data-pct="${m.pct}"></div></div>
      <div class="st-metric-sub">${m.sub}</div>
    </div>`).join('');

  setTimeout(() => {
    document.querySelectorAll('.st-metric-fill').forEach(el => {
      el.style.width = el.dataset.pct + '%';
    });
  }, 100);
}

function computeAvgDuration() {
  const durations = st.responses.map(r => r.duration_seconds).filter(d => d != null && d > 0);
  return durations.length ? Math.round(durations.reduce((a,b) => a+b, 0) / durations.length) : 0;
}

function formatDur(sec) {
  if (!sec) return '—';
  const m = Math.floor(sec / 60), s = sec % 60;
  return m > 0 ? `${m}m${s > 0 ? s + 's' : ''}` : `${s}s`;
}

function relTime(iso) {
  const diff = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)    return "à l'instant";
  if (diff < 3600)  return `il y a ${Math.round(diff/60)}min`;
  if (diff < 86400) return `il y a ${Math.round(diff/3600)}h`;
  return `il y a ${Math.round(diff/86400)}j`;
}

/* ─── Line chart ─── */
function renderLineChart() {
  const canvas = document.getElementById('chart-line');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const days = last7Days();
  const counts = days.map(d => {
    return st.responses.filter(r => r.created_at && r.created_at.slice(0,10) === d).length;
  });
  const labels = days.map(d => {
    const dt = new Date(d); return dt.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' });
  });

  if (st.charts.line) st.charts.line.destroy();
  st.charts.line = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{ label: 'Réponses', data: counts, borderColor: '#005F54', backgroundColor: '#E8F5F3', fill: true, tension: 0.4, pointRadius: 3 }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: '#F0EDE6' }, ticks: { color: '#9A9890', font: { size: 11 } } },
        y: { grid: { color: '#F0EDE6' }, ticks: { color: '#9A9890', font: { size: 11 }, stepSize: 1 }, beginAtZero: true },
      },
    },
  });
}

function last7Days() {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

/* ─── Bar chart ─── */
function renderBarChart() {
  const s = st.stats;
  const card = document.getElementById('st-bar-card');
  if (!s || !s.question_completion) {
    card.style.display = 'none';
    return;
  }
  card.style.display = 'block';

  const canvas = document.getElementById('chart-bar');
  if (st.charts.bar) st.charts.bar.destroy();

  const labels  = s.question_completion.map((_, i) => `Q${i+1}`);
  const values  = s.question_completion.map(q => Math.round((q.answered / Math.max(q.total, 1)) * 100));
  const colors  = values.map(v => v >= 75 ? '#005F54' : '#E67E22');

  st.charts.bar = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{ label: 'Complétion %', data: values, backgroundColor: colors, borderRadius: 6 }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#9A9890', font: { size: 11 } } },
        y: { max: 100, grid: { color: '#F0EDE6' }, ticks: { color: '#9A9890', font: { size: 11 } } },
      },
    },
  });

  /* Dropout alert */
  const minPct = Math.min(...values);
  const minIdx = values.indexOf(minPct);
  const alert = document.getElementById('st-dropout-alert');
  if (minPct < 75) {
    alert.style.display = 'block';
    alert.textContent = `⚠ Point de chute à Q${minIdx+1} (${minPct}%). Reformule ou rends cette question facultative.`;
  } else {
    alert.style.display = 'none';
  }
}

/* ─── Donuts ─── */
function renderDonuts() {
  /* University donut */
  const uniMap = {};
  st.responses.forEach(r => {
    const key = r.respondent_university || (r.respondent_email ? r.respondent_email.split('@')[1] : 'Autre');
    uniMap[key] = (uniMap[key] || 0) + 1;
  });
  const uniLabels = Object.keys(uniMap);
  const uniData   = uniLabels.map(k => uniMap[k]);
  const uniColors = ['#005F54', '#C9A84C', '#2563EB', '#DC2626', '#E2DED6'];

  const uniCanvas = document.getElementById('chart-uni');
  if (st.charts.uni) st.charts.uni.destroy();
  if (uniLabels.length > 0) {
    st.charts.uni = new Chart(uniCanvas, {
      type: 'doughnut',
      data: { labels: uniLabels, datasets: [{ data: uniData, backgroundColor: uniColors.slice(0, uniLabels.length), borderWidth: 0 }] },
      options: { responsive: true, maintainAspectRatio: false, cutout: '60%', plugins: { legend: { display: false } } },
    });
    renderLegend('legend-uni', uniLabels, uniColors, uniData);
  }

  /* Level donut */
  const lvlMap = {};
  st.responses.forEach(r => { const k = r.respondent_level || 'Autre'; lvlMap[k] = (lvlMap[k] || 0) + 1; });
  const lvlLabels = Object.keys(lvlMap);
  const lvlData   = lvlLabels.map(k => lvlMap[k]);
  const lvlColors = ['#005F54', '#9FE1CB', '#C9A84C', '#E2DED6'];

  const lvlCanvas = document.getElementById('chart-level');
  if (st.charts.level) st.charts.level.destroy();
  if (lvlLabels.length > 0) {
    st.charts.level = new Chart(lvlCanvas, {
      type: 'doughnut',
      data: { labels: lvlLabels, datasets: [{ data: lvlData, backgroundColor: lvlColors.slice(0, lvlLabels.length), borderWidth: 0 }] },
      options: { responsive: true, maintainAspectRatio: false, cutout: '60%', plugins: { legend: { display: false } } },
    });
    renderLegend('legend-level', lvlLabels, lvlColors, lvlData);
  }
}

function renderLegend(id, labels, colors, data) {
  const total = data.reduce((a,b) => a+b, 0);
  document.getElementById(id).innerHTML = labels.map((l, i) => `
    <div class="st-legend-item">
      <div class="st-legend-dot" style="background:${colors[i] || '#E2DED6'}"></div>
      ${escHtml(l)} (${total > 0 ? Math.round(data[i]/total*100) : 0}%)
    </div>`).join('');
}

/* ─── Table ─── */
function renderTable() {
  const tbody = document.getElementById('st-tbody');
  const visible = st.showAll ? st.responses : st.responses.slice(0, PREVIEW_COUNT);

  tbody.innerHTML = visible.map(r => {
    const pill = r.is_suspect  ? '<span class="st-pill st-pill-suspect">Suspect</span>'
               : r.respondent_type === 'public' ? '<span class="st-pill st-pill-public">Public</span>'
               : '<span class="st-pill st-pill-ok">✓ Vérifié</span>';
    const dur  = r.duration_seconds ? `<span class="st-dur">${formatDur(r.duration_seconds)}</span>` : '<span class="st-dur">—</span>';
    const name = r.respondent_email ? r.respondent_email.split('@')[0].replace('.', ' ') : 'Anonyme';
    const uni  = r.respondent_university || (r.respondent_email ? '@' + r.respondent_email.split('@')[1] : '—');
    const level = r.respondent_level || '—';

    return `<tr><td>${escHtml(name)}</td><td>${escHtml(uni)}</td><td>${escHtml(level)}</td><td>${dur}</td><td>${pill}</td></tr>`;
  }).join('');

  const btn = document.getElementById('st-see-all-btn');
  if (st.responses.length > PREVIEW_COUNT) {
    btn.style.display = 'block';
    btn.textContent = st.showAll
      ? '↑ Réduire'
      : `Voir les ${st.responses.length} répondants →`;
  } else {
    btn.style.display = 'none';
  }
}

function toggleAllRespond() {
  st.showAll = !st.showAll;
  renderTable();
}

/* ─── Export section ─── */
function renderExportSection() {
  /* filename was set in renderTopbar */
}

async function exportExcel() {
  if (!st.formId) {
    alert('Sélectionne un questionnaire d\'abord.');
    return;
  }

  const btn1 = document.getElementById('st-topbar-export');
  const btn2 = document.getElementById('st-export-main-btn');
  [btn1, btn2].forEach(b => { if(b) { b.classList.add('done'); b.textContent = '✓ Téléchargement en cours...'; } });

  try {
    const resp = await fetch(`/api/forms/${st.formId}/export`, { credentials: 'include' });
    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({}));
      throw new Error(errData.error || 'Export failed');
    }
    const blob = await resp.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    const slug = (st.form?.title || 'form').replace(/\s+/g, '_').slice(0, 20);
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    a.href     = url;
    a.download = `SciConnect_Export_${slug}_${today}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    alert(`Export indisponible: ${e.message || 'Vérifie ta connexion.'}`);
  }

  setTimeout(() => {
    if (btn1) { btn1.classList.remove('done'); btn1.innerHTML = `<svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6.5 1v8M3 7l3.5 3.5L10 7"/><path d="M1 11h11"/></svg> Export Excel`; }
    if (btn2) { btn2.classList.remove('done'); btn2.innerHTML = `↓ Télécharger SciConnect_Export_${document.getElementById('st-filename-label')?.textContent || '...'}`; }
  }, 3000);
}

/* ─── Methodological paragraph ─── */
function renderMethodParagraph() {
  const total    = st.responses.length;
  if (total === 0) {
    document.getElementById('st-method-box').style.display = 'none';
    return;
  }

  const complete  = st.responses.filter(r => r.is_complete).length;
  const taux      = total > 0 ? Math.round(complete / total * 100) : 0;
  const verified  = st.responses.filter(r => r.respondent_type === 'verified').length;
  const pctV      = total > 0 ? Math.round(verified / total * 100) : 0;

  const dates    = st.responses.map(r => new Date(r.created_at)).filter(Boolean).sort((a,b) => a-b);
  const dateDebut = dates[0] ? dates[0].toLocaleDateString('fr-FR') : '?';
  const dateFin   = dates[dates.length-1] ? dates[dates.length-1].toLocaleDateString('fr-FR') : '?';

  const text = `Les données ont été collectées via SciConnect entre le ${dateDebut} et le ${dateFin}. Sur ${total} participant${total>1?'s':''}, ${complete} ont fourni des réponses complètes (${taux}%). ${verified} répondant${verified>1?'s':''} (${pctV}%) ont été vérifiés via email académique institutionnel.`;

  document.getElementById('st-method-text').textContent = text;
  document.getElementById('st-method-box').style.display = 'block';
}

function copyMethodText() {
  const text = document.getElementById('st-method-text').textContent;
  const btn  = document.getElementById('st-copy-btn');
  navigator.clipboard.writeText(text).then(() => {
    btn.textContent = '✓ Copié !';
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = 'Copier ce paragraphe →'; btn.classList.remove('copied'); }, 2000);
  }).catch(() => alert('Impossible de copier. Sélectionne le texte manuellement.'));
}

/* ─── Share ─── */
function shareForm() {
  if (!st.formId) return;
  const url = `${location.origin}/respond.html?id=${st.formId}`;
  if (navigator.share) {
    navigator.share({ title: st.form?.title, url }).catch(() => {});
  } else {
    navigator.clipboard.writeText(url).then(() => alert('Lien copié !')).catch(() => prompt('Lien à partager :', url));
  }
}

/* ─── Error ─── */
function showError(msg) {
  document.getElementById('st-loader').innerHTML =
    `<p style="color:var(--color-text-muted);text-align:center;padding:40px;">${msg}</p>`;
}

/* ─── Utility ─── */
function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}