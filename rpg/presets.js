// ── RPG Mode — Named Presets + Enemy Roster ───────────────────────────────────
//
// Standalone preset list for RPG mode.  Self-contained: includes its own
// _cv, _deck, _gm, _dg helpers so it doesn't depend on Standard mode.
//
// Two collections live here:
//   • RPG_PRESETS    — game-rule presets (HP, gambits, deck, etc.)
//   • ENEMY_PRESETS  — per-enemy combat stats
//
// Load order:  shared.js → ... → rpg/presets.js → rpg/engine.js → ...
// ──────────────────────────────────────────────────────────────────────────────


// ── Private preset helpers ───────────────────────────────────────────────────
const RPG_cv = (overrides = {}) => ({
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
  '8': 8, '9': 9, '10': 10, 'J': 10, 'Q': 10, 'K': 10,
  'A': 20, 'JOKER': 20,
  ...overrides,
});

const RPG_deck = (count, jokers, infinite = false) => ({
  defaultCount: count,
  infiniteDeck: infinite,
  deckOverrides: { JOKER: jokers },
});

const RPG_gm = (v, c, s, vc, vs, j) => ({
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

const RPG_dg = (off = []) => {
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


// ── RPG game-rule presets ────────────────────────────────────────────────────
const RPG_PRESETS = [
  // ── 1. Default ──────────────────────────────────────────────────────────────
  {
    id:   'default',
    name: 'Default',
    tag:  'Balanced',
    desc: 'Standard RPG encounter. 20 HP with solid defensive options.',
    settings: {
      startLives: 20, startBlanks: 2, startStreak: 0,

      winStreakOp:  'add',      winStreakMod: 1,
      loseStreakOp: 'subtract', loseStreakMod: 1,
      skipStreakOp: 'add',      skipStreakMod: 0,
      blankStreakOp:'add',      blankStreakMod: 0,

      deathsDoorRolls: 1, deathsDoorDiceSides: 4,
      blanksEnabled: true, skipsEnabled: true,
      infiniteLives: false, infiniteBlanks: false,

      costLife: 2, shopLifeAmount: 20,
      costBlank: 4, shopBlankAmount: 1,

      ...RPG_deck(1, 2),
      cardValues: RPG_cv(),

      gambitMultipliers: RPG_gm(1, 1, 3, 3, 6, 10),
      disabledGambits:   RPG_dg(),

      rpgSkipHealPct: 10, rpgSkipDamagePct: 50, rpgBlankMult: 1.0,
    },
  },

  // ── 2. Warrior ──────────────────────────────────────────────────────────────
  {
    id:   'warrior',
    name: 'Warrior',
    tag:  'Tanky',
    desc: 'Veteran fighter. High HP, extra blanks, streak head-start. Built to outlast.',
    settings: {
      startLives: 40, startBlanks: 3, startStreak: 5,

      winStreakOp:  'add',      winStreakMod: 1,
      loseStreakOp: 'subtract', loseStreakMod: 1,
      skipStreakOp: 'add',      skipStreakMod: 0,
      blankStreakOp:'add',      blankStreakMod: 1,

      deathsDoorRolls: 2, deathsDoorDiceSides: 4,
      blanksEnabled: true, skipsEnabled: true,
      infiniteLives: false, infiniteBlanks: false,

      costLife: 2, shopLifeAmount: 20,
      costBlank: 3, shopBlankAmount: 1,

      ...RPG_deck(2, 2),
      cardValues: RPG_cv(),

      gambitMultipliers: RPG_gm(1, 1, 4, 4, 8, 10),
      disabledGambits:   RPG_dg(),

      rpgSkipHealPct: 15, rpgSkipDamagePct: 35, rpgBlankMult: 1.0,
    },
  },

  // ── 3. Glass Cannon ─────────────────────────────────────────────────────────
  {
    id:   'glasscannon',
    name: 'Glass Cannon',
    tag:  'High Risk',
    desc: 'Razor-thin HP, massive streak advantage. No skips. Attack fast or perish.',
    settings: {
      startLives: 8, startBlanks: 1, startStreak: 10,

      winStreakOp:  'add',      winStreakMod: 2,
      loseStreakOp: 'subtract', loseStreakMod: 3,
      skipStreakOp: 'subtract', skipStreakMod: 2,
      blankStreakOp:'add',      blankStreakMod: 1,

      deathsDoorRolls: 1, deathsDoorDiceSides: 6,
      blanksEnabled: true, skipsEnabled: false,
      infiniteLives: false, infiniteBlanks: false,

      costLife: 4, shopLifeAmount: 8,
      costBlank: 6, shopBlankAmount: 1,

      ...RPG_deck(1, 2),
      cardValues: RPG_cv(),

      gambitMultipliers: RPG_gm(2, 3, 6, 7, 14, 20),
      disabledGambits:   RPG_dg(['value-low', 'value-high']),

      rpgSkipHealPct: 0, rpgSkipDamagePct: 100, rpgBlankMult: 2.0,
    },
  },

  // ── 4. Undying ──────────────────────────────────────────────────────────────
  {
    id:   'undying',
    name: 'Undying',
    tag:  'Practice',
    desc: 'Immortal player, infinite deck. Train your gambits with zero fear of death.',
    settings: {
      startLives: 20, startBlanks: 3, startStreak: 0,

      winStreakOp:  'add',      winStreakMod: 1,
      loseStreakOp: 'subtract', loseStreakMod: 1,
      skipStreakOp: 'add',      skipStreakMod: 0,
      blankStreakOp:'add',      blankStreakMod: 0,

      deathsDoorRolls: 1, deathsDoorDiceSides: 4,
      blanksEnabled: true, skipsEnabled: true,
      infiniteLives: true, infiniteBlanks: false,

      costLife: 2, shopLifeAmount: 20,
      costBlank: 4, shopBlankAmount: 1,

      ...RPG_deck(1, 2, true),
      cardValues: RPG_cv(),

      gambitMultipliers: RPG_gm(1, 1, 3, 3, 6, 10),
      disabledGambits:   RPG_dg(),

      rpgSkipHealPct: 10, rpgSkipDamagePct: 50, rpgBlankMult: 1.0,
    },
  },

  // ── 5. Skirmish ─────────────────────────────────────────────────────────────
  {
    id:   'skirmish',
    name: 'Skirmish',
    tag:  'Quick Fight',
    desc: 'Low HP, infinite blanks, cheap shop. Fast, furious, and brutally fun.',
    settings: {
      startLives: 10, startBlanks: 4, startStreak: 0,

      winStreakOp:  'add',      winStreakMod: 1,
      loseStreakOp: 'subtract', loseStreakMod: 1,
      skipStreakOp: 'add',      skipStreakMod: 1,
      blankStreakOp:'add',      blankStreakMod: 1,

      deathsDoorRolls: 1, deathsDoorDiceSides: 4,
      blanksEnabled: true, skipsEnabled: true,
      infiniteLives: false, infiniteBlanks: true,

      costLife: 1, shopLifeAmount: 10,
      costBlank: 2, shopBlankAmount: 2,

      ...RPG_deck(1, 4),
      cardValues: RPG_cv(),

      gambitMultipliers: RPG_gm(2, 2, 4, 5, 8, 12),
      disabledGambits:   RPG_dg(),

      rpgSkipHealPct: 20, rpgSkipDamagePct: 30, rpgBlankMult: 1.5,
    },
  },
];
// ──────────────────────────────────────────────────────────────────────────────


// ── Enemy roster ─────────────────────────────────────────────────────────────
const ENEMY_PRESETS = [
  {
    id:   'devil',
    name: 'The Devil',
    tag:  'Boss',
    desc: 'The classic ruler of the underworld. Balanced attack rates and heavy damage.',
    settings: {
      enemyName: 'The Devil',
      enemyHP: 100,
      enemyAttackMin: 5,  enemyAttackMax: 30,
      enemyDefendMin: 5,  enemyDefendMax: 20,
      enemyAttackChance: 0.40, enemyDefendChance: 0.40,
      enemyAttackChanceDecrement: 0.05,
      enemyDefendChanceDecrement: 0.05,
    }
  },
  {
    id:   'goblin',
    name: 'Goblin Scout',
    tag:  'Weak',
    desc: 'A flimsy but erratic foe. Attacks very frequently for low damage.',
    settings: {
      enemyName: 'Goblin Scout',
      enemyHP: 30,
      enemyAttackMin: 1,  enemyAttackMax: 8,
      enemyDefendMin: 1,  enemyDefendMax: 5,
      enemyAttackChance: 0.60, enemyDefendChance: 0.50,
      enemyAttackChanceDecrement: 0.05,
      enemyDefendChanceDecrement: 0.10,
    }
  },
  {
    id:   'dragon',
    name: 'Ancient Dragon',
    tag:  'Lethal',
    desc: 'Massive health and devastating blows. Rarely attacks, but hits like a truck.',
    settings: {
      enemyName: 'Ancient Dragon',
      enemyHP: 250,
      enemyAttackMin: 20, enemyAttackMax: 60,
      enemyDefendMin: 15, enemyDefendMax: 40,
      enemyAttackChance: 0.25, enemyDefendChance: 0.40,
      enemyAttackChanceDecrement: 0.10,
      enemyDefendChanceDecrement: 0.05,
    }
  },
  {
    id:   'mimic',
    name: 'Mimic',
    tag:  'Tricky',
    desc: 'Average health, but relentless. Very hard to defend against its constant strikes.',
    settings: {
      enemyName: 'Mimic',
      enemyHP: 60,
      enemyAttackMin: 5,  enemyAttackMax: 15,
      enemyDefendMin: 3,  enemyDefendMax: 12,
      enemyAttackChance: 0.70, enemyDefendChance: 0.70,
      enemyAttackChanceDecrement: 0.05,
      enemyDefendChanceDecrement: 0.15,
    }
  }
];
// ──────────────────────────────────────────────────────────────────────────────
