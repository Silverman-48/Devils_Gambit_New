// ── RPG Mode — UI components ──────────────────────────────────────────────────
//
// All RPG-specific React components.  Reads RPG_PRESET / RPG_PRESETS /
// ENEMY_PRESETS.  Independent of Standard mode.
//
// Exports:
//   RpgGambitPanel, RpgShop, RpgSettingsPanel, RpgInfoPanel,
//   RpgRoundHistory, RpgDeckInfo
//
// Load order: ... → rpg/gameplay.js → rpg/components.js → ...
// ──────────────────────────────────────────────────────────────────────────────


// ── RpgGambitPanel ───────────────────────────────────────────────────────────
function RpgGambitPanel({ sel, onToggle, derived, gs, disabled, result, lastChance, diceState, onRoll, enemySlain }) {
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

  const isJoker      = derived && derived.type === 'joker';
  const gambitOff    = derived && rpgIsGambitDisabled(derived);
  const isResultWin  = result && (result.won || result.action === 'blank');
  const isResultNtrl = result && result.action === 'skip';

  const displayCls = 'gambit-display' + (
    enemySlain ? ' result-win' :
    lastChance ? ' last-chance' :
    result     ? (isResultWin ? ' result-win' : isResultNtrl ? ' result-ntrl' : ' result-lose') :
    (derived   ? (gambitOff ? ' active-disabled' : isJoker ? ' active-joker' : ' active') : '')
  );

  const sides      = RPG_PRESET.deathsDoorDiceSides || 4;
  const totalRolls = RPG_PRESET.deathsDoorRolls || 1;
  const rollsLeft  = diceState?.rollsLeft ?? totalRolls;
  const diceName   = 'D' + sides;

  return e('div', { className: 'gambit-panel' },
    e('div', { className: displayCls },

      // ── Enemy slain interstitial ──────────────────────────────────────────
      enemySlain ? e('div', { className: 'gd-res-inner' },
        e('span', { className: 'gd-resicon' }, '★'),
        e('div',  { className: 'gd-restitle win' }, 'Enemy Slain'),
        e('div',  { className: 'gd-respts' }, 'Prepare for the next foe — shop is open')

      // ── Death's Door dice ─────────────────────────────────────────────────
      ) : lastChance ? e('div', { className: 'gd-dice' },
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

      // ── Combat result display ─────────────────────────────────────────────
      ) : result ? e('div', { className: 'gd-result' },
        (() => {
          const r  = result.rpg || {};
          const cr = r.combatResult;
          const cases = {
            'dealt':            ['⚔', 'Attack landed',    `−${r.enemyDamage} enemy HP`],
            'counter':          ['🔰', 'Counter!',         `Blocked · −${r.enemyDamage} enemy HP`],
            'draw':             ['⚖', 'Draw',              'Forces cancel out'],
            'hit':              ['💥', 'Hit taken',         `−${r.playerDamage} HP`],
            'miss-safe':        ['🌑', 'Miss — safe',       'Enemy idle, no penalty'],
            'miss-hit':         ['🩸', 'Hit!',              `−${r.playerDamage} HP`],
            'halfhit':          ['🛡', 'Partial block',     `−${r.playerDamage} HP`],
            'regen':            ['❤️', 'Partial heal',     `+${r.healAmount} HP`],
            'blank-strike':     ['⚔', 'Blank strike',      `−${r.enemyDamage} enemy HP`],
            'blocked':          ['🛡️', 'Attack nullified',  `${r.attackValue} damage blocked`],
            'broke-guard':      ['🔰', 'Guard broken!',    `−${r.enemyDamage} enemy HP`],
            'guard-hit':        ['🛡️', 'Repelled!',        `Guard deflects −${r.playerDamage} HP`],
            'miss-guard':       ['🛡️', 'Repelled!',        `Guard deflects −${r.playerDamage} HP`],
            'blank-broke-guard':['⚔', 'Guard broken!',    `−${r.enemyDamage} enemy HP`],
            'blank-guard-hit':  ['🛡️', 'Blank repelled',  `Guard deflects −${r.playerDamage} HP`],
            'blank-guard-draw': ['⚖', 'Blank absorbed',   'Forces cancel out'],
          };
          const [icon, title, detail] = cases[cr] || ['?', cr || '—', ''];
          const titleCls = ['dealt','counter','blank-strike','blocked','regen','broke-guard','blank-broke-guard'].includes(cr) ? 'win'
            : ['draw','miss-safe','blank-guard-draw'].includes(cr) ? 'ntrl' : 'lose';
          return e('div', { className: 'gd-res-inner' },
            e('span', { className: 'gd-resicon' }, icon),
            e('div',  { className: 'gd-restitle ' + titleCls }, title),
            e('div',  { className: 'gd-respts' }, detail)
          );
        })()

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
          gs.enemyState === 'attack'
            ? e('span', null,
                'Gambit score: ', e('b', null, `${(gs.tableCard.numValue + gs.streak) * derived.mult}`),
                ' vs enemy ', e('b', { style:{ color:'#e04040' } }, gs.enemyAttackValue)
              )
            : gs.enemyState === 'defensive'
              ? e('span', null,
                  'Gambit score: ', e('b', null, `${(gs.tableCard.numValue + gs.streak) * derived.mult}`),
                  ' vs guard ', e('b', { style:{ color:'#60a0e0' } }, gs.enemyDefendValue)
                )
              : e('span', null,
                  'Damage: ', e('b', null,
                    `(${gs.tableCard.numValue} + ${gs.streak}) × ${derived.mult} = ${(gs.tableCard.numValue + gs.streak) * derived.mult}`
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


// ── RpgShop ──────────────────────────────────────────────────────────────────
function RpgShop({ gs, buyLife, buyBlank }) {
  const e = React.createElement;
  return e('div', { className: 'respan' },
    e('div', { className: 'shopitems' },
      e('div', { className: 'shopitem' },
        e('div', { className: 'shopil' },
          e('span', { className: 'shopname' }, `❤ Heal (+${RPG_PRESET.shopLifeAmount} HP)`),
          RPG_PRESET.infiniteLives
            ? e('span', { className: 'shopcost' }, '∞ Infinite HP active')
            : e('span', { className: 'shopcost' }, 'Cost: ' + RPG_PRESET.costLife + ' streak points')
        ),
        e('button', {
          className: 'btngold',
          onClick: buyLife,
          disabled: gs.streak < RPG_PRESET.costLife || RPG_PRESET.infiniteLives || gs.lives >= gs.startLives,
        }, gs.lives >= gs.startLives ? 'Full HP' : 'Buy')
      ),
      RPG_PRESET.blanksEnabled && e('div', { className: 'shopitem' },
        e('div', { className: 'shopil' },
          e('span', { className: 'shopname' }, `🛡️ Blank Card (+${RPG_PRESET.shopBlankAmount})`),
          RPG_PRESET.infiniteBlanks
            ? e('span', { className: 'shopcost' }, '∞ Infinite blanks active')
            : e('span', { className: 'shopcost' }, 'Cost: ' + RPG_PRESET.costBlank + ' streak points')
        ),
        e('button', {
          className: 'btngold',
          onClick: buyBlank,
          disabled: gs.streak < RPG_PRESET.costBlank || RPG_PRESET.infiniteBlanks,
        }, 'Buy')
      )
    )
  );
}
// ──────────────────────────────────────────────────────────────────────────────


// ── RpgDeckInfo ──────────────────────────────────────────────────────────────
function RpgDeckInfo({ gs }) {
  const e = React.createElement;
  if (!gs) return null;
  const total = gs.deck.length;
  const s = rpgComputeDeckStats(gs.deck);
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


// ── RpgRoundHistory ──────────────────────────────────────────────────────────
function RpgRoundHistory({ history }) {
  const e = React.createElement;
  const [open, setOpen] = React.useState(true);
  if (!history || !history.length) return null;

  const fmtLives  = (n) => RPG_PRESET.infiniteLives  ? '∞' : n;
  const fmtBlanks = (n) => RPG_PRESET.infiniteBlanks ? '∞' : n;

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
              e('span', { className: 'rhe-score' },     entry.score.toLocaleString() + ' dmg')
            ),
            e('div', { className: 'rhe-bottom' },
              e('span', { className: 'rhe-shop-item' }, entry.item),
              e('span', { className: 'rhe-divider' }),
              e('span', { className: 'rhe-shop-cost' }, '−' + entry.cost + ' streak'),
              e('span', { className: 'rhe-divider' }),
              e('span', { className: 'rhe-stats' }, '❤' + fmtLives(entry.lives) + '  🛡' + fmtBlanks(entry.blanks) + '  ~' + entry.streak)
            )
          );
        }
        const outIcon = entry.outcome==='win'?'⚔':entry.outcome==='blank'?'🛡️':entry.outcome==='skip'?'🌑':entry.outcome==='instant'?'💀':'🩸';
        const outWord = entry.outcome==='win'?'Hit':entry.outcome==='blank'?'Blank':entry.outcome==='skip'?'Skip':entry.outcome==='instant'?'Forfeit':'Defeat';
        const outCls  = (entry.outcome==='win'||entry.outcome==='blank') ? 'win' : entry.outcome==='skip' ? 'ntrl' : 'lose';
        const ptsTxt  = entry.pts > 0 ? '+' + entry.pts + ' dmg' : '';
        return e('div', { key: i, className: 'rhe' },
          e('div', { className: 'rhe-top' },
            e('span', { className: 'rhe-badge' },           'R' + entry.round),
            e('span', { className: 'rhe-outcome ' + outCls }, outIcon + ' ' + outWord),
            ptsTxt && e('span', { className: 'rhe-pts' }, ptsTxt),
            e('span', { className: 'rhe-score' }, entry.score.toLocaleString() + ' dmg')
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
            e('span', { className: 'rhe-stats' }, '❤' + fmtLives(entry.lives) + '  🛡' + fmtBlanks(entry.blanks) + '  ~' + entry.streak)
          )
        );
      })
    )
  );
}
// ──────────────────────────────────────────────────────────────────────────────


