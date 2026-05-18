// ── Sound system ──────────────────────────────────────────────────────────────
//
// Three sound groups, each toggled ON / OFF:
//   • ui    — button clicks (delegated globally on every <button> click)
//   • card  — card appear / disappear (called explicitly by app.js)
//   • music — looping background music (starts on first user interaction)
//
// To plug your own files in:  drop them into a /sounds/ folder next to
// index.html and update SOUND_PATHS below.  Missing files fail silently.
// ──────────────────────────────────────────────────────────────────────────────


// ── PATHS ─────────────────────────────────────────────────────────────────────
// Replace with the relative paths to your audio files.  Any common web audio
// format works (mp3, ogg, wav, m4a).  An empty string disables that sound.
const SOUND_PATHS = {
  click:         'sounds/click.mp3',
  cardAppear:    'sounds/card-appear.mp3',
  cardDisappear: 'sounds/card-disappear.mp3',
  music:         'sounds/music.mp3',
};

// ── DEFAULT ENABLED STATE ──────────────────────────────────────────────────────
// true = on, false = off.  Music is off by default to avoid surprising the user.
const SOUND_DEFAULTS = {
  ui:    true,   // button clicks
  card:  true,   // card appear / disappear
  music: false,  // background music
};

// ── FIXED PLAYBACK VOLUMES (0.0 – 1.0) ────────────────────────────────────────
// Adjust these if a sound is too loud or too quiet once you add your files.
const SOUND_VOLUMES = {
  ui:    0.55,
  card:  0.55,
  music: 0.35,
};

// ── OVERLAP POOL SIZE ────────────────────────────────────────────────────────
// Number of Audio elements per SFX so rapid retriggers can overlap cleanly.
const SOUND_POOL_SIZE = 4;
// ──────────────────────────────────────────────────────────────────────────────


