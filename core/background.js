// ── Dynamic themed background ─────────────────────────────────────────────────
//
// Self-contained canvas effect that runs in a fixed-position layer behind the
// React app.  Theme: occult / infernal — drifting embers rising from below,
// slow ambient pulses of red glow at the bottom, and rare distant flickers of
// a faint sigil watermark.  Pure decorative; no game logic, no React.
//
// The layer is non-interactive (pointer-events: none) and z-indexed below the
// app (which uses transparent backgrounds so the canvas shows through).
//
// Disables itself if the user has prefers-reduced-motion or if the
// .low-motion class was applied by shared.js.
// ──────────────────────────────────────────────────────────────────────────────

(function () {
  // ── Bail if low-motion ─────────────────────────────────────────────────────
  const prefersReduced = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const lowMotion = document.documentElement.classList.contains('low-motion');
  if (prefersReduced || lowMotion) return;

  // ── Mount canvas behind everything ─────────────────────────────────────────
  const canvas = document.createElement('canvas');
  canvas.id = 'bg-canvas';
  Object.assign(canvas.style, {
    position:       'fixed',
    inset:          '0',
    width:          '100%',
    height:         '100%',
    pointerEvents:  'none',
    zIndex:         '0',
    background:     'transparent',
  });
  // Ensure the canvas mounts before any other DOM children so it sits behind them
  if (document.body) document.body.insertBefore(canvas, document.body.firstChild);
  else document.addEventListener('DOMContentLoaded', () =>
    document.body.insertBefore(canvas, document.body.firstChild));

  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1;

  function resize() {
    dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width  = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  // ── Embers ─────────────────────────────────────────────────────────────────
  // Small particles drifting upward with a slight wobble; warm gold→red tint.
  const EMBER_COUNT = Math.min(60, Math.max(28, Math.round((W * H) / 26000)));
  const embers = [];

  function spawnEmber(initial) {
    const palette = [
      [255, 180, 70],   // gold
      [255, 140, 60],   // amber
      [220,  70, 40],   // ember red
      [200, 110, 50],   // dim copper
    ];
    const c = palette[(Math.random() * palette.length) | 0];
    embers.push({
      x:    Math.random() * W,
      y:    initial ? Math.random() * H : H + Math.random() * 40,
      vy:  -0.18 - Math.random() * 0.32,
      vx:  (Math.random() - 0.5) * 0.18,
      r:    0.6 + Math.random() * 1.6,
      a:    0.18 + Math.random() * 0.42,
      life: 0,
      maxLife: 600 + Math.random() * 1100,
      color: c,
      wob:  Math.random() * Math.PI * 2,
      wobSpd: 0.012 + Math.random() * 0.018,
    });
  }
  for (let i = 0; i < EMBER_COUNT; i++) spawnEmber(true);

  // ── Sigil watermark — pre-render once for performance ──────────────────────
  // A faint pentagram inside a circle, drawn into an offscreen canvas.
  const SIGIL_SIZE = 220;
  const sigilCanvas = document.createElement('canvas');
  sigilCanvas.width = sigilCanvas.height = SIGIL_SIZE;
  (function drawSigil() {
    const sctx = sigilCanvas.getContext('2d');
    const cx = SIGIL_SIZE / 2, cy = SIGIL_SIZE / 2;
    const R  = SIGIL_SIZE * 0.42;
    sctx.lineWidth = 1.4;
    sctx.strokeStyle = 'rgba(255, 80, 60, 1)';
    // outer circle
    sctx.beginPath(); sctx.arc(cx, cy, R, 0, Math.PI * 2); sctx.stroke();
    // pentagram
    const pts = [];
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + i * (Math.PI * 2 / 5);
      pts.push([cx + Math.cos(a) * R, cy + Math.sin(a) * R]);
    }
    const order = [0, 2, 4, 1, 3, 0];
    sctx.beginPath();
    sctx.moveTo(pts[order[0]][0], pts[order[0]][1]);
    for (let i = 1; i < order.length; i++) sctx.lineTo(pts[order[i]][0], pts[order[i]][1]);
    sctx.stroke();
  })();

  // Sigil flicker state
  let sigilNextAt = performance.now() + 4000 + Math.random() * 6000;
  let sigilOpacity = 0;
  let sigilFadeDir = 0; // 0 idle, 1 fading in, -1 fading out
  let sigilX = 0, sigilY = 0, sigilScale = 1;

  function triggerSigil(now) {
    sigilOpacity = 0;
    sigilFadeDir = 1;
    sigilX = W * (0.18 + Math.random() * 0.64);
    sigilY = H * (0.12 + Math.random() * 0.55);
    sigilScale = 0.7 + Math.random() * 0.7;
    sigilNextAt = now + 8000 + Math.random() * 10000;
  }

  // ── Animation loop ─────────────────────────────────────────────────────────
  let lastT = performance.now();
  let pulsePhase = 0;

  function frame(now) {
    const dt = Math.min(40, now - lastT);
    lastT = now;
    const t = dt / 16.67; // tick scaled to ~60fps

    // Clear with a translucent dark overlay (creates trails subtly)
    ctx.clearRect(0, 0, W, H);

    // ── Bottom red glow pulse ────────────────────────────────────────────────
    pulsePhase += 0.0015 * t;
    const pulse = 0.55 + 0.45 * Math.sin(pulsePhase);
    const glow = ctx.createRadialGradient(W / 2, H + 60, 20, W / 2, H + 60, Math.max(W, H) * 0.85);
    glow.addColorStop(0, `rgba(160, 25, 20, ${0.18 * pulse})`);
    glow.addColorStop(0.4, `rgba(80, 12, 12, ${0.08 * pulse})`);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // ── Sigil flicker ────────────────────────────────────────────────────────
    if (sigilFadeDir === 0 && now >= sigilNextAt) triggerSigil(now);
    if (sigilFadeDir === 1) {
      sigilOpacity += 0.012 * t;
      if (sigilOpacity >= 1.0) { sigilOpacity = 1.0; sigilFadeDir = -1; }
    } else if (sigilFadeDir === -1) {
      sigilOpacity -= 0.006 * t;
      if (sigilOpacity <= 0) { sigilOpacity = 0; sigilFadeDir = 0; }
    }
    if (sigilOpacity > 0) {
      ctx.save();
      ctx.globalAlpha = sigilOpacity;
      const sz = SIGIL_SIZE * sigilScale;
      ctx.drawImage(sigilCanvas, sigilX - sz / 2, sigilY - sz / 2, sz, sz);
      ctx.restore();
    }

    // ── Embers ───────────────────────────────────────────────────────────────
    ctx.globalCompositeOperation = 'lighter';
    for (let i = embers.length - 1; i >= 0; i--) {
      const e = embers[i];
      e.life += t;
      e.wob  += e.wobSpd * t;
      e.x   += e.vx * t + Math.sin(e.wob) * 0.15;
      e.y   += e.vy * t;

      // fade in/out
      const lifeP = e.life / e.maxLife;
      let alpha = e.a;
      if (lifeP < 0.12)      alpha *= lifeP / 0.12;
      else if (lifeP > 0.7)  alpha *= Math.max(0, 1 - (lifeP - 0.7) / 0.3);

      if (e.y < -10 || e.life >= e.maxLife) {
        embers.splice(i, 1);
        spawnEmber(false);
        continue;
      }

      // Draw glow + core
      const [r, g, b] = e.color;
      const grad = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.r * 7);
      grad.addColorStop(0,  `rgba(${r},${g},${b},${alpha})`);
      grad.addColorStop(0.4,`rgba(${r},${g},${b},${alpha * 0.35})`);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r * 7, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = `rgba(${Math.min(255, r + 40)}, ${Math.min(255, g + 30)}, ${Math.min(255, b + 20)}, ${alpha})`;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
// ──────────────────────────────────────────────────────────────────────────────
