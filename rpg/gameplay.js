// ── RPG Mode — Combat resolvers + EnemyPanel ──────────────────────────────────
//
// Pure functions for combat resolution (no React, no side effects beyond the
// shared chance counters) and one React component for the enemy HP + state
// display.  Reads only RPG_PRESET.
//
// Load order: ... → rpg/engine.js → rpg/gameplay.js → ...
// ──────────────────────────────────────────────────────────────────────────────


// ── CSS: pulse animation for the Attack state indicator ──────────────────────
(function () {
  if (document.getElementById('rpg-pulse-style')) return;
  const style = document.createElement('style');
  style.id = 'rpg-pulse-style';
  style.textContent = `
    @keyframes rpgPulse {
      0%,100%{opacity:1;text-shadow:0 0 6px rgba(220,60,60,0.6);}
      50%{opacity:0.65;text-shadow:none;}
    }
  `;
  document.head.appendChild(style);
})();
// ──────────────────────────────────────────────────────────────────────────────


// ── Pity counters for enemy attack / defense chance ──────────────────────────
let rpgCurrentAttackChance = RPG_PRESET.enemyAttackChance;
let rpgCurrentDefendChance = RPG_PRESET.enemyDefendChance;

function rpgResetEnemyChances() {
  rpgCurrentAttackChance = RPG_PRESET.enemyAttackChance;
  rpgCurrentDefendChance = RPG_PRESET.enemyDefendChance;
}
// ──────────────────────────────────────────────────────────────────────────────


// ── Enemy state roller ───────────────────────────────────────────────────────
// Called at startGame and at the start of every new round.  Returns
// { enemyState, enemyAttackValue, enemyDefendValue } for the new round.
function rpgResolveEnemyState() {
  const isAttack = Math.random() < rpgCurrentAttackChance;
  let finalState;

  if (isAttack) {
    finalState = 'attack';
    rpgCurrentAttackChance = RPG_PRESET.enemyAttackChance;
    rpgCurrentDefendChance = RPG_PRESET.enemyDefendChance;
  } else {
    rpgCurrentAttackChance = Math.min(1.0, rpgCurrentAttackChance + (RPG_PRESET.enemyAttackChanceIncrement ?? 0.05));
    const isDefending = Math.random() < rpgCurrentDefendChance;
    if (isDefending) {
      finalState = 'defensive';
      rpgCurrentDefendChance = Math.max(0.0, rpgCurrentDefendChance - (RPG_PRESET.enemyDefendChanceDecrement ?? 0.05));
    } else {
      finalState = 'neutral';
      rpgCurrentDefendChance = RPG_PRESET.enemyDefendChance;
    }
  }

  return {
    enemyState: finalState,
    enemyAttackValue: finalState === 'attack'
      ? Math.floor(Math.random() * (RPG_PRESET.enemyAttackMax - RPG_PRESET.enemyAttackMin + 1)) + RPG_PRESET.enemyAttackMin
      : null,
    enemyDefendValue: finalState === 'defensive'
      ? Math.floor(Math.random() * (RPG_PRESET.enemyDefendMax - RPG_PRESET.enemyDefendMin + 1)) + RPG_PRESET.enemyDefendMin
      : null,
  };
}
// ──────────────────────────────────────────────────────────────────────────────


// ── Commit a gambit (RPG mode) ───────────────────────────────────────────────
// Three-way combat resolution based on enemyState.
function rpgResolveGambit(gs, dg) {
  const snapStreak   = gs.streak;
  const snapTableVal = gs.tableCard.numValue;
  const isInstant    = dg.type === 'joker';
  const won          = rpgCheckGambit(dg.type, dg.pred, gs.handCard, gs.tableCard);
  const mult         = dg.mult;

  const pts = won ? (snapTableVal + snapStreak) * mult : 0;

  let enemyDamage  = 0;
  let playerDamage = 0;
  let combatResult = '';

  if (gs.enemyState === 'neutral') {
    if (won) { enemyDamage  = pts; combatResult = 'dealt'; }
    else     {                     combatResult = 'miss-safe'; }
  } else if (gs.enemyState === 'defensive') {
    const def  = gs.enemyDefendValue;
    const diff = pts - def;
    if (won) {
      if      (diff > 0) { enemyDamage  = diff;          combatResult = 'broke-guard'; }
      else if (diff < 0) { playerDamage = Math.abs(diff); combatResult = 'guard-hit';  }
      else               {                                combatResult = 'draw';       }
    } else {
      playerDamage = def; combatResult = 'miss-guard';
    }
  } else {
    // Attack state — three-way comparison vs rolled attack value
    const atk  = gs.enemyAttackValue;
    const diff = pts - atk;
    if (won) {
      if      (diff > 0) { enemyDamage  = diff;          combatResult = 'counter'; }
      else if (diff < 0) { playerDamage = Math.abs(diff); combatResult = 'hit';     }
      else               {                                combatResult = 'draw';    }
    } else {
      playerDamage = atk;
      combatResult = 'miss-hit';
    }
  }

  const newEnemyHP = Math.max(0, gs.enemyHP - enemyDamage);
  const newLives   = RPG_PRESET.infiniteLives ? gs.lives : Math.max(0, gs.lives - playerDamage);
  const newScore   = gs.score + pts;
  const newStreak  = isInstant ? 0
    : won ? rpgApplyMathOp(gs.streak, RPG_PRESET.winStreakOp,  RPG_PRESET.winStreakMod)
          : rpgApplyMathOp(gs.streak, RPG_PRESET.loseStreakOp, RPG_PRESET.loseStreakMod);

  return {
    won, pts, isInstant,
    enemyDamage, playerDamage, combatResult,
    newEnemyHP, newLives, newScore, newStreak,
  };
}
// ──────────────────────────────────────────────────────────────────────────────


