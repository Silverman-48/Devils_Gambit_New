// ── Standard Mode — Engine ────────────────────────────────────────────────────
//
// Self-contained engine for Standard mode.  Owns its own live PRESET object,
// deck construction, math, gambit logic, and stats helpers.  Nothing here
// references RPG mode or any shared mutable state besides the visual
// constants (SUITS / VALUES / SYM / HIGH) from core/shared.js.
//
// Globals exposed:
//   STD_PRESET                         — live, mutable settings object
//   STD_PRESET_DEFAULTS                — frozen defaults (for reset)
//   stdMkDeck(), stdNumVal(),
//   stdDeriveGambit(), stdCheckGambit(), stdGambitKey(), stdIsGambitDisabled(),
//   stdApplyMathOp(), stdCalcScoreDelta(),
//   stdComputeDeckStats(), stdCountDraftDeck()
//
// Load order:  shared.js → standard/presets.js → standard/engine.js → ...
// ──────────────────────────────────────────────────────────────────────────────


// ── Standard preset defaults ─────────────────────────────────────────────────
const STD_PRESET_DEFAULTS = {
  // Starting conditions
  startLives:   5,
  startBlanks:  1,
  startStreak:  0,

  // Gambit base multipliers (used as fallbacks if gambitMultipliers omits a key)
  multValue:      1,
  multColor:      1,
  multSuit:       3,
  multValueColor: 3,
  multValueSuit:  6,
  multJoker:      10,

  // Win outcome
  winLifeOp:   'add', winLifeMod:   0,
  winStreakOp: 'add', winStreakMod: 1,

  // Loss outcome
  loseLifeOp:   'subtract', loseLifeMod:   1,
  loseStreakOp: 'subtract', loseStreakMod: 1,
  loseScoreOp:  'multiply', loseScoreMod:  1, loseScoreTarget: 'total',

  // Stalemate outcome (online multiplayer only — all active players chose the
  // exact same gambit key in the same round).  Separate from a regular loss so
  // the host can tune the penalty independently.  stalemateEnabled: false
  // disables the detection entirely (everyone resolves their gambit normally).
  stalemateEnabled:  false,
  stalemateLifeOp:   'subtract', stalemateLifeMod:   1,
  stalemateStreakOp: 'subtract', stalemateStreakMod: 1,
  stalemateScoreOp:  'multiply', stalemateScoreMod:  1, stalemateScoreTarget: 'total',

  // Skip outcome
  skipLifeOp:   'subtract', skipLifeMod:   1,
  skipStreakOp: 'add',      skipStreakMod: 1,
  skipScoreOp:  'multiply', skipScoreMod:  0, skipScoreTarget: 'cardValueAdd',

  // Blank outcome
  blankLifeOp:   'add',      blankLifeMod:   0,
  blankStreakOp: 'add',      blankStreakMod: 0,
  blankScoreOp:  'multiply', blankScoreMod:  1, blankScoreTarget: 'cardValueAdd',

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
  costLife:        3, shopLifeAmount:  1,
  costBlank:       4, shopBlankAmount: 1,
  // Immunity: one charge that blocks the NEXT card effect (boon OR curse) to
  // hit the buyer.  If bought while the current card already carries an
  // effect, the immunity arms for the NEXT card so it cannot be used to
  // dodge the effect that is about to fire on this round.
  costImmunity:    2,

  // Score goal (Standard-specific win condition)
  scoreToBeat:        100,
  scoreToBeatEnabled: true,

  // ── Card Effects ────────────────────────────────────────────────────────
  // When enabled, every newly-drawn table card has `cardEffectChance` chance
  // of receiving a random effect from the allowed pool (cardEffectsAllowed).
  // Effects fire AFTER the round's normal resolution and modify the player(s)
  // using the same math operators as the regular outcome system.  Effects
  // are defined in core/cardEffects.js.  In multiplayer, the host computes
  // the effect's per-player updates and broadcasts them like any other state
  // change, so guests don't need to run any effect logic.
  cardEffectsEnabled: false,
  // Type-level chance — boons and curses roll sequentially; the first type to
  // land claims the card and the second roll is skipped, so a card carries at
  // most ONE effect.  cardEffectRollOrder controls which type goes first.
  cardBoonChance:      0.2,   // 0.0 – 1.0
  cardCurseChance:     0.2,   // 0.0 – 1.0
  cardEffectRollOrder: 'boon', // 'boon' | 'curse' — which type rolls first
  cardEffectMinRound:  3,     // effects never appear before this round (1–5)
  // Per-effect relative weights used when picking which boon / curse the card
  // gets.  Default weight = 1 (equal odds); a weight of 0 functionally removes
  // the effect from the pool without flipping its allow-toggle off.
  cardEffectWeights:  {
    devils_favour: 1, sanctuary:     1, bounty:      1,
    streak_surge:  1, resurrection:  1, fortune:     1,
    mercy:         1, cursed_card:   1, hex:         1,
    reapers_toll:  1, blood_tribute: 1,
    leech:         1, tax:           1, gambit_lock: 1,
  },

  // ── Per-effect configurable numeric values ───────────────────────────────
  // Boons
  fxSanctuaryAmt:    1,   // lives restored by Sanctuary
  fxBountyAmt:       30,  // score bonus from Bounty
  fxStreakSurgeAmt:  2,   // extra streak from Streak Surge
  fxResurrectionAmt: 1,   // lives restored by Resurrection
  fxFortuneAmt:      25,  // score bonus for Fortune's Wheel (lowest-score player)
  fxMercyAmt:        1,   // lives restored by Mercy (fewest-lives player)
  // Curses
  fxCursedCardAmt:   1,   // extra life penalty for Cursed Card
  fxHexAmt:          1,   // streak subtracted by Hex
  fxReaversTollPct:  20,  // % of score lost to Reaper's Toll (0–75)
  fxLeechAmt:        15,  // score stolen by Leech (lowest from highest)
  // Default = every effect enabled.  The settings panel lets the user
  // disable individual effects without touching the engine code.
  cardEffectsAllowed: {
    devils_favour: true, sanctuary:     true, bounty:      true,
    streak_surge:  true, resurrection:  true, fortune:     true,
    mercy:         true, cursed_card:   true, hex:         true,
    reapers_toll:  true, leech:         true, gambit_lock: true,
  },

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
    'A': 15, 'JOKER': 20,
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
const STD_PRESET = {
  ...STD_PRESET_DEFAULTS,
  deckOverrides:      { ...STD_PRESET_DEFAULTS.deckOverrides },
  cardValues:         { ...STD_PRESET_DEFAULTS.cardValues },
  disabledGambits:    { ...STD_PRESET_DEFAULTS.disabledGambits },
  gambitMultipliers:  { ...STD_PRESET_DEFAULTS.gambitMultipliers },
  cardEffectsAllowed: { ...STD_PRESET_DEFAULTS.cardEffectsAllowed },
  cardEffectWeights:  { ...STD_PRESET_DEFAULTS.cardEffectWeights },
};
// ──────────────────────────────────────────────────────────────────────────────


// ── Card value resolution ────────────────────────────────────────────────────
function stdNumVal(v, suit) {
  let result;
  const cardKey = suit ? `${v}-${suit}` : null;

  if (cardKey && STD_PRESET.cardValues && STD_PRESET.cardValues[cardKey] !== undefined) {
    result = STD_PRESET.cardValues[cardKey];
  } else if (STD_PRESET.cardValues && STD_PRESET.cardValues[v] !== undefined) {
    result = STD_PRESET.cardValues[v];
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


// ── Math helpers ─────────────────────────────────────────────────────────────
function stdApplyMathOp(val, op, mod) {
  if (op === 'add')      return val + mod;
  if (op === 'subtract') return Math.max(0, val - mod);
  if (op === 'multiply') return val * mod;
  if (op === 'divide')   return mod === 0 ? val : Math.floor(val / mod);
  return val;
}

function stdCalcScoreDelta(currentScore, tableCardValue, op, mod, target) {
  if (target === 'total')        return stdApplyMathOp(currentScore, op, mod) - currentScore;
  if (target === 'cardValueSub') return -stdApplyMathOp(tableCardValue, op, mod);
  return stdApplyMathOp(tableCardValue, op, mod);
}
// ──────────────────────────────────────────────────────────────────────────────


// ── Deck construction ────────────────────────────────────────────────────────
function stdMkDeck() {
  const d = [];
  const clamp = (n) => Math.max(0, Math.min(20, n));

  for (const s of SUITS) {
    for (const v of VALUES) {
      const cardId   = `${v}-${s}`;
      const rawCount = STD_PRESET.deckOverrides[cardId] !== undefined
        ? STD_PRESET.deckOverrides[cardId]
        : STD_PRESET.defaultCount;
      const count = clamp(rawCount);
      for (let i = 0; i < count; i++) {
        d.push({ suit: s, value: v, numValue: stdNumVal(v, s), id: `${cardId}-${i}` });
      }
    }
  }

  const rawJoker = STD_PRESET.deckOverrides['JOKER'] !== undefined
    ? STD_PRESET.deckOverrides['JOKER']
    : 2;
  const jokerCount = Math.max(0, Math.min(40, rawJoker));
  for (let i = 0; i < jokerCount; i++) {
    d.push({ suit: 'joker', value: 'JOKER', numValue: stdNumVal('JOKER', 'joker'), id: `joker-${i}` });
  }

  return d;
}

function stdCountDraftDeck(draft) {
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
function stdGetHighness(card, table) {
  if (card.value === 'JOKER') return null;
  if (card.value === 'A') {
    if (!table || table.value === 'JOKER' || table.value === 'A') return null;
    return HIGH.has(table.value) ? 'high' : 'low';
  }
  return HIGH.has(card.value) ? 'high' : 'low';
}

function stdGetColor(card) {
  return ['hearts','diamonds'].includes(card.suit) ? 'red' : 'black';
}
// ──────────────────────────────────────────────────────────────────────────────


// ── Gambit logic ─────────────────────────────────────────────────────────────
function stdCheckGambit(type, pred, hand, table) {
  if (type === 'joker') return hand.value === 'JOKER';
  if (hand.value === 'JOKER') return true;
  const h = stdGetHighness(hand, table), c = stdGetColor(hand);

  // Ace vs Ace/Joker on table → value half always passes
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

function stdDeriveGambit(sel) {
  if (!sel) return null;
  const { value: v, color: c, suit: s, joker: j } = sel;
  const gm = (key, fb) => STD_PRESET.gambitMultipliers?.[key] ?? fb;

  if (j)          { const k='joker';                 return { type:'joker',      pred:{},                mult:gm(k,STD_PRESET.multJoker),      label:'Joker Gambit',  desc:'⛧ All or Nothing' }; }
  if (!v&&!c&&!s) return null;
  if (v&&s&&!c)   { const k=`valueSuit-${v}-${s}`;   return { type:'valueSuit',  pred:{value:v,suit:s},  mult:gm(k,STD_PRESET.multValueSuit),  label:'Value & Suit',  desc:cap(v)+' + '+SYM[s]+' '+cap(s) }; }
  if (v&&c&&!s)   { const k=`valueColor-${v}-${c}`;  return { type:'valueColor', pred:{value:v,color:c}, mult:gm(k,STD_PRESET.multValueColor), label:'Value & Color', desc:cap(v)+' + '+cap(c) }; }
  if (v&&!c&&!s)  { const k=`value-${v}`;            return { type:'value',      pred:{value:v},         mult:gm(k,STD_PRESET.multValue),      label:'Value Gambit',  desc:cap(v) }; }
  if (c&&!v&&!s)  { const k=`color-${c}`;            return { type:'color',      pred:{color:c},         mult:gm(k,STD_PRESET.multColor),      label:'Color Gambit',  desc:colorLabel(c) }; }
  if (s&&!v&&!c)  { const k=`suit-${s}`;             return { type:'suit',       pred:{suit:s},          mult:gm(k,STD_PRESET.multSuit),       label:'Suit Gambit',   desc:SYM[s]+' '+cap(s) }; }
  return null;
}

function stdGambitKey(g) {
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

function stdIsGambitDisabled(g) {
  if (!g) return false;
  const k = stdGambitKey(g);
  return !!(STD_PRESET.disabledGambits && STD_PRESET.disabledGambits[k]);
}
// ──────────────────────────────────────────────────────────────────────────────


// ── Deck statistics (for the Info panel) ─────────────────────────────────────
function stdComputeDeckStats(deck) {
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
