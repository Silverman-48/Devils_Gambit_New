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


// ── Card animation timings — THE place to tune the card choreography ─────────
// All values are in milliseconds.  This single object is the source of truth:
//   • The three visual durations are pushed into CSS custom properties below,
//     so the keyframes (.deal / .dealout / the flip transition in style.css)
//     run at exactly these speeds.
//   • Both game modes (standard/app.js, online/app.js) read these for their
//     sequencing pauses and their backgrounded-tab safety timers.
// Change a number here and it takes effect everywhere — no other edits needed.
const CARD_ANIM = {
  dealMs:           320,  // card APPEARING  (deal-in)  — lower = faster
  leaveMs:          260,  // card DISAPPEARING (deal-out) — lower = faster
  flipMs:           380,  // hand card flip reveal
  postLeavePauseMs: 200,  // brief empty-table beat AFTER both cards leave, before the next deal
  resultHoldMs:    1200,  // how long the win/loss result stays on screen
};

// Mirror the visual durations into CSS so the keyframes share these numbers.
(function () {
  const root = document.documentElement;
  root.style.setProperty('--card-deal-dur',  CARD_ANIM.dealMs  + 'ms');
  root.style.setProperty('--card-leave-dur', CARD_ANIM.leaveMs + 'ms');
  root.style.setProperty('--card-flip-dur',  CARD_ANIM.flipMs  + 'ms');
})();
window.CARD_ANIM = CARD_ANIM;
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
// `leaving` takes precedence over `animate`, which takes precedence over
// `waiting` so the class reflects the card's current step in the choreography:
//   leaving  → dealout fade  ·  animate → deal-in  ·  waiting → held invisible
//             (pre-deal, so a staggered card can sit hidden until its turn).
//
// Animation-completion callbacks (event-driven sequencing).  These fire on the
// REAL CSS animationend so callers can advance to the next step only once the
// animation is 100% finished — never on a guessed timer:
//   • onDealDone  — the deal-in (or low-motion fade-in) has fully played
//   • onLeaveDone — the deal-out has fully played
// We filter on the card root itself (e.target === e.currentTarget) so child
// animations (effect badge / overlay) don't masquerade as the card finishing,
// and distinguish deal vs leave by the keyframe name.
//
// `onFxClick`  — optional callback; when provided the effect badge is clickable.
// `fxExpanded` — when true, an overlay showing the full effect description is
//                rendered on top of the card face (click overlay to dismiss).
function CardFace({ card, animate, leaving, waiting, onDealDone, onLeaveDone, onFxClick, fxExpanded }) {
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
              + (leaving ? ' dealout' : animate ? ' deal' : waiting ? ' predeal' : '');

  const handleBadgeClick = eff && onFxClick
    ? e => { e.stopPropagation(); onFxClick(); }
    : undefined;

  const handleAnimEnd = (onDealDone || onLeaveDone)
    ? e => {
        if (e.target !== e.currentTarget) return;     // ignore badge/overlay child animations
        if (e.animationName === 'dealOut') { if (onLeaveDone) onLeaveDone(); }
        else { if (onDealDone) onDealDone(); }         // dealIn (or low-motion fadeIn)
      }
    : undefined;

  return React.createElement('div', { className: cls, onAnimationEnd: handleAnimEnd },
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
// face is showing) fades out as a single unit at end-of-round.  `waiting`
// holds the wrapper invisible (pre-deal) so a staggered card can sit hidden
// until its turn to deal in.
//
// Event-driven sequencing callbacks (fire on the REAL animation/transition end
// so the caller advances only when the step is 100% complete):
//   • onDealDone  — the face-down deal-in (on .cback) has fully played.  It
//                   bubbles up to the wrapper, so one handler catches it there.
//   • onFlipDone  — the face-up flip (transform transition) has fully played.
//                   Both faces transition simultaneously; we key on the .cface
//                   element so the callback fires exactly once.
//   • onLeaveDone — the wrapper's deal-out fade has fully played.
function HandCard({ card, revealed, animate, noAnim, leaving, waiting, onDealDone, onFlipDone, onLeaveDone }) {
  const cls  = 'finner' + (revealed ? ' revealed' : '') + (noAnim ? ' no-flip-anim' : '');
  const wrap = 'fwrap'  + (leaving ? ' dealout' : waiting ? ' predeal' : '');

  const handleWrapAnimEnd = (onDealDone || onLeaveDone)
    ? e => {
        if (e.animationName === 'dealOut') {
          if (e.target === e.currentTarget && onLeaveDone) onLeaveDone();
        } else if (e.animationName === 'dealIn' || e.animationName === 'fadeIn') {
          if (onDealDone) onDealDone();                // bubbled up from .cback
        }
      }
    : undefined;

  const handleFlipEnd = onFlipDone
    ? e => {
        if (e.propertyName === 'transform'
            && e.target && e.target.classList && e.target.classList.contains('cface')) {
          onFlipDone();
        }
      }
    : undefined;

  return React.createElement('div', { className: wrap, onAnimationEnd: handleWrapAnimEnd },
    React.createElement('div', { className: cls, onTransitionEnd: handleFlipEnd },
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
