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

  // Find every active player tied for the lowest/highest value of a stat.
  // Returns an array of indices (empty when there are no active players).
  // Ties are intentional: effects that target the "lowest" / "highest" player
  // should fire on every player tied for that extreme so nobody gets a silent
  // pass just because they happen to share the bottom (or top) slot.
  function pickExtremeAll(players, stat, direction) {
    let bestVal = null;
    const idxs  = [];
    for (let i = 0; i < players.length; i++) {
      if (!isActiveStd(players[i])) continue;
      const v = players[i][stat] ?? 0;
      if (bestVal === null
          || (direction === 'lowest'  && v < bestVal)
          || (direction === 'highest' && v > bestVal)) {
        bestVal = v;
        idxs.length = 0;
        idxs.push(i);
      } else if (v === bestVal) {
        idxs.push(i);
      }
    }
    return idxs;
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
      desc: (p = STD_PRESET) => `Every player tied for the lowest score gains +${p.fxFortuneAmt ?? 25}`,
      presetFields: [{ key: 'fxFortuneAmt', label: 'Score Bonus', min: 5, max: 150, step: 5 }],
      applySP(p, ctx) { return { ...p, score: p.score + (STD_PRESET.fxFortuneAmt ?? 25) }; },
      applyMP(players, ctx) {
        const idxs = pickExtremeAll(players, 'score', 'lowest');
        if (!idxs.length) return null;
        const amt = STD_PRESET.fxFortuneAmt ?? 25;
        const set = new Set(idxs);
        return players.map((p, i) => set.has(i) ? { ...p, score: p.score + amt } : p);
      },
    },

    {
      id: 'mercy', name: 'Mercy', type: 'boon', icon: '⚜',
      mpOnly: true,
      desc: (p = STD_PRESET) => `Every player tied for the fewest lives gains ${p.fxMercyAmt ?? 1} life`,
      presetFields: [{ key: 'fxMercyAmt', label: 'Lives Restored', min: 1, max: 5, step: 1 }],
      applySP(p, ctx) { return applyStat(p, 'lives', 'add', STD_PRESET.fxMercyAmt ?? 1); },
      applyMP(players, ctx) {
        const idxs = pickExtremeAll(players, 'lives', 'lowest');
        if (!idxs.length) return null;
        const set = new Set(idxs);
        return players.map((p, i) =>
          set.has(i) ? applyStat(p, 'lives', 'add', STD_PRESET.fxMercyAmt ?? 1) : p
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
      desc: (p = STD_PRESET) => `A loss this round costs ${p.fxHexAmt ?? 1} extra streak`,
      presetFields: [{ key: 'fxHexAmt', label: 'Extra Streak Lost', min: 1, max: 5, step: 1 }],
      applySP(p, ctx) {
        if (ctx.action !== 'gambit' || ctx.won) return null;
        return applyStat(p, 'streak', 'subtract', STD_PRESET.fxHexAmt ?? 1);
      },
      applyMP(players, ctx) {
        return players.map((p, i) => {
          const r = ctx.results && ctx.results[i];
          if (r && r.action === 'gambit' && !r.won)
            return applyStat(p, 'streak', 'subtract', STD_PRESET.fxHexAmt ?? 1);
          return p;
        });
      },
    },

    {
      id: 'reapers_toll', name: "Reaper's Toll", type: 'curse', icon: '💀',
      mpOnly: true,
      desc: (p = STD_PRESET) => `Every player tied for the highest score loses ${p.fxReaversTollPct ?? 20}% of it`,
      presetFields: [{ key: 'fxReaversTollPct', label: 'Score Lost (%)', min: 5, max: 75, step: 5 }],
      applySP(p, ctx) {
        const pct = (STD_PRESET.fxReaversTollPct ?? 20) / 100;
        return { ...p, score: Math.floor(p.score * (1 - pct)) };
      },
      applyMP(players, ctx) {
        const idxs = pickExtremeAll(players, 'score', 'highest');
        if (!idxs.length) return null;
        const pct = (STD_PRESET.fxReaversTollPct ?? 20) / 100;
        const set = new Set(idxs);
        return players.map((p, i) =>
          set.has(i) ? { ...p, score: Math.floor(p.score * (1 - pct)) } : p
        );
      },
    },

    {
      id: 'leech', name: 'Leech', type: 'curse', icon: '🦇',
      mpOnly: true,
      desc: (p = STD_PRESET) => `Lowest-score player(s) steal ${p.fxLeechAmt ?? 15} score from the highest-score player(s)`,
      presetFields: [{ key: 'fxLeechAmt', label: 'Score Stolen', min: 5, max: 100, step: 5 }],
      applySP(p, ctx) { return null; }, // SP: only one player — no-op
      applyMP(players, ctx) {
        const loIdxs = pickExtremeAll(players, 'score', 'lowest');
        const hiIdxs = pickExtremeAll(players, 'score', 'highest');
        if (!loIdxs.length || !hiIdxs.length) return null;
        // If a player is in both sets (e.g. everyone tied at the same score),
        // there's nothing to transfer — skip those donors.
        const loSet    = new Set(loIdxs);
        const hiTakers = hiIdxs.filter(i => !loSet.has(i));
        if (!hiTakers.length) return null;

        const amt   = STD_PRESET.fxLeechAmt ?? 15;
        // Each high-score donor loses min(amt, theirScore).  The total pool is
        // then split evenly among the low-score recipients.
        const taken = hiTakers.map(i => Math.min(amt, players[i].score));
        const total = taken.reduce((s, n) => s + n, 0);
        const perLo = loIdxs.length ? Math.floor(total / loIdxs.length) : 0;

        return players.map((p, i) => {
          const hiPos = hiTakers.indexOf(i);
          if (hiPos !== -1)  return { ...p, score: p.score - taken[hiPos] };
          if (loSet.has(i))  return { ...p, score: p.score + perLo };
          return p;
        });
      },
    },

    {
      id: 'gambit_lock', name: 'Gambit Lock', type: 'curse', icon: '🔒',
      desc: () => 'The gambit you use now is locked and unavailable next round',
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
  //
  // Chance model:
  //   1) One type rolls first (cardEffectRollOrder: 'boon' by default, or
  //      'curse' when set to that).  If that roll lands and the pool yields
  //      an effect, it is returned immediately.
  //   2) If step 1 produced nothing (miss or empty pool), the other type
  //      rolls at its own chance.
  //   A card therefore carries at most ONE effect.  Per-effect weights
  //   (cardEffectWeights) skew which boon/curse is picked from the eligible
  //   pool; weight 0 functionally removes an effect even if its toggle is on,
  //   and the default weight (1) gives every effect an equal slot.
  function rollCardEffect(mpMode, round) {
    if (!STD_PRESET || !STD_PRESET.cardEffectsEnabled) return null;
    // Respect the minimum-round gate (default: round 3).
    const minRound = STD_PRESET.cardEffectMinRound ?? 3;
    if (round !== undefined && round < minRound) return null;

    const allowedMap = STD_PRESET.cardEffectsAllowed || {};
    const weightMap  = STD_PRESET.cardEffectWeights  || {};
    const weightOf   = (id) => {
      const w = weightMap[id];
      return (w === undefined || w === null) ? 1 : Math.max(0, Number(w));
    };

    // Weighted pick from the pool of a single type.  Returns null if no effect
    // in the pool has any weight (everything zeroed out).
    const pickFromType = (type) => {
      const pool = CARD_EFFECTS_DEFS.filter(eff =>
        eff.type === type
        && allowedMap[eff.id] !== false
        && (!eff.mpOnly || mpMode)
        && weightOf(eff.id) > 0
      );
      if (!pool.length) return null;
      const total = pool.reduce((s, eff) => s + weightOf(eff.id), 0);
      if (total <= 0) return null;
      let r = Math.random() * total;
      for (const eff of pool) {
        r -= weightOf(eff.id);
        if (r < 0) return eff;
      }
      return pool[pool.length - 1];
    };

    const wrap = (chosen) => {
      if (!chosen) return null;
      const desc = typeof chosen.desc === 'function' ? chosen.desc() : chosen.desc;
      return { id: chosen.id, name: chosen.name, type: chosen.type, icon: chosen.icon, desc };
    };

    const boonChance  = Math.max(0, Math.min(1, STD_PRESET.cardBoonChance  ?? 0.2));
    const curseChance = Math.max(0, Math.min(1, STD_PRESET.cardCurseChance ?? 0.2));

    // Determine roll order: boon-first (default) or curse-first.
    const rollOrder = STD_PRESET.cardEffectRollOrder === 'curse'
      ? [['curse', curseChance], ['boon', boonChance]]
      : [['boon',  boonChance],  ['curse', curseChance]];

    for (const [type, chance] of rollOrder) {
      if (chance > 0 && Math.random() < chance) {
        const eff = wrap(pickFromType(type));
        if (eff) return eff;
      }
    }
    return null;
  }


  // Immunity helper — true when the player has bought the Immunity shop item
  // and the round it armed for has arrived.  Consumed by the first effect
  // that would actually change the player's stats; see the SP / MP wrappers
  // below for the consumption logic.
  function isImmuneNow(player, round) {
    return player
      && player.immunityFromRound != null
      && round != null
      && round >= player.immunityFromRound;
  }


  // ── Public apply functions ────────────────────────────────────────────────
  // SP — modifies the single player and returns the updated player + a log
  // line.  Returns the original player if the effect didn't trigger.  When
  // the player is currently immune, the effect is blocked entirely and the
  // immunity charge is consumed (one charge = one effect, boon or curse).
  function applyCardEffectSP(effect, player, ctx) {
    if (!effect || !player) return { player, log: null };
    const def = getCardEffectDef(effect.id);
    if (!def || typeof def.applySP !== 'function') return { player, log: null };
    const round = ctx && ctx.round;

    if (isImmuneNow(player, round)) {
      // Only consume immunity if the effect WOULD have triggered for this ctx
      // (otherwise a round where the effect was a no-op would waste the charge).
      const probe = def.applySP(player, ctx || {});
      if (!probe) return { player, log: null };
      return {
        player:   { ...player, immunityFromRound: null },
        log:      '🛡 Immunity blocks ' + effect.icon + ' ' + effect.name,
        blocked:  true,
      };
    }

    const next = def.applySP(player, ctx || {});
    if (!next) return { player, log: null };
    return { player: next, log: effect.icon + ' ' + effect.name };
  }

  // MP — modifies the full players array and returns it + a log line.  After
  // the effect runs normally, any player whose immunity is armed for this
  // round AND whose stats would have changed is reverted to their pre-effect
  // state and has their immunity charge consumed.
  function applyCardEffectMP(effect, players, ctx) {
    if (!effect || !Array.isArray(players)) return { players, log: null, blockedIdxs: [] };
    const def = getCardEffectDef(effect.id);
    if (!def || typeof def.applyMP !== 'function') return { players, log: null, blockedIdxs: [] };
    const round = ctx && ctx.round;

    const next = def.applyMP(players, ctx || {});
    if (!next) return { players, log: null, blockedIdxs: [] };

    const blockedIdxs = [];
    const final = next.map((np, i) => {
      const op = players[i];
      const wouldChange =
           np.lives  !== op.lives
        || np.streak !== op.streak
        || np.blanks !== op.blanks
        || np.score  !== op.score
        || (np.lockedGambitKey || null) !== (op.lockedGambitKey || null);
      if (wouldChange && isImmuneNow(op, round)) {
        blockedIdxs.push(i);
        return { ...op, immunityFromRound: null };
      }
      return np;
    });

    return { players: final, log: effect.icon + ' ' + effect.name, blockedIdxs };
  }


  // ── Expose globals ────────────────────────────────────────────────────────
  window.CARD_EFFECTS_DEFS  = CARD_EFFECTS_DEFS;
  window.getCardEffectDef   = getCardEffectDef;
  window.rollCardEffect     = rollCardEffect;
  window.applyCardEffectSP  = applyCardEffectSP;
  window.applyCardEffectMP  = applyCardEffectMP;
})();
// ──────────────────────────────────────────────────────────────────────────────
