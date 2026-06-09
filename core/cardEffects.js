// ── Card Effects — Random boons/curses attached to table cards ──────────────
//
// When `STD_PRESET.cardEffectsEnabled` is true, every newly-drawn table card
// has a chance of receiving a random effect from the allowed pool.  Effects
// fire AFTER the round's gambit/skip/blank resolution and modify the player(s)
// using the same math operators as the regular outcome system.
//
// ── Architecture (streamlined) ──────────────────────────────────────────────
// Each effect declares ONE behaviour — `apply(players, ctx)` — used by BOTH
// single-player and multiplayer.  Single-player just runs it on a one-element
// array.  This removes the old applySP/applyMP duplication (and the whole class
// of bugs where the two copies drifted out of sync).
//
//   players : array of player objects (length 1 in single-player)
//   ctx     : { results: { [idx]: { action, won, pts, gambitLabel?, gambitDesc? } },
//               round }
//   returns : a NEW players array, or null when the effect changes nothing.
//
// You rarely write `apply` by hand — use the builders below.
//
// ╔═ HOW TO ADD YOUR OWN BOON / CURSE ═══════════════════════════════════════╗
// ║ Add an object to CARD_EFFECTS_DEFS.  A typical effect is just:            ║
// ║                                                                           ║
// ║   {                                                                       ║
// ║     id:   'my_boon',           // unique key (also used in the presets)   ║
// ║     type: 'boon',              // 'boon' | 'curse'                         ║
// ║     icon: '🌟',                                                            ║
// ║     name: 'My Boon',                                                      ║
// ║     desc: (p = STD_PRESET) => `Win grants +${p.fxMyBoonAmt ?? 10} score`, ║
// ║     presetFields: [{ key:'fxMyBoonAmt', label:'Score', min:1, max:99,     ║
// ║                      step:1 }],   // sliders shown in Settings (optional)  ║
// ║     apply: selfEffect({ when:'gambitWin', stat:'score', op:'add',         ║
// ║                         amount:'fxMyBoonAmt' }),                          ║
// ║   }                                                                       ║
// ║                                                                           ║
// ║ Builders:                                                                 ║
// ║  • selfEffect({ when, stat, op, amount })                                 ║
// ║      Changes the ACTING player's own stat when their result matches.      ║
// ║      when:   'gambitWin' | 'gambitLoss' | 'win' | 'loss' | 'blank'        ║
// ║              | 'skip' | 'blankOrSkip' | 'draw' | 'any'                     ║
// ║      stat:   'lives' | 'streak' | 'blanks' | 'score'                      ║
// ║      op:     'add' | 'subtract' | 'multiply' | 'divide'                    ║
// ║      amount: a number, a STD_PRESET key string (e.g. 'fxMyBoonAmt'),       ║
// ║              or ({ player, result, preset }) => number                    ║
// ║  • extremeEffect({ of, dir, stat, op, amount })          (multiplayer)    ║
// ║      Changes every active player tied for the lowest/highest `of`.        ║
// ║      of: 'score'|'lives'|'streak'|'blanks'   dir: 'lowest'|'highest'       ║
// ║                                                                           ║
// ║ For anything the builders can't express, set `apply(players, ctx)`        ║
// ║ directly (see `gambit_lock` / `reapers_toll` below).                      ║
// ║ Add `mpOnly: true` to hide an effect from single-player.                  ║
// ║ Tuning knobs you reference (fxMyBoonAmt, …) live in STD_PRESET_DEFAULTS    ║
// ║ in standard/engine.js — add a default there so presets can reset it.      ║
// ╚═══════════════════════════════════════════════════════════════════════════╝
// ──────────────────────────────────────────────────────────────────────────────


