// ── Standard Mode — UI components ─────────────────────────────────────────────
//
// All Standard-specific React components.  Reads STD_PRESET / STANDARD_PRESETS
// directly; no awareness of RPG mode.  CardFace / HandCard come from
// core/shared.js (visual primitives only).
//
// Exports:
//   StdGambitPanel, StdShop, StdSettingsPanel, StdInfoPanel,
//   StdRoundHistory, StdDeckInfo
//
// Load order: ... → standard/gameplay.js → standard/components.js → ...
// ──────────────────────────────────────────────────────────────────────────────


// ── StdGambitPanel ───────────────────────────────────────────────────────────
function StdGambitPanel({ sel, onToggle, derived, gs, disabled, result, lastChance, diceState, onRoll, emptyLabel, lockedGambitKey }) {
  const e = React.createElement;

  // Compact-gambits mode: reads from localStorage, updates when the General
  // Options toggle fires 'compactGambitsChanged' (written by core/sound.js).
  const [compactGambits, setCompactGambits] = React.useState(
    () => typeof window.getCompactGambits === 'function' ? window.getCompactGambits() : false
  );
  React.useEffect(() => {
    const h = () => setCompactGambits(
      typeof window.getCompactGambits === 'function' ? window.getCompactGambits() : false
    );
    window.addEventListener('compactGambitsChanged', h);
    return () => window.removeEventListener('compactGambitsChanged', h);
  }, []);

  const isSel = (type, val) => {
    if (type === 'joker') return sel.joker;
    if (type === 'value') return sel.value === val;
    if (type === 'color') return sel.color === val;
    if (type === 'suit')  return sel.suit  === val;
    return false;
  };

  const btn = (type, val, label) =>
    e('button', { key: val || type, className: 'gb' + (isSel(type, val) ? ' sel' : ''), onClick: () => !disabled && onToggle(type, val), disabled },
      e('span', { className: 'gbname' }, label)
    );

  const fmtMod = (op, mod, label) => {
    if ((op === 'add' || op === 'subtract') && mod === 0) return null;
    if ((op === 'multiply' || op === 'divide') && mod === 1) return null;
    const sign = op === 'add' ? '+' : op === 'subtract' ? '−' : op === 'multiply' ? '×' : '÷';
    return `${sign}${mod} ${label}`;
  };

  const isJoker        = derived && derived.type === 'joker';
  const gambitOff      = derived && stdIsGambitDisabled(derived);
  const gambitLocked   = !!(lockedGambitKey && derived && typeof stdGambitKey === 'function'
                           && stdGambitKey(derived) === lockedGambitKey);
  const isResultWin  = result && (result.won || result.action === 'blank');
  const isResultNtrl = result && result.action === 'skip';

  const displayCls = 'gambit-display' + (
    lastChance ? ' last-chance' :
    result     ? (isResultWin ? ' result-win' : isResultNtrl ? ' result-ntrl' : ' result-lose') :
    (derived   ? (gambitOff ? ' active-disabled' : gambitLocked ? ' active-locked' : isJoker ? ' active-joker' : ' active') : '')
  );

  const sides      = STD_PRESET.deathsDoorDiceSides || 4;
  const totalRolls = STD_PRESET.deathsDoorRolls || 1;
  const rollsLeft  = diceState?.rollsLeft ?? totalRolls;
  const diceName   = 'D' + sides;

  const winS    = fmtMod(STD_PRESET.winStreakOp,        STD_PRESET.winStreakMod,        'streak');
  const winL    = fmtMod(STD_PRESET.winLifeOp,         STD_PRESET.winLifeMod,         '♥');
  const loseL   = fmtMod(STD_PRESET.loseLifeOp,        STD_PRESET.loseLifeMod,        '♥');
  const loseS   = fmtMod(STD_PRESET.loseStreakOp,      STD_PRESET.loseStreakMod,      'streak');
  const skipL   = fmtMod(STD_PRESET.skipLifeOp,        STD_PRESET.skipLifeMod,        '♥');
  const skipS   = fmtMod(STD_PRESET.skipStreakOp,      STD_PRESET.skipStreakMod,      'streak');
  const blnkL   = fmtMod(STD_PRESET.blankLifeOp,      STD_PRESET.blankLifeMod,       '♥');
  const blnkS   = fmtMod(STD_PRESET.blankStreakOp,    STD_PRESET.blankStreakMod,     'streak');
  const staleL  = fmtMod(STD_PRESET.stalemateLifeOp,  STD_PRESET.stalemateLifeMod,  '♥');
  const staleS  = fmtMod(STD_PRESET.stalemateStreakOp, STD_PRESET.stalemateStreakMod, 'streak');

  return e('div', { className: 'gambit-panel' },
    e('div', { className: displayCls },

      // ── Death's Door dice UI ──────────────────────────────────────────────
      lastChance ? e('div', { className: 'gd-dice' },
        e('div', { className: 'gd-dice-inner' },
          e('div', { className: 'gd-restitle dice' }, '🎲 Death\'s Door 🎲'),
          e('div', { className: 'gd-dice-sub' },
            'Guess the ' + diceName + ' to cheat death' +
            (totalRolls > 1 ? ' (' + rollsLeft + ' of ' + totalRolls + ' ' + (rollsLeft === 1 ? 'attempt' : 'attempts') + ' left)' : '')
          ),
          diceState && diceState.result
            ? e('div', { className: 'gd-dice-result' },
                diceState.result === diceState.guess
                  ? e('div', { className: 'gd-restitle win' },  diceState.result)
                  : e('div', { className: 'gd-restitle lose' }, diceState.result)
              )
            : e('div', { className: 'gd-dice-row', style: { flexWrap:'wrap', gap:'5px' } },
                Array.from({ length: sides }, (_, i) => i + 1).map(num =>
                  e('button', {
                    key: num,
                    className: 'gd-dice-btn',
                    onClick: () => onRoll(num),
                    style: { width: sides > 6 ? '44px' : '60px', fontSize: sides > 6 ? 'var(--font-sm)' : 'var(--font-md)' },
                  }, num)
                )
              )
        )

      // ── Result display ────────────────────────────────────────────────────
      ) : result ? e('div', { className: 'gd-result' },

        result.action === 'gambit' && result.won && e('div', { className: 'gd-res-inner' },
          e('span', { className: 'gd-resicon' }, '✨'),
          e('div',  { className: 'gd-restitle win' }, 'Victory'),
          e('div',  { className: 'gd-respts' },
            '+', e('b', null, result.pts), ' pts',
            winS && (' · ' + winS),
            winL && (' · ' + winL)
          )
        ),

        result.action === 'gambit' && !result.won && !result.instant && e('div', { className: 'gd-res-inner' },
          e('span', { className: 'gd-resicon' }, '🩸'),
          e('div',  { className: 'gd-restitle lose' }, 'Defeat'),
          e('div',  { className: 'gd-respts' },
            e('b', null, result.pts), ' pts',
            loseS && (' · ' + loseS),
            loseL && (' · ' + loseL)
          )
        ),

        result.action === 'gambit' && result.instant && e('div', { className: 'gd-res-inner' },
          e('span', { className: 'gd-resicon' }, '💀'),
          e('div',  { className: 'gd-restitle lose' }, 'The Devil Collects'),
          e('div',  { className: 'gd-respts' }, 'All lives forfeit')
        ),

        result.action === 'skip' && e('div', { className: 'gd-res-inner' },
          e('span', { className: 'gd-resicon' }, '🌑'),
          e('div',  { className: 'gd-restitle ntrl' }, 'Round Skipped'),
          e('div',  { className: 'gd-respts' },
            e('b', null, result.pts), ' pts',
            skipS && (' · ' + skipS),
            skipL && (' · ' + skipL)
          )
        ),

        result.action === 'blank' && e('div', { className: 'gd-res-inner' },
          e('span', { className: 'gd-resicon' }, '🛡️'),
          e('div',  { className: 'gd-restitle win' }, 'Blank Invoked'),
          e('div',  { className: 'gd-respts' },
            e('b', null, result.pts), ' pts',
            blnkS && (' · ' + blnkS),
            blnkL && (' · ' + blnkL)
          )
        ),

        // ── Stalemate (online MP — all players chose the same gambit) ───────
        result.action === 'draw' && e('div', { className: 'gd-res-inner' },
          e('span', { className: 'gd-resicon' }, '⚖'),
          e('div',  { className: 'gd-restitle lose' }, 'Stalemate'),
          e('div',  { className: 'gd-respts' },
            (result.gambitDesc || result.gambitLabel) && e('div', {
              style: { fontSize: 'var(--font-xs)', opacity: 0.85 },
            }, '⛧ ' + (result.gambitDesc || result.gambitLabel) + ' ⛧'),
            e('div', { style: { marginTop: '6px' } },
              e('b', null, result.pts), ' pts',
              staleS && (' · ' + staleS),
              staleL && (' · ' + staleL)
            )
          )
        )

      // ── Active gambit preview ─────────────────────────────────────────────
      ) : derived ? e('div', {
        className: 'gd-inner' + (isJoker ? ' gd-joker' : ''),
        style: { width:'100%', textAlign:'center' },
      },
        e('div', { className: 'gd-name' }, derived.label),
        e('div', { className: 'gd-desc' }, derived.desc),
        gambitOff    ? e('div', { className: 'gd-disabled-notice' }, '⊘ Gambit Disabled')
        : gambitLocked ? e('div', { className: 'gd-locked-notice' }, '🔒 Gambit Locked')
        : e('div', { className: 'gd-mult' }, 'Multiplier: ', e('b', null, '×' + derived.mult)),
        !gambitOff && !gambitLocked && derived && gs && e('div', { className: 'potential' },
          e('span', null,
            'Reward: ', e('b', null,
              `(${gs.tableCard.numValue} + ${gs.streak}) × ${derived.mult} = ${(gs.tableCard.numValue + gs.streak) * derived.mult} pts`
            )
          )
        )

      // ── Empty state ───────────────────────────────────────────────────────
      ) : e('span', { className: 'gd-empty' }, emptyLabel || '— Choose Your Gambit —')
    ),

    // ── Gambit selection buttons ──────────────────────────────────────────────
    compactGambits
      ? e('div', { className: 'gbrow-compact' },
          e('button', { key: 'low',      className: 'gbc'           + (isSel('value', 'low')     ? ' sel' : ''), onClick: () => !disabled && onToggle('value', 'low'),     disabled }, '▼'),
          e('button', { key: 'high',     className: 'gbc'           + (isSel('value', 'high')    ? ' sel' : ''), onClick: () => !disabled && onToggle('value', 'high'),    disabled }, '▲'),
          e('button', { key: 'red',      className: 'gbc'           + (isSel('color', 'red')     ? ' sel' : ''), onClick: () => !disabled && onToggle('color', 'red'),     disabled }, '♥♦'),
          e('button', { key: 'black',    className: 'gbc'           + (isSel('color', 'black')   ? ' sel' : ''), onClick: () => !disabled && onToggle('color', 'black'),   disabled }, '♣♠'),
          e('button', { key: 'hearts',   className: 'gbc'           + (isSel('suit', 'hearts')   ? ' sel' : ''), onClick: () => !disabled && onToggle('suit', 'hearts'),   disabled }, '♥'),
          e('button', { key: 'diamonds', className: 'gbc'           + (isSel('suit', 'diamonds') ? ' sel' : ''), onClick: () => !disabled && onToggle('suit', 'diamonds'), disabled }, '♦'),
          e('button', { key: 'clubs',    className: 'gbc'           + (isSel('suit', 'clubs')    ? ' sel' : ''), onClick: () => !disabled && onToggle('suit', 'clubs'),    disabled }, '♣'),
          e('button', { key: 'spades',   className: 'gbc'           + (isSel('suit', 'spades')   ? ' sel' : ''), onClick: () => !disabled && onToggle('suit', 'spades'),   disabled }, '♠'),
          e('button', { key: 'joker',    className: 'gbc gbc-joker' + (sel.joker                 ? ' sel' : ''), onClick: () => !disabled && onToggle('joker', true),      disabled }, '⛧')
        )
      : e(React.Fragment, null,
          e('div', { className: 'gbrow' },
            btn('value', 'low',      '▼ Low ▼'),
            btn('color', 'red',      '♥ Red ♦'),
            btn('suit',  'hearts',   '♥ H ♥'),
            btn('suit',  'diamonds', '♦ D ♦')
          ),
          e('div', { className: 'gbrow' },
            btn('value', 'high',   '▲ High ▲'),
            btn('color', 'black',  '♣ Black ♠'),
            btn('suit',  'clubs',  '♣ C ♣'),
            btn('suit',  'spades', '♠ S ♠')
          ),
          e('button', {
            className: 'gb gb-joker' + (sel.joker ? ' sel' : ''),
            onClick: () => !disabled && onToggle('joker', true),
            disabled,
          },
            e('span', { className: 'gbname' }, '⛧ Joker Gambit ⛧')
          )
        )
  );
}
// ──────────────────────────────────────────────────────────────────────────────


