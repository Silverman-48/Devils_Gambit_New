// ── Online Lobby — connection + pre-game setup ────────────────────────────────
//
// Self-contained React component that handles all of the connection state
// BEFORE the actual game starts.  Once a host clicks "Start Game" (or a
// guest receives a 'game-start' message from the host), the lobby calls
// onGameStart(...) and the parent router mounts StandardApp in its place.
//
// This file is OPTIONAL — if it (or its dependencies) is missing, the
// router gracefully hides the Online menu entry.
//
// Dependencies:
//   • window.React, window.ReactDOM        (already loaded)
//   • window.PeerSession                   (core/peer.js)
//   • window.StdSettingsPanel              (standard/components.js — reused for pre-game settings UI)
//   • STD_PRESET / STANDARD_PRESETS        (standard/engine.js, presets.js)
//   • window.OnlineApp                     (online/app.js)  — checked by router at render time, NOT here
//
// Standard mode only.  RPG mode has no online support by design.
//
// Load order (only if Online mode is included):
//   ... → standard/app.js → core/peer.js → online/lobby.js → online/app.js → router.js
// ──────────────────────────────────────────────────────────────────────────────


(function () {
  const e   = React.createElement;
  const { useState, useEffect, useRef, useCallback } = React;

  // ── Hard requirements ──────────────────────────────────────────────────────
  // If anything we depend on is missing, expose a stub that renders an error
  // instead of failing silently.  The router's feature check will still treat
  // window.OnlineLobby as present, so we render something helpful.
  const missingDep = [];
  if (typeof window.PeerSession      !== 'function') missingDep.push('core/peer.js');
  if (typeof window.Peer             !== 'function') missingDep.push('PeerJS CDN (check network / ad-blocker)');
  if (typeof window.StdSettingsPanel !== 'function') missingDep.push('standard/components.js');
  if (typeof STD_PRESET              === 'undefined') missingDep.push('standard/engine.js');
  // NOTE: window.OnlineApp is NOT checked here — online/app.js loads AFTER this
  // file in index.html, so it would always appear missing at IIFE-execution time.
  // The router checks window.OnlineApp at render time (after all scripts load).

  if (missingDep.length) {
    window.OnlineLobby = function OnlineLobbyMissing({ onReturnToMenu }) {
      return e('div', { className: 'app' },
        e('div', { className: 'start' },
          e('div', { className: 'sigil' }, '⛧'),
          e('h2',  { className: 'gottl' }, 'Online unavailable'),
          e('p',   { className: 'gosub', style: { textAlign: 'center', maxWidth: '320px' } },
            'Missing: ' + missingDep.join(', ')),
          e('button', { className: 'btn-options', onClick: onReturnToMenu, style: { marginTop: '20px' } },
            '← Main Menu')
        )
      );
    };
    return;
  }


  // ── Lobby protocol messages ────────────────────────────────────────────────
  // Anything not prefixed with LOBBY_ is treated as game traffic and is
  // ignored by the lobby (the eventual StandardApp will pick it up after the
  // game starts).  We keep these out of band so the lobby and game can share
  // one PeerSession seamlessly.
  const MSG = {
    LOBBY_ROSTER:    'lobby-roster',     // host → all : current player list
    LOBBY_GAME_START:'lobby-game-start', // host → all : kick off the game
    LOBBY_HOST_GONE: 'lobby-host-gone',  // host → all : tearing down
    LOBBY_GUEST_NAME:'lobby-guest-name', // guest → host: rename
    LOBBY_ROOM_FULL: 'lobby-room-full',  // host → guest: room at capacity, please disconnect
    LOBBY_GAME_LOCKED:'lobby-game-locked', // host → guest: game already in progress, please disconnect
    LOBBY_BACK:      'lobby-back',       // host → all : returning to lobby (sent by OnlineApp)
    LOBBY_KICKED:    'lobby-kicked',     // host → guest: removed from the room by host
  };
  // Exposed so OnlineApp can reuse the same message constants for the
  // back-to-lobby handshake without re-declaring them.
  window.OnlineLobbyMSG = MSG;

  const MAX_PLAYERS = 5; // host + 4 guests


  // ── Settings draft helper ──────────────────────────────────────────────────
  // Mirrors what StandardApp does on settings open — gives the host a writable
  // copy of STD_PRESET so they can configure without affecting the live values
  // until they hit "Start Game".
  function freshDraftFromPreset() {
    return {
      ...STD_PRESET,
      deckOverrides:     { ...STD_PRESET.deckOverrides     },
      cardValues:        { ...STD_PRESET.cardValues        },
      disabledGambits:   { ...STD_PRESET.disabledGambits   },
      gambitMultipliers: { ...STD_PRESET.gambitMultipliers },
    };
  }

  function applyDraftToPreset(draft) {
    Object.assign(STD_PRESET, draft);
    STD_PRESET.deckOverrides     = { ...draft.deckOverrides     };
    STD_PRESET.cardValues        = { ...draft.cardValues        };
    STD_PRESET.disabledGambits   = { ...draft.disabledGambits   };
    STD_PRESET.gambitMultipliers = { ...draft.gambitMultipliers };
  }


  // ── Serializable preset snapshot (sent host → guest at game start) ─────────
  // PeerJS uses structured-clone so plain objects are fine; we deep-clone the
  // nested settings dictionaries so the receiver can't accidentally share refs
  // with the sender's draft state.
  function snapshotPreset() {
    return {
      ...STD_PRESET,
      deckOverrides:     { ...STD_PRESET.deckOverrides     },
      cardValues:        { ...STD_PRESET.cardValues        },
      disabledGambits:   { ...STD_PRESET.disabledGambits   },
      gambitMultipliers: { ...STD_PRESET.gambitMultipliers },
    };
  }

  function installPresetSnapshot(snap) {
    if (!snap) return;
    Object.assign(STD_PRESET, snap);
    STD_PRESET.deckOverrides     = { ...(snap.deckOverrides     || {}) };
    STD_PRESET.cardValues        = { ...(snap.cardValues        || {}) };
    STD_PRESET.disabledGambits   = { ...(snap.disabledGambits   || {}) };
    STD_PRESET.gambitMultipliers = { ...(snap.gambitMultipliers || {}) };
    // Force multiplayer mode ON for online play — the host's pass-and-play
    // toggle would otherwise leak into the guest's local view.
    STD_PRESET.multiplayer = true;
  }


  // ── OnlineLobby React component ────────────────────────────────────────────
  function OnlineLobby({
    onReturnToMenu,
    onGameStart,
    // When provided, we re-attach to a live session handed back from OnlineApp
    // (via the router's Back-to-Lobby path) instead of opening a fresh peer.
    resumeSession,
    resumeRole,           // 'host' | 'guest' — only matters when resumeSession is set
    resumeNames,          // string[] — index-aligned local names from the previous game
  }) {
    // Connection / lobby state machine
    //   'choosing'       — pick host or join
    //   'host-creating'  — calling hostCreate, waiting for the peer to open
    //   'host-waiting'   — room is up, optionally guests have joined, host can start
    //   'host-settings'  — settings panel overlay
    //   'guest-entering' — entering a room code
    //   'guest-connecting' — connecting to host
    //   'guest-waiting'  — connected, waiting for game-start
    //   'error'          — generic terminal failure for this lobby session
    //   'starting'       — handshake done, about to hand off to StandardApp
    const initialPhase = resumeSession
      ? (resumeRole === 'host' ? 'host-waiting' : 'guest-waiting')
      : 'choosing';
    const [phase,     setPhase]     = useState(initialPhase);
    const [error,     setError]     = useState(null);
    const [code,      setCode]      = useState('');       // guest's typed code
    const [name,      setName]      = useState(() => {
      // When resuming, preserve our own display name so the host stepper +
      // roster line don't suddenly reset to "Player".
      if (resumeSession && Array.isArray(resumeNames)) {
        if (resumeRole === 'host') return resumeNames[0] || '';
      }
      return resumeSession && resumeSession.localName ? resumeSession.localName : '';
    });
    const [roomCode,  setRoomCode]  = useState(
      resumeSession ? (resumeSession.roomCode || null) : null
    );
    const [roster,    setRoster]    = useState([]);       // [{ idx, name, isHost }]
    const [draft,     setDraft]     = useState(freshDraftFromPreset);
    const [settingsOpen, setSettingsOpen] = useState(false);
    // Persisted across panel close/reopen so the highlighted preset card
    // stays put when the host bounces in and out of game settings.
    const [presetId,  setPresetId]  = useState(
      (typeof STANDARD_PRESETS !== 'undefined' && STANDARD_PRESETS[0]) ? STANDARD_PRESETS[0].id : null
    );

    const sessionRef = useRef(resumeSession || null);
    const startedRef = useRef(false);   // guards double-fire of onGameStart
    // Set when the host rejects us with a definitive reason (room full or
    // game in progress).  The host then force-closes the conn, which would
    // otherwise overwrite our error with a generic "Lost connection" notice.
    const rejectedRef = useRef(false);
    // Set when the user clicks Cancel during 'guest-connecting'.  We destroy
    // the session immediately so the UI moves on, but the in-flight
    // peer.connect() timeout will still eventually reject — this ref lets
    // the catch handler distinguish a user-cancel from a real failure.
    const cancelledRef = useRef(false);
    // General-options overlay (sound + background) — opened from a small ⚙
    // button on the host-waiting / guest-entering / guest-connecting /
    // guest-waiting screens so users can tweak audio without leaving the lobby.
    const [generalOpen, setGeneralOpen] = useState(false);


    // ── Tear-down on unmount ────────────────────────────────────────────────
    useEffect(() => {
      return () => {
        // Only destroy the session if we didn't hand it off to the game.
        if (sessionRef.current && !startedRef.current) {
          try { sessionRef.current.destroy(); } catch (e) {}
          sessionRef.current = null;
        }
      };
    }, []);


    // ── Helpers ─────────────────────────────────────────────────────────────
    const setErrorAndBack = (msg) => {
      setError(msg);
      setPhase('error');
    };

    const broadcastRoster = useCallback((session, currentRoster) => {
      // Host shares the current roster with every guest so they can show who
      // else is in the room.
      session.send({ type: MSG.LOBBY_ROSTER, roster: currentRoster });
    }, []);

    const buildRoster = useCallback((session, hostName) => {
      const guests = session.getGuestList();
      const list = [{ idx: 0, name: hostName || '', isHost: true }];
      guests.forEach((g, i) => list.push({ idx: i + 1, name: g.name || '', isHost: false, peerId: g.peerId }));
      return list;
    }, []);


    // ── Resume: re-attach to a live session handed back from OnlineApp ─────
    // When the host clicks "Back to Lobby", the router hands the live
    // PeerSession down to a fresh OnlineLobby instance.  We need to put back
    // the message / join / leave handlers that OnlineApp cleared, and rebuild
    // the roster from the session's known peers.
    useEffect(() => {
      if (!resumeSession) return;
      const session = sessionRef.current;
      if (!session || session.destroyed) {
        setErrorAndBack('Lost connection while returning to lobby.');
        return;
      }

      if (resumeRole === 'host') {
        const hostName = (Array.isArray(resumeNames) && resumeNames[0]) || session.localName || '';

        session.onPeerJoin = (peerInfo) => {
          if (session.getGuestList().length > MAX_PLAYERS - 1) {
            try { session.sendTo(peerInfo.peerId, { type: MSG.LOBBY_ROOM_FULL }); } catch (e) {}
            return;
          }
          const updated = buildRoster(session, hostName);
          setRoster(updated);
          broadcastRoster(session, updated);
        };
        session.onPeerLeave = () => {
          const updated = buildRoster(session, hostName);
          setRoster(updated);
          broadcastRoster(session, updated);
        };
        session.onMessage = () => { /* lobby ignores game-layer traffic */ };

        // Rebuild + push the current roster so reconnecting guests immediately
        // see the room state.
        const initial = buildRoster(session, hostName);
        setRoster(initial);
        broadcastRoster(session, initial);
        return;
      }

      // Guest resume: re-attach the lobby-protocol message listener.
      session.onMessage = (msg) => {
        if (!msg || typeof msg !== 'object') return;
        if (msg.type === MSG.LOBBY_ROSTER) {
          setRoster(Array.isArray(msg.roster) ? msg.roster : []);
        } else if (msg.type === MSG.LOBBY_GAME_START) {
          handleGuestGameStart(msg);
        } else if (msg.type === MSG.LOBBY_HOST_GONE) {
          if (!startedRef.current) setErrorAndBack('Host closed the room.');
        } else if (msg.type === MSG.LOBBY_KICKED) {
          if (!startedRef.current) {
            rejectedRef.current = true;
            setErrorAndBack('You were removed from the room by the host.');
          }
        }
      };
      session.onPeerLeave = () => {
        if (!startedRef.current && !rejectedRef.current) setErrorAndBack('Lost connection to host.');
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [resumeSession, resumeRole]);


    // ── Host: create the room ───────────────────────────────────────────────
    const onHost = async () => {
      setError(null);
      setPhase('host-creating');
      const displayName = name.trim();
      const session = new window.PeerSession();
      sessionRef.current = session;

      session.onPeerJoin = (peerInfo) => {
        // getGuestList() already includes the new peer when this fires.
        if (session.getGuestList().length > MAX_PLAYERS - 1) {
          // Room is full — politely bounce the extra guest.
          try { session.sendTo(peerInfo.peerId, { type: MSG.LOBBY_ROOM_FULL }); } catch (e) {}
          return;
        }
        const updated = buildRoster(session, displayName);
        setRoster(updated);
        broadcastRoster(session, updated);
      };
      session.onPeerLeave = (peerInfo) => {
        const updated = buildRoster(session, displayName);
        setRoster(updated);
        broadcastRoster(session, updated);
      };
      session.onError = (err) => {
        // Non-fatal post-open errors — keep the lobby up but surface to user.
        console.warn('[lobby host] peer error', err);
      };
      session.onMessage = (msg, fromPeerId) => {
        // Lobby only listens for its own message types; everything else is
        // for the game layer that mounts after onGameStart.
        if (!msg || typeof msg !== 'object') return;
        if (msg.type === MSG.LOBBY_GUEST_NAME) {
          // Currently guests send their name via the protocol-level hello in
          // core/peer.js; this is a future hook for in-lobby renames.
        }
      };

      try {
        const { roomCode: rc } = await session.hostCreate({ name: displayName });
        if (!sessionRef.current || sessionRef.current.destroyed) return;
        setRoomCode(rc);
        const initial = buildRoster(session, displayName);
        setRoster(initial);
        setPhase('host-waiting');
      } catch (err) {
        console.error('[lobby host] create failed', err);
        setErrorAndBack(err && err.message ? err.message : 'Could not create room.');
        if (sessionRef.current) { sessionRef.current.destroy(); sessionRef.current = null; }
      }
    };


    // ── Guest: connect to a host ────────────────────────────────────────────
    const onJoin = async () => {
      setError(null);
      const cleaned = window.PeerSession.normalizeCode(code);
      if (cleaned.length !== 4) {
        setError('Room code must be 4 characters.');
        return;
      }
      setPhase('guest-connecting');
      const displayName = name.trim();
      const session = new window.PeerSession();
      sessionRef.current = session;

      session.onPeerLeave = (peerInfo) => {
        // The only peer a guest has is the host.  If they drop, the lobby
        // can't recover (PeerJS doesn't give us reconnect for free).
        // If we were just rejected (room full / game in progress), the host
        // closes the conn on us — don't clobber the specific error message.
        if (!startedRef.current && !rejectedRef.current) {
          setErrorAndBack('Lost connection to host.');
        }
      };
      session.onMessage = (msg) => {
        if (!msg || typeof msg !== 'object') return;
        if (msg.type === MSG.LOBBY_ROSTER) {
          setRoster(Array.isArray(msg.roster) ? msg.roster : []);
        } else if (msg.type === MSG.LOBBY_GAME_START) {
          handleGuestGameStart(msg);
        } else if (msg.type === MSG.LOBBY_HOST_GONE) {
          if (!startedRef.current) setErrorAndBack('Host closed the room.');
        } else if (msg.type === MSG.LOBBY_ROOM_FULL) {
          if (!startedRef.current) {
            rejectedRef.current = true;
            setErrorAndBack('This room is full (max ' + MAX_PLAYERS + ' players).');
          }
        } else if (msg.type === MSG.LOBBY_GAME_LOCKED) {
          if (!startedRef.current) {
            rejectedRef.current = true;
            setErrorAndBack('This room is already in a game. Wait for it to finish and try again.');
          }
        } else if (msg.type === MSG.LOBBY_KICKED) {
          if (!startedRef.current) {
            rejectedRef.current = true;
            setErrorAndBack('You were removed from the room by the host.');
          }
        }
      };

      try {
        await session.guestJoin(cleaned, { name: displayName });
        if (!sessionRef.current || sessionRef.current.destroyed) return;
        setRoomCode(cleaned);
        setPhase('guest-waiting');
      } catch (err) {
        // User-initiated cancel during connect — swallow the eventual reject
        // from peer.js's timeout so we don't flash a fake "timed out" error.
        if (cancelledRef.current) { cancelledRef.current = false; return; }
        console.error('[lobby guest] join failed', err);
        setErrorAndBack(err && err.message ? err.message : 'Could not join room.');
        if (sessionRef.current) { sessionRef.current.destroy(); sessionRef.current = null; }
      }
    };


    // ── Host: kick / remove a guest from the lobby ──────────────────────────
    // Sends a LOBBY_KICKED notice to the target guest so their UI can show a
    // clear "removed" message, then closes the DataConnection from our side.
    // The session's _handleConnClose fires automatically → onPeerLeave → roster
    // is rebuilt and re-broadcast, so no extra cleanup is needed here.
    const onKickPlayer = (peerId) => {
      const session = sessionRef.current;
      if (!session || !peerId) return;
      try { session.sendTo(peerId, { type: MSG.LOBBY_KICKED }); } catch (e) {}
      try { session.closeConn(peerId); } catch (e) {}
    };


    // ── Guest: cancel mid-connect (skip the 60s timeout wait) ───────────────
    // Destroys the session immediately and drops the user back at the room-
    // code entry screen.  The in-flight Promise from peer.js will still reject
    // eventually, but cancelledRef makes the catch handler ignore it.
    const onCancelConnecting = () => {
      cancelledRef.current = true;
      const session = sessionRef.current;
      if (session) { try { session.destroy(); } catch (e) {} }
      sessionRef.current = null;
      setError(null);
      setPhase('guest-entering');
    };


    // ── Guest: host has fired game-start ────────────────────────────────────
    const handleGuestGameStart = (msg) => {
      if (startedRef.current) return;
      startedRef.current = true;
      installPresetSnapshot(msg.preset);
      const session = sessionRef.current;
      // Detach lobby-only message handlers so the game layer can take over.
      session.onMessage = null;
      session.onPeerJoin = null;
      session.onPeerLeave = null;
      onGameStart({
        peerSession:    session,
        role:           'guest',
        localPlayerIdx: msg.yourIdx,
        playerCount:    msg.playerCount,
        playerNames:    Array.isArray(msg.playerNames) ? msg.playerNames : [],
      });
    };


    // ── Host: kick off the game ─────────────────────────────────────────────
    const onStartGame = () => {
      const session = sessionRef.current;
      if (!session || phase !== 'host-waiting') return;
      if (session.getPeerCount() < 1) return; // need at least one guest

      // Bake draft → live preset, and force MP on for the online flow.
      applyDraftToPreset(draft);
      STD_PRESET.multiplayer = true;
      STD_PRESET.playerCount = roster.length;

      const preset = snapshotPreset();
      // Build player name list (index-aligned, empty string = use default P# label).
      const playerNames = roster.map(p => (p.name || '').trim());

      // Build the peerId → playerIdx map BEFORE handing off the session so the
      // online app's sync code (which validates incoming action messages by
      // sender index) has its lookup table ready at first paint.
      const playerMap = {};
      roster.forEach((p) => {
        if (!p.isHost && p.peerId) playerMap[p.peerId] = p.idx;
      });
      session.playerMap = playerMap;

      // Tell each guest their player index (host is 0, guests follow roster order).
      roster.forEach((p) => {
        if (p.isHost || !p.peerId) return;
        session.sendTo(p.peerId, {
          type:        MSG.LOBBY_GAME_START,
          yourIdx:     p.idx,
          playerCount: roster.length,
          preset,
          playerNames,
        });
      });

      startedRef.current = true;
      session.onMessage   = null;
      session.onPeerJoin  = null;
      session.onPeerLeave = null;
      onGameStart({
        peerSession:    session,
        role:           'host',
        localPlayerIdx: 0,
        playerCount:    roster.length,
        playerNames,
      });
    };


    // ── Host: cancel and tell guests we're going away ──────────────────────
    const onHostCancel = () => {
      const session = sessionRef.current;
      if (session) {
        try { session.send({ type: MSG.LOBBY_HOST_GONE }); } catch (e) {}
        try { session.destroy(); } catch (e) {}
      }
      sessionRef.current = null;
      onReturnToMenu();
    };

    const onGuestCancel = () => {
      const session = sessionRef.current;
      if (session) { try { session.destroy(); } catch (e) {} }
      sessionRef.current = null;
      onReturnToMenu();
    };


    // ── Render helpers ──────────────────────────────────────────────────────
    // isHostView=true → show kick buttons next to each guest (host-waiting only).
    const renderRoster = (showWaitingHint, isHostView) =>
      e('div', { className: 'lobby-roster' },
        e('div', { className: 'lobby-roster-title' }, 'Players in room'),
        roster.length === 0
          ? e('div', { className: 'lobby-roster-empty' }, '— no one yet —')
          : roster.map(p =>
              e('div', { key: p.idx, className: 'lobby-roster-row' + (p.isHost ? ' lobby-roster-host' : '') },
                e('span', { className: 'lobby-roster-dot' }, '●'),
                e('span', { className: 'lobby-roster-name' }, 'P' + (p.idx + 1) + ' · ' + (p.name || 'Player')),
                p.isHost && e('span', { className: 'lobby-roster-tag' }, 'Host'),
                isHostView && !p.isHost && e('button', {
                  className: 'lobby-kick-btn',
                  onClick: () => onKickPlayer(p.peerId),
                }, '✕ Kick')
              )
            ),
        showWaitingHint && roster.length < 2 && e('div', { className: 'lobby-hint' },
          'Share the room code so a friend can join.')
      );


    // ── Reusable General-Options overlay (sound + background) ───────────────
    // Mounted at the top of every phase so guests / hosts can tweak audio
    // without bouncing back to the main menu.  Renders nothing when closed.
    const generalOverlay = generalOpen && window.GeneralOptionsPanel
      ? e(window.GeneralOptionsPanel, { onClose: () => setGeneralOpen(false) })
      : null;
    // Compact "⚙ Sound" button used in lobby waiting screens.  Bottom-right
    // corner placement keeps it out of the main flow but always reachable.
    const soundButton = e('button', {
      className: 'btn-options',
      onClick:   () => setGeneralOpen(true),
      style:     { marginTop: '8px', opacity: 0.75, fontSize: 'var(--font-xs)' },
    }, '⚙ Options');


    // ── Render: phase=choosing ──────────────────────────────────────────────
    if (phase === 'choosing') {
      return e('div', { className: 'app' },
        generalOverlay,
        e('div', { className: 'lobby' },
          e('div', { className: 'sigil' }, '⛧'),
          e('h1',  { className: 'lobby-title' }, 'Online'),
          e('div', { className: 'lobby-sub' }, 'Same game · different devices'),
          e('div', { className: 'sep' }),

          e('label', { className: 'lobby-label' }, 'Your name (optional)'),
          e('input', {
            className:  'lobby-input',
            value:      name,
            maxLength:  10,
            placeholder:'Player',
            onChange:   (ev) => setName(ev.target.value),
          }),

          e('div', { className: 'lobby-btn-row' },
            e('button', { className: 'btn-start', onClick: onHost,
              style: { padding: '14px 28px' } }, 'Host a Game'),
            e('button', { className: 'btn-start', onClick: () => { setPhase('guest-entering'); setError(null); },
              style: { padding: '14px 28px' } }, 'Join a Game'),
          ),

          error && e('div', { className: 'lobby-error' }, error),

          e('button', { className: 'btn-options', onClick: onReturnToMenu,
            style: { marginTop: '20px', opacity: 0.7 } }, '← Main Menu')
        )
      );
    }


    // ── Render: phase=host-creating ─────────────────────────────────────────
    if (phase === 'host-creating') {
      return e('div', { className: 'app' },
        generalOverlay,
        e('div', { className: 'lobby' },
          e('div', { className: 'sigil' }, '⛧'),
          e('h2',  { className: 'lobby-title' }, 'Creating room…'),
          e('div', { className: 'lobby-sub' }, 'Reaching the signalling server')
        )
      );
    }


    // ── Render: phase=host-waiting ──────────────────────────────────────────
    if (phase === 'host-waiting') {
      return e('div', { className: 'app' },
        generalOverlay,
        settingsOpen && e(window.StdSettingsPanel, {
          draft,
          onChange:               (k, v) => setDraft(d => ({ ...d, [k]: v })),
          onChangeDeckCount:      (id, v) => setDraft(d => ({ ...d, deckOverrides:     { ...d.deckOverrides,     [id]: v } })),
          onChangeCardValue:      (id, v) => setDraft(d => ({ ...d, cardValues:        { ...d.cardValues,        [id]: v } })),
          onChangeGambitDisabled: (k, v) => setDraft(d => ({ ...d, disabledGambits:   { ...d.disabledGambits,   [k]: v } })),
          onChangeGambitMult:     (k, v) => setDraft(d => ({ ...d, gambitMultipliers: { ...d.gambitMultipliers, [k]: v } })),
          onApplyPreset:          (s) => setDraft(d => ({ ...d, ...s })),
          onApply:                () => { setSettingsOpen(false); onStartGame(); },
          onCancel:               () => { setDraft(freshDraftFromPreset()); setSettingsOpen(false); },
          onReturnToMenu:         () => { setDraft(freshDraftFromPreset()); setSettingsOpen(false); },
          hideMainMenuButton:     true,
          gameActive:             false,
          hideMultiplayer:        true,   // online is always MP — no point showing the toggle
          initialPresetId:        presetId,
          onPresetIdChange:       setPresetId,
        }),

        e('div', { className: 'lobby' },
          e('div', { className: 'sigil' }, '⛧'),
          e('h2',  { className: 'lobby-title' }, 'Room is open'),
          e('div', { className: 'lobby-sub' }, 'Share this code with your friend'),
          e('div', { className: 'lobby-code' }, roomCode || '????'),

          renderRoster(true, true),

          roster.length >= MAX_PLAYERS && e('div', {
            style: {
              fontFamily: "'Cinzel',serif", fontSize: 'var(--font-xs)',
              color: 'var(--secondary-color)', letterSpacing: '0.08em',
              textAlign: 'center', marginBottom: '4px',
            },
          }, '⚠ Room full (' + MAX_PLAYERS + '/' + MAX_PLAYERS + ' players)'),
          e('button', {
            className: 'btn-start',
            onClick:   () => setSettingsOpen(true),
            disabled:  roster.length < 2,
            style:     { padding: '14px 28px', opacity: roster.length < 2 ? 0.5 : 1 },
          }, roster.length < 2 ? '(waiting for players…)' : '⚙ Game Settings / Start'),
          soundButton,
          e('button', { className: 'btn-options', onClick: onHostCancel,
            style: { opacity: 0.7 } }, '✕ Close Room'),
        )
      );
    }


    // ── Render: phase=guest-entering ────────────────────────────────────────
    if (phase === 'guest-entering') {
      return e('div', { className: 'app' },
        generalOverlay,
        e('div', { className: 'lobby' },
          e('div', { className: 'sigil' }, '⛧'),
          e('h2',  { className: 'lobby-title' }, 'Join a Game'),
          e('div', { className: 'lobby-sub' }, 'Type the 4-character room code'),

          e('input', {
            className:   'lobby-input lobby-code-input',
            value:       code,
            maxLength:   8,
            placeholder: 'GAME',
            autoFocus:   true,
            onChange:    (ev) => setCode(window.PeerSession.normalizeCode(ev.target.value)),
            onKeyDown:   (ev) => { if (ev.key === 'Enter') onJoin(); },
          }),

          error && e('div', { className: 'lobby-error' }, error),

          e('div', { className: 'lobby-btn-row' },
            e('button', { className: 'btn-start', onClick: onJoin,
              disabled: code.length !== 4,
              style: { padding: '14px 28px', opacity: code.length !== 4 ? 0.5 : 1 } }, 'Connect'),
            e('button', { className: 'btn-options', onClick: () => { setPhase('choosing'); setError(null); },
              style: { padding: '12px 18px' } }, '← Back'),
          ),
          soundButton,
        )
      );
    }


    // ── Render: phase=guest-connecting ──────────────────────────────────────
    if (phase === 'guest-connecting') {
      return e('div', { className: 'app' },
        generalOverlay,
        e('div', { className: 'lobby' },
          e('div', { className: 'sigil' }, '⛧'),
          e('h2',  { className: 'lobby-title' }, 'Connecting…'),
          e('div', { className: 'lobby-sub' }, 'Room ' + (roomCode || code)),
          // Cancel mid-connect so users don't have to wait out the full peer.js
          // timeout (up to 60s) when something's clearly wrong.
          e('button', { className: 'btn-options', onClick: onCancelConnecting,
            style: { marginTop: '20px', opacity: 0.85 } }, '✕ Cancel'),
          soundButton
        )
      );
    }


    // ── Render: phase=guest-waiting ─────────────────────────────────────────
    if (phase === 'guest-waiting') {
      return e('div', { className: 'app' },
        generalOverlay,
        e('div', { className: 'lobby' },
          e('div', { className: 'sigil' }, '⛧'),
          e('h2',  { className: 'lobby-title' }, 'Connected'),
          e('div', { className: 'lobby-sub' }, 'Room ' + roomCode + ' · Waiting for the host to start'),
          renderRoster(false),
          e('button', { className: 'btn-options', onClick: onGuestCancel,
            style: { marginTop: '20px', opacity: 0.7 } }, '✕ Leave Room'),
          soundButton
        )
      );
    }


    // ── Render: phase=error ─────────────────────────────────────────────────
    if (phase === 'error') {
      return e('div', { className: 'app' },
        generalOverlay,
        e('div', { className: 'lobby' },
          e('div', { className: 'sigil' }, '💀'),
          e('h2',  { className: 'lobby-title' }, 'Connection problem'),
          e('div', { className: 'lobby-error' }, error || 'Something went wrong.'),
          e('button', { className: 'btn-options', onClick: () => { setPhase('choosing'); setError(null); },
            style: { marginTop: '20px' } }, '↺ Try Again'),
          e('button', { className: 'btn-options', onClick: onReturnToMenu,
            style: { marginTop: '6px', opacity: 0.7 } }, '← Main Menu')
        )
      );
    }

    // Fallback (shouldn't reach here)
    return null;
  }


  // ── Expose to the router ───────────────────────────────────────────────────
  window.OnlineLobby = OnlineLobby;
})();
// ──────────────────────────────────────────────────────────────────────────────
