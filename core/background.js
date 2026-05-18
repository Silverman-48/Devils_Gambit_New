// ── Dynamic Background — Embers & Suit Drifts ────────────────────────────────
//
// Self-contained canvas effect.  Non-interactive, z-indexed below the app.
// Respects prefers-reduced-motion and the .low-motion class.
//
// ── CUSTOMISATION ─────────────────────────────────────────────────────────────
const BG_CONFIG = {
  // ── Ember count & density ──────────────────────────────────────────────────
  emberCount:       25,       // base number of ember particles
  emberCountMax:    50,       // hard cap (ignored on very small screens)
  emberCountMin:    14,       // hard floor

  // ── Ember movement ─────────────────────────────────────────────────────────
  emberSpeedMin:    0.22,     // px/tick upward (min)
  emberSpeedMax:    0.52,     // px/tick upward (max)
  emberDriftMax:    0.20,     // max horizontal wobble speed

  // ── Ember size ─────────────────────────────────────────────────────────────
  emberRadiusMin:   0.7,      // core dot radius (px)
  emberRadiusMax:   2.2,      // core dot radius (px)
  emberGlowMult:    7,        // glow radius = core radius × this

  // ── Ember opacity ──────────────────────────────────────────────────────────
  emberAlphaMin:    0.28,     // minimum particle alpha
  emberAlphaMax:    0.62,     // maximum particle alpha

  // ── Ember lifetime ─────────────────────────────────────────────────────────
  emberLifeMin:     500,      // ticks before particle dies
  emberLifeMax:     4400,     // ticks before particle dies

  // ── Ember colour palette ───────────────────────────────────────────────────
  // Each entry is [R, G, B].  Add, remove, or reorder freely.
  emberPalette: [
    [255, 185,  75],  // gold
    [255, 145,  55],  // amber
    [230,  80,  40],  // ember red
    [210, 120,  50],  // copper
  ],

  // ── Suit symbols ──────────────────────────────────────────────────────────
  // What fraction of particles are suit symbols instead of plain embers.
  // 0 = none, 0.15 = 15%, 1 = all suits
  suitFraction:     0.15,

  // Font size of suit symbols (px).  They fade and drift just like embers.
  suitFontSize:     13,

  // Suit glow colour — drawn additively around the symbol
  suitGlowColor:   'rgba(210, 60, 60, 1)',  // crimson halo
  suitGlowRadius:   18,       // px radius of the halo gradient

  // Suit alpha range (can differ from plain embers)
  suitAlphaMin:     0.35,
  suitAlphaMax:     0.75,

  // Which suits to use
  suitSymbols:     ['♠', '♥', '♦', '♣'],

  // ── Bottom glow pulse ──────────────────────────────────────────────────────
  glowColor:       [160, 25, 20],  // [R, G, B]
  glowAlphaMax:     0.22,          // peak opacity of the glow
  glowPulseSpeed:   0.0015,        // how fast it breathes (radians/tick)
  glowRadius:       0.85,          // fraction of max(W,H)
};
// ──────────────────────────────────────────────────────────────────────────────