// ── StdShop ──────────────────────────────────────────────────────────────────
// Immunity is only offered when the card-effects feature is on (otherwise the
// item would do nothing).  `gs.immunityFromRound` (null = no charge) is used
// to disable the buy button + show an "Already Armed" status when the player
// already has a queued charge — one charge max at a time.
function StdShop({ gs, buyLife, buyBlank, buyImmunity }) {
  const e = React.createElement;
  const immunityCost   = STD_PRESET.costImmunity ?? 2;
  const immunityArmed  = gs && gs.immunityFromRound != null;
  return e('div', { className: 'respan' },
    e('div', { className: 'shopitems' },
      e('div', { className: 'shopitem' },
        e('div', { className: 'shopil' },
          e('span', { className: 'shopname' }, `♥ Health Potion (+${STD_PRESET.shopLifeAmount})`),
          STD_PRESET.infiniteLives
            ? e('span', { className: 'shopcost' }, '∞ Infinite lives active')
            : e('span', { className: 'shopcost' }, 'Cost: ' + STD_PRESET.costLife + ' streak points')
        ),
        e('button', {
          className: 'btngold',
          onClick: buyLife,
          disabled: gs.streak < STD_PRESET.costLife || STD_PRESET.infiniteLives,
        }, 'Buy')
      ),
      STD_PRESET.blanksEnabled && e('div', { className: 'shopitem' },
        e('div', { className: 'shopil' },
          e('span', { className: 'shopname' }, `🛡️ Blank Card (+${STD_PRESET.shopBlankAmount})`),
          STD_PRESET.infiniteBlanks
            ? e('span', { className: 'shopcost' }, '∞ Infinite blanks active')
            : e('span', { className: 'shopcost' }, 'Cost: ' + STD_PRESET.costBlank + ' streak points')
        ),
        e('button', {
          className: 'btngold',
          onClick: buyBlank,
          disabled: gs.streak < STD_PRESET.costBlank || STD_PRESET.infiniteBlanks,
        }, 'Buy')
      ),
      STD_PRESET.cardEffectsEnabled && typeof buyImmunity === 'function' && e('div', { className: 'shopitem' },
        e('div', { className: 'shopil' },
          e('span', { className: 'shopname' }, '🛡 Immunity (next effect)'),
          immunityArmed
            ? e('span', { className: 'shopcost' }, '✓ Armed — blocks the next boon or curse')
            : e('span', { className: 'shopcost' }, 'Cost: ' + immunityCost + ' streak points')
        ),
        e('button', {
          className: 'btngold',
          onClick: buyImmunity,
          disabled: immunityArmed || gs.streak < immunityCost,
        }, 'Buy')
      )
    )
  );
}
// ──────────────────────────────────────────────────────────────────────────────


// ── StdDeckInfo ──────────────────────────────────────────────────────────────
function StdDeckInfo({ gs }) {
  const e = React.createElement;
  if (!gs) return null;
  // Online guests don't receive the raw deck array (stripped to save bandwidth)
  // but the host includes a pre-computed deckStats summary in every broadcast.
  // Fall back to computing live when the full deck is available (local / host).
  const total = gs.deck ? gs.deck.length : (gs.deckStats ? gs.deckStats.total : null);
  const s     = gs.deck ? stdComputeDeckStats(gs.deck) : (gs.deckStats || null);
  if (total == null || !s) return null;
  return e('div', { className: 'deckinfo' },
    e('div', { className: 'deckinfo-hdr' },
      e('span', null, 'Deck'),
      e('span', { className: 'deckinfo-count' }, total + ' cards remaining')
    ),
    e('div', { className: 'deckinfo-row' },
      e('div', { className: 'di-item' }, e('span', { className:'di-lbl' }, 'High'),  e('span', { className:'di-val' }, s.high)),
      e('div', { className: 'di-item' }, e('span', { className:'di-lbl' }, 'Low'),   e('span', { className:'di-val' }, s.low)),
      e('div', { className: 'di-item' }, e('span', { className:'di-lbl' }, 'Ace'),   e('span', { className:'di-val' }, s.ace)),
      e('div', { className: 'di-item' }, e('span', { className:'di-lbl' }, 'Joker'), e('span', { className:'di-val' }, s.joker)),
    ),
    e('div', { className: 'deckinfo-row' },
      e('div', { className: 'di-item' }, e('span', { className:'di-lbl' }, '♥'), e('span', { className:'di-val' }, s.hearts)),
      e('div', { className: 'di-item' }, e('span', { className:'di-lbl' }, '♦'), e('span', { className:'di-val' }, s.diamonds)),
      e('div', { className: 'di-item' }, e('span', { className:'di-lbl' }, '♣'), e('span', { className:'di-val' }, s.clubs)),
      e('div', { className: 'di-item' }, e('span', { className:'di-lbl' }, '♠'), e('span', { className:'di-val' }, s.spades)),
    )
  );
}
// ──────────────────────────────────────────────────────────────────────────────


