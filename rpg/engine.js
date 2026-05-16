// ── RPG Mode — Engine ─────────────────────────────────────────────────────────
//
// Self-contained engine for RPG mode.  Owns its own live PRESET, deck logic,
// math, gambit logic, and stats helpers.  Nothing here references Standard
// mode.  Reads only the visual constants from core/shared.js.
//
// Globals exposed:
//   RPG_PRESET, RPG_PRESET_DEFAULTS
//   rpgMkDeck(), rpgNumVal(),
//   rpgDeriveGambit(), rpgCheckGambit(), rpgGambitKey(), rpgIsGambitDisabled(),
//   rpgApplyMathOp(),
//   rpgComputeDeckStats(), rpgCountDraftDeck()
//
// Load order:  shared.js → ... → rpg/presets.js → rpg/engine.js → ...
// ──────────────────────────────────────────────────────────────────────────────


// ── RPG preset defaults ──────────────────────────────────────────────────────
const RPG_PRESET_DEFAULTS = {
  // Starting conditions — startLives = player HP
  startLives:   20,
  startBlanks:  2,
  startStreak:  0,

  // Gambit base multipliers (fallbacks)
  multValue:      1,
  multColor:      1,
  multSuit:       3,
  multValueColor: 3,
  multValueSuit:  6,
  multJoker:      10,

  // Streak operations only — life is managed by combat damage in RPG
  winStreakOp:   'add',      winStreakMod:   1,
  loseStreakOp:  'subtract', loseStreakMod:  1,
  skipStreakOp:  'add',      skipStreakMod:  0,
  blankStreakOp: 'add',      blankStreakMod: 0,

  // Death's Door
  deathsDoorRolls:     1,
  deathsDoorDiceSides: 4,

  // Action availability
  blanksEnabled: true,
  skipsEnabled:  true,

  // Infinite modes
  infiniteLives:  false,
  infiniteBlanks: false,

  // Shop
  costLife:        2, shopLifeAmount:  20,
  costBlank:       4, shopBlankAmount: 1,

  // Enemy roster + selection — populated in app.js init
  selectedEnemyId: 'devil',
  rushMode:        false,
  rushQueue:       [],
  enemyRoster:     {},

  // Active-enemy combat stats (mirrored from roster on startGame / advance)
  enemyName:         'The Devil',
  enemyHP:           100,
  enemyAttackMin:    5,  enemyAttackMax: 30,
  enemyDefendMin:    5,  enemyDefendMax: 20,
  enemyAttackChance: 0.40, enemyDefendChance: 0.40,
  enemyAttackChanceIncrement: 0.05,
  enemyDefendChanceDecrement: 0.05,

  // Player action tuning
  rpgSkipHealPct:   10,
  rpgSkipDamagePct: 50,
  rpgBlankMult:     1.0,

  // Deck
  infiniteDeck:  false,
  defaultCount:  1,
  deckOverrides: (() => {
    const d = {};
    for (const s of ['hearts','diamonds','clubs','spades']) {
      for (const v of ['A','2','3','4','5','6','7','8','9','10','J','Q','K']) d[`${v}-${s}`] = 1;
    }
    d['JOKER'] = 2;
    return d;
  })(),
  cardValues: {
    '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
    '8': 8, '9': 9, '10': 10, 'J': 10, 'Q': 10, 'K': 10,
    'A': 20, 'JOKER': 20,
  },
  disabledGambits: {
    'value-low': false, 'value-high': false,
    'color-red': false, 'color-black': false,
    'suit-hearts': false, 'suit-diamonds': false, 'suit-clubs': false, 'suit-spades': false,
    'valueColor-low-red': false, 'valueColor-low-black': false,
    'valueColor-high-red': false, 'valueColor-high-black': false,
    'valueSuit-low-hearts': false, 'valueSuit-low-diamonds': false,
    'valueSuit-low-clubs': false, 'valueSuit-low-spades': false,
    'valueSuit-high-hearts': false, 'valueSuit-high-diamonds': false,
    'valueSuit-high-clubs': false, 'valueSuit-high-spades': false,
    'joker': false,
  },
  gambitMultipliers: {
    'value-low': 1, 'value-high': 1,
    'color-red': 1, 'color-black': 1,
    'suit-hearts': 3, 'suit-diamonds': 3, 'suit-clubs': 3, 'suit-spades': 3,
    'valueColor-low-red': 3, 'valueColor-low-black': 3,
    'valueColor-high-red': 3, 'valueColor-high-black': 3,
    'valueSuit-low-hearts': 6, 'valueSuit-low-diamonds': 6,
    'valueSuit-low-clubs': 6, 'valueSuit-low-spades': 6,
    'valueSuit-high-hearts': 6, 'valueSuit-high-diamonds': 6,
    'valueSuit-high-clubs': 6, 'valueSuit-high-spades': 6,
    'joker': 10,
  },
};
// ──────────────────────────────────────────────────────────────────────────────


