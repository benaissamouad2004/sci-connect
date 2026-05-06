/* ═══════════════════════════════════════════════════════════
   SCICONNECT — Statistiques V3
   ═══════════════════════════════════════════════════════════ */

const st = {
  formId:    null,
  form:      null,
  stats:     null,
  responses: [],
  showAll:   false,
  charts:    {},
};

const PREVIEW_COUNT = 5;

document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  st.formId = params.get('id');
  if (!st.formId) { showError('Lien invalide.'); return; }
  await loadStats();
});

/* ─── Load data ─── */
async function loadStats() {
  try {
    const [formResp, statsResp, respResp] = await Promise.all([
      fetch(`/api/forms/${st.formId}`,         { credentials: 'include' }),
      fetch(`/api/forms/${st.formId}/stats`,   { credentials: 'include' }),
      fetch(`/api/forms/${st.formId}/responses`, { credentials: 'include' }),
    ]);

    if (!formResp.ok) throw new Error('form');
    st.form = await formResp.json();
    if (statsResp.ok)  st.stats     = await statsResp.json();
    if (respResp.ok)   { const d = await respResp.json(); st.responses = d.items || []; }
  } catch {
    showError('Impossible de charger les statistiques.');
    return;
  }

  document.getElementById('st-loader').style.display = 'none';
  document.getElementById('st-content').style.display = 'contents';

  renderTopbar();
  renderMetrics();
  renderLineChart();
  renderBarChart();
  renderDonuts();
  renderTable();
  renderExportSection();
  renderMethodParagraph();
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
  const target   = st.form.target_responses || 50;

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
  if (diff < 60)    return 'à l\'instant';
  if (diff < 3600)  return `il y a ${Math.round(diff/60)}min`;
  if (diff < 86400) return `il y a ${Math.round(diff/3600)}h`;
  return `il y a ${Math.round(diff/86400)}j`;
}

/* ─── Line chart ─── */
function renderLineChart() {
  const days = last7Days();
  const counts = days.map(d => {
    return st.responses.filter(r => r.created_at && r.created_at.slice(0,10) === d).length;
  });
  const labels = days.map(d => {
    const dt = new Date(d); return dt.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' });
  });

  st.charts.line = new Chart(document.getElementById('chart-line'), {
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
  if (!s || !s.question_completion) {
    document.getElementById('st-bar-card').style.display = 'none';
    return;
  }

  const labels  = s.question_completion.map((_, i) => `Q${i+1}`);
  const values  = s.question_completion.map(q => Math.round((q.answered / Math.max(q.total, 1)) * 100));
  const colors  = values.map(v => v >= 75 ? '#005F54' : '#E67E22');

  st.charts.bar = new Chart(document.getElementById('chart-bar'), {
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
  if (minPct < 75) {
    const alert = document.getElementById('st-dropout-alert');
    alert.style.display = 'block';
    alert.textContent = `⚠ Point de chute à Q${minIdx+1} (${minPct}%). Reformule ou rends cette question facultative.`;
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

  if (uniLabels.length > 0) {
    st.charts.uni = new Chart(document.getElementById('chart-uni'), {
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

  if (lvlLabels.length > 0) {
    st.charts.level = new Chart(document.getElementById('chart-level'), {
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
      ${l} (${total > 0 ? Math.round(data[i]/total*100) : 0}%)
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

    return `<tr><td>${name}</td><td>${uni}</td><td>${level}</td><td>${dur}</td><td>${pill}</td></tr>`;
  }).join('');

  const btn = document.getElementById('st-see-all-btn');
  if (st.responses.length > PREVIEW_COUNT) {
    btn.style.display = 'block';
    btn.textContent = st.showAll
      ? '↑ Réduire'
      : `Voir les ${st.responses.length} répondants →`;
  }
}

function toggleAllRespond() {
  st.showAll = !st.showAll;
  renderTable();
}

/* ─── Export section ─── */
function renderExportSection() {
  /* Already rendered in HTML; filename was set in renderTopbar */
}

async function exportExcel() {
  const btn1 = document.getElementById('st-topbar-export');
  const btn2 = document.getElementById('st-export-main-btn');
  [btn1, btn2].forEach(b => { if(b) { b.classList.add('done'); b.textContent = '✓ Téléchargement en cours...'; } });

  try {
    const resp = await fetch(`/api/forms/${st.formId}/export`, { credentials: 'include' });
    if (!resp.ok) throw new Error(resp.status);
    const blob = await resp.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    const slug = (st.form.title || 'form').replace(/\s+/g, '_').slice(0, 20);
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    a.href     = url;
    a.download = `SciConnect_Export_${slug}_${today}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  } catch {
    alert('Export indisponible. Vérifie ta connexion.');
  }

  setTimeout(() => {
    [btn1, btn2].forEach(b => { if(b) { b.classList.remove('done'); b.textContent = '↓ Export Excel'; } });
    if(btn2) btn2.innerHTML = `↓ Télécharger SciConnect_Export_${document.getElementById('st-filename-label')?.textContent || '...'}.xlsx`;
  }, 3000);
}

/* ─── Methodological paragraph ─── */
function renderMethodParagraph() {
  const total    = st.responses.length;
  if (total === 0) return;

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
  const url = `${location.origin}/respond.html?id=${st.formId}`;
  if (navigator.share) {
    navigator.share({ title: st.form.title, url }).catch(() => {});
  } else {
    navigator.clipboard.writeText(url).then(() => alert('Lien copié !')).catch(() => prompt('Lien à partager :', url));
  }
}

/* ─── Error ─── */
function showError(msg) {
  document.getElementById('st-loader').innerHTML =
    `<p style="color:var(--color-text-muted);text-align:center;padding:40px;">${msg}</p>`;
}