// ── StdRoundHistory ──────────────────────────────────────────────────────────
function StdRoundHistory({ history }) {
  const e = React.createElement;
  const [open, setOpen] = React.useState(true);
  if (!history || !history.length) return null;

  const fmtLives  = (n) => STD_PRESET.infiniteLives  ? '∞' : n;
  const fmtBlanks = (n) => STD_PRESET.infiniteBlanks ? '∞' : n;

  return e('div', { className: 'rhist' },
    e('div', { className: 'rhist-hdr', onClick: () => setOpen(o => !o) },
      e('span', { className: 'rhist-title' }, '⛧ Round History'),
      e('div',  { className: 'rhist-hdr-right' },
        e('span', { className: 'rhist-count' },  history.length + ' entries'),
        e('span', { className: 'rhist-toggle' }, open ? '▲' : '▼')
      )
    ),
    open && e('div', { className: 'rhist-body' },
      history.map((entry, i) => {
        if (entry.type === 'shop') {
          return e('div', { key: i, className: 'rhe rhe-shop' },
            e('div', { className: 'rhe-top' },
              e('span', { className: 'rhe-badge' },     'R' + entry.round),
              e('span', { className: 'rhe-outcome ntrl' }, 'Shop'),
              e('span', { className: 'rhe-score' },     entry.score.toLocaleString() + ' pts')
            ),
            e('div', { className: 'rhe-bottom' },
              e('span', { className: 'rhe-shop-item' }, entry.item),
              e('span', { className: 'rhe-divider' }),
              e('span', { className: 'rhe-shop-cost' }, '−' + entry.cost + ' streak'),
              e('span', { className: 'rhe-divider' }),
              e('span', { className: 'rhe-stats' }, '♥' + fmtLives(entry.lives) + '  🛡' + fmtBlanks(entry.blanks) + '  ~' + entry.streak)
            )
          );
        }
        if (entry.type === 'effect') {
          // Card-effect entry — appears right after the round entry it modified.
          const fxCls = entry.effectType === 'boon' ? 'win' : 'lose';
          return e('div', { key: i, className: 'rhe rhe-effect rhe-effect-' + entry.effectType },
            e('div', { className: 'rhe-top' },
              e('span', { className: 'rhe-badge' }, 'R' + entry.round),
              e('span', { className: 'rhe-outcome ' + fxCls },
                entry.effectIcon + ' ' + entry.effectName),
              e('span', { className: 'rhe-score' }, entry.score.toLocaleString() + ' pts')
            ),
            e('div', { className: 'rhe-bottom' },
              e('span', { className: 'rhe-gambit' }, entry.effectDesc || ''),
              e('span', { className: 'rhe-divider' }),
              e('span', { className: 'rhe-stats' }, '♥' + fmtLives(entry.lives) + '  🛡' + fmtBlanks(entry.blanks) + '  ~' + entry.streak)
            )
          );
        }
        const outIcon = entry.outcome==='win'?'✨':entry.outcome==='blank'?'🛡️':entry.outcome==='skip'?'🌑':entry.outcome==='instant'?'💀':'🩸';
        const outWord = entry.outcome==='win'?'Victory':entry.outcome==='blank'?'Blank':entry.outcome==='skip'?'Skip':entry.outcome==='instant'?'Forfeit':'Defeat';
        const outCls  = (entry.outcome==='win'||entry.outcome==='blank') ? 'win' : entry.outcome==='skip' ? 'ntrl' : 'lose';
        const ptsTxt  = entry.pts > 0 ? '+' + entry.pts + ' pts' : '';
        return e('div', { key: i, className: 'rhe' },
          e('div', { className: 'rhe-top' },
            e('span', { className: 'rhe-badge' },           'R' + entry.round),
            e('span', { className: 'rhe-outcome ' + outCls }, outIcon + ' ' + outWord),
            ptsTxt && e('span', { className: 'rhe-pts' }, ptsTxt),
            e('span', { className: 'rhe-score' }, entry.score.toLocaleString() + ' pts')
          ),
          e('div', { className: 'rhe-bottom' },
            e('div', { className: 'rhe-cards' },
              e('span', { className: 'rh-card' + cardColorClass(entry.tableCard) }, cardLabel(entry.tableCard)),
              e('span', { className: 'rhe-arrow' }, '→'),
              e('span', { className: 'rh-card' + cardColorClass(entry.handCard) },  cardLabel(entry.handCard))
            ),
            e('span', { className: 'rhe-divider' }),
            e('span', { className: 'rhe-gambit' }, entry.gambit),
            e('span', { className: 'rhe-divider' }),
            e('span', { className: 'rhe-stats' }, '♥' + fmtLives(entry.lives) + '  🛡' + fmtBlanks(entry.blanks) + '  ~' + entry.streak)
          )
        );
      })
    )
  );
}
// ──────────────────────────────────────────────────────────────────────────────


// ── StdInfoPanel ─────────────────────────────────────────────────────────────
function StdInfoPanel({ gs, history, onClose }) {
  const e = React.createElement;
  return e('div', { className: 'info-overlay' },
    e('div', { className: 'info-panel' },
      e('div', { className: 'info-title' }, '⛧ The Ledger ⛧'),
      e('div', { className: 'info-sub' },   'Deck & Round Records'),
      e(StdDeckInfo, { gs }),
      history && history.length
        ? e(StdRoundHistory, { history })
        : e('div', { className: 'info-empty' }, 'No rounds played yet'),
      e('div', { className: 'info-close' },
        e('button', { className:'btnsec', style:{ width:'100%' }, onClick:onClose }, 'Close')
      )
    )
  );
}
// ──────────────────────────────────────────────────────────────────────────────


