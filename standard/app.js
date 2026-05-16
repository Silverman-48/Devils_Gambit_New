// ── Standard Mode — App orchestrator ──────────────────────────────────────────
//
// Self-contained React component for the Standard game.  Owns its own state,
// gameplay flow, and screens.  Reads STD_PRESET / STANDARD_PRESETS only.
// Registers itself on the window so the router can mount it dynamically and
// detect its presence (graceful degradation if this file is deleted).
//
// Load order: ... → standard/components.js → standard/app.js → ... → router.js
// ──────────────────────────────────────────────────────────────────────────────


function StandardApp({
  onReturnToMenu,
  // ── Online-mode props (all optional; null = local play) ────────────────────
  // Supplied by online/lobby.js after a successful PeerJS handshake.  The
  // entire online layer is purely additive: if peerSession is null, every
  // code path below behaves identically to the pre-online build.  Deleting
  // the online/ folder leaves these props permanently null.
  peerSession    = null,   // window.PeerSession instance, already connected
  peerRole       = null,   // 'host' | 'guest'
  localPlayerIdx = null,   // which player index this device controls (0 = host)
  playerCount    = null,   // total players in the online match
}) {
  const { useState, useEffect, useCallback, useRef } = React;
  const e = React.createElement;

  // ── Online-mode derived flags ───────────────────────────────────────────────
  // Cheap to recompute every render; no allocations.  Used throughout to gate
  // state-broadcasts, message handlers, and disabled-button logic.
  const isOnline      = peerSession != null && typeof peerSession.send === 'function';
  const isOnlineHost  = isOnline && peerRole === 'host';
  const isOnlineGuest = isOnline && peerRole === 'guest';

  // ── Screen + core state ─────────────────────────────────────────────────────
  // Online clients skip the start screen entirely:
  //   • Host:  startGame() auto-fires on mount with STD_PRESET pre-baked by the lobby.
  //   • Guest: a "Waiting…" placeholder renders until the first state snapshot arrives.
  const [screen,       setScreen]      = useState(isOnline ? 'game' : 'start');
  const [gs,           setGs]          = useState(null);
  const [sel,          setSel]         = useState(EMPTY_SEL);
  const [revealed,     setRevealed]    = useState(false);
  const [result,       setResult]      = useState(null);
  const [shop,         setShop]        = useState(false);
  const [dealing,      setDealing]     = useState(false);
  const [leaving,      setLeaving]     = useState(false);
  const [tableFlash,   setFlash]       = useState(null);
  const [noFlipAnim,   setNoFlipAnim]  = useState(false);
  const [diceState,    setDiceState]   = useState({ result: null, guess: null, rollsLeft: 0 });
  const [lastChance,   setLastChance]  = useState(false);
  const [roundHistory, setRoundHistory] = useState([]);
  const [winnerIdx,    setWinnerIdx]   = useState(null); // MP: index of winning player on the win screen

  // Online-only UI state: connection health + last disconnect message.
  // Drives the small "● Online" indicator under the header and the modal that
  // appears if a peer drops mid-game.
  const [connStatus,   setConnStatus]  = useState('connected'); // 'connected' | 'lost'
  const [connMessage,  setConnMessage] = useState(null);

  // Settings panel only auto-opens for local play.  In online mode the host
  // configured everything in the lobby; mutating STD_PRESET mid-game would
  // immediately desync every guest, so the gear icon is hidden until the game
  // ends.
  const [settingsOpen, setSettingsOpen] = useState(!isOnline);
  const [infoOpen,     setInfoOpen]     = useState(false);
  const [draft,        setDraft]        = useState({
    ...STD_PRESET,
    deckOverrides:     { ...STD_PRESET.deckOverrides },
    cardValues:        { ...STD_PRESET.cardValues },
    disabledGambits:   { ...STD_PRESET.disabledGambits },
    gambitMultipliers: { ...STD_PRESET.gambitMultipliers },
  });

  const gsRef = useRef(gs);
  useEffect(() => { gsRef.current = gs; }, [gs]);


  // ── Animation helpers ───────────────────────────────────────────────────────
  // Timing constants — kept here so it's easy to tune.  Deal/flip durations
  // match the CSS keyframe lengths (420ms each) with a small safety buffer
  // so the .deal class stays applied until the animation has fully ended.
  const ANIM_DEAL_MS    = 420;  // .deal CSS animation length
  const DEAL_HOLD_MS    = 600;  // how long to keep the dealing flag set
  const ANIM_DEAL_OUT_MS = 350; // .dealout CSS animation length
  const LEAVE_HOLD_MS   = 400;  // how long the leaving flag stays — must exceed
                                 // ANIM_DEAL_OUT_MS so neither animation nor
                                 // the card-disappear sound gets cut off
  const RESULT_HOLD_MS  = 2000; // how long the round result stays on screen

  // deal() = slide-in animation + card-appear sound.  Called when fresh cards
  // arrive on the table (game start, after-round deal, dice rescue).
  const deal  = () => {
    if (window.SOUND) window.SOUND.playCardAppear();
    setDealing(true);
    setTimeout(() => setDealing(false), DEAL_HOLD_MS);
  };
  const flash = (t) => { setFlash(t); setTimeout(() => setFlash(null), RESULT_HOLD_MS); };


  // ── Settings management ─────────────────────────────────────────────────────
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

  const cancelSettings = () => {
    setSettingsOpen(false);
    // No game running yet → cancel = back to main menu
    if (screen === 'start') onReturnToMenu();
  };

  const applySettings = () => {
    if (stdCountDraftDeck(draft) < 2) return;
    Object.assign(STD_PRESET, draft);
    STD_PRESET.deckOverrides     = { ...draft.deckOverrides };
    STD_PRESET.cardValues        = { ...draft.cardValues };
    STD_PRESET.disabledGambits   = { ...draft.disabledGambits };
    STD_PRESET.gambitMultipliers = { ...draft.gambitMultipliers };
    setSettingsOpen(false);
    startGame();
  };

  const changeDraft          = (key, val) => setDraft(d => ({ ...d, [key]: val }));
  const changeDeckCount      = (cardId, val) => setDraft(d => ({ ...d, deckOverrides:    { ...d.deckOverrides,    [cardId]: val } }));
  const changeCardValue      = (cardId, val) => setDraft(d => ({ ...d, cardValues:       { ...d.cardValues,       [cardId]: val } }));
  const changeGambitDisabled = (key,   val) => setDraft(d => ({ ...d, disabledGambits:  { ...d.disabledGambits,   [key]:   val } }));
  const changeGambitMult     = (key,   val) => setDraft(d => ({ ...d, gambitMultipliers:{ ...d.gambitMultipliers, [key]:   val } }));
  const applyPreset          = (settings) => setDraft(d => ({ ...d, ...settings }));


  // ── Multiplayer helpers ─────────────────────────────────────────────────────
  // The "players" array is the source of truth for per-player stats AND their
  // own personal deck.  All players begin with the same multiset of cards
  // (the result of stdMkDeck()) but shuffled independently — once a player's
  // deck depletes, they can't play anymore even if other players continue.
  //
  // The top-level gs.lives / streak / blanks / score / usedLastChance /
  // deck / tableCard / handCard fields are a *mirror* of the current player.
  // This lets every resolver, every render path and every shop action keep
  // working unchanged: they just read from gs and the mirror happens to be
  // whoever's turn it is right now.
  //
  // A player is "active" iff placement == null && !dead && !deckEmpty.
  // Game ends when ≤ 1 active players remain (or in SP, the lone player dies
  // / runs out of cards / reaches the score goal).
  //
  // In single-player, players.length === 1 and currentPlayerIdx is always 0.
  const makePlayer = (id) => ({
    id,
    lives:          STD_PRESET.startLives,
    streak:         STD_PRESET.startStreak,
    blanks:         STD_PRESET.startBlanks,
    score:          0,
    usedLastChance: false,
    dead:           false,
    deckEmpty:      false,
    placement:      null, // 1, 2, 3, ... assigned when this player reaches the score goal
    deck:           [],
    tableCard:      null,
    handCard:       null,
  });

  // Update the current player's stats AND mirror them onto gs in one swap.
  const applyToCurrentPlayer = (g, updates) => {
    const next = { ...g, ...updates };
    if (g.players) {
      next.players = g.players.map((p, i) =>
        i === g.currentPlayerIdx ? { ...p, ...updates } : p
      );
    }
    return next;
  };

  // Replace the mirror with player[idx]'s stats, deck, and current cards.
  // Used at turn handoff so the rest of the game reads gs.lives/deck/etc.
  // as the *now-current* player's data.
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

  // "Active" = still playable: hasn't placed, hasn't died, deck not empty.
  const isActive = (p) => p.placement == null && !p.dead && !p.deckEmpty;

  // Find the next active player after fromIdx, wrapping around. -1 if none.
  const nextActiveIdx = (players, fromIdx) => {
    const n = players.length;
    for (let i = 1; i <= n; i++) {
      const j = (fromIdx + i) % n;
      if (isActive(players[j])) return j;
    }
    return -1;
  };

  const activeCount = (players) => players.filter(isActive).length;

  // Final ranking shown on the end screen:
  //   1) Players who reached the score goal, by placement order (1st, 2nd, …)
  //   2) Everyone else, by score descending
  const computeFinalRanking = (players) => {
    const placed   = players.filter(p => p.placement != null).sort((a, b) => a.placement - b.placement);
    const unplaced = players.filter(p => p.placement == null).sort((a, b) => b.score - a.score);
    return [...placed, ...unplaced];
  };


  // ── Deck helpers (now per-player) ───────────────────────────────────────────
  // Take a deck + the previously-shown table/hand cards and produce the next
  // round's cards. Returns deckEmpty=true if the deck can't supply both.
  // Passing null for oldHand/oldTable makes this an *initial* draw.
  const drawNextDeck = (deck, oldHand, oldTable) => {
    let d = [...deck];

    if (oldHand) {
      const oldHandIdx = d.findIndex(c => c.id === oldHand.id);
      if (oldHandIdx !== -1) d.splice(oldHandIdx, 1);
    }
    if (STD_PRESET.infiniteDeck && oldHand && oldTable) {
      d = [...d, oldTable, oldHand];
    }

    // Need at least 2 cards: one to splice as the new table, one for hand.
    if (d.length < 2) return { deck: d, tableCard: null, handCard: null, deckEmpty: true };

    const tableIndex = Math.floor(Math.random() * d.length);
    const tableCard  = d.splice(tableIndex, 1)[0];
    const handIndex  = Math.floor(Math.random() * d.length);
    const handCard   = d[handIndex];
    return { deck: d, tableCard, handCard, deckEmpty: false };
  };

  // Namespace card IDs per player so each player's deck has its own unique
  // card identities — otherwise React keys would collide when the table or
  // hand card swaps between players that drew the "same" card.
  const namespaceDeck = (deck, playerIdx) =>
    deck.map(c => ({ ...c, id: `p${playerIdx}-${c.id}` }));


  // ── Game initialisation ─────────────────────────────────────────────────────
  // Each player gets their own personal deck — same multiset of cards, but
  // each independently shuffled and ID-namespaced.  Initial table/hand are
  // drawn from each player's own deck so everyone starts with a card ready.
  const startGame = () => {
    const isMP        = !!STD_PRESET.multiplayer;
    const playerCount = isMP ? Math.max(2, Math.min(5, STD_PRESET.playerCount || 2)) : 1;
    const baseDeck    = stdMkDeck();

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
      // Mirror of current player (P0 at start)
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
      // Multiplayer fields (present even in single-player for uniform code paths)
      multiplayer:      isMP,
      players,
      currentPlayerIdx: 0,
      nextPlacement:    1, // first player to reach the goal will be ranked 1st
    });

    setSel(EMPTY_SEL); setRevealed(false); setResult(null);
    setShop(false); setNoFlipAnim(false);
    setDiceState({ result: null, guess: null, rollsLeft: 0 });
    setLastChance(false);
    setRoundHistory(Array.from({ length: playerCount }, () => []));
    setWinnerIdx(null);
    deal(); setScreen('game');
  };


  // ── Gambit selection ────────────────────────────────────────────────────────
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


  // ── Commit a gambit ─────────────────────────────────────────────────────────
  // Accepts an optional `selOverride` so the host can replay a remote guest's
  // gambit choice (received via PeerJS) without first writing it into the
  // host's local `sel` state.  Pass-and-play / single-player callers don't
  // supply the argument and the function behaves identically to before.
  //
  // Online guests intercept their own click before any engine work runs and
  // forward `sel` to the host; the host then re-enters here with selOverride
  // set, and the normal codepath produces the canonical resolution.  This
  // means the resolver only ever runs once, on the host, eliminating any
  // possibility of two clients computing different scores from divergent RNG.
  const commit = (selOverride) => {
    if (isOnlineGuest && selOverride === undefined) {
      if (gs && gs.currentPlayerIdx === localPlayerIdx) {
        sendActionToHost('commit', { sel });
      }
      return;
    }
    const useSel = selOverride !== undefined ? selOverride : sel;
    const dg = stdDeriveGambit(useSel);
    if (!dg || result) return;
    if (window.SOUND) window.SOUND.playCardAppear(); // hand card is about to 3D-flip into view
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
      // "Instant death" only applies on a Joker MISS — a winning Joker is a normal win.
      instant: r.isInstant && !r.won && !STD_PRESET.infiniteLives,
    });
    flash(r.won ? 'win' : 'lose');
  };


  // ── Skip a round ────────────────────────────────────────────────────────────
  const doSkip = () => {
    if (isOnlineGuest) {
      if (gs && gs.currentPlayerIdx === localPlayerIdx) sendActionToHost('skip');
      return;
    }
    if (result) return;
    if (window.SOUND) window.SOUND.playCardAppear(); // hand card flips into view
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


  // ── Play a blank card ───────────────────────────────────────────────────────
  const doBlank = () => {
    if (isOnlineGuest) {
      if (gs && gs.currentPlayerIdx === localPlayerIdx) sendActionToHost('blank');
      return;
    }
    if (!gs || (!STD_PRESET.infiniteBlanks && !gs.blanks) || result) return;
    if (window.SOUND) window.SOUND.playCardAppear(); // hand card flips into view
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


  // ── Advance to the next player's turn (deal next cards, hand off) ─────────
  // 1. Advance the OUTGOING player's personal deck → their next ready cards.
  //    If that deck runs out, mark them deckEmpty (they're done).
  // 2. Increment the round counter (global "turn number").
  // 3. (MP) pick the next active player and mirror their stats/deck on gs.
  //    (SP) re-mirror the same player's updated stats/deck.
  // 4. If after step 1+2 there's no active player left (MP), end the game.
  //
  // SP: this is just "draw next" plus the deckempty short-circuit.
  // MP: this is the per-player deck advance + Uno-style turn handoff.
  const advanceTurnDealNext = (sourceGs) => {
    if (window.SOUND) window.SOUND.playCardDisappear();
    setLeaving(true);
    setTimeout(() => {
      let ng = { ...sourceGs };
      const curIdx = ng.currentPlayerIdx;
      const curP   = ng.players[curIdx];
      const isMP   = ng.players.length > 1;

      // 1. Advance outgoing player's deck (if they're still active — a player
      //    who just placed / died doesn't draw replacement cards).
      let outgoingDeckEmpty = false;
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
        outgoingDeckEmpty = drawn.deckEmpty;
      }

      // Compute next active player index for MP now (after deck advance so
      // a freshly-deckEmpty player is already excluded from isActive).
      const nextIdx = isMP ? nextActiveIdx(ng.players, curIdx) : -1;

      // 2. Round counter
      // SP: every turn is its own "round".
      // MP: a round is one full lap — only increment when the turn wraps back
      //     to or past the player who opened this cycle (nextIdx ≤ curIdx).
      if (!isMP) {
        ng.round = ng.round + 1;
      } else if (nextIdx !== -1 && nextIdx <= curIdx) {
        ng.round = ng.round + 1;
      }

      // 3. End-of-game checks
      if (!isMP) {
        // Single-player: deck-out → deckempty screen
        if (outgoingDeckEmpty) {
          const p = ng.players[curIdx];
          endGameTo({ ...ng, lives: p.lives, score: p.score }, 'deckempty');
          return;
        }
      } else {
        // Multiplayer: did the outgoing player going deckEmpty just end the game?
        if (activeCount(ng.players) <= 1) {
          endGameTo(ng, 'win'); // win screen handles MP ranking display
          return;
        }
      }

      // 4. Switch to next active player (MP) or re-mirror current (SP)
      if (isMP) {
        ng = switchToPlayer(ng, nextIdx);
      } else {
        const p = ng.players[curIdx];
        ng = {
          ...ng,
          deck:           p.deck,
          tableCard:      p.tableCard,
          handCard:       p.handCard,
          lives:          p.lives,
          streak:         p.streak,
          blanks:         p.blanks,
          score:          p.score,
          usedLastChance: p.usedLastChance,
        };
      }

      setGs(ng);
      setSel(EMPTY_SEL); setResult(null); setShop(false);
      setLeaving(false);
      setRevealed(false);
      setNoFlipAnim(false);
      deal(); // plays card-appear sound and starts dealIn animation
    }, LEAVE_HOLD_MS);
  };

  // Tear down the round panel/dice/etc. and stop the auto-continue timer.
  // Called before transitioning to a final screen so the useEffect that
  // re-fires continueGame() on a truthy `result` doesn't keep ticking after
  // the game has already ended.
  const endGameTo = (g, nextScreen) => {
    setGs(g);
    setResult(null); setLastChance(false);
    setDiceState({ result: null, guess: null, rollsLeft: 0 });
    setSel(EMPTY_SEL); setShop(false);
    setRevealed(false); setNoFlipAnim(false);
    setLeaving(false);
    setScreen(nextScreen);
  };

  // Mark the current player as permanently dead, then decide:
  //   • SP                         → gameover screen
  //   • MP with ≤ 1 active left    → win screen (ranking handles the outcome)
  //   • MP with 2+ active          → advance the turn to the next active player
  const handleCurrentPlayerDeath = (sourceGs) => {
    const playersAfter = sourceGs.players.map((p, i) =>
      i === sourceGs.currentPlayerIdx
        ? { ...p, dead: true, lives: 0, usedLastChance: true }
        : p
    );
    const gAfter = { ...sourceGs, players: playersAfter, lives: 0, usedLastChance: true };
    const isMP   = playersAfter.length > 1;

    if (!isMP) {
      endGameTo(gAfter, 'gameover'); return;
    }
    if (activeCount(playersAfter) <= 1) {
      endGameTo(gAfter, 'win'); // ranking on the win screen handles "no one won" too
      return;
    }
    advanceTurnDealNext(gAfter);
  };

  // Mark the current player as having reached the score goal (Uno-style):
  // assign next placement, then if ≤ 1 active players remain end the game,
  // otherwise keep playing for 2nd/3rd/etc.
  const handleCurrentPlayerPlaced = (sourceGs) => {
    const placement = sourceGs.nextPlacement || 1;
    const playersAfter = sourceGs.players.map((p, i) =>
      i === sourceGs.currentPlayerIdx ? { ...p, placement } : p
    );
    const gAfter = { ...sourceGs, players: playersAfter, nextPlacement: placement + 1 };

    // First to place is the highlighted "winner" on the win screen
    if (winnerIdx == null) setWinnerIdx(sourceGs.currentPlayerIdx);

    if (activeCount(playersAfter) <= 1) {
      endGameTo(gAfter, 'win');
      return;
    }
    advanceTurnDealNext(gAfter);
  };


  // ── Continue to next round ──────────────────────────────────────────────────
  // Online guests never run this — the host is the single source of truth and
  // pushes the resolved next-state to all clients.  Guarding here keeps the
  // round timer below safe to fire on every client (it's harmless to call but
  // we want to avoid duplicate state writes when state is already mirrored).
  const continueGame = useCallback(() => {
    if (isOnlineGuest) return;

    const currentGs = gsRef.current;
    if (!currentGs) return;

    const isMP = currentGs.players && currentGs.players.length > 1;

    // 1. Score goal reached
    if (STD_PRESET.scoreToBeatEnabled && currentGs.score >= STD_PRESET.scoreToBeat) {
      if (!isMP) {
        // SP: traditional win on first reach
        setScreen('win'); return;
      }
      // MP: Uno-style — assign placement, keep playing if others can still race
      handleCurrentPlayerPlaced(currentGs);
      return;
    }

    // 2. Current player is dying → try Death's Door dice, else eliminate them
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

    // 3. Normal turn advance — advanceTurnDealNext also handles the per-player
    //    deck-empty short-circuit, so no pre-check needed here.
    advanceTurnDealNext(currentGs);
  }, [isOnlineGuest]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Only the host (in online play) and local clients (in offline play) drive
    // the auto-continue timer.  Guests would just push a duplicate state via
    // the broadcast effect and risk a double-advance race.
    if (isOnlineGuest) return;
    if (result) {
      const timer = setTimeout(() => continueGame(), RESULT_HOLD_MS);
      return () => clearTimeout(timer);
    }
  }, [result, continueGame, isOnlineGuest]);


  // ── Death's Door dice ───────────────────────────────────────────────────────
  // Note: the random roll happens on whichever client runs this — for online
  // play that's always the host (guests forward their guess as a message).
  // This guarantees only one RNG result exists per dice attempt and prevents
  // the guest's screen from showing a different number than the host's.
  const rollDice = (guess) => {
    if (isOnlineGuest) {
      if (gs && gs.currentPlayerIdx === localPlayerIdx) sendActionToHost('dice', { guess });
      return;
    }
    const sides = STD_PRESET.deathsDoorDiceSides || 4;
    const r     = Math.floor(Math.random() * sides) + 1;
    setDiceState(prev => ({ ...prev, result: r, guess }));

    setTimeout(() => {
      if (r === guess) {
        // Survive: current player gets 1 life back and burns their last-chance,
        // then the turn advances normally (in MP, hands off to the next alive player).
        // We compute the updated state synchronously and pass it to
        // advanceTurnDealNext directly so we never read a stale gsRef.
        const updated = applyToCurrentPlayer(gsRef.current, { lives: 1, usedLastChance: true });
        setDiceState({ result: null, guess: null, rollsLeft: 0 });
        setLastChance(false);
        setGs(updated);
        // advanceTurnDealNext owns the deckempty short-circuit (SP) and the
        // per-player deck-out + game-end checks (MP), so we just delegate.
        advanceTurnDealNext(updated);
      } else {
        // Compute new attempt count outside setState to keep the updater pure.
        const newLeft = (diceState.rollsLeft ?? 1) - 1;
        if (newLeft <= 0) {
          // Out of dice attempts → current player is permanently dead.
          // handleCurrentPlayerDeath decides between gameover / win / advance.
          setDiceState({ result: null, guess: null, rollsLeft: 0 });
          setLastChance(false);
          handleCurrentPlayerDeath(gsRef.current);
        } else {
          setDiceState({ result: null, guess: null, rollsLeft: newLeft });
        }
      }
    }, 2800);
  };


  // ── Shop actions ────────────────────────────────────────────────────────────
  // Each player shops with their OWN streak (the mirror reflects current player).
  // Online guests forward intent to the host; the host resolves and broadcasts
  // the new state so every client's wallet stays consistent.
  const buyLife = () => {
    if (isOnlineGuest) {
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
    if (isOnlineGuest) {
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


  // ── Online sync (peerSession integration) ────────────────────────────────────
  // Everything in this block is a no-op when peerSession is null, so the file
  // remains 100% backwards compatible with local pass-and-play.  When online:
  //
  //   • The host runs the engine exactly like local play.  After every
  //     meaningful state change, a snapshot is broadcast to every guest.
  //   • Guests never run the engine.  Their state mirrors whatever the host
  //     broadcasts; their UI buttons dispatch "action" messages instead.
  //
  // Action messages from guests are validated against gs.currentPlayerIdx
  // (only the active player's commands are honoured) and then routed to the
  // same local handlers the host would call.  Per-action `selOverride`
  // semantics let the host replay a guest's gambit choice without first
  // writing it into the host's local React state.
  // ────────────────────────────────────────────────────────────────────────────

  // Map of fromPeerId → playerIdx, populated by online/lobby.js before mount.
  const playerMapRef = useRef(
    (isOnline && peerSession.playerMap) ? peerSession.playerMap : {}
  );

  // Ref carrying the latest action handlers — re-assigned every render so the
  // message handler (registered once) always sees fresh closures.
  const actionsRef = useRef({});
  actionsRef.current = { commit, doSkip, doBlank, buyLife, buyBlank, rollDice };

  // Helper used by guest-side UI handlers to forward intent to the host.
  const sendActionToHost = useCallback((kind, payload) => {
    if (!isOnlineGuest) return;
    try {
      peerSession.send(Object.assign({ type: 'game-action', kind }, payload || {}));
    } catch (err) {
      console.warn('[online guest] send failed', err);
    }
  }, [isOnlineGuest, peerSession]);

  // Host: auto-start the game on mount (gs is still null at this point).  We
  // gate via a ref so React Strict Mode's double-invoke can't double-start.
  const onlineHostStartedRef = useRef(false);
  useEffect(() => {
    if (!isOnlineHost) return;
    if (onlineHostStartedRef.current) return;
    onlineHostStartedRef.current = true;
    startGame();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnlineHost]);

  // Host: broadcast a full state snapshot whenever anything UI-relevant moves.
  // We include the animation flags (dealing/leaving) and the table-flash so
  // guests stay frame-accurate without needing to re-derive any of it locally.
  // `sel` is deliberately NOT broadcast — each device keeps its own private
  // gambit picker; revealing the active player's hovered choice to spectators
  // would defeat the point of a secret gambit.
  useEffect(() => {
    if (!isOnlineHost || !gs) return;
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
    isOnlineHost, peerSession,
    gs, result, lastChance, diceState,
    revealed, shop, screen, leaving, dealing,
    tableFlash, roundHistory, winnerIdx,
  ]);

  // State snapshot ref — keeps a live mirror of every field the host might
  // need to re-send to a late-joining guest (see 'game-ready' below).  Updated
  // every render so the host's message handler always reads fresh values.
  const liveStateRef = useRef({});
  liveStateRef.current = {
    gs, result, lastChance, diceState,
    revealed, shop, screen, leaving, dealing,
    tableFlash, roundHistory, winnerIdx,
  };

  // Guest: receive state snapshots from the host and mirror them locally.
  // Also send a "ready" message on mount so the host re-broadcasts current
  // state — this closes the race window where the very first game-state
  // could arrive before our message handler was registered.
  useEffect(() => {
    if (!isOnlineGuest) return;
    peerSession.onMessage = (msg) => {
      if (!msg || typeof msg !== 'object' || msg.type !== 'game-state') return;

      // Mirror everything in one batch so React renders once per snapshot.
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
    };
    // Ask host for fresh state in case we mounted after their initial broadcast.
    try { peerSession.send({ type: 'game-ready' }); } catch (e) {}
    return () => {
      if (peerSession) peerSession.onMessage = null;
    };
  }, [isOnlineGuest, peerSession]);

  // Host: receive action messages from guests (with turn validation) plus
  // 'game-ready' pings from guests who just mounted and want a fresh state
  // snapshot.  All bouncebacks (state syncs) happen via the broadcast effect
  // above as a result of setGs etc.
  useEffect(() => {
    if (!isOnlineHost) return;
    peerSession.onMessage = (msg, fromPeerId) => {
      if (!msg || typeof msg !== 'object') return;

      // Late-joining guest — re-send current state directly to them.
      if (msg.type === 'game-ready') {
        const s = liveStateRef.current;
        if (s.gs) {
          peerSession.sendTo(fromPeerId, Object.assign({ type: 'game-state' }, s));
        }
        return;
      }

      if (msg.type !== 'game-action') return;
      const senderIdx = playerMapRef.current[fromPeerId];
      const curGs     = gsRef.current;
      if (senderIdx == null || !curGs)                 return;
      if (senderIdx !== curGs.currentPlayerIdx)        return; // not their turn
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
    return () => {
      if (peerSession) peerSession.onMessage = null;
    };
  }, [isOnlineHost, peerSession]);

  // Both roles: detect a peer dropping and surface it as a non-fatal overlay.
  // We don't auto-bounce to the menu because the player may want to read the
  // final state of the game; the modal includes a manual "Return to Menu".
  useEffect(() => {
    if (!isOnline) return;
    peerSession.onPeerLeave = (peerInfo) => {
      setConnStatus('lost');
      setConnMessage(isOnlineGuest
        ? 'The host has left the game.'
        : 'A player has left the game (' + ((peerInfo && peerInfo.name) || 'unknown') + ').');
    };
    return () => {
      if (peerSession) peerSession.onPeerLeave = null;
    };
  }, [isOnline, isOnlineGuest, peerSession]);

  // On unmount, tear the connection down for good (covers Main Menu / refresh).
  useEffect(() => {
    return () => {
      if (isOnline && peerSession) {
        try { peerSession.destroy(); } catch (e) {}
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Guest-only: play card SFX off state transitions, since the original
  // explicit sound calls live inside action handlers that guests don't run.
  // We watch the same flags the host's handlers would set (revealed, leaving,
  // dealing) and fire the matching sound on the rising edge of each.
  const prevSoundRef = useRef({ revealed: false, leaving: false, dealing: false });
  useEffect(() => {
    if (!isOnlineGuest) return;
    const prev = prevSoundRef.current;
    if (window.SOUND) {
      if (revealed && !prev.revealed) window.SOUND.playCardAppear();
      if (leaving  && !prev.leaving)  window.SOUND.playCardDisappear();
      if (dealing  && !prev.dealing)  window.SOUND.playCardAppear();
    }
    prevSoundRef.current = { revealed, leaving, dealing };
  }, [isOnlineGuest, revealed, leaving, dealing]);

  // Online: whenever the active player changes away from this device, clear
  // the local gambit selection so the next time it's our turn the picker
  // starts empty.  (Host doesn't need this — its advanceTurnDealNext already
  // calls setSel(EMPTY_SEL) directly.)
  const currentPlayerIdx = gs ? gs.currentPlayerIdx : null;
  useEffect(() => {
    if (!isOnlineGuest) return;
    if (currentPlayerIdx == null) return;
    if (currentPlayerIdx !== localPlayerIdx) {
      setSel(EMPTY_SEL);
    }
  }, [isOnlineGuest, currentPlayerIdx, localPlayerIdx]);

  // Convenience flag used to gate action buttons.  True for all local play.
  // In online play it requires that the snapshot has actually loaded (gs set)
  // AND that the current player index matches this device.
  const isMyTurn = !isOnline || (gs != null && gs.currentPlayerIdx === localPlayerIdx);


  // ── Settings props ──────────────────────────────────────────────────────────
  const settingsProps = {
    draft, onChange: changeDraft,
    onChangeDeckCount: changeDeckCount,
    onChangeCardValue: changeCardValue,
    onChangeGambitDisabled: changeGambitDisabled,
    onChangeGambitMult: changeGambitMult,
    onApplyPreset: applyPreset,
    onApply: applySettings,
    onCancel: cancelSettings,
    onReturnToMenu,
  };


  // ── Screen: Start (settings panel auto-opens here) ─────────────────────────
  if (screen === 'start') {
    return e('div', { className: 'app' },
      settingsOpen && e(StdSettingsPanel, { ...settingsProps, gameActive: false }),
      // Backdrop placeholder shown if settings is somehow closed before play
      e('div', { className: 'start' },
        e('div', { className: 'sigil' }, '⛧'),
        e('h1',  { className: 'start-title' }, 'Devil\'s', e('br'), 'Gambit'),
        e('div', { style: {
          fontFamily:"'Cinzel',serif", fontSize:'var(--font-xs)',
          letterSpacing:'0.12em', textTransform:'uppercase',
          color: 'var(--secondary-color)', marginBottom: '4px',
        } }, 'Standard Mode'),
        e('div', { className: 'sep' }),
        e('button', { className: 'btn-start',   onClick: openSettings }, '⚙ Options'),
        e('button', { className: 'btn-options', onClick: onReturnToMenu,
          style: { marginTop:'6px', opacity:0.7 } }, '← Main Menu'),
      )
    );
  }


  // ── Helpers for MP end-screen ranking ───────────────────────────────────────
  // Returns a chip-friendly status string for a player at the end of an MP game.
  const playerEndStatus = (p) => {
    if (p.placement != null) {
      const m = p.placement === 1 ? '🥇 1st' : p.placement === 2 ? '🥈 2nd' : p.placement === 3 ? '🥉 3rd' : `#${p.placement}`;
      return { label: m, cls: 'mp-sb-placed', medal: p.placement };
    }
    if (p.dead)      return { label: '☠ Dead',         cls: 'mp-sb-dead' };
    if (p.deckEmpty) return { label: '🂠 Deck Empty',  cls: 'mp-sb-dead' };
    return { label: '— Last Hand',   cls: 'mp-sb-last' }; // still alive but never placed
  };


  // ── Screen: Win ─────────────────────────────────────────────────────────────
  if (screen === 'win') {
    const mpWin   = gs?.players && gs.players.length > 1;
    const ranking = mpWin ? computeFinalRanking(gs.players) : [];
    // In MP: the "spotlight" player is whoever placed 1st (winnerIdx);
    // if no one placed (everyone died), fall back to the top-ranked.
    const winnerP    = mpWin && winnerIdx != null ? gs.players[winnerIdx] : null;
    const fallbackP  = !winnerP && ranking[0];
    const spotlightP = winnerP || fallbackP || null;
    const spotIdx    = spotlightP ? gs.players.indexOf(spotlightP) : -1;
    const winScore   = spotlightP ? spotlightP.score : (gs?.score || 0);
    const showSpot   = mpWin && spotIdx >= 0;
    const showSpotPlaced = winnerP && winnerP.placement === 1;

    return e('div', { className: 'app' },
      settingsOpen && !isOnline && e(StdSettingsPanel, { ...settingsProps, gameActive: false }),
      e('div', { className: 'gameover' },
        e('div', { className: 'victory-sigil' }, '★'),
        e('h2',  { className: 'gottl-victory' }, 'The Devil Yields'),
        e('p',   { className: 'gosub-victory' }, mpWin
          ? (showSpotPlaced
              ? 'Player ' + (spotIdx + 1) + ' claims the night'
              : showSpot
                ? 'Player ' + (spotIdx + 1) + ' stands tallest'
                : 'The night ends')
          : 'Your soul remains your own'),
        e('div', { className: 'gobox' },
          e('div', { className: 'golbl' },   mpWin
            ? (showSpot ? 'Player ' + (spotIdx + 1) + ' — Top Score' : 'Final Standings')
            : 'Score Reached'),
          e('div', { className: 'goscore' }, winScore.toLocaleString()),
          e('div', { className: 'godet' },
            'Survived ' + (gs?.round || 1) + ' rounds' +
            (STD_PRESET.scoreToBeatEnabled
              ? ' · Goal: ' + (STD_PRESET.scoreToBeat || 0).toLocaleString()
              : ''))
        ),
        // MP: full ranking — placed players (1st/2nd/3rd) first, then the rest by score
        mpWin && e('div', { className: 'mp-scoreboard' },
          ranking.map(p => {
            const idx = gs.players.indexOf(p);
            const st  = playerEndStatus(p);
            return e('div', {
              key: p.id,
              className: 'mp-sb-row ' + st.cls + (idx === spotIdx ? ' mp-sb-winner' : ''),
            },
              e('span', { className: 'mp-sb-name' },
                e('b', { className: 'mp-sb-medal' }, st.label),
                ' · Player ' + (idx + 1)
              ),
              e('span', { className: 'mp-sb-score' }, p.score.toLocaleString() + ' pts')
            );
          })
        ),
        // "Play Again" / settings are only meaningful in local play; online
        // restart would require rebuilding the lobby and re-synchronising every
        // peer's STD_PRESET, so we just route back to the menu.
        !isOnline && e('button', { className: 'btn-start',   onClick: startGame },    'Play Again'),
        !isOnline && e('button', { className: 'btn-options', onClick: openSettings }, '⚙ Options'),
        e('button', { className: 'btn-options', onClick: onReturnToMenu,
          style: { marginTop:'6px', opacity:0.7 } }, isOnline ? 'Leave Room' : '← Main Menu')
      )
    );
  }


  // ── Screen: Game Over ───────────────────────────────────────────────────────
  // (Reached only in SP — MP games end through the win screen which displays
  //  the full ranking including dead / unplaced players.)
  if (screen === 'gameover') {
    return e('div', { className: 'app' },
      settingsOpen && !isOnline && e(StdSettingsPanel, { ...settingsProps, gameActive: false }),
      e('div', { className: 'gameover' },
        e('div', { className: 'goskull' }, '💀'),
        e('h2',  { className: 'gottl' }, 'Your Soul is Forfeit'),
        e('p',   { className: 'gosub' }, 'The Devil Wins Again'),
        e('div', { className: 'gobox' },
          e('div', { className: 'golbl' },   'Final Score'),
          e('div', { className: 'goscore' }, (gs?.score || 0).toLocaleString()),
          e('div', { className: 'godet' },   'Survived ' + (gs?.round || 1) + ' rounds')
        ),
        !isOnline && e('button', { className: 'btn-start',   onClick: startGame },    'Play Again'),
        !isOnline && e('button', { className: 'btn-options', onClick: openSettings }, '⚙ Options'),
        e('button', { className: 'btn-options', onClick: onReturnToMenu,
          style: { marginTop:'6px', opacity:0.7 } }, isOnline ? 'Leave Room' : '← Main Menu')
      )
    );
  }


  // ── Screen: Deck Empty ──────────────────────────────────────────────────────
  if (screen === 'deckempty') return e('div', { className: 'app' },
    settingsOpen && !isOnline && e(StdSettingsPanel, { ...settingsProps, gameActive: false }),
    e('div', { className: 'gameover' },
      e('div', { className: 'deckend-sigil' }, '🂠'),
      e('h2',  { className: 'gottl-gold' }, 'The Deck Runs Dry'),
      e('p',   { className: 'gosub-gold' }, 'The Devil\'s hand is spent'),
      e('div', { className: 'gobox' },
        e('div', { className: 'golbl' },   'Final Score'),
        e('div', { className: 'goscore' }, (gs?.score || 0).toLocaleString()),
        e('div', { className: 'godet' },   'Survived ' + (gs?.round || 1) + ' rounds · Soul still intact')
      ),
      !isOnline && e('button', { className: 'btn-start',   onClick: startGame },    'Play Again'),
      !isOnline && e('button', { className: 'btn-options', onClick: openSettings }, '⚙ Options'),
      e('button', { className: 'btn-options', onClick: onReturnToMenu,
        style: { marginTop:'6px', opacity:0.7 } }, isOnline ? 'Leave Room' : '← Main Menu')
    )
  );


  // ── Screen: Game ────────────────────────────────────────────────────────────
  // Online guests render a waiting placeholder until the host's first state
  // snapshot arrives.  Online hosts almost never see this — startGame() fires
  // synchronously on mount, populating gs in the same React tick.
  if (!gs) {
    return e('div', { className: 'app' },
      e('div', { className: 'gameover' },
        e('div', { className: 'deckend-sigil' }, '⛧'),
        e('h2',  { className: 'gottl-gold' }, isOnlineGuest ? 'Waiting for the host…' : 'Dealing cards…'),
        e('p',   { className: 'gosub-gold' }, isOnlineGuest ? 'The first hand is on its way' : 'One moment'),
        e('button', { className: 'btn-options', onClick: onReturnToMenu,
          style: { marginTop: '20px', opacity: 0.7 } }, '← Main Menu')
      )
    );
  }

  // Connection-lost overlay (online only) — the game state stays visible
  // underneath so the player can read what happened before deciding to leave.
  const connectionLostModal = (isOnline && connStatus === 'lost')
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

  const derived       = stdDeriveGambit(sel);
  const canCommit     = !!derived && !result && !stdIsGambitDisabled(derived);

  const tc       = gs.tableCard, hc = gs.handCard;
  const isHighTC = HIGH.has(tc.value);
  const isLowTC  = ['2','3','4','5','6','7'].includes(tc.value);
  const tcCat    = tc.value === 'JOKER' ? 'Joker' : tc.value === 'A' ? 'Ace' : isHighTC ? 'High' : isLowTC ? 'Low' : '—';

  // Per-player history shown in the Ledger:
  //   • Local pass-and-play MP → show whoever's turn it is (device is shared).
  //   • Online MP             → show THIS device's player history regardless of turn.
  //   • Single-player         → player 0 (the only history).
  const historyIdx = isOnline ? localPlayerIdx : (gs ? gs.currentPlayerIdx : 0);
  const visibleHistory = roundHistory[historyIdx] || [];

  return e('div', { className: 'app' },
    // Settings can only be opened in local play (changes mid-game would
    // desync online clients).  Info panel is always available.
    settingsOpen && !isOnline && e(StdSettingsPanel, { ...settingsProps, gameActive: true }),
    infoOpen && e(StdInfoPanel, { gs, history: visibleHistory, onClose: () => setInfoOpen(false) }),
    connectionLostModal,

    e('div', { className: 'game-wrap' },
      // Header
      e('div', { className: 'hdr' },
        e('span', { className: 'hdr-round' }, 'Round ' + gs.round),
        e('span', { className: 'hdr-brand' },
          // Settings gear is hidden during online play — host already configured
          // the room in the lobby and any change would diverge from guests.
          !isOnline && e('button', { className: 'hdr-gear', onClick: openSettings, title: 'Options' }, '⚙ Options'),
          e('button', { className: 'hdr-gear', onClick: () => setInfoOpen(true), title: 'View Deck & History' }, '🕮 History'),
        ),
        e('span', { className: 'hdr-score' },
          e('span', null,
            'Score: ',
            e('b', null, gs.score.toLocaleString()),
            STD_PRESET.scoreToBeatEnabled && e('span', { className: 'hdr-score-goal' }, ' / ' + STD_PRESET.scoreToBeat.toLocaleString())
          )
        )
      ),

      // Online connection bar — tiny status strip below the header.  Tells the
      // player whether they're connected and which seat they're playing.
      isOnline && e('div', { className: 'conn-bar' },
        e('span', {
          className: 'conn-dot' + (connStatus === 'lost' ? ' conn-lost' : ' conn-ok'),
        }, '●'),
        e('span', { className: 'conn-text' },
          connStatus === 'lost' ? 'Disconnected'
            : (isOnlineHost ? 'Hosting' : 'Connected') + ' · You are P' + ((localPlayerIdx ?? 0) + 1)
        ),
        !isMyTurn && connStatus === 'connected' && e('span', { className: 'conn-waiting' },
          ' · Waiting for P' + ((gs.currentPlayerIdx ?? 0) + 1) + '…'),
      ),

      // Opponent strip (MP only) — compact view of every player's standing,
      // including the current player. One pill per player with lives, score,
      // and a status badge (current turn / placed / dead / deck-empty).
      gs.players && gs.players.length > 1 && e('div', { className: 'opp-strip' },
        gs.players.map((p, i) => {
          const isCur     = i === gs.currentPlayerIdx;
          const placed    = p.placement != null;
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
            : 'P' + (i + 1);
          return e('div', { key: p.id, className: cls },
            e('span', { className: 'opp-tag' }, statusIcon),
            // Lives — hide for placed/eliminated for compactness
            !eliminated && !placed && e('span', { className: 'opp-stat' },
              e('span', { className: 'opp-icon' }, '♥'),
              STD_PRESET.infiniteLives ? '∞' : p.lives
            ),
            // Score — always shown so the leaderboard is visible at a glance
            e('span', { className: 'opp-stat opp-score' }, p.score.toLocaleString())
          );
        })
      ),

      // Stats bar
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

      // Card table — keys on card.id force a fresh component instance whenever
      // the card swaps out, so the prior round's .revealed → not-revealed
      // change can't trigger a stray flip-back animation on the new card.
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

      // Action area — every interactive control is additionally gated by
      // isMyTurn in online mode, so spectating players can watch but can't act.
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

// ── Register on window so router can detect / mount ──────────────────────────
window.StandardApp = StandardApp;
// ──────────────────────────────────────────────────────────────────────────────
