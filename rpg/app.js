// ── RPG Mode — App orchestrator ───────────────────────────────────────────────
//
// Self-contained React component for the RPG combat game.  Owns its own state,
// gameplay flow, screens, enemy roster, and rush mode.  Reads RPG_PRESET /
// RPG_PRESETS / ENEMY_PRESETS only.  Registers as window.RpgApp.
//
// Load order:  ... → rpg/components.js → rpg/app.js → ... → router.js
// ──────────────────────────────────────────────────────────────────────────────


function RpgApp({ onReturnToMenu }) {
  const { useState, useEffect, useCallback, useRef } = React;
  const e = React.createElement;

  // ── Build initial roster on first mount ─────────────────────────────────────
  // This populates RPG_PRESET.enemyRoster and mirrors the first enemy's stats
  // into the top-level fields so the engine has sensible values immediately.
  const initRoster = () => {
    RPG_PRESET.enemyRoster = {};
    ENEMY_PRESETS.forEach(p => { RPG_PRESET.enemyRoster[p.id] = { ...p.settings }; });
    RPG_PRESET.selectedEnemyId = ENEMY_PRESETS[0].id;
    RPG_PRESET.rushMode  = false;
    RPG_PRESET.rushQueue = [];
    Object.assign(RPG_PRESET, RPG_PRESET.enemyRoster[RPG_PRESET.selectedEnemyId]);
  };
  // Init once per mount (when this is the first time RpgApp mounts in this session).
  if (!RPG_PRESET.enemyRoster || !Object.keys(RPG_PRESET.enemyRoster).length) initRoster();


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
  const [enemySlain,   setEnemySlain]  = useState(false);

  const [settingsOpen, setSettingsOpen] = useState(true);
  const [infoOpen,     setInfoOpen]     = useState(false);

  const makeDraft = () => {
    const rosterCopy = {};
    if (RPG_PRESET.enemyRoster) {
      Object.entries(RPG_PRESET.enemyRoster).forEach(([k, v]) => { rosterCopy[k] = { ...v }; });
    }
    return {
      ...RPG_PRESET,
      deckOverrides:     { ...RPG_PRESET.deckOverrides },
      cardValues:        { ...RPG_PRESET.cardValues },
      disabledGambits:   { ...RPG_PRESET.disabledGambits },
      gambitMultipliers: { ...RPG_PRESET.gambitMultipliers },
      enemyRoster:       rosterCopy,
      rushQueue:         [...(RPG_PRESET.rushQueue || [])],
    };
  };

  const [draft, setDraft] = useState(makeDraft());

  const gsRef = useRef(gs);
  useEffect(() => { gsRef.current = gs; }, [gs]);


  // ── Animation helpers ───────────────────────────────────────────────────────
  const deal  = () => { setDealing(true);  setTimeout(() => setDealing(false), 550); };
  const flash = (t) => { setFlash(t); setTimeout(() => setFlash(null), 2000); };


  // ── Settings management ─────────────────────────────────────────────────────
  const openSettings = () => {
    setDraft(makeDraft());
    setSettingsOpen(true);
  };

  const cancelSettings = () => {
    setSettingsOpen(false);
    if (screen === 'start') onReturnToMenu();
  };

  const applySettings = () => {
    if (rpgCountDraftDeck(draft) < 2) return;
    if (draft.rushMode && (!draft.rushQueue || draft.rushQueue.length === 0)) return;
    Object.assign(RPG_PRESET, draft);
    RPG_PRESET.deckOverrides     = { ...draft.deckOverrides };
    RPG_PRESET.cardValues        = { ...draft.cardValues };
    RPG_PRESET.disabledGambits   = { ...draft.disabledGambits };
    RPG_PRESET.gambitMultipliers = { ...draft.gambitMultipliers };
    if (draft.enemyRoster) {
      RPG_PRESET.enemyRoster = {};
      Object.entries(draft.enemyRoster).forEach(([k, v]) => { RPG_PRESET.enemyRoster[k] = { ...v }; });
      RPG_PRESET.rushQueue = [...(draft.rushQueue || [])];
    }
    setSettingsOpen(false);
    startGame();
  };

  const changeEnemyStat = (key, val) => setDraft(d => ({
    ...d,
    enemyRoster: {
      ...d.enemyRoster,
      [d.selectedEnemyId]: {
        ...((d.enemyRoster || {})[d.selectedEnemyId] || {}),
        [key]: val,
      },
    },
  }));

  const resetEnemyStats = () => setDraft(d => {
    const base = ENEMY_PRESETS.find(p => p.id === d.selectedEnemyId);
    if (!base) return d;
    return {
      ...d,
      enemyRoster: { ...d.enemyRoster, [d.selectedEnemyId]: { ...base.settings } },
    };
  });

  const changeDraft          = (key, val) => setDraft(d => ({ ...d, [key]: val }));
  const changeDeckCount      = (cardId, val) => setDraft(d => ({ ...d, deckOverrides:    { ...d.deckOverrides,    [cardId]: val } }));
  const changeCardValue      = (cardId, val) => setDraft(d => ({ ...d, cardValues:       { ...d.cardValues,       [cardId]: val } }));
  const changeGambitDisabled = (key,   val) => setDraft(d => ({ ...d, disabledGambits:  { ...d.disabledGambits,   [key]:   val } }));
  const changeGambitMult     = (key,   val) => setDraft(d => ({ ...d, gambitMultipliers:{ ...d.gambitMultipliers, [key]:   val } }));
  const applyPreset          = (settings) => setDraft(d => ({ ...d, ...settings }));


  // ── Game initialisation ─────────────────────────────────────────────────────
  const startGame = () => {
    // Mirror active enemy stats into PRESET top-level (first rush enemy or single).
    if (RPG_PRESET.enemyRoster) {
      const activeId = (RPG_PRESET.rushMode && RPG_PRESET.rushQueue && RPG_PRESET.rushQueue.length > 0)
        ? RPG_PRESET.rushQueue[0]
        : RPG_PRESET.selectedEnemyId;
      if (activeId && RPG_PRESET.enemyRoster[activeId]) {
        Object.assign(RPG_PRESET, RPG_PRESET.enemyRoster[activeId]);
      }
    }
    rpgResetEnemyChances();

    const initialDeck = shfl(rpgMkDeck());
    const d           = [...initialDeck];

    const tableIndex = Math.floor(Math.random() * d.length);
    const tableCard  = d.splice(tableIndex, 1)[0];

    const handIndex = Math.floor(Math.random() * d.length);
    const handCard  = d[handIndex];

    setGs({
      deck: d,
      tableCard,
      handCard,
      lives:      RPG_PRESET.startLives,
      startLives: RPG_PRESET.startLives,
      streak:     RPG_PRESET.startStreak,
      blanks:     RPG_PRESET.startBlanks,
      score:      0,
      round:      1,
      usedLastChance: false,
      enemyHP:    RPG_PRESET.enemyHP,
      enemyMaxHP: RPG_PRESET.enemyHP,
      rushIndex:  0,
      ...rpgResolveEnemyState(),
    });

    setSel(EMPTY_SEL); setRevealed(false); setResult(null);
    setShop(false); setNoFlipAnim(false);
    setDiceState({ result: null, guess: null, rollsLeft: 0 });
    setLastChance(false); setEnemySlain(false);
    setRoundHistory([]);
    deal(); setScreen('game');
  };


  // ── Draw the next round ─────────────────────────────────────────────────────
  const drawNext = (g) => {
    let d = [...g.deck];

    const oldHandIdx = d.findIndex(c => c.id === g.handCard.id);
    if (oldHandIdx !== -1) d.splice(oldHandIdx, 1);

    if (RPG_PRESET.infiniteDeck) d = [...d, g.tableCard, g.handCard];

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
      ...rpgResolveEnemyState(),
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
    const dg = rpgDeriveGambit(sel);
    if (!dg || result) return;
    setRevealed(true);

    const r = rpgResolveGambit(gs, dg);

    setGs(g => {
      setRoundHistory(h => [{
        type: 'round', round: g.round,
        tableCard: g.tableCard, handCard: g.handCard,
        gambit: dg.label,
        outcome: r.won ? 'win' : 'lose',
        pts: r.enemyDamage, score: r.newScore,
        lives: r.newLives, blanks: g.blanks, streak: r.newStreak,
      }, ...h]);
      return { ...g, score: r.newScore, streak: r.newStreak, lives: r.newLives, enemyHP: r.newEnemyHP };
    });

    const flashType = r.enemyDamage > 0 ? 'win' : r.playerDamage > 0 ? 'lose' : null;
    if (flashType) flash(flashType);
    setResult({
      won: r.won, pts: r.pts, action: 'gambit',
      // RPG mode never sets the "All lives forfeit" flag — combat damage is what matters
      rpg: {
        enemyDamage: r.enemyDamage, playerDamage: r.playerDamage,
        combatResult: r.combatResult,
        attackValue:  gs.enemyAttackValue,
        enemyState:   gs.enemyState,
      },
    });
  };


  // ── Skip a round ────────────────────────────────────────────────────────────
  const doSkip = () => {
    if (result) return;
    setRevealed(true);
    const r = rpgResolveSkip(gs);

    setGs(g => ({ ...g, lives: r.newLives, streak: r.newStreak }));
    setRoundHistory(h => [{
      type: 'round', round: gs.round,
      tableCard: gs.tableCard, handCard: gs.handCard,
      gambit: '— Skip —',
      outcome: 'skip', pts: 0,
      score: gs.score, lives: r.newLives, blanks: gs.blanks, streak: r.newStreak,
    }, ...h]);
    setResult({
      won: false, pts: 0, action: 'skip',
      rpg: {
        enemyDamage: 0, playerDamage: r.playerDamage,
        healAmount: r.healAmount,
        combatResult: r.combatResult,
        attackValue:  gs.enemyAttackValue,
        enemyState:   gs.enemyState,
      },
    });
    if (r.playerDamage > 0) flash('lose');
  };


  // ── Play a blank card ───────────────────────────────────────────────────────
  const doBlank = () => {
    if (!gs || (!RPG_PRESET.infiniteBlanks && !gs.blanks) || result) return;
    setRevealed(true);
    const r = rpgResolveBlank(gs);

    if (r.type === 'strike') {
      setGs(g => ({ ...g, blanks: r.newBlanks, streak: r.newStreak, enemyHP: r.newEnemyHP }));
      setRoundHistory(h => [{
        type: 'round', round: gs.round,
        tableCard: gs.tableCard, handCard: gs.handCard,
        gambit: '⚔ Blank Strike',
        outcome: 'blank', pts: r.enemyDamage,
        score: gs.score + r.enemyDamage, lives: gs.lives, blanks: r.newBlanks, streak: r.newStreak,
      }, ...h]);
      setResult({
        won: true, pts: 0, action: 'blank',
        rpg: { enemyDamage: r.enemyDamage, playerDamage: 0, combatResult: r.combatResult, attackValue: null, enemyState: gs.enemyState },
      });
      flash('win');
    } else if (r.type === 'guard-hit') {
      setGs(g => ({ ...g, blanks: r.newBlanks, streak: r.newStreak, lives: r.newLives }));
      setRoundHistory(h => [{
        type: 'round', round: gs.round,
        tableCard: gs.tableCard, handCard: gs.handCard,
        gambit: '🛡️ Blank Repelled',
        outcome: 'blank', pts: 0,
        score: gs.score, lives: r.newLives, blanks: r.newBlanks, streak: r.newStreak,
      }, ...h]);
      setResult({
        won: false, pts: 0, action: 'blank',
        rpg: { enemyDamage: 0, playerDamage: r.playerDamage, combatResult: r.combatResult, attackValue: null, enemyState: gs.enemyState },
      });
      flash('lose');
    } else if (r.type === 'draw') {
      setGs(g => ({ ...g, blanks: r.newBlanks, streak: r.newStreak }));
      setRoundHistory(h => [{
        type: 'round', round: gs.round,
        tableCard: gs.tableCard, handCard: gs.handCard,
        gambit: '⚖ Blank Absorbed',
        outcome: 'blank', pts: 0,
        score: gs.score, lives: gs.lives, blanks: r.newBlanks, streak: r.newStreak,
      }, ...h]);
      setResult({
        won: false, pts: 0, action: 'blank',
        rpg: { enemyDamage: 0, playerDamage: 0, combatResult: r.combatResult, attackValue: null, enemyState: gs.enemyState },
      });
    } else {
      // block — blank fully absorbed an attack
      setGs(g => ({ ...g, blanks: r.newBlanks, streak: r.newStreak }));
      setRoundHistory(h => [{
        type: 'round', round: gs.round,
        tableCard: gs.tableCard, handCard: gs.handCard,
        gambit: '🛡️ Blank Block',
        outcome: 'blank', pts: 0,
        score: gs.score, lives: gs.lives, blanks: r.newBlanks, streak: r.newStreak,
      }, ...h]);
      setResult({
        won: true, pts: 0, action: 'blank',
        rpg: { enemyDamage: 0, playerDamage: 0, combatResult: 'blocked', attackValue: r.attackValue, enemyState: 'attack' },
      });
      flash('win');
    }
  };


  // ── Continue to next round ──────────────────────────────────────────────────
  const continueGame = useCallback(() => {
    const currentGs = gsRef.current;
    if (!currentGs) return;

    if (currentGs.enemyHP <= 0) {
      // Rush mode: show the enemy-slain interstitial; otherwise win screen.
      if (RPG_PRESET.rushMode && RPG_PRESET.rushQueue && (currentGs.rushIndex ?? 0) + 1 < RPG_PRESET.rushQueue.length) {
        setResult(null);
        setEnemySlain(true);
        return;
      }
      setScreen('win'); return;
    }

    if (!RPG_PRESET.infiniteLives && currentGs.lives <= 0) {
      if (!currentGs.usedLastChance && RPG_PRESET.deathsDoorRolls > 0) {
        setResult(null);
        setDiceState({ result: null, guess: null, rollsLeft: RPG_PRESET.deathsDoorRolls });
        setLastChance(true);
        return;
      }
      setScreen('gameover'); return;
    }

    if (!RPG_PRESET.infiniteDeck && currentGs.deck.length < 3) { setScreen('deckempty'); return; }

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


  // ── Advance to the next enemy in the rush queue (Continue button click) ────
  const advanceToNextEnemy = () => {
    const currentGs = gsRef.current;
    if (!currentGs) return;
    const nextIdx = (currentGs.rushIndex ?? 0) + 1;
    const nextId  = RPG_PRESET.rushQueue[nextIdx];
    if (RPG_PRESET.enemyRoster && RPG_PRESET.enemyRoster[nextId]) {
      Object.assign(RPG_PRESET, RPG_PRESET.enemyRoster[nextId]);
      rpgResetEnemyChances();
      setGs(g => ({
        ...g,
        enemyHP:    RPG_PRESET.enemyHP,
        enemyMaxHP: RPG_PRESET.enemyHP,
        rushIndex:  nextIdx,
        ...rpgResolveEnemyState(),
      }));
      setEnemySlain(false);
      setSel(EMPTY_SEL);
      setRevealed(false);
      setShop(false);
    }
  };


  useEffect(() => {
    if (result) {
      const timer = setTimeout(() => continueGame(), 2000);
      return () => clearTimeout(timer);
    }
  }, [result, continueGame]);


  // ── Death's Door dice ───────────────────────────────────────────────────────
  const rollDice = (guess) => {
    const sides = RPG_PRESET.deathsDoorDiceSides || 4;
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
          if (!RPG_PRESET.infiniteDeck && gsRef.current.deck.length < 3) { setScreen('deckempty'); return; }
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
    if (gs.streak >= RPG_PRESET.costLife) {
      const newStreak = gs.streak - RPG_PRESET.costLife;
      const newLives  = Math.min(gs.startLives, gs.lives + RPG_PRESET.shopLifeAmount);
      setGs(g => ({ ...g, streak: newStreak, lives: newLives }));
      setRoundHistory(h => [{
        type: 'shop', round: gs.round,
        item: `❤ Heal (+${newLives - gs.lives} HP)`, cost: RPG_PRESET.costLife,
        score: gs.score, lives: newLives, blanks: gs.blanks, streak: newStreak,
      }, ...h]);
    }
  };

  const buyBlank = () => {
    if (gs.streak >= RPG_PRESET.costBlank) {
      const newStreak = gs.streak - RPG_PRESET.costBlank;
      const newBlanks = gs.blanks + RPG_PRESET.shopBlankAmount;
      setGs(g => ({ ...g, streak: newStreak, blanks: newBlanks }));
      setRoundHistory(h => [{
        type: 'shop', round: gs.round,
        item: `🛡️ Blank Card (+${RPG_PRESET.shopBlankAmount})`, cost: RPG_PRESET.costBlank,
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
    onChangeEnemyStat: changeEnemyStat,
    onResetEnemyStats: resetEnemyStats,
    onApplyPreset: applyPreset,
    onApply: applySettings,
    onCancel: cancelSettings,
    onReturnToMenu,
  };


  // ── Screen: Start ───────────────────────────────────────────────────────────
  if (screen === 'start') {
    return e('div', { className: 'app' },
      settingsOpen && e(RpgSettingsPanel, { ...settingsProps, gameActive: false }),
      e('div', { className: 'start' },
        e('div', { className: 'sigil' }, '⛧'),
        e('h1',  { className: 'start-title' }, 'Devil\'s', e('br'), 'Gambit'),
        e('div', { style: {
          fontFamily:"'Cinzel',serif", fontSize:'var(--font-xs)',
          letterSpacing:'0.12em', textTransform:'uppercase',
          color: '#e04040', marginBottom: '4px',
        } }, 'RPG Mode'),
        e('div', { className: 'sep' }),
        e('button', { className: 'btn-start',   onClick: openSettings }, '⚔ Options'),
        e('button', { className: 'btn-options', onClick: onReturnToMenu,
          style: { marginTop:'6px', opacity:0.7 } }, '← Main Menu'),
      )
    );
  }


  // ── Screen: Win ─────────────────────────────────────────────────────────────
  if (screen === 'win') {
    const isGauntletWin = RPG_PRESET.rushMode && RPG_PRESET.rushQueue && RPG_PRESET.rushQueue.length > 1;
    return e('div', { className: 'app' },
      settingsOpen && e(RpgSettingsPanel, { ...settingsProps, gameActive: false }),
      e('div', { className: 'gameover' },
        e('div', { className: 'victory-sigil' }, isGauntletWin ? '⚔' : '★'),
        e('h2',  { className: 'gottl-victory' }, isGauntletWin ? 'Gauntlet Complete!' : 'Enemy Slain'),
        e('p',   { className: 'gosub-victory' },
          isGauntletWin ? 'All ' + RPG_PRESET.rushQueue.length + ' foes vanquished'
                        : 'Your gambits proved lethal'),
        e('div', { className: 'gobox' },
          e('div', { className: 'golbl' },   'Damage Dealt'),
          e('div', { className: 'goscore' }, (gs?.score || 0).toLocaleString()),
          e('div', { className: 'godet' },
            isGauntletWin
              ? 'Survived ' + (gs?.round || 1) + ' rounds · ' + RPG_PRESET.rushQueue.length + ' enemies slain'
              : 'Survived ' + (gs?.round || 1) + ' rounds · ' + RPG_PRESET.enemyName + ' defeated')
        ),
        e('button', { className: 'btn-start',   onClick: startGame },    'Play Again'),
        e('button', { className: 'btn-options', onClick: openSettings }, '⚔ Options'),
        e('button', { className: 'btn-options', onClick: onReturnToMenu,
          style: { marginTop:'6px', opacity:0.7 } }, '← Main Menu')
      )
    );
  }


  // ── Screen: Game Over ───────────────────────────────────────────────────────
  if (screen === 'gameover') return e('div', { className: 'app' },
    settingsOpen && e(RpgSettingsPanel, { ...settingsProps, gameActive: false }),
    e('div', { className: 'gameover' },
      e('div', { className: 'goskull' }, '💀'),
      e('h2',  { className: 'gottl' }, 'Your Soul is Forfeit'),
      e('p',   { className: 'gosub' }, 'The Devil Wins Again'),
      e('div', { className: 'gobox' },
        e('div', { className: 'golbl' },   'Damage Dealt'),
        e('div', { className: 'goscore' }, (gs?.score || 0).toLocaleString()),
        e('div', { className: 'godet' },   'Survived ' + (gs?.round || 1) + ' rounds')
      ),
      e('button', { className: 'btn-start',   onClick: startGame },    'Play Again'),
      e('button', { className: 'btn-options', onClick: openSettings }, '⚔ Options'),
      e('button', { className: 'btn-options', onClick: onReturnToMenu,
        style: { marginTop:'6px', opacity:0.7 } }, '← Main Menu')
    )
  );


  // ── Screen: Deck Empty ──────────────────────────────────────────────────────
  if (screen === 'deckempty') return e('div', { className: 'app' },
    settingsOpen && e(RpgSettingsPanel, { ...settingsProps, gameActive: false }),
    e('div', { className: 'gameover' },
      e('div', { className: 'goskull' }, '💀'),
      e('h2',  { className: 'gottl' }, 'Strength Exhausted'),
      e('p',   { className: 'gosub' }, 'Your gambits are spent — ' + RPG_PRESET.enemyName + ' endures'),
      e('div', { className: 'gobox' },
        e('div', { className: 'golbl' },   'Damage Dealt'),
        e('div', { className: 'goscore' }, (gs?.score || 0).toLocaleString()),
        e('div', { className: 'godet' },
          'Survived ' + (gs?.round || 1) + ' rounds · ' + RPG_PRESET.enemyName + ' at ' + (gs?.enemyHP || 0) + ' HP')
      ),
      e('button', { className: 'btn-start',   onClick: startGame },    'Play Again'),
      e('button', { className: 'btn-options', onClick: openSettings }, '⚔ Options'),
      e('button', { className: 'btn-options', onClick: onReturnToMenu,
        style: { marginTop:'6px', opacity:0.7 } }, '← Main Menu')
    )
  );


  // ── Screen: Game ────────────────────────────────────────────────────────────
  const derived       = rpgDeriveGambit(sel);
  const canCommit     = !!derived && !result && !rpgIsGambitDisabled(derived);

  const tc       = gs.tableCard, hc = gs.handCard;
  const isHighTC = HIGH.has(tc.value);
  const isLowTC  = ['2','3','4','5','6','7'].includes(tc.value);
  const tcCat    = tc.value === 'JOKER' ? 'Joker' : tc.value === 'A' ? 'Ace' : isHighTC ? 'High' : isLowTC ? 'Low' : '—';

  return e('div', { className: 'app' },
    settingsOpen && e(RpgSettingsPanel, { ...settingsProps, gameActive: true }),
    infoOpen     && e(RpgInfoPanel,     { gs, history: roundHistory, onClose: () => setInfoOpen(false) }),

    e('div', { className: 'game-wrap' },
      // Header
      e('div', { className: 'hdr' },
        e('span', { className: 'hdr-round', onClick: () => setInfoOpen(true), title: 'View Deck & History' }, 'Round ' + gs.round),
        e('span', { className: 'hdr-brand' },
          e('button', { className: 'hdr-gear', onClick: openSettings, title: 'Options' }, 'Devil\'s Gambit ⚔'),
        ),
        e('span', { className: 'hdr-score' },
          e('span', null,
            e('span', { style:{ color:'#c8a020' } }, RPG_PRESET.enemyName, ': '),
            e('b', null, gs.enemyHP),
            e('span', { style:{ color:'var(--secondary-color)', fontSize:'var(--font-xs)' } }, ' HP')
          )
        )
      ),

      // Stats bar
      e('div', { className: 'stats' },
        e('div', { className: 'stat' },
          e('span', { className: 'stat-lbl' }, 'HP'),
          RPG_PRESET.infiniteLives
            ? e('span', { className: 'stat-val stat-inf' }, '∞')
            : e('span', { className: 'stat-val' }, gs.lives, ' / ', gs.startLives)
        ),
        e('div', { className: 'stat' },
          e('span', { className: 'stat-lbl' }, 'Blanks'),
          RPG_PRESET.infiniteBlanks
            ? e('span', { className: 'stat-val stat-inf' }, '∞')
            : e('span', { className: 'stat-val' }, +gs.blanks)
        ),
        e('div', { className: 'stat' },
          e('span', { className: 'stat-lbl' }, 'Streak'),
          e('span', { className: 'stat-val' }, +gs.streak)
        ),
      ),

      // Enemy panel
      e(EnemyPanel, { gs }),

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
              onClick:   enemySlain ? advanceToNextEnemy : commit,
              disabled:  enemySlain ? false : (!canCommit || shop || !!result || lastChance),
            }, enemySlain ? 'Continue' : 'Set'),
            e('button', { className: 'btnsec', onClick: doBlank,
              disabled: !RPG_PRESET.blanksEnabled || (!RPG_PRESET.infiniteBlanks && !gs.blanks) || shop || !!result || lastChance || enemySlain,
            }, 'Blank'),
            e('button', { className: 'btnsec', onClick: doSkip,
              disabled: !RPG_PRESET.skipsEnabled || shop || !!result || lastChance || enemySlain,
            }, 'Skip'),
            // RPG: shop is only accessible between rush enemies. In single-foe mode
            // (and during combat) the button stays disabled with a clarifying title.
            e('button', { className: 'btnsec', onClick: () => setShop(s => !s),
              disabled: !enemySlain || lastChance,
              title: !RPG_PRESET.rushMode ? 'Shop only available in Rush mode, between enemies' : (enemySlain ? '' : 'Shop opens between enemies'),
            }, shop ? 'Close Shop' : 'Shop')
          ),
          (enemySlain || result || lastChance || !shop) && e(RpgGambitPanel, {
            sel, onToggle: toggleSel, derived, gs,
            disabled: !!result || lastChance || enemySlain,
            result, lastChance, diceState, onRoll: rollDice, enemySlain,
          }),
          shop && !result && !lastChance && enemySlain && e(RpgShop, { gs, buyLife, buyBlank })
        )
      )
    )
  );
}

// ── Register on window ───────────────────────────────────────────────────────
window.RpgApp = RpgApp;
// ──────────────────────────────────────────────────────────────────────────────
