// ── Online Mode — App orchestrator ────────────────────────────────────────────
//
// Self-contained React component for online multiplayer.  Uses Standard mode's
// engine / gameplay / components by reference (STD_PRESET, stdMkDeck,
// stdResolveGambit, StdGambitPanel, StdSettingsPanel, etc.) — the orchestration
// here is online-specific:  host vs guest roles, peer messaging, mid-game
// settings broadcast, graceful disconnect on browser close.
//
// Exposes window.OnlineApp.  The router mounts this for online mode (NOT
// StandardApp, which is now purely local).
//
// Load order:
//   ... → standard/* → core/peer.js → online/lobby.js → online/app.js → router.js
//
// Deleting this file (along with online/lobby.js and core/peer.js) disables
// online play entirely.  Standard mode keeps working untouched.
// ──────────────────────────────────────────────────────────────────────────────


function OnlineApp({
  onReturnToMenu,
  peerSession,
  peerRole,         // 'host' | 'guest'
  localPlayerIdx,   // 0 (host) | 1..N (guests)
  playerCount,
  playerNames,      // string[], index-aligned; empty string → use default 'P{n}' label
}) {
  const { useState, useEffect, useCallback, useRef } = React;
  const e = React.createElement;

  // Role flags — peerSession is always defined when this component renders.
  const isHost  = peerRole === 'host';
  const isGuest = peerRole === 'guest';

  // Player-name helper — falls back to 'P{n}' when no name was provided.
  const names = Array.isArray(playerNames) ? playerNames : [];
  const getPlayerName = (idx) => (names[idx] && names[idx].trim()) || ('P' + (idx + 1));


  // ── Screen + core state ────────────────────────────────────────────────────
  // Host auto-starts the game on mount; guest renders a "Waiting…" placeholder
  // until the first game-state snapshot arrives.
  const [screen,       setScreen]        = useState('game');
  const [gs,           setGs]            = useState(null);
  const [sel,          setSel]           = useState(EMPTY_SEL);
  const [revealed,     setRevealed]      = useState(false);
  const [result,       setResult]        = useState(null);
  const [shop,         setShop]          = useState(false);
  const [dealing,      setDealing]       = useState(false);
  const [leaving,      setLeaving]       = useState(false);
  const [tableFlash,   setFlash]         = useState(null);
  const [noFlipAnim,   setNoFlipAnim]    = useState(false);
  const [diceState,    setDiceState]     = useState({ result: null, guess: null, rollsLeft: 0 });
  const [lastChance,   setLastChance]    = useState(false);
  const [roundHistory, setRoundHistory]  = useState([]);
  const [winnerIdx,    setWinnerIdx]     = useState(null);

  // Connection state (UI only).  The peer-leave / browser-close events flip
  // these flags and the connection-lost overlay renders on top of the game.
  const [connStatus,   setConnStatus]    = useState('connected'); // 'connected' | 'lost'
  const [connMessage,  setConnMessage]   = useState(null);

  // Settings panel toggles.  Host gets StdSettingsPanel (full).  Guest gets
  // a small OnlGuestOptionsPanel (sound + leave room only).
  const [settingsOpen, setSettingsOpen]  = useState(false);
  const [infoOpen,     setInfoOpen]      = useState(false);
  // Bumped on preset-update so guests re-render with the new STD_PRESET values
  // (the preset is mutated in place, so React doesn't know to re-render otherwise).
  const [presetTick,   setPresetTick]    = useState(0); // eslint-disable-line no-unused-vars

  const [draft, setDraft] = useState(() => ({
    ...STD_PRESET,
    deckOverrides:     { ...STD_PRESET.deckOverrides },
    cardValues:        { ...STD_PRESET.cardValues },
    disabledGambits:   { ...STD_PRESET.disabledGambits },
    gambitMultipliers: { ...STD_PRESET.gambitMultipliers },
  }));

  const gsRef = useRef(gs);
  useEffect(() => { gsRef.current = gs; }, [gs]);


  // ── Animation timing (must match the CSS keyframes) ────────────────────────
  const DEAL_HOLD_MS   = 600;
  const LEAVE_HOLD_MS  = 400;
  const RESULT_HOLD_MS = 2000;

  const deal = () => {
    if (window.SOUND) window.SOUND.playCardAppear();
    setDealing(true);
    setTimeout(() => setDealing(false), DEAL_HOLD_MS);
  };
  const flash = (t) => { setFlash(t); setTimeout(() => setFlash(null), RESULT_HOLD_MS); };


  // ── Preset snapshot helpers (used by broadcast) ────────────────────────────
  const snapshotPreset = () => ({
    ...STD_PRESET,
    deckOverrides:     { ...STD_PRESET.deckOverrides },
    cardValues:        { ...STD_PRESET.cardValues },
    disabledGambits:   { ...STD_PRESET.disabledGambits },
    gambitMultipliers: { ...STD_PRESET.gambitMultipliers },
  });

  const installPreset = (snap) => {
    if (!snap) return;
    Object.assign(STD_PRESET, snap);
    STD_PRESET.deckOverrides     = { ...(snap.deckOverrides     || {}) };
    STD_PRESET.cardValues        = { ...(snap.cardValues        || {}) };
    STD_PRESET.disabledGambits   = { ...(snap.disabledGambits   || {}) };
    STD_PRESET.gambitMultipliers = { ...(snap.gambitMultipliers || {}) };
    STD_PRESET.multiplayer = true;  // always force MP in online play
  };


  // ── Settings management ────────────────────────────────────────────────────
  const openSettings = () => {
    setDraft({
      ...STD_PRESET,
      deckOverrides:     { ...STD_PRESET.deckOverrides },
      cardValues:        { ...STD_PRESET.cardValues },
      disabledGambits:   { ...STD_PRESET.disabledGambits },
      gambitMultipliers: { ...STD_PRESET.gambitMultipliers },
    });
    setSettingsOpen(true);
  };

  const closeSettings = () => setSettingsOpen(false);

  // Host-only: bake the draft, broadcast the new preset, and reset the game
  // (matching the panel's "Apply & Reset" label).  Guests never call this —
  // their OnlGuestOptionsPanel has no Apply button.
  const applySettings = () => {
    if (!isHost) { setSettingsOpen(false); return; }
    if (stdCountDraftDeck(draft) < 2) return;
    Object.assign(STD_PRESET, draft);
    STD_PRESET.deckOverrides     = { ...draft.deckOverrides };
    STD_PRESET.cardValues        = { ...draft.cardValues };
    STD_PRESET.disabledGambits   = { ...draft.disabledGambits };
    STD_PRESET.gambitMultipliers = { ...draft.gambitMultipliers };
    STD_PRESET.multiplayer = true;
    STD_PRESET.playerCount = playerCount;
    setSettingsOpen(false);
    try { peerSession.send({ type: 'preset-update', preset: snapshotPreset() }); } catch (e) {}
    startGame();  // broadcasts the new game-state via the broadcast effect
  };

  const changeDraft          = (key, val) => setDraft(d => ({ ...d, [key]: val }));
  const changeDeckCount      = (cardId, val) => setDraft(d => ({ ...d, deckOverrides:    { ...d.deckOverrides,    [cardId]: val } }));
  const changeCardValue      = (cardId, val) => setDraft(d => ({ ...d, cardValues:       { ...d.cardValues,       [cardId]: val } }));
  const changeGambitDisabled = (key,   val) => setDraft(d => ({ ...d, disabledGambits:  { ...d.disabledGambits,   [key]:   val } }));
  const changeGambitMult     = (key,   val) => setDraft(d => ({ ...d, gambitMultipliers:{ ...d.gambitMultipliers, [key]:   val } }));
  const applyPresetSnap      = (settings) => setDraft(d => ({ ...d, ...settings }));


  // ── Multiplayer helpers (same shape as standard/app.js) ────────────────────
  const makePlayer = (id) => ({
    id,
    lives:          STD_PRESET.startLives,
    streak:         STD_PRESET.startStreak,
    blanks:         STD_PRESET.startBlanks,
    score:          0,
    usedLastChance: false,
    dead:           false,
    deckEmpty:      false,
    placement:      null,
    deck:           [],
    tableCard:      null,
    handCard:       null,
  });

  const applyToCurrentPlayer = (g, updates) => {
    const next = { ...g, ...updates };
    if (g.players) {
      next.players = g.players.map((p, i) =>
        i === g.currentPlayerIdx ? { ...p, ...updates } : p
      );
    }
    return next;
  };

  const switchToPlayer = (g, idx) => {
    const p = g.players[idx];
    return {
      ...g,
      currentPlayerIdx: idx,
      lives:            p.lives,
      streak:           p.streak,
      blanks:           p.blanks,
      score:            p.score,
      usedLastChance:   p.usedLastChance,
      deck:             p.deck,
      tableCard:        p.tableCard,
      handCard:         p.handCard,
    };
  };

  const isActive = (p) => p.placement == null && !p.dead && !p.deckEmpty;

  const nextActiveIdx = (players, fromIdx) => {
    const n = players.length;
    for (let i = 1; i <= n; i++) {
      const j = (fromIdx + i) % n;
      if (isActive(players[j])) return j;
    }
    return -1;
  };

  const activeCount = (players) => players.filter(isActive).length;

  const computeFinalRanking = (players) => {
    const placed   = players.filter(p => p.placement != null).sort((a, b) => a.placement - b.placement);
    const unplaced = players.filter(p => p.placement == null).sort((a, b) => b.score - a.score);
    return [...placed, ...unplaced];
  };


  // ── Deck helpers ───────────────────────────────────────────────────────────
  const drawNextDeck = (deck, oldHand, oldTable) => {
    let d = [...deck];

    if (oldHand) {
      const oldHandIdx = d.findIndex(c => c.id === oldHand.id);
      if (oldHandIdx !== -1) d.splice(oldHandIdx, 1);
    }
    if (STD_PRESET.infiniteDeck && oldHand && oldTable) {
      d = [...d, oldTable, oldHand];
    }

    if (d.length < 2) return { deck: d, tableCard: null, handCard: null, deckEmpty: true };

    const tableIndex = Math.floor(Math.random() * d.length);
    const tableCard  = d.splice(tableIndex, 1)[0];
    const handIndex  = Math.floor(Math.random() * d.length);
    const handCard   = d[handIndex];
    return { deck: d, tableCard, handCard, deckEmpty: false };
  };

  const namespaceDeck = (deck, playerIdx) =>
    deck.map(c => ({ ...c, id: `p${playerIdx}-${c.id}` }));


  // ── Game initialisation (host only — guests get gs via broadcast) ──────────
  const startGame = () => {
    STD_PRESET.multiplayer = true;
    STD_PRESET.playerCount = playerCount;

    const baseDeck = stdMkDeck();
    const players = Array.from({ length: playerCount }, (_, i) => {
      const personalDeck = shfl(namespaceDeck(baseDeck, i));
      const drawn        = drawNextDeck(personalDeck, null, null);
      return {
        ...makePlayer(i + 1),
        deck:      drawn.deck,
        tableCard: drawn.tableCard,
        handCard:  drawn.handCard,
        deckEmpty: drawn.deckEmpty,
      };
    });
    const p0 = players[0];

    setGs({
      deck:             p0.deck,
      tableCard:        p0.tableCard,
      handCard:         p0.handCard,
      lives:            p0.lives,
      startLives:       STD_PRESET.startLives,
      streak:           p0.streak,
      blanks:           p0.blanks,
      score:            p0.score,
      round:            1,
      usedLastChance:   p0.usedLastChance,
      multiplayer:      true,
      players,
      currentPlayerIdx: 0,
      nextPlacement:    1,
    });

    setSel(EMPTY_SEL); setRevealed(false); setResult(null);
    setShop(false); setNoFlipAnim(false);
    setDiceState({ result: null, guess: null, rollsLeft: 0 });
    setLastChance(false);
    setRoundHistory(Array.from({ length: playerCount }, () => []));
    setWinnerIdx(null);
    setScreen('game');
    deal();
  };


  // ── Gambit selection (local UI state, never broadcast — each device picks
  //    its own gambit privately, the choice is sent on commit) ───────────────
  const toggleSel = (type, val) => {
    if (result) return;
    setSel(prev => {
      const next = { ...prev };
      if (type === 'joker') {
        if (next.joker) { next.joker = false; }
        else { next.value = null; next.color = null; next.suit = null; next.joker = true; }
      } else if (type === 'value') {
        next.joker = false;
        next.value = (next.value === val) ? null : val;
      } else if (type === 'color') {
        next.joker = false; next.suit = null;
        next.color = (next.color === val) ? null : val;
      } else if (type === 'suit') {
        next.joker = false; next.color = null;
        next.suit  = (next.suit  === val) ? null : val;
      }
      return next;
    });
  };


  // ── Commit a gambit ────────────────────────────────────────────────────────
  // Guest: forwards `sel` to the host instead of running the engine.
  // Host: runs the engine (or, when called with selOverride, replays the
  // guest's sel exactly so the resolver runs once on the authoritative side).
  const commit = (selOverride) => {
    if (isGuest && selOverride === undefined) {
      if (gs && gs.currentPlayerIdx === localPlayerIdx) {
        sendActionToHost('commit', { sel });
      }
      return;
    }
    const useSel = selOverride !== undefined ? selOverride : sel;
    const dg = stdDeriveGambit(useSel);
    if (!dg || result) return;
    if (window.SOUND) window.SOUND.playCardAppear();
    setRevealed(true);

    const r = stdResolveGambit(gs, dg);

    setGs(g => {
      setRoundHistory(h => h.map((arr, idx) =>
        idx === g.currentPlayerIdx ? [{
          type: 'round', round: g.round,
          tableCard: g.tableCard, handCard: g.handCard,
          gambit: dg.label,
          outcome: r.won ? 'win' : r.isInstant ? 'instant' : 'lose',
          pts: r.pts, score: r.newScore,
          lives: r.newLives, blanks: g.blanks, streak: r.newStreak,
        }, ...arr] : arr
      ));
      return applyToCurrentPlayer(g, { score: r.newScore, streak: r.newStreak, lives: r.newLives });
    });

    setResult({
      won: r.won, pts: r.pts, action: 'gambit',
      instant: r.isInstant && !r.won && !STD_PRESET.infiniteLives,
    });
    flash(r.won ? 'win' : 'lose');
  };


  // ── Skip ───────────────────────────────────────────────────────────────────
  const doSkip = () => {
    if (isGuest) {
      if (gs && gs.currentPlayerIdx === localPlayerIdx) sendActionToHost('skip');
      return;
    }
    if (result) return;
    if (window.SOUND) window.SOUND.playCardAppear();
    setRevealed(true);
    const r = stdResolveSkip(gs);

    setGs(g => applyToCurrentPlayer(g, { lives: r.newLives, streak: r.newStreak, score: g.score + r.pts }));
    setRoundHistory(h => h.map((arr, idx) =>
      idx === gs.currentPlayerIdx ? [{
        type: 'round', round: gs.round,
        tableCard: gs.tableCard, handCard: gs.handCard,
        gambit: '— Skip —',
        outcome: 'skip', pts: r.pts, score: gs.score + r.pts,
        lives: r.newLives, blanks: gs.blanks, streak: r.newStreak,
      }, ...arr] : arr
    ));
    setResult({ won: false, pts: r.pts, action: 'skip' });
    flash('lose');
  };


  // ── Blank ──────────────────────────────────────────────────────────────────
  const doBlank = () => {
    if (isGuest) {
      if (gs && gs.currentPlayerIdx === localPlayerIdx) sendActionToHost('blank');
      return;
    }
    if (!gs || (!STD_PRESET.infiniteBlanks && !gs.blanks) || result) return;
    if (window.SOUND) window.SOUND.playCardAppear();
    setRevealed(true);
    const r = stdResolveBlank(gs);

    setGs(g => applyToCurrentPlayer(g, { blanks: r.newBlanks, score: g.score + r.pts, lives: r.newLives, streak: r.newStreak }));
    setRoundHistory(h => h.map((arr, idx) =>
      idx === gs.currentPlayerIdx ? [{
        type: 'round', round: gs.round,
        tableCard: gs.tableCard, handCard: gs.handCard,
        gambit: '🛡️ Blank',
        outcome: 'blank', pts: r.pts, score: gs.score + r.pts,
        lives: r.newLives, blanks: r.newBlanks, streak: r.newStreak,
      }, ...arr] : arr
    ));
    setResult({ won: true, pts: r.pts, action: 'blank' });
    flash('win');
  };


  // ── Advance to the next player's turn ──────────────────────────────────────
  const advanceTurnDealNext = (sourceGs) => {
    if (window.SOUND) window.SOUND.playCardDisappear();
    setLeaving(true);
    setTimeout(() => {
      let ng = { ...sourceGs };
      const curIdx = ng.currentPlayerIdx;
      const curP   = ng.players[curIdx];

      if (isActive(curP)) {
        const drawn = drawNextDeck(curP.deck, curP.handCard, curP.tableCard);
        const updatedCurP = {
          ...curP,
          deck:      drawn.deck,
          tableCard: drawn.tableCard,
          handCard:  drawn.handCard,
          deckEmpty: drawn.deckEmpty,
        };
        ng.players = ng.players.map((p, i) => i === curIdx ? updatedCurP : p);
      }

      const nextIdx = nextActiveIdx(ng.players, curIdx);

      // Round = one full lap.  Wraps when nextIdx loops back to ≤ curIdx.
      if (nextIdx !== -1 && nextIdx <= curIdx) {
        ng.round = ng.round + 1;
      }

      if (activeCount(ng.players) <= 1) {
        endGameTo(ng, 'win');
        return;
      }

      ng = switchToPlayer(ng, nextIdx);

      setGs(ng);
      setSel(EMPTY_SEL); setResult(null); setShop(false);
      setLeaving(false);
      setRevealed(false);
      setNoFlipAnim(false);
      deal();
    }, LEAVE_HOLD_MS);
  };


  const endGameTo = (g, nextScreen) => {
    setGs(g);
    setResult(null); setLastChance(false);
    setDiceState({ result: null, guess: null, rollsLeft: 0 });
    setSel(EMPTY_SEL); setShop(false);
    setRevealed(false); setNoFlipAnim(false);
    setLeaving(false);
    setScreen(nextScreen);
  };


  const handleCurrentPlayerDeath = (sourceGs) => {
    const playersAfter = sourceGs.players.map((p, i) =>
      i === sourceGs.currentPlayerIdx
        ? { ...p, dead: true, lives: 0, usedLastChance: true }
        : p
    );
    const gAfter = { ...sourceGs, players: playersAfter, lives: 0, usedLastChance: true };

    if (activeCount(playersAfter) <= 1) {
      endGameTo(gAfter, 'win');
      return;
    }
    advanceTurnDealNext(gAfter);
  };


  const handleCurrentPlayerPlaced = (sourceGs) => {
    const placement = sourceGs.nextPlacement || 1;
    const playersAfter = sourceGs.players.map((p, i) =>
      i === sourceGs.currentPlayerIdx ? { ...p, placement } : p
    );
    const gAfter = { ...sourceGs, players: playersAfter, nextPlacement: placement + 1 };

    if (winnerIdx == null) setWinnerIdx(sourceGs.currentPlayerIdx);

    if (activeCount(playersAfter) <= 1) {
      endGameTo(gAfter, 'win');
      return;
    }
    advanceTurnDealNext(gAfter);
  };


  // ── Continue to next round (host only — guests are state-mirrored) ─────────
  const continueGame = useCallback(() => {
    if (isGuest) return;

    const currentGs = gsRef.current;
    if (!currentGs) return;

    // Score goal reached
    if (STD_PRESET.scoreToBeatEnabled && currentGs.score >= STD_PRESET.scoreToBeat) {
      handleCurrentPlayerPlaced(currentGs);
      return;
    }

    // Current player is dying → try Death's Door dice, else eliminate
    if (!STD_PRESET.infiniteLives && currentGs.lives <= 0) {
      if (!currentGs.usedLastChance && STD_PRESET.deathsDoorRolls > 0) {
        setResult(null);
        setDiceState({ result: null, guess: null, rollsLeft: STD_PRESET.deathsDoorRolls });
        setLastChance(true);
        return;
      }
      handleCurrentPlayerDeath(currentGs);
      return;
    }

    advanceTurnDealNext(currentGs);
  }, [isGuest]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isGuest) return;
    if (result) {
      const timer = setTimeout(() => continueGame(), RESULT_HOLD_MS);
      return () => clearTimeout(timer);
    }
  }, [result, continueGame, isGuest]);


  // ── Death's Door dice (host only authoritative RNG) ────────────────────────
  const rollDice = (guess) => {
    if (isGuest) {
      if (gs && gs.currentPlayerIdx === localPlayerIdx) sendActionToHost('dice', { guess });
      return;
    }
    const sides = STD_PRESET.deathsDoorDiceSides || 4;
    const r     = Math.floor(Math.random() * sides) + 1;
    setDiceState(prev => ({ ...prev, result: r, guess }));

    setTimeout(() => {
      if (r === guess) {
        const updated = applyToCurrentPlayer(gsRef.current, { lives: 1, usedLastChance: true });
        setDiceState({ result: null, guess: null, rollsLeft: 0 });
        setLastChance(false);
        setGs(updated);
        advanceTurnDealNext(updated);
      } else {
        const newLeft = (diceState.rollsLeft ?? 1) - 1;
        if (newLeft <= 0) {
          setDiceState({ result: null, guess: null, rollsLeft: 0 });
          setLastChance(false);
          handleCurrentPlayerDeath(gsRef.current);
        } else {
          setDiceState({ result: null, guess: null, rollsLeft: newLeft });
        }
      }
    }, 2800);
  };


  // ── Shop ───────────────────────────────────────────────────────────────────
  const buyLife = () => {
    if (isGuest) {
      if (gs && gs.currentPlayerIdx === localPlayerIdx) sendActionToHost('buy-life');
      return;
    }
    if (gs.streak >= STD_PRESET.costLife) {
      const newStreak = gs.streak - STD_PRESET.costLife;
      const newLives  = gs.lives + STD_PRESET.shopLifeAmount;
      setGs(g => applyToCurrentPlayer(g, { streak: newStreak, lives: newLives }));
      setRoundHistory(h => h.map((arr, idx) =>
        idx === gs.currentPlayerIdx ? [{
          type: 'shop', round: gs.round,
          item: `♥ Health Potion (+${STD_PRESET.shopLifeAmount})`, cost: STD_PRESET.costLife,
          score: gs.score, lives: newLives, blanks: gs.blanks, streak: newStreak,
        }, ...arr] : arr
      ));
    }
  };

  const buyBlank = () => {
    if (isGuest) {
      if (gs && gs.currentPlayerIdx === localPlayerIdx) sendActionToHost('buy-blank');
      return;
    }
    if (gs.streak >= STD_PRESET.costBlank) {
      const newStreak = gs.streak - STD_PRESET.costBlank;
      const newBlanks = gs.blanks + STD_PRESET.shopBlankAmount;
      setGs(g => applyToCurrentPlayer(g, { streak: newStreak, blanks: newBlanks }));
      setRoundHistory(h => h.map((arr, idx) =>
        idx === gs.currentPlayerIdx ? [{
          type: 'shop', round: gs.round,
          item: `🛡️ Blank Card (+${STD_PRESET.shopBlankAmount})`, cost: STD_PRESET.costBlank,
          score: gs.score, lives: gs.lives, blanks: newBlanks, streak: newStreak,
        }, ...arr] : arr
      ));
    }
  };


  // ── Reset Game (host only) — clears state and re-deals with current preset ─
  const resetGame = () => {
    if (!isHost) return;
    setSettingsOpen(false);
    startGame();
  };


  // ── Online sync ────────────────────────────────────────────────────────────
  // playerMap is set by the lobby BEFORE handoff so the host can validate
  // incoming action messages by sender on first paint.
  const playerMapRef = useRef((peerSession && peerSession.playerMap) || {});

  // Live action handlers — re-assigned every render so the message handler
  // (registered once in useEffect) always sees fresh closures.
  const actionsRef = useRef({});
  actionsRef.current = { commit, doSkip, doBlank, buyLife, buyBlank, rollDice };

  const sendActionToHost = useCallback((kind, payload) => {
    if (!isGuest) return;
    try {
      peerSession.send(Object.assign({ type: 'game-action', kind }, payload || {}));
    } catch (err) {
      console.warn('[online guest] send failed', err);
    }
  }, [isGuest, peerSession]);

  // Host: auto-start game on mount.  Guarded against Strict Mode double-invoke.
  const hostStartedRef = useRef(false);
  useEffect(() => {
    if (!isHost) return;
    if (hostStartedRef.current) return;
    hostStartedRef.current = true;
    startGame();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost]);

  // Host: broadcast a full state snapshot on every meaningful change.
  useEffect(() => {
    if (!isHost || !gs) return;
    try {
      peerSession.send({
        type:         'game-state',
        gs, result, lastChance, diceState,
        revealed, shop, screen, leaving, dealing,
        tableFlash, roundHistory, winnerIdx,
      });
    } catch (err) {
      console.warn('[online host] broadcast failed', err);
    }
  }, [
    isHost, peerSession,
    gs, result, lastChance, diceState,
    revealed, shop, screen, leaving, dealing,
    tableFlash, roundHistory, winnerIdx,
  ]);

  // Live state mirror — used by the host's game-ready handler so late joiners
  // get the freshest snapshot.
  const liveStateRef = useRef({});
  liveStateRef.current = {
    gs, result, lastChance, diceState,
    revealed, shop, screen, leaving, dealing,
    tableFlash, roundHistory, winnerIdx,
  };

  // Guest: receive state + preset updates + host leave notices
  useEffect(() => {
    if (!isGuest) return;
    peerSession.onMessage = (msg) => {
      if (!msg || typeof msg !== 'object') return;

      if (msg.type === 'game-state') {
        if (msg.gs           !== undefined) setGs(msg.gs);
        if (msg.result       !== undefined) setResult(msg.result);
        if (msg.lastChance   !== undefined) setLastChance(msg.lastChance);
        if (msg.diceState    !== undefined) setDiceState(msg.diceState);
        if (msg.revealed     !== undefined) setRevealed(msg.revealed);
        if (msg.shop         !== undefined) setShop(msg.shop);
        if (msg.screen       !== undefined) setScreen(msg.screen);
        if (msg.leaving      !== undefined) setLeaving(msg.leaving);
        if (msg.dealing      !== undefined) setDealing(msg.dealing);
        if (msg.tableFlash   !== undefined) setFlash(msg.tableFlash);
        if (msg.roundHistory !== undefined) setRoundHistory(msg.roundHistory);
        if (msg.winnerIdx    !== undefined) setWinnerIdx(msg.winnerIdx);
      } else if (msg.type === 'preset-update') {
        installPreset(msg.preset);
        setPresetTick(t => t + 1);
      } else if (msg.type === 'host-leaving') {
        setConnStatus('lost');
        setConnMessage('The host left the game.');
      }
    };
    // Tell the host we're ready — closes the race window where its first
    // broadcast might fire before our handler is registered.
    try { peerSession.send({ type: 'game-ready' }); } catch (e) {}
    return () => { if (peerSession) peerSession.onMessage = null; };
  }, [isGuest, peerSession]);

  // Host: receive guest actions + game-ready pings + guest leave notices
  useEffect(() => {
    if (!isHost) return;
    peerSession.onMessage = (msg, fromPeerId) => {
      if (!msg || typeof msg !== 'object') return;

      if (msg.type === 'game-ready') {
        const s = liveStateRef.current;
        if (s.gs) peerSession.sendTo(fromPeerId, Object.assign({ type: 'game-state' }, s));
        peerSession.sendTo(fromPeerId, { type: 'preset-update', preset: snapshotPreset() });
        return;
      }

      if (msg.type === 'guest-leaving') {
        const name = (peerSession._guestInfo && peerSession._guestInfo[fromPeerId] && peerSession._guestInfo[fromPeerId].name) || 'A player';
        setConnStatus('lost');
        setConnMessage(name + ' left the game.');
        return;
      }

      if (msg.type !== 'game-action') return;
      const senderIdx = playerMapRef.current[fromPeerId];
      const curGs     = gsRef.current;
      if (senderIdx == null || !curGs) return;
      if (senderIdx !== curGs.currentPlayerIdx) return;  // not their turn
      const a = actionsRef.current;
      switch (msg.kind) {
        case 'commit':    if (a.commit)   a.commit(msg.sel);     break;
        case 'skip':      if (a.doSkip)   a.doSkip();            break;
        case 'blank':     if (a.doBlank)  a.doBlank();           break;
        case 'buy-life':  if (a.buyLife)  a.buyLife();           break;
        case 'buy-blank': if (a.buyBlank) a.buyBlank();          break;
        case 'dice':      if (a.rollDice) a.rollDice(msg.guess); break;
      }
    };
    return () => { if (peerSession) peerSession.onMessage = null; };
  }, [isHost, peerSession]);

  // Either side: PeerJS-level disconnect (no explicit "leaving" message arrived)
  useEffect(() => {
    if (!peerSession) return;
    peerSession.onPeerLeave = (peerInfo) => {
      setConnStatus('lost');
      setConnMessage(isGuest
        ? 'The host has left the game.'
        : 'A player has left the game (' + ((peerInfo && peerInfo.name) || 'unknown') + ').');
    };
    return () => { if (peerSession) peerSession.onPeerLeave = null; };
  }, [isGuest, peerSession]);

  // Browser tab closed / page hidden → send a courtesy "leaving" notice and
  // destroy the peer session so peers see us drop immediately instead of
  // waiting for WebRTC's slow ICE timeout.
  useEffect(() => {
    if (!peerSession) return;
    const handleUnload = () => {
      try { peerSession.send({ type: isHost ? 'host-leaving' : 'guest-leaving' }); } catch (e) {}
      try { peerSession.destroy(); } catch (e) {}
    };
    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('pagehide',     handleUnload);
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      window.removeEventListener('pagehide',     handleUnload);
    };
  }, [isHost, peerSession]);

  // Unmount cleanup — fires when the user clicks "Return to Menu".
  useEffect(() => {
    return () => {
      if (peerSession) {
        try { peerSession.send({ type: isHost ? 'host-leaving' : 'guest-leaving' }); } catch (e) {}
        try { peerSession.destroy(); } catch (e) {}
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Guest sound effects — the original SFX calls live inside the host's action
  // handlers which guests don't run; mirror them off the synchronised flags.
  const prevSoundRef = useRef({ revealed: false, leaving: false, dealing: false });
  useEffect(() => {
    if (!isGuest) return;
    const prev = prevSoundRef.current;
    if (window.SOUND) {
      if (revealed && !prev.revealed) window.SOUND.playCardAppear();
      if (leaving  && !prev.leaving)  window.SOUND.playCardDisappear();
      if (dealing  && !prev.dealing)  window.SOUND.playCardAppear();
    }
    prevSoundRef.current = { revealed, leaving, dealing };
  }, [isGuest, revealed, leaving, dealing]);

  // Clear our local gambit selection whenever the turn moves to someone else.
  const currentPlayerIdx = gs ? gs.currentPlayerIdx : null;
  useEffect(() => {
    if (!isGuest) return;
    if (currentPlayerIdx == null) return;
    if (currentPlayerIdx !== localPlayerIdx) setSel(EMPTY_SEL);
  }, [isGuest, currentPlayerIdx, localPlayerIdx]);

  const isMyTurn = gs != null && gs.currentPlayerIdx === localPlayerIdx;


  // ── Settings props (host's full StdSettingsPanel) ──────────────────────────
  const settingsProps = {
    draft,
    onChange:               changeDraft,
    onChangeDeckCount:      changeDeckCount,
    onChangeCardValue:      changeCardValue,
    onChangeGambitDisabled: changeGambitDisabled,
    onChangeGambitMult:     changeGambitMult,
    onApplyPreset:          applyPresetSnap,
    onApply:                applySettings,
    onCancel:               closeSettings,
    onReturnToMenu,
    gameActive:             true,
  };


  // ── End-of-game screens (online is always MP — no gameover / deckempty) ────
  const playerEndStatus = (p) => {
    if (p.placement != null) {
      const m = p.placement === 1 ? '🥇 1st' : p.placement === 2 ? '🥈 2nd' : p.placement === 3 ? '🥉 3rd' : `#${p.placement}`;
      return { label: m, cls: 'mp-sb-placed' };
    }
    if (p.dead)      return { label: '☠ Dead',         cls: 'mp-sb-dead' };
    if (p.deckEmpty) return { label: '🂠 Deck Empty',  cls: 'mp-sb-dead' };
    return { label: '— Last Hand', cls: 'mp-sb-last' };
  };

  if (screen === 'win') {
    const ranking      = gs?.players ? computeFinalRanking(gs.players) : [];
    const winnerP      = winnerIdx != null && gs?.players ? gs.players[winnerIdx] : null;
    const fallbackP    = !winnerP && ranking[0];
    const spotlightP   = winnerP || fallbackP || null;
    const spotIdx      = spotlightP && gs?.players ? gs.players.indexOf(spotlightP) : -1;
    const winScore     = spotlightP ? spotlightP.score : (gs?.score || 0);
    const showSpot     = spotIdx >= 0;
    const showSpotPlaced = winnerP && winnerP.placement === 1;

    return e('div', { className: 'app' },
      e('div', { className: 'gameover' },
        e('div', { className: 'victory-sigil' }, '★'),
        e('h2',  { className: 'gottl-victory' }, 'The Devil Yields'),
        e('p',   { className: 'gosub-victory' },
          showSpotPlaced
            ? getPlayerName(spotIdx) + ' claims the night'
            : showSpot
              ? getPlayerName(spotIdx) + ' stands tallest'
              : 'The night ends'),
        e('div', { className: 'gobox' },
          e('div', { className: 'golbl' },   showSpot ? getPlayerName(spotIdx) + ' — Top Score' : 'Final Standings'),
          e('div', { className: 'goscore' }, winScore.toLocaleString()),
          e('div', { className: 'godet' },
            'Survived ' + (gs?.round || 1) + ' rounds' +
            (STD_PRESET.scoreToBeatEnabled
              ? ' · Goal: ' + (STD_PRESET.scoreToBeat || 0).toLocaleString()
              : ''))
        ),
        e('div', { className: 'mp-scoreboard' },
          ranking.map(p => {
            const idx = gs.players.indexOf(p);
            const st  = playerEndStatus(p);
            return e('div', {
              key: p.id,
              className: 'mp-sb-row ' + st.cls + (idx === spotIdx ? ' mp-sb-winner' : ''),
            },
              e('span', { className: 'mp-sb-name' },
                e('b', { className: 'mp-sb-medal' }, st.label),
                ' · ' + getPlayerName(idx)
              ),
              e('span', { className: 'mp-sb-score' }, p.score.toLocaleString() + ' pts')
            );
          })
        ),
        // Host can re-deal a fresh game without leaving the room.
        isHost && e('button', { className: 'btn-start',   onClick: resetGame },                'Play Again'),
        isHost && e('button', { className: 'btn-options', onClick: openSettings },             '⚙ Options'),
        e('button',         { className: 'btn-options', onClick: onReturnToMenu,
          style: { marginTop:'6px', opacity:0.7 } }, 'Leave Room')
      )
    );
  }


  // ── Loading placeholder (guest before first state arrives) ─────────────────
  if (!gs) {
    return e('div', { className: 'app' },
      e('div', { className: 'gameover' },
        e('div', { className: 'deckend-sigil' }, '⛧'),
        e('h2',  { className: 'gottl-gold' }, isGuest ? 'Waiting for the host…' : 'Dealing cards…'),
        e('p',   { className: 'gosub-gold' }, isGuest ? 'The first hand is on its way' : 'One moment'),
        e('button', { className: 'btn-options', onClick: onReturnToMenu,
          style: { marginTop: '20px', opacity: 0.7 } }, '← Main Menu')
      )
    );
  }

  // ── Connection-lost modal (sized down via .conn-lost-panel CSS overrides) ──
  const connectionLostModal = (connStatus === 'lost')
    ? e('div', { className: 'conn-lost-overlay' },
        e('div', { className: 'conn-lost-panel' },
          e('div', { className: 'goskull' }, '⚠'),
          e('h2',  { className: 'gottl' }, 'Connection Lost'),
          e('p',   { className: 'gosub' }, connMessage || 'A peer dropped from the room.'),
          e('button', { className: 'btn-start', onClick: onReturnToMenu,
            style: { marginTop: '14px' } }, '← Return to Menu')
        )
      )
    : null;

  const derived   = stdDeriveGambit(sel);
  const canCommit = !!derived && !result && !stdIsGambitDisabled(derived);

  const tc       = gs.tableCard, hc = gs.handCard;
  const isHighTC = HIGH.has(tc.value);
  const isLowTC  = ['2','3','4','5','6','7'].includes(tc.value);
  const tcCat    = tc.value === 'JOKER' ? 'Joker' : tc.value === 'A' ? 'Ace' : isHighTC ? 'High' : isLowTC ? 'Low' : '—';

  // History panel shows THIS device's player history (regardless of whose turn).
  const visibleHistory = roundHistory[localPlayerIdx] || [];

  return e('div', { className: 'app' },
    settingsOpen && isHost  && e(StdSettingsPanel, settingsProps),
    settingsOpen && isGuest && e(OnlGuestOptionsPanel, {
      onClose: closeSettings,
      onReturnToMenu,
    }),
    infoOpen && e(StdInfoPanel, { gs, history: visibleHistory, onClose: () => setInfoOpen(false) }),
    connectionLostModal,

    e('div', { className: 'game-wrap' },
      // Header
      e('div', { className: 'hdr' },
        e('span', { className: 'hdr-round' }, 'Round ' + gs.round),
        e('span', { className: 'hdr-brand' },
          // Both host (full options) and guest (sound + leave) get the gear.
          e('button', { className: 'hdr-gear', onClick: openSettings,
            title: isHost ? 'Options' : 'Sound & menu' }, '⚙ Options'),
          e('button', { className: 'hdr-gear', onClick: () => setInfoOpen(true),
            title: 'View Deck & History' }, '🕮 History'),
        ),
        e('span', { className: 'hdr-score' },
          e('span', null,
            'Score: ',
            e('b', null, gs.score.toLocaleString()),
            STD_PRESET.scoreToBeatEnabled && e('span', { className: 'hdr-score-goal' },
              ' / ' + STD_PRESET.scoreToBeat.toLocaleString())
          )
        )
      ),

      // Online connection bar
      e('div', { className: 'conn-bar' },
        e('span', {
          className: 'conn-dot' + (connStatus === 'lost' ? ' conn-lost' : ' conn-ok'),
        }, '●'),
        e('span', { className: 'conn-text' },
          connStatus === 'lost' ? 'Disconnected'
            : (isHost ? 'Hosting' : 'Connected') + ' · ' + getPlayerName(localPlayerIdx ?? 0)
        ),
        !isMyTurn && connStatus === 'connected' && e('span', { className: 'conn-waiting' },
          ' · Waiting for ' + getPlayerName(gs.currentPlayerIdx ?? 0) + '…'),
      ),

      // Opponent strip (always shown — online is always MP)
      gs.players && gs.players.length > 1 && e('div', { className: 'opp-strip' },
        gs.players.map((p, i) => {
          const isCur      = i === gs.currentPlayerIdx;
          const placed     = p.placement != null;
          const eliminated = p.dead || p.deckEmpty;
          const cls = 'opp-pill'
            + (isCur && !placed && !eliminated ? ' opp-cur'    : '')
            + (placed                          ? ' opp-placed' : '')
            + (eliminated                      ? ' opp-out'    : '');
          const medal = placed
            ? (p.placement === 1 ? '🥇' : p.placement === 2 ? '🥈' : p.placement === 3 ? '🥉' : '#' + p.placement)
            : null;
          const statusIcon = medal
            ? medal
            : p.dead      ? '☠'
            : p.deckEmpty ? '🂠'
            : getPlayerName(i);
          return e('div', { key: p.id, className: cls },
            e('span', { className: 'opp-tag' }, statusIcon),
            !eliminated && !placed && e('span', { className: 'opp-stat' },
              e('span', { className: 'opp-icon' }, '♥'),
              STD_PRESET.infiniteLives ? '∞' : p.lives
            ),
            e('span', { className: 'opp-stat opp-score' }, p.score.toLocaleString())
          );
        })
      ),

      // Stats
      e('div', { className: 'stats' },
        e('div', { className: 'stat' },
          e('span', { className: 'stat-lbl' }, 'Lives'),
          STD_PRESET.infiniteLives
            ? e('span', { className: 'stat-val stat-inf' }, '∞')
            : e('span', { className: 'stat-val' }, +gs.lives)
        ),
        e('div', { className: 'stat' },
          e('span', { className: 'stat-lbl' }, 'Blanks'),
          STD_PRESET.infiniteBlanks
            ? e('span', { className: 'stat-val stat-inf' }, '∞')
            : e('span', { className: 'stat-val' }, +gs.blanks)
        ),
        e('div', { className: 'stat' },
          e('span', { className: 'stat-lbl' }, 'Streak'),
          e('span', { className: 'stat-val' }, +gs.streak)
        ),
      ),

      // Card table
      e('div', { className: 'table' + (tableFlash ? ' f' + tableFlash : '') },
        e('div', { className: 'cslot' },
          e(CardFace, { key: tc.id, card: tc, animate: dealing, leaving }),
          e('span', { className: 'cpts' }, tc.numValue + ' pts · ' + tcCat)
        ),
        e('div', { className: 'cslot' },
          e(HandCard, { key: hc.id, card: hc, revealed, animate: dealing, noAnim: noFlipAnim, leaving }),
          e('span', { className: 'cpts' }, revealed ? (hc.numValue + ' pts') : '?')
        )
      ),

      // Action area — every control gated by isMyTurn so spectating players
      // can watch but can't act.
      e('div', { className: 'content-area' },
        e('div', null,
          e('div', { className: 'actions', style: { gridTemplateColumns: 'repeat(4,minmax(0,1fr))' } },
            e('button', {
              className: 'btnmain',
              onClick: () => commit(),
              disabled: !canCommit || shop || !!result || lastChance || !isMyTurn,
            }, 'Set'),
            e('button', { className: 'btnsec', onClick: doBlank,
              disabled: !STD_PRESET.blanksEnabled || (!STD_PRESET.infiniteBlanks && !gs.blanks) || shop || !!result || lastChance || !isMyTurn,
            }, 'Blank'),
            e('button', { className: 'btnsec', onClick: doSkip,
              disabled: !STD_PRESET.skipsEnabled || shop || !!result || lastChance || !isMyTurn,
            }, 'Skip'),
            e('button', { className: 'btnsec', onClick: () => setShop(s => !s),
              disabled: !!result || lastChance || !isMyTurn,
            }, shop ? 'Close Shop' : 'Shop')
          ),
          (result || lastChance || !shop) && e(StdGambitPanel, {
            sel, onToggle: toggleSel, derived, gs,
            disabled: !!result || lastChance || !isMyTurn,
            result, lastChance, diceState, onRoll: rollDice,
          }),
          shop && !result && !lastChance && e(StdShop, { gs, buyLife, buyBlank })
        )
      )
    )
  );
}


// ── OnlGuestOptionsPanel ──────────────────────────────────────────────────────
// Limited "Options" overlay for guests during a game.  They can change sound
// settings and return to the main menu (leaving the room).  Gameplay settings
// are host-only — guests see a one-line hint explaining that.
function OnlGuestOptionsPanel({ onClose, onReturnToMenu }) {
  const e = React.createElement;
  return e('div', { className: 'set-overlay' },
    e('div', { className: 'set-panel' },
      e('div', { className: 'set-title' }, '⚙ Options'),
      e('div', { className: 'set-section' },
        window.SoundControls
          ? e(window.SoundControls)
          : e('div', { style: { fontFamily: "'Cinzel',serif", fontSize: 'var(--font-xs)', color: 'var(--secondary-color)', padding: '10px 0' } },
              'Sound module not loaded (core/sound.js is missing).'),
        e('div', {
          style: {
            marginTop: '18px', padding: '12px 14px',
            border: '1px solid var(--line-color)',
            background: 'rgba(0,0,0,0.45)',
            fontFamily: "'Cinzel',serif", fontSize: 'var(--font-xs)',
            color: 'var(--secondary-color)', letterSpacing: '0.04em',
            lineHeight: 1.5,
          },
        }, 'Only the host can change gameplay settings or reset the game. Leave the room to play locally with your own rules.')
      ),
      e('div', { className: 'set-actions' },
        e('button', { className: 'btn-start',  onClick: onClose }, 'Close'),
        e('button', { className: 'btnsec set-back-btn', onClick: onReturnToMenu }, 'Leave Room'),
      )
    )
  );
}


// ── Register on window so the router can detect / mount us ───────────────────
window.OnlineApp = OnlineApp;
// ──────────────────────────────────────────────────────────────────────────────
