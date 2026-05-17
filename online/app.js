// ── Online Mode — App orchestrator ────────────────────────────────────────────
//
// Self-contained React component for online multiplayer.  Uses Standard mode's
// engine / gameplay / components by reference (STD_PRESET, stdMkDeck,
// stdResolveGambit, StdGambitPanel, StdSettingsPanel, etc.) — the orchestration
// here is online-specific:  host vs guest roles, peer messaging, mid-game
// settings broadcast, graceful disconnect on browser close.
//
// ── Multiplayer rules (Online) ────────────────────────────────────────────────
// 1. All players share the SAME deck and the SAME table+hand cards each round.
// 2. Each player privately picks their gambit and clicks Commit.  Other players
//    only see that you are "Locked In", never WHAT you chose.
// 3. Once every active player has committed, results are resolved
//    simultaneously — each player sees ONLY their own outcome.
// 4. Anti-spam: if every active player chose the exact SAME gambit, no one
//    scores and everyone suffers the standard loss outcomes (lives / streak
//    / score).  This is displayed as a "Stalemate" event, not a regular loss.
// 5. After the reveal hold, a fresh card is dealt and the next round begins.
//
// Death's-door dice are disabled in the online MP flow (too noisy with parallel
// resolution).  Players whose lives hit 0 are eliminated immediately.
//
// Exposes window.OnlineApp.  The router mounts this for online mode (NOT
// StandardApp, which is now purely local).
//
// Load order:
//   ... → standard/* → core/peer.js → online/lobby.js → online/app.js → router.js
// ──────────────────────────────────────────────────────────────────────────────


