// ── Router — main menu and mode dispatcher ────────────────────────────────────
//
// Loads LAST.  Shows the main menu and switches between StandardApp (window.
// StandardApp) and RpgApp (window.RpgApp).  Both mode buttons are dynamically
// shown/hidden based on whether the respective App is loaded — so deleting
// either mode's folder leaves the other fully playable, and the menu adapts
// automatically.
//
// Load order (last): ... → standard/app.js → rpg/app.js → router.js
// ──────────────────────────────────────────────────────────────────────────────


(function () {
  const { useState } = React;
  const e = React.createElement;

  function MainMenu({ onPick }) {
    const hasStandard = typeof window.StandardApp === 'function';
    const hasRpg      = typeof window.RpgApp      === 'function';

    return e('div', { className: 'app' },
      e('div', { className: 'start' },
        e('div', { className: 'sigil' }, '⛧'),
        e('h1',  { className: 'start-title' }, 'Devil\'s', e('br'), 'Gambit'),
        e('div', { className: 'sep' }),
        e('div', { style: { display:'flex', flexDirection:'column', gap:'10px', width:'100%', maxWidth:'320px' } },
          hasStandard && e('button', {
            className: 'btn-start',
            onClick: () => onPick('standard'),
            style: { padding:'14px' },
          },
            e('span', null, 'Standard Mode'),
          ),
          hasRpg && e('button', {
            className: 'btn-start',
            onClick: () => onPick('rpg'),
            style: { padding:'14px' },
          },
            e('span', null, 'RPG Mode'),
          ),
          // Graceful fallback if neither mode is loaded
          !hasStandard && !hasRpg && e('div', {
            style: { padding: '20px', color: 'var(--lose-color)', fontFamily:"'Cinzel',serif", fontSize:'var(--font-sm)', textAlign:'center' },
          }, 'No game modes found.  Add either standard/ or rpg/ scripts to play.')
        )
      )
    );
  }

  function Router() {
    const [mode, setMode] = useState(null); // null | 'standard' | 'rpg'

    if (mode === 'standard' && typeof window.StandardApp === 'function') {
      return e(window.StandardApp, { onReturnToMenu: () => setMode(null) });
    }
    if (mode === 'rpg' && typeof window.RpgApp === 'function') {
      return e(window.RpgApp, { onReturnToMenu: () => setMode(null) });
    }
    return e(MainMenu, { onPick: setMode });
  }

  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(e(Router));
})();
// ──────────────────────────────────────────────────────────────────────────────
