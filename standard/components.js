// ── Standard Mode — UI components ─────────────────────────────────────────────
//
// All Standard-specific React components.  Reads STD_PRESET / STANDARD_PRESETS
// directly; no awareness of RPG mode.  CardFace / HandCard come from
// core/shared.js (visual primitives only).
//
// Exports:
//   StdGambitPanel, StdShop, StdSettingsPanel, StdInfoPanel,
//   StdRoundHistory, StdDeckInfo
//
// Load order: ... → standard/gameplay.js → standard/components.js → ...
// ──────────────────────────────────────────────────────────────────────────────


// ── StdGambitPanel ───────────────────────────────────────────────────────────
function StdGambitPanel({ sel, onToggle, derived, gs, disabled, result, lastChance, diceState, onRoll }) {
  const e = React.createElement;

  const isSel = (type, val) => {
    if (type === 'joker') return sel.joker;
    if (type === 'value') return sel.value === val;
    if (type === 'color') return sel.color === val;
    if (type === 'suit')  return sel.suit  === val;
    return false;
  };

  const btn = (type, val, label) =>
    e('button', { key: val || type, className: 'gb' + (isSel(type, val) ? ' sel' : ''), onClick: () => !disabled && onToggle(type, val), disabled },
      e('span', { className: 'gbname' }, label)
    );

  const fmtMod = (op, mod, label) => {
    if ((op === 'add' || op === 'subtract') && mod === 0) return null;
    if ((op === 'multiply' || op === 'divide') && mod === 1) return null;
    const sign = op === 'add' ? '+' : op === 'subtract' ? '−' : op === 'multiply' ? '×' : '÷';
    return `${sign}${mod} ${label}`;
  };

  const isJoker      = derived && derived.type === 'joker';
  const gambitOff    = derived && stdIsGambitDisabled(derived);
  const isResultWin  = result && (result.won || result.action === 'blank');
  const isResultNtrl = result && result.action === 'skip';

  const displayCls = 'gambit-display' + (
    lastChance ? ' last-chance' :
    result     ? (isResultWin ? ' result-win' : isResultNtrl ? ' result-ntrl' : ' result-lose') :
    (derived   ? (gambitOff ? ' active-disabled' : isJoker ? ' active-joker' : ' active') : '')
  );

  const sides      = STD_PRESET.deathsDoorDiceSides || 4;
  const totalRolls = STD_PRESET.deathsDoorRolls || 1;
  const rollsLeft  = diceState?.rollsLeft ?? totalRolls;
  const diceName   = 'D' + sides;

  const winS  = fmtMod(STD_PRESET.winStreakOp,   STD_PRESET.winStreakMod,   'streak');
  const winL  = fmtMod(STD_PRESET.winLifeOp,     STD_PRESET.winLifeMod,     '♥');
  const loseL = fmtMod(STD_PRESET.loseLifeOp,    STD_PRESET.loseLifeMod,    '♥');
  const loseS = fmtMod(STD_PRESET.loseStreakOp,  STD_PRESET.loseStreakMod,  'streak');
  const skipL = fmtMod(STD_PRESET.skipLifeOp,    STD_PRESET.skipLifeMod,    '♥');
  const skipS = fmtMod(STD_PRESET.skipStreakOp,  STD_PRESET.skipStreakMod,  'streak');
  const blnkL = fmtMod(STD_PRESET.blankLifeOp,   STD_PRESET.blankLifeMod,   '♥');
  const blnkS = fmtMod(STD_PRESET.blankStreakOp, STD_PRESET.blankStreakMod, 'streak');

  return e('div', { className: 'gambit-panel' },
    e('div', { className: displayCls },

      // ── Death's Door dice UI ──────────────────────────────────────────────
      lastChance ? e('div', { className: 'gd-dice' },
        e('div', { className: 'gd-dice-inner' },
          e('div', { className: 'gd-restitle dice' }, '🎲 Death\'s Door 🎲'),
          e('div', { className: 'gd-dice-sub' },
            'Guess the ' + diceName + ' to cheat death' +
            (totalRolls > 1 ? ' (' + rollsLeft + ' of ' + totalRolls + ' ' + (rollsLeft === 1 ? 'attempt' : 'attempts') + ' left)' : '')
          ),
          diceState && diceState.result
            ? e('div', { className: 'gd-dice-result' },
                diceState.result === diceState.guess
                  ? e('div', { className: 'gd-restitle win' },  diceState.result)
                  : e('div', { className: 'gd-restitle lose' }, diceState.result)
              )
            : e('div', { className: 'gd-dice-row', style: { flexWrap:'wrap', gap:'5px' } },
                Array.from({ length: sides }, (_, i) => i + 1).map(num =>
                  e('button', {
                    key: num,
                    className: 'gd-dice-btn',
                    onClick: () => onRoll(num),
                    style: { width: sides > 6 ? '44px' : '60px', fontSize: sides > 6 ? 'var(--font-sm)' : 'var(--font-md)' },
                  }, num)
                )
              )
        )

      // ── Result display ────────────────────────────────────────────────────
      ) : result ? e('div', { className: 'gd-result' },

        result.action === 'gambit' && result.won && e('div', { className: 'gd-res-inner' },
          e('span', { className: 'gd-resicon' }, '✨'),
          e('div',  { className: 'gd-restitle win' }, 'Victory'),
          e('div',  { className: 'gd-respts' },
            '+', e('b', null, result.pts), ' pts',
            winS && (' · ' + winS),
            winL && (' · ' + winL)
          )
        ),

        result.action === 'gambit' && !result.won && !result.instant && e('div', { className: 'gd-res-inner' },
          e('span', { className: 'gd-resicon' }, '🩸'),
          e('div',  { className: 'gd-restitle lose' }, 'Defeat'),
          e('div',  { className: 'gd-respts' },
            e('b', null, result.pts), ' pts',
            loseS && (' · ' + loseS),
            loseL && (' · ' + loseL)
          )
        ),

        result.action === 'gambit' && result.instant && e('div', { className: 'gd-res-inner' },
          e('span', { className: 'gd-resicon' }, '💀'),
          e('div',  { className: 'gd-restitle lose' }, 'The Devil Collects'),
          e('div',  { className: 'gd-respts' }, 'All lives forfeit')
        ),

        result.action === 'skip' && e('div', { className: 'gd-res-inner' },
          e('span', { className: 'gd-resicon' }, '🌑'),
          e('div',  { className: 'gd-restitle ntrl' }, 'Round Skipped'),
          e('div',  { className: 'gd-respts' },
            e('b', null, result.pts), ' pts',
            skipS && (' · ' + skipS),
            skipL && (' · ' + skipL)
          )
        ),

        result.action === 'blank' && e('div', { className: 'gd-res-inner' },
          e('span', { className: 'gd-resicon' }, '🛡️'),
          e('div',  { className: 'gd-restitle win' }, 'Blank Invoked'),
          e('div',  { className: 'gd-respts' },
            e('b', null, result.pts), ' pts',
            blnkS && (' · ' + blnkS),
            blnkL && (' · ' + blnkL)
          )
        )

      // ── Active gambit preview ─────────────────────────────────────────────
      ) : derived ? e('div', {
        className: 'gd-inner' + (isJoker ? ' gd-joker' : ''),
        style: { width:'100%', textAlign:'center' },
      },
        e('div', { className: 'gd-name' }, derived.label),
        e('div', { className: 'gd-desc' }, derived.desc),
        gambitOff
          ? e('div', { className: 'gd-disabled-notice' }, '⊘ Gambit Disabled')
          : e('div', { className: 'gd-mult' }, 'Multiplier: ', e('b', null, '×' + derived.mult)),
        !gambitOff && derived && gs && e('div', { className: 'potential' },
          e('span', null,
            'Reward: ', e('b', null,
              `(${gs.tableCard.numValue} + ${gs.streak}) × ${derived.mult} = ${(gs.tableCard.numValue + gs.streak) * derived.mult} pts`
            )
          )
        )

      // ── Empty state ───────────────────────────────────────────────────────
      ) : e('span', { className: 'gd-empty' }, '— Choose Your Gambit —')
    ),

    // ── Gambit selection buttons ──────────────────────────────────────────────
    e('div', { className: 'gbrow' },
      btn('value', 'low',      '▼ Low ▼'),
      btn('color', 'red',      '♥ Red ♦'),
      btn('suit',  'hearts',   '♥ H ♥'),
      btn('suit',  'diamonds', '♦ D ♦')
    ),
    e('div', { className: 'gbrow' },
      btn('value', 'high',   '▲ High ▲'),
      btn('color', 'black',  '♣ Black ♠'),
      btn('suit',  'clubs',  '♣ C ♣'),
      btn('suit',  'spades', '♠ S ♠')
    ),
    e('button', {
      className: 'gb gb-joker' + (sel.joker ? ' sel' : ''),
      onClick: () => !disabled && onToggle('joker', true),
      disabled,
    },
      e('span', { className: 'gbname' }, '⛧ Joker Gambit ⛧')
    )
  );
}
// ──────────────────────────────────────────────────────────────────────────────