(function () {

  // ── Low-level helpers ───────────────────────────────────────────────────────
  // Apply a math op to one stat while honouring the infinite flags.
  function applyStat(player, stat, op, mod) {
    if (stat === 'lives'  && STD_PRESET.infiniteLives)  return player;
    if (stat === 'blanks' && STD_PRESET.infiniteBlanks) return player;
    const v = player[stat] ?? 0;
    return { ...player, [stat]: stdApplyMathOp(v, op, mod) };
  }

  function isActiveStd(p) {
    return p && !p.dead && p.placement == null && !p.deckEmpty;
  }

  // Every active player tied for the lowest/highest value of a stat (array of
  // indices; ties all included so nobody gets a silent pass at the extreme).
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


  // ── Authoring helpers (used to build the catalogue below) ────────────────────
  // Does a single player's round-result match a trigger keyword?
  const TRIGGERS = {
    gambitWin:   r => r.action === 'gambit' && r.won,
    gambitLoss:  r => r.action === 'gambit' && !r.won,
    win:         r => !!r.won,                                   // any win (gambit or blank)
    loss:        r => !r.won,                                    // any non-win (loss / skip / draw)
    blank:       r => r.action === 'blank',
    skip:        r => r.action === 'skip',
    blankOrSkip: r => r.action === 'blank' || r.action === 'skip',
    draw:        r => r.action === 'draw',
    any:         () => true,
  };

  // Resolve an `amount` spec → number.
  //   number   → literal      string → STD_PRESET[key]      function(ctx) → computed
  function resolveAmount(spec, player, result) {
    if (typeof spec === 'function') return spec({ player, result, preset: STD_PRESET });
    if (typeof spec === 'string')   return STD_PRESET[spec] ?? 0;
    return spec ?? 0;
  }

  // Builder: change the ACTING player's own stat when THEIR result matches.
  function selfEffect({ when, stat, op, amount }) {
    const match = TRIGGERS[when] || (() => false);
    return (players, ctx) => players.map((p, i) => {
      const r = ctx && ctx.results && ctx.results[i];
      if (r && match(r)) return applyStat(p, stat, op, resolveAmount(amount, p, r));
      return p;
    });
  }

  // Builder: change every active player tied for the lowest/highest `of` stat.
  // Either pass {stat, op, amount} for a math-op change, or {change:p=>p} for
  // a fully custom per-target transform.
  function extremeEffect({ of, dir, stat, op, amount, change }) {
    return (players) => {
      const idxs = pickExtremeAll(players, of, dir);
      if (!idxs.length) return null;
      const set = new Set(idxs);
      return players.map((p, i) => {
        if (!set.has(i)) return p;
        if (typeof change === 'function') return change(p);
        return applyStat(p, stat, op, resolveAmount(amount, p, null));
      });
    };
  }


  // ── Effect catalogue ──────────────────────────────────────────────────────
  const CARD_EFFECTS_DEFS = [

    // ── Boons ────────────────────────────────────────────────────────────────
    {
      id: 'devils_favour', name: "Devil's Favour", type: 'boon', icon: '💎',
      desc: (p = STD_PRESET) => `A Win this round multiplies the point payout by ${p.fxDevilsFavourMult ?? 2}× (blanks don't count)`,
      presetFields: [{ key: 'fxDevilsFavourMult', label: 'Payout Multiplier (×)', min: 2, max: 5, step: 1 }],
      // Base payout is already on the score; add (mult − 1)× more to reach mult×.
      apply: selfEffect({
        when: 'gambitWin', stat: 'score', op: 'add',
        amount: ({ result }) => result.pts * ((STD_PRESET.fxDevilsFavourMult ?? 2) - 1),
      }),
    },

    {
      id: 'sanctuary', name: 'Sanctuary', type: 'boon', icon: '✨',
      desc: (p = STD_PRESET) => `A Win this round grants ${p.fxSanctuaryAmt ?? 1} extra life (blanks don't count)`,
      presetFields: [{ key: 'fxSanctuaryAmt', label: 'Lives Restored', min: 1, max: 5, step: 1 }],
      apply: selfEffect({ when: 'gambitWin', stat: 'lives', op: 'add', amount: 'fxSanctuaryAmt' }),
    },

    {
      id: 'streak_surge', name: 'Streak Surge', type: 'boon', icon: '🔥',
      desc: (p = STD_PRESET) => `A Win this round grants +${p.fxStreakSurgeAmt ?? 2} extra streak (blanks don't count)`,
      presetFields: [{ key: 'fxStreakSurgeAmt', label: 'Streak Bonus', min: 1, max: 10, step: 1 }],
      apply: selfEffect({ when: 'gambitWin', stat: 'streak', op: 'add', amount: 'fxStreakSurgeAmt' }),
    },


    // ── Curses ─────────────────────────────────────────────────────────────

    {
      id: 'reapers_toll', name: "Reaper's Toll", type: 'curse', icon: '💀',
      desc: (p = STD_PRESET) => `A loss this round costs the table card's value ×${p.fxReaversTollMult ?? 2} score`,
      presetFields: [{ key: 'fxReaversTollMult', label: 'Card Value Multiplier (×)', min: 1, max: 5, step: 1 }],
      // Penalty = tableCard.numValue × multiplier, subtracted from the loser's score.
      apply: (players, ctx) => players.map((p, i) => {
        const r = ctx && ctx.results && ctx.results[i];
        if (r && TRIGGERS.gambitLoss(r)) {
          const mult    = STD_PRESET.fxReaversTollMult ?? 2;
          const cardVal = (ctx && ctx.tableCardValue) || 0;
          return { ...p, score: Math.max(0, (p.score ?? 0) - cardVal * mult) };
        }
        return p;
      }),
    },

    {
      id: 'cursed_card', name: 'Cursed Card', type: 'curse', icon: '☠',
      desc: (p = STD_PRESET) => `A loss this round costs ${p.fxCursedCardAmt ?? 1} extra life`,
      presetFields: [{ key: 'fxCursedCardAmt', label: 'Extra Lives Lost', min: 1, max: 3, step: 1 }],
      apply: selfEffect({ when: 'gambitLoss', stat: 'lives', op: 'subtract', amount: 'fxCursedCardAmt' }),
    },

    {
      id: 'hex', name: 'Hex', type: 'curse', icon: '🕷',
      desc: (p = STD_PRESET) => `A loss this round costs ${p.fxHexAmt ?? 1} extra streak`,
      presetFields: [{ key: 'fxHexAmt', label: 'Extra Streak Lost', min: 1, max: 5, step: 1 }],
      apply: selfEffect({ when: 'gambitLoss', stat: 'streak', op: 'subtract', amount: 'fxHexAmt' }),
    },

    {
      id: 'gambit_lock', name: 'Gambit Lock', type: 'curse', icon: '🔒',
      desc: () => 'The gambit you use now is locked and unavailable next round',
      // Locks each gambit-playing player's last committed gambit key.  Not a
      // stat change, so it's a small custom apply.
      apply: (players, ctx) => players.map((p, i) => {
        const r = ctx && ctx.results && ctx.results[i];
        if (r && r.action === 'gambit' && p.lastGambitKey) {
          return { ...p, lockedGambitKey: p.lastGambitKey };
        }
        return p;
      }),
    },
  ];


  // ── Lookup ──────────────────────────────────────────────────────────────────
  function getCardEffectDef(id) {
    if (!id) return null;
    return CARD_EFFECTS_DEFS.find(eff => eff.id === id) || null;
  }


  // ── Roll: does a newly-drawn table card get an effect, and which? ────────────
  // Returns a ROLL RESULT object (never null):
  //   { effect: <wire effect { id, name, type, icon, desc }> | null,
  //     boonRolled:  bool,   // the boon dice came up this deal
  //     curseRolled: bool }  // the curse dice came up this deal
  // `effect` is the single boon/curse attached to the card (or null).  The
  // boonRolled/curseRolled flags drive the cooldown clock (see advanceEffectState)
  // and are reported even when the matching pool was empty (all on cooldown), so
  // the cooldown can always tick forward and never deadlocks.
  // mpMode = true → include MP-only effects.  round → min-round gate.
  //
  // Chance model (Method B — independent symmetric rolls):
  //   Both boon and curse roll independently at their own chances.  If only one
  //   lands, that type is used.  If BOTH land simultaneously, cardEffectRollOrder
  //   ('boon' by default) picks which type wins the tie.  If neither lands, no
  //   effect.  A card always carries at most ONE effect.
  //
  //   P(boon)  = cardBoonChance  (exact, not discounted by the curse roll)
  //   P(curse) = cardCurseChance (exact, not discounted by the boon roll)
  //   P(both)  = cardBoonChance × cardCurseChance  (tie broken by rollOrder)
  //
  //   Per-effect weights skew which boon/curse is picked from the winning type;
  //   default weight 1 = equal odds within that type (weights floor at 1).
  //
  // effectState = { cooldowns: { [id]: remaining }, counts: { [id]: total } }
  // lets the roll respect per-effect cooldowns + hard caps.
  const NO_ROLL = () => ({ effect: null, boonRolled: false, curseRolled: false });
  function rollCardEffect(mpMode, round, effectState) {
    if (!STD_PRESET || !STD_PRESET.cardEffectsEnabled) return NO_ROLL();
    const minRound = STD_PRESET.cardEffectMinRound ?? 3;
    if (round !== undefined && round < minRound) return NO_ROLL();

    const allowedMap  = STD_PRESET.cardEffectsAllowed      || {};
    const weightMap   = STD_PRESET.cardEffectWeights       || {};
    const maxActMap   = STD_PRESET.cardEffectMaxActivations || {};
    const cooldowns   = (effectState && effectState.cooldowns) || {};
    const counts      = (effectState && effectState.counts)    || {};

    const weightOf = (id) => {
      const w = weightMap[id];
      // Weight floors at 1 — there is no "weight 0" soft-disable.  Use the
      // per-effect allow toggle to remove an effect from the pool instead.
      return (w === undefined || w === null) ? 1 : Math.max(1, Number(w));
    };
    const maxActOf = (id) => {
      const v = maxActMap[id];
      return (v === undefined || v === null) ? 0 : Math.max(0, Number(v));
    };

    const pickFromType = (type) => {
      const pool = CARD_EFFECTS_DEFS.filter(eff =>
        eff.type === type
        && allowedMap[eff.id] !== false
        && (!eff.mpOnly || mpMode)
        && weightOf(eff.id) > 0
        && (cooldowns[eff.id] || 0) === 0
        && (maxActOf(eff.id) === 0 || (counts[eff.id] || 0) < maxActOf(eff.id))
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

    // Roll both types independently.
    const boonHit  = boonChance  > 0 && Math.random() < boonChance;
    const curseHit = curseChance > 0 && Math.random() < curseChance;

    let effect = null;
    if (boonHit && !curseHit) {
      effect = wrap(pickFromType('boon'));
    } else if (curseHit && !boonHit) {
      effect = wrap(pickFromType('curse'));
    } else if (boonHit && curseHit) {
      // Both landed — break the tie with rollOrder; fall back to the other if
      // the primary pool is empty (e.g. all of that type on cooldown).
      const preferCurse = STD_PRESET.cardEffectRollOrder === 'curse';
      const primary     = preferCurse ? 'curse' : 'boon';
      const secondary   = preferCurse ? 'boon'  : 'curse';
      effect = wrap(pickFromType(primary)) || wrap(pickFromType(secondary));
    }
    // boonRolled/curseRolled report the DICE, not the attached effect, so the
    // cooldown clock advances on every same-type roll even when nothing fired.
    return { effect, boonRolled: boonHit, curseRolled: curseHit };
  }


  // ── Cooldown clock ──────────────────────────────────────────────────────────
  // The cooldown is measured in SAME-TYPE ROLL OCCASIONS, not deals.  When an
  // effect appears, its cooldown is set to N; it then sits out the next N times
  // its own type (boon or curse) is rolled, becoming eligible again on the
  // (N+1)th.  Example: Devil's Favour fires with cooldown 3 → it is skipped on
  // the next 3 boon rolls and can reappear on the 4th.  Because the clock keys
  // off the dice (boonRolled/curseRolled) rather than an effect actually firing,
  // it never deadlocks even when every effect of a type is simultaneously cooling.
  //
  // Call this once per deal with the pre-deal state and the roll result; it
  // returns the NEW { cooldowns, counts } to store on the game state.
  function advanceEffectState(prevState, rollResult) {
    const cooldowns = { ...((prevState && prevState.cooldowns) || {}) };
    const counts    = { ...((prevState && prevState.counts)    || {}) };
    if (!rollResult) return { cooldowns, counts };

    // 1) Tick down every on-cooldown effect whose type was rolled this deal.
    const decrementType = (type) => {
      for (const id of Object.keys(cooldowns)) {
        const def = getCardEffectDef(id);
        if (def && def.type === type) {
          if (cooldowns[id] > 1) cooldowns[id] -= 1;
          else delete cooldowns[id];   // reached 0 → eligible again
        }
      }
    };
    if (rollResult.boonRolled)  decrementType('boon');
    if (rollResult.curseRolled) decrementType('curse');

    // 2) The effect that actually appeared goes on cooldown and bumps its count.
    //    (It was eligible to roll, so it's not in the map yet — set it fresh
    //    AFTER the decrement so it receives its full cooldown value.)
    if (rollResult.effect) {
      const id = rollResult.effect.id;
      const cd = (STD_PRESET.cardEffectCooldowns || {})[id] || 0;
      if (cd > 0) cooldowns[id] = cd; else delete cooldowns[id];
      counts[id] = (counts[id] || 0) + 1;
    }
    return { cooldowns, counts };
  }


  // ── Immunity helper ───────────────────────────────────────────────────────
  function isImmuneNow(player, round) {
    return player
      && player.immunityFromRound != null
      && round != null
      && round >= player.immunityFromRound;
  }

  // Did the effect actually change a player (vs. being a no-op for this round)?
  function effectChangedPlayer(np, op) {
    return np.lives  !== op.lives
        || np.streak !== op.streak
        || np.blanks !== op.blanks
        || np.score  !== op.score
        || (np.lockedGambitKey || null) !== (op.lockedGambitKey || null);
  }


  // ── Public apply functions ────────────────────────────────────────────────
  // MP — runs the effect's single `apply` over the whole players array, then
  // reverts (and consumes the immunity charge of) any armed-immune player whose
  // stats would have changed.
  function applyCardEffectMP(effect, players, ctx) {
    if (!effect || !Array.isArray(players)) return { players, log: null, blockedIdxs: [] };
    const def = getCardEffectDef(effect.id);
    if (!def || typeof def.apply !== 'function') return { players, log: null, blockedIdxs: [] };
    const round = ctx && ctx.round;

    const next = def.apply(players, ctx || {});
    if (!next) return { players, log: null, blockedIdxs: [] };

    const blockedIdxs = [];
    const final = next.map((np, i) => {
      const op = players[i];
      if (effectChangedPlayer(np, op) && isImmuneNow(op, round)) {
        blockedIdxs.push(i);
        return { ...op, immunityFromRound: null };
      }
      return np;
    });

    return { players: final, log: effect.icon + ' ' + effect.name, blockedIdxs };
  }

  // SP — wraps the single player in a one-element array and reuses the SAME
  // `apply`.  Returns the original player (log: null) when the effect didn't
  // change anything; consumes immunity when it would have.
  function applyCardEffectSP(effect, player, ctx) {
    if (!effect || !player) return { player, log: null };
    const def = getCardEffectDef(effect.id);
    if (!def || typeof def.apply !== 'function') return { player, log: null };
    const round = ctx && ctx.round;
    const ctxN  = { results: { 0: { action: ctx && ctx.action, won: ctx && ctx.won, pts: ctx && ctx.pts } }, round, tableCardValue: ctx && ctx.tableCardValue };

    if (isImmuneNow(player, round)) {
      const probe = def.apply([player], ctxN);
      if (!probe || !effectChangedPlayer(probe[0], player)) return { player, log: null };
      return {
        player:  { ...player, immunityFromRound: null },
        log:     '🛡 Immunity blocks ' + effect.icon + ' ' + effect.name,
        blocked: true,
      };
    }

    const out = def.apply([player], ctxN);
    if (!out || !effectChangedPlayer(out[0], player)) return { player, log: null };
    return { player: out[0], log: effect.icon + ' ' + effect.name };
  }


  // ── Expose globals ────────────────────────────────────────────────────────
  window.CARD_EFFECTS_DEFS  = CARD_EFFECTS_DEFS;
  window.getCardEffectDef   = getCardEffectDef;
  window.rollCardEffect     = rollCardEffect;
  window.advanceEffectState = advanceEffectState;
  window.applyCardEffectSP  = applyCardEffectSP;
  window.applyCardEffectMP  = applyCardEffectMP;
})();
// ──────────────────────────────────────────────────────────────────────────────