// ── StdSettingsPanel ─────────────────────────────────────────────────────────
function StdSettingsPanel({
  draft,
  onChange:               _onChange,
  onChangeDeckCount:      _onChangeDeckCount,
  onChangeCardValue:      _onChangeCardValue,
  onChangeGambitDisabled: _onChangeGambitDisabled,
  onChangeGambitMult:     _onChangeGambitMult,
  onApplyPreset,
  onApply, onCancel, onReturnToMenu, gameActive,
  returnToMenuLabel,   // optional override for the "Main Menu" button text
  hideMultiplayer,     // when true, the Multiplayer section is hidden (used by online mode)
  isMultiplayer,       // when true, MP-only effects are shown in the Card Effects pool list
  hideMainMenuButton,  // when true, the bottom "Main Menu" button is hidden (end screens)
  onReturnToLobby,     // when set (host online), replaces "Main Menu" with "Back to Lobby"
  initialPresetId,     // last preset the parent remembered (survives panel remounts)
  onPresetIdChange,    // optional callback so the parent can persist the new selection
}) {
  const e = React.createElement;

  const [secIdx,            setSecIdx]            = React.useState(0);
  const [activeSuit,        setActiveSuit]        = React.useState('hearts');
  const [activeGambitGroup, setActiveGambitGroup] = React.useState('value');
  const [activeOutcomeTab,  setActiveOutcomeTab]  = React.useState('win');
  const [activeFxTab,       setActiveFxTab]       = React.useState('boon');
  const [confirmLeave,      setConfirmLeave]      = React.useState(false);
  // Top-level scope: 'game' = mode-specific tabs (presets / cards / outcomes /
  // …) and Start/Apply CTA. 'general' = sound + background toggle, shared with
  // every other panel via GeneralControls.  Defaults to 'game' so the panel
  // opens on the gameplay tabs the user came here for.
  const [scope,             setScope]             = React.useState('game');
  // 'custom' when the user has hand-edited any value away from a named preset;
  // otherwise the id of whichever preset was last loaded.  Initialised from
  // the parent so a previously-applied preset stays highlighted when the
  // panel is closed and reopened.
  const [activePresetId,    setActivePresetId]    = React.useState(
    initialPresetId !== undefined ? initialPresetId : (STANDARD_PRESETS[0]?.id ?? null)
  );

  const updatePresetId = (id) => {
    setActivePresetId(id);
  };

  // Any direct edit by the user marks the configuration as Custom so the
  // preset indicator updates without comparing every nested field.
  const onChange               = (k, v) => { updatePresetId('custom'); _onChange(k, v); };
  const onChangeDeckCount      = (k, v) => { updatePresetId('custom'); _onChangeDeckCount(k, v); };
  const onChangeCardValue      = (k, v) => { updatePresetId('custom'); _onChangeCardValue(k, v); };
  const onChangeGambitDisabled = (k, v) => { updatePresetId('custom'); _onChangeGambitDisabled(k, v); };
  const onChangeGambitMult     = (k, v) => { updatePresetId('custom'); _onChangeGambitMult(k, v); };

  const handleLoadPreset = (p) => {
    onApplyPreset(p.settings);
    updatePresetId(p.id);
  };

  // ── Reusable rows ─────────────────────────────────────────────────────────
  const stepper = (label, key, min = 0, max = 20) => {
    const val = draft[key] ?? 0;
    return e('div', { className: 'set-row' },
      e('span', { className: 'set-lbl' }, label),
      e('div', { className: 'set-stepper' },
        e('button', { className:'set-stepper-btn', disabled:val<=min, onClick:()=>onChange(key,Math.max(min,val-1)) }, '◀'),
        e('span',   { className:'set-stepper-val' }, val),
        e('button', { className:'set-stepper-btn', disabled:val>=max, onClick:()=>onChange(key,Math.min(max,val+1)) }, '▶'),
      )
    );
  };

  const bigStepper = (label, key, min = 100, max = 10000, step = 100) => {
    const val = draft[key] ?? min;
    return e('div', { className: 'set-row' },
      e('span', { className: 'set-lbl' }, label),
      e('div', { className: 'set-stepper' },
        e('button', { className:'set-stepper-btn', disabled:val<=min, onClick:()=>onChange(key,Math.max(min,val-step)) }, '◀'),
        e('span',   { className:'set-stepper-val', style:{ minWidth:'54px' } }, val.toLocaleString()),
        e('button', { className:'set-stepper-btn', disabled:val>=max, onClick:()=>onChange(key,Math.min(max,val+step)) }, '▶'),
      )
    );
  };

  // ── Card count / pts helpers ──────────────────────────────────────────────
  const getCount = (cardId) => cardId === 'JOKER'
    ? (draft.deckOverrides?.['JOKER'] ?? 2)
    : (draft.deckOverrides?.[cardId] ?? draft.defaultCount ?? 1);

  const getPts = (cardId) => {
    const rank = cardId === 'JOKER' ? 'JOKER' : cardId.split('-')[0];
    return draft.cardValues?.[cardId] !== undefined
      ? draft.cardValues[cardId]
      : (draft.cardValues?.[rank] ?? 0);
  };

  const masterCount = (suit, delta) => {
    if (suit === 'joker') {
      onChangeDeckCount('JOKER', Math.max(0, Math.min(40, getCount('JOKER') + delta)));
    } else {
      VALUES.forEach(v => {
        const id = `${v}-${suit}`;
        onChangeDeckCount(id, Math.max(0, Math.min(20, getCount(id) + delta)));
      });
    }
  };
  const masterValue = (suit, delta) => {
    if (suit === 'joker') {
      onChangeCardValue('JOKER', Math.max(0, Math.min(20, getPts('JOKER') + delta)));
    } else {
      VALUES.forEach(v => {
        const id = `${v}-${suit}`;
        onChangeCardValue(id, Math.max(0, Math.min(20, getPts(id) + delta)));
      });
    }
  };

  const col = (children) => e('div', { className: 'cards-col' }, ...children);
  const centerLbl = (text, extraClass = '') =>
    e('span', { className: 'cards-center-lbl' + (extraClass ? ' ' + extraClass : '') }, text);

  const fusedRow = (cardId, label, countMax = 20) => {
    const count = getCount(cardId);
    const pts   = getPts(cardId);
    return e('div', { key: cardId, className: 'cards-fused-row' },
      col([
        e('button', { className:'set-stepper-btn', disabled:count<=0,        onClick:()=>onChangeDeckCount(cardId,Math.max(0,count-1))         }, '◀'),
        e('span',   { className:'set-stepper-val cards-qty-pts-lbl' }, count),
        e('button', { className:'set-stepper-btn', disabled:count>=countMax, onClick:()=>onChangeDeckCount(cardId,Math.min(countMax,count+1)) }, '▶'),
      ]),
      centerLbl(label, 'cards-card-lbl'),
      col([
        e('button', { className:'set-stepper-btn', disabled:pts<=0,  onClick:()=>onChangeCardValue(cardId,Math.max(0,pts-1))  }, '◀'),
        e('span',   { className:'set-stepper-val cards-qty-pts-lbl' }, pts),
        e('button', { className:'set-stepper-btn', disabled:pts>=20, onClick:()=>onChangeCardValue(cardId,Math.min(20,pts+1)) }, '▶'),
      ]),
    );
  };

  const masterRow = (suit) => {
    const iJ = suit === 'joker';
    const masterCnt = iJ ? getCount('JOKER') : Math.round(VALUES.reduce((s,v) => s + getCount(`${v}-${suit}`), 0) / VALUES.length);
    const masterPts = iJ ? getPts('JOKER')   : Math.round(VALUES.reduce((s,v) => s + getPts(`${v}-${suit}`),   0) / VALUES.length);
    return e('div', { className: 'cards-fused-row cards-master-row' },
      col([
        e('button', { className:'set-stepper-btn', disabled:masterCnt<=0,  onClick:()=>masterCount(suit,-1) }, '◀'),
        e('span',   { className:'set-stepper-val cards-qty-pts-lbl', style:{opacity:0.6} }, 'ALL'),
        e('button', { className:'set-stepper-btn', onClick:()=>masterCount(suit,+1) }, '▶'),
      ]),
      centerLbl(iJ ? '★' : (SYM[suit] || ''), 'cards-card-lbl'),
      col([
        e('button', { className:'set-stepper-btn', disabled:masterPts<=0,  onClick:()=>masterValue(suit,-1) }, '◀'),
        e('span',   { className:'set-stepper-val cards-qty-pts-lbl', style:{opacity:0.6} }, 'ALL'),
        e('button', { className:'set-stepper-btn', onClick:()=>masterValue(suit,+1) }, '▶'),
      ]),
    );
  };

  const totalCards  = stdCountDraftDeck(draft);
  const deckInvalid = totalCards < 2;

  // ── Cards section ────────────────────────────────────────────────────────
  const cardsContent = () => {
    const sym  = activeSuit === 'joker' ? '★' : SYM[activeSuit];
    const rows = activeSuit === 'joker'
      ? [fusedRow('JOKER', '★ JK', 40)]
      : VALUES.map(v => fusedRow(`${v}-${activeSuit}`, `${v} ${sym}`));

    const suitTabs = [
      { k:'hearts',   l:'♥ H' },
      { k:'diamonds', l:'♦ D' },
      { k:'clubs',    l:'♣ C' },
      { k:'spades',   l:'♠ S' },
      { k:'joker',    l:'★ JK' },
    ];

    return e('div', null,
      e('div', { className: 'inf-toggle-row' },
        e('div', null,
          e('span', { className: 'inf-toggle-lbl' }, 'Infinite Deck'),
          e('div',  { className: 'inf-toggle-sub' },
            draft.infiniteDeck ? 'Cards replenish every round' : 'Deck depletes as you play')
        ),
        e('button', {
          className: 'inf-toggle-btn ' + (draft.infiniteDeck ? 'on' : 'off'),
          onClick: () => onChange('infiniteDeck', !draft.infiniteDeck),
        },
          e('span', { className: 'inf-toggle-icon' }, draft.infiniteDeck ? '∞' : '—'),
          e('span', null, draft.infiniteDeck ? 'ON' : 'OFF')
        )
      ),
      e('div', { className: 'cards-section-total' + (deckInvalid ? ' invalid' : '') },
        `Total: ${totalCards} card${totalCards !== 1 ? 's' : ''}`,
        deckInvalid && e('span', null, ' — need at least 2')
      ),
      e('div', { className: 'cards-suit-tabs' },
        suitTabs.map(({ k, l }) =>
          e('button', { key: k, className: 'gb cards-suit-tab' + (activeSuit === k ? ' sel' : ''), onClick: () => setActiveSuit(k) }, l)
        )
      ),
      e('div', { className: 'cards-col-headers' },
        e('span', { className: 'cards-col-hdr-flex' },  'Qty'),
        e('span', { className: 'cards-col-hdr-fixed' }, 'Card'),
        e('span', { className: 'cards-col-hdr-flex' },  'Pts'),
      ),
      masterRow(activeSuit),
      ...rows,
    );
  };

  // ── Gambit modifiers ─────────────────────────────────────────────────────
  const getDM = draft.gambitMultipliers || {};
  const getGM = (key) => getDM[key] ?? 1;

  const GAMBIT_GROUPS = {
    value:      { label:'Value', entries:[{ key:'value-low',label:'▼ Low' },{ key:'value-high',label:'▲ High' }] },
    color:      { label:'Color', entries:[{ key:'color-red',label:'♥♦ Red' },{ key:'color-black',label:'♣♠ Black' }] },
    suit:       { label:'Suit',  entries:[{ key:'suit-hearts',label:'♥ Hearts' },{ key:'suit-diamonds',label:'♦ Diamonds' },{ key:'suit-clubs',label:'♣ Clubs' },{ key:'suit-spades',label:'♠ Spades' }] },
    valueColor: { label:'V+C',   entries:[{ key:'valueColor-low-red',label:'▼+♥♦' },{ key:'valueColor-low-black',label:'▼+♣♠' },{ key:'valueColor-high-red',label:'▲+♥♦' },{ key:'valueColor-high-black',label:'▲+♣♠' }] },
    valueSuit:  { label:'V+S',   entries:[
      { key:'valueSuit-low-hearts',label:'▼ ♥' },{ key:'valueSuit-low-diamonds',label:'▼ ♦' },
      { key:'valueSuit-low-clubs',label:'▼ ♣' },{ key:'valueSuit-low-spades',label:'▼ ♠' },
      { key:'valueSuit-high-hearts',label:'▲ ♥' },{ key:'valueSuit-high-diamonds',label:'▲ ♦' },
      { key:'valueSuit-high-clubs',label:'▲ ♣' },{ key:'valueSuit-high-spades',label:'▲ ♠' },
    ]},
    joker: { label:'⛧ Joker', entries:[{ key:'joker',label:'⛧ Joker Gambit' }] },
  };

  const masterGambitMult = (groupKey, delta) => {
    GAMBIT_GROUPS[groupKey].entries.forEach(({ key }) => {
      onChangeGambitMult(key, Math.max(0, Math.min(20, getGM(key) + delta)));
    });
  };

  const gmFusedRow = ({ key, label }) => {
    const val = getGM(key);
    const off = !!(draft.disabledGambits || {})[key];
    return e('div', { key, className:'cards-fused-row', style:{ alignItems:'center' } },
      e('span', { className:'cards-center-lbl cards-card-lbl',
        style:{ flex:1, textAlign:'left', paddingLeft:'4px', opacity:off?0.38:1, transition:'opacity 0.15s' } }, label),
      e('div', { className:'cards-col', style:{ opacity:off?0.38:1, transition:'opacity 0.15s' } },
        e('button', { className:'set-stepper-btn', disabled:val<=0||off,  onClick:()=>onChangeGambitMult(key,Math.max(0,val-1))  }, '◀'),
        e('span',   { className:'set-stepper-val' }, off ? '—' : val),
        e('button', { className:'set-stepper-btn', disabled:val>=20||off, onClick:()=>onChangeGambitMult(key,Math.min(20,val+1)) }, '▶'),
      ),
      e('button', {
        className: 'set-gambit-btn ' + (off ? 'off' : 'on'),
        style: { flexShrink:0, padding:'4px 8px', fontSize:'var(--font-xs)' },
        onClick: () => onChangeGambitDisabled(key, !off),
      }, off ? 'OFF' : 'ON'),
    );
  };

  const gambitModsContent = () => {
    const groupTabs = Object.entries(GAMBIT_GROUPS).map(([k, g]) => ({ k, l: g.label }));
    const grp       = GAMBIT_GROUPS[activeGambitGroup];
    const dg2       = draft.disabledGambits || {};
    const allOff    = grp.entries.every(({ key }) => !!dg2[key]);
    const masterToggleAll = () => grp.entries.forEach(({ key }) => onChangeGambitDisabled(key, !allOff));
    return e('div', null,
      e('div', { className:'cards-suit-tabs', style:{ flexWrap:'wrap', gap:'4px', marginBottom:'10px' } },
        groupTabs.map(({ k, l }) =>
          e('button', { key: k, className:'gb cards-suit-tab'+(activeGambitGroup===k?' sel':''), onClick:()=>setActiveGambitGroup(k), style:{ flex:'1', minWidth:'52px' } }, l)
        )
      ),
      e('div', { className:'cards-col-headers' },
        e('span', { style:{ flex:1 } }, 'Gambit'),
        e('span', { className:'cards-col-hdr-flex' }, 'Mult'),
        e('span', { style:{ flexShrink:0, width:'44px', textAlign:'center' } }, 'On'),
      ),
      e('div', { className:'cards-master-row' },
        e('span', { className:'set-stepper-val cards-master-lbl', style:{ flex:1, background:'none', border:'none', textAlign:'left', paddingLeft:'4px' } }, grp.label+' — All'),
        e('div', { className:'cards-col' },
          e('button', { className:'set-stepper-btn', onClick:()=>masterGambitMult(activeGambitGroup,-1) }, '◀'),
          e('span',   { className:'set-stepper-val cards-qty-pts-lbl' }, '×ALL'),
          e('button', { className:'set-stepper-btn', onClick:()=>masterGambitMult(activeGambitGroup,+1) }, '▶'),
        ),
        e('button', {
          className: 'set-gambit-btn ' + (allOff ? 'off' : 'on'),
          style: { flexShrink:0, padding:'4px 8px', fontSize:'var(--font-xs)' },
          onClick: masterToggleAll,
        }, allOff ? 'OFF' : 'ON'),
      ),
      ...grp.entries.map(entry => gmFusedRow(entry)),
    );
  };

  // ── Outcomes section ─────────────────────────────────────────────────────
  const universalOpToggle = (label, opKey, modKey, modMax = 20, targetKey = null) => {
    const op  = draft[opKey]  ?? 'add';
    const mod = draft[modKey] ?? 0;
    const minMod    = op === 'divide' ? 1 : 0;
    const displayMod = Math.max(minMod, mod);

    const handleOpChange = (newOp) => {
      onChange(opKey, newOp);
      if (newOp === 'divide' && mod === 0) onChange(modKey, 1);
    };

    const target    = targetKey ? (draft[targetKey] ?? 'cardValueAdd') : null;
    const targetRow = targetKey && e('div', { className:'set-row' },
      e('span', { className:'set-lbl' }, label + ' Target'),
      e('div', { style:{ display:'flex', gap:'4px', flexWrap:'wrap', justifyContent:'flex-end', flex:1, paddingLeft:'10px' } },
        e('button', { className:'set-gambit-btn '+(target==='total'?'on':'off'),          style:{ padding:'3px 6px', fontSize:'var(--font-xs)', flex:'1 1 60px' }, onClick:()=>onChange(targetKey,'total') },        'Total Score'),
        e('button', { className:'set-gambit-btn '+((target==='cardValueAdd')?'on':'off'), style:{ padding:'3px 6px', fontSize:'var(--font-xs)', flex:'1 1 60px' }, onClick:()=>onChange(targetKey,'cardValueAdd') }, 'Card Value +'),
        e('button', { className:'set-gambit-btn '+(target==='cardValueSub'?'on':'off'),   style:{ padding:'3px 6px', fontSize:'var(--font-xs)', flex:'1 1 60px' }, onClick:()=>onChange(targetKey,'cardValueSub') }, 'Card Value −')
      )
    );

    return e('div', null,
      targetRow,
      e('div', { className:'set-row' },
        e('span', { className:'set-lbl' }, label + ' Op.'),
        e('div', { style:{ display:'flex', gap:'4px', flexWrap:'wrap', justifyContent:'flex-end', flex:1, paddingLeft:'10px' } },
          e('button', { className:'set-gambit-btn '+(op==='add'?'on':'off'),      style:{ padding:'3px 6px', fontSize:'var(--font-xs)', flex:'1 1 40px' }, onClick:()=>handleOpChange('add') },      '+ Add'),
          e('button', { className:'set-gambit-btn '+(op==='subtract'?'on':'off'), style:{ padding:'3px 6px', fontSize:'var(--font-xs)', flex:'1 1 40px' }, onClick:()=>handleOpChange('subtract') }, '− Sub'),
          e('button', { className:'set-gambit-btn '+(op==='multiply'?'on':'off'), style:{ padding:'3px 6px', fontSize:'var(--font-xs)', flex:'1 1 40px' }, onClick:()=>handleOpChange('multiply') }, '× Mult'),
          e('button', { className:'set-gambit-btn '+(op==='divide'?'on':'off'),   style:{ padding:'3px 6px', fontSize:'var(--font-xs)', flex:'1 1 40px' }, onClick:()=>handleOpChange('divide') },   '÷ Div'),
        )
      ),
      e('div', { className:'set-row' },
        e('span', { className:'set-lbl' }, label + ' Modifier'),
        e('div', { className:'set-stepper' },
          e('button', { className:'set-stepper-btn', disabled:displayMod<=minMod, onClick:()=>onChange(modKey,Math.max(minMod,displayMod-1)) }, '◀'),
          e('span',   { className:'set-stepper-val' }, displayMod),
          e('button', { className:'set-stepper-btn', disabled:displayMod>=modMax, onClick:()=>onChange(modKey,Math.min(modMax,displayMod+1)) }, '▶'),
        )
      )
    );
  };

  const outcomesContent = () => {
    const sep = () => e('div', { className:'set-action-toggles-sep' });

    const tabContent = () => {
      if (activeOutcomeTab === 'win') return e('div', null,
        universalOpToggle('Lives',  'winLifeOp',   'winLifeMod',  20),
        sep(),
        universalOpToggle('Streak', 'winStreakOp', 'winStreakMod', 20)
      );

      if (activeOutcomeTab === 'lose') return e('div', null,
        universalOpToggle('Lives',  'loseLifeOp',   'loseLifeMod',  20),
        sep(),
        universalOpToggle('Streak', 'loseStreakOp', 'loseStreakMod', 20),
        sep(),
        universalOpToggle('Score',  'loseScoreOp',  'loseScoreMod', 20, 'loseScoreTarget')
      );

      if (activeOutcomeTab === 'skip') return e('div', null,
        e('div', { className:'set-action-toggles' },
          e('div', { className:'set-action-toggle-row' },
            e('span', { className:'set-lbl' }, 'Skip Action'),
            e('button', { className:'inf-toggle-btn '+(draft.skipsEnabled?'on':'off'), onClick:()=>onChange('skipsEnabled',!draft.skipsEnabled) }, draft.skipsEnabled?'✓ ON':'✕ OFF')
          ),
        ),
        universalOpToggle('Lives',  'skipLifeOp',   'skipLifeMod',  20),
        sep(),
        universalOpToggle('Streak', 'skipStreakOp', 'skipStreakMod', 20),
        sep(),
        universalOpToggle('Score',  'skipScoreOp',  'skipScoreMod',  20, 'skipScoreTarget'),
      );

      if (activeOutcomeTab === 'blank') return e('div', null,
        e('div', { className:'set-action-toggles' },
          e('div', { className:'set-action-toggle-row' },
            e('span', { className:'set-lbl' }, 'Blank Action'),
            e('button', { className:'inf-toggle-btn '+(draft.blanksEnabled?'on':'off'), onClick:()=>onChange('blanksEnabled',!draft.blanksEnabled) }, draft.blanksEnabled?'✓ ON':'✕ OFF')
          ),
        ),
        universalOpToggle('Lives',  'blankLifeOp',   'blankLifeMod',  20),
        sep(),
        universalOpToggle('Streak', 'blankStreakOp', 'blankStreakMod', 20),
        sep(),
        universalOpToggle('Score',  'blankScoreOp',  'blankScoreMod',  20, 'blankScoreTarget'),
      );

      // Dice tab — single-player only (Death's Door doesn't apply in online MP)
      if (activeOutcomeTab === 'dice' && !hideMultiplayer) return e('div', null,
        sep(),
        stepper('Roll Attempts (0 = disabled)', 'deathsDoorRolls',     0, 5),
        stepper('Dice Sides (d2–d8)',           'deathsDoorDiceSides', 2, 8),
      );

      // Stalemate tab — online MP only (all active players chose the same gambit)
      if (activeOutcomeTab === 'stalemate' && hideMultiplayer) return e('div', null,
        e('div', { className: 'set-action-toggles' },
          e('div', { className: 'set-action-toggle-row' },
            e('span', { className: 'set-lbl' }, 'Stalemate Penalty'),
            e('button', {
              className: 'inf-toggle-btn ' + (draft.stalemateEnabled ? 'on' : 'off'),
              onClick: () => onChange('stalemateEnabled', !draft.stalemateEnabled),
            }, draft.stalemateEnabled ? 'ON' : 'OFF')
          ),
        ),
        draft.stalemateEnabled && sep(),
        draft.stalemateEnabled && universalOpToggle('Lives',  'stalemateLifeOp',   'stalemateLifeMod',   20),
        draft.stalemateEnabled && sep(),
        draft.stalemateEnabled && universalOpToggle('Streak', 'stalemateStreakOp', 'stalemateStreakMod', 20),
        draft.stalemateEnabled && sep(),
        draft.stalemateEnabled && universalOpToggle('Score',  'stalemateScoreOp',  'stalemateScoreMod',  20, 'stalemateScoreTarget'),
      );

      return null;
    };

    const outcomeTabs = [
      { k:'win',       l:'✨ Win' },
      { k:'lose',      l:'🩸 Loss' },
      { k:'skip',      l:'🌑 Skip' },
      { k:'blank',     l:'🛡️ Blank' },
      // Dice only makes sense in single-player (Death's Door).
      ...(!hideMultiplayer ? [{ k:'dice',      l:'🎲 Dice' }]      : []),
      // Stalemate is an online-MP-only event.
      ...(hideMultiplayer  ? [{ k:'stalemate', l:'⚖ Stalemate' }] : []),
    ];

    return e('div', null,
      e('div', { className:'cards-suit-tabs', style:{ marginBottom:'10px' } },
        outcomeTabs.map(({ k, l }) =>
          e('button', { key: k, className:'gb cards-suit-tab'+(activeOutcomeTab===k?' sel':''), onClick:()=>setActiveOutcomeTab(k), style:{ flex:'1', minWidth:'48px', fontSize:'var(--font-xs)' } }, l)
        )
      ),
      tabContent()
    );
  };

  // ── Starting Conditions ──────────────────────────────────────────────────
  const startingContent = () => e('div', null,
    e('div', { className:'set-row' },
      e('div', null,
        e('span', { className:'set-lbl' }, 'Score Goal'),
        e('div',  { style:{ fontFamily:"'Cinzel',serif", fontSize:'var(--font-xs)', color:'var(--secondary-color)', marginTop:'2px' } },
          draft.scoreToBeatEnabled ? 'Win when score is reached' : 'Play indefinitely')
      ),
      e('button', {
        className: 'inf-toggle-btn ' + (draft.scoreToBeatEnabled ? 'on' : 'off'),
        onClick: () => onChange('scoreToBeatEnabled', !draft.scoreToBeatEnabled),
      }, draft.scoreToBeatEnabled ? '✓ ON' : '✕ OFF')
    ),
    draft.scoreToBeatEnabled && bigStepper('Score to Beat', 'scoreToBeat', 50, 1000, 50),
    e('div', { className:'set-inf-row' },
      stepper('Lives', 'startLives', 1, 20),
      e('div', { className:'set-inf-item' },
        e('div', { className:'set-inf-icon', style:{ color:'var(--lose-color)' } }, '♥'),
        e('div', { className:'set-inf-text' },
          e('span', { className:'set-lbl' }, 'Infinite Lives'),
          e('div',  { className:'set-inf-sub' }, draft.infiniteLives ? 'Can\'t die — play forever' : 'Normal life loss applies')
        ),
        e('button', {
          className: 'inf-toggle-btn ' + (draft.infiniteLives ? 'on' : 'off'),
          onClick: () => onChange('infiniteLives', !draft.infiniteLives),
        },
          e('span', { className:'inf-toggle-icon' }, draft.infiniteLives ? '∞' : '—'),
          e('span', null, draft.infiniteLives ? 'ON' : 'OFF')
        )
      ),
      stepper('Blanks', 'startBlanks', 0, 10),
      e('div', { className:'set-inf-item' },
        e('div', { className:'set-inf-icon', style:{ color:'var(--secondary-color)' } }, '🛡'),
        e('div', { className:'set-inf-text' },
          e('span', { className:'set-lbl' }, 'Infinite Blanks'),
          e('div',  { className:'set-inf-sub' }, draft.infiniteBlanks ? 'Blanks are never spent' : 'Normal blank deduction')
        ),
        e('button', {
          className: 'inf-toggle-btn ' + (draft.infiniteBlanks ? 'on' : 'off'),
          onClick: () => onChange('infiniteBlanks', !draft.infiniteBlanks),
        },
          e('span', { className:'inf-toggle-icon' }, draft.infiniteBlanks ? '∞' : '—'),
          e('span', null, draft.infiniteBlanks ? 'ON' : 'OFF')
        )
      )
    ),
    e('div', { style:{ marginTop:'10px', paddingTop:'10px', borderTop:'1px solid rgba(255,204,77,0.15)' } },
      stepper('Streak', 'startStreak', 0, 20),
    ),
  );

  // ── Presets ──────────────────────────────────────────────────────────────
  const presetCard = (p) => {
    const isActive = activePresetId === p.id;
    return e('div', {
      key: p.id,
      className: 'preset-card' + (isActive ? ' active' : ''),
      onClick: () => handleLoadPreset(p),
    },
      e('div', { className: 'preset-card-header' },
        e('span', { className: 'preset-card-name' }, p.name),
        e('span', { className: 'preset-card-tag' }, p.tag),
      ),
      e('div', { className: 'preset-card-desc' }, p.desc),
    );
  };

  const presetsContent = () => e('div', null,
    e('div', { className: 'preset-grid' },
      ...STANDARD_PRESETS.map(p => presetCard(p)),
      // Custom card is always last; it gets the active highlight whenever the
      // user has hand-edited any value away from a named preset.
      e('div', {
        className: 'preset-card' + (activePresetId === 'custom' ? ' active' : ''),
        style: { cursor: 'default' },
      },
        e('div', { className: 'preset-card-header' },
          e('span', { className: 'preset-card-name' }, 'Custom'),
          e('span', { className: 'preset-card-tag' }, 'Modified'),
        ),
        e('div', { className: 'preset-card-desc' },
          'Settings have been adjusted. Hit Apply to lock in your custom configuration.')
      )
    )
  );

  // ── Card Effects section ────────────────────────────────────────────────
  // Master toggle, appearance-chance slider, and a per-effect allow list so
  // the player can curate which boons / curses are eligible to roll.
  // The list is populated from window.CARD_EFFECTS_DEFS so adding a new
  // effect in core/cardEffects.js automatically surfaces it here.
  const setEffectAllowed = (id, on) => {
    const next = { ...(draft.cardEffectsAllowed || {}), [id]: !!on };
    onChange('cardEffectsAllowed', next);
  };
  const setEffectWeight = (id, w) => {
    const next = { ...(draft.cardEffectWeights || {}), [id]: Math.max(0, Number(w) || 0) };
    onChange('cardEffectWeights', next);
  };
  const cooldownOf = (id) => {
    const v = (draft.cardEffectCooldowns || {})[id];
    return (v === undefined || v === null) ? 0 : Math.max(0, Number(v) || 0);
  };
  const maxActOf = (id) => {
    const v = (draft.cardEffectMaxActivations || {})[id];
    return (v === undefined || v === null) ? 0 : Math.max(0, Number(v) || 0);
  };
  const setCooldown = (id, v) => {
    const next = { ...(draft.cardEffectCooldowns || {}), [id]: Math.max(0, Number(v) || 0) };
    onChange('cardEffectCooldowns', next);
  };
  const setMaxAct = (id, v) => {
    const next = { ...(draft.cardEffectMaxActivations || {}), [id]: Math.max(0, Number(v) || 0) };
    onChange('cardEffectMaxActivations', next);
  };

  const cardEffectsContent = () => {
    const allDefs = Array.isArray(window.CARD_EFFECTS_DEFS) ? window.CARD_EFFECTS_DEFS : [];
    // MP-only effects (those that compare/target across players) are hidden in
    // single-player options since they either do nothing or behave unexpectedly
    // when there is only one player.
    const visibleDefs = isMultiplayer ? allDefs : allDefs.filter(d => !d.mpOnly);
    const boons   = visibleDefs.filter(d => d.type === 'boon');
    const curses  = visibleDefs.filter(d => d.type === 'curse');
    const allowMap = draft.cardEffectsAllowed || {};
    const weightMap = draft.cardEffectWeights || {};
    const isAllowed = (id) => allowMap[id] !== false; // default-on when undefined
    const weightOf  = (id) => {
      const w = weightMap[id];
      return (w === undefined || w === null) ? 1 : Math.max(0, Number(w) || 0);
    };
    const boonPct  = Math.round((draft.cardBoonChance  ?? 0.2) * 100);
    const cursePct = Math.round((draft.cardCurseChance ?? 0.2) * 100);

    const renderEffectRow = (def) => {
      const on   = isAllowed(def.id);
      const cls  = 'cfx-row cfx-' + def.type + (on ? ' on' : ' off');
      // Resolve description using current draft values (not live STD_PRESET) so
      // the text updates immediately as the user edits values.
      const desc = typeof def.desc === 'function' ? def.desc(draft) : def.desc;

      // Per-effect controls (only when enabled): the relative-weight slider
      // (0–5) is always present; numeric value steppers come from def.presetFields.
      const fields = [];
      if (on) {
        const w  = weightOf(def.id);
        const cd = cooldownOf(def.id);
        const ma = maxActOf(def.id);

        // Compact stepper builder: label above, ◀ val ▶ below
        const mkStepper = (key, label, val, minV, maxV, onDec, onInc, display) =>
          e('div', { key, style: { display:'flex', flexDirection:'column', alignItems:'center', gap:'2px' } },
            e('span', { className: 'cfx-field-label' }, label),
            e('div', { className: 'set-stepper cfx-stepper' },
              e('button', { className:'set-stepper-btn', disabled: val <= minV,
                onClick: ev => { ev.stopPropagation(); onDec(); }
              }, '◀'),
              e('span', { className:'set-stepper-val' }, display !== undefined ? display : val),
              e('button', { className:'set-stepper-btn', disabled: val >= maxV,
                onClick: ev => { ev.stopPropagation(); onInc(); }
              }, '▶'),
            )
          );

        // Row 1: Weight · Cooldown · Max Uses
        fields.push(e('div', { key: '__core', onClick: ev => ev.stopPropagation(),
          style: { display:'flex', gap:'8px', flexWrap:'wrap', marginTop:'4px' } },
          mkStepper('w',  'Weight',   w,  0, 10,
            () => setEffectWeight(def.id, Math.max(0,  w  - 1)),
            () => setEffectWeight(def.id, Math.min(10, w  + 1))),
          mkStepper('cd', 'Cooldown', cd, 0, 5,
            () => setCooldown(def.id, Math.max(0, cd - 1)),
            () => setCooldown(def.id, Math.min(5, cd + 1))),
          mkStepper('ma', 'Max Uses', ma, 0, 5,
            () => setMaxAct(def.id, Math.max(0, ma - 1)),
            () => setMaxAct(def.id, Math.min(5, ma + 1)),
            ma === 0 ? '∞' : ma),
        ));

        // Row 2+: effect-specific numeric values (e.g. lives restored, score bonus)
        (def.presetFields || []).forEach(f => {
          const val = draft[f.key] ?? f.min;
          fields.push(e('div', { key: f.key, className: 'cfx-field',
            onClick: ev => ev.stopPropagation() },
            e('span', { className: 'cfx-field-label' }, f.label),
            e('div', { className: 'set-stepper cfx-stepper' },
              e('button', { className: 'set-stepper-btn', disabled: val <= f.min,
                onClick: ev => { ev.stopPropagation(); onChange(f.key, Math.max(f.min, val - f.step)); }
              }, '◀'),
              e('span', { className: 'set-stepper-val' }, val),
              e('button', { className: 'set-stepper-btn', disabled: val >= f.max,
                onClick: ev => { ev.stopPropagation(); onChange(f.key, Math.min(f.max, val + f.step)); }
              }, '▶'),
            )
          ));
        });
      }
      return e('div', { key: def.id, className: cls,
        onClick: () => setEffectAllowed(def.id, !on) },
        e('span', { className: 'cfx-icon' }, def.icon),
        e('div', { className: 'cfx-text' },
          e('div', { className: 'cfx-name' }, def.name),
          e('div', { className: 'cfx-desc' }, desc),
          fields.length > 0 && e('div', { className: 'cfx-fields' }, ...fields)
        ),
        e('span', { className: 'cfx-toggle' }, on ? '✓' : '✕')
      );
    };

    return e('div', null,
      // Master enable
      e('div', { className: 'set-row' },
        e('div', { style: { flex: 1, minWidth: 0, paddingRight: '10px' } },
          e('span', { className: 'set-lbl' }, 'Enable Card Effects'),
          e('div', { style: {
            fontFamily: "'Cinzel',serif", fontSize: 'var(--font-xs)',
            color: 'var(--secondary-color)', marginTop: '2px',
          } }, draft.cardEffectsEnabled
              ? 'Table cards can carry boons or curses'
              : 'Plain cards only')
        ),
        e('button', {
          className: 'inf-toggle-btn' + (draft.cardEffectsEnabled ? ' on' : ' off'),
          onClick: () => onChange('cardEffectsEnabled', !draft.cardEffectsEnabled),
        }, draft.cardEffectsEnabled ? '✓ ON' : '✕ OFF')
      ),

      // Boon chance slider
      draft.cardEffectsEnabled && e('div', { className: 'set-row',
        style: { flexDirection: 'column', alignItems: 'stretch', gap: '8px' } },
        e('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
          e('span', { className: 'set-lbl' }, '✨ Boon Chance'),
          e('span', { style: { fontFamily: "'Cinzel',serif",
            fontSize: 'var(--font-sm)', color: 'var(--accent-color)', fontWeight: 700 } },
            boonPct + '%')
        ),
        e('input', { type: 'range', min: 0, max: 100, step: 1, value: boonPct,
          style: { width: '100%', cursor: 'pointer', accentColor: 'var(--accent-color, #ffcc4d)' },
          onChange: (ev) => onChange('cardBoonChance', Number(ev.target.value) / 100),
        })
      ),

      // Curse chance slider
      draft.cardEffectsEnabled && e('div', { className: 'set-row',
        style: { flexDirection: 'column', alignItems: 'stretch', gap: '8px' } },
        e('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
          e('span', { className: 'set-lbl' }, '☠ Curse Chance'),
          e('span', { style: { fontFamily: "'Cinzel',serif",
            fontSize: 'var(--font-sm)', color: 'var(--accent-color)', fontWeight: 700 } },
            cursePct + '%')
        ),
        e('input', { type: 'range', min: 0, max: 100, step: 1, value: cursePct,
          style: { width: '100%', cursor: 'pointer', accentColor: 'var(--accent-color, #ffcc4d)' },
          onChange: (ev) => onChange('cardCurseChance', Number(ev.target.value) / 100),
        })
      ),

      // Roll Order + First Round — compact side-by-side row (no slider needed;
      // min round is 1–10 so a stepper is more legible than a narrow slider).
      draft.cardEffectsEnabled && e('div', { className: 'set-row',
        style: { gap: '10px', flexWrap: 'wrap', alignItems: 'flex-start' } },
        // Roll order
        e('div', { style: { flex: '1', minWidth: '120px' } },
          e('span', { className: 'set-lbl' }, 'Roll Order'),
          e('div', { style: { display: 'flex', gap: '4px', marginTop: '5px' } },
            e('button', {
              className: 'set-gambit-btn ' + (draft.cardEffectRollOrder !== 'curse' ? 'on' : 'off'),
              style: { padding: '3px 8px', fontSize: 'var(--font-xs)', flex: 1 },
              onClick: () => onChange('cardEffectRollOrder', 'boon'),
            }, '✨ Boon'),
            e('button', {
              className: 'set-gambit-btn ' + (draft.cardEffectRollOrder === 'curse' ? 'on' : 'off'),
              style: { padding: '3px 8px', fontSize: 'var(--font-xs)', flex: 1 },
              onClick: () => onChange('cardEffectRollOrder', 'curse'),
            }, '☠ Curse'),
          )
        ),
        // First-effect round stepper
        e('div', null,
          e('span', { className: 'set-lbl' }, 'First Round'),
          e('div', { className: 'set-stepper', style: { marginTop: '5px' } },
            e('button', { className: 'set-stepper-btn',
              disabled: (draft.cardEffectMinRound ?? 3) <= 1,
              onClick: () => onChange('cardEffectMinRound', Math.max(1, (draft.cardEffectMinRound ?? 3) - 1))
            }, '◀'),
            e('span', { className: 'set-stepper-val' }, draft.cardEffectMinRound ?? 3),
            e('button', { className: 'set-stepper-btn',
              disabled: (draft.cardEffectMinRound ?? 3) >= 10,
              onClick: () => onChange('cardEffectMinRound', Math.min(10, (draft.cardEffectMinRound ?? 3) + 1))
            }, '▶'),
          )
        )
      ),

      // Individual effect allow/weight list — Boons and Curses as sub-tabs.
      draft.cardEffectsEnabled && e('div', { className: 'cfx-section' },
        e('div', { className: 'cards-suit-tabs', style: { gap: '4px', marginBottom: '8px' } },
          e('button', {
            className: 'gb cards-suit-tab' + (activeFxTab === 'boon' ? ' sel' : ''),
            style: { flex: 1 },
            onClick: () => setActiveFxTab('boon'),
          }, '✨ Boons'),
          e('button', {
            className: 'gb cards-suit-tab' + (activeFxTab === 'curse' ? ' sel' : ''),
            style: { flex: 1 },
            onClick: () => setActiveFxTab('curse'),
          }, '☠ Curses'),
        ),
        e('div', { className: 'cfx-list' },
          activeFxTab === 'boon'
            ? (boons.length  ? boons.map(renderEffectRow)  : e('div', { className: 'cfx-empty' }, '(no boons defined)'))
            : (curses.length ? curses.map(renderEffectRow) : e('div', { className: 'cfx-empty' }, '(no curses defined)'))
        )
      ),
    );
  };


  // ── Section registry ─────────────────────────────────────────────────────
  const sections = [
    { title: 'Presets',                 content: presetsContent },
    { title: 'Starting Conditions',     content: startingContent },
    { title: 'Gambit Modifiers',        content: gambitModsContent },
    { title: 'Round Outcomes',          content: outcomesContent },
    { title: 'Shop Costs (streak pts)', content: () => e('div', null,
      stepper('Extra Life',    'costLife',         0, 20),
      stepper('Life Amount',   'shopLifeAmount',   0, 50),
      stepper('Blank Card',    'costBlank',        0, 20),
      stepper('Blank Amount',  'shopBlankAmount',  0, 10),
      stepper('Immunity',      'costImmunity',     0, 20),
    )},
    { title: 'Cards · Counts & Values', content: cardsContent },
    { title: 'Card Effects',            content: cardEffectsContent },
    // Sound + Background controls now live in the "General" scope (top-level
    // toggle above the section nav).  This list stays game-specific so the
    // sideways arrow nav doesn't surface unrelated audio controls.
  ];

  const clampedIdx = Math.min(secIdx, sections.length - 1);
  const sec     = sections[clampedIdx];
  const numSecs = sections.length;

  return e('div', { className: 'set-overlay' },
    e('div', { className: 'set-panel', style: { position: 'relative' } },
      // ── Confirmation overlay (shown when "Main Menu" is clicked mid-game) ──
      confirmLeave && e('div', {
        style: {
          position: 'absolute', inset: 0,
          background: 'rgba(10,10,15,0.92)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          borderRadius: 'inherit', zIndex: 20,
          padding: '24px', gap: '12px', textAlign: 'center',
        },
      },
        e('div', { style: { fontFamily: "'Cinzel',serif", fontSize: 'var(--font-sm)', letterSpacing: '0.06em' } },
          onReturnToLobby ? 'Return to Lobby?' : 'Return to Main Menu?'),
        e('div', { style: { fontFamily: "'Cinzel',serif", fontSize: 'var(--font-xs)', color: 'var(--secondary-color)', lineHeight: 1.5 } },
          onReturnToLobby ? 'All players will be sent to the lobby.' : 'Your current game will be lost.'),
        e('div', { style: { display: 'flex', gap: '10px', marginTop: '4px' } },
          e('button', { className: 'btn-options', onClick: onReturnToLobby || onReturnToMenu, style: { flex: 1 } }, 'Leave'),
          e('button', { className: 'btn-options', onClick: () => setConfirmLeave(false), style: { flex: 1 } }, 'Stay'),
        )
      ),
      e('div', { className: 'set-title' }, '⚙ Standard Options'),
      gameActive && scope === 'game' && e('p', { className: 'set-warn' }, '⚠ Applying will reset the current game.'),

      // ── Top-level scope switcher: Game vs General (in-game only) ──────────
      // Hidden on start/pre-game screens — those already have a dedicated
      // ⚙ Options overlay.  When gameActive is false the scope stays 'game'
      // so the panel renders its normal game-settings content.
      gameActive && e('div', { className: 'set-scope-tabs' },
        e('button', {
          className: 'set-scope-tab' + (scope === 'game'    ? ' active' : ''),
          onClick:   () => setScope('game'),
        }, '⛧ Game'),
        e('button', {
          className: 'set-scope-tab' + (scope === 'general' ? ' active' : ''),
          onClick:   () => setScope('general'),
        }, '⚙ General'),
      ),

      // ── Game scope: existing per-section arrow nav ────────────────────────
      scope === 'game' && e('div', { className: 'set-nav' },
        e('button', { className:'set-nav-arrow', disabled:clampedIdx===0,          onClick:()=>setSecIdx(i=>Math.max(0,i-1)) }, '‹'),
        e('div', { className: 'set-nav-info' },
          e('span', { className: 'set-nav-title' }, sec.title),
          e('div',  { className: 'set-nav-dots' },
            sections.map((_, i) => e('div', { key: i, className: 'set-nav-dot' + (i === clampedIdx ? ' active' : '') }))
          )
        ),
        e('button', { className:'set-nav-arrow', disabled:clampedIdx===numSecs-1, onClick:()=>setSecIdx(i=>Math.min(numSecs-1,i+1)) }, '›'),
      ),

      // ── Content area swaps based on scope ─────────────────────────────────
      e('div', { className: 'set-section' },
        scope === 'game'
          ? sec.content()
          : (window.GeneralControls
              ? e(window.GeneralControls)
              : e('div', { style: { fontFamily:"'Cinzel',serif", fontSize:'var(--font-xs)', color:'var(--secondary-color)', padding:'10px 0' } },
                  'General controls module not loaded.'))
      ),

      // ── Actions row: Apply only makes sense for Game scope ────────────────
      e('div', { className: 'set-actions' },
        scope === 'game' && e('button', {
          className:'btn-start',
          onClick: () => {
            if (typeof onPresetIdChange === 'function') onPresetIdChange(activePresetId);
            onApply();
          },
          disabled: stdCountDraftDeck(draft) < 2,
        }, gameActive ? 'Apply & Reset' : 'Start Game'),
        scope === 'general' && e('button', {
          className:'btn-start',
          onClick: onCancel || onReturnToMenu,
        }, 'Close'),
        scope === 'game' && typeof onCancel === 'function' &&
          e('button', { className:'btnsec', onClick:onCancel }, 'Cancel'),
        !hideMainMenuButton && e('button', { className:'btnsec set-back-btn',
          onClick: gameActive ? () => setConfirmLeave(true) : (onReturnToLobby || onReturnToMenu),
        }, onReturnToLobby ? 'Back to Lobby' : (returnToMenuLabel || 'Main Menu')),
      )
    )
  );
}
// ──────────────────────────────────────────────────────────────────────────────
