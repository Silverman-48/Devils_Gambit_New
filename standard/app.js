// ── Standard Mode — App orchestrator ──────────────────────────────────────────
//
// Self-contained React component for the Standard game (single-player + local
// pass-and-play).  Owns its own state, gameplay flow, and screens.  Reads
// STD_PRESET / STANDARD_PRESETS only.  Registers itself on the window so the
// router can mount it dynamically and detect its presence (graceful degradation
// if this file is deleted).
//
// Online multiplayer lives entirely in online/app.js — this file is pure
// local play and has zero awareness of peers or networking.
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
  const [tableFlash,   setFlash]        = useState(null);
  const [noFlipAnim,   setNoFlipAnim]   = useState(false);
  const [diceState,    setDiceState]    = useState({ result: null, guess: null, rollsLeft: 0 });
  const [lastChance,   setLastChance]   = useState(false);
  const [roundHistory, setRoundHistory] = useState([]);
  const [winnerIdx,    setWinnerIdx]    = useState(null); // MP: index of winning player on the win screen

  // Settings panel auto-opens on Start so the player picks a preset before play.
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [infoOpen,     setInfoOpen]     = useState(false);
  const [draft,        setDraft]        = useState({
    ...STD_PRESET,
    deckOverrides:     { ...STD_PRESET.deckOverrides },
    cardValues:        { ...STD_PRESET.cardValues },
    disabledGambits:   { ...STD_PRESET.disabledGambits },
    gambitMultipliers: { ...STD_PRESET.gambitMultipliers },
  });
  // Remembered across panel close/reopen so the highlighted preset card
  // doesn't snap back to Default every time the user reopens the panel.
  const [presetId,     setPresetId]     = useState(STANDARD_PRESETS[0]?.id ?? null);

  const gsRef = useRef(gs);
  useEffect(() => { gsRef.current = gs; }, [gs]);


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
      deckOverrides:     { ...STD_PRESET.deckOverrides },
      cardValues:        { ...STD_PRESET.cardValues },
      disabledGambits:   { ...STD_PRESET.disabledGambits },
      gambitMultipliers: { ...STD_PRESET.gambitMultipliers },
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


  // ── Multiplayer helpers (per-player decks, Uno-style turn handoff) ──────────
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


  // ── Deck helpers (per-player) ───────────────────────────────────────────────
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


  // ── Game initialisation ─────────────────────────────────────────────────────
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
      multiplayer:      isMP,
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
  };


  // ── Advance to the next player's turn (deal next cards, hand off) ──────────
  const advanceTurnDealNext = (sourceGs) => {
    if (window.SOUND) window.SOUND.playCardDisappear();
    setLeaving(true);
    setTimeout(() => {
      let ng = { ...sourceGs };
      const curIdx = ng.currentPlayerIdx;
      const curP   = ng.players[curIdx];
      const isMP   = ng.players.length > 1;

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

      const nextIdx = isMP ? nextActiveIdx(ng.players, curIdx) : -1;

      // SP: every turn is its own "round".
      // MP: a round is one full lap — only increment when the turn wraps back
      //     to or past the player who opened this cycle (nextIdx ≤ curIdx).
      if (!isMP) {
        ng.round = ng.round + 1;
      } else if (nextIdx !== -1 && nextIdx <= curIdx) {
        ng.round = ng.round + 1;
      }

      if (!isMP) {
        if (outgoingDeckEmpty) {
          const p = ng.players[curIdx];
          endGameTo({ ...ng, lives: p.lives, score: p.score }, 'deckempty');
          return;
        }
      } else {
        if (activeCount(ng.players) <= 1) {
          endGameTo(ng, 'win');
          return;
        }
      }

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
    const isMP   = playersAfter.length > 1;

    if (!isMP) {
      endGameTo(gAfter, 'gameover'); return;
    }
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


  // ── Continue to next round ──────────────────────────────────────────────────
  const continueGame = useCallback(() => {
    const currentGs = gsRef.current;
    if (!currentGs) return;

    const isMP = currentGs.players && currentGs.players.length > 1;

    // 1. Score goal reached
    if (STD_PRESET.scoreToBeatEnabled && currentGs.score >= STD_PRESET.scoreToBeat) {
      if (!isMP) {
        setScreen('win'); return;
      }
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
    onPresetIdChange: setPresetId,
  };


  // ── Screen: Start (settings panel auto-opens here) ─────────────────────────
  if (screen === 'start') {
    return e('div', { className: 'app' },
      settingsOpen && e(StdSettingsPanel, { ...settingsProps, gameActive: false }),
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


  // ── Helpers for MP end-screen ranking ───────────────────────────────────────
  const playerEndStatus = (p) => {
    if (p.placement != null) {
      const m = p.placement === 1 ? '🥇 1st' : p.placement === 2 ? '🥈 2nd' : p.placement === 3 ? '🥉 3rd' : `#${p.placement}`;
      return { label: m, cls: 'mp-sb-placed', medal: p.placement };
    }
    if (p.dead)      return { label: '☠ Dead',         cls: 'mp-sb-dead' };
    if (p.deckEmpty) return { label: '🂠 Deck Empty',  cls: 'mp-sb-dead' };
    return { label: '— Last Hand',   cls: 'mp-sb-last' };
  };


  // ── Screen: Win ─────────────────────────────────────────────────────────────
  if (screen === 'win') {
    const mpWin   = gs?.players && gs.players.length > 1;
    const ranking = mpWin ? computeFinalRanking(gs.players) : [];
    const winnerP    = mpWin && winnerIdx != null ? gs.players[winnerIdx] : null;
    const fallbackP  = !winnerP && ranking[0];
    const spotlightP = winnerP || fallbackP || null;
    const spotIdx    = spotlightP ? gs.players.indexOf(spotlightP) : -1;
    const winScore   = spotlightP ? spotlightP.score : (gs?.score || 0);
    const showSpot   = mpWin && spotIdx >= 0;
    const showSpotPlaced = winnerP && winnerP.placement === 1;

    const endScreenHistory = roundHistory[gs?.currentPlayerIdx || 0] || [];
    return e('div', { className: 'app' },
      settingsOpen && e(StdSettingsPanel, { ...settingsProps, gameActive: false, hideMainMenuButton: true }),
      infoOpen && e(StdInfoPanel, { gs, history: endScreenHistory, onClose: () => setInfoOpen(false) }),
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
  const canCommit     = !!derived && !result && !stdIsGambitDisabled(derived);

  const tc       = gs.tableCard, hc = gs.handCard;
  const isHighTC = HIGH.has(tc.value);
  const isLowTC  = ['2','3','4','5','6','7'].includes(tc.value);
  const tcCat    = tc.value === 'JOKER' ? 'Joker' : tc.value === 'A' ? 'Ace' : isHighTC ? 'High' : isLowTC ? 'Low' : '—';

  // Per-player history: whoever's turn it is (device is shared in pass-and-play).
  const visibleHistory = roundHistory[gs.currentPlayerIdx] || [];

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

      // Opponent strip (MP only) — compact at 3+ players to keep names + stats readable.
      gs.players && gs.players.length > 1 && e('div', {
        className: 'opp-strip' + (gs.players.length >= 3 ? ' opp-strip-compact' : ''),
      },
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
            : 'P' + (i + 1);
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
