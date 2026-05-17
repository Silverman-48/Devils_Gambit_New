// ── Router — main menu and mode dispatcher ────────────────────────────────────
//
// Loads LAST.  Shows the main menu and switches between:
//   • StandardApp   (window.StandardApp)   — Standard mode, local pass-and-play
//   • RpgApp        (window.RpgApp)        — RPG mode
//   • OnlineLobby → OnlineApp              — Online play (its own self-contained app)
//
// Each menu entry is dynamically shown/hidden based on whether the matching
// global has been registered.  Delete a mode's folder (or just its block in
// index.html) and the menu adapts automatically — the other modes keep working.
//
// Load order (last):
//   ... → standard/app.js → rpg/app.js → online/lobby.js → online/app.js → router.js
// ──────────────────────────────────────────────────────────────────────────────


(function () {
  const { useState } = React;
  const e = React.createElement;

  function MainMenu({ onPick }) {
    const hasStandard = typeof window.StandardApp === 'function';
    const hasRpg      = typeof window.RpgApp      === 'function';
    // Online needs the whole online stack: lobby, app, peer wrapper, and the
    // PeerJS library itself.  Standard mode is also required because online/
    // currently re-uses STD_PRESET + StdSettingsPanel + StdGambitPanel etc.
    // Any missing piece hides the menu entry entirely (instead of surfacing a
    // broken state).  The lobby ALSO carries its own missing-dep guard as a
    // defence in depth.
    const hasOnline   = hasStandard
                     && typeof window.OnlineLobby === 'function'
                     && typeof window.OnlineApp   === 'function'
                     && typeof window.PeerSession === 'function'
                     && typeof window.Peer        === 'function';

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
          hasOnline && e('button', {
            className: 'btn-start',
            onClick: () => onPick('online'),
            style: { padding:'14px' },
          },
            e('span', null, '⚡ Online (Standard)'),
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
    // Top-level mode the user picked from MainMenu.
    //   null         — show MainMenu
    //   'standard'   — local Standard mode
    //   'rpg'        — RPG mode
    //   'online'     — OnlineLobby first, then OnlineApp with the live PeerSession
    const [mode,        setMode]        = useState(null);
    // After a lobby handshake, this holds the session + role info passed to
    // OnlineApp.  Cleared when the user returns to the main menu.
    const [onlineEntry, setOnlineEntry] = useState(null);

    // Helper used by all child apps to unmount cleanly back to the menu.
    const returnToMenu = () => { setOnlineEntry(null); setMode(null); };

    // Online mode: lobby first, then hand off to OnlineApp (NOT StandardApp —
    // they're independent components now).
    if (mode === 'online' && typeof window.OnlineLobby === 'function') {
      if (onlineEntry && typeof window.OnlineApp === 'function') {
        return e(window.OnlineApp, {
          onReturnToMenu: returnToMenu,
          peerSession:    onlineEntry.peerSession,
          peerRole:       onlineEntry.role,
          localPlayerIdx: onlineEntry.localPlayerIdx,
          playerCount:    onlineEntry.playerCount,
          playerNames:    onlineEntry.playerNames || [],
        });
      }
      return e(window.OnlineLobby, {
        onReturnToMenu: returnToMenu,
        onGameStart:    (entry) => setOnlineEntry(entry),
      });
    }

    if (mode === 'standard' && typeof window.StandardApp === 'function') {
      return e(window.StandardApp, { onReturnToMenu: returnToMenu });
    }
    if (mode === 'rpg' && typeof window.RpgApp === 'function') {
      return e(window.RpgApp, { onReturnToMenu: returnToMenu });
    }
    return e(MainMenu, { onPick: setMode });
  }

  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(e(Router));
})();
// ──────────────────────────────────────────────────────────────────────────────
