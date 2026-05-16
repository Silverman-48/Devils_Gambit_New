// ── Standard Mode — Gameplay resolvers ────────────────────────────────────────
//
// Pure functions that take the current game state (gs) and a derived gambit
// (dg) and return a delta object the App applies via setState.  No React,
// no side effects.  Reads only STD_PRESET.
//
// Load order:  ... → standard/engine.js → standard/gameplay.js → ...
// ──────────────────────────────────────────────────────────────────────────────


// ── Commit a gambit ──────────────────────────────────────────────────────────
function stdResolveGambit(gs, dg) {
  const snapStreak   = gs.streak;
  const snapTableVal = gs.tableCard.numValue;
  const isInstant    = dg.type === 'joker';
  const won          = stdCheckGambit(dg.type, dg.pred, gs.handCard, gs.tableCard);
  const mult         = dg.mult;

  // Reward on a win; on a loss, score delta is driven by PRESET.loseScore* ops
  const pts = won
    ? (snapTableVal + snapStreak) * mult
    : stdCalcScoreDelta(gs.score, snapTableVal, STD_PRESET.loseScoreOp, STD_PRESET.loseScoreMod, STD_PRESET.loseScoreTarget);

  const newScore = gs.score + pts;

  // A missed Joker is the only thing that zeroes lives outright ("instant death").
  // A winning Joker pays out normally and applies the standard win-life op.
  const calcLives = (isInstant && !won) ? 0
    : (won ? stdApplyMathOp(gs.lives, STD_PRESET.winLifeOp,  STD_PRESET.winLifeMod)
           : stdApplyMathOp(gs.lives, STD_PRESET.loseLifeOp, STD_PRESET.loseLifeMod));
  const newLives = STD_PRESET.infiniteLives ? gs.lives : calcLives;

  // A Joker (win or miss) zeroes the streak; otherwise apply the normal streak op.
  const newStreak = isInstant ? 0
    : (won ? stdApplyMathOp(gs.streak, STD_PRESET.winStreakOp,  STD_PRESET.winStreakMod)
           : stdApplyMathOp(gs.streak, STD_PRESET.loseStreakOp, STD_PRESET.loseStreakMod));

  return { won, pts, newScore, newLives, newStreak, isInstant };
}
// ──────────────────────────────────────────────────────────────────────────────


// ── Skip a round ─────────────────────────────────────────────────────────────
function stdResolveSkip(gs) {
  const pts       = stdCalcScoreDelta(gs.score, gs.tableCard.numValue, STD_PRESET.skipScoreOp, STD_PRESET.skipScoreMod, STD_PRESET.skipScoreTarget);
  const newLives  = STD_PRESET.infiniteLives ? gs.lives : stdApplyMathOp(gs.lives, STD_PRESET.skipLifeOp, STD_PRESET.skipLifeMod);
  const newStreak = stdApplyMathOp(gs.streak, STD_PRESET.skipStreakOp, STD_PRESET.skipStreakMod);
  return { pts, newLives, newStreak };
}
// ──────────────────────────────────────────────────────────────────────────────


// ── Play a blank card ────────────────────────────────────────────────────────
function stdResolveBlank(gs) {
  const pts       = stdCalcScoreDelta(gs.score, gs.tableCard.numValue, STD_PRESET.blankScoreOp, STD_PRESET.blankScoreMod, STD_PRESET.blankScoreTarget);
  const newLives  = STD_PRESET.infiniteLives ? gs.lives : stdApplyMathOp(gs.lives, STD_PRESET.blankLifeOp, STD_PRESET.blankLifeMod);
  const newStreak = stdApplyMathOp(gs.streak, STD_PRESET.blankStreakOp, STD_PRESET.blankStreakMod);
  const newBlanks = STD_PRESET.infiniteBlanks ? gs.blanks : gs.blanks - 1;
  return { pts, newLives, newStreak, newBlanks };
}
// ──────────────────────────────────────────────────────────────────────────────