(function () {
  // ── Reduced-motion bail ────────────────────────────────────────────────────
  // If the user has prefers-reduced-motion or the low-motion class, expose a
  // permanently-off API so the General Options toggle still works (it just
  // does nothing).  Without the stub, the toggle button in settings would
  // appear unresponsive on accessibility-sensitive setups.
  const prefersReduced = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced || document.documentElement.classList.contains('low-motion')) {
    window.BG = {
      setEnabled: function () {},
      getEnabled: function () { return false; },
      isAvailable:           function () { return false; },
    };
    return;
  }

  // ── Canvas mount ──────────────────────────────────────────────────────────
  const canvas = document.createElement('canvas');
  canvas.id = 'bg-canvas';
  Object.assign(canvas.style, {
    position:      'fixed',
    inset:         '0',
    width:         '100%',
    height:        '100%',
    pointerEvents: 'none',
    zIndex:        '0',
    background:    'transparent',
  });
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

  // ── Helpers ────────────────────────────────────────────────────────────────
  const C = BG_CONFIG;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = arr => arr[(Math.random() * arr.length) | 0];

  // Particle count — clamp to min/max, but also scale with screen area
  function targetCount() {
    const area  = W * H;
    const scale = Math.round(C.emberCount * (area / (1366 * 768)));
    return Math.max(C.emberCountMin, Math.min(C.emberCountMax, scale));
  }

  // ── Particle factory ───────────────────────────────────────────────────────
  // isSuit  — true  → rendered as a suit symbol with a coloured glow
  //           false → rendered as the classic ember dot
  // initial — true  → scatter randomly across full screen height for instant fill
  //           false → spawn just below the bottom edge (steady-state behaviour)
  function mkParticle(initial) {
    const isSuit = Math.random() < C.suitFraction;
    const alphaMin = isSuit ? C.suitAlphaMin : C.emberAlphaMin;
    const alphaMax = isSuit ? C.suitAlphaMax : C.emberAlphaMax;

    return {
      isSuit,
      suit:    isSuit ? pick(C.suitSymbols) : null,
      x:       Math.random() * W,
      y:       initial ? Math.random() * H : H + rnd(0, 40),
      vy:     -rnd(C.emberSpeedMin, C.emberSpeedMax),
      vx:      rnd(-C.emberDriftMax / 2, C.emberDriftMax / 2),
      r:       rnd(C.emberRadiusMin, C.emberRadiusMax),
      a:       rnd(alphaMin, alphaMax),
      life:    0,
      maxLife: rnd(C.emberLifeMin, C.emberLifeMax),
      color:   pick(C.emberPalette),
      wob:     Math.random() * Math.PI * 2,  // wobble phase
      wobSpd:  rnd(0.010, 0.022),            // wobble speed
    };
  }

  // ── Particle pool ──────────────────────────────────────────────────────────
  const particles = [];
  const N = targetCount();
  for (let i = 0; i < N; i++) particles.push(mkParticle(true));

  // ── Draw helpers ───────────────────────────────────────────────────────────
  function drawEmber(p, alpha) {
    const [r, g, b] = p.color;

    // Soft glow (additive blending makes it feel luminous)
    ctx.globalCompositeOperation = 'lighter';
    const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * C.emberGlowMult);
    grad.addColorStop(0,   `rgba(${r},${g},${b},${alpha})`);
    grad.addColorStop(0.4, `rgba(${r},${g},${b},${alpha * 0.35})`);
    grad.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * C.emberGlowMult, 0, Math.PI * 2);
    ctx.fill();

    // Bright core dot
    const [rB, gB, bB] = [Math.min(255, r + 40), Math.min(255, g + 30), Math.min(255, b + 20)];
    ctx.fillStyle = `rgba(${rB},${gB},${bB},${alpha})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalCompositeOperation = 'source-over';
  }

  function drawSuit(p, alpha) {
    // Soft crimson halo (additive)
    ctx.globalCompositeOperation = 'lighter';
    const halo = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, C.suitGlowRadius);
    halo.addColorStop(0,   C.suitGlowColor.replace('1)', `${alpha * 0.55})`));
    halo.addColorStop(0.5, C.suitGlowColor.replace('1)', `${alpha * 0.18})`));
    halo.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(p.x, p.y, C.suitGlowRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    // Symbol — inherit the ember's colour so it fits the warm palette,
    // but tinted slightly toward the suitGlowColor
    const [r, g, b] = p.color;
    ctx.save();
    ctx.globalAlpha    = alpha;
    ctx.fillStyle      = `rgb(${r},${g},${b})`;
    ctx.font           = `${C.suitFontSize}px serif`;
    ctx.textAlign      = 'center';
    ctx.textBaseline   = 'middle';
    ctx.fillText(p.suit, p.x, p.y);
    ctx.restore();
  }

  // ── Animation loop ─────────────────────────────────────────────────────────
  let lastT      = performance.now();
  let pulsePhase = 0;
  // Runtime toggle (controlled via window.BG.setEnabled below).  When false,
  // the RAF loop bails immediately — no clearing, no drawing, no allocations.
  // Mirrors the SOUND module's design (transient runtime state, not persisted).
  let enabled    = true;
  let rafHandle  = 0;

  function frame(now) {
    if (!enabled) { rafHandle = 0; return; }
    const dt = Math.min(40, now - lastT);
    lastT = now;
    const t = dt / 16.67;   // normalised ticks (1.0 = 60 fps)

    ctx.clearRect(0, 0, W, H);

    // ── Bottom glow pulse ────────────────────────────────────────────────
    pulsePhase += C.glowPulseSpeed * t;
    const pulse = 0.55 + 0.45 * Math.sin(pulsePhase);
    const [gr, gg, gb] = C.glowColor;
    const glow = ctx.createRadialGradient(
      W / 2, H + 60, 20,
      W / 2, H + 60, Math.max(W, H) * C.glowRadius
    );
    glow.addColorStop(0,   `rgba(${gr},${gg},${gb},${C.glowAlphaMax * pulse})`);
    glow.addColorStop(0.4, `rgba(${gr},${gg},${gb},${C.glowAlphaMax * 0.45 * pulse})`);
    glow.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // ── Particles ────────────────────────────────────────────────────────
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];

      // Advance
      p.life += t;
      p.wob  += p.wobSpd * t;
      p.x    += p.vx * t + Math.sin(p.wob) * 0.15;
      p.y    += p.vy * t;

      // Fade envelope — ramp in over first 12%, ramp out over last 30%
      const lp = p.life / p.maxLife;
      let alpha = p.a;
      if      (lp < 0.12) alpha *= lp / 0.12;
      else if (lp > 0.70) alpha *= Math.max(0, 1 - (lp - 0.70) / 0.30);

      // Retire when off-screen or life exhausted
      if (p.y < -16 || p.life >= p.maxLife) {
        particles[i] = mkParticle(false);
        continue;
      }

      if (p.isSuit) drawSuit(p, alpha);
      else          drawEmber(p, alpha);
    }

    // Keep pool at target size (screen resize may change it)
    const target = targetCount();
    while (particles.length < target) particles.push(mkParticle(false));

    rafHandle = requestAnimationFrame(frame);
  }
  rafHandle = requestAnimationFrame(frame);

  // ── Public toggle API ──────────────────────────────────────────────────────
  // Exposed as window.BG so settings panels can flip the canvas on/off without
  // tearing it down.  Mirrors window.SOUND's shape (setEnabled / getEnabled).
  window.BG = {
    setEnabled: function (on) {
      const next = !!on;
      if (next === enabled) return;
      enabled = next;
      if (enabled) {
        canvas.style.display = '';
        if (!rafHandle) {
          lastT = performance.now();        // reset dt so the resume frame doesn't jump
          rafHandle = requestAnimationFrame(frame);
        }
      } else {
        canvas.style.display = 'none';
        // Wipe the canvas so we don't leave a frozen-frame ghost behind.
        try { ctx.clearRect(0, 0, W, H); } catch (e) {}
      }
    },
    getEnabled:  function () { return enabled; },
    isAvailable: function () { return true; },
  };
})();
// ──────────────────────────────────────────────────────────────────────────────