// ── RpgInfoPanel ─────────────────────────────────────────────────────────────
function RpgInfoPanel({ gs, history, onClose }) {
  const e = React.createElement;
  return e('div', { className: 'info-overlay' },
    e('div', { className: 'info-panel' },
      e('div', { className: 'info-title' }, '⛧ The Ledger ⛧'),
      e('div', { className: 'info-sub' },   'Deck & Combat Records'),
      e(RpgDeckInfo, { gs }),
      history && history.length
        ? e(RpgRoundHistory, { history })
        : e('div', { className: 'info-empty' }, 'No rounds played yet'),
      e('div', { className: 'info-close' },
        e('button', { className:'btnsec', style:{ width:'100%' }, onClick:onClose }, 'Close')
      )
    )
  );
}
// ──────────────────────────────────────────────────────────────────────────────


// ── RpgSettingsPanel ─────────────────────────────────────────────────────────
function RpgSettingsPanel({
  draft, onChange, onChangeDeckCount, onChangeCardValue,
  onChangeGambitDisabled, onChangeGambitMult,
  onChangeEnemyStat, onResetEnemyStats,
  onApplyPreset, onApply, onCancel, onReturnToMenu, gameActive,
}) {
  const e = React.createElement;

  const [secIdx,            setSecIdx]            = React.useState(0);
  const [activeSuit,        setActiveSuit]        = React.useState('hearts');
  const [activeGambitGroup, setActiveGambitGroup] = React.useState('value');
  const [activeOutcomeTab,  setActiveOutcomeTab]  = React.useState('win');
  const [activePresetId,    setActivePresetId]    = React.useState(null);

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

  const sliderRow = (label, min, max, step, value, display, onCh) =>
    e('div', { className:'set-row' },
      e('span', { className:'set-lbl' }, label),
      e('div', { style:{ display:'flex', alignItems:'center', gap:'8px', flex:1, justifyContent:'flex-end' } },
        e('input', { type:'range', min, max, step, value, style:{ maxWidth:'120px' }, onChange: onCh }),
        e('span',  { className:'set-slider-val' }, display),
      )
    );

  // ── Card / deck helpers ───────────────────────────────────────────────────
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
        e('button', { className:'set-stepper-btn', disabled:masterCnt<=0, onClick:()=>masterCount(suit,-1) }, '◀'),
        e('span',   { className:'set-stepper-val cards-qty-pts-lbl', style:{opacity:0.6} }, 'ALL'),
        e('button', { className:'set-stepper-btn', onClick:()=>masterCount(suit,+1) }, '▶'),
      ]),
      centerLbl(iJ ? '★' : (SYM[suit] || ''), 'cards-card-lbl'),
      col([
        e('button', { className:'set-stepper-btn', disabled:masterPts<=0, onClick:()=>masterValue(suit,-1) }, '◀'),
        e('span',   { className:'set-stepper-val cards-qty-pts-lbl', style:{opacity:0.6} }, 'ALL'),
        e('button', { className:'set-stepper-btn', onClick:()=>masterValue(suit,+1) }, '▶'),
      ]),
    );
  };

  const totalCards  = rpgCountDraftDeck(draft);
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

  // ── Outcomes: streak ops only + skip/blank/dice tuning ──────────────────
  const universalOpToggle = (label, opKey, modKey, modMax = 20) => {
    const op  = draft[opKey]  ?? 'add';
    const mod = draft[modKey] ?? 0;
    const minMod    = op === 'divide' ? 1 : 0;
    const displayMod = Math.max(minMod, mod);
    const handleOpChange = (newOp) => {
      onChange(opKey, newOp);
      if (newOp === 'divide' && mod === 0) onChange(modKey, 1);
    };
    return e('div', null,
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
        universalOpToggle('Streak', 'winStreakOp', 'winStreakMod', 20)
      );
      if (activeOutcomeTab === 'lose') return e('div', null,
        universalOpToggle('Streak', 'loseStreakOp', 'loseStreakMod', 20)
      );
      if (activeOutcomeTab === 'skip') {
        const skipHeal = draft.rpgSkipHealPct   ?? 10;
        const skipDmg  = draft.rpgSkipDamagePct ?? 50;
        return e('div', null,
          e('div', { className:'set-action-toggles' },
            e('div', { className:'set-action-toggle-row' },
              e('span', { className:'set-lbl' }, 'Skip Action'),
              e('button', { className:'inf-toggle-btn '+(draft.skipsEnabled?'on':'off'), onClick:()=>onChange('skipsEnabled',!draft.skipsEnabled) }, draft.skipsEnabled?'✓ ON':'✕ OFF')
            ),
          ),
          universalOpToggle('Streak', 'skipStreakOp', 'skipStreakMod', 20),
          sep(),
          sliderRow('Skip Heal',   0,  50, 5, skipHeal, skipHeal + '%',
            ev => onChange('rpgSkipHealPct', Number(ev.target.value))),
          sliderRow('Skip Damage', 0, 100, 5, skipDmg,  skipDmg  + '%',
            ev => onChange('rpgSkipDamagePct', Number(ev.target.value))),
        );
      }
      if (activeOutcomeTab === 'blank') {
        const blankMult = draft.rpgBlankMult ?? 1.0;
        return e('div', null,
          e('div', { className:'set-action-toggles' },
            e('div', { className:'set-action-toggle-row' },
              e('span', { className:'set-lbl' }, 'Blank Action'),
              e('button', { className:'inf-toggle-btn '+(draft.blanksEnabled?'on':'off'), onClick:()=>onChange('blanksEnabled',!draft.blanksEnabled) }, draft.blanksEnabled?'✓ ON':'✕ OFF')
            ),
          ),
          universalOpToggle('Streak', 'blankStreakOp', 'blankStreakMod', 20),
          sep(),
          e('div', { className:'set-row' },
            e('span', { className:'set-lbl' }, 'Blank Multiplier'),
            e('div', { className:'set-stepper' },
              e('button', { className:'set-stepper-btn',
                disabled: blankMult <= 0.5,
                onClick: () => onChange('rpgBlankMult', Math.max(0.5, +(blankMult - 0.5).toFixed(1))),
              }, '◀'),
              e('span', { className:'set-stepper-val' }, blankMult.toFixed(1) + '×'),
              e('button', { className:'set-stepper-btn',
                disabled: blankMult >= 5.0,
                onClick: () => onChange('rpgBlankMult', Math.min(5.0, +(blankMult + 0.5).toFixed(1))),
              }, '▶'),
            )
          ),
        );
      }
      if (activeOutcomeTab === 'dice') return e('div', null,
        sep(),
        stepper('Roll Attempts (0 = disabled)', 'deathsDoorRolls',     0, 5),
        stepper('Dice Sides (d2–d8)',           'deathsDoorDiceSides', 2, 8),
      );
      return null;
    };

    const outcomeTabs = [
      { k:'win',   l:'⚔ Win' },
      { k:'lose',  l:'🩸 Loss' },
      { k:'skip',  l:'🌑 Skip' },
      { k:'blank', l:'🛡️ Blank' },
      { k:'dice',  l:'🎲 Dice' },
    ];

    return e('div', null,
      e('div', { style:{
        marginBottom:'10px', padding:'8px 10px',
        borderRadius:'6px', background:'rgba(255,204,77,0.07)',
        fontSize:'var(--font-xs)', color:'var(--secondary-color)', lineHeight:'1.5',
      } },
        '⚔ In RPG mode, HP is managed by combat damage. Only streak modifiers apply here.'
      ),
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
    e('div', { className:'set-inf-row' },
      stepper('Player HP', 'startLives', 1, 100),
      e('div', { className:'set-inf-item' },
        e('div', { className:'set-inf-icon', style:{ color:'var(--lose-color)' } }, '❤'),
        e('div', { className:'set-inf-text' },
          e('span', { className:'set-lbl' }, 'Infinite Lives'),
          e('div',  { className:'set-inf-sub' }, draft.infiniteLives ? 'Can\'t die — play forever' : 'Normal HP loss applies')
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

  // ── Combat Settings (per-enemy stat editor) ──────────────────────────────
  const combatContent = () => {
    if (!ENEMY_PRESETS.length) return null;
    const ids       = ENEMY_PRESETS.map(p => p.id);
    const selId     = draft.selectedEnemyId || ids[0];
    const selIdx    = Math.max(0, ids.indexOf(selId));
    const enemy     = (draft.enemyRoster && draft.enemyRoster[selId]) || {};

    const get = (key, fb) => enemy[key] ?? fb;
    const set = (key, val) => onChangeEnemyStat(key, val);

    const cyc = (dir) => {
      const newIdx = (selIdx + dir + ids.length) % ids.length;
      onChange('selectedEnemyId', ids[newIdx]);
    };

    const chancePct  = Math.round((get('enemyAttackChance',          0.40)) * 100);
    const defendPct  = Math.round((get('enemyDefendChance',          0.40)) * 100);
    const atkIncrPct = Math.round((get('enemyAttackChanceIncrement', 0.05)) * 100);
    const defDecrPct = Math.round((get('enemyDefendChanceDecrement', 0.05)) * 100);

    const aMin = get('enemyAttackMin', 5);
    const aMax = get('enemyAttackMax', 30);
    const dMin = get('enemyDefendMin', 5);
    const dMax = get('enemyDefendMax', 15);
    const hp   = get('enemyHP', 100);

    const sec = (label, first = false) =>
      e('div', { className:'set-stitle', style:{ marginTop: first ? '10px' : '18px' } }, label);

    const enemyStepper = (label, key, min, max, value, disabledLeft, disabledRight, onLeft, onRight) =>
      e('div', { className:'set-row' },
        e('span', { className:'set-lbl' }, label),
        e('div', { className:'set-stepper' },
          e('button', { className:'set-stepper-btn', disabled: disabledLeft,  onClick: onLeft  }, '◀'),
          e('span',   { className:'set-stepper-val' }, value),
          e('button', { className:'set-stepper-btn', disabled: disabledRight, onClick: onRight }, '▶'),
        )
      );

    return e('div', null,
      e('div', { className: 'enemy-cycler' },
        e('button', { className:'set-nav-arrow', onClick: () => cyc(-1) }, '‹'),
        e('div', { className: 'enemy-cycler-info' },
          e('div', { className: 'enemy-cycler-name' }, get('enemyName', ENEMY_PRESETS[selIdx].name)),
          e('div', { className: 'enemy-cycler-tag' }, ENEMY_PRESETS[selIdx].tag),
        ),
        e('button', { className:'set-nav-arrow', onClick: () => cyc(1) }, '›'),
      ),
      e('button', {
        className: 'enemy-reset-btn',
        onClick: onResetEnemyStats,
      }, '↻ Reset to Default'),

      sec('❤  Vitality', true),
      enemyStepper('Enemy HP', 'enemyHP', 50, 1000, hp,
        hp <= 50,   hp >= 1000,
        () => set('enemyHP', Math.max(50,   hp - 50)),
        () => set('enemyHP', Math.min(1000, hp + 50))),

      sec('⚔  Attack'),
      enemyStepper('Damage Min', 'enemyAttackMin', 1, 200, aMin,
        aMin <= 1,        aMin >= aMax - 1,
        () => set('enemyAttackMin', Math.max(1,        aMin - 1)),
        () => set('enemyAttackMin', Math.min(aMax - 1, aMin + 1))),
      enemyStepper('Damage Max', 'enemyAttackMax', 1, 200, aMax,
        aMax <= aMin + 1, aMax >= 200,
        () => set('enemyAttackMax', Math.max(aMin + 1, aMax - 1)),
        () => set('enemyAttackMax', Math.min(200,      aMax + 1))),
      sliderRow('Attack Chance',  0, 100, 5, chancePct,  chancePct  + '%',
        ev => set('enemyAttackChance', Number(ev.target.value) / 100)),
      sliderRow('Attack Buildup', 0,  25, 1, atkIncrPct, '+' + atkIncrPct + '%',
        ev => set('enemyAttackChanceIncrement', Number(ev.target.value) / 100)),

      sec('🛡  Defense'),
      enemyStepper('Guard Min', 'enemyDefendMin', 1, 200, dMin,
        dMin <= 1,        dMin >= dMax - 1,
        () => set('enemyDefendMin', Math.max(1,        dMin - 1)),
        () => set('enemyDefendMin', Math.min(dMax - 1, dMin + 1))),
      enemyStepper('Guard Max', 'enemyDefendMax', 1, 200, dMax,
        dMax <= dMin + 1, dMax >= 200,
        () => set('enemyDefendMax', Math.max(dMin + 1, dMax - 1)),
        () => set('enemyDefendMax', Math.min(200,      dMax + 1))),
      sliderRow('Defend Chance', 0, 100, 5, defendPct,  defendPct  + '%',
        ev => set('enemyDefendChance', Number(ev.target.value) / 100)),
      sliderRow('Guard Decay',   0,  25, 1, defDecrPct, '−' + defDecrPct + '%',
        ev => set('enemyDefendChanceDecrement', Number(ev.target.value) / 100)),

      e('div', { style:{
        marginTop:'16px', padding:'8px 10px',
        background:'rgba(255,204,77,0.06)', borderTop:'1px solid rgba(255,204,77,0.15)',
        fontSize:'var(--font-xs)', color:'var(--secondary-color)', lineHeight:'1.6',
      } },
        '💡 Edits apply only to the selected enemy. Use Enemy Selection to choose who you face.'
      ),
    );
  };

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
    e('div', { className: 'preset-grid' }, RPG_PRESETS.map(p => presetCard(p)))
  );

  // ── Enemy Selection ──────────────────────────────────────────────────────
  const enemySelectionContent = () => {
    const queue = draft.rushQueue || [];
    const sel   = draft.selectedEnemyId;
    const rush  = !!draft.rushMode;
    const findE = (id) => ENEMY_PRESETS.find(p => p.id === id);

    return e('div', null,
      e('div', { className: 'set-stitle' }, '⚔  Mode'),
      e('div', { className: 'enemy-mode-toggle' },
        e('button', {
          className: 'enemy-mode-btn' + (!rush ? ' active' : ''),
          onClick: () => onChange('rushMode', false),
        }, '⚔ Single Foe'),
        e('button', {
          className: 'enemy-mode-btn' + (rush ? ' active' : ''),
          onClick: () => onChange('rushMode', true),
        }, '☠ Enemy Rush'),
      ),

      !rush && e('div', null,
        e('div', { className: 'set-stitle', style: { marginTop:'18px' } }, '☠  Choose Your Foe'),
        e('div', { className: 'preset-grid' },
          ENEMY_PRESETS.map(p => {
            const isActive = sel === p.id;
            return e('div', {
              key: p.id,
              className: 'preset-card preset-card-enemy' + (isActive ? ' active' : ''),
              onClick: () => onChange('selectedEnemyId', p.id),
            },
              e('div', { className:'preset-card-header' },
                e('span', { className:'preset-card-name' }, p.name),
                e('span', { className:'preset-card-tag' }, p.tag),
              ),
              e('div', { className:'preset-card-desc' }, p.desc),
              isActive && e('div', { className:'preset-card-check' }, '✓ Selected'),
            );
          })
        )
      ),

      rush && e('div', null,
        e('div', { className: 'set-stitle', style: { marginTop:'18px' } }, '➕  Add to Gauntlet'),
        e('div', { className: 'rush-add-grid' },
          ENEMY_PRESETS.map(p =>
            e('button', {
              key: p.id,
              className: 'rush-add-btn',
              onClick: () => onChange('rushQueue', [...queue, p.id]),
              title: p.desc,
            },
              e('span', { className: 'rush-add-name' }, p.name),
              e('span', { className: 'rush-add-plus' }, '+')
            )
          )
        ),
        e('div', { className: 'set-stitle', style: { marginTop:'18px' } },
          '⚔  Gauntlet (', queue.length, ')'),
        queue.length === 0
          ? e('div', { className: 'rush-empty' }, 'Add enemies above to build your gauntlet.')
          : e('div', { className: 'rush-queue' },
              queue.map((id, idx) => {
                const en = findE(id);
                if (!en) return null;
                return e('div', { key: idx, className: 'rush-queue-row' },
                  e('span', { className: 'rush-queue-idx' }, (idx + 1) + '.'),
                  e('span', { className: 'rush-queue-name' }, en.name),
                  e('span', { className: 'rush-queue-tag' }, en.tag),
                  e('button', {
                    className: 'rush-queue-btn',
                    disabled: idx === 0,
                    onClick: () => {
                      const q = [...queue];
                      [q[idx-1], q[idx]] = [q[idx], q[idx-1]];
                      onChange('rushQueue', q);
                    },
                  }, '▲'),
                  e('button', {
                    className: 'rush-queue-btn',
                    disabled: idx === queue.length - 1,
                    onClick: () => {
                      const q = [...queue];
                      [q[idx+1], q[idx]] = [q[idx], q[idx+1]];
                      onChange('rushQueue', q);
                    },
                  }, '▼'),
                  e('button', {
                    className: 'rush-queue-btn rush-queue-btn-x',
                    onClick: () => onChange('rushQueue', queue.filter((_, i) => i !== idx)),
                  }, '✕'),
                );
              })
            )
      ),
    );
  };

  // ── Section registry ─────────────────────────────────────────────────────
  const sections = [
    { title: 'Presets',                 content: presetsContent },
    { title: 'Enemy Selection',         content: enemySelectionContent },
    { title: 'Starting Conditions',     content: startingContent },
    { title: 'Gambit Modifiers',        content: gambitModsContent },
    { title: 'Round Outcomes',          content: outcomesContent },
    { title: 'Shop Costs (streak pts)', content: () => e('div', null,
      stepper('Heal Cost',    'costLife',         0, 20),
      stepper('Heal Amount',  'shopLifeAmount',   0, 50),
      stepper('Blank Cost',   'costBlank',        0, 20),
      stepper('Blank Amount', 'shopBlankAmount',  0, 10),
    )},
    { title: 'Combat Settings',         content: combatContent },
    { title: 'Cards · Counts & Values', content: cardsContent },
  ];

  const clampedIdx = Math.min(secIdx, sections.length - 1);
  const sec     = sections[clampedIdx];
  const numSecs = sections.length;

  return e('div', { className: 'set-overlay' },
    e('div', { className: 'set-panel' },
      e('div', { className: 'set-title' }, '⚔ RPG Options'),
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
          disabled: rpgCountDraftDeck(draft) < 2 || (draft.rushMode && (!draft.rushQueue || draft.rushQueue.length === 0)),
        }, gameActive ? 'Apply & Reset' : 'Apply'),
        e('button', { className:'btnsec', onClick:onCancel }, 'Cancel'),
        e('button', { className:'btnsec set-back-btn', onClick:onReturnToMenu }, '← Main Menu'),
      )
    )
  );
}
// ──────────────────────────────────────────────────────────────────────────────
