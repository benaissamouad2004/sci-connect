/* ═══════════════════════════════════════════════════════════
   SCICONNECT — animations.js
   Premium micro-animations: Points earned + Streak milestone
   Vanilla JS + CSS only — no external libraries
   Emil Kowalski animation philosophy
   ═══════════════════════════════════════════════════════════ */

(function() {
  'use strict';

  /* ── Easing functions ── */
  const SPRING = 'cubic-bezier(0.32, 0.72, 0, 1)';
  const EASE_OUT = 'cubic-bezier(0.4, 0, 0.6, 1)';

  function easeOutExpo(t) {
    return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
  }

  /* ── Inject animation styles (once) ── */
  let stylesInjected = false;
  function injectStyles() {
    if (stylesInjected) return;
    stylesInjected = true;
    const s = document.createElement('style');
    s.textContent = `
      .sc-anim-overlay {
        position: fixed; inset: 0; z-index: 1000;
        display: flex; align-items: center; justify-content: center;
        background: transparent;
        pointer-events: auto;
      }
      .sc-anim-overlay--fade-out {
        opacity: 0; transition: opacity 200ms ${EASE_OUT};
      }

      /* ── Points Animation ── */
      .sc-pts-burst {
        position: absolute; width: 12px; height: 12px; border-radius: 50%;
        background: #005F54; will-change: transform, opacity;
        pointer-events: none;
      }
      @keyframes sc-burst-expand {
        from { transform: scale(1); opacity: 1; }
        to   { transform: scale(40); opacity: 0; }
      }
      .sc-pts-card {
        position: relative; z-index: 2;
        background: #FFFFFF; border: 1.5px solid #9FE1CB; border-radius: 20px;
        padding: 20px 32px; text-align: center;
        will-change: transform, opacity; pointer-events: auto;
        box-shadow: 0 8px 32px rgba(0,0,0,0.08);
      }
      @keyframes sc-card-in {
        from { transform: scale(0.6); opacity: 0; }
        to   { transform: scale(1); opacity: 1; }
      }
      @keyframes sc-card-out {
        from { transform: scale(1); opacity: 1; }
        to   { transform: scale(0.9); opacity: 0; }
      }
      .sc-pts-star {
        display: inline-block; width: 28px; height: 28px; margin-bottom: 6px;
        will-change: transform;
      }
      @keyframes sc-star-spin {
        from { transform: rotate(0deg); }
        to   { transform: rotate(360deg); }
      }
      .sc-pts-number {
        font-family: 'Fraunces', serif; font-weight: 700; font-size: 48px;
        color: #C9A84C; line-height: 1; margin-bottom: 2px;
      }
      .sc-pts-label {
        font-family: 'DM Sans', sans-serif; font-weight: 400; font-size: 14px;
        color: #57564F; margin-bottom: 10px;
      }
      .sc-pts-sep {
        height: 1px; background: #E2DED6; margin: 10px 0;
      }
      .sc-pts-total {
        font-family: 'DM Sans', sans-serif; font-weight: 400; font-size: 13px;
        color: #57564F;
      }
      .sc-pts-total-num {
        font-family: 'Fraunces', serif; font-weight: 600; font-size: 16px;
        color: #005F54;
      }

      /* Particles */
      .sc-particle {
        position: absolute; border-radius: 50%; will-change: transform, opacity;
        pointer-events: none;
      }
      @keyframes sc-particle-out {
        0%   { transform: translate(0, 0) scale(1); opacity: 1; }
        70%  { opacity: 1; }
        100% { opacity: 0; }
      }

      /* Streak pill */
      .sc-streak-pill {
        position: relative; z-index: 2;
        background: #FFF8EC; border: 1px solid #E8C96A; border-radius: 20px;
        padding: 8px 16px; display: flex; align-items: center; gap: 6px;
        font-family: 'DM Sans', sans-serif; font-weight: 500; font-size: 13px;
        color: #8B6914; margin-top: 10px; will-change: transform, opacity;
      }
      @keyframes sc-pill-in {
        from { transform: translateY(20px); opacity: 0; }
        to   { transform: translateY(0); opacity: 1; }
      }

      /* ── Streak Animation ── */
      @keyframes sc-screen-flash {
        0%   { background: transparent; }
        50%  { background: rgba(201,168,76,0.08); }
        100% { background: transparent; }
      }
      .sc-streak-card {
        position: relative; z-index: 2;
        background: #FFFFFF; border: 1.5px solid #E8C96A; border-radius: 20px;
        padding: 24px 32px; text-align: center; max-width: 360px;
        will-change: transform, opacity; pointer-events: auto;
        box-shadow: 0 8px 32px rgba(0,0,0,0.08);
      }
      @keyframes sc-streak-in {
        from { transform: translateY(60px); opacity: 0; }
        to   { transform: translateY(0); opacity: 1; }
      }

      /* Day circles */
      .sc-days-row {
        display: flex; justify-content: center; gap: 6px;
        margin-bottom: 16px;
      }
      .sc-day-circle {
        width: 32px; height: 32px; border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        border: 2px solid #005F54; background: #005F54;
        color: white; font-size: 10px;
        will-change: transform;
      }
      @keyframes sc-day-pop {
        0%   { transform: scale(0); }
        70%  { transform: scale(1.2); }
        100% { transform: scale(1); }
      }
      @keyframes sc-circle-glow {
        0%   { box-shadow: 0 0 0 0 rgba(0,95,84,0.3); }
        50%  { box-shadow: 0 0 0 6px rgba(0,95,84,0); }
        100% { box-shadow: 0 0 0 0 rgba(0,95,84,0); }
      }

      /* Fire icon */
      .sc-fire-icon {
        font-size: 48px; line-height: 1; margin: 8px 0;
        will-change: transform;
      }
      @keyframes sc-fire-in {
        0%   { transform: scale(0); }
        70%  { transform: scale(1.15); }
        100% { transform: scale(1); }
      }
      @keyframes sc-fire-pulse {
        0%   { transform: scale(1); }
        50%  { transform: scale(1.05); }
        100% { transform: scale(1); }
      }

      .sc-streak-title {
        font-family: 'Fraunces', serif; font-weight: 700; font-size: 28px;
        color: #181816; margin: 8px 0; will-change: transform, opacity;
      }
      .sc-streak-bonus {
        display: inline-block; background: #FDF8EC; border-radius: 8px;
        padding: 6px 14px; font-family: 'DM Sans', sans-serif;
        font-weight: 500; font-size: 16px; color: #8B6914;
        margin: 6px 0; will-change: transform, opacity;
      }
      .sc-streak-sep { height: 1px; background: #E2DED6; margin: 16px 0; }
      .sc-streak-motive {
        font-family: 'DM Sans', sans-serif; font-weight: 300; font-size: 13px;
        color: #57564F; text-align: center; will-change: transform, opacity;
      }
      .sc-streak-dismiss {
        width: 100%; height: 46px; border: none; border-radius: 10px;
        background: #005F54; color: white;
        font-family: 'DM Sans', sans-serif; font-weight: 500; font-size: 14px;
        cursor: pointer; margin-top: 14px;
        will-change: transform, opacity;
        transition: background 150ms, transform 150ms;
      }
      .sc-streak-dismiss:hover { background: #004A41; transform: translateY(-1px); }

      /* Confetti */
      .sc-confetti {
        position: absolute; will-change: transform, opacity; pointer-events: none;
      }
      @keyframes sc-confetti-up {
        0%   { transform: translate(var(--dx), 0) rotate(0deg); opacity: 1; }
        60%  { opacity: 1; }
        100% { transform: translate(var(--ex), var(--ey)) rotate(var(--rot)); opacity: 0; }
      }

      /* fadeUp helper */
      @keyframes sc-fadeUp {
        from { transform: translateY(8px); opacity: 0; }
        to   { transform: translateY(0); opacity: 1; }
      }
    `;
    document.head.appendChild(s);
  }

  /* ═══════════════════════════════════════════════
     ANIMATION 1 — POINTS EARNED
     ═══════════════════════════════════════════════ */
  function showPointsAnimation(points, totalPoints, streakBonus) {
    injectStyles();

    const overlay = document.createElement('div');
    overlay.className = 'sc-anim-overlay';
    document.body.appendChild(overlay);

    let dismissed = false;
    function dismiss() {
      if (dismissed) return;
      dismissed = true;
      const card = overlay.querySelector('.sc-pts-card');
      const pill = overlay.querySelector('.sc-streak-pill');
      if (card) { card.style.animation = `sc-card-out 200ms ${EASE_OUT} forwards`; }
      if (pill) { pill.style.animation = `sc-card-out 200ms ${EASE_OUT} forwards`; }
      overlay.classList.add('sc-anim-overlay--fade-out');
      setTimeout(() => { overlay.remove(); updateSidebarPoints(totalPoints); }, 250);
    }

    overlay.addEventListener('click', dismiss);
    document.addEventListener('keydown', function escHandler(e) {
      if (e.key === 'Escape') { dismiss(); document.removeEventListener('keydown', escHandler); }
    });

    /* Step 1: Burst ripple */
    const burst = document.createElement('div');
    burst.className = 'sc-pts-burst';
    burst.style.animation = `sc-burst-expand 300ms ${SPRING} forwards`;
    overlay.appendChild(burst);

    /* Step 2: Card */
    setTimeout(() => {
      const card = document.createElement('div');
      card.className = 'sc-pts-card';
      card.style.animation = `sc-card-in 400ms ${SPRING} forwards`;
      card.innerHTML = `
        <div class="sc-pts-star" style="animation: sc-star-spin 600ms ${SPRING}">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <polygon points="14,2 17.5,10 26,11 19.5,17 21.5,26 14,21.5 6.5,26 8.5,17 2,11 10.5,10"
                     fill="#C9A84C" stroke="#C9A84C" stroke-width="1"/>
          </svg>
        </div>
        <div class="sc-pts-number" id="sc-pts-counter">0</div>
        <div class="sc-pts-label">gagn\u00e9s !</div>
        <div class="sc-pts-sep"></div>
        <div class="sc-pts-total">Total : <span class="sc-pts-total-num">${totalPoints} pts</span></div>
      `;
      card.addEventListener('click', e => e.stopPropagation());
      overlay.appendChild(card);

      /* Step 3: Particles (200ms delay from card) */
      setTimeout(() => spawnParticles(overlay, 8), 100);

      /* Step 4: Counter animation (300ms delay) */
      setTimeout(() => animateCounter('sc-pts-counter', points, '+', ' pts'), 200);

      /* Step 5: Streak pill (if bonus) */
      if (streakBonus) {
        setTimeout(() => {
          const pill = document.createElement('div');
          pill.className = 'sc-streak-pill';
          pill.style.animation = `sc-pill-in 300ms ${SPRING} forwards`;
          pill.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 1c0 0 3 4 3 7a3 3 0 01-6 0c0-3 3-7 3-7z" fill="#C9A84C"/>
            </svg>
            Streak bonus ! +25 pts
          `;
          overlay.appendChild(pill);
        }, 500);
      }
    }, 100);

    /* Step 6: Auto dismiss */
    setTimeout(dismiss, 2500);
  }

  /* ─── Particle burst ─── */
  function spawnParticles(container, count) {
    const colors = ['#005F54', '#C9A84C', '#9FE1CB', '#E8C96A'];
    for (let i = 0; i < count; i++) {
      const p = document.createElement('div');
      p.className = 'sc-particle';
      const size = 6 + Math.random() * 4;
      const angle = (i / count) * 2 * Math.PI;
      const dist = 60 + Math.random() * 40;
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * dist;
      p.style.cssText = `
        width:${size}px; height:${size}px;
        background:${colors[i % colors.length]};
        left:50%; top:50%; margin-left:-${size/2}px; margin-top:-${size/2}px;
        animation: sc-particle-out 600ms ${SPRING} ${i * 10}ms forwards;
        --dx: ${dx}px; --dy: ${dy}px;
      `;
      /* Custom keyframe for each particle direction */
      p.style.animation = 'none';
      container.appendChild(p);
      requestAnimationFrame(() => {
        p.style.transition = `transform 600ms ${SPRING}, opacity 200ms ease ${400}ms`;
        p.style.transform = `translate(${dx}px, ${dy}px)`;
        setTimeout(() => { p.style.opacity = '0'; }, 400);
      });
    }
  }

  /* ─── Number counter animation ─── */
  function animateCounter(elementId, target, prefix, suffix) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const duration = 800;
    const start = performance.now();

    function update(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutExpo(progress);
      const current = Math.round(eased * target);
      el.textContent = `${prefix}${current}${suffix}`;
      if (progress < 1) requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
  }

  /* ═══════════════════════════════════════════════
     ANIMATION 2 — STREAK MILESTONE
     ═══════════════════════════════════════════════ */
  function showStreakAnimation(streakDays, bonusPoints) {
    injectStyles();

    const overlay = document.createElement('div');
    overlay.className = 'sc-anim-overlay';
    overlay.style.animation = `sc-screen-flash 400ms ease`;
    document.body.appendChild(overlay);

    let dismissed = false;
    function dismiss() {
      if (dismissed) return;
      dismissed = true;
      const card = overlay.querySelector('.sc-streak-card');
      if (card) {
        card.style.transition = `transform 300ms ${EASE_OUT}, opacity 300ms ${EASE_OUT}`;
        card.style.transform = 'translateY(20px)';
        card.style.opacity = '0';
      }
      setTimeout(() => {
        overlay.classList.add('sc-anim-overlay--fade-out');
        setTimeout(() => overlay.remove(), 250);
      }, 100);
    }

    overlay.addEventListener('click', dismiss);
    document.addEventListener('keydown', function escHandler(e) {
      if (e.key === 'Escape') { dismiss(); document.removeEventListener('keydown', escHandler); }
    });

    /* Step 2: Streak card */
    setTimeout(() => {
      const card = document.createElement('div');
      card.className = 'sc-streak-card';
      card.style.animation = `sc-streak-in 500ms ${SPRING} forwards`;
      card.addEventListener('click', e => e.stopPropagation());

      /* Day circles HTML */
      const days = ['L','M','M','J','V','S','D'];
      const daysHtml = days.map((d, i) => `
        <div class="sc-day-circle" style="
          animation: sc-day-pop 300ms ${SPRING} ${i * 60}ms both,
                     sc-circle-glow 2s ease ${800 + i * 200}ms infinite;
        ">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="white" stroke-width="2" stroke-linecap="round">
            <path d="M2 5l2 2 4-4"/>
          </svg>
        </div>
      `).join('');

      card.innerHTML = `
        <div class="sc-days-row">${daysHtml}</div>
        <div class="sc-fire-icon" style="
          animation: sc-fire-in 400ms ${SPRING} 500ms both,
                     sc-fire-pulse 2s ease 1000ms infinite;
        ">\uD83D\uDD25</div>
        <div class="sc-streak-title" style="animation: sc-fadeUp 300ms ${SPRING} 600ms both">
          \uD83D\uDD25 Streak de ${streakDays} jours !
        </div>
        <div class="sc-streak-bonus" style="animation: sc-fadeUp 300ms ${SPRING} 700ms both">
          +${bonusPoints} pts bonus d\u00e9bloqu\u00e9s
        </div>
        <div class="sc-streak-sep"></div>
        <div class="sc-streak-motive" style="animation: sc-fadeUp 300ms ${SPRING} 800ms both">
          Continue ainsi \u2014 tu es dans le top 5% des contributeurs !
        </div>
        <button class="sc-streak-dismiss" style="animation: sc-fadeUp 300ms ${SPRING} 900ms both"
                onclick="event.stopPropagation()">
          C'est parti ! \u2192
        </button>
      `;

      card.querySelector('.sc-streak-dismiss').addEventListener('click', dismiss);
      overlay.appendChild(card);

      /* Step 3: Confetti (300ms delay) */
      setTimeout(() => spawnConfetti(overlay, card), 300);

    }, 100);

    /* Step 5: Auto dismiss */
    setTimeout(dismiss, 4000);
  }

  /* ─── Confetti burst ─── */
  function spawnConfetti(overlay, card) {
    const colors = ['#005F54', '#C9A84C', '#9FE1CB', '#E8C96A'];
    const rect = card.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.bottom;

    for (let i = 0; i < 20; i++) {
      const c = document.createElement('div');
      c.className = 'sc-confetti';
      const w = 4 + Math.random() * 4;
      const h = 8 + Math.random() * 8;
      const dx = (Math.random() - 0.5) * 200;
      const ey = -(100 + Math.random() * 200);
      const ex = dx + (Math.random() - 0.5) * 60;
      const rot = (Math.random() - 0.5) * 720 + 'deg';
      const delay = Math.random() * 200;

      c.style.cssText = `
        width:${w}px; height:${h}px; border-radius: 1px;
        background:${colors[i % colors.length]};
        left:${cx}px; top:${cy}px;
        --dx:${dx}px; --ex:${ex}px; --ey:${ey}px; --rot:${rot};
        animation: sc-confetti-up 1200ms ${SPRING} ${delay}ms forwards;
      `;
      overlay.appendChild(c);
    }
  }

  /* ─── Sidebar points update ─── */
  function updateSidebarPoints(newTotal) {
    const bar   = document.getElementById('sb-pts-bar');
    const label = document.getElementById('sb-pts');
    if (bar) {
      const pct = Math.min((newTotal / 20) * 100, 100);
      bar.style.transition = `width 800ms ${SPRING}`;
      bar.style.width = pct + '%';
      if (newTotal >= 20) {
        bar.style.background = '#1A7A5E';
        setTimeout(() => { bar.style.background = '#005F54'; }, 1000);
      }
    }
    if (label) label.textContent = newTotal + ' pts';
  }

  /* ═══════════════════════════════════════════════
     EXPORT
     ═══════════════════════════════════════════════ */
  window.SciConnectAnimations = {
    showPointsAnimation,
    showStreakAnimation,
  };

})();