// ── Skip a round (RPG mode) ──────────────────────────────────────────────────
function rpgResolveSkip(gs) {
  const maxLives  = RPG_PRESET.startLives;
  const healPct   = (RPG_PRESET.rpgSkipHealPct   ?? 10) / 100;
  const damagePct = (RPG_PRESET.rpgSkipDamagePct ?? 50) / 100;

  let playerDamage = 0;
  let healAmount   = 0;
  let newLives     = gs.lives;

  if (gs.enemyState === 'attack') {
    playerDamage = Math.floor(gs.enemyAttackValue * damagePct);
    newLives = RPG_PRESET.infiniteLives ? gs.lives : Math.max(0, gs.lives - playerDamage);
  } else {
    if (!RPG_PRESET.infiniteLives) {
      healAmount = Math.ceil(maxLives * healPct);
      newLives = Math.min(maxLives, gs.lives + healAmount);
      healAmount = newLives - gs.lives;
    }
  }

  const newStreak = rpgApplyMathOp(gs.streak, RPG_PRESET.skipStreakOp, RPG_PRESET.skipStreakMod);
  const combatResult = gs.enemyState === 'attack' ? 'halfhit' : 'regen';

  return { healAmount, playerDamage, combatResult, newLives, newStreak };
}
// ──────────────────────────────────────────────────────────────────────────────


// ── Play a blank card (RPG mode) ─────────────────────────────────────────────
function rpgResolveBlank(gs) {
  const newBlanks = RPG_PRESET.infiniteBlanks ? gs.blanks : gs.blanks - 1;
  const newStreak = rpgApplyMathOp(gs.streak, RPG_PRESET.blankStreakOp, RPG_PRESET.blankStreakMod);
  const blankMult = RPG_PRESET.rpgBlankMult ?? 1.0;

  if (gs.enemyState === 'neutral') {
    const enemyDamage = Math.floor(gs.tableCard.numValue * blankMult);
    const newEnemyHP  = Math.max(0, gs.enemyHP - enemyDamage);
    return {
      type: 'strike',
      enemyDamage, newEnemyHP, attackValue: null,
      playerDamage: 0, newLives: gs.lives,
      combatResult: 'blank-strike',
      newBlanks, newStreak,
    };
  } else if (gs.enemyState === 'defensive') {
    const blankStrike = Math.floor(gs.tableCard.numValue * blankMult);
    const def  = gs.enemyDefendValue;
    const diff = blankStrike - def;
    if (diff > 0) {
      const newEnemyHP = Math.max(0, gs.enemyHP - diff);
      return {
        type: 'strike',
        enemyDamage: diff, newEnemyHP, attackValue: null,
        playerDamage: 0, newLives: gs.lives,
        combatResult: 'blank-broke-guard',
        newBlanks, newStreak,
      };
    } else if (diff < 0) {
      const playerDamage = Math.abs(diff);
      const newLives = RPG_PRESET.infiniteLives ? gs.lives : Math.max(0, gs.lives - playerDamage);
      return {
        type: 'guard-hit',
        enemyDamage: 0, newEnemyHP: gs.enemyHP, attackValue: null,
        playerDamage, newLives,
        combatResult: 'blank-guard-hit',
        newBlanks, newStreak,
      };
    } else {
      return {
        type: 'draw',
        enemyDamage: 0, newEnemyHP: gs.enemyHP, attackValue: null,
        playerDamage: 0, newLives: gs.lives,
        combatResult: 'blank-guard-draw',
        newBlanks, newStreak,
      };
    }
  } else {
    // Attack state — blank fully absorbs the hit
    return {
      type: 'block',
      enemyDamage: 0, newEnemyHP: gs.enemyHP, attackValue: gs.enemyAttackValue,
      playerDamage: 0, newLives: gs.lives,
      combatResult: 'blocked',
      newBlanks, newStreak,
    };
  }
}
// ──────────────────────────────────────────────────────────────────────────────


