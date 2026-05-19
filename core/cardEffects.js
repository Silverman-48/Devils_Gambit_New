// ── Card Effects — Random boons/curses attached to table cards ──────────────
//
// When `STD_PRESET.cardEffectsEnabled` is true, every newly-drawn table card
// has a `STD_PRESET.cardEffectChance` chance of receiving a random effect
// from the allowed pool (`STD_PRESET.cardEffectsAllowed`).  Effects fire
// AFTER the round's gambit/skip/blank resolution and modify the player(s)
// using the same math operators as the regular outcome system (add /
// subtract / multiply / divide).
//
// Each effect has:
//   id, name, type ('boon' | 'curse'), icon, desc  — metadata for UI/log
//   applySP(player, ctx) → updated player object | null  — single-player
//   applyMP(players, ctx) → updated players[] | null     — multiplayer
//
// ctx (SP):  { action: 'gambit'|'skip'|'blank', derived, won, pts }
// ctx (MP):  { results: { [idx]: { action, won, pts, gambitLabel, gambitDesc } } }
//
// Designed so SP applies to the one player; MP can target everyone, only
// winners/losers, or the player with the lowest/highest of a given stat.
// Effects that don't apply to a given context (e.g. a "win" effect after a
// skip) return null and the engine just skips them.
//
// Multiplayer effects are computed host-side after resolveRound — the
// updated players (and any flash message) is then broadcast to guests like
// any other state change, so guests don't need to run effect logic.
// ──────────────────────────────────────────────────────────────────────────────


