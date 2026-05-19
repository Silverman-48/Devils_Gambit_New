// ── Shared visual primitives ──────────────────────────────────────────────────
//
// The ONLY things shared between Standard and RPG modes:
//
//   • Card visual constants (suits, values, symbols, what counts as "high")
//   • Card rendering components (CardFace, HandCard) — pure visuals
//   • Tiny pure helpers (cap, colorLabel, cardLabel, cardColorClass)
//   • A shuffle utility (purely mechanical, no game logic)
//
// Each game mode re-implements its own deck construction, gambit logic,
// math, presets, components, and app shell on top of these primitives.
// Deleting either mode's folder leaves the other mode fully playable
// because nothing in here depends on a specific mode's PRESET object.
//
// Load order:  shared.js → background.js → standard/* → rpg/* → router.js
// ──────────────────────────────────────────────────────────────────────────────


// ── Motion preference ────────────────────────────────────────────────────────
const SHARED_LOW_MOTION = false;
if (SHARED_LOW_MOTION) document.documentElement.classList.add('low-motion');
// ──────────────────────────────────────────────────────────────────────────────


// ── Card visual constants ────────────────────────────────────────────────────
const SUITS  = ['hearts','diamonds','clubs','spades'];
const VALUES = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
const SYM    = { hearts:'♥', diamonds:'♦', clubs:'♣', spades:'♠' };
const HIGH   = new Set(['8','9','10','J','Q','K']);

// Empty gambit selection (used by both modes for the gambit picker)
const EMPTY_SEL = { value: null, color: null, suit: null, joker: false };
// ──────────────────────────────────────────────────────────────────────────────


// ── Pure string helpers ──────────────────────────────────────────────────────
function cap(str)      { return str ? str[0].toUpperCase() + str.slice(1) : ''; }
function colorLabel(c) { return c === 'red' ? '♥♦ Red' : '♠♣ Black'; }

function cardLabel(card) {
  if (!card) return '?';
  const isJoker = card.value === 'JOKER';
  const sym   = isJoker ? '★' : (SYM[card.suit] || '');
  const label = isJoker ? 'JK' : card.value;
  return label + sym;
}

function cardColorClass(card) {
  if (!card) return '';
  if (card.value === 'JOKER') return ' rh-joker';
  return ['hearts','diamonds'].includes(card.suit) ? ' rh-red' : ' rh-blk';
}
// ──────────────────────────────────────────────────────────────────────────────


// ── Fisher-Yates shuffle (in-place on a copy) ────────────────────────────────
function shfl(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = 0 | Math.random() * (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
// ──────────────────────────────────────────────────────────────────────────────


// ── CardFace — face-up card render (used by both modes) ──────────────────────
// `leaving` takes precedence over `animate` so a card mid-round that's being
// removed keeps its dealout fade instead of any stale deal-in class.
// `onFxClick`  — optional callback; when provided the effect badge is clickable.
// `fxExpanded` — when true, an overlay showing the full effect description is
//                rendered on top of the card face (click overlay to dismiss).
function CardFace({ card, animate, leaving, onFxClick, fxExpanded }) {
  if (!card) return null;
  const isJ   = card.suit === 'joker';
  const isRed = ['hearts','diamonds'].includes(card.suit);
  const sym   = isJ ? '★' : (SYM[card.suit] || '');
  // Card effect — boon/curse styling + corner badge.  Only applies to the
  // table card (the hand card never carries an effect).  The effect object
  // travels with the card so guests render it just like any other field.
  const eff   = card.effect;
  const fxCls = eff ? (eff.type === 'boon' ? ' fx-boon' : ' fx-curse') : '';
  const cls   = 'card' + (isJ ? ' jokerc' : isRed ? ' red' : ' black')
              + fxCls
              + (leaving ? ' dealout' : animate ? ' deal' : '');

  const handleBadgeClick = eff && onFxClick
    ? e => { e.stopPropagation(); onFxClick(); }
    : undefined;

  return React.createElement('div', { className: cls },
    React.createElement('div', { className: 'ccorner' },
      React.createElement('span', { className: 'cv' }, card.value),
      React.createElement('span', { className: 'cs' }, sym)
    ),
    React.createElement('div', { className: 'cmid' }, sym),
    React.createElement('div', { className: 'ccorner cbot' },
      React.createElement('span', { className: 'cv' }, card.value),
      React.createElement('span', { className: 'cs' }, sym)
    ),
    // Effect badge — centered at top, clickable to expand description.
    eff && React.createElement('div', {
      className: 'card-fx-badge fx-' + eff.type,
      title:     eff.name + ' — ' + eff.desc,
      onClick:   handleBadgeClick,
    },
      React.createElement('span', { className: 'card-fx-icon' }, eff.icon),
      React.createElement('span', { className: 'card-fx-name' }, eff.name)
    ),
    // Description overlay — shown when badge has been clicked; click again to dismiss.
    eff && fxExpanded && React.createElement('div', {
      className: 'card-fx-overlay fx-' + eff.type,
      onClick:   handleBadgeClick,
      title:     'Click to close',
    },
      React.createElement('span', { className: 'card-fx-overlay-icon' }, eff.icon),
      React.createElement('div',  { className: 'card-fx-overlay-name' }, eff.name),
      React.createElement('div',  { className: 'card-fx-overlay-desc' }, eff.desc)
    )
  );
}
// ──────────────────────────────────────────────────────────────────────────────


// ── HandCard — flip-wrapped card (face-down → face-up) ───────────────────────
// `leaving` adds dealout to the outer wrapper so the whole card (whatever
// face is showing) fades out as a single unit at end-of-round.
function HandCard({ card, revealed, animate, noAnim, leaving }) {
  const cls = 'finner' + (revealed ? ' revealed' : '') + (noAnim ? ' no-flip-anim' : '');
  const wrap = 'fwrap' + (leaving ? ' dealout' : '');
  return React.createElement('div', { className: wrap },
    React.createElement('div', { className: cls },
      React.createElement('div', { className: 'cface' }, React.createElement(CardFace, { card })),
      React.createElement('div', { className: 'cbackf' },
        React.createElement('div', { className: 'cback' + (animate && !leaving ? ' deal' : '') },
          React.createElement('span', { className: 'cbsym' }, '⛧')
        )
      )
    )
  );
}
// ──────────────────────────────────────────────────────────────────────────────