// ── EnemyPanel — HP bar + state indicator (rush badge shown when applicable) ─
function EnemyPanel({ gs }) {
  const e = React.createElement;
  if (!gs) return null;

  const pct   = Math.max(0, Math.round(100 * (gs.enemyHP / gs.enemyMaxHP)));
  const isAtk = gs.enemyState === 'attack';
  const isDef = gs.enemyState === 'defensive';

  return e('div', {
    style: {
      margin: '0', padding: '10px 12px',
      border: '1px solid ' + (isAtk ? 'rgba(220,60,60,0.55)' : isDef ? 'rgba(64,128,224,0.55)' : 'rgba(255,204,77,0.18)'),
      borderRadius: '8px',
      background: isAtk ? 'rgba(180,30,30,0.13)' : isDef ? 'rgba(30,80,180,0.13)' : 'rgba(0,0,0,0.18)',
      transition: 'border-color 0.3s, background 0.3s',
    },
  },
    e('div', { style: { display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:'5px' } },
      e('span', { style: { display:'flex', alignItems:'baseline', gap:'8px', fontFamily:"'Cinzel',serif", fontSize:'var(--font-sm)', letterSpacing:'0.04em', color:'var(--accent-color)' } },
        e('span', null, RPG_PRESET.enemyName),
        RPG_PRESET.rushMode && RPG_PRESET.rushQueue && RPG_PRESET.rushQueue.length > 1 &&
          e('span', { style: { fontSize:'0.65rem', letterSpacing:'0.1em', color:'var(--secondary-color)', border:'1px solid rgba(255,204,77,0.25)', padding:'1px 5px' } },
            ((gs.rushIndex ?? 0) + 1) + '/' + RPG_PRESET.rushQueue.length)
      ),
      e('span', { style: { fontSize:'var(--font-xs)', color:'var(--secondary-color)', fontVariantNumeric:'tabular-nums' } },
        gs.enemyHP, ' / ', gs.enemyMaxHP, ' HP')
    ),
    e('div', { style: { height:'6px', borderRadius:'3px', background:'rgba(255,255,255,0.08)', overflow:'hidden', marginBottom:'8px' } },
      e('div', { style: {
        height: '100%', borderRadius: '3px',
        width: pct + '%',
        background: pct > 50 ? '#c8a020' : pct > 25 ? '#c86020' : '#c83020',
        transition: 'width 0.4s ease, background 0.4s ease',
      } })
    ),
    isAtk
      ? e('div', { style: { display:'flex', alignItems:'center', gap:'8px', height:'15px' } },
          e('span', { style: { fontFamily:"'Cinzel',serif", fontSize:'var(--font-xs)', color:'#e04040', letterSpacing:'0.08em', animation:'rpgPulse 0.9s ease-in-out infinite' } }, '⚔ ATTACK'),
          e('span', { style: { fontSize:'var(--font-lg)', fontWeight:'700', color:'#e04040', fontVariantNumeric:'tabular-nums', minWidth:'28px', textAlign:'center' } }, gs.enemyAttackValue),
          e('span', { style: { fontSize:'var(--font-xs)', color:'rgba(220,80,80,0.7)' } },
            '(score ≥ ', gs.enemyAttackValue, ' to block)')
        )
      : isDef
        ? e('div', { style: { display:'flex', alignItems:'center', gap:'8px', height:'15px' } },
            e('span', { style: { fontFamily:"'Cinzel',serif", fontSize:'var(--font-xs)', color:'#60a0e0', letterSpacing:'0.08em' } }, '🛡️ GUARDING'),
            e('span', { style: { fontSize:'var(--font-lg)', fontWeight:'700', color:'#60a0e0', fontVariantNumeric:'tabular-nums', minWidth:'28px', textAlign:'center' } }, gs.enemyDefendValue),
            e('span', { style: { fontSize:'var(--font-xs)', color:'rgba(96,160,224,0.7)' } },
              '(score ≥ ', gs.enemyDefendValue, ' to break guard)')
          )
        : e('div', { style: { fontSize:'var(--font-xs)', color:'var(--secondary-color)', fontStyle:'italic', height:'15px' } },
            '⬛ Watching… no attack this round')
  );
}
// ──────────────────────────────────────────────────────────────────────────────
