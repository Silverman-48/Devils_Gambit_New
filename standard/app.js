// ── Standard Mode — App orchestrator ──────────────────────────────────────────
//
// Self-contained React component for the Standard game (single-player only).
// Owns its own state, gameplay flow, and screens.  Reads STD_PRESET /
// STANDARD_PRESETS only.  Registers itself on the window so the router can
// mount it dynamically and detect its presence (graceful degradation if this
// file is deleted).
//
// Online multiplayer lives entirely in online/app.js — this file is pure
// local play and has zero awareness of peers or networking.  Pass-and-play
// multi-seat play used to live here too but was removed; for multi-player
// games, the Online lobby in online/app.js / online/lobby.js is the path.
//
// Load order: ... → standard/components.js → standard/app.js → ... → router.js
// ──────────────────────────────────────────────────────────────────────────────


function StandardApp({ onReturnToMenu }) {
  const { useState, useEffect, useCallback, useRef } = React;
  const e = React.createElement;

  // ── Screen + core state ─────────────────────────────────────────────────────
  const [screen,       setScreen]       = useState('start');
  const [gs,           setGs]           = useState(null);
  const [sel,          setSel]          = useState(EMPTY_SEL);
  const [revealed,     setRevealed]     = useState(false);
  const [result,       setResult]       = useState(null);
  const [shop,         setShop]         = useState(false);
  const [dealing,      setDealing]      = useState(false);
  const [leaving,      setLeaving]      = useState(false);
  const [fxExpanded,   setFxExpanded]   = useState(false);
  const [tableFlash,   setFlash]        = useState(null);
  const [noFlipAnim,   setNoFlipAnim]   = useState(false);
  const [diceState,    setDiceState]    = useState({ result: null, guess: null, rollsLeft: 0 });
  const [lastChance,   setLastChance]   = useState(false);
  const [roundHistory, setRoundHistory] = useState([]);

  // Settings panel auto-opens on Start so the player picks a preset before play.
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [infoOpen,     setInfoOpen]     = useState(false);
  const [draft,        setDraft]        = useState({
    ...STD_PRESET,
    deckOverrides:      { ...STD_PRESET.deckOverrides },
    cardValues:         { ...STD_PRESET.cardValues },
    disabledGambits:    { ...STD_PRESET.disabledGambits },
    gambitMultipliers:  { ...STD_PRESET.gambitMultipliers },
    cardEffectsAllowed:      { ...(STD_PRESET.cardEffectsAllowed      || {}) },
    cardEffectWeights:       { ...(STD_PRESET.cardEffectWeights       || {}) },
    cardEffectCooldowns:     { ...(STD_PRESET.cardEffectCooldowns     || {}) },
    cardEffectMaxActivations:{ ...(STD_PRESET.cardEffectMaxActivations|| {}) },
  });
  // Remembered across panel close/reopen so the highlighted preset card
  // doesn't snap back to Default every time the user reopens the panel.
  // STD_PRESET._presetId persists the last-applied preset id across component
  // remounts (main menu → back → reopen).  Falls back to the first preset only
  // when no preset has ever been applied this session.
  const [presetId,     setPresetId]     = useState(STD_PRESET._presetId ?? STANDARD_PRESETS[0]?.id ?? null);

  const gsRef = useRef(gs);
  useEffect(() => { gsRef.current = gs; }, [gs]);

  // Auto-dismiss the card-effect description overlay whenever a new card arrives.
  const tcId = gs?.tableCard?.id;
  useEffect(() => { setFxExpanded(false); }, [tcId]);


  // ── Animation helpers ───────────────────────────────────────────────────────
  // Timing constants — kept here so it's easy to tune.  Deal/flip durations
  // match the CSS keyframe lengths (420ms each) with a small safety buffer
  // so the .deal class stays applied until the animation has fully ended.
  const ANIM_DEAL_MS     = 420;  // .deal CSS animation length
  const DEAL_HOLD_MS     = 600;  // how long to keep the dealing flag set
  const ANIM_DEAL_OUT_MS = 350;  // .dealout CSS animation length
  const LEAVE_HOLD_MS    = 400;  // how long the leaving flag stays — must exceed
                                  // ANIM_DEAL_OUT_MS so neither animation nor
                                  // the card-disappear sound gets cut off
  const RESULT_HOLD_MS   = 2000; // how long the round result stays on screen

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
      deckOverrides:      { ...STD_PRESET.deckOverrides },
      cardValues:         { ...STD_PRESET.cardValues },
      disabledGambits:    { ...STD_PRESET.disabledGambits },
      gambitMultipliers:  { ...STD_PRESET.gambitMultipliers },
      cardEffectsAllowed:      { ...(STD_PRESET.cardEffectsAllowed      || {}) },
      cardEffectWeights:       { ...(STD_PRESET.cardEffectWeights       || {}) },
      cardEffectCooldowns:     { ...(STD_PRESET.cardEffectCooldowns     || {}) },
      cardEffectMaxActivations:{ ...(STD_PRESET.cardEffectMaxActivations|| {}) },
    });
    setSettingsOpen(true);
  };

  const cancelSettings = () => {
    setSettingsOpen(false);
    if (screen === 'start') onReturnToMenu();
  };

  const applySettings = () => {
    if (stdCountDraftDeck(draft) < 2) return;
    Object.assign(STD_PRESET, draft);
    STD_PRESET.deckOverrides      = { ...draft.deckOverrides };
    STD_PRESET.cardValues         = { ...draft.cardValues };
    STD_PRESET.disabledGambits    = { ...draft.disabledGambits };
    STD_PRESET.gambitMultipliers  = { ...draft.gambitMultipliers };
    STD_PRESET.cardEffectsAllowed      = { ...(draft.cardEffectsAllowed      || {}) };
    STD_PRESET.cardEffectWeights       = { ...(draft.cardEffectWeights       || {}) };
    STD_PRESET.cardEffectCooldowns     = { ...(draft.cardEffectCooldowns     || {}) };
    STD_PRESET.cardEffectMaxActivations= { ...(draft.cardEffectMaxActivations|| {}) };
    setSettingsOpen(false);
    startGame();
  };

  const changeDraft          = (key, val) => setDraft(d => ({ ...d, [key]: val }));
  const changeDeckCount      = (cardId, val) => setDraft(d => ({ ...d, deckOverrides:    { ...d.deckOverrides,    [cardId]: val } }));
  const changeCardValue      = (cardId, val) => setDraft(d => ({ ...d, cardValues:       { ...d.cardValues,       [cardId]: val } }));
  const changeGambitDisabled = (key,   val) => setDraft(d => ({ ...d, disabledGambits:  { ...d.disabledGambits,   [key]:   val } }));
  const changeGambitMult     = (key,   val) => setDraft(d => ({ ...d, gambitMultipliers:{ ...d.gambitMultipliers, [key]:   val } }));
  const applyPreset          = (settings) => setDraft(d => ({ ...d, ...settings }));


  // ── Player state ────────────────────────────────────────────────────────────
  // Standard mode is now single-player only.  Pass-and-play has been removed —
  // for multi-seat play, use the Online lobby (online/app.js) which runs its
  // own component with networked turn handling.  The `players` array is kept
  // (size 1) so the round-history indexing and the existing per-player
  // bookkeeping continue to work without churn; `currentPlayerIdx` is always 0.
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
    // Immunity: round number from which the next-effect block is active.
    // Bought via the shop; consumed by the first effect that would change
    // the player's stats while immunityFromRound <= current round.
    immunityFromRound: null,
  });

  // Mirrors `updates` into both the top-level gs and the (single) player slot
  // so renderers reading either source stay in sync.
  const applyToCurrentPlayer = (g, updates) => {
    const next = { ...g, ...updates };
    if (g.players) {
      next.players = g.players.map((p, i) =>
        i === g.currentPlayerIdx ? { ...p, ...updates } : p
      );
    }
    return next;
  };

  const isActive = (p) => p.placement == null && !p.dead && !p.deckEmpty;


  // ── Deck helpers (per-player) ───────────────────────────────────────────────
  // nextRound = the round number the drawn cards will be played in, forwarded
  // to rollCardEffect so it can apply the cardEffectMinRound gate.
  const drawNextDeck = (deck, oldHand, oldTable, nextRound, effectState) => {
    let d = [...deck];

    if (oldHand) {
      const oldHandIdx = d.findIndex(c => c.id === oldHand.id);
      if (oldHandIdx !== -1) d.splice(oldHandIdx, 1);
    }
    if (STD_PRESET.infiniteDeck && oldHand && oldTable) {
      // When recycling, strip any old effect off oldTable so the new draw
      // can roll a fresh one (or none) — effects shouldn't persist on a card
      // that returns to the deck.
      const cleanTable = { ...oldTable }; delete cleanTable.effect;
      d = [...d, cleanTable, oldHand];
    }

    if (d.length < 2) return { deck: d, tableCard: null, handCard: null, deckEmpty: true };

    const tableIndex = Math.floor(Math.random() * d.length);
    let   tableCard  = d.splice(tableIndex, 1)[0];
    const handIndex  = Math.floor(Math.random() * d.length);
    const handCard   = d[handIndex];

    // Roll an optional card effect for the new table card.  No-op when the
    // feature is disabled or the chance roll fails.
    if (typeof rollCardEffect === 'function') {
      const eff = rollCardEffect(false, nextRound, effectState || {});
      if (eff) tableCard = { ...tableCard, effect: eff };
    }
    return { deck: d, tableCard, handCard, deckEmpty: false };
  };

  // ── Game initialisation ─────────────────────────────────────────────────────
  const startGame = () => {
    const baseDeck = shfl(stdMkDeck());
    const drawn    = drawNextDeck(baseDeck, null, null, 1, { cooldowns: {}, counts: {} });
    const p0 = {
      ...makePlayer(1),
      deck:      drawn.deck,
      tableCard: drawn.tableCard,
      handCard:  drawn.handCard,
      deckEmpty: drawn.deckEmpty,
    };
    const players = [p0];

    setGs({
      deck:              p0.deck,
      tableCard:         p0.tableCard,
      handCard:          p0.handCard,
      lives:             p0.lives,
      startLives:        STD_PRESET.startLives,
      streak:            p0.streak,
      blanks:            p0.blanks,
      score:             p0.score,
      round:             1,
      usedLastChance:    p0.usedLastChance,
      players,
      currentPlayerIdx:     0,
      immunityFromRound:    p0.immunityFromRound,
      // Per-effect cooldown and activation-count tracking (reset each new game).
      effectCooldowns:      {},
      effectActivationCounts: {},
    });

    setSel(EMPTY_SEL); setRevealed(false); setResult(null);
    setShop(false); setNoFlipAnim(false);
    setDiceState({ result: null, guess: null, rollsLeft: 0 });
    setLastChance(false);
    setRoundHistory([[]]);
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


  // ── Card-effect helper (single-player) ─────────────────────────────────────
  // Called from commit/doSkip/doBlank AFTER the normal resolution to apply
  // any boon/curse riding on the table card.  Uses gsRef to read the just-
  // written stats so it composes correctly with the outcome that just landed.
  // Appends a one-line "effect" entry to roundHistory so the player sees it.
  const applyTableCardEffectSP = (action, derived, won, pts) => {
    const cur = gsRef.current;
    if (!cur || !cur.tableCard || !cur.tableCard.effect) return;
    if (typeof applyCardEffectSP !== 'function') return;
    const eff = cur.tableCard.effect;
    const curIdx = cur.currentPlayerIdx ?? 0;
    const player = {
      lives:          cur.lives,  streak: cur.streak,
      blanks:         cur.blanks, score:  cur.score,
      lastGambitKey:    cur.lastGambitKey    || null,
      lockedGambitKey:  cur.lockedGambitKey  || null,
      immunityFromRound: cur.immunityFromRound ?? null,
    };
    const res = applyCardEffectSP(eff, player, { action, derived, won, pts, round: cur.round });
    // Update stats only when the effect actually fired (log set) or was blocked.
    // When effect is a no-op for this ctx (e.g. Hex on a win), stats stay unchanged
    // but we still record the card in history so the player sees the effect existed.
    if (res.log) {
      // Also update per-effect cooldown and activation-count tracking.
      const firedId     = eff.id;
      const firedType   = eff.type;
      const cooldownAmt = (STD_PRESET.cardEffectCooldowns || {})[firedId] || 0;
      setGs(g => {
        const base = applyToCurrentPlayer(g, {
          lives:             res.player.lives,
          streak:            res.player.streak,
          blanks:            res.player.blanks,
          score:             res.player.score,
          lockedGambitKey:   res.player.lockedGambitKey ?? null,
          immunityFromRound: res.player.immunityFromRound ?? null,
        });
        // Decrement cooldowns of other same-type effects (they advance toward eligibility).
        const newCooldowns = { ...(g.effectCooldowns || {}) };
        for (const d of (window.CARD_EFFECTS_DEFS || [])) {
          if (d.type === firedType && d.id !== firedId && (newCooldowns[d.id] || 0) > 0)
            newCooldowns[d.id] = Math.max(0, newCooldowns[d.id] - 1);
        }
        // Apply this effect's configured cooldown.
        if (cooldownAmt > 0) newCooldowns[firedId] = cooldownAmt;
        else delete newCooldowns[firedId];
        // Increment total activation count.
        const newCounts = { ...(g.effectActivationCounts || {}) };
        newCounts[firedId] = (newCounts[firedId] || 0) + 1;
        return { ...base, effectCooldowns: newCooldowns, effectActivationCounts: newCounts };
      });
    }
    setRoundHistory(h => h.map((arr, i) => i === curIdx ? [{
      type:       'effect',
      round:      cur.round,
      effectName: eff.name,
      effectIcon: eff.icon,
      effectType: eff.type,
      effectDesc: res.blocked
        ? '🛡 Blocked by Immunity'
        : eff.desc,
      blocked:    !!res.blocked,
      // Stats reflect post-effect state; if no-op they equal the pre-effect values.
      score:      res.player.score,
      lives:      res.player.lives,
      blanks:     res.player.blanks,
      streak:     res.player.streak,
    }, ...arr] : arr));
  };


  // ── Commit a gambit ─────────────────────────────────────────────────────────
  const commit = () => {
    const dg = stdDeriveGambit(sel);
    if (!dg || result) return;
    if (window.SOUND) window.SOUND.playCardAppear(); // hand card is about to 3D-flip into view
    setRevealed(true);

    const r = stdResolveGambit(gs, dg);

    setGs(g => {
      setRoundHistory(h => h.map((arr, idx) =>
        idx === g.currentPlayerIdx ? [{
          type: 'round', round: g.round,
          tableCard: g.tableCard, handCard: g.handCard,
          gambit: dg.desc,
          outcome: r.won ? 'win' : r.isInstant ? 'instant' : 'lose',
          pts: r.pts, score: r.newScore,
          lives: r.newLives, blanks: g.blanks, streak: r.newStreak,
        }, ...arr] : arr
      ));
      return applyToCurrentPlayer(g, {
        score: r.newScore, streak: r.newStreak, lives: r.newLives,
        lastGambitKey:   stdGambitKey(dg),  // remembered for gambit_lock effect
        lockedGambitKey: null,              // clear any prior lock on commit
      });
    });

    setResult({
      won: r.won, pts: r.pts, action: 'gambit',
      // "Instant death" only applies on a Joker MISS — a winning Joker is a normal win.
      instant: r.isInstant && !r.won && !STD_PRESET.infiniteLives,
    });
    flash(r.won ? 'win' : 'lose');
    // Card effect fires after the normal outcome (gsRef now reflects the win/loss).
    setTimeout(() => applyTableCardEffectSP('gambit', dg, r.won, r.pts), 0);
  };


  // ── Skip a round ────────────────────────────────────────────────────────────
  const doSkip = () => {
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
    setTimeout(() => applyTableCardEffectSP('skip', null, false, r.pts), 0);
  };


  // ── Play a blank card ───────────────────────────────────────────────────────
  const doBlank = () => {
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
    setTimeout(() => applyTableCardEffectSP('blank', null, true, r.pts), 0);
  };


  // ── Advance to the next round (deal next cards) ────────────────────────────
  const advanceTurnDealNext = (sourceGs) => {
    if (window.SOUND) window.SOUND.playCardDisappear();
    setLeaving(true);
    setTimeout(() => {
      let ng       = { ...sourceGs };
      const curIdx = ng.currentPlayerIdx;
      const curP   = ng.players[curIdx];

      // SP: every turn is its own round.
      ng.round = ng.round + 1;

      // Draw the next card pair.  ng.round is the round these cards will be
      // played in — passed through so rollCardEffect can apply the min-round gate.
      let outgoingDeckEmpty = false;
      if (isActive(curP)) {
        const fxState = { cooldowns: ng.effectCooldowns || {}, counts: ng.effectActivationCounts || {} };
        const drawn = drawNextDeck(curP.deck, curP.handCard, curP.tableCard, ng.round, fxState);
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

      if (outgoingDeckEmpty) {
        const p = ng.players[curIdx];
        endGameTo({ ...ng, lives: p.lives, score: p.score }, 'deckempty');
        return;
      }

      const p = ng.players[curIdx];
      ng = {
        ...ng,
        deck:              p.deck,
        tableCard:         p.tableCard,
        handCard:          p.handCard,
        lives:             p.lives,
        streak:            p.streak,
        blanks:            p.blanks,
        score:             p.score,
        usedLastChance:    p.usedLastChance,
        immunityFromRound: p.immunityFromRound ?? null,
      };

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
    endGameTo(gAfter, 'gameover');
  };

  // ── Continue to next round ──────────────────────────────────────────────────
  const continueGame = useCallback(() => {
    const currentGs = gsRef.current;
    if (!currentGs) return;

    // 1. Score goal reached
    if (STD_PRESET.scoreToBeatEnabled && currentGs.score >= STD_PRESET.scoreToBeat) {
      setScreen('win'); return;
    }

    // 2. Player is dying → try Death's Door dice, else end the game
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

    // 3. Normal turn advance
    advanceTurnDealNext(currentGs);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (result) {
      const timer = setTimeout(() => continueGame(), RESULT_HOLD_MS);
      return () => clearTimeout(timer);
    }
  }, [result, continueGame]);


  // ── Death's Door dice ───────────────────────────────────────────────────────
  const rollDice = (guess) => {
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


  // ── Shop actions ────────────────────────────────────────────────────────────
  const buyLife = () => {
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

  // Immunity charge — blocks the NEXT card effect (boon or curse) that would
  // change this player's stats.  Always arms for the FOLLOWING round so the
  // effect currently riding on the table card (about to fire on commit) is
  // not eligible — prevents using the shop as a get-out-of-jail card for
  // the curse you just saw drawn.
  const buyImmunity = () => {
    const cost = STD_PRESET.costImmunity ?? 2;
    if (!gs || gs.streak < cost) return;
    if (gs.immunityFromRound != null) return;  // already armed
    const newStreak = gs.streak - cost;
    const armRound  = gs.round + 1;
    setGs(g => applyToCurrentPlayer(g, { streak: newStreak, immunityFromRound: armRound }));
    setRoundHistory(h => h.map((arr, idx) =>
      idx === gs.currentPlayerIdx ? [{
        type: 'shop', round: gs.round,
        item: '🛡 Immunity (next effect)', cost,
        score: gs.score, lives: gs.lives, blanks: gs.blanks, streak: newStreak,
      }, ...arr] : arr
    ));
  };


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
    initialPresetId:  presetId,
    onPresetIdChange: (id) => { setPresetId(id); STD_PRESET._presetId = id; },
  };


  // ── Screen: Start (settings panel auto-opens here) ─────────────────────────
  if (screen === 'start') {
    return e('div', { className: 'app' },
      settingsOpen && e(StdSettingsPanel, { ...settingsProps, gameActive: false, hideMainMenuButton: true }),
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
          style: { opacity: 0.7 } }, '← Main Menu'),
      )
    );
  }


  // ── Screen: Win ─────────────────────────────────────────────────────────────
  if (screen === 'win') {
    const endScreenHistory = roundHistory[0] || [];
    return e('div', { className: 'app' },
      settingsOpen && e(StdSettingsPanel, { ...settingsProps, gameActive: false, hideMainMenuButton: true }),
      infoOpen && e(StdInfoPanel, { gs, history: endScreenHistory, onClose: () => setInfoOpen(false) }),
      e('div', { className: 'gameover' },
        e('div', { className: 'victory-sigil' }, '★'),
        e('h2',  { className: 'gottl-victory' }, 'The Devil Yields'),
        e('p',   { className: 'gosub-victory' }, 'Your soul remains your own'),
        e('div', { className: 'gobox' },
          e('div', { className: 'golbl' },   'Score Reached'),
          e('div', { className: 'goscore' }, (gs?.score || 0).toLocaleString()),
          e('div', { className: 'godet' },
            'Survived ' + (gs?.round || 1) + ' rounds' +
            (STD_PRESET.scoreToBeatEnabled
              ? ' · Goal: ' + (STD_PRESET.scoreToBeat || 0).toLocaleString()
              : ''))
        ),
        e('button', { className: 'btn-start',   onClick: startGame },    'Play Again'),
        e('div', { className: 'endscreen-row' },
          e('button', { className: 'btn-options', onClick: openSettings }, '⚙ Options'),
          e('button', { className: 'btn-options', onClick: () => setInfoOpen(true) }, '≡ History'),
        ),
        e('button', { className: 'btn-options', onClick: onReturnToMenu,
          style: { opacity: 0.7 } }, '← Main Menu')
      )
    );
  }


  // ── Screen: Game Over (SP only) ─────────────────────────────────────────────
  if (screen === 'gameover') {
    const gameoverHistory = roundHistory[0] || [];
    return e('div', { className: 'app' },
      settingsOpen && e(StdSettingsPanel, { ...settingsProps, gameActive: false, hideMainMenuButton: true }),
      infoOpen && e(StdInfoPanel, { gs, history: gameoverHistory, onClose: () => setInfoOpen(false) }),
      e('div', { className: 'gameover' },
        e('div', { className: 'goskull' }, '💀'),
        e('h2',  { className: 'gottl' }, 'Your Soul is Forfeit'),
        e('p',   { className: 'gosub' }, 'The Devil Wins Again'),
        e('div', { className: 'gobox' },
          e('div', { className: 'golbl' },   'Final Score'),
          e('div', { className: 'goscore' }, (gs?.score || 0).toLocaleString()),
          e('div', { className: 'godet' },   'Survived ' + (gs?.round || 1) + ' rounds')
        ),
        e('button', { className: 'btn-start',   onClick: startGame },    'Play Again'),
        e('div', { className: 'endscreen-row' },
          e('button', { className: 'btn-options', onClick: openSettings }, '⚙ Options'),
          e('button', { className: 'btn-options', onClick: () => setInfoOpen(true) }, '≡ History'),
        ),
        e('button', { className: 'btn-options', onClick: onReturnToMenu,
          style: { opacity: 0.7 } }, '← Main Menu')
      )
    );
  }


  // ── Screen: Deck Empty (SP only) ────────────────────────────────────────────
  if (screen === 'deckempty') {
    const deckemptyHistory = roundHistory[0] || [];
    return e('div', { className: 'app' },
      settingsOpen && e(StdSettingsPanel, { ...settingsProps, gameActive: false, hideMainMenuButton: true }),
      infoOpen && e(StdInfoPanel, { gs, history: deckemptyHistory, onClose: () => setInfoOpen(false) }),
      e('div', { className: 'gameover' },
        e('div', { className: 'deckend-sigil' }, '🂠'),
        e('h2',  { className: 'gottl-gold' }, 'The Deck Runs Dry'),
        e('p',   { className: 'gosub-gold' }, 'The Devil\'s hand is spent'),
        e('div', { className: 'gobox' },
          e('div', { className: 'golbl' },   'Final Score'),
          e('div', { className: 'goscore' }, (gs?.score || 0).toLocaleString()),
          e('div', { className: 'godet' },   'Survived ' + (gs?.round || 1) + ' rounds · Soul still intact')
        ),
        e('button', { className: 'btn-start',   onClick: startGame },    'Play Again'),
        e('div', { className: 'endscreen-row' },
          e('button', { className: 'btn-options', onClick: openSettings }, '⚙ Options'),
          e('button', { className: 'btn-options', onClick: () => setInfoOpen(true) }, '≡ History'),
        ),
        e('button', { className: 'btn-options', onClick: onReturnToMenu,
          style: { opacity: 0.7 } }, '← Main Menu')
      )
    );
  }


  // ── Screen: Game ────────────────────────────────────────────────────────────
  if (!gs) return null;  // defensive — startGame should set gs before screen='game'

  const derived       = stdDeriveGambit(sel);
  const isGambitLocked = !!(gs.lockedGambitKey && derived && stdGambitKey(derived) === gs.lockedGambitKey);
  const canCommit     = !!derived && !result && !stdIsGambitDisabled(derived) && !isGambitLocked;

  const tc       = gs.tableCard, hc = gs.handCard;
  const isHighTC = HIGH.has(tc.value);
  const isLowTC  = ['2','3','4','5','6','7'].includes(tc.value);
  const tcCat    = tc.value === 'JOKER' ? 'Joker' : tc.value === 'A' ? 'Ace' : isHighTC ? 'High' : isLowTC ? 'Low' : '—';

  const visibleHistory = roundHistory[0] || [];

  return e('div', { className: 'app' },
    settingsOpen && e(StdSettingsPanel, { ...settingsProps, gameActive: true }),
    infoOpen     && e(StdInfoPanel,     { gs, history: visibleHistory, onClose: () => setInfoOpen(false) }),

    e('div', { className: 'game-wrap' },
      e('div', { className: 'hdr' },
        e('span', { className: 'hdr-round' }, 'Round ' + gs.round),
        e('span', { className: 'hdr-brand' },
          e('button', { className: 'hdr-gear', onClick: openSettings, title: 'Options' }, '⚙ Options'),
          e('button', { className: 'hdr-gear', onClick: () => setInfoOpen(true), title: 'View Deck & History' }, '≡ History'),
        ),
        e('span', { className: 'hdr-score' },
          e('span', null,
            'Score: ',
            e('b', null, gs.score.toLocaleString()),
            STD_PRESET.scoreToBeatEnabled && e('span', { className: 'hdr-score-goal' }, ' / ' + STD_PRESET.scoreToBeat.toLocaleString())
          )
        )
      ),

      // Stats bar
      e('div', { className: 'stats' },
        e('div', { className: 'stat' },
          e('span', { className: 'stat-lbl' }, 'Lives'),
          STD_PRESET.infiniteLives
            ? e('span', { className: 'stat-val stat-inf' }, '∞')
            : e('span', { className: 'stat-val' }, gs.lives + (gs.immunityFromRound != null ? ' 🛡' : ''))
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
          e(CardFace, {
            key: tc.id, card: tc, animate: dealing, leaving,
            onFxClick: tc.effect ? () => setFxExpanded(v => !v) : undefined,
            fxExpanded: !!tc.effect && fxExpanded,
          }),
          e('span', { className: 'cpts' }, tc.numValue + ' pts · ' + tcCat)
        ),
        e('div', { className: 'cslot' },
          e(HandCard, { key: hc.id, card: hc, revealed, animate: dealing, noAnim: noFlipAnim, leaving }),
          e('span', { className: 'cpts' }, revealed ? (hc.numValue + ' pts') : '?')
        )
      ),

      // Action area
      e('div', { className: 'content-area' },
        e('div', null,
          e('div', { className: 'actions', style: { gridTemplateColumns: 'repeat(4,minmax(0,1fr))' } },
            e('button', {
              className: 'btnmain',
              onClick: () => commit(),
              disabled: !canCommit || shop || !!result || lastChance,
            }, 'Set'),
            e('button', { className: 'btnsec', onClick: doBlank,
              disabled: !STD_PRESET.blanksEnabled || (!STD_PRESET.infiniteBlanks && !gs.blanks) || shop || !!result || lastChance,
            }, 'Blank'),
            e('button', { className: 'btnsec', onClick: doSkip,
              disabled: !STD_PRESET.skipsEnabled || shop || !!result || lastChance,
            }, 'Skip'),
            e('button', { className: 'btnsec', onClick: () => setShop(s => !s),
              disabled: !!result || lastChance,
            }, shop ? 'Close Shop' : 'Shop')
          ),
          (result || lastChance || !shop) && e(StdGambitPanel, {
            sel, onToggle: toggleSel, derived, gs,
            disabled: !!result || lastChance,
            result, lastChance, diceState, onRoll: rollDice,
            lockedGambitKey: gs.lockedGambitKey || null,
          }),
          shop && !result && !lastChance && e(StdShop, { gs, buyLife, buyBlank, buyImmunity })
        )
      )
    )
  );
}

// ── Register on window so router can detect / mount ──────────────────────────
window.StandardApp = StandardApp;
// ──────────────────────────────────────────────────────────────────────────────
