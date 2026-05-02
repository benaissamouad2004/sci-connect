/* ═══════════════════════════════════════════════════════════
   SCICONNECT — Google OAuth (GIS)
   NE PAS utiliser l'ancienne platform.js — GIS uniquement
   Ne jamais stocker le token dans localStorage — cookie httpOnly
   ═══════════════════════════════════════════════════════════ */

/* EDITABLE: Client ID Google — à configurer dans .env côté backend
   Ce script ne contient jamais de clé API en dur */
let googleClientId = '';

/* Charge le client_id depuis le backend pour ne pas l'exposer dans le JS */
async function loadGoogleClientId() {
  try {
    const resp = await fetch('/api/auth/config');
    if (!resp.ok) return '';
    const data = await resp.json();
    return data.google_client_id || '';
  } catch (e) {
    return '';
  }
}

/* Déclenche le popup Google Identity Services */
async function initiateGoogleSignIn() {
  const btn      = document.getElementById('google-btn');
  const btnText  = document.getElementById('google-btn-text');
  const errorBox = document.getElementById('login-error');

  if (!btn) return;

  /* Afficher spinner */
  btn.disabled = true;
  if (btnText) btnText.innerHTML = '<div class="spinner"></div>';
  if (errorBox) errorBox.classList.remove('visible');

  try {
    /* Récupérer le client_id depuis le backend */
    const configResp = await fetch('/api/auth/config');
    const config     = configResp.ok ? await configResp.json() : {};
    googleClientId   = config.google_client_id || '';

    if (!googleClientId) {
      showLoginError('Client ID Google non configuré. Contacte l\'administrateur.');
      resetBtn();
      return;
    }

    /* Initialiser GIS et demander le popup One Tap */
    google.accounts.id.initialize({
      client_id:  googleClientId,
      callback:   handleGoogleCredential,
      auto_select: false,
      cancel_on_tap_outside: true,
    });

    google.accounts.id.prompt((notification) => {
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        /* One Tap non disponible — utiliser le bouton classique */
        renderGoogleButton();
      }
    });

  } catch (err) {
    showLoginError('Erreur de connexion. Réessaie dans quelques secondes.');
    resetBtn();
  }
}

/* Rend le bouton Google classique si One Tap n'est pas disponible */
function renderGoogleButton() {
  const container = document.createElement('div');
  container.id    = 'g-btn-container';
  container.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:9999;background:var(--color-surface);padding:24px;border-radius:var(--radius-lg);box-shadow:var(--shadow-lg);border:1px solid var(--color-border);';

  const backdrop = document.createElement('div');
  backdrop.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.3);z-index:9998;';
  backdrop.onclick = () => { container.remove(); backdrop.remove(); resetBtn(); };

  google.accounts.id.renderButton(container, {
    theme: 'outline',
    size: 'large',
    text: 'continue_with',
    locale: 'fr',
  });

  document.body.appendChild(backdrop);
  document.body.appendChild(container);
}

/* Callback appelé par GIS après authentification réussie */
async function handleGoogleCredential(response) {
  /* Fermer le bouton de secours si présent */
  document.getElementById('g-btn-container')?.remove();
  document.querySelectorAll('[style*="rgba(0,0,0,0.3)"]').forEach(el => el.remove());

  const credential = response.credential;
  if (!credential) {
    showLoginError('Authentification annulée.');
    resetBtn();
    return;
  }

  try {
    /* IMPORTANT: on envoie le JWT vers le backend — jamais stocké côté client */
    const apiResp = await fetch('/api/auth/google', {
      method:      'POST',
      headers:     { 'Content-Type': 'application/json' },
      credentials: 'include',   // nécessaire pour recevoir le cookie httpOnly
      body:        JSON.stringify({ credential }),
    });

    if (!apiResp.ok) {
      const err = await apiResp.json().catch(() => ({}));
      if (err.error === 'email_non_academique') {
        showLoginError(err.message || 'Email non académique. Utilise ton adresse institutionnelle (ex : prenom.nom@uca.ac.ma).');
      } else {
        showLoginError(err.message || err.error || 'Erreur lors de la connexion. Réessaie.');
      }
      resetBtn();
      return;
    }

    const data = await apiResp.json();

    if (data.success && data.redirect) {
      /* Redirection selon l'état de l'utilisateur */
      window.location.href = data.redirect;
    } else {
      showLoginError('Réponse inattendue du serveur.');
      resetBtn();
    }

  } catch (err) {
    showLoginError('Erreur réseau. Vérifie ta connexion.');
    resetBtn();
  }
}

/* Affiche un message d'erreur dans la page login */
function showLoginError(message) {
  const errorBox = document.getElementById('login-error');
  if (!errorBox) return;
  errorBox.textContent = message;
  errorBox.classList.add('visible');
}

/* Remet le bouton dans son état initial */
function resetBtn() {
  const btn     = document.getElementById('google-btn');
  const btnText = document.getElementById('google-btn-text');
  if (!btn) return;
  btn.disabled = false;
  /* EDITABLE: label chargé depuis admin/settings.json → buttons.google_signin_label */
  if (btnText) btnText.textContent = 'Continuer avec Google';
}
