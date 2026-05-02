/* ═══════════════════════════════════════════════════════════
   SCICONNECT — Utilitaires globaux
   Chargement du contenu depuis admin/content.json et admin/settings.json
   ═══════════════════════════════════════════════════════════ */

/* EDITABLE: fonction centrale de chargement — charge content.json et settings.json
   Appelée au démarrage de chaque page */
async function loadContent() {
  try {
    const [content, settings] = await Promise.all([
      fetch('/admin/content').then(r => {
        if (!r.ok) throw new Error('content.json non trouvé');
        return r.json();
      }),
      fetch('/admin/settings').then(r => {
        if (!r.ok) throw new Error('settings.json non trouvé');
        return r.json();
      })
    ]);
    applyContent(content);
    applySettings(settings);
    return { content, settings };
  } catch (error) {
    console.error('Erreur chargement contenu:', error);
    return null;
  }
}

/* EDITABLE: remplace le texte de tous les éléments avec data-content="clé" */
function applyContent(content) {
  document.querySelectorAll('[data-content]').forEach(el => {
    const key = el.dataset.content;
    const value = key.split('.').reduce((obj, k) => obj?.[k], content);
    if (value !== undefined) el.textContent = value;
  });
}

/* EDITABLE: applique les labels de boutons depuis settings.json */
function applySettings(settings) {
  document.querySelectorAll('[data-setting]').forEach(el => {
    const key = el.dataset.setting;
    const value = key.split('.').reduce((obj, k) => obj?.[k], settings);
    if (value !== undefined) el.textContent = value;
  });
}

/* EDITABLE: charge les écoles depuis admin/schools.json */
async function loadSchools() {
  try {
    const response = await fetch('/admin/schools');
    if (!response.ok) throw new Error('schools.json non trouvé');
    return await response.json();
  } catch (error) {
    console.error('Erreur chargement écoles:', error);
    return null;
  }
}

/* Formate une date en français */
function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

/* Affiche une notification toast */
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed; bottom: 24px; right: 24px; z-index: 9999;
    padding: 14px 20px; border-radius: var(--radius-md);
    font-family: var(--font-ui); font-size: 0.9rem; font-weight: 500;
    box-shadow: var(--shadow-lg); max-width: 360px;
    animation: slideIn 0.25s ease;
  `;

  const colors = {
    success: { bg: 'var(--color-unlocked-bg)', border: 'var(--color-unlocked-border)', text: 'var(--color-unlocked-text)' },
    error:   { bg: 'var(--color-locked-bg)',   border: 'var(--color-locked-border)',   text: 'var(--color-locked-text)'   },
    info:    { bg: 'var(--color-primary-light)',border: 'var(--color-primary)',         text: 'var(--color-primary)'        }
  };

  const c = colors[type] || colors.info;
  toast.style.backgroundColor = c.bg;
  toast.style.border = `1px solid ${c.border}`;
  toast.style.color = c.text;
  toast.textContent = message;

  document.body.appendChild(toast);
  setTimeout(() => { toast.remove(); }, 4000);
}

/* Injecte le style d'animation toast */
if (!document.getElementById('toast-style')) {
  const style = document.createElement('style');
  style.id = 'toast-style';
  style.textContent = '@keyframes slideIn { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }';
  document.head.appendChild(style);
}
