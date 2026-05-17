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
  'A': 20, 'JOKER': 20,
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
    desc: 'The classic experience. All gambits available at standard odds. Chase the score goal with 3 lives.',
    settings: {
      startLives: 3, startBlanks: 1, startStreak: 0,

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

      costLife: 2, shopLifeAmount: 1,
      costBlank: 4, shopBlankAmount: 1,

      scoreToBeat: 100, scoreToBeatEnabled: true,
      ...STD_deck(1, 2),
      cardValues: STD_cv(),

      gambitMultipliers: STD_gm(1, 1, 3, 3, 6, 10),
      disabledGambits:   STD_dg(),
    },
  },

  // ── 2. Casual ───────────────────────────────────────────────────────────────
  {
    id:   'casual',
    name: 'Casual',
    tag:  'Easy',
    desc: 'Start with 5 lives. Wins heal. Simple gambits pay more. Breathe easy and learn the ropes.',
    settings: {
      startLives: 5, startBlanks: 2, startStreak: 0,

      winLifeOp:   'add',      winLifeMod:  1,
      winStreakOp: 'add',      winStreakMod: 1,

      loseLifeOp:  'subtract', loseLifeMod:  1,
      loseStreakOp:'subtract', loseStreakMod: 1,
      loseScoreOp: 'multiply', loseScoreMod: 1, loseScoreTarget: 'total',

      skipLifeOp:  'add',      skipLifeMod:  0,
      skipStreakOp:'add',      skipStreakMod: 0,
      skipScoreOp: 'multiply', skipScoreMod: 0, skipScoreTarget: 'cardValueAdd',

      blankLifeOp: 'add',      blankLifeMod:  1,
      blankStreakOp:'add',     blankStreakMod: 1,
      blankScoreOp:'multiply', blankScoreMod: 1, blankScoreTarget: 'cardValueAdd',

      deathsDoorRolls: 2, deathsDoorDiceSides: 4,
      blanksEnabled: true, skipsEnabled: true,
      infiniteLives: false, infiniteBlanks: false,

      costLife: 1, shopLifeAmount: 2,
      costBlank: 2, shopBlankAmount: 2,

      scoreToBeat: 100, scoreToBeatEnabled: true,
      ...STD_deck(1, 2),
      cardValues: STD_cv(),

      gambitMultipliers: STD_gm(2, 2, 3, 4, 6, 8),
      disabledGambits:   STD_dg(),
    },
  },

  // ── 3. Hardcore ─────────────────────────────────────────────────────────────
  {
    id:   'hardcore',
    name: 'Hardcore',
    tag:  'Brutal',
    desc: 'Easy gambits are disabled — only suits and specifics. 1 life, no safety nets, no second chances.',
    settings: {
      startLives: 1, startBlanks: 0, startStreak: 0,

      winLifeOp:   'add',      winLifeMod:  0,
      winStreakOp: 'add',      winStreakMod: 1,

      loseLifeOp:  'subtract', loseLifeMod:  1,
      loseStreakOp:'subtract', loseStreakMod: 2,
      loseScoreOp: 'multiply', loseScoreMod: 1, loseScoreTarget: 'total',

      skipLifeOp:  'subtract', skipLifeMod:  1,
      skipStreakOp:'subtract', skipStreakMod: 1,
      skipScoreOp: 'multiply', skipScoreMod: 0, skipScoreTarget: 'cardValueAdd',

      blankLifeOp: 'add',      blankLifeMod:  0,
      blankStreakOp:'add',     blankStreakMod: 0,
      blankScoreOp:'multiply', blankScoreMod: 1, blankScoreTarget: 'cardValueAdd',

      deathsDoorRolls: 0, deathsDoorDiceSides: 4,
      blanksEnabled: false, skipsEnabled: false,
      infiniteLives: false, infiniteBlanks: false,

      costLife: 6, shopLifeAmount: 1,
      costBlank: 8, shopBlankAmount: 1,

      scoreToBeat: 150, scoreToBeatEnabled: true,
      ...STD_deck(1, 2),
      cardValues: STD_cv(),

      gambitMultipliers: STD_gm(1, 1, 4, 5, 8, 15),
      disabledGambits:   STD_dg(['value-low','value-high','color-red','color-black']),
    },
  },

  // ── 4. Endless ──────────────────────────────────────────────────────────────
  {
    id:   'endless',
    name: 'Endless',
    tag:  'Chill',
    desc: 'Infinite lives, infinite deck. No score goal. Play forever, no pressure, no stakes.',
    settings: {
      startLives: 3, startBlanks: 3, startStreak: 0,

      winLifeOp:   'add',      winLifeMod:  0,
      winStreakOp: 'add',      winStreakMod: 1,

      loseLifeOp:  'subtract', loseLifeMod:  0,
      loseStreakOp:'subtract', loseStreakMod: 1,
      loseScoreOp: 'multiply', loseScoreMod: 1, loseScoreTarget: 'total',

      skipLifeOp:  'subtract', skipLifeMod:  0,
      skipStreakOp:'add',      skipStreakMod: 0,
      skipScoreOp: 'multiply', skipScoreMod: 0, skipScoreTarget: 'cardValueAdd',

      blankLifeOp: 'add',      blankLifeMod:  0,
      blankStreakOp:'add',     blankStreakMod: 1,
      blankScoreOp:'multiply', blankScoreMod: 1, blankScoreTarget: 'cardValueAdd',

      deathsDoorRolls: 1, deathsDoorDiceSides: 4,
      blanksEnabled: true, skipsEnabled: true,
      infiniteLives: true, infiniteBlanks: true,

      costLife: 2, shopLifeAmount: 1,
      costBlank: 4, shopBlankAmount: 1,

      scoreToBeat: 100, scoreToBeatEnabled: false,
      ...STD_deck(1, 2, true),
      cardValues: STD_cv(),

      gambitMultipliers: STD_gm(1, 1, 3, 3, 6, 10),
      disabledGambits:   STD_dg(),
    },
  },

  // ── 5. High Roller ──────────────────────────────────────────────────────────
  {
    id:   'highroller',
    name: 'High Roller',
    tag:  'Score Rush',
    desc: 'Jacked-up multipliers on all gambits. Streak climbs fast and falls hard. Risk everything for a record score.',
    settings: {
      startLives: 3, startBlanks: 1, startStreak: 5,

      winLifeOp:   'add',      winLifeMod:  0,
      winStreakOp: 'add',      winStreakMod: 2,

      loseLifeOp:  'subtract', loseLifeMod:  1,
      loseStreakOp:'subtract', loseStreakMod: 3,
      loseScoreOp: 'divide',   loseScoreMod: 2, loseScoreTarget: 'total',

      skipLifeOp:  'subtract', skipLifeMod:  1,
      skipStreakOp:'add',      skipStreakMod: 0,
      skipScoreOp: 'multiply', skipScoreMod: 0, skipScoreTarget: 'cardValueAdd',

      blankLifeOp: 'add',      blankLifeMod:  0,
      blankStreakOp:'add',     blankStreakMod: 1,
      blankScoreOp:'multiply', blankScoreMod: 2, blankScoreTarget: 'cardValueAdd',

      deathsDoorRolls: 1, deathsDoorDiceSides: 6,
      blanksEnabled: true, skipsEnabled: true,
      infiniteLives: false, infiniteBlanks: false,

      costLife: 3, shopLifeAmount: 1,
      costBlank: 5, shopBlankAmount: 1,

      scoreToBeat: 500, scoreToBeatEnabled: true,
      ...STD_deck(1, 4),
      cardValues: STD_cv({ A: 20, JOKER: 20 }),

      gambitMultipliers: STD_gm(2, 2, 5, 6, 12, 20),
      disabledGambits:   STD_dg(),
    },
  },
];
// ──────────────────────────────────────────────────────────────────────────────
