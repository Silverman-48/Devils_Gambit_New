// ── Standard Mode — Named Presets ─────────────────────────────────────────────
//
// Standalone preset list for Standard mode.  Self-contained: includes its own
// _cv, _deck, _gm, _dg helpers so it doesn't depend on any other mode.
//
// Load order:  shared.js → standard/presets.js → standard/engine.js → ...
// ──────────────────────────────────────────────────────────────────────────────


// ── Standard preset helpers (private to this file) ───────────────────────────
const STD_cv = (overrides = {}) => ({
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
  '8': 8, '9': 9, '10': 10, 'J': 10, 'Q': 10, 'K': 10,
  'A': 15, 'JOKER': 20,
  ...overrides,
});

const STD_deck = (count, jokers, infinite = false) => ({
  defaultCount: count,
  infiniteDeck: infinite,
  deckOverrides: { JOKER: jokers },
});

const STD_gm = (v, c, s, vc, vs, j) => ({
  'value-low': v,  'value-high': v,
  'color-red': c,  'color-black': c,
  'suit-hearts': s, 'suit-diamonds': s, 'suit-clubs': s, 'suit-spades': s,
  'valueColor-low-red': vc,   'valueColor-low-black': vc,
  'valueColor-high-red': vc,  'valueColor-high-black': vc,
  'valueSuit-low-hearts': vs,  'valueSuit-low-diamonds': vs,
  'valueSuit-low-clubs': vs,   'valueSuit-low-spades': vs,
  'valueSuit-high-hearts': vs, 'valueSuit-high-diamonds': vs,
  'valueSuit-high-clubs': vs,  'valueSuit-high-spades': vs,
  'joker': j,
});

const STD_dg = (off = []) => {
  const all = [
    'value-low','value-high','color-red','color-black',
    'suit-hearts','suit-diamonds','suit-clubs','suit-spades',
    'valueColor-low-red','valueColor-low-black','valueColor-high-red','valueColor-high-black',
    'valueSuit-low-hearts','valueSuit-low-diamonds','valueSuit-low-clubs','valueSuit-low-spades',
    'valueSuit-high-hearts','valueSuit-high-diamonds','valueSuit-high-clubs','valueSuit-high-spades',
    'joker',
  ];
  const out = {};
  all.forEach(k => { out[k] = off.includes(k); });
  return out;
};


const STANDARD_PRESETS = [
  // ── 1. Default ──────────────────────────────────────────────────────────────
  {
    id:   'default',
    name: 'Default',
    tag:  'Balanced',
    desc: 'The classic experience. All gambits available at standard odds. Chase the score goal with 5 lives.',
    settings: {
      startLives: 5, startBlanks: 1, startStreak: 0,

      winLifeOp:   'add',      winLifeMod:  0,
      winStreakOp: 'add',      winStreakMod: 1,

      loseLifeOp:  'subtract', loseLifeMod:  1,
      loseStreakOp:'subtract', loseStreakMod: 1,
      loseScoreOp: 'multiply', loseScoreMod: 1, loseScoreTarget: 'total',

      skipLifeOp:  'subtract', skipLifeMod:  1,
      skipStreakOp:'add',      skipStreakMod: 1,
      skipScoreOp: 'multiply', skipScoreMod: 0, skipScoreTarget: 'cardValueAdd',

      blankLifeOp: 'add',      blankLifeMod:  0,
      blankStreakOp:'add',     blankStreakMod: 0,
      blankScoreOp:'multiply', blankScoreMod: 1, blankScoreTarget: 'cardValueAdd',

      deathsDoorRolls: 1, deathsDoorDiceSides: 4,
      blanksEnabled: true, skipsEnabled: true,
      infiniteLives: false, infiniteBlanks: false,

      costLife: 3, shopLifeAmount: 1,
      costBlank: 4, shopBlankAmount: 1,

      scoreToBeat: 100, scoreToBeatEnabled: true,
      stalemateEnabled: false,
      ...STD_deck(1, 2),
      cardValues: STD_cv(),

      gambitMultipliers: STD_gm(1, 1, 3, 3, 6, 10),
      disabledGambits:   STD_dg(),
    },
  },
];
// ──────────────────────────────────────────────────────────────────────────────