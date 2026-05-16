// ── Standard Mode — App orchestrator ──────────────────────────────────────────
//
// Self-contained React component for the Standard game.  Owns its own state,
// gameplay flow, and screens.  Reads STD_PRESET / STANDARD_PRESETS only.
// Registers itself on the window so the router can mount it dynamically and
// detect its presence (graceful degradation if this file is deleted).
//
// Load order: ... → standard/components.js → standard/app.js → ... → router.js
// ──────────────────────────────────────────────────────────────────────────────


function StandardApp({ onReturnToMenu }) {
  const { useState, useEffect, useCallback, useRef } = React;
  const e = React.createElement;

  // ── Screen + core state ─────────────────────────────────────────────────────
  const [screen,       setScreen]      = useState('start');
  const [gs,           setGs]          = useState(null);
  const [sel,          setSel]         = useState(EMPTY_SEL);
  const [revealed,     setRevealed]    = useState(false);
  const [result,       setResult]      = useState(null);
  const [shop,         setShop]        = useState(false);
  const [dealing,      setDealing]     = useState(false);
  const [tableFlash,   setFlash]       = useState(null);
  const [noFlipAnim,   setNoFlipAnim]  = useState(false);
  const [diceState,    setDiceState]   = useState({ result: null, guess: null, rollsLeft: 0 });
  const [lastChance,   setLastChance]  = useState(false);
  const [roundHistory, setRoundHistory] = useState([]);

  const [settingsOpen, setSettingsOpen] = useState(true); // open at first to let player tweak before play
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
  const deal  = () => { setDealing(true);  setTimeout(() => setDealing(false), 550); };
  const flash = (t) => { setFlash(t); setTimeout(() => setFlash(null), 2000); };


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


  // ── Game initialisation ─────────────────────────────────────────────────────
  const startGame = () => {
    const initialDeck = shfl(stdMkDeck());
    const d           = [...initialDeck];

    const tableIndex = Math.floor(Math.random() * d.length);
    const tableCard  = d.splice(tableIndex, 1)[0];

    const handIndex = Math.floor(Math.random() * d.length);
    const handCard  = d[handIndex];

    setGs({
      deck: d,
      tableCard,
      handCard,
      lives:      STD_PRESET.startLives,
      startLives: STD_PRESET.startLives,
      streak:     STD_PRESET.startStreak,
      blanks:     STD_PRESET.startBlanks,
      score:      0,
      round:      1,
      usedLastChance: false,
    });

    setSel(EMPTY_SEL); setRevealed(false); setResult(null);
    setShop(false); setNoFlipAnim(false);
    setDiceState({ result: null, guess: null, rollsLeft: 0 });
    setLastChance(false);
    setRoundHistory([]);
    deal(); setScreen('game');
  };


  // ── Draw the next round ─────────────────────────────────────────────────────
  const drawNext = (g) => {
    let d = [...g.deck];

    const oldHandIdx = d.findIndex(c => c.id === g.handCard.id);
    if (oldHandIdx !== -1) d.splice(oldHandIdx, 1);

    if (STD_PRESET.infiniteDeck) d = [...d, g.tableCard, g.handCard];

    const tableIndex = Math.floor(Math.random() * d.length);
    const tableCard  = d.splice(tableIndex, 1)[0];

    const handIndex = Math.floor(Math.random() * d.length);
    const handCard  = d[handIndex];

    return {
      ...g,
      deck: d,
      tableCard,
      handCard,
      round: g.round + 1,
    };
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
    setRevealed(true);

    const r = stdResolveGambit(gs, dg);

    setGs(g => {
      setRoundHistory(h => [{
        type: 'round', round: g.round,
        tableCard: g.tableCard, handCard: g.handCard,
        gambit: dg.label,
        outcome: r.won ? 'win' : r.isInstant ? 'instant' : 'lose',
        pts: r.pts, score: r.newScore,
        lives: r.newLives, blanks: g.blanks, streak: r.newStreak,
      }, ...h]);
      return { ...g, score: r.newScore, streak: r.newStreak, lives: r.newLives };
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
    setRevealed(true);
    const r = stdResolveSkip(gs);

    setGs(g => ({ ...g, lives: r.newLives, streak: r.newStreak, score: g.score + r.pts }));
    setRoundHistory(h => [{
      type: 'round', round: gs.round,
      tableCard: gs.tableCard, handCard: gs.handCard,
      gambit: '— Skip —',
      outcome: 'skip', pts: r.pts, score: gs.score + r.pts,
      lives: r.newLives, blanks: gs.blanks, streak: r.newStreak,
    }, ...h]);
    setResult({ won: false, pts: r.pts, action: 'skip' });
    flash('lose');
  };


  // ── Play a blank card ───────────────────────────────────────────────────────
  const doBlank = () => {
    if (!gs || (!STD_PRESET.infiniteBlanks && !gs.blanks) || result) return;
    setRevealed(true);
    const r = stdResolveBlank(gs);

    setGs(g => ({ ...g, blanks: r.newBlanks, score: g.score + r.pts, lives: r.newLives, streak: r.newStreak }));
    setRoundHistory(h => [{
      type: 'round', round: gs.round,
      tableCard: gs.tableCard, handCard: gs.handCard,
      gambit: '🛡️ Blank',
      outcome: 'blank', pts: r.pts, score: gs.score + r.pts,
      lives: r.newLives, blanks: r.newBlanks, streak: r.newStreak,
    }, ...h]);
    setResult({ won: true, pts: r.pts, action: 'blank' });
    flash('win');
  };


  // ── Continue to next round ──────────────────────────────────────────────────
  const continueGame = useCallback(() => {
    const currentGs = gsRef.current;
    if (!currentGs) return;

    if (STD_PRESET.scoreToBeatEnabled && currentGs.score >= STD_PRESET.scoreToBeat) {
      setScreen('win'); return;
    }

    if (!STD_PRESET.infiniteLives && currentGs.lives <= 0) {
      if (!currentGs.usedLastChance && STD_PRESET.deathsDoorRolls > 0) {
        setResult(null);
        setDiceState({ result: null, guess: null, rollsLeft: STD_PRESET.deathsDoorRolls });
        setLastChance(true);
        return;
      }
      setScreen('gameover'); return;
    }

    if (!STD_PRESET.infiniteDeck && currentGs.deck.length < 3) { setScreen('deckempty'); return; }

    setNoFlipAnim(true);
    setRevealed(false);
    setTimeout(() => {
      const ng = drawNext(currentGs);
      setGs(ng);
      setSel(EMPTY_SEL); setResult(null); setShop(false);
      setNoFlipAnim(false);
      deal();
    }, 32);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (result) {
      const timer = setTimeout(() => continueGame(), 2000);
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
        setGs(g => ({ ...g, lives: 1, usedLastChance: true }));
        setDiceState({ result: null, guess: null, rollsLeft: 0 });
        setLastChance(false);
        setNoFlipAnim(true);
        setRevealed(false);
        setTimeout(() => {
          if (!STD_PRESET.infiniteDeck && gsRef.current.deck.length < 3) { setScreen('deckempty'); return; }
          const ng = drawNext(gsRef.current);
          setGs(ng);
          setSel(EMPTY_SEL); setResult(null); setShop(false);
          setNoFlipAnim(false);
          deal();
        }, 32);
      } else {
        setDiceState(prev => {
          const newLeft = (prev.rollsLeft ?? 1) - 1;
          if (newLeft <= 0) {
            setGs(g => ({ ...g, usedLastChance: true }));
            setScreen('gameover');
            return { result: null, guess: null, rollsLeft: 0 };
          }
          return { result: null, guess: null, rollsLeft: newLeft };
        });
      }
    }, 2800);
  };


  // ── Shop actions ────────────────────────────────────────────────────────────
  const buyLife = () => {
    if (gs.streak >= STD_PRESET.costLife) {
      const newStreak = gs.streak - STD_PRESET.costLife;
      const newLives  = gs.lives + STD_PRESET.shopLifeAmount;
      setGs(g => ({ ...g, streak: newStreak, lives: newLives }));
      setRoundHistory(h => [{
        type: 'shop', round: gs.round,
        item: `♥ Health Potion (+${STD_PRESET.shopLifeAmount})`, cost: STD_PRESET.costLife,
        score: gs.score, lives: newLives, blanks: gs.blanks, streak: newStreak,
      }, ...h]);
    }
  };

  const buyBlank = () => {
    if (gs.streak >= STD_PRESET.costBlank) {
      const newStreak = gs.streak - STD_PRESET.costBlank;
      const newBlanks = gs.blanks + STD_PRESET.shopBlankAmount;
      setGs(g => ({ ...g, streak: newStreak, blanks: newBlanks }));
      setRoundHistory(h => [{
        type: 'shop', round: gs.round,
        item: `🛡️ Blank Card (+${STD_PRESET.shopBlankAmount})`, cost: STD_PRESET.costBlank,
        score: gs.score, lives: gs.lives, blanks: newBlanks, streak: newStreak,
      }, ...h]);
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


  // ── Screen: Win ─────────────────────────────────────────────────────────────
  if (screen === 'win') return e('div', { className: 'app' },
    settingsOpen && e(StdSettingsPanel, { ...settingsProps, gameActive: false }),
    e('div', { className: 'gameover' },
      e('div', { className: 'victory-sigil' }, '★'),
      e('h2',  { className: 'gottl-victory' }, 'The Devil Yields'),
      e('p',   { className: 'gosub-victory' }, 'Your soul remains your own'),
      e('div', { className: 'gobox' },
        e('div', { className: 'golbl' },   'Score Reached'),
        e('div', { className: 'goscore' }, (gs?.score || 0).toLocaleString()),
        e('div', { className: 'godet' },
          'Survived ' + (gs?.round || 1) + ' rounds · Goal of ' + (STD_PRESET.scoreToBeat || 0).toLocaleString() + ' reached')
      ),
      e('button', { className: 'btn-start',   onClick: startGame },    'Play Again'),
      e('button', { className: 'btn-options', onClick: openSettings }, '⚙ Options'),
      e('button', { className: 'btn-options', onClick: onReturnToMenu,
        style: { marginTop:'6px', opacity:0.7 } }, '← Main Menu')
    )
  );


  // ── Screen: Game Over ───────────────────────────────────────────────────────
  if (screen === 'gameover') return e('div', { className: 'app' },
    settingsOpen && e(StdSettingsPanel, { ...settingsProps, gameActive: false }),
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
      e('button', { className: 'btn-options', onClick: openSettings }, '⚙ Options'),
      e('button', { className: 'btn-options', onClick: onReturnToMenu,
        style: { marginTop:'6px', opacity:0.7 } }, '← Main Menu')
    )
  );


  // ── Screen: Deck Empty ──────────────────────────────────────────────────────
  if (screen === 'deckempty') return e('div', { className: 'app' },
    settingsOpen && e(StdSettingsPanel, { ...settingsProps, gameActive: false }),
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
      e('button', { className: 'btn-options', onClick: openSettings }, '⚙ Options'),
      e('button', { className: 'btn-options', onClick: onReturnToMenu,
        style: { marginTop:'6px', opacity:0.7 } }, '← Main Menu')
    )
  );


  // ── Screen: Game ────────────────────────────────────────────────────────────
  const derived       = stdDeriveGambit(sel);
  const canCommit     = !!derived && !result && !stdIsGambitDisabled(derived);

  const tc       = gs.tableCard, hc = gs.handCard;
  const isHighTC = HIGH.has(tc.value);
  const isLowTC  = ['2','3','4','5','6','7'].includes(tc.value);
  const tcCat    = tc.value === 'JOKER' ? 'Joker' : tc.value === 'A' ? 'Ace' : isHighTC ? 'High' : isLowTC ? 'Low' : '—';

  return e('div', { className: 'app' },
    settingsOpen && e(StdSettingsPanel, { ...settingsProps, gameActive: true }),
    infoOpen     && e(StdInfoPanel,     { gs, history: roundHistory, onClose: () => setInfoOpen(false) }),

    e('div', { className: 'game-wrap' },
      // Header
      e('div', { className: 'hdr' },
        e('span', { className: 'hdr-round', onClick: () => setInfoOpen(true), title: 'View Deck & History' }, 'Round ' + gs.round),
        e('span', { className: 'hdr-brand' },
          e('button', { className: 'hdr-gear', onClick: openSettings, title: 'Options' }, 'Devil\'s Gambit ⚙'),
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
          e(CardFace, { card: tc, animate: dealing }),
          e('span', { className: 'cpts' }, tc.numValue + ' pts · ' + tcCat)
        ),
        e('div', { className: 'cslot' },
          e(HandCard, { card: hc, revealed, animate: dealing, noAnim: noFlipAnim }),
          e('span', { className: 'cpts' }, revealed ? (hc.numValue + ' pts') : '?')
        )
      ),

      // Action area
      e('div', { className: 'content-area' },
        e('div', null,
          e('div', { className: 'actions', style: { gridTemplateColumns: 'repeat(4,minmax(0,1fr))' } },
            e('button', {
              className: 'btnmain',
              onClick: commit,
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
          (result || lastChance || !shop) && e(StdGambitPanel, { sel, onToggle: toggleSel, derived, gs, disabled: !!result || lastChance, result, lastChance, diceState, onRoll: rollDice }),
          shop && !result && !lastChance && e(StdShop, { gs, buyLife, buyBlank })
        )
      )
    )
  );
}

// ── Register on window so router can detect / mount ──────────────────────────
window.StandardApp = StandardApp;
// ──────────────────────────────────────────────────────────────────────────────