function OnlineApp({
  onReturnToMenu,
  onBackToLobby,    // optional — re-enter the lobby reusing the live PeerSession
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
  const [screen,       setScreen]       = useState('game');
  const [gs,           setGs]           = useState(null);
  const [sel,          setSel]          = useState(EMPTY_SEL);
  const [revealed,     setRevealed]     = useState(false);
  const [shop,         setShop]         = useState(false);
  const [dealing,      setDealing]      = useState(false);
  const [leaving,      setLeaving]      = useState(false);
  const [tableFlash,   setFlash]        = useState(null);
  const [noFlipAnim,   setNoFlipAnim]   = useState(false);
  const [roundHistory, setRoundHistory] = useState([]);
  const [winnerIdx,    setWinnerIdx]    = useState(null);

  // Simultaneous-resolution state:
  //   committedSet  — { [playerIdx]: true } — who has locked in this round (broadcast)
  //   playerResults — { [playerIdx]: { action, won, pts, instant, gambitLabel } }
  //                    populated on reveal; each viewer only displays their own slot
  //   isDrawRound   — true when every active player chose the same gambit
  const [committedSet,  setCommittedSet]  = useState({});
  const [playerResults, setPlayerResults] = useState(null);
  const [isDrawRound,   setIsDrawRound]   = useState(false);

  // Connection state (UI only).  The peer-leave / browser-close events flip
  // these flags and the connection-lost overlay renders on top of the game.
  //   'connected' — everything fine
  //   'lost'      — YOUR connection is dead (guest lost host, or host force-quit)
  //                 — terminal: only action is Return to Menu
  //   'peer-left' — someone else left but you're still online — dismissable,
  //                 and the host may opt to go back to the lobby
  const [connStatus,  setConnStatus]  = useState('connected');
  const [connMessage, setConnMessage] = useState(null);

  // Settings panel toggles.  Host gets StdSettingsPanel (full).  Guest gets
  // a small OnlGuestOptionsPanel (sound + leave room only).
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [infoOpen,     setInfoOpen]     = useState(false);
  // Bumped on preset-update so guests re-render with the new STD_PRESET values
  // (the preset is mutated in place, so React doesn't know to re-render otherwise).
  const [presetTick,   setPresetTick]   = useState(0); // eslint-disable-line no-unused-vars

  const [draft, setDraft] = useState(() => ({
    ...STD_PRESET,
    deckOverrides:     { ...STD_PRESET.deckOverrides },
    cardValues:        { ...STD_PRESET.cardValues },
    disabledGambits:   { ...STD_PRESET.disabledGambits },
    gambitMultipliers: { ...STD_PRESET.gambitMultipliers },
  }));
  // Persisted preset id so the highlighted card survives panel close/reopen.
  const [presetId, setPresetId] = useState(() =>
    (typeof STANDARD_PRESETS !== 'undefined' && STANDARD_PRESETS[0]) ? STANDARD_PRESETS[0].id : null
  );

  const gsRef = useRef(gs);
  useEffect(() => { gsRef.current = gs; }, [gs]);

  // Host-only store of the actual committed gambits.  This is a ref because
  // it must never leak the contents to guests via re-render/broadcast — only
  // the committedSet (which player has locked in, not WHAT) is broadcast.
  // Each entry: { action: 'gambit', derived } | { action: 'skip' } | { action: 'blank' }
  const committedGambitsRef = useRef({});


  // ── Animation / pacing constants (match the CSS keyframes) ─────────────────
  const DEAL_HOLD_MS    = 600;
  const LEAVE_HOLD_MS   = 400;
  const RESULT_HOLD_MS  = 2200;
  // Brief delay after the last commit so guests see "all locked in" before the
  // reveal kicks in.  Keeps the transition from feeling abrupt.
  const RESOLVE_DELAY_MS = 250;

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

  // Host-only: bake the draft, broadcast the new preset, and reset the game.
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
    startGame();
  };

  const changeDraft          = (key, val) => setDraft(d => ({ ...d, [key]: val }));
  const changeDeckCount      = (cardId, val) => setDraft(d => ({ ...d, deckOverrides:    { ...d.deckOverrides,    [cardId]: val } }));
  const changeCardValue      = (cardId, val) => setDraft(d => ({ ...d, cardValues:       { ...d.cardValues,       [cardId]: val } }));
  const changeGambitDisabled = (key,   val) => setDraft(d => ({ ...d, disabledGambits:  { ...d.disabledGambits,   [key]:   val } }));
  const changeGambitMult     = (key,   val) => setDraft(d => ({ ...d, gambitMultipliers:{ ...d.gambitMultipliers, [key]:   val } }));
  const applyPresetSnap      = (settings) => setDraft(d => ({ ...d, ...settings }));


  // ── Player / activity helpers ──────────────────────────────────────────────
  const makePlayer = (id) => ({
    id,
    lives:          STD_PRESET.startLives,
    streak:         STD_PRESET.startStreak,
    blanks:         STD_PRESET.startBlanks,
    score:          0,
    dead:           false,
    placement:      null,
  });

  const isActive = (p) => p && !p.dead && p.placement == null;
  const activeIndices  = (players) => players.map((p, i) => isActive(p) ? i : -1).filter(i => i !== -1);
  const activeCountFor = (players) => players.filter(isActive).length;

  const computeFinalRanking = (players) => {
    // 1. Players who reached the score goal, in the order they finished (placement #).
    // 2. Players still alive but not yet placed — ranked by score descending.
    // 3. Eliminated players — ranked by score descending.
    // Alive always beats dead even if dead has a higher raw score.
    const placed = players.filter(p => p.placement != null).sort((a, b) => a.placement - b.placement);
    const alive  = players.filter(p => p.placement == null && !p.dead).sort((a, b) => b.score - a.score);
    const dead   = players.filter(p => p.placement == null &&  p.dead).sort((a, b) => b.score - a.score);
    return [...placed, ...alive, ...dead];
  };


  // ── Shared-deck helpers ────────────────────────────────────────────────────
  // Draws a new (tableCard, handCard) pair from the SHARED deck.  Mirrors the
  // standard-mode helper but with a single deck for all players.
  const drawSharedNext = (deck, oldHand, oldTable) => {
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


  // ── Game initialisation (host only — guests get gs via broadcast) ──────────
  const startGame = () => {
    STD_PRESET.multiplayer = true;
    STD_PRESET.playerCount = playerCount;

    const baseDeck = shfl(stdMkDeck());
    const drawn    = drawSharedNext(baseDeck, null, null);
    const players  = Array.from({ length: playerCount }, (_, i) => makePlayer(i + 1));

    setGs({
      deck:          drawn.deck,
      tableCard:     drawn.tableCard,
      handCard:      drawn.handCard,
      deckEmpty:     drawn.deckEmpty,
      round:         1,
      // Unique per game session so the guest-side round-change effect fires even
      // when "Play Again" resets back to round 1 (same round number, new gameId).
      gameId:        Date.now(),
      startLives:    STD_PRESET.startLives,
      multiplayer:   true,
      players,
      nextPlacement: 1,
    });

    committedGambitsRef.current = {};
    setSel(EMPTY_SEL);
    setShop(false);
    setRevealed(false);
    setNoFlipAnim(false);
    setCommittedSet({});
    setPlayerResults(null);
    setIsDrawRound(false);
    setRoundHistory(Array.from({ length: playerCount }, () => []));
    setWinnerIdx(null);
    setScreen('game');
    deal();
  };


  // ── Gambit selection (local UI state, never broadcast — each device picks
  //    its own gambit privately, the choice is only sent on commit) ──────────
  const toggleSel = (type, val) => {
    if (committedSet[localPlayerIdx]) return;  // locked in — no more changes
    if (revealed) return;
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


  // ── Commit a private gambit / skip / blank ─────────────────────────────────
  // Guests send an action to the host and optimistically mark themselves
  // committed.  The host stores the actual choice in committedGambitsRef and
  // broadcasts only the committedSet (who has locked in, not WHAT).  When the
  // last active player commits, the host triggers resolution.
  const commitGambit = (selOverride, senderIdx) => {
    // Guest path (no override): forward to host
    if (isGuest && selOverride === undefined && senderIdx === undefined) {
      if (committedSet[localPlayerIdx]) return;
      const dg = stdDeriveGambit(sel);
      if (!dg || stdIsGambitDisabled(dg)) return;
      // Optimistic local lockout so the UI updates instantly.
      setCommittedSet(c => ({ ...c, [localPlayerIdx]: true }));
      sendActionToHost('commit', { sel });
      return;
    }

    // Host path
    const idx = senderIdx !== undefined ? senderIdx : 0;
    const useSel = selOverride !== undefined ? selOverride : sel;
    const dg = stdDeriveGambit(useSel);
    if (!dg || stdIsGambitDisabled(dg)) return;
    if (committedGambitsRef.current[idx] !== undefined) return;

    committedGambitsRef.current[idx] = { action: 'gambit', derived: dg };
    setCommittedSet(c => ({ ...c, [idx]: true }));
    checkAllCommitted();
  };

  const commitSkip = (senderIdx) => {
    if (isGuest && senderIdx === undefined) {
      if (committedSet[localPlayerIdx]) return;
      setCommittedSet(c => ({ ...c, [localPlayerIdx]: true }));
      sendActionToHost('skip');
      return;
    }
    const idx = senderIdx !== undefined ? senderIdx : 0;
    if (committedGambitsRef.current[idx] !== undefined) return;
    committedGambitsRef.current[idx] = { action: 'skip' };
    setCommittedSet(c => ({ ...c, [idx]: true }));
    checkAllCommitted();
  };

  const commitBlank = (senderIdx) => {
    if (isGuest && senderIdx === undefined) {
      if (committedSet[localPlayerIdx]) return;
      // Local validation: must have a blank available.
      const myP = gs && gs.players && gs.players[localPlayerIdx];
      if (myP && !STD_PRESET.infiniteBlanks && myP.blanks <= 0) return;
      setCommittedSet(c => ({ ...c, [localPlayerIdx]: true }));
      sendActionToHost('blank');
      return;
    }
    const idx = senderIdx !== undefined ? senderIdx : 0;
    const cur = gsRef.current;
    if (!cur) return;
    const p = cur.players[idx];
    if (!p || (!STD_PRESET.infiniteBlanks && p.blanks <= 0)) return;
    if (committedGambitsRef.current[idx] !== undefined) return;
    committedGambitsRef.current[idx] = { action: 'blank' };
    setCommittedSet(c => ({ ...c, [idx]: true }));
    checkAllCommitted();
  };


  // ── Host: have all active players committed? If so, resolve. ───────────────
  const checkAllCommitted = () => {
    const cur = gsRef.current;
    if (!cur) return;
    const acts = activeIndices(cur.players);
    if (acts.length === 0) return;
    const allIn = acts.every(i => committedGambitsRef.current[i] !== undefined);
    if (!allIn) return;

    // Short delay so the "everyone locked in" state is briefly visible to all
    // peers before the reveal kicks in.
    setTimeout(() => resolveRound(), RESOLVE_DELAY_MS);
  };


  // ── Host: resolve every commit simultaneously and update player stats ──────
  const resolveRound = () => {
    const cur = gsRef.current;
    if (!cur) return;

    const acts    = activeIndices(cur.players);
    const commits = acts.map(i => committedGambitsRef.current[i]);

    // ── Draw detection ──────────────────────────────────────────────────────
    // Every active player must have chosen a real gambit (not skip / blank)
    // AND every chosen gambit must share the same key.
    // Stalemate can be disabled entirely via the Stalemate tab in settings,
    // in which case identical gambits resolve normally (everyone wins/loses).
    let isDraw = false;
    if (STD_PRESET.stalemateEnabled && commits.length >= 2 && commits.every(c => c.action === 'gambit')) {
      const firstKey = stdGambitKey(commits[0].derived);
      isDraw = commits.every(c => stdGambitKey(c.derived) === firstKey);
    }
    setIsDrawRound(isDraw);

    // ── Per-player resolution ───────────────────────────────────────────────
    const results = {};
    const updatedPlayers = cur.players.map((p, i) => {
      if (!isActive(p)) return p;
      const commit = committedGambitsRef.current[i];
      if (!commit) return p;  // safety: shouldn't happen, but guard anyway

      // Build a player-scoped gs view for the resolver helpers.
      const pGs = {
        ...cur,
        lives:  p.lives,
        streak: p.streak,
        score:  p.score,
        blanks: p.blanks,
      };

      if (commit.action === 'skip') {
        const r = stdResolveSkip(pGs);
        results[i] = { action: 'skip', won: false, pts: r.pts, instant: false };
        return { ...p, lives: r.newLives, streak: r.newStreak, score: p.score + r.pts };
      }

      if (commit.action === 'blank') {
        const r = stdResolveBlank(pGs);
        results[i] = { action: 'blank', won: true, pts: r.pts, instant: false };
        return { ...p,
          lives:  r.newLives,
          streak: r.newStreak,
          score:  p.score + r.pts,
          blanks: r.newBlanks,
        };
      }

      // 'gambit' branch
      const label = commit.derived.label;

      if (isDraw) {
        // Stalemate — apply the dedicated stalemate outcome (tunable separately
        // from a regular loss in the settings → Round Outcomes → Stalemate tab).
        // No instant-death even for a copycat joker round.
        const pts       = stdCalcScoreDelta(p.score, cur.tableCard.numValue,
          STD_PRESET.stalemateScoreOp,  STD_PRESET.stalemateScoreMod, STD_PRESET.stalemateScoreTarget);
        const newLives  = STD_PRESET.infiniteLives ? p.lives
          : stdApplyMathOp(p.lives,  STD_PRESET.stalemateLifeOp,   STD_PRESET.stalemateLifeMod);
        const newStreak = stdApplyMathOp(p.streak, STD_PRESET.stalemateStreakOp, STD_PRESET.stalemateStreakMod);
        results[i] = { action: 'draw', won: false, pts, instant: false, gambitLabel: label };
        return { ...p, lives: newLives, streak: newStreak, score: p.score + pts };
      }

      // Normal gambit resolve
      const r = stdResolveGambit(pGs, commit.derived);
      results[i] = {
        action:      'gambit',
        won:         r.won,
        pts:         r.pts,
        instant:     r.isInstant && !r.won && !STD_PRESET.infiniteLives,
        gambitLabel: label,
      };
      return { ...p, lives: r.newLives, streak: r.newStreak, score: r.newScore };
    });

    // ── Per-player history append ───────────────────────────────────────────
    setRoundHistory(h => h.map((arr, i) => {
      const r = results[i];
      if (!r) return arr;
      const newP = updatedPlayers[i];
      const gambit = r.action === 'skip'  ? '— Skip —'
                   : r.action === 'blank' ? '🛡️ Blank'
                   : r.action === 'draw'  ? '⚖ Stalemate · ' + (r.gambitLabel || '?')
                   :                        (r.gambitLabel || '?');
      const outcome = r.action === 'draw'    ? 'draw'
                    : r.action === 'skip'    ? 'skip'
                    : r.action === 'blank'   ? 'blank'
                    : r.won                  ? 'win'
                    : r.instant              ? 'instant'
                    :                          'lose';
      return [{
        type: 'round', round: cur.round,
        tableCard: cur.tableCard, handCard: cur.handCard,
        gambit, outcome, pts: r.pts,
        score: newP.score, lives: newP.lives, blanks: newP.blanks, streak: newP.streak,
      }, ...arr];
    }));

    // ── Eliminations + score-goal placements ───────────────────────────────
    let nextPlacement = cur.nextPlacement || 1;
    let newWinnerIdx  = winnerIdx;
    const finalPlayers = updatedPlayers.map((p, i) => {
      if (!isActive(p)) return p;
      // Score goal reached — claim the next placement slot.
      if (STD_PRESET.scoreToBeatEnabled && p.score >= STD_PRESET.scoreToBeat) {
        const placement = nextPlacement++;
        if (placement === 1 && newWinnerIdx == null) newWinnerIdx = i;
        return { ...p, placement };
      }
      // Out of lives → eliminated (no Death's-Door in online MP).
      if (!STD_PRESET.infiniteLives && p.lives <= 0) {
        return { ...p, dead: true, lives: 0 };
      }
      return p;
    });

    if (newWinnerIdx !== winnerIdx) setWinnerIdx(newWinnerIdx);

    setGs(g => ({ ...g, players: finalPlayers, nextPlacement }));
    setPlayerResults(results);
    setRevealed(true);

    // Visual table flash from the LOCAL viewer's outcome.
    const myR = results[localPlayerIdx];
    if (myR) flash(myR.won || myR.action === 'blank' ? 'win' : 'lose');
    if (window.SOUND) window.SOUND.playCardAppear();
  };


  // ── Continue → deal the next round, or end the game ────────────────────────
  const advanceRound = () => {
    const cur = gsRef.current;
    if (!cur) return;

    // Game-over check: 1 (or 0) active players left.
    const active = cur.players.filter(isActive).length;
    if (active <= 1) {
      endGameTo(cur, 'win');
      return;
    }

    if (window.SOUND) window.SOUND.playCardDisappear();
    setLeaving(true);

    setTimeout(() => {
      const cur2 = gsRef.current;
      if (!cur2) return;

      const drawn = drawSharedNext(cur2.deck, cur2.handCard, cur2.tableCard);
      if (drawn.deckEmpty) {
        endGameTo({ ...cur2, deck: drawn.deck, deckEmpty: true }, 'win');
        return;
      }

      const nextGs = {
        ...cur2,
        deck:      drawn.deck,
        tableCard: drawn.tableCard,
        handCard:  drawn.handCard,
        round:     cur2.round + 1,
      };

      committedGambitsRef.current = {};
      setGs(nextGs);
      setSel(EMPTY_SEL);
      setShop(false);
      setRevealed(false);
      setNoFlipAnim(false);
      setCommittedSet({});
      setPlayerResults(null);
      setIsDrawRound(false);
      setLeaving(false);
      deal();
    }, LEAVE_HOLD_MS);
  };


  // Host-only: after the reveal hold, fire advanceRound automatically.
  useEffect(() => {
    if (!isHost) return;
    if (!revealed) return;
    const timer = setTimeout(() => advanceRound(), RESULT_HOLD_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, revealed]);


  const endGameTo = (g, nextScreen) => {
    committedGambitsRef.current = {};
    setGs(g);
    setSel(EMPTY_SEL); setShop(false);
    setRevealed(false); setNoFlipAnim(false);
    setLeaving(false);
    setCommittedSet({});
    setPlayerResults(null);
    setIsDrawRound(false);
    setScreen(nextScreen);
  };


  // ── Shop (per-player; each viewer buys for themselves) ─────────────────────
  const buyLife = (senderIdx) => {
    if (isGuest && senderIdx === undefined) {
      sendActionToHost('buy-life');
      return;
    }
    const idx = senderIdx !== undefined ? senderIdx : 0;
    const cur = gsRef.current;
    if (!cur) return;
    const p = cur.players[idx];
    if (!p || p.streak < STD_PRESET.costLife) return;

    const newStreak = p.streak - STD_PRESET.costLife;
    const newLives  = p.lives  + STD_PRESET.shopLifeAmount;
    setGs(g => ({ ...g, players: g.players.map((pp, i) =>
      i === idx ? { ...pp, streak: newStreak, lives: newLives } : pp
    ) }));
    setRoundHistory(h => h.map((arr, i) =>
      i === idx ? [{
        type: 'shop', round: cur.round,
        item: '♥ Health Potion (+' + STD_PRESET.shopLifeAmount + ')',
        cost: STD_PRESET.costLife,
        score: p.score, lives: newLives, blanks: p.blanks, streak: newStreak,
      }, ...arr] : arr
    ));
  };

  const buyBlank = (senderIdx) => {
    if (isGuest && senderIdx === undefined) {
      sendActionToHost('buy-blank');
      return;
    }
    const idx = senderIdx !== undefined ? senderIdx : 0;
    const cur = gsRef.current;
    if (!cur) return;
    const p = cur.players[idx];
    if (!p || p.streak < STD_PRESET.costBlank) return;

    const newStreak = p.streak - STD_PRESET.costBlank;
    const newBlanks = p.blanks + STD_PRESET.shopBlankAmount;
    setGs(g => ({ ...g, players: g.players.map((pp, i) =>
      i === idx ? { ...pp, streak: newStreak, blanks: newBlanks } : pp
    ) }));
    setRoundHistory(h => h.map((arr, i) =>
      i === idx ? [{
        type: 'shop', round: cur.round,
        item: '🛡️ Blank Card (+' + STD_PRESET.shopBlankAmount + ')',
        cost: STD_PRESET.costBlank,
        score: p.score, lives: p.lives, blanks: newBlanks, streak: newStreak,
      }, ...arr] : arr
    ));
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


  // ── Host: a guest dropped — mark them out, notify the room, keep the game
  //    moving so the surviving players don't deadlock on the missing commit.
  // ──────────────────────────────────────────────────────────────────────────
  const handlePeerDrop = useCallback((idx, name) => {
    setConnStatus('peer-left');
    setConnMessage((name || 'A player') + ' left the game.');

    // Tell every remaining guest so they get the same notice (otherwise only
    // the host would know a player dropped).
    try { peerSession.send({ type: 'peer-left', name: name || 'A player', idx }); } catch (e) {}

    if (idx == null) return;

    // Remove them from the active roster so resolution and game-over checks
    // can proceed without their commit / placement.
    delete committedGambitsRef.current[idx];
    setCommittedSet(c => {
      if (!c || !(idx in c)) return c;
      const nc = { ...c };
      delete nc[idx];
      return nc;
    });
    setGs(g => {
      if (!g || !g.players || !g.players[idx]) return g;
      const np = g.players.map((p, i) =>
        i === idx ? { ...p, dead: true, lives: 0 } : p
      );
      return { ...g, players: np };
    });

    // If their absence completes the round, kick resolution.
    setTimeout(() => checkAllCommitted(), 60);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peerSession]);

  // Live action handlers — re-assigned every render so the message handler
  // (registered once in useEffect) always sees fresh closures.
  const actionsRef = useRef({});
  actionsRef.current = { commitGambit, commitSkip, commitBlank, buyLife, buyBlank };

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

  // Host: thin animation-tick broadcast — fires frequently but is tiny (~3 booleans).
  // Keeps animation state decoupled from the heavy game-state payload so that
  // dealing/leaving/flash transitions don't trigger a full resend of gs + history.
  useEffect(() => {
    if (!isHost) return;
    try { peerSession.send({ type: 'game-state', dealing, leaving, tableFlash }); } catch (e) {}
  }, [isHost, peerSession, dealing, leaving, tableFlash]);

  // Host: full game-state broadcast — fires only when meaningful game state changes.
  // gs.deck is stripped before sending: guests render from tableCard/handCard only
  // and never read the remaining deck array, so sending it wastes 3–4 KB every tick.
  useEffect(() => {
    if (!isHost || !gs) return;
    try {
      const { deck: _omit, ...gsToSend } = gs;
      peerSession.send({
        type: 'game-state',
        gs: gsToSend,
        committedSet,
        playerResults,
        isDrawRound,
        revealed,
        screen,
        roundHistory,
        winnerIdx,
      });
    } catch (err) {
      console.warn('[online host] broadcast failed', err);
    }
  }, [
    isHost, peerSession,
    gs, committedSet, playerResults, isDrawRound,
    revealed, screen, roundHistory, winnerIdx,
  ]);

  // Live state mirror — used by the host's game-ready handler so late joiners
  // get the freshest snapshot.
  const liveStateRef = useRef({});
  liveStateRef.current = {
    gs, committedSet, playerResults, isDrawRound,
    revealed, screen, leaving, dealing,
    tableFlash, roundHistory, winnerIdx,
  };

  // Guest: receive state + preset updates + host leave notices
  useEffect(() => {
    if (!isGuest) return;
    peerSession.onMessage = (msg) => {
      if (!msg || typeof msg !== 'object') return;

      if (msg.type === 'game-state') {
        if (msg.gs            !== undefined) setGs(msg.gs);
        if (msg.committedSet  !== undefined) setCommittedSet(msg.committedSet);
        if (msg.playerResults !== undefined) setPlayerResults(msg.playerResults);
        if (msg.isDrawRound   !== undefined) setIsDrawRound(msg.isDrawRound);
        if (msg.revealed      !== undefined) setRevealed(msg.revealed);
        if (msg.screen        !== undefined) setScreen(msg.screen);
        if (msg.leaving       !== undefined) setLeaving(msg.leaving);
        if (msg.dealing       !== undefined) setDealing(msg.dealing);
        if (msg.tableFlash    !== undefined) setFlash(msg.tableFlash);
        if (msg.roundHistory  !== undefined) setRoundHistory(msg.roundHistory);
        if (msg.winnerIdx     !== undefined) setWinnerIdx(msg.winnerIdx);
      } else if (msg.type === 'preset-update') {
        installPreset(msg.preset);
        setPresetTick(t => t + 1);
      } else if (msg.type === 'host-leaving') {
        setConnStatus('lost');
        setConnMessage('The host left the game.');
      } else if (msg.type === 'peer-left') {
        // Another guest dropped — surface a notice (our own link to the host
        // is still fine).  Guests can't dismiss this themselves; they wait
        // for the host to decide whether to keep playing or head back to
        // the lobby.
        setConnStatus('peer-left');
        setConnMessage((msg.name || 'A player') + ' left the game.');
      } else if (msg.type === 'peer-left-clear') {
        // Host dismissed the player-left notice — clear ours too so we don't
        // sit on a stale overlay.
        setConnStatus('connected');
        setConnMessage(null);
      } else if (msg.type === ((window.OnlineLobbyMSG && window.OnlineLobbyMSG.LOBBY_BACK) || 'lobby-back')) {
        // Host pulled the room back to the lobby — follow them so the same
        // PeerSession stays alive and any reconnecting peer can rejoin.
        if (typeof onBackToLobby === 'function') {
          if (peerSession) peerSession.onMessage = null;
          keepSessionRef.current = true;
          onBackToLobby();
        }
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
        if (s.gs) {
          const { deck: _omit, ...gsToSend } = s.gs;
          peerSession.sendTo(fromPeerId, Object.assign({ type: 'game-state' }, s, { gs: gsToSend }));
        }
        peerSession.sendTo(fromPeerId, { type: 'preset-update', preset: snapshotPreset() });
        return;
      }

      if (msg.type === 'guest-leaving') {
        const idx  = playerMapRef.current[fromPeerId];
        const name = (peerSession._guestInfo && peerSession._guestInfo[fromPeerId] && peerSession._guestInfo[fromPeerId].name)
                  || (idx != null ? getPlayerName(idx) : 'A player');
        handlePeerDrop(idx, name);
        return;
      }

      if (msg.type !== 'game-action') return;
      const senderIdx = playerMapRef.current[fromPeerId];
      if (senderIdx == null) return;
      const cur = gsRef.current;
      if (!cur) return;
      const senderP = cur.players[senderIdx];
      if (!senderP || !isActive(senderP)) return;

      const a = actionsRef.current;
      switch (msg.kind) {
        case 'commit':    if (a.commitGambit) a.commitGambit(msg.sel, senderIdx); break;
        case 'skip':      if (a.commitSkip)   a.commitSkip(senderIdx);            break;
        case 'blank':     if (a.commitBlank)  a.commitBlank(senderIdx);           break;
        case 'buy-life':  if (a.buyLife)      a.buyLife(senderIdx);               break;
        case 'buy-blank': if (a.buyBlank)     a.buyBlank(senderIdx);              break;
      }
    };
    return () => { if (peerSession) peerSession.onMessage = null; };
  }, [isHost, peerSession]);

  // Either side: PeerJS-level disconnect (no explicit "leaving" message arrived)
  useEffect(() => {
    if (!peerSession) return;
    peerSession.onPeerLeave = (peerInfo) => {
      if (isGuest) {
        // Our only peer is the host; their drop is fatal.
        setConnStatus('lost');
        setConnMessage('The host has left the game.');
        return;
      }
      // Host: figure out which player slot dropped, mark them as out, and
      // tell the rest of the room so the survivors get a notice too.
      const peerId = peerInfo && peerInfo.peerId;
      const idx    = playerMapRef.current[peerId];
      // If the dropped peer wasn't part of the game (a mid-game joiner we
      // bounced via LOBBY_GAME_LOCKED), suppress the notice — they never
      // counted as a player.
      if (idx == null) return;
      const name = (peerInfo && peerInfo.name) || getPlayerName(idx);
      handlePeerDrop(idx, name);
    };
    return () => { if (peerSession) peerSession.onPeerLeave = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Keep the live session alive across unmount when we're handing it back to
  // the lobby (Back-to-Lobby flow).  Default is false → cleanup tears it down.
  const keepSessionRef = useRef(false);

  // Unmount cleanup — fires when the user clicks "Return to Menu".
  // Also resets STD_PRESET.multiplayer so returning to Standard mode doesn't
  // accidentally inherit the online session's multiplayer=true flag.
  useEffect(() => {
    return () => {
      STD_PRESET.multiplayer = false;
      if (peerSession && !keepSessionRef.current) {
        try { peerSession.send({ type: isHost ? 'host-leaving' : 'guest-leaving' }); } catch (e) {}
        try { peerSession.destroy(); } catch (e) {}
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  // ── Host: reject any new peer that tries to join mid-game ──────────────────
  // The lobby would otherwise add them to the roster silently; without an
  // assigned player index, they would be invisible and confusing for everyone.
  useEffect(() => {
    if (!isHost || !peerSession) return;
    peerSession.onPeerJoin = (peerInfo) => {
      const lockedMsg = (window.OnlineLobbyMSG && window.OnlineLobbyMSG.LOBBY_GAME_LOCKED)
                     || 'lobby-game-locked';
      try { peerSession.sendTo(peerInfo.peerId, { type: lockedMsg }); } catch (e) {}
      // Give the message a moment to leave the buffer before we hang up.
      setTimeout(() => {
        try {
          const c = (peerSession.conns || []).find(cc => cc && cc.peer === peerInfo.peerId);
          if (c && typeof c.close === 'function') c.close();
        } catch (e) {}
      }, 150);
    };
    return () => { if (peerSession) peerSession.onPeerJoin = null; };
  }, [isHost, peerSession]);


  // ── Back to Lobby ──────────────────────────────────────────────────────────
  // Host: broadcast so remaining guests follow us back into the lobby.
  // Guest: simply unmount; the router swaps OnlineApp for OnlineLobby with the
  // same PeerSession still attached.
  const handleBackToLobby = useCallback(() => {
    if (typeof onBackToLobby !== 'function') return;
    if (isHost && peerSession) {
      const backMsg = (window.OnlineLobbyMSG && window.OnlineLobbyMSG.LOBBY_BACK) || 'lobby-back';
      try { peerSession.send({ type: backMsg, playerNames }); } catch (e) {}
    }
    // Drop our handlers so the lobby can install its own without races.
    if (peerSession) {
      peerSession.onMessage   = null;
      peerSession.onPeerJoin  = null;
      peerSession.onPeerLeave = null;
    }
    keepSessionRef.current = true;
    onBackToLobby();
  }, [isHost, peerSession, onBackToLobby, playerNames]);

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

  // Guest: clear local gambit selection and shop whenever the host advances to
  // a new round OR starts a brand-new game (Play Again).  The host resets its
  // own sel/shop inside advanceRound() and startGame(); guests must do it
  // independently because those codepaths don't run on their devices.
  // Tracking both gameId + round covers the edge case where the host resets
  // back to round 1 (same round number but different gameId timestamp).
  const currentRound  = gs ? gs.round   : null;
  const currentGameId = gs ? gs.gameId  : null;
  useEffect(() => {
    if (!isGuest) return;
    setSel(EMPTY_SEL);
    setShop(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGuest, currentRound, currentGameId]);


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
    hideMultiplayer:        true,
    initialPresetId:        presetId,
    onPresetIdChange:       setPresetId,
  };


  // ── End-of-game screens (online is always MP — no gameover / deckempty) ────
  const playerEndStatus = (p) => {
    if (p.placement != null) {
      const m = p.placement === 1 ? '🥇 1st' : p.placement === 2 ? '🥈 2nd' : p.placement === 3 ? '🥉 3rd' : '#' + p.placement;
      return { label: m, cls: 'mp-sb-placed' };
    }
    if (p.dead) return { label: '☠ Dead', cls: 'mp-sb-dead' };
    return { label: '— Last Hand', cls: 'mp-sb-last' };
  };


  // ── Connection-lost modal (declared up here so end-screens can render it too)
  // 'lost'      → terminal disconnect (only the return-to-menu path makes sense)
  // 'peer-left' → someone else dropped.  Only the host can act on it:
  //               Dismiss (broadcasts a clear so all guests' overlays close)
  //               Back to Lobby (lets disconnected players rejoin)
  //               Return to Menu (tear the room down)
  //               Guests just see the notice and Return-to-Menu fallback;
  //               they wait on the host's decision.
  // The host's Dismiss is hidden if they're now the sole active player —
  // continuing alone isn't meaningful, so we force a choice between Back to
  // Lobby or Return to Menu.
  const activeAfterDrop = gs && gs.players ? gs.players.filter(isActive).length : 0;
  const hostAlone = isHost && activeAfterDrop <= 1;

  const dismissNotice = () => {
    if (isHost && peerSession) {
      try { peerSession.send({ type: 'peer-left-clear' }); } catch (e) {}
    }
    setConnStatus('connected');
    setConnMessage(null);
  };

  const connectionLostModal = (connStatus === 'lost' || connStatus === 'peer-left')
    ? e('div', { className: 'conn-lost-overlay' },
        e('div', { className: 'conn-lost-panel' },
          e('div', { className: 'goskull' }, '⚠'),
          e('h2',  { className: 'gottl' },
            connStatus === 'lost' ? 'Connection Lost' : 'Player Left'),
          e('p',   { className: 'gosub' }, connMessage || 'A peer dropped from the room.'),

          // Host-only: ferry survivors back to the lobby so the disconnected
          // player can rejoin with the same room code.
          connStatus === 'peer-left' && isHost && typeof onBackToLobby === 'function' &&
            e('button', { className: 'btn-start', onClick: handleBackToLobby,
              style: { marginTop: '14px' } }, '↺ Back to Lobby'),

          // Host-only Dismiss (broadcasts to clear guests' overlays).  Hidden
          // when the host is the only player left — no point continuing solo.
          connStatus === 'peer-left' && isHost && !hostAlone &&
            e('button', { className: 'btn-options', onClick: dismissNotice,
              style: { marginTop: '10px' } }, 'Dismiss'),

          // Subtle hint for guests so they know why they can't dismiss.
          connStatus === 'peer-left' && !isHost &&
            e('div', {
              style: {
                marginTop: '12px', fontFamily: "'Cinzel',serif",
                fontSize: 'var(--font-xs)', color: 'var(--secondary-color)',
                letterSpacing: '0.05em', lineHeight: 1.5, textAlign: 'center',
                opacity: 0.85,
              },
            }, '⌛ Waiting for the host to decide…'),

          e('button', {
            className: connStatus === 'lost' ? 'btn-start' : 'btn-options',
            onClick: onReturnToMenu,
            style: { marginTop: connStatus === 'lost' ? '14px' : '10px' },
          }, '← Return to Menu')
        )
      )
    : null;


  if (screen === 'win') {
    const ranking    = gs?.players ? computeFinalRanking(gs.players) : [];
    const winnerP    = winnerIdx != null && gs?.players ? gs.players[winnerIdx] : null;

    // Tie detection: no score-goal winner and 2+ alive survivors share the top score.
    const topSurvivors = ranking.filter(p => p.placement == null && !p.dead);
    const isTie        = !winnerP && topSurvivors.length >= 2
                         && topSurvivors[0].score === topSurvivors[1].score;
    const tiedPlayers  = isTie
      ? topSurvivors.filter(p => p.score === topSurvivors[0].score)
      : [];

    // Spotlight: the score-goal winner, or the sole top survivor, or nobody (tie).
    const fallbackP    = !winnerP && !isTie && ranking[0];
    const spotlightP   = winnerP || fallbackP || null;
    const spotIdx      = spotlightP && gs?.players ? gs.players.indexOf(spotlightP) : -1;
    const winScore     = isTie
      ? topSurvivors[0].score
      : (spotlightP ? spotlightP.score : (gs?.score || 0));
    const showSpot     = !isTie && spotIdx >= 0;
    const showSpotPlaced = winnerP && winnerP.placement === 1;

    const subtitleText = isTie
      ? tiedPlayers.map(p => getPlayerName(gs.players.indexOf(p))).join(' & ') + ' — Matched blow for blow'
      : showSpotPlaced
        ? getPlayerName(spotIdx) + ' claims the night'
        : showSpot
          ? getPlayerName(spotIdx) + ' stands tallest'
          : 'The night ends';

    const boxLabel = isTie
      ? 'Tied at ' + winScore.toLocaleString() + ' pts'
      : (showSpot ? getPlayerName(spotIdx) + ' — Top Score' : 'Final Standings');

    const winScreenHistory = roundHistory[localPlayerIdx] || [];
    return e('div', { className: 'app' },
      // Settings overlays must be present on the end screen too — the host's
      // ⚙ Options button is rendered below and would silently do nothing otherwise.
      settingsOpen && isHost  && e(StdSettingsPanel, { ...settingsProps, hideMainMenuButton: true }),
      settingsOpen && isGuest && e(OnlGuestOptionsPanel, { onClose: closeSettings, onReturnToMenu }),
      infoOpen && e(StdInfoPanel, { gs, history: winScreenHistory, onClose: () => setInfoOpen(false) }),
      // Player-left / connection-lost notices show on the win screen too so a
      // late disconnect (e.g. a guest closing their tab) doesn't go silent.
      connectionLostModal,
      e('div', { className: 'gameover' },
        e('div', { className: 'victory-sigil' }, isTie ? '⚖' : '★'),
        e('h2',  { className: 'gottl-victory' }, isTie ? 'The Devil Stalls' : 'The Devil Yields'),
        e('p',   { className: 'gosub-victory' }, subtitleText),
        e('div', { className: 'gobox' },
          e('div', { className: 'golbl' },   boxLabel),
          e('div', { className: 'goscore' }, isTie ? '— Draw —' : winScore.toLocaleString()),
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
        // Host controls
        isHost && e('button', { className: 'btn-start',   onClick: resetGame },    'Play Again'),
        isHost && typeof onBackToLobby === 'function' && e('button', {
          className: 'btn-options', onClick: handleBackToLobby,
        }, '↺ Back to Lobby'),

        // Options + History row — same layout for host and guest.
        e('div', { className: 'endscreen-row' },
          e('button', { className: 'btn-options', onClick: openSettings }, '⚙ Options'),
          e('button', { className: 'btn-options', onClick: () => setInfoOpen(true) }, '≡ History'),
        ),

        // Guest-only: waiting notice (now that Options/History live in the row above).
        isGuest && e('div', {
          style: {
            marginTop: '10px', padding: '10px 14px',
            border: '1px solid rgba(255,204,77,0.18)',
            background: 'rgba(0,0,0,0.35)',
            fontFamily: "'Cinzel',serif",
            fontSize: 'var(--font-xs)', color: 'var(--secondary-color)',
            letterSpacing: '0.05em', lineHeight: 1.6,
            textAlign: 'center',
          },
        }, '⌛ Waiting for the host to start a new round…'),

        (isGuest || typeof onBackToLobby !== 'function') && e('button', { className: 'btn-options', onClick: onReturnToMenu,
          style: { opacity: 0.7 } }, 'Leave Room')
      )
    );
  }


  // ── Loading placeholder (guest before first state arrives) ─────────────────
  if (!gs) {
    return e('div', { className: 'app' },
      connectionLostModal,
      e('div', { className: 'gameover' },
        e('div', { className: 'deckend-sigil' }, '⛧'),
        e('h2',  { className: 'gottl-gold' }, isGuest ? 'Waiting for the host…' : 'Dealing cards…'),
        e('p',   { className: 'gosub-gold' }, isGuest ? 'The first hand is on its way' : 'One moment'),
        e('button', { className: 'btn-options', onClick: onReturnToMenu,
          style: { marginTop: '20px', opacity: 0.7 } }, '← Main Menu')
      )
    );
  }

  // ── Local-viewer derived data ──────────────────────────────────────────────
  const localPlayer = (gs.players && gs.players[localPlayerIdx]) || { lives: 0, blanks: 0, streak: 0, score: 0 };
  const localActive  = isActive(localPlayer);
  const myCommitted  = !!committedSet[localPlayerIdx];
  const myResult     = (revealed && playerResults) ? playerResults[localPlayerIdx] : null;

  const derived   = stdDeriveGambit(sel);
  const canCommit = !!derived && !myCommitted && !revealed && localActive && !stdIsGambitDisabled(derived);

  const tc       = gs.tableCard, hc = gs.handCard;
  const isHighTC = HIGH.has(tc.value);
  const isLowTC  = ['2','3','4','5','6','7'].includes(tc.value);
  const tcCat    = tc.value === 'JOKER' ? 'Joker' : tc.value === 'A' ? 'Ace' : isHighTC ? 'High' : isLowTC ? 'Low' : '—';

  // Committed-count summary used in the conn-bar text.
  const acts          = activeIndices(gs.players);
  const committedCnt  = acts.filter(i => committedSet[i]).length;
  const pendingCount  = acts.length - committedCnt;

  // Round-history panel uses this player's own history.
  const visibleHistory = roundHistory[localPlayerIdx] || [];

  // Empty-state text for the gambit panel.
  // After commit but before reveal: show "Locked In · Waiting for X others".
  // Otherwise: the standard "Choose Your Gambit" prompt.
  let gambitEmptyLabel = null;
  if (!localActive) {
    gambitEmptyLabel = 'You are out of the game';
  } else if (myCommitted && !revealed) {
    gambitEmptyLabel = pendingCount > 0
      ? '✓ Locked In · Waiting for ' + pendingCount + ' other' + (pendingCount === 1 ? '' : 's')
      : '✓ Locked In · Resolving…';
  }


  return e('div', { className: 'app' },
    settingsOpen && isHost  && e(StdSettingsPanel, {
      ...settingsProps,
      onReturnToLobby: typeof onBackToLobby === 'function' ? handleBackToLobby : undefined,
    }),
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
          e('button', { className: 'hdr-gear', onClick: openSettings,
            title: isHost ? 'Options' : 'Sound & menu' }, '⚙ Options'),
          e('button', { className: 'hdr-gear', onClick: () => setInfoOpen(true),
            title: 'View Deck & History' }, '≡ History'),
        ),
        e('span', { className: 'hdr-score' },
          e('span', null,
            'Score: ',
            e('b', null, (localPlayer.score || 0).toLocaleString()),
            STD_PRESET.scoreToBeatEnabled && e('span', { className: 'hdr-score-goal' },
              ' / ' + STD_PRESET.scoreToBeat.toLocaleString())
          )
        )
      ),

      // Online connection bar
      e('div', { className: 'conn-bar' },
        e('span', { className: 'conn-dot' + (connStatus === 'lost' ? ' conn-lost' : ' conn-ok') }, '●'),
        e('span', { className: 'conn-text' },
          connStatus === 'lost' ? 'Disconnected'
            : (isHost ? 'Hosting' : 'Connected') + ' · ' + getPlayerName(localPlayerIdx ?? 0)
        ),
        connStatus === 'connected' && acts.length > 0 && e('span', { className: 'conn-waiting' },
          revealed
            ? ' · Round ' + gs.round + ' result'
            : ' · ' + committedCnt + ' / ' + acts.length + ' locked in'
        ),
      ),

      // Opponent strip — always shown (online is always MP).
      // Compact variant kicks in at 3+ players so names and stats stay
      // readable when each pill only gets ~25–33% of the row width.
      gs.players && gs.players.length > 1 && e('div', {
        className: 'opp-strip' + (gs.players.length >= 3 ? ' opp-strip-compact' : ''),
      },
        gs.players.map((p, i) => {
          const placed     = p.placement != null;
          const eliminated = p.dead;
          const isMe       = i === localPlayerIdx;
          const cmt        = !!committedSet[i];
          const cls = 'opp-pill'
            + (cmt && !placed && !eliminated && !revealed ? ' opp-cur'    : '')
            + (placed                                    ? ' opp-placed' : '')
            + (eliminated                                ? ' opp-out'    : '');
          const medal = placed
            ? (p.placement === 1 ? '🥇' : p.placement === 2 ? '🥈' : p.placement === 3 ? '🥉' : '#' + p.placement)
            : null;
          const statusIcon = medal ? medal
            : eliminated ? '☠'
            : getPlayerName(i);
          const statusBadge = !placed && !eliminated
            ? (revealed ? '◉' : cmt ? '✓' : '⋯')
            : '';
          return e('div', { key: p.id, className: cls },
            e('span', { className: 'opp-tag' }, statusIcon + (isMe ? ' (you)' : '')),
            !eliminated && !placed && e('span', { className: 'opp-stat', title: cmt ? 'Locked in' : 'Choosing' },
              statusBadge
            ),
            !eliminated && !placed && e('span', { className: 'opp-stat' },
              e('span', { className: 'opp-icon' }, '♥'),
              STD_PRESET.infiniteLives ? '∞' : p.lives
            ),
            !eliminated && !placed && e('span', { className: 'opp-stat' },
              e('span', { className: 'opp-icon' }, '▫'),
              STD_PRESET.infiniteBlanks ? '∞' : p.blanks
            ),
            !eliminated && !placed && e('span', { className: 'opp-stat' },
              e('span', { className: 'opp-icon' }, '≈'),
              p.streak
            ),
            e('span', { className: 'opp-stat opp-score' }, p.score.toLocaleString())
          );
        })
      ),

      // Stats — local viewer's own values.
      e('div', { className: 'stats' },
        e('div', { className: 'stat' },
          e('span', { className: 'stat-lbl' }, 'Lives'),
          STD_PRESET.infiniteLives
            ? e('span', { className: 'stat-val stat-inf' }, '∞')
            : e('span', { className: 'stat-val' }, +(localPlayer.lives || 0))
        ),
        e('div', { className: 'stat' },
          e('span', { className: 'stat-lbl' }, 'Blanks'),
          STD_PRESET.infiniteBlanks
            ? e('span', { className: 'stat-val stat-inf' }, '∞')
            : e('span', { className: 'stat-val' }, +(localPlayer.blanks || 0))
        ),
        e('div', { className: 'stat' },
          e('span', { className: 'stat-lbl' }, 'Streak'),
          e('span', { className: 'stat-val' }, +(localPlayer.streak || 0))
        ),
      ),

      // Card table — shared between all players.
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

      // Action area — gated by myCommitted / revealed / localActive.
      e('div', { className: 'content-area' },
        e('div', null,
          e('div', { className: 'actions', style: { gridTemplateColumns: 'repeat(4,minmax(0,1fr))' } },
            e('button', {
              className: 'btnmain',
              onClick: () => commitGambit(),
              disabled: !canCommit || shop,
            }, myCommitted ? 'Locked' : 'Commit'),
            e('button', { className: 'btnsec', onClick: () => commitBlank(),
              disabled: !STD_PRESET.blanksEnabled || (!STD_PRESET.infiniteBlanks && !localPlayer.blanks)
                || shop || revealed || myCommitted || !localActive,
            }, 'Blank'),
            e('button', { className: 'btnsec', onClick: () => commitSkip(),
              disabled: !STD_PRESET.skipsEnabled || shop || revealed || myCommitted || !localActive,
            }, 'Skip'),
            e('button', { className: 'btnsec',
              onClick: () => setShop(s => !s),
              disabled: revealed || myCommitted || !localActive,
            }, shop ? 'Close Shop' : 'Shop')
          ),
          (myResult || !shop) && e(StdGambitPanel, {
            sel, onToggle: toggleSel, derived,
            // Inject the local player's streak so the point formula renders
            // correctly — the shared gs no longer has a top-level streak field.
            gs: { ...gs, streak: localPlayer.streak },
            disabled: !!myResult || myCommitted || revealed || !localActive,
            result:    myResult,
            lastChance: false,
            diceState: { result: null, guess: null, rollsLeft: 0 },
            onRoll: () => {},
            emptyLabel: gambitEmptyLabel,
          }),
          shop && !myResult && e(StdShop, {
            gs: { ...gs, streak: localPlayer.streak, lives: localPlayer.lives, blanks: localPlayer.blanks, score: localPlayer.score },
            buyLife: () => buyLife(),
            buyBlank: () => buyBlank(),
          })
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
  const [confirmLeave, setConfirmLeave] = React.useState(false);
  return e('div', { className: 'set-overlay' },
    e('div', { className: 'set-panel', style: { position: 'relative' } },
      // ── Confirmation overlay ────────────────────────────────────────────
      confirmLeave && e('div', {
        style: {
          position: 'absolute', inset: 0,
          background: 'rgba(10,10,15,0.92)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          borderRadius: 'inherit', zIndex: 20,
          padding: '24px', gap: '12px', textAlign: 'center',
        },
      },
        e('div', { style: { fontFamily: "'Cinzel',serif", fontSize: 'var(--font-sm)', letterSpacing: '0.06em' } }, 'Leave the room?'),
        e('div', { style: { fontFamily: "'Cinzel',serif", fontSize: 'var(--font-xs)', color: 'var(--secondary-color)', lineHeight: 1.5 } },
          'You will be disconnected from the game.'),
        e('div', { style: { display: 'flex', gap: '10px', marginTop: '4px' } },
          e('button', { className: 'btn-options', onClick: onReturnToMenu, style: { flex: 1 } }, 'Leave'),
          e('button', { className: 'btnsec',    onClick: () => setConfirmLeave(false), style: { flex: 1 } }, 'Stay'),
        )
      ),
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
        e('button', { className: 'btnsec set-back-btn', onClick: () => setConfirmLeave(true) }, 'Leave Room'),
      )
    )
  );
}


// ── Register on window so the router can detect / mount us ───────────────────
window.OnlineApp = OnlineApp;
// ──────────────────────────────────────────────────────────────────────────────