// ── Live mutable PRESET ──────────────────────────────────────────────────────
const RPG_PRESET = {
  ...RPG_PRESET_DEFAULTS,
  deckOverrides:     { ...RPG_PRESET_DEFAULTS.deckOverrides },
  cardValues:        { ...RPG_PRESET_DEFAULTS.cardValues },
  disabledGambits:   { ...RPG_PRESET_DEFAULTS.disabledGambits },
  gambitMultipliers: { ...RPG_PRESET_DEFAULTS.gambitMultipliers },
};
// ──────────────────────────────────────────────────────────────────────────────


// ── Card value resolution ────────────────────────────────────────────────────
function rpgNumVal(v, suit) {
  let result;
  const cardKey = suit ? `${v}-${suit}` : null;

  if (cardKey && RPG_PRESET.cardValues && RPG_PRESET.cardValues[cardKey] !== undefined) {
    result = RPG_PRESET.cardValues[cardKey];
  } else if (RPG_PRESET.cardValues && RPG_PRESET.cardValues[v] !== undefined) {
    result = RPG_PRESET.cardValues[v];
  } else if (v === 'JOKER' || v === 'A') {
    result = 20;
  } else if (['J','Q','K'].includes(v)) {
    result = 10;
  } else {
    result = parseInt(v);
  }
  return Math.max(0, Math.min(20, result));
}
// ──────────────────────────────────────────────────────────────────────────────


// ── Math helper (subset used by RPG; score deltas aren't needed) ─────────────
function rpgApplyMathOp(val, op, mod) {
  if (op === 'add')      return val + mod;
  if (op === 'subtract') return Math.max(0, val - mod);
  if (op === 'multiply') return val * mod;
  if (op === 'divide')   return mod === 0 ? val : Math.floor(val / mod);
  return val;
}
// ──────────────────────────────────────────────────────────────────────────────


// ── Deck construction ────────────────────────────────────────────────────────
function rpgMkDeck() {
  const d = [];
  const clamp = (n) => Math.max(0, Math.min(20, n));

  for (const s of SUITS) {
    for (const v of VALUES) {
      const cardId   = `${v}-${s}`;
      const rawCount = RPG_PRESET.deckOverrides[cardId] !== undefined
        ? RPG_PRESET.deckOverrides[cardId]
        : RPG_PRESET.defaultCount;
      const count = clamp(rawCount);
      for (let i = 0; i < count; i++) {
        d.push({ suit: s, value: v, numValue: rpgNumVal(v, s), id: `${cardId}-${i}` });
      }
    }
  }

  const rawJoker = RPG_PRESET.deckOverrides['JOKER'] !== undefined
    ? RPG_PRESET.deckOverrides['JOKER']
    : 2;
  const jokerCount = Math.max(0, Math.min(40, rawJoker));
  for (let i = 0; i < jokerCount; i++) {
    d.push({ suit: 'joker', value: 'JOKER', numValue: rpgNumVal('JOKER', 'joker'), id: `joker-${i}` });
  }

  return d;
}

function rpgCountDraftDeck(draft) {
  let count = 0;
  for (const s of SUITS) {
    for (const v of VALUES) {
      const cardId = `${v}-${s}`;
      const cnt = draft.deckOverrides?.[cardId] !== undefined
        ? draft.deckOverrides[cardId]
        : draft.defaultCount ?? 1;
      count += Math.max(0, Math.min(20, cnt));
    }
  }
  count += Math.max(0, Math.min(40, draft.deckOverrides?.['JOKER'] ?? 2));
  return count;
}
// ──────────────────────────────────────────────────────────────────────────────


// ── Card classification ──────────────────────────────────────────────────────
function rpgGetHighness(card, table) {
  if (card.value === 'JOKER') return null;
  if (card.value === 'A') {
    if (!table || table.value === 'JOKER' || table.value === 'A') return null;
  }
  return HIGH.has(card.value) ? 'high' : 'low';
}