// ── StdShop ──────────────────────────────────────────────────────────────────
function StdShop({ gs, buyLife, buyBlank }) {
  const e = React.createElement;
  return e('div', { className: 'respan' },
    e('div', { className: 'shopitems' },
      e('div', { className: 'shopitem' },
        e('div', { className: 'shopil' },
          e('span', { className: 'shopname' }, `♥ Health Potion (+${STD_PRESET.shopLifeAmount})`),
          STD_PRESET.infiniteLives
            ? e('span', { className: 'shopcost' }, '∞ Infinite lives active')
            : e('span', { className: 'shopcost' }, 'Cost: ' + STD_PRESET.costLife + ' streak points')
        ),
        e('button', {
          className: 'btngold',
          onClick: buyLife,
          disabled: gs.streak < STD_PRESET.costLife || STD_PRESET.infiniteLives,
        }, 'Buy')
      ),
      STD_PRESET.blanksEnabled && e('div', { className: 'shopitem' },
        e('div', { className: 'shopil' },
          e('span', { className: 'shopname' }, `🛡️ Blank Card (+${STD_PRESET.shopBlankAmount})`),
          STD_PRESET.infiniteBlanks
            ? e('span', { className: 'shopcost' }, '∞ Infinite blanks active')
            : e('span', { className: 'shopcost' }, 'Cost: ' + STD_PRESET.costBlank + ' streak points')
        ),
        e('button', {
          className: 'btngold',
          onClick: buyBlank,
          disabled: gs.streak < STD_PRESET.costBlank || STD_PRESET.infiniteBlanks,
        }, 'Buy')
      )
    )
  );
}
// ──────────────────────────────────────────────────────────────────────────────


// ── StdDeckInfo ──────────────────────────────────────────────────────────────
function StdDeckInfo({ gs }) {
  const e = React.createElement;
  if (!gs) return null;
  const total = gs.deck.length;
  const s = stdComputeDeckStats(gs.deck);
  return e('div', { className: 'deckinfo' },
    e('div', { className: 'deckinfo-hdr' },
      e('span', null, 'Deck'),
      e('span', { className: 'deckinfo-count' }, total + ' cards remaining')
    ),
    e('div', { className: 'deckinfo-row' },
      e('div', { className: 'di-item' }, e('span', { className:'di-lbl' }, 'High'),  e('span', { className:'di-val' }, s.high)),
      e('div', { className: 'di-item' }, e('span', { className:'di-lbl' }, 'Low'),   e('span', { className:'di-val' }, s.low)),
      e('div', { className: 'di-item' }, e('span', { className:'di-lbl' }, 'Ace'),   e('span', { className:'di-val' }, s.ace)),
      e('div', { className: 'di-item' }, e('span', { className:'di-lbl' }, 'Joker'), e('span', { className:'di-val' }, s.joker)),
    ),
    e('div', { className: 'deckinfo-row' },
      e('div', { className: 'di-item' }, e('span', { className:'di-lbl' }, '♥'), e('span', { className:'di-val' }, s.hearts)),
      e('div', { className: 'di-item' }, e('span', { className:'di-lbl' }, '♦'), e('span', { className:'di-val' }, s.diamonds)),
      e('div', { className: 'di-item' }, e('span', { className:'di-lbl' }, '♣'), e('span', { className:'di-val' }, s.clubs)),
      e('div', { className: 'di-item' }, e('span', { className:'di-lbl' }, '♠'), e('span', { className:'di-val' }, s.spades)),
    )
  );
}
// ──────────────────────────────────────────────────────────────────────────────


