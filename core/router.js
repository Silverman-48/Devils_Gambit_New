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
    const [audioOpen, setAudioOpen] = useState(false);

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

      // ── Options overlay — General-only at the main menu ────────────────────
      // Uses the shared GeneralOptionsPanel (sound + background toggle).
      // Falls back to a tiny inline notice if core/sound.js failed to load.
      audioOpen && (window.GeneralOptionsPanel
        ? e(window.GeneralOptionsPanel, { onClose: () => setAudioOpen(false) })
        : e('div', { className: 'set-overlay' },
            e('div', { className: 'set-panel' },
              e('div', { className: 'set-title' }, '⚙ Options'),
              e('div', { className: 'set-section' },
                e('div', { style: {
                  fontFamily: "'Cinzel',serif", fontSize: 'var(--font-xs)',
                  color: 'var(--secondary-color)', padding: '10px 0',
                } }, 'Settings module not loaded (core/sound.js is missing).')
              ),
              e('div', { className: 'set-actions' },
                e('button', { className: 'btn-start', onClick: () => setAudioOpen(false) }, 'Close')
              )
            )
          )),

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
          hasOnline && e('button', {
            className: 'btn-start',
            onClick: () => onPick('online'),
            style: { padding:'14px' },
          },
            e('span', null, 'Online (Standard)'),
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
          }, 'No game modes found.  Add either standard/ or rpg/ scripts to play.'),
          e('button', {
            className: 'btn-options',
            onClick: () => setAudioOpen(true),
            style: { marginTop: '6px', opacity: 0.8 },
          }, '⚙ Options')
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
    // When OnlineApp hands the lobby back ("Back to Lobby"), we stash the
    // existing session here so OnlineLobby can re-attach to it instead of
    // creating a fresh one.  Cleared once the lobby starts a new game.
    const [lobbyResume, setLobbyResume] = useState(null);

    // Helper used by all child apps to unmount cleanly back to the menu.
    const returnToMenu = () => {
      setOnlineEntry(null);
      setLobbyResume(null);
      setMode(null);
    };

    // Online mode: lobby first, then hand off to OnlineApp (NOT StandardApp —
    // they're independent components now).
    if (mode === 'online' && typeof window.OnlineLobby === 'function') {
      if (onlineEntry && typeof window.OnlineApp === 'function') {
        return e(window.OnlineApp, {
          onReturnToMenu: returnToMenu,
          // Re-enter the lobby with the same session so disconnected players
          // can rejoin via the same room code.  The OnlineApp clears its
          // own handlers and the lobby takes them over again.
          onBackToLobby:  () => {
            setLobbyResume({
              session:     onlineEntry.peerSession,
              role:        onlineEntry.role,
              playerNames: onlineEntry.playerNames || [],
            });
            setOnlineEntry(null);
          },
          peerSession:    onlineEntry.peerSession,
          peerRole:       onlineEntry.role,
          localPlayerIdx: onlineEntry.localPlayerIdx,
          playerCount:    onlineEntry.playerCount,
          playerNames:    onlineEntry.playerNames || [],
        });
      }
      return e(window.OnlineLobby, {
        onReturnToMenu: returnToMenu,
        onGameStart:    (entry) => { setLobbyResume(null); setOnlineEntry(entry); },
        resumeSession:  lobbyResume && lobbyResume.session,
        resumeRole:     lobbyResume && lobbyResume.role,
        resumeNames:    lobbyResume && lobbyResume.playerNames,
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