function rpgGetColor(card) {
  return ['hearts','diamonds'].includes(card.suit) ? 'red' : 'black';
}
// ──────────────────────────────────────────────────────────────────────────────


// ── Gambit logic ─────────────────────────────────────────────────────────────
function rpgCheckGambit(type, pred, hand, table) {
  if (type === 'joker') return hand.value === 'JOKER';
  if (hand.value === 'JOKER') return true;
  const h = rpgGetHighness(hand, table), c = rpgGetColor(hand);

  const autoWinValue = hand.value === 'A' && table && (table.value === 'A' || table.value === 'JOKER');
  const valueMatches = autoWinValue ? true : (pred.value === h);

  switch (type) {
    case 'value':      return valueMatches;
    case 'color':      return pred.color === c;
    case 'suit':       return pred.suit  === hand.suit;
    case 'valueColor': return valueMatches && pred.color === c;
    case 'valueSuit':  return valueMatches && pred.suit  === hand.suit;
  }
  return false;
}

function rpgDeriveGambit(sel) {
  if (!sel) return null;
  const { value: v, color: c, suit: s, joker: j } = sel;
  const gm = (key, fb) => RPG_PRESET.gambitMultipliers?.[key] ?? fb;

  if (j)          { const k='joker';                 return { type:'joker',      pred:{},                mult:gm(k,RPG_PRESET.multJoker),      label:'Joker Gambit',  desc:'⛧ All or Nothing' }; }
  if (!v&&!c&&!s) return null;
  if (v&&s&&!c)   { const k=`valueSuit-${v}-${s}`;   return { type:'valueSuit',  pred:{value:v,suit:s},  mult:gm(k,RPG_PRESET.multValueSuit),  label:'Value & Suit',  desc:cap(v)+' + '+SYM[s]+' '+cap(s) }; }
  if (v&&c&&!s)   { const k=`valueColor-${v}-${c}`;  return { type:'valueColor', pred:{value:v,color:c}, mult:gm(k,RPG_PRESET.multValueColor), label:'Value & Color', desc:cap(v)+' + '+cap(c) }; }
  if (v&&!c&&!s)  { const k=`value-${v}`;            return { type:'value',      pred:{value:v},         mult:gm(k,RPG_PRESET.multValue),      label:'Value Gambit',  desc:cap(v) }; }
  if (c&&!v&&!s)  { const k=`color-${c}`;            return { type:'color',      pred:{color:c},         mult:gm(k,RPG_PRESET.multColor),      label:'Color Gambit',  desc:colorLabel(c) }; }
  if (s&&!v&&!c)  { const k=`suit-${s}`;             return { type:'suit',       pred:{suit:s},          mult:gm(k,RPG_PRESET.multSuit),       label:'Suit Gambit',   desc:SYM[s]+' '+cap(s) }; }
  return null;
}

function rpgGambitKey(g) {
  if (!g) return null;
  switch (g.type) {
    case 'value':      return `value-${g.pred.value}`;
    case 'color':      return `color-${g.pred.color}`;
    case 'suit':       return `suit-${g.pred.suit}`;
    case 'valueColor': return `valueColor-${g.pred.value}-${g.pred.color}`;
    case 'valueSuit':  return `valueSuit-${g.pred.value}-${g.pred.suit}`;
    case 'joker':      return 'joker';
  }
  return null;
}

function rpgIsGambitDisabled(g) {
  if (!g) return false;
  const k = rpgGambitKey(g);
  return !!(RPG_PRESET.disabledGambits && RPG_PRESET.disabledGambits[k]);
}
// ──────────────────────────────────────────────────────────────────────────────


// ── Deck statistics ──────────────────────────────────────────────────────────
function rpgComputeDeckStats(deck) {
  const s = { high:0, low:0, ace:0, joker:0, hearts:0, diamonds:0, clubs:0, spades:0 };
  for (const c of deck) {
    if      (c.value === 'JOKER') s.joker++;
    else if (c.value === 'A')     s.ace++;
    else if (HIGH.has(c.value))   s.high++;
    else                          s.low++;
    if      (c.suit === 'hearts')   s.hearts++;
    else if (c.suit === 'diamonds') s.diamonds++;
    else if (c.suit === 'clubs')    s.clubs++;
    else if (c.suit === 'spades')   s.spades++;
  }
  return s;
}
// ──────────────────────────────────────────────────────────────────────────────