// ── StdRoundHistory ──────────────────────────────────────────────────────────
function StdRoundHistory({ history }) {
  const e = React.createElement;
  const [open, setOpen] = React.useState(true);
  if (!history || !history.length) return null;

  const fmtLives  = (n) => STD_PRESET.infiniteLives  ? '∞' : n;
  const fmtBlanks = (n) => STD_PRESET.infiniteBlanks ? '∞' : n;

  return e('div', { className: 'rhist' },
    e('div', { className: 'rhist-hdr', onClick: () => setOpen(o => !o) },
      e('span', { className: 'rhist-title' }, '⛧ Round History'),
      e('div',  { className: 'rhist-hdr-right' },
        e('span', { className: 'rhist-count' },  history.length + ' entries'),
        e('span', { className: 'rhist-toggle' }, open ? '▲' : '▼')
      )
    ),
    open && e('div', { className: 'rhist-body' },
      history.map((entry, i) => {
        if (entry.type === 'shop') {
          return e('div', { key: i, className: 'rhe rhe-shop' },
            e('div', { className: 'rhe-top' },
              e('span', { className: 'rhe-badge' },     'R' + entry.round),
              e('span', { className: 'rhe-outcome ntrl' }, 'Shop'),
              e('span', { className: 'rhe-score' },     entry.score.toLocaleString() + ' pts')
            ),
            e('div', { className: 'rhe-bottom' },
              e('span', { className: 'rhe-shop-item' }, entry.item),
              e('span', { className: 'rhe-divider' }),
              e('span', { className: 'rhe-shop-cost' }, '−' + entry.cost + ' streak'),
              e('span', { className: 'rhe-divider' }),
              e('span', { className: 'rhe-stats' }, '♥' + fmtLives(entry.lives) + '  🛡' + fmtBlanks(entry.blanks) + '  ~' + entry.streak)
            )
          );
        }
        const outIcon = entry.outcome==='win'?'✨':entry.outcome==='blank'?'🛡️':entry.outcome==='skip'?'🌑':entry.outcome==='instant'?'💀':'🩸';
        const outWord = entry.outcome==='win'?'Victory':entry.outcome==='blank'?'Blank':entry.outcome==='skip'?'Skip':entry.outcome==='instant'?'Forfeit':'Defeat';
        const outCls  = (entry.outcome==='win'||entry.outcome==='blank') ? 'win' : entry.outcome==='skip' ? 'ntrl' : 'lose';
        const ptsTxt  = entry.pts > 0 ? '+' + entry.pts + ' pts' : '';
        return e('div', { key: i, className: 'rhe' },
          e('div', { className: 'rhe-top' },
            e('span', { className: 'rhe-badge' },           'R' + entry.round),
            e('span', { className: 'rhe-outcome ' + outCls }, outIcon + ' ' + outWord),
            ptsTxt && e('span', { className: 'rhe-pts' }, ptsTxt),
            e('span', { className: 'rhe-score' }, entry.score.toLocaleString() + ' pts')
          ),
          e('div', { className: 'rhe-bottom' },
            e('div', { className: 'rhe-cards' },
              e('span', { className: 'rh-card' + cardColorClass(entry.tableCard) }, cardLabel(entry.tableCard)),
              e('span', { className: 'rhe-arrow' }, '→'),
              e('span', { className: 'rh-card' + cardColorClass(entry.handCard) },  cardLabel(entry.handCard))
            ),
            e('span', { className: 'rhe-divider' }),
            e('span', { className: 'rhe-gambit' }, entry.gambit),
            e('span', { className: 'rhe-divider' }),
            e('span', { className: 'rhe-stats' }, '♥' + fmtLives(entry.lives) + '  🛡' + fmtBlanks(entry.blanks) + '  ~' + entry.streak)
          )
        );
      })
    )
  );
}
// ──────────────────────────────────────────────────────────────────────────────


// ── StdInfoPanel ─────────────────────────────────────────────────────────────
function StdInfoPanel({ gs, history, onClose }) {
  const e = React.createElement;
  return e('div', { className: 'info-overlay' },
    e('div', { className: 'info-panel' },
      e('div', { className: 'info-title' }, '⛧ The Ledger ⛧'),
      e('div', { className: 'info-sub' },   'Deck & Round Records'),
      e(StdDeckInfo, { gs }),
      history && history.length
        ? e(StdRoundHistory, { history })
        : e('div', { className: 'info-empty' }, 'No rounds played yet'),
      e('div', { className: 'info-close' },
        e('button', { className:'btnsec', style:{ width:'100%' }, onClick:onClose }, 'Close')
      )
    )
  );
}
// ──────────────────────────────────────────────────────────────────────────────