(function () {

  // ── Helpers ───────────────────────────────────────────────────────────────
  // Apply a math op while honouring infinite flags (lives / blanks).
  function applyStat(player, stat, op, mod) {
    if (stat === 'lives' && STD_PRESET.infiniteLives)  return player;
    if (stat === 'blanks' && STD_PRESET.infiniteBlanks) return player;
    const v = player[stat] ?? 0;
    return { ...player, [stat]: stdApplyMathOp(v, op, mod) };
  }

  function isActiveStd(p) {
    return p && !p.dead && p.placement == null && !p.deckEmpty;
  }

  // Find the active player with the lowest/highest value of a given stat.
  // Returns null if there are no active players.
  function pickExtreme(players, stat, direction) {
    let bestIdx = -1, bestVal = null;
    for (let i = 0; i < players.length; i++) {
      if (!isActiveStd(players[i])) continue;
      const v = players[i][stat] ?? 0;
      if (bestVal === null
          || (direction === 'lowest'  && v < bestVal)
          || (direction === 'highest' && v > bestVal)) {
        bestVal = v;
        bestIdx = i;
      }
    }
    return bestIdx === -1 ? null : bestIdx;
  }


  // ── Effect catalogue ──────────────────────────────────────────────────────
  // Each entry's apply* return a NEW player(s) object — or null when the
  // current context doesn't trigger the effect.
  //
  // desc(preset)     — function; called with a preset object (STD_PRESET live,
  //                    or draft in the settings panel) so the text always shows
  //                    the current value.  Falls back to a plain string call.
  // presetFields     — array of { key, label, min, max, step } describing what
  //                    sliders/steppers to show in the settings panel when the
  //                    effect is enabled.  Omit for effects with no numbers.
  const CARD_EFFECTS_DEFS = [

    // ── Boons ──────────────────────────────────────────────────────────────
    {
      id: 'devils_favour', name: "Devil's Favour", type: 'boon', icon: '💎',
      desc: () => 'Win this round doubles the point payout',
      applySP(p, ctx) {
        if (ctx.action !== 'gambit' || !ctx.won) return null;
        return { ...p, score: p.score + ctx.pts };
      },
      applyMP(players, ctx) {
        return players.map((p, i) => {
          const r = ctx.results && ctx.results[i];
          if (r && r.won && r.action === 'gambit') return { ...p, score: p.score + r.pts };
          return p;
        });
      },
    },

    {
      id: 'sanctuary', name: 'Sanctuary', type: 'boon', icon: '✨',
      desc: (p = STD_PRESET) => `A loss this round refunds ${p.fxSanctuaryAmt ?? 1} life`,
      presetFields: [{ key: 'fxSanctuaryAmt', label: 'Lives Restored', min: 1, max: 5, step: 1 }],
      applySP(p, ctx) {
        if (ctx.action !== 'gambit' || ctx.won) return null;
        return applyStat(p, 'lives', 'add', STD_PRESET.fxSanctuaryAmt ?? 1);
      },
      applyMP(players, ctx) {
        return players.map((p, i) => {
          const r = ctx.results && ctx.results[i];
          if (r && !r.won && r.action === 'gambit')
            return applyStat(p, 'lives', 'add', STD_PRESET.fxSanctuaryAmt ?? 1);
          return p;
        });
      },
    },

    {
      id: 'bounty', name: 'Bounty', type: 'boon', icon: '🏆',
      desc: (p = STD_PRESET) => `Win this round grants +${p.fxBountyAmt ?? 30} bonus score`,
      presetFields: [{ key: 'fxBountyAmt', label: 'Score Bonus', min: 5, max: 200, step: 5 }],
      applySP(p, ctx) {
        if (ctx.action !== 'gambit' || !ctx.won) return null;
        return { ...p, score: p.score + (STD_PRESET.fxBountyAmt ?? 30) };
      },
      applyMP(players, ctx) {
        const amt = STD_PRESET.fxBountyAmt ?? 30;
        return players.map((p, i) => {
          const r = ctx.results && ctx.results[i];
          if (r && r.won) return { ...p, score: p.score + amt };
          return p;
        });
      },
    },

    {
      id: 'streak_surge', name: 'Streak Surge', type: 'boon', icon: '🔥',
      desc: (p = STD_PRESET) => `Win this round grants +${p.fxStreakSurgeAmt ?? 2} extra streak`,
      presetFields: [{ key: 'fxStreakSurgeAmt', label: 'Streak Bonus', min: 1, max: 10, step: 1 }],
      applySP(p, ctx) {
        if (!ctx.won) return null;
        return applyStat(p, 'streak', 'add', STD_PRESET.fxStreakSurgeAmt ?? 2);
      },
      applyMP(players, ctx) {
        return players.map((p, i) => {
          const r = ctx.results && ctx.results[i];
          if (r && r.won) return applyStat(p, 'streak', 'add', STD_PRESET.fxStreakSurgeAmt ?? 2);
          return p;
        });
      },
    },

    {
      id: 'resurrection', name: 'Resurrection', type: 'boon', icon: '🕊',
      desc: (p = STD_PRESET) => `A blank or skip this round restores ${p.fxResurrectionAmt ?? 1} life`,
      presetFields: [{ key: 'fxResurrectionAmt', label: 'Lives Restored', min: 1, max: 5, step: 1 }],
      applySP(p, ctx) {
        if (ctx.action !== 'blank' && ctx.action !== 'skip') return null;
        return applyStat(p, 'lives', 'add', STD_PRESET.fxResurrectionAmt ?? 1);
      },
      applyMP(players, ctx) {
        return players.map((p, i) => {
          const r = ctx.results && ctx.results[i];
          if (r && (r.action === 'blank' || r.action === 'skip'))
            return applyStat(p, 'lives', 'add', STD_PRESET.fxResurrectionAmt ?? 1);
          return p;
        });
      },
    },

    {
      id: 'fortune', name: "Fortune's Wheel", type: 'boon', icon: '🎰',
      mpOnly: true,
      desc: (p = STD_PRESET) => `The player with the lowest score gains +${p.fxFortuneAmt ?? 25}`,
      presetFields: [{ key: 'fxFortuneAmt', label: 'Score Bonus', min: 5, max: 150, step: 5 }],
      applySP(p, ctx) { return { ...p, score: p.score + (STD_PRESET.fxFortuneAmt ?? 25) }; },
      applyMP(players, ctx) {
        const idx = pickExtreme(players, 'score', 'lowest');
        if (idx == null) return null;
        const amt = STD_PRESET.fxFortuneAmt ?? 25;
        return players.map((p, i) => i === idx ? { ...p, score: p.score + amt } : p);
      },
    },

    {
      id: 'mercy', name: 'Mercy', type: 'boon', icon: '⚜',
      mpOnly: true,
      desc: (p = STD_PRESET) => `The player with the fewest lives gains ${p.fxMercyAmt ?? 1} life`,
      presetFields: [{ key: 'fxMercyAmt', label: 'Lives Restored', min: 1, max: 5, step: 1 }],
      applySP(p, ctx) { return applyStat(p, 'lives', 'add', STD_PRESET.fxMercyAmt ?? 1); },
      applyMP(players, ctx) {
        const idx = pickExtreme(players, 'lives', 'lowest');
        if (idx == null) return null;
        return players.map((p, i) =>
          i === idx ? applyStat(p, 'lives', 'add', STD_PRESET.fxMercyAmt ?? 1) : p
        );
      },
    },


    // ── Curses ─────────────────────────────────────────────────────────────
    {
      id: 'cursed_card', name: 'Cursed Card', type: 'curse', icon: '☠',
      desc: (p = STD_PRESET) => `A loss this round costs ${p.fxCursedCardAmt ?? 1} extra life`,
      presetFields: [{ key: 'fxCursedCardAmt', label: 'Extra Lives Lost', min: 1, max: 3, step: 1 }],
      applySP(p, ctx) {
        if (ctx.action !== 'gambit' || ctx.won) return null;
        return applyStat(p, 'lives', 'subtract', STD_PRESET.fxCursedCardAmt ?? 1);
      },
      applyMP(players, ctx) {
        return players.map((p, i) => {
          const r = ctx.results && ctx.results[i];
          if (r && !r.won && r.action === 'gambit')
            return applyStat(p, 'lives', 'subtract', STD_PRESET.fxCursedCardAmt ?? 1);
          return p;
        });
      },
    },

    {
      id: 'hex', name: 'Hex', type: 'curse', icon: '🕷',
      desc: (p = STD_PRESET) => `Every player loses ${p.fxHexAmt ?? 1} streak this round`,
      presetFields: [{ key: 'fxHexAmt', label: 'Streak Lost', min: 1, max: 5, step: 1 }],
      applySP(p, ctx) {
        return applyStat(p, 'streak', 'subtract', STD_PRESET.fxHexAmt ?? 1);
      },
      applyMP(players, ctx) {
        return players.map((p, i) =>
          isActiveStd(p) ? applyStat(p, 'streak', 'subtract', STD_PRESET.fxHexAmt ?? 1) : p
        );
      },
    },

    {
      id: 'reapers_toll', name: "Reaper's Toll", type: 'curse', icon: '💀',
      mpOnly: true,
      desc: (p = STD_PRESET) => `The player with the highest score loses ${p.fxReaversTollPct ?? 20}% of it`,
      presetFields: [{ key: 'fxReaversTollPct', label: 'Score Lost (%)', min: 5, max: 75, step: 5 }],
      applySP(p, ctx) {
        const pct = (STD_PRESET.fxReaversTollPct ?? 20) / 100;
        return { ...p, score: Math.floor(p.score * (1 - pct)) };
      },
      applyMP(players, ctx) {
        const idx = pickExtreme(players, 'score', 'highest');
        if (idx == null) return null;
        const pct = (STD_PRESET.fxReaversTollPct ?? 20) / 100;
        return players.map((p, i) =>
          i === idx ? { ...p, score: Math.floor(p.score * (1 - pct)) } : p
        );
      },
    },

    {
      id: 'leech', name: 'Leech', type: 'curse', icon: '🦇',
      mpOnly: true,
      desc: (p = STD_PRESET) => `Lowest score steals ${p.fxLeechAmt ?? 15} score from the highest`,
      presetFields: [{ key: 'fxLeechAmt', label: 'Score Stolen', min: 5, max: 100, step: 5 }],
      applySP(p, ctx) { return null; }, // SP: only one player — no-op
      applyMP(players, ctx) {
        const lo = pickExtreme(players, 'score', 'lowest');
        const hi = pickExtreme(players, 'score', 'highest');
        if (lo == null || hi == null || lo === hi) return null;
        const amt   = STD_PRESET.fxLeechAmt ?? 15;
        const taken = Math.min(amt, players[hi].score);
        return players.map((p, i) => {
          if (i === lo) return { ...p, score: p.score + taken };
          if (i === hi) return { ...p, score: p.score - taken };
          return p;
        });
      },
    },

    {
      id: 'tax', name: "Devil's Tax", type: 'curse', icon: '⚖',
      desc: (p = STD_PRESET) => `All active players lose ${p.fxTaxAmt ?? 10} score`,
      presetFields: [{ key: 'fxTaxAmt', label: 'Score Lost', min: 5, max: 100, step: 5 }],
      applySP(p, ctx) {
        const amt = STD_PRESET.fxTaxAmt ?? 10;
        return { ...p, score: Math.max(0, p.score - amt) };
      },
      applyMP(players, ctx) {
        const amt = STD_PRESET.fxTaxAmt ?? 10;
        return players.map((p, i) =>
          isActiveStd(p) ? { ...p, score: Math.max(0, p.score - amt) } : p
        );
      },
    },

    {
      id: 'gambit_lock', name: 'Gambit Lock', type: 'curse', icon: '🔒',
      desc: () => 'Your last used gambit is locked and unavailable next round',
      // In SP: lock the gambit that was just played (stored on p.lastGambitKey).
      // The effect fires after commit, so lastGambitKey is already set.
      // The lock is stored on the player object and cleared on the next commit.
      applySP(p, ctx) {
        if (ctx.action !== 'gambit') return null;  // skip / blank have no gambit to lock
        if (!p.lastGambitKey) return null;
        return { ...p, lockedGambitKey: p.lastGambitKey };
      },
      // In MP: lock each gambit player's last committed gambit key.
      applyMP(players, ctx) {
        return players.map((p, i) => {
          const r = ctx.results && ctx.results[i];
          if (r && r.action === 'gambit' && p.lastGambitKey) {
            return { ...p, lockedGambitKey: p.lastGambitKey };
          }
          return p;
        });
      },
    },
  ];


  // ── Lookup + roll ─────────────────────────────────────────────────────────
  function getCardEffectDef(id) {
    if (!id) return null;
    return CARD_EFFECTS_DEFS.find(eff => eff.id === id) || null;
  }

  // Returns a compact "wire" effect object to attach to a newly-drawn table
  // card, or null when no effect should fire.  Includes id, name, type, icon,
  // desc — guests render directly from this without needing the def file.
  // mpMode = true  → include MP-only effects in the pool (online mode).
  // round  = the round the card will be played in; effects are suppressed
  //          until round >= STD_PRESET.cardEffectMinRound.
  function rollCardEffect(mpMode, round) {
    if (!STD_PRESET || !STD_PRESET.cardEffectsEnabled) return null;
    // Respect the minimum-round gate (default: round 3).
    const minRound = STD_PRESET.cardEffectMinRound ?? 3;
    if (round !== undefined && round < minRound) return null;
    const chance = Math.max(0, Math.min(1, STD_PRESET.cardEffectChance ?? 0.2));
    if (Math.random() >= chance) return null;
    const allowedMap = STD_PRESET.cardEffectsAllowed || {};
    const pool = CARD_EFFECTS_DEFS.filter(eff =>
      allowedMap[eff.id] !== false && (!eff.mpOnly || mpMode)
    );
    if (!pool.length) return null;
    const chosen = pool[Math.floor(Math.random() * pool.length)];
    // Resolve desc at roll-time so the wire object always carries the current
    // preset values (guests render eff.desc directly without re-computing).
    const desc = typeof chosen.desc === 'function' ? chosen.desc() : chosen.desc;
    return { id: chosen.id, name: chosen.name, type: chosen.type, icon: chosen.icon, desc };
  }


  // ── Public apply functions ────────────────────────────────────────────────
  // SP — modifies the single player and returns the updated player + a log
  // line.  Returns the original player if the effect didn't trigger.
  function applyCardEffectSP(effect, player, ctx) {
    if (!effect || !player) return { player, log: null };
    const def = getCardEffectDef(effect.id);
    if (!def || typeof def.applySP !== 'function') return { player, log: null };
    const next = def.applySP(player, ctx || {});
    if (!next) return { player, log: null };
    return { player: next, log: effect.icon + ' ' + effect.name };
  }

  // MP — modifies the full players array and returns it + a log line.
  function applyCardEffectMP(effect, players, ctx) {
    if (!effect || !Array.isArray(players)) return { players, log: null };
    const def = getCardEffectDef(effect.id);
    if (!def || typeof def.applyMP !== 'function') return { players, log: null };
    const next = def.applyMP(players, ctx || {});
    if (!next) return { players, log: null };
    return { players: next, log: effect.icon + ' ' + effect.name };
  }


  // ── Expose globals ────────────────────────────────────────────────────────
  window.CARD_EFFECTS_DEFS  = CARD_EFFECTS_DEFS;
  window.getCardEffectDef   = getCardEffectDef;
  window.rollCardEffect     = rollCardEffect;
  window.applyCardEffectSP  = applyCardEffectSP;
  window.applyCardEffectMP  = applyCardEffectMP;
})();
// ──────────────────────────────────────────────────────────────────────────────