(function () {
  // ── Enabled state ──────────────────────────────────────────────────────────
  let enabled = { ...SOUND_DEFAULTS };

  // ── Music — single looping Audio element ───────────────────────────────────
  let musicEl       = null;
  let musicHasError = false;

  function ensureMusic() {
    if (musicEl || musicHasError || !SOUND_PATHS.music) return;
    try {
      musicEl = new Audio(SOUND_PATHS.music);
      musicEl.loop    = true;
      musicEl.volume  = SOUND_VOLUMES.music;
      musicEl.preload = 'auto';
      musicEl.addEventListener('error', () => { musicHasError = true; musicEl = null; });
    } catch (e) { musicHasError = true; musicEl = null; }
  }

  function tryPlay(audio) {
    if (!audio) return;
    try {
      const p = audio.play();
      if (p && p.catch) p.catch(() => {}); // swallow autoplay-rejection & decode errors
    } catch (e) {}
  }

  // ── SFX pools — short, may overlap ─────────────────────────────────────────
  const pools   = {};  // { key: [Audio, Audio, ...] }
  const poolIdx = {};  // { key: int } round-robin cursor

  function playSfx(key, group) {
    if (!enabled[group]) return;
    const path = SOUND_PATHS[key];
    if (!path) return;
    const vol = SOUND_VOLUMES[group] ?? 0;
    if (vol <= 0) return;

    if (!pools[key]) {
      pools[key]   = [];
      poolIdx[key] = 0;
      for (let i = 0; i < SOUND_POOL_SIZE; i++) {
        try {
          const a = new Audio(path);
          a.preload = 'auto';
          pools[key].push(a);
        } catch (e) { /* skip */ }
      }
    }
    const pool = pools[key];
    if (!pool.length) return;

    const idx    = poolIdx[key];
    poolIdx[key] = (idx + 1) % pool.length;
    const a      = pool[idx];
    try {
      a.volume      = vol;
      a.currentTime = 0;
    } catch (e) {}
    tryPlay(a);
  }

  // ── First-interaction unlock (browsers block autoplay otherwise) ──────────
  let interacted = false;
  function userInteracted() {
    if (interacted) return;
    interacted = true;
    if (enabled.music) {
      ensureMusic();
      if (musicEl && musicEl.paused) tryPlay(musicEl);
    }
  }

  // ── Toggle helpers ─────────────────────────────────────────────────────────
  function setEnabled(group, on) {
    if (!(group in SOUND_DEFAULTS)) return;
    enabled[group] = !!on;

    if (group === 'music') {
      if (enabled.music) {
        if (interacted) {
          ensureMusic();
          if (musicEl && musicEl.paused) tryPlay(musicEl);
        }
      } else {
        if (musicEl && !musicEl.paused) {
          try { musicEl.pause(); } catch (e) {}
        }
      }
    }
  }

  function getEnabled(group) {
    return !!enabled[group];
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  window.SOUND = {
    GROUPS:            ['music', 'ui', 'card'],
    playClick:         () => playSfx('click',         'ui'),
    playCardAppear:    () => playSfx('cardAppear',    'card'),
    playCardDisappear: () => playSfx('cardDisappear', 'card'),
    setEnabled,
    getEnabled,
    getVolume: (group) => SOUND_VOLUMES[group] ?? 0,
    setVolume: (group, vol) => {
      if (!(group in SOUND_VOLUMES)) return;
      SOUND_VOLUMES[group] = Math.max(0, Math.min(1, Number(vol) || 0));
      if (group === 'music' && musicEl) {
        try { musicEl.volume = SOUND_VOLUMES.music; } catch (e) {}
      }
    },
    unlock: userInteracted,
  };

  // ── Global click delegation — sound for every <button> click ──────────────
  // Capture phase so we hear it before any stopPropagation that game code does.
  document.addEventListener('click', (ev) => {
    userInteracted();
    const btn = ev.target && ev.target.closest && ev.target.closest('button');
    if (!btn || btn.disabled) return;
    playSfx('click', 'ui');

    // .inf-toggle-btn one-shot pulse: triggered only on real user clicks so it
    // never fires on element mount (unlike a CSS transition would).  Remove
    // first, force a reflow, then re-add so the animation restarts even on
    // rapid double-clicks of the same button.
    if (btn.classList.contains('inf-toggle-btn')) {
      btn.classList.remove('pulse');
      // eslint-disable-next-line no-unused-expressions
      void btn.offsetWidth; // force reflow so the next class-add restarts the animation
      btn.classList.add('pulse');
      setTimeout(() => btn.classList.remove('pulse'), 320);
    }
  }, true);

  // Touch / keyboard also unlock audio (for first-interaction-only browsers)
  document.addEventListener('touchstart', userInteracted, { once: true, passive: true });
  document.addEventListener('keydown',    userInteracted, { once: true });


  // ── SoundControls — React component used by both settings panels ──────────
  // Three rows (Music / Button Clicks / Cards), each with an ON/OFF toggle
  // and a volume slider so players can fine-tune levels independently.
  function SoundControls() {
    const e = React.createElement;
    const [tick, setTick] = React.useState(0); // force re-render after toggle
    const [volumes, setVolumes] = React.useState({
      music: SOUND_VOLUMES.music,
      ui:    SOUND_VOLUMES.ui,
      card:  SOUND_VOLUMES.card,
    });

    const toggle = (group) => {
      setEnabled(group, !getEnabled(group));
      setTick(t => t + 1);
    };

    const changeVolume = (group, val) => {
      const clamped = Math.max(0, Math.min(1, val));
      SOUND_VOLUMES[group] = clamped;
      // Update the live music element immediately (SFX pools read volume at play-time).
      if (group === 'music' && musicEl) {
        try { musicEl.volume = clamped; } catch (ex) {}
      }
      setVolumes(v => ({ ...v, [group]: clamped }));
    };

    const row = (label, group, hint) => {
      const on  = getEnabled(group);
      const vol = volumes[group] ?? 0;
      return e('div', { key: group, className: 'set-row',
        style: { flexDirection: 'column', alignItems: 'stretch', gap: '6px' } },
        // Toggle row
        e('div', { style: { display: 'flex', alignItems: 'center' } },
          e('div', { style: { display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, paddingRight: '10px' } },
            e('span', { className: 'set-lbl' }, label),
            hint && e('div', {
              style: {
                fontFamily: "'Cinzel',serif", fontSize: 'var(--font-xs)',
                color: 'var(--secondary-color)', marginTop: '2px',
              },
            }, hint)
          ),
          e('button', {
            className: 'inf-toggle-btn' + (on ? ' on' : ''),
            onClick: (ev) => { ev.stopPropagation(); toggle(group); },
          }, on ? 'ON' : 'OFF')
        ),
        // Volume slider
        e('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
          e('span', { style: {
            fontSize: 'var(--font-xs)', color: 'var(--secondary-color)',
            lineHeight: 1, flexShrink: 0,
          } }, '🔈'),
          e('input', {
            type: 'range', min: 0, max: 100,
            value: Math.round(vol * 100),
            style: {
              flex: 1, minWidth: 0, cursor: 'pointer',
              accentColor: 'var(--accent-color, #ffcc4d)',
            },
            onChange: (ev) => changeVolume(group, Number(ev.target.value) / 100),
          }),
          e('span', { style: {
            fontFamily: "'Cinzel',serif", fontSize: 'var(--font-xs)',
            color: 'var(--secondary-color)', minWidth: '34px', textAlign: 'right', flexShrink: 0,
          } }, Math.round(vol * 100) + '%')
        )
      );
    };

    return e('div', null,
      row('Music',         'music', 'Background loop'),
      row('Button Clicks', 'ui',    'UI interaction'),
      row('Cards',         'card',  'Deal & flip sounds'),
    );
  }

  window.SoundControls = SoundControls;


  // ── GeneralControls — sound + ambient-background toggle ──────────────────
  // Shared across all settings panels (Standard / RPG / Online host / Online
  // guest / Main menu).  Renders the existing SoundControls on top and a
  // single Background row underneath that flips window.BG.setEnabled(...).
  //
  // When core/background.js exposes window.BG.isAvailable() === false (e.g.
  // prefers-reduced-motion is on, or the file was deleted), the toggle row
  // is replaced with a one-line notice instead of a non-functional button —
  // so the panel never shows a control that silently does nothing.
  // ── Compact-gambits preference key ────────────────────────────────────────
  // In-memory compact-gambits flag — resets to false on every page load.
  // A custom event notifies live React components without requiring a shared
  // context or re-mounting the whole tree.
  let _compactGambits = false;
  function getCompactGambits() { return _compactGambits; }
  function setCompactGambits(on) {
    _compactGambits = !!on;
    window.dispatchEvent(new Event('compactGambitsChanged'));
  }
  window.getCompactGambits = getCompactGambits;
  window.setCompactGambits = setCompactGambits;


  function GeneralControls() {
    const e = React.createElement;
    const [, force] = React.useState(0);
    const rerender = () => force(t => t + 1);

    const bgAvailable = !!(window.BG && window.BG.isAvailable && window.BG.isAvailable());
    const bgOn        = bgAvailable ? window.BG.getEnabled() : false;
    const compactOn   = getCompactGambits();

    return e('div', null,
      window.SoundControls
        ? e(window.SoundControls)
        : e('div', { style: {
            fontFamily: "'Cinzel',serif", fontSize: 'var(--font-xs)',
            color: 'var(--secondary-color)', padding: '10px 0',
          } }, 'Sound module not loaded.'),

      // ── Background toggle row ───────────────────────────────────────────
      e('div', { className: 'set-row',
        style: { marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--line-color)' } },
        e('div', { style: { display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, paddingRight: '10px' } },
          e('span', { className: 'set-lbl' }, 'Background'),
          e('div', { style: {
            fontFamily: "'Cinzel',serif", fontSize: 'var(--font-xs)',
            color: 'var(--secondary-color)', marginTop: '2px',
          } },
            bgAvailable
              ? (bgOn ? 'Ambient embers & suits' : 'Static — saves battery')
              : 'Disabled by reduced-motion preference')
        ),
        bgAvailable
          ? e('button', {
              className: 'inf-toggle-btn' + (bgOn ? ' on' : ''),
              onClick: (ev) => {
                ev.stopPropagation();
                window.BG.setEnabled(!bgOn);
                rerender();
              },
            }, bgOn ? 'ON' : 'OFF')
          : e('span', {
              style: { fontFamily: "'Cinzel',serif", fontSize: 'var(--font-xs)',
                color: 'var(--secondary-color)', opacity: 0.6 },
            }, '—')
      ),

      // ── Compact gambits toggle row ──────────────────────────────────────
      e('div', { className: 'set-row',
        style: { marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--line-color)' } },
        e('div', { style: { display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, paddingRight: '10px' } },
          e('span', { className: 'set-lbl' }, 'Compact Gambits'),
          e('div', { style: {
            fontFamily: "'Cinzel',serif", fontSize: 'var(--font-xs)',
            color: 'var(--secondary-color)', marginTop: '2px',
          } }, compactOn ? 'Emoji-only single row' : 'Full 3-row grid')
        ),
        e('button', {
          className: 'inf-toggle-btn' + (compactOn ? ' on' : ''),
          onClick: (ev) => {
            ev.stopPropagation();
            setCompactGambits(!compactOn);
            rerender();
          },
        }, compactOn ? 'ON' : 'OFF')
      )
    );
  }
  window.GeneralControls = GeneralControls;


  // ── GeneralOptionsPanel — standalone overlay ─────────────────────────────
  // Drop-in panel used by lobby/menu screens that don't need the full
  // game-options multi-section UI.  Wraps GeneralControls in the same overlay
  // chrome as StdSettingsPanel for visual consistency.
  function GeneralOptionsPanel({ onClose, title, extraActions }) {
    const e = React.createElement;
    return e('div', { className: 'set-overlay' },
      e('div', { className: 'set-panel' },
        e('div', { className: 'set-title' }, title || '⚙ Options'),
        e('div', { className: 'set-section' }, e(GeneralControls)),
        e('div', { className: 'set-actions' },
          e('button', { className: 'btn-start', onClick: onClose }, 'Close'),
          // Optional extras (e.g. "Leave Room" for online guest panel).  Passed
          // in as an array of pre-built React elements so callers stay flexible.
          ...(Array.isArray(extraActions) ? extraActions : []),
        )
      )
    );
  }
  window.GeneralOptionsPanel = GeneralOptionsPanel;
})();
// ──────────────────────────────────────────────────────────────────────────────