// ── StdSettingsPanel ─────────────────────────────────────────────────────────
function StdSettingsPanel({
  draft, onChange, onChangeDeckCount, onChangeCardValue,
  onChangeGambitDisabled, onChangeGambitMult, onApplyPreset,
  onApply, onCancel, onReturnToMenu, gameActive,
}) {
  const e = React.createElement;

  const [secIdx,            setSecIdx]            = React.useState(0);
  const [activeSuit,        setActiveSuit]        = React.useState('hearts');
  const [activeGambitGroup, setActiveGambitGroup] = React.useState('value');
  const [activeOutcomeTab,  setActiveOutcomeTab]  = React.useState('win');
  // Default-preset highlight: the first preset in the array is the implicit
  // baseline (matches STD_PRESET_DEFAULTS), so show its "Loaded" badge on
  // first open even though the user hasn't clicked anything yet.
  const [activePresetId,    setActivePresetId]    = React.useState(STANDARD_PRESETS[0]?.id ?? null);

  const handleLoadPreset = (p) => {
    onApplyPreset(p.settings);
    setActivePresetId(p.id);
  };

  // ── Reusable rows ─────────────────────────────────────────────────────────
  const stepper = (label, key, min = 0, max = 20) => {
    const val = draft[key] ?? 0;
    return e('div', { className: 'set-row' },
      e('span', { className: 'set-lbl' }, label),
      e('div', { className: 'set-stepper' },
        e('button', { className:'set-stepper-btn', disabled:val<=min, onClick:()=>onChange(key,Math.max(min,val-1)) }, '◀'),
        e('span',   { className:'set-stepper-val' }, val),
        e('button', { className:'set-stepper-btn', disabled:val>=max, onClick:()=>onChange(key,Math.min(max,val+1)) }, '▶'),
      )
    );
  };

  const bigStepper = (label, key, min = 100, max = 10000, step = 100) => {
    const val = draft[key] ?? min;
    return e('div', { className: 'set-row' },
      e('span', { className: 'set-lbl' }, label),
      e('div', { className: 'set-stepper' },
        e('button', { className:'set-stepper-btn', disabled:val<=min, onClick:()=>onChange(key,Math.max(min,val-step)) }, '◀'),
        e('span',   { className:'set-stepper-val', style:{ minWidth:'54px' } }, val.toLocaleString()),
        e('button', { className:'set-stepper-btn', disabled:val>=max, onClick:()=>onChange(key,Math.min(max,val+step)) }, '▶'),
      )
    );
  };

  // ── Card count / pts helpers ──────────────────────────────────────────────
  const getCount = (cardId) => cardId === 'JOKER'
    ? (draft.deckOverrides?.['JOKER'] ?? 2)
    : (draft.deckOverrides?.[cardId] ?? draft.defaultCount ?? 1);

  const getPts = (cardId) => {
    const rank = cardId === 'JOKER' ? 'JOKER' : cardId.split('-')[0];
    return draft.cardValues?.[cardId] !== undefined
      ? draft.cardValues[cardId]
      : (draft.cardValues?.[rank] ?? 0);
  };

  const masterCount = (suit, delta) => {
    if (suit === 'joker') {
      onChangeDeckCount('JOKER', Math.max(0, Math.min(40, getCount('JOKER') + delta)));
    } else {
      VALUES.forEach(v => {
        const id = `${v}-${suit}`;
        onChangeDeckCount(id, Math.max(0, Math.min(20, getCount(id) + delta)));
      });
    }
  };
  const masterValue = (suit, delta) => {
    if (suit === 'joker') {
      onChangeCardValue('JOKER', Math.max(0, Math.min(20, getPts('JOKER') + delta)));
    } else {
      VALUES.forEach(v => {
        const id = `${v}-${suit}`;
        onChangeCardValue(id, Math.max(0, Math.min(20, getPts(id) + delta)));
      });
    }
  };

  const col = (children) => e('div', { className: 'cards-col' }, ...children);
  const centerLbl = (text, extraClass = '') =>
    e('span', { className: 'cards-center-lbl' + (extraClass ? ' ' + extraClass : '') }, text);

  const fusedRow = (cardId, label, countMax = 20) => {
    const count = getCount(cardId);
    const pts   = getPts(cardId);
    return e('div', { key: cardId, className: 'cards-fused-row' },
      col([
        e('button', { className:'set-stepper-btn', disabled:count<=0,        onClick:()=>onChangeDeckCount(cardId,Math.max(0,count-1))         }, '◀'),
        e('span',   { className:'set-stepper-val cards-qty-pts-lbl' }, count),
        e('button', { className:'set-stepper-btn', disabled:count>=countMax, onClick:()=>onChangeDeckCount(cardId,Math.min(countMax,count+1)) }, '▶'),
      ]),
      centerLbl(label, 'cards-card-lbl'),
      col([
        e('button', { className:'set-stepper-btn', disabled:pts<=0,  onClick:()=>onChangeCardValue(cardId,Math.max(0,pts-1))  }, '◀'),
        e('span',   { className:'set-stepper-val cards-qty-pts-lbl' }, pts),
        e('button', { className:'set-stepper-btn', disabled:pts>=20, onClick:()=>onChangeCardValue(cardId,Math.min(20,pts+1)) }, '▶'),
      ]),
    );
  };

  const masterRow = (suit) => {
    const iJ = suit === 'joker';
    const masterCnt = iJ ? getCount('JOKER') : Math.round(VALUES.reduce((s,v) => s + getCount(`${v}-${suit}`), 0) / VALUES.length);
    const masterPts = iJ ? getPts('JOKER')   : Math.round(VALUES.reduce((s,v) => s + getPts(`${v}-${suit}`),   0) / VALUES.length);
    return e('div', { className: 'cards-fused-row cards-master-row' },
      col([
        e('button', { className:'set-stepper-btn', disabled:masterCnt<=0,  onClick:()=>masterCount(suit,-1) }, '◀'),
        e('span',   { className:'set-stepper-val cards-qty-pts-lbl', style:{opacity:0.6} }, 'ALL'),
        e('button', { className:'set-stepper-btn', onClick:()=>masterCount(suit,+1) }, '▶'),
      ]),
      centerLbl(iJ ? '★' : (SYM[suit] || ''), 'cards-card-lbl'),
      col([
        e('button', { className:'set-stepper-btn', disabled:masterPts<=0,  onClick:()=>masterValue(suit,-1) }, '◀'),
        e('span',   { className:'set-stepper-val cards-qty-pts-lbl', style:{opacity:0.6} }, 'ALL'),
        e('button', { className:'set-stepper-btn', onClick:()=>masterValue(suit,+1) }, '▶'),
      ]),
    );
  };

  const totalCards  = stdCountDraftDeck(draft);
  const deckInvalid = totalCards < 2;

  // ── Cards section ────────────────────────────────────────────────────────
  const cardsContent = () => {
    const sym  = activeSuit === 'joker' ? '★' : SYM[activeSuit];
    const rows = activeSuit === 'joker'
      ? [fusedRow('JOKER', '★ JK', 40)]
      : VALUES.map(v => fusedRow(`${v}-${activeSuit}`, `${v} ${sym}`));

    const suitTabs = [
      { k:'hearts',   l:'♥ H' },
      { k:'diamonds', l:'♦ D' },
      { k:'clubs',    l:'♣ C' },
      { k:'spades',   l:'♠ S' },
      { k:'joker',    l:'★ JK' },
    ];

    return e('div', null,
      e('div', { className: 'inf-toggle-row' },
        e('div', null,
          e('span', { className: 'inf-toggle-lbl' }, 'Infinite Deck'),
          e('div',  { className: 'inf-toggle-sub' },
            draft.infiniteDeck ? 'Cards replenish every round' : 'Deck depletes as you play')
        ),
        e('button', {
          className: 'inf-toggle-btn ' + (draft.infiniteDeck ? 'on' : 'off'),
          onClick: () => onChange('infiniteDeck', !draft.infiniteDeck),
        },
          e('span', { className: 'inf-toggle-icon' }, draft.infiniteDeck ? '∞' : '—'),
          e('span', null, draft.infiniteDeck ? 'ON' : 'OFF')
        )
      ),
      e('div', { className: 'cards-section-total' + (deckInvalid ? ' invalid' : '') },
        `Total: ${totalCards} card${totalCards !== 1 ? 's' : ''}`,
        deckInvalid && e('span', null, ' — need at least 2')
      ),
      e('div', { className: 'cards-suit-tabs' },
        suitTabs.map(({ k, l }) =>
          e('button', { key: k, className: 'gb cards-suit-tab' + (activeSuit === k ? ' sel' : ''), onClick: () => setActiveSuit(k) }, l)
        )
      ),
      e('div', { className: 'cards-col-headers' },
        e('span', { className: 'cards-col-hdr-flex' },  'Qty'),
        e('span', { className: 'cards-col-hdr-fixed' }, 'Card'),
        e('span', { className: 'cards-col-hdr-flex' },  'Pts'),
      ),
      masterRow(activeSuit),
      ...rows,
    );
  };

  // ── Gambit modifiers ─────────────────────────────────────────────────────
  const getDM = draft.gambitMultipliers || {};
  const getGM = (key) => getDM[key] ?? 1;

  const GAMBIT_GROUPS = {
    value:      { label:'Value', entries:[{ key:'value-low',label:'▼ Low' },{ key:'value-high',label:'▲ High' }] },
    color:      { label:'Color', entries:[{ key:'color-red',label:'♥♦ Red' },{ key:'color-black',label:'♣♠ Black' }] },
    suit:       { label:'Suit',  entries:[{ key:'suit-hearts',label:'♥ Hearts' },{ key:'suit-diamonds',label:'♦ Diamonds' },{ key:'suit-clubs',label:'♣ Clubs' },{ key:'suit-spades',label:'♠ Spades' }] },
    valueColor: { label:'V+C',   entries:[{ key:'valueColor-low-red',label:'▼+♥♦' },{ key:'valueColor-low-black',label:'▼+♣♠' },{ key:'valueColor-high-red',label:'▲+♥♦' },{ key:'valueColor-high-black',label:'▲+♣♠' }] },
    valueSuit:  { label:'V+S',   entries:[
      { key:'valueSuit-low-hearts',label:'▼ ♥' },{ key:'valueSuit-low-diamonds',label:'▼ ♦' },
      { key:'valueSuit-low-clubs',label:'▼ ♣' },{ key:'valueSuit-low-spades',label:'▼ ♠' },
      { key:'valueSuit-high-hearts',label:'▲ ♥' },{ key:'valueSuit-high-diamonds',label:'▲ ♦' },
      { key:'valueSuit-high-clubs',label:'▲ ♣' },{ key:'valueSuit-high-spades',label:'▲ ♠' },
    ]},
    joker: { label:'⛧ Joker', entries:[{ key:'joker',label:'⛧ Joker Gambit' }] },
  };

  const masterGambitMult = (groupKey, delta) => {
    GAMBIT_GROUPS[groupKey].entries.forEach(({ key }) => {
      onChangeGambitMult(key, Math.max(0, Math.min(20, getGM(key) + delta)));
    });
  };

  const gmFusedRow = ({ key, label }) => {
    const val = getGM(key);
    const off = !!(draft.disabledGambits || {})[key];
    return e('div', { key, className:'cards-fused-row', style:{ alignItems:'center' } },
      e('span', { className:'cards-center-lbl cards-card-lbl',
        style:{ flex:1, textAlign:'left', paddingLeft:'4px', opacity:off?0.38:1, transition:'opacity 0.15s' } }, label),
      e('div', { className:'cards-col', style:{ opacity:off?0.38:1, transition:'opacity 0.15s' } },
        e('button', { className:'set-stepper-btn', disabled:val<=0||off,  onClick:()=>onChangeGambitMult(key,Math.max(0,val-1))  }, '◀'),
        e('span',   { className:'set-stepper-val' }, off ? '—' : val),
        e('button', { className:'set-stepper-btn', disabled:val>=20||off, onClick:()=>onChangeGambitMult(key,Math.min(20,val+1)) }, '▶'),
      ),
      e('button', {
        className: 'set-gambit-btn ' + (off ? 'off' : 'on'),
        style: { flexShrink:0, padding:'4px 8px', fontSize:'var(--font-xs)' },
        onClick: () => onChangeGambitDisabled(key, !off),
      }, off ? 'OFF' : 'ON'),
    );
  };

  const gambitModsContent = () => {
    const groupTabs = Object.entries(GAMBIT_GROUPS).map(([k, g]) => ({ k, l: g.label }));
    const grp       = GAMBIT_GROUPS[activeGambitGroup];
    const dg2       = draft.disabledGambits || {};
    const allOff    = grp.entries.every(({ key }) => !!dg2[key]);
    const masterToggleAll = () => grp.entries.forEach(({ key }) => onChangeGambitDisabled(key, !allOff));
    return e('div', null,
      e('div', { className:'cards-suit-tabs', style:{ flexWrap:'wrap', gap:'4px', marginBottom:'10px' } },
        groupTabs.map(({ k, l }) =>
          e('button', { key: k, className:'gb cards-suit-tab'+(activeGambitGroup===k?' sel':''), onClick:()=>setActiveGambitGroup(k), style:{ flex:'1', minWidth:'52px' } }, l)
        )
      ),
      e('div', { className:'cards-col-headers' },
        e('span', { style:{ flex:1 } }, 'Gambit'),
        e('span', { className:'cards-col-hdr-flex' }, 'Mult'),
        e('span', { style:{ flexShrink:0, width:'44px', textAlign:'center' } }, 'On'),
      ),
      e('div', { className:'cards-master-row' },
        e('span', { className:'set-stepper-val cards-master-lbl', style:{ flex:1, background:'none', border:'none', textAlign:'left', paddingLeft:'4px' } }, grp.label+' — All'),
        e('div', { className:'cards-col' },
          e('button', { className:'set-stepper-btn', onClick:()=>masterGambitMult(activeGambitGroup,-1) }, '◀'),
          e('span',   { className:'set-stepper-val cards-qty-pts-lbl' }, '×ALL'),
          e('button', { className:'set-stepper-btn', onClick:()=>masterGambitMult(activeGambitGroup,+1) }, '▶'),
        ),
        e('button', {
          className: 'set-gambit-btn ' + (allOff ? 'off' : 'on'),
          style: { flexShrink:0, padding:'4px 8px', fontSize:'var(--font-xs)' },
          onClick: masterToggleAll,
        }, allOff ? 'OFF' : 'ON'),
      ),
      ...grp.entries.map(entry => gmFusedRow(entry)),
    );
  };

  // ── Outcomes section ─────────────────────────────────────────────────────
  const universalOpToggle = (label, opKey, modKey, modMax = 20, targetKey = null) => {
    const op  = draft[opKey]  ?? 'add';
    const mod = draft[modKey] ?? 0;
    const minMod    = op === 'divide' ? 1 : 0;
    const displayMod = Math.max(minMod, mod);

    const handleOpChange = (newOp) => {
      onChange(opKey, newOp);
      if (newOp === 'divide' && mod === 0) onChange(modKey, 1);
    };

    const target    = targetKey ? (draft[targetKey] ?? 'cardValueAdd') : null;
    const targetRow = targetKey && e('div', { className:'set-row' },
      e('span', { className:'set-lbl' }, label + ' Target'),
      e('div', { style:{ display:'flex', gap:'4px', flexWrap:'wrap', justifyContent:'flex-end', flex:1, paddingLeft:'10px' } },
        e('button', { className:'set-gambit-btn '+(target==='total'?'on':'off'),          style:{ padding:'3px 6px', fontSize:'var(--font-xs)', flex:'1 1 60px' }, onClick:()=>onChange(targetKey,'total') },        'Total Score'),
        e('button', { className:'set-gambit-btn '+((target==='cardValueAdd')?'on':'off'), style:{ padding:'3px 6px', fontSize:'var(--font-xs)', flex:'1 1 60px' }, onClick:()=>onChange(targetKey,'cardValueAdd') }, 'Card Value +'),
        e('button', { className:'set-gambit-btn '+(target==='cardValueSub'?'on':'off'),   style:{ padding:'3px 6px', fontSize:'var(--font-xs)', flex:'1 1 60px' }, onClick:()=>onChange(targetKey,'cardValueSub') }, 'Card Value −')
      )
    );

    return e('div', null,
      targetRow,
      e('div', { className:'set-row' },
        e('span', { className:'set-lbl' }, label + ' Op.'),
        e('div', { style:{ display:'flex', gap:'4px', flexWrap:'wrap', justifyContent:'flex-end', flex:1, paddingLeft:'10px' } },
          e('button', { className:'set-gambit-btn '+(op==='add'?'on':'off'),      style:{ padding:'3px 6px', fontSize:'var(--font-xs)', flex:'1 1 40px' }, onClick:()=>handleOpChange('add') },      '+ Add'),
          e('button', { className:'set-gambit-btn '+(op==='subtract'?'on':'off'), style:{ padding:'3px 6px', fontSize:'var(--font-xs)', flex:'1 1 40px' }, onClick:()=>handleOpChange('subtract') }, '− Sub'),
          e('button', { className:'set-gambit-btn '+(op==='multiply'?'on':'off'), style:{ padding:'3px 6px', fontSize:'var(--font-xs)', flex:'1 1 40px' }, onClick:()=>handleOpChange('multiply') }, '× Mult'),
          e('button', { className:'set-gambit-btn '+(op==='divide'?'on':'off'),   style:{ padding:'3px 6px', fontSize:'var(--font-xs)', flex:'1 1 40px' }, onClick:()=>handleOpChange('divide') },   '÷ Div'),
        )
      ),
      e('div', { className:'set-row' },
        e('span', { className:'set-lbl' }, label + ' Modifier'),
        e('div', { className:'set-stepper' },
          e('button', { className:'set-stepper-btn', disabled:displayMod<=minMod, onClick:()=>onChange(modKey,Math.max(minMod,displayMod-1)) }, '◀'),
          e('span',   { className:'set-stepper-val' }, displayMod),
          e('button', { className:'set-stepper-btn', disabled:displayMod>=modMax, onClick:()=>onChange(modKey,Math.min(modMax,displayMod+1)) }, '▶'),
        )
      )
    );
  };

  const outcomesContent = () => {
    const sep = () => e('div', { className:'set-action-toggles-sep' });

    const tabContent = () => {
      if (activeOutcomeTab === 'win') return e('div', null,
        universalOpToggle('Lives',  'winLifeOp',   'winLifeMod',  20),
        sep(),
        universalOpToggle('Streak', 'winStreakOp', 'winStreakMod', 20)
      );

      if (activeOutcomeTab === 'lose') return e('div', null,
        universalOpToggle('Lives',  'loseLifeOp',   'loseLifeMod',  20),
        sep(),
        universalOpToggle('Streak', 'loseStreakOp', 'loseStreakMod', 20),
        sep(),
        universalOpToggle('Score',  'loseScoreOp',  'loseScoreMod', 20, 'loseScoreTarget')
      );

      if (activeOutcomeTab === 'skip') return e('div', null,
        e('div', { className:'set-action-toggles' },
          e('div', { className:'set-action-toggle-row' },
            e('span', { className:'set-lbl' }, 'Skip Action'),
            e('button', { className:'inf-toggle-btn '+(draft.skipsEnabled?'on':'off'), onClick:()=>onChange('skipsEnabled',!draft.skipsEnabled) }, draft.skipsEnabled?'✓ ON':'✕ OFF')
          ),
        ),
        universalOpToggle('Lives',  'skipLifeOp',   'skipLifeMod',  20),
        sep(),
        universalOpToggle('Streak', 'skipStreakOp', 'skipStreakMod', 20),
        sep(),
        universalOpToggle('Score',  'skipScoreOp',  'skipScoreMod',  20, 'skipScoreTarget'),
      );

      if (activeOutcomeTab === 'blank') return e('div', null,
        e('div', { className:'set-action-toggles' },
          e('div', { className:'set-action-toggle-row' },
            e('span', { className:'set-lbl' }, 'Blank Action'),
            e('button', { className:'inf-toggle-btn '+(draft.blanksEnabled?'on':'off'), onClick:()=>onChange('blanksEnabled',!draft.blanksEnabled) }, draft.blanksEnabled?'✓ ON':'✕ OFF')
          ),
        ),
        universalOpToggle('Lives',  'blankLifeOp',   'blankLifeMod',  20),
        sep(),
        universalOpToggle('Streak', 'blankStreakOp', 'blankStreakMod', 20),
        sep(),
        universalOpToggle('Score',  'blankScoreOp',  'blankScoreMod',  20, 'blankScoreTarget'),
      );

      if (activeOutcomeTab === 'dice') return e('div', null,
        sep(),
        stepper('Roll Attempts (0 = disabled)', 'deathsDoorRolls',     0, 5),
        stepper('Dice Sides (d2–d8)',           'deathsDoorDiceSides', 2, 8),
      );
      return null;
    };

    const outcomeTabs = [
      { k:'win',   l:'✨ Win' },
      { k:'lose',  l:'🩸 Loss' },
      { k:'skip',  l:'🌑 Skip' },
      { k:'blank', l:'🛡️ Blank' },
      { k:'dice',  l:'🎲 Dice' },
    ];

    return e('div', null,
      e('div', { className:'cards-suit-tabs', style:{ marginBottom:'10px' } },
        outcomeTabs.map(({ k, l }) =>
          e('button', { key: k, className:'gb cards-suit-tab'+(activeOutcomeTab===k?' sel':''), onClick:()=>setActiveOutcomeTab(k), style:{ flex:'1', minWidth:'48px', fontSize:'var(--font-xs)' } }, l)
        )
      ),
      tabContent()
    );
  };

  // ── Starting Conditions ──────────────────────────────────────────────────
  const startingContent = () => e('div', null,
    e('div', { className:'set-row' },
      e('div', null,
        e('span', { className:'set-lbl' }, 'Score Goal'),
        e('div',  { style:{ fontFamily:"'Cinzel',serif", fontSize:'var(--font-xs)', color:'var(--secondary-color)', marginTop:'2px' } },
          draft.scoreToBeatEnabled ? 'Win when score is reached' : 'Play indefinitely')
      ),
      e('button', {
        className: 'inf-toggle-btn ' + (draft.scoreToBeatEnabled ? 'on' : 'off'),
        onClick: () => onChange('scoreToBeatEnabled', !draft.scoreToBeatEnabled),
      }, draft.scoreToBeatEnabled ? '✓ ON' : '✕ OFF')
    ),
    draft.scoreToBeatEnabled && bigStepper('Score to Beat', 'scoreToBeat', 100, 10000, 100),
    e('div', { className:'set-inf-row' },
      stepper('Lives', 'startLives', 1, 100),
      e('div', { className:'set-inf-item' },
        e('div', { className:'set-inf-icon', style:{ color:'var(--lose-color)' } }, '♥'),
        e('div', { className:'set-inf-text' },
          e('span', { className:'set-lbl' }, 'Infinite Lives'),
          e('div',  { className:'set-inf-sub' }, draft.infiniteLives ? 'Can\'t die — play forever' : 'Normal life loss applies')
        ),
        e('button', {
          className: 'inf-toggle-btn ' + (draft.infiniteLives ? 'on' : 'off'),
          onClick: () => onChange('infiniteLives', !draft.infiniteLives),
        },
          e('span', { className:'inf-toggle-icon' }, draft.infiniteLives ? '∞' : '—'),
          e('span', null, draft.infiniteLives ? 'ON' : 'OFF')
        )
      ),
      stepper('Blanks', 'startBlanks', 0, 10),
      e('div', { className:'set-inf-item' },
        e('div', { className:'set-inf-icon', style:{ color:'var(--secondary-color)' } }, '🛡'),
        e('div', { className:'set-inf-text' },
          e('span', { className:'set-lbl' }, 'Infinite Blanks'),
          e('div',  { className:'set-inf-sub' }, draft.infiniteBlanks ? 'Blanks are never spent' : 'Normal blank deduction')
        ),
        e('button', {
          className: 'inf-toggle-btn ' + (draft.infiniteBlanks ? 'on' : 'off'),
          onClick: () => onChange('infiniteBlanks', !draft.infiniteBlanks),
        },
          e('span', { className:'inf-toggle-icon' }, draft.infiniteBlanks ? '∞' : '—'),
          e('span', null, draft.infiniteBlanks ? 'ON' : 'OFF')
        )
      )
    ),
    e('div', { style:{ marginTop:'10px', paddingTop:'10px', borderTop:'1px solid rgba(255,204,77,0.15)' } },
      stepper('Streak', 'startStreak', 0, 20),
    ),
  );

  // ── Presets ──────────────────────────────────────────────────────────────
  const presetCard = (p) => {
    const isActive = activePresetId === p.id;
    return e('div', {
      key: p.id,
      className: 'preset-card' + (isActive ? ' active' : ''),
      onClick: () => handleLoadPreset(p),
    },
      e('div', { className: 'preset-card-header' },
        e('span', { className: 'preset-card-name' }, p.name),
        e('span', { className: 'preset-card-tag' }, p.tag),
      ),
      e('div', { className: 'preset-card-desc' }, p.desc),
      isActive && e('div', { className: 'preset-card-check' }, '✓ Loaded'),
    );
  };

  const presetsContent = () => e('div', null,
    e('div', { className: 'preset-grid' }, STANDARD_PRESETS.map(p => presetCard(p)))
  );

  // ── Multiplayer section ──────────────────────────────────────────────────
  // Toggle for couch / pass-and-play multiplayer (Standard mode only).
  // All players share the deck, multipliers, and round outcomes — each
  // player has their own lives / blanks / streak / score and takes turns
  // one round at a time. Game ends when one player hits the score goal,
  // or all but one player are dead.
  const multiplayerContent = () => e('div', null,
    e('div', { className: 'set-row' },
      e('div', { style: { flex: 1, minWidth: 0, paddingRight: '10px' } },
        e('span', { className: 'set-lbl' }, 'Multiplayer'),
        e('div', {
          style: {
            fontFamily: "'Cinzel',serif", fontSize: 'var(--font-xs)',
            color: 'var(--secondary-color)', marginTop: '2px',
          },
        }, draft.multiplayer
          ? 'Pass-and-play: each player takes a turn'
          : 'Single player (default)')
      ),
      e('button', {
        className: 'inf-toggle-btn' + (draft.multiplayer ? ' on' : ' off'),
        onClick: () => onChange('multiplayer', !draft.multiplayer),
      }, draft.multiplayer ? '✓ ON' : '✕ OFF')
    ),
    draft.multiplayer && stepper('Number of Players', 'playerCount', 2, 5),
    draft.multiplayer && e('div', {
      style: {
        marginTop: '10px', padding: '8px 10px',
        background: 'rgba(255,204,77,0.06)', borderTop: '1px solid rgba(255,204,77,0.15)',
        fontSize: 'var(--font-xs)', color: 'var(--secondary-color)', lineHeight: '1.6',
      },
    },
      '💡 Each player gets their own personal deck (same cards, each shuffled differently), ',
      'plus their own lives, blanks, streak and score (all starting equal). ',
      'Players take turns one round at a time and share the gambit multipliers + round outcomes. ',
      'Uno-style finish: the first player to reach the score goal places 1st, the next 2nd, and so on; ',
      'the last player who can\'t finish (out of lives or out of cards) ends in last place.'
    ),
  );


  // ── Section registry ─────────────────────────────────────────────────────
  const sections = [
    { title: 'Presets',                 content: presetsContent },
    { title: 'Starting Conditions',     content: startingContent },
    { title: 'Multiplayer',             content: multiplayerContent },
    { title: 'Gambit Modifiers',        content: gambitModsContent },
    { title: 'Round Outcomes',          content: outcomesContent },
    { title: 'Shop Costs (streak pts)', content: () => e('div', null,
      stepper('Extra Life',    'costLife',         0, 20),
      stepper('Life Amount',   'shopLifeAmount',   0, 50),
      stepper('Blank Card',    'costBlank',        0, 20),
      stepper('Blank Amount',  'shopBlankAmount',  0, 10),
    )},
    { title: 'Cards · Counts & Values', content: cardsContent },
    // Sound volumes — uses the shared SoundControls component if loaded.
    { title: 'Sound',                   content: () => window.SoundControls
      ? e(window.SoundControls)
      : e('div', { style: { fontFamily:"'Cinzel',serif", fontSize:'var(--font-xs)', color:'var(--secondary-color)', padding:'10px 0' } },
          'Sound module not loaded (core/sound.js is missing).') },
  ];

  const clampedIdx = Math.min(secIdx, sections.length - 1);
  const sec     = sections[clampedIdx];
  const numSecs = sections.length;

  return e('div', { className: 'set-overlay' },
    e('div', { className: 'set-panel' },
      e('div', { className: 'set-title' }, '⚙ Standard Options'),
      gameActive && e('p', { className: 'set-warn' }, '⚠ Applying will reset the current game.'),
      e('div', { className: 'set-nav' },
        e('button', { className:'set-nav-arrow', disabled:clampedIdx===0,          onClick:()=>setSecIdx(i=>Math.max(0,i-1)) }, '‹'),
        e('div', { className: 'set-nav-info' },
          e('span', { className: 'set-nav-title' }, sec.title),
          e('div',  { className: 'set-nav-dots' },
            sections.map((_, i) => e('div', { key: i, className: 'set-nav-dot' + (i === clampedIdx ? ' active' : '') }))
          )
        ),
        e('button', { className:'set-nav-arrow', disabled:clampedIdx===numSecs-1, onClick:()=>setSecIdx(i=>Math.min(numSecs-1,i+1)) }, '›'),
      ),
      e('div', { className: 'set-section' }, sec.content()),
      e('div', { className: 'set-actions' },
        e('button', {
          className:'btn-start',
          onClick:onApply,
          disabled: stdCountDraftDeck(draft) < 2,
        }, gameActive ? 'Apply & Reset' : 'Start Game'),
        gameActive && e('button', { className:'btnsec', onClick:onCancel }, 'Cancel'),
                    e('button', { className:'btnsec set-back-btn', onClick:onReturnToMenu }, 'Main Menu'),
      )
    )
  );
}
// ──────────────────────────────────────────────────────────────────────────────
