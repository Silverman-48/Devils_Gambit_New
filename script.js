// ── Motion preference ─────────────────────────────────────────────────────────
// Change LOW_MOTION to true to enable reduced motion for players with motion
// sensitivity or vestibular disorders. All movement-based animations are removed;
// only plain opacity fades and colour/glow changes remain.
const LOW_MOTION = false;
if (LOW_MOTION) document.documentElement.classList.add('low-motion');
// ──────────────────────────────────────────────────────────────────────────────

// ── Game Preset ───────────────────────────────────────────────────────────────
// Change any value here to tune the game mechanics globally.
const PRESET = {
  // Starting conditions
  startLives:       3,   // Lives at the start of a game
  startBlanks:      1,   // Blank cards at the start
  startStreak:      0,   // Streak at the start

  // Gambit multipliers (applied as: (tableValue + streak) × mult)
  multValue:        1,   // Value only (High / Low)
  multColor:        1,   // Color only (Red / Black)
  multSuit:         3,   // Suit only (♥ ♦ ♣ ♠)
  multValueColor:   3,   // Value + Color
  multValueSuit:    6,   // Value + Suit
  multJoker:       10,   // Joker Gambit (all-or-nothing)

  // Win outcome
  winLifeOp: 'add', winLifeMod: 0,
  winStreakOp: 'add', winStreakMod: 1,

  // Loss outcome (normal wrong guess)
  loseLifeOp: 'subtract', loseLifeMod: 1,
  loseStreakOp: 'subtract', loseStreakMod: 1,

  // Skip outcome
  skipLifeOp: 'subtract', skipLifeMod: 1,
  skipStreakOp: 'add', skipStreakMod: 1,
  skipScoreOp: 'multiply', skipScoreMod: 0, 

  // Blank outcome
  blankLifeOp: 'add', blankLifeMod: 0,
  blankStreakOp: 'add', blankStreakMod: 0,
  blankScoreOp: 'multiply', blankScoreMod: 1,

  // Death's Door (last-chance dice game)
  deathsDoorRolls:     1,   // Number of attempts the player gets (1–5)
  deathsDoorDiceSides: 4,   // Die type: 2 = d2 up to 8 = d8

  // Action availability
  blanksEnabled:    true, // Allow the Blank action
  skipsEnabled:     true, // Allow the Skip action

  // Infinite modes
  infiniteLives:    false, // Lives never deplete (no game over from wrong guesses)
  infiniteBlanks:   false, // Blanks are never consumed

  // Shop costs (paid in streak points)
  costLife:         2,   // Streak cost to buy an extra life
  costBlank:        4,   // Streak cost to buy a blank card

  // Score Goal
  scoreToBeat:        100, // Target score to trigger the win screen (1–10000)
  scoreToBeatEnabled: true, // Set to false to play indefinitely

  // Custom Deck Settings
  infiniteDeck: false,
  defaultCount: 1, // Default number of each card (Standard deck is 1)
  deckOverrides: {
    'A-hearts': 1, '2-hearts': 1, '3-hearts': 1, '4-hearts': 1, '5-hearts': 1, '6-hearts': 1, '7-hearts': 1,
    '8-hearts': 1, '9-hearts': 1, '10-hearts': 1, 'J-hearts': 1, 'Q-hearts': 1, 'K-hearts': 1,
    'A-spades': 1, '2-spades': 1, '3-spades': 1, '4-spades': 1, '5-spades': 1, '6-spades': 1, '7-spades': 1,
    '8-spades': 1, '9-spades': 1, '10-spades': 1, 'J-spades': 1, 'Q-spades': 1, 'K-spades': 1,
    'A-clubs': 1, '2-clubs': 1, '3-clubs': 1, '4-clubs': 1, '5-clubs': 1, '6-clubs': 1, '7-clubs': 1,
    '8-clubs': 1, '9-clubs': 1, '10-clubs': 1, 'J-clubs': 1, 'Q-clubs': 1, 'K-clubs': 1,
    'A-diamonds': 1, '2-diamonds': 1, '3-diamonds': 1, '4-diamonds': 1, '5-diamonds': 1, '6-diamonds': 1, '7-diamonds': 1,
    '8-diamonds': 1, '9-diamonds': 1, '10-diamonds': 1, 'J-diamonds': 1, 'Q-diamonds': 1, 'K-diamonds': 1,
    'JOKER': 2,
  },

  cardValues: {
    '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
    '8': 8, '9': 9, '10': 10, 'J': 10, 'Q': 10, 'K': 10,
    'A': 20, 'JOKER': 20,
  },

  // Set any key to true to remove that gambit from play.
  // Compound gambits (e.g. valueColor-low-red) are independent of their
  // component singles — disabling "value-low" doesn't disable "valueColor-low-red".
  disabledGambits: {
    'value-low': false, 'value-high': false,
    'color-red': false, 'color-black': false,
    'suit-hearts': false, 'suit-diamonds': false, 'suit-clubs': false, 'suit-spades': false,
    'valueColor-low-red': false, 'valueColor-low-black': false,
    'valueColor-high-red': false, 'valueColor-high-black': false,
    'valueSuit-low-hearts': false, 'valueSuit-low-diamonds': false,
    'valueSuit-low-clubs': false, 'valueSuit-low-spades': false,
    'valueSuit-high-hearts': false, 'valueSuit-high-diamonds': false,
    'valueSuit-high-clubs': false, 'valueSuit-high-spades': false,
    'joker': false,
  },

  // Per-gambit multiplier overrides (mirrors disabledGambits keys)
  gambitMultipliers: {
    'value-low': 1, 'value-high': 1,
    'color-red': 1, 'color-black': 1,
    'suit-hearts': 3, 'suit-diamonds': 3, 'suit-clubs': 3, 'suit-spades': 3,
    'valueColor-low-red': 3, 'valueColor-low-black': 3,
    'valueColor-high-red': 3, 'valueColor-high-black': 3,
    'valueSuit-low-hearts': 6, 'valueSuit-low-diamonds': 6,
    'valueSuit-low-clubs': 6, 'valueSuit-low-spades': 6,
    'valueSuit-high-hearts': 6, 'valueSuit-high-diamonds': 6,
    'valueSuit-high-clubs': 6, 'valueSuit-high-spades': 6,
    'joker': 10,
  },
};
// ──────────────────────────────────────────────────────────────────────────────

const {useState,useEffect,useCallback,useRef}=React;
const EMPTY_SEL = { value: null, color: null, suit: null, joker: false };

const SUITS=['hearts','diamonds','clubs','spades'];
const VALUES=['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
const SYM={hearts:'♥',diamonds:'♦',clubs:'♣',spades:'♠'};
const HIGH=new Set(['8','9','10','J','Q','K']);

function numVal(v, suit) {
  let result;
  const cardKey = suit ? `${v}-${suit}` : null;

  // 1. Check for individual card override first (e.g., 'A-hearts')
  if (cardKey && PRESET.cardValues && PRESET.cardValues[cardKey] !== undefined) {
    result = PRESET.cardValues[cardKey];
  }
  // 2. Check for rank override (e.g., 'A')
  else if (PRESET.cardValues && PRESET.cardValues[v] !== undefined) {
    result = PRESET.cardValues[v];
  }
  // 3. Default game logic
  else if (v === 'JOKER' || v === 'A') {
    result = 20;
  } else if (['J', 'Q', 'K'].includes(v)) {
    result = 10;
  } else {
    result = parseInt(v);
  }

  // Clamp the final result so it never drops below 0 or exceeds 20
  return Math.max(0, Math.min(20, result));
}

function applyMathOp(val, op, mod) {
  if (op === 'add') return val + mod;
  if (op === 'subtract') return Math.max(0, val - mod);
  if (op === 'multiply') return val * mod;
  if (op === 'divide') return mod === 0 ? val : Math.floor(val / mod); // Code-level failsafe
  return val;
}

function mkDeck() {
  const d = [];

  // Helper function to keep numbers between 0 and 20
  const clamp = (num) => Math.max(0, Math.min(20, num));

  // 1. Generate Standard Cards
  for (const s of SUITS) {
    for (const v of VALUES) {
      const cardId = `${v}-${s}`;
      
      // Get the value, then clamp it
      const rawCount = PRESET.deckOverrides[cardId] !== undefined 
                       ? PRESET.deckOverrides[cardId] 
                       : PRESET.defaultCount;
      
      const count = clamp(rawCount);

      for (let i = 0; i < count; i++) {
        d.push({
          suit: s,
          value: v,
          numValue: numVal(v, s),
          id: `${cardId}-${i}`
        });
      }
    }
  }

  // 2. Generate Jokers
  const rawJokerCount = PRESET.deckOverrides['JOKER'] !== undefined 
                        ? PRESET.deckOverrides['JOKER'] 
                        : 2;

  const jokerCount = clamp(rawJokerCount);

  for (let i = 0; i < jokerCount; i++) {
    d.push({
      suit: 'joker',
      value: 'JOKER',
      numValue: 20,
      id: `joker-${i}`
    });
  }

  return d;
}

function countDraftDeck(draft){
  let count=0;
  for(const s of SUITS){
    for(const v of VALUES){
      const cardId=`${v}-${s}`;
      const cnt=draft.deckOverrides?.[cardId]!==undefined
        ?draft.deckOverrides[cardId]
        :draft.defaultCount??1;
      count+=Math.max(0,Math.min(20,cnt));
    }
  }
  count+=Math.max(0,Math.min(20,draft.deckOverrides?.['JOKER']??2));
  return count;
}

function shfl(arr){
  const a=[...arr];
  for(let i=a.length-1;i>0;i--){const j=0|Math.random()*(i+1);[a[i],a[j]]=[a[j],a[i]];}
  return a;
}

function getHighness(card,table){
  if(card.value==='JOKER')return null;
  if(card.value==='A'){if(!table||table.value==='JOKER')return'high';return HIGH.has(table.value)?'high':'low';}
  return HIGH.has(card.value)?'high':'low';
}
function getColor(card){return['hearts','diamonds'].includes(card.suit)?'red':'black';}

function checkGambit(type,pred,hand,table){
  if(type==='joker')return hand.value==='JOKER'; // Win if hand really is a joker
  if(hand.value==='JOKER')return true; // Joker hand beats any other gambit
  const h=getHighness(hand,table),c=getColor(hand);
  switch(type){
    case'value':    return pred.value===h;
    case'color':    return pred.color===c;
    case'suit':     return pred.suit===hand.suit;
    case'valueColor':return pred.value===h&&pred.color===c;
    case'valueSuit': return pred.value===h&&pred.suit===hand.suit;
  }
  return false;
}

function deriveGambit(sel){
  if(!sel)return null;
  const {value:v,color:c,suit:s,joker:j}=sel;
  const gm=(key,fb)=>PRESET.gambitMultipliers?.[key]??fb;
  if(j){const k='joker';return{type:'joker',pred:{},mult:gm(k,PRESET.multJoker),label:'Joker Gambit',desc:'⛧ All or Nothing'};}
  if(!v&&!c&&!s)return null;
  if(v&&s&&!c){const k=`valueSuit-${v}-${s}`;return{type:'valueSuit',pred:{value:v,suit:s},mult:gm(k,PRESET.multValueSuit),label:'Value & Suit',desc:cap(v)+' + '+SYM[s]+' '+cap(s)};}
  if(v&&c&&!s){const k=`valueColor-${v}-${c}`;return{type:'valueColor',pred:{value:v,color:c},mult:gm(k,PRESET.multValueColor),label:'Value & Color',desc:cap(v)+' + '+cap(c)};}
  if(v&&!c&&!s){const k=`value-${v}`;return{type:'value',pred:{value:v},mult:gm(k,PRESET.multValue),label:'Value Gambit',desc:cap(v)};}
  if(c&&!v&&!s){const k=`color-${c}`;return{type:'color',pred:{color:c},mult:gm(k,PRESET.multColor),label:'Color Gambit',desc:colorLabel(c)};}
  if(s&&!v&&!c){const k=`suit-${s}`;return{type:'suit',pred:{suit:s},mult:gm(k,PRESET.multSuit),label:'Suit Gambit',desc:SYM[s]+' '+cap(s)};}
  return null;
}

function cap(str){return str?str[0].toUpperCase()+str.slice(1):'';}
function colorLabel(c){return c==='red'?'♥♦ Red':'♠♣ Black';}

// Returns a stable string key for a derived gambit object.
function gambitKey(g){
  if(!g)return null;
  switch(g.type){
    case'value':      return`value-${g.pred.value}`;
    case'color':      return`color-${g.pred.color}`;
    case'suit':       return`suit-${g.pred.suit}`;
    case'valueColor': return`valueColor-${g.pred.value}-${g.pred.color}`;
    case'valueSuit':  return`valueSuit-${g.pred.value}-${g.pred.suit}`;
    case'joker':      return'joker';
  }
  return null;
}
function isGambitDisabled(g){
  if(!g)return false;
  const k=gambitKey(g);
  return!!(PRESET.disabledGambits&&PRESET.disabledGambits[k]);
}

function computeDeckStats(deck){
  const s={high:0,low:0,ace:0,joker:0,hearts:0,diamonds:0,clubs:0,spades:0};
  for(const c of deck){
    if(c.value==='JOKER')s.joker++;
    else if(c.value==='A')s.ace++;
    else if(HIGH.has(c.value))s.high++;
    else s.low++;
    if(c.suit==='hearts')s.hearts++;
    else if(c.suit==='diamonds')s.diamonds++;
    else if(c.suit==='clubs')s.clubs++;
    else if(c.suit==='spades')s.spades++;
  }
  return s;
}

function cardLabel(card) {
  if (!card) return '?';

  const isJoker = card.value === 'JOKER';
  
  const sym = isJoker ? '★' : (SYM[card.suit] || '');
  const label = isJoker ? 'JK' : card.value;

  return label + sym;
}
function cardColorClass(card){
  if(!card)return'';
  if(card.value==='JOKER')return' rh-joker';
  return['hearts','diamonds'].includes(card.suit)?' rh-red':' rh-blk';
}

function DeckInfo({gs}){
  const e=React.createElement;
  if(!gs)return null;
  const total = gs.deck.length;
  const s=computeDeckStats(gs.deck);
  const z=(n)=>n===0?' di-zero':'';
  return e('div',{className:'deckinfo'},
    e('div',{className:'deckinfo-hdr'},
      e('span',null,'Deck'),
      e('span',{className:'deckinfo-count'},total+' cards remaining')
    ),
    e('div',{className:'deckinfo-row'},
      e('div',{className:'di-item'},e('span',{className:'di-lbl'},'High'),e('span',{className:'di-val'},s.high)),
      e('div',{className:'di-item'},e('span',{className:'di-lbl'},'Low'),e('span',{className:'di-val'},s.low)),
      e('div',{className:'di-item'},e('span',{className:'di-lbl'},'Ace'),e('span',{className:'di-val'},s.ace)),
      e('div',{className:'di-item'},e('span',{className:'di-lbl'},'Joker'),e('span',{className:'di-val'},s.joker)),
    ),
    e('div',{className:'deckinfo-row'},
      e('div',{className:'di-item'},e('span',{className:'di-lbl'},'♥'),e('span',{className:'di-val'},s.hearts)),
      e('div',{className:'di-item'},e('span',{className:'di-lbl'},'♦'),e('span',{className:'di-val'},s.diamonds)),
      e('div',{className:'di-item'},e('span',{className:'di-lbl'},'♣'),e('span',{className:'di-val'},s.clubs)),
      e('div',{className:'di-item'},e('span',{className:'di-lbl'},'♠'),e('span',{className:'di-val'},s.spades)),
    )
  );
}

function RoundHistory({history}){
  const e=React.createElement;
  const [open,setOpen]=useState(true);
  if(!history||!history.length)return null;

  const fmtLives  = (n) => PRESET.infiniteLives  ? '∞' : n;
  const fmtBlanks = (n) => PRESET.infiniteBlanks ? '∞' : n;

  return e('div',{className:'rhist'},
    e('div',{className:'rhist-hdr',onClick:()=>setOpen(o=>!o)},
      e('span',{className:'rhist-title'},'⛧ Round History'),
      e('div',{className:'rhist-hdr-right'},
        e('span',{className:'rhist-count'},history.length+' entries'),
        e('span',{className:'rhist-toggle'},open?'▲':'▼')
      )
    ),
    open&&e('div',{className:'rhist-body'},
      history.map((entry,i)=>{
        if(entry.type==='shop'){
          return e('div',{key:i,className:'rhe rhe-shop'},
            e('div',{className:'rhe-top'},
              e('span',{className:'rhe-badge'},'R'+entry.round),
              e('span',{className:'rhe-outcome ntrl'},'Shop'),
              e('span',{className:'rhe-score'},entry.score.toLocaleString()+' pts')
            ),
            e('div',{className:'rhe-bottom'},
              e('span',{className:'rhe-shop-item'},entry.item),
              e('span',{className:'rhe-divider'}),
              e('span',{className:'rhe-shop-cost'},'−'+entry.cost+' streak'),
              e('span',{className:'rhe-divider'}),
              e('span',{className:'rhe-stats'},'♥'+fmtLives(entry.lives)+'  🛡'+fmtBlanks(entry.blanks)+'  ~'+entry.streak)
            )
          );
        }
        const outIcon=entry.outcome==='win'?'✨':entry.outcome==='blank'?'🛡️':entry.outcome==='skip'?'🌑':entry.outcome==='instant'?'💀':'🩸';
        const outWord=entry.outcome==='win'?'Victory':entry.outcome==='blank'?'Blank':entry.outcome==='skip'?'Skip':entry.outcome==='instant'?'Forfeit':'Defeat';
        const outCls=(entry.outcome==='win'||entry.outcome==='blank')?'win':entry.outcome==='skip'?'ntrl':'lose';
        const ptsTxt=entry.pts>0?'+'+entry.pts+' pts':'';
        return e('div',{key:i,className:'rhe'},
          e('div',{className:'rhe-top'},
            e('span',{className:'rhe-badge'},'R'+entry.round),
            e('span',{className:'rhe-outcome '+outCls},outIcon+' '+outWord),
            ptsTxt&&e('span',{className:'rhe-pts'},ptsTxt),
            e('span',{className:'rhe-score'},entry.score.toLocaleString()+' pts')
          ),
          e('div',{className:'rhe-bottom'},
            e('div',{className:'rhe-cards'},
              e('span',{className:'rh-card'+cardColorClass(entry.tableCard)},cardLabel(entry.tableCard)),
              e('span',{className:'rhe-arrow'},'→'),
              e('span',{className:'rh-card'+cardColorClass(entry.handCard)},cardLabel(entry.handCard))
            ),
            e('span',{className:'rhe-divider'}),
            e('span',{className:'rhe-gambit'},entry.gambit),
            e('span',{className:'rhe-divider'}),
            e('span',{className:'rhe-stats'},'♥'+fmtLives(entry.lives)+'  🛡'+fmtBlanks(entry.blanks)+'  ~'+entry.streak)
          )
        );
      })
    )
  );
}


function CardFace({card,animate}){
  if(!card)return null;
  const isJ=card.suit==='joker';
  const isRed=['hearts','diamonds'].includes(card.suit);
  const sym=isJ?'★':(SYM[card.suit]||'');
  const cls='card'+(isJ?' jokerc':isRed?' red':' black')+(animate?' deal':'');
  return React.createElement('div',{className:cls},
    React.createElement('div',{className:'ccorner'},
      React.createElement('span',{className:'cv'},card.value),
      React.createElement('span',{className:'cs'},sym)
    ),
    React.createElement('div',{className:'cmid'},sym),
    React.createElement('div',{className:'ccorner cbot'},
      React.createElement('span',{className:'cv'},card.value),
      React.createElement('span',{className:'cs'},sym)
    )
  );
}

function HandCard({card,revealed,animate,noAnim}){
  const cls='finner'+(revealed?' revealed':'')+(noAnim?' no-flip-anim':'');
  return React.createElement('div',{className:'fwrap'},
    React.createElement('div',{className:cls},
      React.createElement('div',{className:'cface'},React.createElement(CardFace,{card})),
      React.createElement('div',{className:'cbackf'},
        React.createElement('div',{className:'cback'+(animate?' deal':'')},
          React.createElement('span',{className:'cbsym'},'⛧')
        )
      )
    )
  );
}

function GambitPanel({sel,onToggle,derived,gs,disabled,result,lastChance,diceState,onRoll}){
  const e=React.createElement;
  const isSel=(type,val)=>{
    if(type==='joker')return sel.joker;
    if(type==='value')return sel.value===val;
    if(type==='color')return sel.color===val;
    if(type==='suit')return sel.suit===val;
    return false;
  };
  const btn=(type,val,label)=>
    e('button',{key:val||type,className:'gb'+(isSel(type,val)?' sel':''),onClick:()=>!disabled&&onToggle(type,val),disabled},
      e('span',{className:'gbname'},label)
    );

const fmtMod = (op, mod, label) => {
    if ((op === 'add' || op === 'subtract') && mod === 0) return null;
    if ((op === 'multiply' || op === 'divide') && mod === 1) return null;
    let sign = op === 'add' ? '+' : op === 'subtract' ? '−' : op === 'multiply' ? '×' : '÷';
    return `${sign}${mod} ${label}`;
  };

  const isJoker=derived&&derived.type==='joker';
  const gambitOff=derived&&isGambitDisabled(derived);
  const isResultWin=result&&(result.won||result.action==='blank');
  const isResultNtrl=result&&result.action==='skip';
  const displayCls='gambit-display'+(
    lastChance?' last-chance':
    result?(isResultWin?' result-win':isResultNtrl?' result-ntrl':' result-lose'):
    (derived?(gambitOff?' active-disabled':isJoker?' active-joker':' active'):'')
  );

  const sides = PRESET.deathsDoorDiceSides || 4;
  const totalRolls = PRESET.deathsDoorRolls || 1;
  const rollsLeft = diceState?.rollsLeft ?? totalRolls;
  const diceName = 'D'+sides;

// Build text readouts
const winS = fmtMod(PRESET.winStreakOp, PRESET.winStreakMod, 'streak');
const winL = fmtMod(PRESET.winLifeOp, PRESET.winLifeMod, '♥');
const loseL = fmtMod(PRESET.loseLifeOp, PRESET.loseLifeMod, '♥');
const loseS = fmtMod(PRESET.loseStreakOp, PRESET.loseStreakMod, 'streak');
const skipL = fmtMod(PRESET.skipLifeOp, PRESET.skipLifeMod, '♥');
const skipS = fmtMod(PRESET.skipStreakOp, PRESET.skipStreakMod, 'streak');
const blnkL = fmtMod(PRESET.blankLifeOp, PRESET.blankLifeMod, '♥');
const blnkS = fmtMod(PRESET.blankStreakOp, PRESET.blankStreakMod, 'streak');

  return e('div',{className:'gambit-panel'},
    e('div',{className:displayCls},
      lastChance?e('div',{className:'gd-dice'},
        e('div',{className:'gd-dice-inner'},
          e('div',{className:'gd-restitle dice'},'🎲 Death\'s Door 🎲'),
          e('div',{className:'gd-dice-sub'},
            'Guess the '+diceName+' to cheat death'+(totalRolls>1?' ('+rollsLeft+' of '+totalRolls+' '+( rollsLeft===1?'attempt':'attempts')+' left)':'')
          ),
          diceState&&diceState.result?
            e('div',{className:'gd-dice-result'},
              diceState.result===diceState.guess
                ?e('div',{className:'gd-restitle win'},diceState.result)
                :e('div',{className:'gd-restitle lose'},diceState.result)
            ):
            e('div',{className:'gd-dice-row',style:{flexWrap:'wrap',gap:'5px'}},
              Array.from({length:sides},(_,i)=>i+1).map(num=>
                e('button',{key:num,className:'gd-dice-btn',onClick:()=>onRoll(num),
                  style:{width: sides>6?'44px':'60px', fontSize: sides>6?'var(--font-sm)':'var(--font-md)'}
                },num)
              )
            )
        )
      ):result?e('div',{className:'gd-result'},
        result.action==='gambit'&&result.won&&e('div',{className:'gd-res-inner'},
          e('span',{className:'gd-resicon'},'✨'),
          e('div',{className:'gd-restitle win'},'Victory'),
    e('div',{className:'gd-respts'},
            '+',e('b',null,result.pts),' pts',
            winS && (' · ' + winS),
            winL && (' · ' + winL)
          )
        ),
        result.action==='gambit'&&!result.won&&!result.instant&&e('div',{className:'gd-res-inner'},
          e('span',{className:'gd-resicon'},'🩸'),
          e('div',{className:'gd-restitle lose'},'Defeat'),
e('div',{className:'gd-respts'},
            '+',e('b',null,result.pts),' pts',
            winS && (' · ' + winS),
            winL && (' · ' + winL)
          )
        ),
        result.action==='gambit'&&result.instant&&e('div',{className:'gd-res-inner'},
          e('span',{className:'gd-resicon'},'💀'),
          e('div',{className:'gd-restitle lose'},'The Devil Collects'),
          e('div',{className:'gd-respts'},'All lives forfeit')
        ),
        result.action==='skip'&&e('div',{className:'gd-res-inner'},
          e('span',{className:'gd-resicon'},'🌑'),
          e('div',{className:'gd-restitle ntrl'},'Round Skipped'),
e('div',{className:'gd-respts'},
            '+',e('b',null,result.pts),' pts',
            winS && (' · ' + winS),
            winL && (' · ' + winL)
          )
        ),
        result.action==='blank'&&e('div',{className:'gd-res-inner'},
          e('span',{className:'gd-resicon'},'🛡️'),
          e('div',{className:'gd-restitle win'},'Blank Invoked'),
e('div',{className:'gd-respts'},
            '+',e('b',null,result.pts),' pts',
            winS && (' · ' + winS),
            winL && (' · ' + winL)
          )
        )
      ):derived?e('div',{className:'gd-inner'+(isJoker?' gd-joker':''),style:{width:'100%',textAlign:'center'}},
        e('div',{className:'gd-name'},derived.label),
        e('div',{className:'gd-desc'},derived.desc),
        gambitOff
          ?e('div',{className:'gd-disabled-notice'},'⊘ Gambit Disabled')
          :e('div',{className:'gd-mult'},'Multiplier: ',e('b',null,'×'+derived.mult)),
        !gambitOff&&derived&&gs&&e('div',{className:'potential'},
          'Reward: ',e('b',null,
            `(${gs.tableCard.numValue} + ${gs.streak}) × ${derived.mult} = ${(gs.tableCard.numValue+gs.streak)*derived.mult} pts`
          )
        ),
      ):e('span',{className:'gd-empty'},'— Choose Your Gambit —'),
    ),
    e('div',{className:'gbrow'},
      btn('value','low','▼ Low ▼'),
      btn('color','red','♥ Red ♦'),
      btn('suit','hearts','♥ H ♥'),
      btn('suit','diamonds','♦ D ♦')
    ),
    e('div',{className:'gbrow'},
      btn('value','high','▲ High ▲'),
      btn('color','black','♣ Black ♠'),
      btn('suit','clubs','♣ C ♣'),
      btn('suit','spades','♠ S ♠')
    ),
    e('button',{className:'gb gb-joker'+(sel.joker?' sel':''),onClick:()=>!disabled&&onToggle('joker',true),disabled},
      e('span',{className:'gbname'},'⛧ Joker Gambit ⛧')
    )
  );
}

function Shop({gs,buyLife,buyBlank,onClose}){
  const e=React.createElement;
  return e('div',{className:'respan'},
    e('div',{className:'shopitems'},
      e('div',{className:'shopitem'},
        e('div',{className:'shopil'},
          e('span',{className:'shopname'},'Extra Life'),
          PRESET.infiniteLives
            ? e('span',{className:'shopcost'},'∞ Infinite lives active')
            : e('span',{className:'shopcost'},'Cost: '+PRESET.costLife+' streak points')
        ),
        e('button',{className:'btngold',onClick:buyLife,
          disabled:gs.streak<PRESET.costLife||PRESET.infiniteLives},'Buy')
      ),
      PRESET.blanksEnabled&&e('div',{className:'shopitem'},
        e('div',{className:'shopil'},
          e('span',{className:'shopname'},'Blank'),
          PRESET.infiniteBlanks
            ? e('span',{className:'shopcost'},'∞ Infinite blanks active')
            : e('span',{className:'shopcost'},'Cost: '+PRESET.costBlank+' streak points')
        ),
        e('button',{className:'btngold',onClick:buyBlank,
          disabled:gs.streak<PRESET.costBlank||PRESET.infiniteBlanks},'Buy')
      )
    )
  );
}

function SettingsPanel({draft, onChange, onChangeDeckCount, onChangeCardValue, onChangeGambitDisabled, onChangeGambitMult, onApply, onCancel, gameActive}){
  const e=React.createElement;
  const [secIdx,setSecIdx]=useState(0);
  const [activeSuit,setActiveSuit]=useState('hearts');
  const [activeGambitGroup,setActiveGambitGroup]=useState('value');
  const [activeOutcomeTab,setActiveOutcomeTab]=useState('win');

const toggle=(label,key)=>{
    const val=!!draft[key];
    return e('div',{className:'set-row'},
      e('span',{className:'set-lbl',style:{flex:1}},label),
      e('button',{
        className:'set-gambit-btn '+(val?'on':'off'),
        onClick:()=>onChange(key,!val)
      },val?'Enabled':'Disabled')
    );
  };

  // ── Generic stepper for flat PRESET keys ──────────────────────────────────
  const stepper=(label,key,min=0,max=20)=>{
    const val=draft[key]??0;
    return e('div',{className:'set-row'},
      e('span',{className:'set-lbl'},label),
      e('div',{className:'set-stepper'},
        e('button',{className:'set-stepper-btn',disabled:val<=min,onClick:()=>onChange(key,Math.max(min,val-1))},'◀'),
        e('span',{className:'set-stepper-val'},val),
        e('button',{className:'set-stepper-btn',disabled:val>=max,onClick:()=>onChange(key,Math.min(max,val+1))},'▶'),
      )
    );
  };

  // ── Large-range stepper (for score goal 100–10000, step 100) ─────────────
  const bigStepper=(label,key,min=100,max=10000,step=100)=>{
    const val=draft[key]??min;
    return e('div',{className:'set-row'},
      e('span',{className:'set-lbl'},label),
      e('div',{className:'set-stepper'},
        e('button',{className:'set-stepper-btn',disabled:val<=min,onClick:()=>onChange(key,Math.max(min,val-step))},'◀'),
        e('span',{className:'set-stepper-val',style:{minWidth:'54px'}},val.toLocaleString()),
        e('button',{className:'set-stepper-btn',disabled:val>=max,onClick:()=>onChange(key,Math.min(max,val+step))},'▶'),
      )
    );
  };

  // ── Helpers to read current count / pts for a given cardId ────────────────
  const getCount=(cardId)=>cardId==='JOKER'
    ?(draft.deckOverrides?.['JOKER']??2)
    :(draft.deckOverrides?.[cardId]??draft.defaultCount??1);

  const getPts=(cardId)=>{
    const rank=cardId==='JOKER'?'JOKER':cardId.split('-')[0];
    return draft.cardValues?.[cardId]!==undefined
      ?draft.cardValues[cardId]
      :(draft.cardValues?.[rank]??0);
  };

  // ── Master: nudge every card in a suit at once ────────────────────────────
  const masterCount=(suit,delta)=>{
    if(suit==='joker'){
      onChangeDeckCount('JOKER',Math.max(0,Math.min(40,getCount('JOKER')+delta)));
    } else {
      VALUES.forEach(v=>{
        const id=`${v}-${suit}`;
        onChangeDeckCount(id,Math.max(0,Math.min(20,getCount(id)+delta)));
      });
    }
  };
  const masterValue=(suit,delta)=>{
    if(suit==='joker'){
      onChangeCardValue('JOKER',Math.max(0,Math.min(20,getPts('JOKER')+delta)));
    } else {
      VALUES.forEach(v=>{
        const id=`${v}-${suit}`;
        onChangeCardValue(id,Math.max(0,Math.min(20,getPts(id)+delta)));
      });
    }
  };

  // ── Fused three-column row: [cnt stepper] [card label] [pts stepper] ──────
  const col=(children)=>e('div',{className:'cards-col'},
    ...children
  );
  const centerLbl=(text,extraClass='')=>e('span',{className:'cards-center-lbl'+(extraClass?' '+extraClass:'')},text);

  const fusedRow=(cardId,label,countMax=20)=>{
    const count=getCount(cardId);
    const pts=getPts(cardId);
    return e('div',{key:cardId,className:'cards-fused-row'},
      col([
        e('button',{className:'set-stepper-btn',disabled:count<=0,
          onClick:()=>onChangeDeckCount(cardId,Math.max(0,count-1))},'◀'),
        e('span',{className:'set-stepper-val'},count),
        e('button',{className:'set-stepper-btn',disabled:count>=countMax,
          onClick:()=>onChangeDeckCount(cardId,Math.min(countMax,count+1))},'▶'),
      ]),
      centerLbl(label,'cards-card-lbl'),
      col([
        e('button',{className:'set-stepper-btn',disabled:pts<=0,
          onClick:()=>onChangeCardValue(cardId,Math.max(0,pts-1))},'◀'),
        e('span',{className:'set-stepper-val'},pts),
        e('button',{className:'set-stepper-btn',disabled:pts>=20,
          onClick:()=>onChangeCardValue(cardId,Math.min(20,pts+1))},'▶'),
      ]),
    );
  };

  // ── Master row (same three-column shape, no number in the middle) ─────────
  const masterRow=(suit)=>{
    const sym=suit==='joker'?'★':SYM[suit];
    return e('div',{className:'cards-master-row'},
      col([
        e('button',{className:'set-stepper-btn',onClick:()=>masterCount(suit,-1)},'◀'),
        e('span',{className:'set-stepper-val cards-qty-pts-lbl'},'QTY'),
        e('button',{className:'set-stepper-btn',onClick:()=>masterCount(suit,+1)},'▶'),
      ]),
      centerLbl(sym+' All','cards-master-lbl'),
      col([
        e('button',{className:'set-stepper-btn',onClick:()=>masterValue(suit,-1)},'◀'),
        e('span',{className:'set-stepper-val cards-qty-pts-lbl'},'PTS'),
        e('button',{className:'set-stepper-btn',onClick:()=>masterValue(suit,+1)},'▶'),
      ]),
    );
  };

  const totalCards=countDraftDeck(draft);
  const deckInvalid=totalCards<2;

  // ── Fused "Cards" section content ─────────────────────────────────────────
  const cardsSectionContent=()=>{
    const sym=activeSuit==='joker'?'★':SYM[activeSuit];
    const rows=activeSuit==='joker'
      ?[fusedRow('JOKER','★ JK',40)]
      :VALUES.map(v=>fusedRow(`${v}-${activeSuit}`,`${v} ${sym}`));

    const suitTabs=[
      {k:'hearts', l:'♥ H'},
      {k:'diamonds',l:'♦ D'},
      {k:'clubs',   l:'♣ C'},
      {k:'spades',  l:'♠ S'},
      {k:'joker',   l:'★ JK'},
    ];

    return e('div',null,
      // Infinite Deck toggle — custom pill design
      e('div',{className:'inf-toggle-row'},
        e('div',null,
          e('span',{className:'inf-toggle-lbl'},'Infinite Deck'),
          e('div',{className:'inf-toggle-sub'},
            draft.infiniteDeck?'Cards replenish every round':'Deck depletes as you play'
          )
        ),
        e('button',{
          className:'inf-toggle-btn '+(draft.infiniteDeck?'on':'off'),
          onClick:()=>onChange('infiniteDeck',!draft.infiniteDeck)
        },
          e('span',{className:'inf-toggle-icon'},draft.infiniteDeck?'∞':'—'),
          e('span',null,draft.infiniteDeck?'ON':'OFF')
        )
      ),
      e('div',{className:'cards-section-total'+(deckInvalid?' invalid':'')},
        `Total: ${totalCards} card${totalCards!==1?'s':''}`,
        deckInvalid&&e('span',null,' — need at least 2')
      ),
      // Suit selector buttons
      e('div',{className:'cards-suit-tabs'},
        suitTabs.map(({k,l})=>e('button',{
          key:k,
          className:'gb cards-suit-tab'+(activeSuit===k?' sel':''),
          onClick:()=>setActiveSuit(k),
        },l))
      ),
      // Column headers
      e('div',{className:'cards-col-headers'},
        e('span',{className:'cards-col-hdr-flex'},'Qty'),
        e('span',{className:'cards-col-hdr-fixed'},'Card'),
        e('span',{className:'cards-col-hdr-flex'},'Pts'),
      ),
      // Master row
      masterRow(activeSuit),
      // Per-card rows
      ...rows,
    );
  };

  // ── Active Gambits section content ───────────────────────────────────────────
  const dg=draft.disabledGambits||{};
  const gambitBtn=(key,label)=>{
    const off=!!dg[key];
    return e('button',{
      key,
      className:'set-gambit-btn'+(off?' off':' on'),
      onClick:()=>onChangeGambitDisabled(key,!off),
    },label);
  };

  const gambitsContent=()=>e('div',{className:'set-gambits'},
    e('div',{className:'set-gambit-group'},
      e('div',{className:'set-gambit-group-label'},'Value'),
      e('div',{className:'set-gambit-row'},
        gambitBtn('value-low','▼ Low'),
        gambitBtn('value-high','▲ High'),
      )
    ),
    e('div',{className:'set-gambit-group'},
      e('div',{className:'set-gambit-group-label'},'Color'),
      e('div',{className:'set-gambit-row'},
        gambitBtn('color-red','♥♦ Red',true),
        gambitBtn('color-black','♣♠ Black'),
      )
    ),
    e('div',{className:'set-gambit-group'},
      e('div',{className:'set-gambit-group-label'},'Suit'),
      e('div',{className:'set-gambit-row'},
        gambitBtn('suit-hearts','♥ Hearts',true),
        gambitBtn('suit-diamonds','♦ Diamonds',true),
        gambitBtn('suit-clubs','♣ Clubs'),
        gambitBtn('suit-spades','♠ Spades'),
      )
    ),
    e('div',{className:'set-gambit-group'},
      e('div',{className:'set-gambit-group-label'},'Value + Color'),
      e('div',{className:'set-gambit-grid-2x2'},
        gambitBtn('valueColor-low-red','▼ Low + Red ♥♦',true),
        gambitBtn('valueColor-low-black','▼ Low + Black ♣♠'),
        gambitBtn('valueColor-high-red','▲ High + Red ♥♦',true),
        gambitBtn('valueColor-high-black','▲ High + Black ♣♠'),
      )
    ),
    e('div',{className:'set-gambit-group'},
      e('div',{className:'set-gambit-group-label'},'Value + Suit'),
      e('div',{className:'set-gambit-grid-vs'},
        gambitBtn('valueSuit-low-hearts','▼ ♥',true),
        gambitBtn('valueSuit-low-diamonds','▼ ♦',true),
        gambitBtn('valueSuit-low-clubs','▼ ♣'),
        gambitBtn('valueSuit-low-spades','▼ ♠'),
        gambitBtn('valueSuit-high-hearts','▲ ♥',true),
        gambitBtn('valueSuit-high-diamonds','▲ ♦',true),
        gambitBtn('valueSuit-high-clubs','▲ ♣'),
        gambitBtn('valueSuit-high-spades','▲ ♠'),
      )
    ),
    e('div',{className:'set-gambit-group'},
      e('div',{className:'set-gambit-group-label'},'Joker'),
      e('div',{className:'set-gambit-row'},
        gambitBtn('joker','⛧ Joker Gambit'),
      )
    ),
  );

  // ── Gambit Modifiers section ─────────────────────────────────────────────────
  const getDM = draft.gambitMultipliers || {};
  const getGM = (key) => getDM[key] ?? 1;

  const GAMBIT_GROUPS = {
    value: {
      label: 'Value',
      entries: [
        { key: 'value-low',  label: '▼ Low' },
        { key: 'value-high', label: '▲ High' },
      ],
    },
    color: {
      label: 'Color',
      entries: [
        { key: 'color-red',   label: '♥♦ Red' },
        { key: 'color-black', label: '♣♠ Black' },
      ],
    },
    suit: {
      label: 'Suit',
      entries: [
        { key: 'suit-hearts',   label: '♥ Hearts' },
        { key: 'suit-diamonds', label: '♦ Diamonds' },
        { key: 'suit-clubs',    label: '♣ Clubs' },
        { key: 'suit-spades',   label: '♠ Spades' },
      ],
    },
    valueColor: {
      label: 'V+C',
      entries: [
        { key: 'valueColor-low-red',   label: '▼+♥♦' },
        { key: 'valueColor-low-black', label: '▼+♣♠' },
        { key: 'valueColor-high-red',  label: '▲+♥♦' },
        { key: 'valueColor-high-black',label: '▲+♣♠' },
      ],
    },
    valueSuit: {
      label: 'V+S',
      entries: [
        { key: 'valueSuit-low-hearts',   label: '▼ ♥' },
        { key: 'valueSuit-low-diamonds', label: '▼ ♦' },
        { key: 'valueSuit-low-clubs',    label: '▼ ♣' },
        { key: 'valueSuit-low-spades',   label: '▼ ♠' },
        { key: 'valueSuit-high-hearts',  label: '▲ ♥' },
        { key: 'valueSuit-high-diamonds',label: '▲ ♦' },
        { key: 'valueSuit-high-clubs',   label: '▲ ♣' },
        { key: 'valueSuit-high-spades',  label: '▲ ♠' },
      ],
    },
    joker: {
      label: '⛧ Joker',
      entries: [
        { key: 'joker', label: '⛧ Joker Gambit' },
      ],
    },
  };

  const masterGambitMult = (groupKey, delta) => {
    GAMBIT_GROUPS[groupKey].entries.forEach(({key}) => {
      onChangeGambitMult(key, Math.max(0, Math.min(20, getGM(key) + delta)));
    });
  };

  const gmFusedRow = ({key, label}) => {
    const val = getGM(key);
    const off = !!(draft.disabledGambits||{})[key];
    return e('div',{key, className:'cards-fused-row', style:{alignItems:'center'}},
      e('span',{className:'cards-center-lbl cards-card-lbl',
        style:{flex:1,textAlign:'left',paddingLeft:'4px',opacity:off?0.38:1,transition:'opacity 0.15s'}}, label),
      e('div',{className:'cards-col',style:{opacity:off?0.38:1,transition:'opacity 0.15s'}},
        e('button',{className:'set-stepper-btn',disabled:val<=0||off,
          onClick:()=>onChangeGambitMult(key, Math.max(0,val-1))},'◀'),
        e('span',{className:'set-stepper-val'},off?'—':val),
        e('button',{className:'set-stepper-btn',disabled:val>=20||off,
          onClick:()=>onChangeGambitMult(key, Math.min(20,val+1))},'▶'),
      ),
      e('button',{
        className:'set-gambit-btn '+(off?'off':'on'),
        style:{flexShrink:0,padding:'4px 8px',fontSize:'var(--font-xs)'},
        onClick:()=>onChangeGambitDisabled(key, !off)
      }, off?'OFF':'ON'),
    );
  };

  const gambitModsContent = () => {
    const groupTabs = Object.entries(GAMBIT_GROUPS).map(([k,g])=>({k, l:g.label}));
    const grp = GAMBIT_GROUPS[activeGambitGroup];
    const dg2 = draft.disabledGambits || {};
    const allOff = grp.entries.every(({key})=>!!dg2[key]);
    const masterToggleAll = () => grp.entries.forEach(({key})=>onChangeGambitDisabled(key,!allOff));
    return e('div',null,
      // Group tabs
      e('div',{className:'cards-suit-tabs',style:{flexWrap:'wrap',gap:'4px',marginBottom:'10px'}},
        groupTabs.map(({k,l})=>e('button',{
          key:k,
          className:'gb cards-suit-tab'+(activeGambitGroup===k?' sel':''),
          onClick:()=>setActiveGambitGroup(k),
          style:{flex:'1',minWidth:'52px'}
        },l))
      ),
      // Column headers
      e('div',{className:'cards-col-headers'},
        e('span',{style:{flex:1}},'Gambit'),
        e('span',{className:'cards-col-hdr-flex'},'Mult'),
        e('span',{style:{flexShrink:0,width:'44px',textAlign:'center'}},'On'),
      ),
      // Master row
      e('div',{className:'cards-master-row'},
        e('span',{className:'set-stepper-val cards-master-lbl',
          style:{flex:1,background:'none',border:'none',textAlign:'left',paddingLeft:'4px'}},grp.label+' — All'),
        e('div',{className:'cards-col'},
          e('button',{className:'set-stepper-btn',onClick:()=>masterGambitMult(activeGambitGroup,-1)},'◀'),
          e('span',{className:'set-stepper-val cards-qty-pts-lbl'},'×ALL'),
          e('button',{className:'set-stepper-btn',onClick:()=>masterGambitMult(activeGambitGroup,+1)},'▶'),
        ),
        e('button',{
          className:'set-gambit-btn '+(allOff?'off':'on'),
          style:{flexShrink:0,padding:'4px 8px',fontSize:'var(--font-xs)'},
          onClick:masterToggleAll
        }, allOff?'OFF':'ON'),
      ),
      // Per-gambit rows
      ...grp.entries.map(entry=>gmFusedRow(entry)),
    );
  };

  const sections=[
    {title:'Starting Conditions',content:()=>e('div',null,
      // ── Score goal ─────────────────────────────────────────────────
      e('div',{className:'set-row'},
        e('div',null,
          e('span',{className:'set-lbl'},'Score Goal'),
          e('div',{style:{fontFamily:"'Cinzel',serif",fontSize:'var(--font-xs)',color:'var(--secondary-color)',marginTop:'2px'}},
            draft.scoreToBeatEnabled?'Win when score is reached':'Play indefinitely'
          )
        ),
        e('button',{
          className:'inf-toggle-btn '+(draft.scoreToBeatEnabled?'on':'off'),
          onClick:()=>onChange('scoreToBeatEnabled',!draft.scoreToBeatEnabled)
        },draft.scoreToBeatEnabled?'✓ ON':'✕ OFF')
      ),
      draft.scoreToBeatEnabled&&bigStepper('Score to Beat','scoreToBeat',100,10000,100),
      // ── Infinite modes ─────────────────────────────────────────────
      e('div',{className:'set-inf-row'},
        stepper('Lives','startLives',1,10),
        e('div',{className:'set-inf-item'},
          e('div',{className:'set-inf-icon',style:{color:'var(--lose-color)'}},'♥'),
          e('div',{className:'set-inf-text'},
            e('span',{className:'set-lbl'},'Infinite Lives'),
            e('div',{className:'set-inf-sub'},draft.infiniteLives?'Can\'t die — play forever':'Normal life loss applies')
          ),
          e('button',{
            className:'inf-toggle-btn '+(draft.infiniteLives?'on':'off'),
            onClick:()=>onChange('infiniteLives',!draft.infiniteLives)
          },
            e('span',{className:'inf-toggle-icon'},draft.infiniteLives?'∞':'—'),
            e('span',null,draft.infiniteLives?'ON':'OFF')
          )
        ),
        stepper('Blanks','startBlanks',0,10),
        e('div',{className:'set-inf-item'},
          e('div',{className:'set-inf-icon',style:{color:'var(--secondary-color)'}},'🛡'),
          e('div',{className:'set-inf-text'},
            e('span',{className:'set-lbl'},'Infinite Blanks'),
            e('div',{className:'set-inf-sub'},draft.infiniteBlanks?'Blanks are never spent':'Normal blank deduction')
          ),
          e('button',{
            className:'inf-toggle-btn '+(draft.infiniteBlanks?'on':'off'),
            onClick:()=>onChange('infiniteBlanks',!draft.infiniteBlanks)
          },
            e('span',{className:'inf-toggle-icon'},draft.infiniteBlanks?'∞':'—'),
            e('span',null,draft.infiniteBlanks?'ON':'OFF')
          )
        )
      ),
      e('div',{style:{marginTop:'10px',paddingTop:'10px',borderTop:'1px solid rgba(255,204,77,0.15)'}},
      stepper('Streak','startStreak',0,20),
      ),
    )},
    {title:'Gambit Modifiers',content:gambitModsContent},
    {title:'Round Outcomes',content:()=>{
      const outcomeTabs=[
        {k:'win',  l:'✨ Win'},
        {k:'lose', l:'🩸 Loss'},
        {k:'skip', l:'🌑 Skip'},
        {k:'blank',l:'🛡️ Blank'},
        {k:'dice', l:'🎲 Dice'},
      ].filter(t=>
        t.k!=='skip'||draft.skipsEnabled||activeOutcomeTab==='skip'
        // always show dice tab; always show blank tab
      );

// Universal operation toggle with Division by 0 failsafe
  const universalOpToggle = (label, opKey, modKey, modMax = 20) => {
    const op = draft[opKey] ?? 'add';
    const mod = draft[modKey] ?? 0;
    
    // UI-level Division Failsafe: floor modifier at 1 if division is active
    const minMod = op === 'divide' ? 1 : 0;
    const displayMod = Math.max(minMod, mod);

    const handleOpChange = (newOp) => {
      onChange(opKey, newOp);
      if (newOp === 'divide' && mod === 0) onChange(modKey, 1);
    };

    return e('div', null,
      e('div', { className: 'set-row' },
        e('span', { className: 'set-lbl' }, label + ' Op.'),
        e('div', { style: { display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end', flex: 1, paddingLeft: '10px' } },
          e('button', { className: 'set-gambit-btn ' + (op === 'add' ? 'on' : 'off'), style: { padding: '3px 6px', fontSize: 'var(--font-xs)', flex: '1 1 40px' }, onClick: () => handleOpChange('add') }, '+ Add'),
          e('button', { className: 'set-gambit-btn ' + (op === 'subtract' ? 'on' : 'off'), style: { padding: '3px 6px', fontSize: 'var(--font-xs)', flex: '1 1 40px' }, onClick: () => handleOpChange('subtract') }, '− Sub'),
          e('button', { className: 'set-gambit-btn ' + (op === 'multiply' ? 'on' : 'off'), style: { padding: '3px 6px', fontSize: 'var(--font-xs)', flex: '1 1 40px' }, onClick: () => handleOpChange('multiply') }, '× Mult'),
          e('button', { className: 'set-gambit-btn ' + (op === 'divide' ? 'on' : 'off'), style: { padding: '3px 6px', fontSize: 'var(--font-xs)', flex: '1 1 40px' }, onClick: () => handleOpChange('divide') }, '÷ Div'),
        )
      ),
      e('div', { className: 'set-row' },
        e('span', { className: 'set-lbl' }, label + ' Modifier'),
        e('div', { className: 'set-stepper' },
          e('button', { className: 'set-stepper-btn', disabled: displayMod <= minMod, onClick: () => onChange(modKey, Math.max(minMod, displayMod - 1)) }, '◀'),
          e('span', { className: 'set-stepper-val' }, displayMod),
          e('button', { className: 'set-stepper-btn', disabled: displayMod >= modMax, onClick: () => onChange(modKey, Math.min(modMax, displayMod + 1)) }, '▶'),
        )
      )
    );
  };

const tabContent=()=>{
        if(activeOutcomeTab==='win') return e('div',null,
          universalOpToggle('Lives','winLifeOp','winLifeMod',20),
          e('div',{className:'set-action-toggles-sep'}),
          universalOpToggle('Streak','winStreakOp','winStreakMod',20)
        );
        if(activeOutcomeTab==='lose') return e('div',null,
          universalOpToggle('Lives','loseLifeOp','loseLifeMod',20),
          e('div',{className:'set-action-toggles-sep'}),
          universalOpToggle('Streak','loseStreakOp','loseStreakMod',20)
        );
        if(activeOutcomeTab==='skip') return e('div',null,
          e('div',{className:'set-action-toggles'},
            e('div',{className:'set-action-toggle-row'},
              e('span',{className:'set-lbl'},'Skip Action'),
              e('button',{className:'inf-toggle-btn '+(draft.skipsEnabled?'on':'off'),onClick:()=>onChange('skipsEnabled',!draft.skipsEnabled)},draft.skipsEnabled?'✓ ON':'✕ OFF')
            ),
          ),
          universalOpToggle('Lives','skipLifeOp','skipLifeMod',20),
          e('div',{className:'set-action-toggles-sep'}),
          universalOpToggle('Streak','skipStreakOp','skipStreakMod',20),
          e('div',{className:'set-action-toggles-sep'}),
          universalOpToggle('Score','skipScoreOp','skipScoreMod',20)
        );
        if(activeOutcomeTab==='blank') return e('div',null,
          e('div',{className:'set-action-toggles'},
            e('div',{className:'set-action-toggle-row'},
              e('span',{className:'set-lbl'},'Blank Action'),
              e('button',{className:'inf-toggle-btn '+(draft.blanksEnabled?'on':'off'),onClick:()=>onChange('blanksEnabled',!draft.blanksEnabled)},draft.blanksEnabled?'✓ ON':'✕ OFF')
            ),
          ),
          universalOpToggle('Lives','blankLifeOp','blankLifeMod',20),
          e('div',{className:'set-action-toggles-sep'}),
          universalOpToggle('Streak','blankStreakOp','blankStreakMod',20),
          e('div',{className:'set-action-toggles-sep'}),
          universalOpToggle('Score','blankScoreOp','blankScoreMod',20)
        );
        if(activeOutcomeTab==='dice') return e('div',null,
          e('div',{className:'set-action-toggles-sep'}),
          stepper('Roll Attempts (0 = disabled)','deathsDoorRolls',0,5),
          stepper('Dice Sides (d2–d8)','deathsDoorDiceSides',2,8),
        );
        return null;
      };

      return e('div',null,
        // Sub-tab buttons
        e('div',{className:'cards-suit-tabs',style:{marginBottom:'10px'}},
          outcomeTabs.map(({k,l})=>e('button',{
            key:k,
            className:'gb cards-suit-tab'+(activeOutcomeTab===k?' sel':''),
            onClick:()=>setActiveOutcomeTab(k),
            style:{flex:'1',minWidth:'48px',fontSize:'var(--font-xs)'}
          },l))
        ),
        tabContent()
      );
    }},
    {title:'Shop Costs (streak pts)',content:()=>e('div',null,
      stepper('Extra Life','costLife',0,20),
      stepper('Blank Card','costBlank',0,20),
    )},
    {title:'Cards · Counts & Values',content:cardsSectionContent}
  ];

  const sec=sections[secIdx];
  const numSecs=sections.length;

  return e('div',{className:'set-overlay'},
    e('div',{className:'set-panel'},
      e('div',{className:'set-title'},'Settings'),
      gameActive&&e('p',{className:'set-warn'},'⚠ Applying will reset the current game.'),

      e('div',{className:'set-nav'},
        e('button',{className:'set-nav-arrow',disabled:secIdx===0,onClick:()=>setSecIdx(i=>i-1)},'‹'),
        e('div',{className:'set-nav-info'},
          e('span',{className:'set-nav-title'},sec.title),
          e('div',{className:'set-nav-dots'},
            ...sections.map((_,i)=>e('div',{key:i,className:'set-nav-dot'+(i===secIdx?' active':'')}))
          )
        ),
        e('button',{className:'set-nav-arrow',disabled:secIdx===numSecs-1,onClick:()=>setSecIdx(i=>i+1)},'›'),
      ),

      e('div',{className:'set-section'},sec.content()),

      e('div',{className:'set-actions'},
        e('button',{className:'btn-start',onClick:onApply,disabled:deckInvalid},gameActive?'Apply & Reset':'Apply'),
        e('button',{className:'btnsec',onClick:onCancel},'Cancel'),
      )
    )
  );
}

function InfoPanel({gs, history, onClose}){
  const e=React.createElement;
  return e('div',{className:'info-overlay'},
    e('div',{className:'info-panel'},
      e('div',{className:'info-title'},'⛧ The Ledger ⛧'),
      e('div',{className:'info-sub'},'Deck & Round Records'),
      e(DeckInfo,{gs}),
      history&&history.length
        ? e(RoundHistory,{history})
        : e('div',{className:'info-empty'},'No rounds played yet'),
      e('div',{className:'info-close'},
        e('button',{className:'btnsec',style:{width:'100%'},onClick:onClose},'Close')
      )
    )
  );
}



function App(){
  const [screen,setScreen]=useState('start');
  const [gs,setGs]=useState(null);
  const [sel,setSel]=useState(EMPTY_SEL);
  const [revealed,setRevealed]=useState(false);
  const [result,setResult]=useState(null);
  const [shop,setShop]=useState(false);
  const [dealing,setDealing]=useState(false);
  const [tableFlash,setFlash]=useState(null);
  const [noFlipAnim,setNoFlipAnim]=useState(false);
  const [diceState,setDiceState]=useState({result: null, guess: null, rollsLeft: 0});
  const [lastChance, setLastChance] = useState(false);
  const [roundHistory,setRoundHistory]=useState([]);

  const e=React.createElement;

  const [settingsOpen,setSettingsOpen]=useState(false);
  const [infoOpen,setInfoOpen]=useState(false);
  const [draft,setDraft]=useState({...PRESET});

  const openSettings=()=>{
    // Deep-clone nested objects so edits in draft never bleed into PRESET
    setDraft({
      ...PRESET,
      deckOverrides:{...PRESET.deckOverrides},
      cardValues:{...PRESET.cardValues},
      disabledGambits:{...PRESET.disabledGambits},
      gambitMultipliers:{...PRESET.gambitMultipliers},
    });
    setSettingsOpen(true);
  };
  const cancelSettings=()=>setSettingsOpen(false);
  const applySettings=()=>{
    if(countDraftDeck(draft)<2)return;
    Object.assign(PRESET,draft);
    // Make sure the nested objects are replaced, not just referenced
    PRESET.deckOverrides={...draft.deckOverrides};
    PRESET.cardValues={...draft.cardValues};
    PRESET.disabledGambits={...draft.disabledGambits};
    PRESET.gambitMultipliers={...draft.gambitMultipliers};
    setSettingsOpen(false);
    startGame();
  };
  const changeDraft=(key,val)=>setDraft(d=>({...d,[key]:val}));
  // Update a single card's deck count (cardId = e.g. '2-hearts' or 'JOKER')
  const changeDeckCount=(cardId,val)=>setDraft(d=>({
    ...d,
    deckOverrides:{...d.deckOverrides,[cardId]:val}
  }));
  // Update a single card's point value (cardId = e.g. 'A-hearts' or 'JOKER')
  const changeCardValue=(cardId,val)=>setDraft(d=>({
    ...d,
    cardValues:{...d.cardValues,[cardId]:val}
  }));
  // Toggle a gambit on/off in the draft
  const changeGambitDisabled=(key,val)=>setDraft(d=>({
    ...d,
    disabledGambits:{...d.disabledGambits,[key]:val}
  }));
  // Update a single gambit's multiplier in the draft
  const changeGambitMult=(key,val)=>setDraft(d=>({
    ...d,
    gambitMultipliers:{...d.gambitMultipliers,[key]:val}
  }));

  const gsRef=useRef(gs);
  useEffect(()=>{gsRef.current=gs;},[gs]);

  const deal=()=>{setDealing(true);setTimeout(()=>setDealing(false),550);};
  const flash=(t)=>{setFlash(t);setTimeout(()=>setFlash(null),2000);};

const startGame=()=>{
  const initialDeck=shfl(mkDeck()); 
  const d=[...initialDeck];

  // Remove the table card from the deck
  const tableIndex = Math.floor(Math.random() * d.length);
  const tableCard = d.splice(tableIndex, 1)[0];

  // The hand card STAYS in the deck (peek only).
  // This keeps deck stats accurate — the hand card is still an unknown
  // card in the pool from the player's perspective.
  const handIndex = Math.floor(Math.random() * d.length);
  const handCard = d[handIndex];

  // Both finite and infinite: deck contains the hand card (unknown) but NOT
  // the table card (face-up and visible). For infinite mode, the old table
  // card is recycled into the pool at the start of drawNext instead.
  const remainingDeck = d;

  setGs({
    deck: remainingDeck,
    tableCard,
    handCard,
    lives:PRESET.startLives,
    startLives:PRESET.startLives,
    streak:PRESET.startStreak,
    blanks:PRESET.startBlanks,
    score:0,
    round:1,
    usedLastChance:false
  });
  setSel(EMPTY_SEL);setRevealed(false);setResult(null);setShop(false);setNoFlipAnim(false);
  setDiceState({result:null, guess:null, rollsLeft:0});
  setLastChance(false);
  setRoundHistory([]);
  deal();setScreen('game');
};

const drawNext=(g)=>{
  let d=[...g.deck];

  // The previous hand card was peeked but not removed; consume it now.
  const oldHandIdx=d.findIndex(c=>c.id===g.handCard.id);
  if(oldHandIdx!==-1) d.splice(oldHandIdx,1);

  // For infinite mode, recycle both the used table card and the consumed hand
  // card so the deck size stays constant (net zero each round).
  if(PRESET.infiniteDeck) d=[...d,g.tableCard,g.handCard];

  // Remove the new table card from the pool.
  const tableIndex=Math.floor(Math.random()*d.length);
  const tableCard=d.splice(tableIndex,1)[0];

  // Peek at the new hand card — it stays in the deck.
  const handIndex=Math.floor(Math.random()*d.length);
  const handCard=d[handIndex];

  // d now contains the new hand card but NOT the new table card.
  // This is correct for both modes: the table card is visible so it's
  // excluded from the pool. For infinite, pool size stays constant because
  // we recycled the old table card and removed the new one (net zero).
  return{
    ...g,
    deck:d,
    tableCard,
    handCard,
    round:g.round+1
  };
};

  const toggleSel=(type,val)=>{
    if(result)return;
    setSel(prev=>{
      const next={...prev};
      if(type==='joker'){
        if(next.joker){next.joker=false;}
        else{next.value=null;next.color=null;next.suit=null;next.joker=true;}
      } else if(type==='value'){
        next.joker=false;
        next.value=(next.value===val)?null:val;
      } else if(type==='color'){
        next.joker=false;
        next.suit=null;
        next.color=(next.color===val)?null:val;
      } else if(type==='suit'){
        next.joker=false;
        next.color=null;
        next.suit=(next.suit===val)?null:val;
      }
      return next;
    });
  };

  const commit=()=>{
    const dg=deriveGambit(sel);
    if(!dg||result)return;
    const snapStreak=gs.streak;
    const snapTableVal=gs.tableCard.numValue;
    const isInstant=dg.type==='joker';
    const won=checkGambit(dg.type,dg.pred,gs.handCard,gs.tableCard);
    const mult=dg.mult;
    setRevealed(true);
      const pts=won?(snapTableVal+snapStreak)*mult:0;
      setGs(g=>{
        const ng={...g};
        if(won){
          ng.score+=pts;
          ng.streak+=PRESET.winStreakGain;
          ng.lives+=PRESET.winLifeGain;
        } else if(isInstant){
          // Instant death joker: clear streak; only zero lives if not infinite
          if(!PRESET.infiniteLives) ng.lives=0;
          ng.streak=0;
        } else {
          if(!PRESET.infiniteLives) ng.lives=Math.max(0,ng.lives-PRESET.loseLifeLoss)+PRESET.loseLifeGain;
          ng.streak=Math.max(0,g.streak-PRESET.loseStreakLoss)+PRESET.loseStreakGain;
        }
        return ng;
      });
const calcLives = isInstant ? 0 : (won ? applyMathOp(gs.lives, PRESET.winLifeOp, PRESET.winLifeMod) : applyMathOp(gs.lives, PRESET.loseLifeOp, PRESET.loseLifeMod));
      const newLives = PRESET.infiniteLives ? gs.lives : calcLives;

      const calcStreak = isInstant ? 0 : (won ? applyMathOp(gs.streak, PRESET.winStreakOp, PRESET.winStreakMod) : applyMathOp(gs.streak, PRESET.loseStreakOp, PRESET.loseStreakMod));
      const newStreak = calcStreak;
      const newScore = gs.score + pts;

      setGs(g => ({ ...g, score: newScore, streak: newStreak, lives: newLives }));

      setRoundHistory(h=>[{
        type:'round',round:gs.round,
        tableCard:gs.tableCard,handCard:gs.handCard,
        gambit:dg.label,
        outcome:won?'win':isInstant?'instant':'lose',
        pts,score:newScore,
        lives:newLives,blanks:gs.blanks,streak:newStreak
      },...h]);
      setResult({won,pts,action:'gambit',instant:isInstant&&!won&&!PRESET.infiniteLives});
      flash(won?'win':'lose');
  };

  const doSkip=()=>{
    if(result)return;
    setRevealed(true);
const rawVal = gs.tableCard.numValue;
      const pts = applyMathOp(rawVal, PRESET.skipScoreOp, PRESET.skipScoreMod);
      const newLives = PRESET.infiniteLives ? gs.lives : applyMathOp(gs.lives, PRESET.skipLifeOp, PRESET.skipLifeMod);
      const newStreak = applyMathOp(gs.streak, PRESET.skipStreakOp, PRESET.skipStreakMod);
      
      setGs(g=>({...g,lives:newLives,streak:newStreak,score:g.score+pts}));
      setRoundHistory(h=>[{
        type:'round',round:gs.round,
        tableCard:gs.tableCard,handCard:gs.handCard,
        gambit:'— Skip —',
        outcome:'skip',
        pts,score:gs.score+pts,
        lives:newLives,blanks:gs.blanks,streak:newStreak
      },...h]);
      setResult({won:false,pts,action:'skip'});
      flash('lose');
  };

  const doBlank=()=>{
    if(!gs||((!PRESET.infiniteBlanks)&&!gs.blanks)||result)return;
    setRevealed(true);
  const rawVal = gs.tableCard.numValue;
      const pts = applyMathOp(rawVal, PRESET.blankScoreOp, PRESET.blankScoreMod);
      const newLives = PRESET.infiniteLives ? gs.lives : applyMathOp(gs.lives, PRESET.blankLifeOp, PRESET.blankLifeMod);
      const newStreak = applyMathOp(gs.streak, PRESET.blankStreakOp, PRESET.blankStreakMod);
      const newBlanks = PRESET.infiniteBlanks ? gs.blanks : gs.blanks - 1;

      setGs(g=>({...g,blanks:newBlanks,score:g.score+pts,lives:newLives,streak:newStreak}));
      setRoundHistory(h=>[{
        type:'round',round:gs.round,
        tableCard:gs.tableCard,handCard:gs.handCard,
        gambit:'🛡️ Blank',
        outcome:'blank',
        pts,score:gs.score+pts,
        lives:newLives,blanks:newBlanks,streak:newStreak
      },...h]);
      setResult({won:true,pts,action:'blank'});
      flash('win');
  };

  const continueGame=useCallback(()=>{
    const currentGs=gsRef.current;
    if(!currentGs)return;
    // Check win condition first (score goal reached)
    if(PRESET.scoreToBeatEnabled&&currentGs.score>=PRESET.scoreToBeat){
      setScreen('win');
      return;
    }
    if(!PRESET.infiniteLives&&currentGs.lives<=0){
      if(!currentGs.usedLastChance&&PRESET.deathsDoorRolls>0){
        setResult(null);       // Clear the result screen
        setDiceState({result:null,guess:null,rollsLeft:PRESET.deathsDoorRolls});
        setLastChance(true);   // Trigger inline dice panel
        return;
      }
      setScreen('gameover');
      return;
    }
    // Deck has hand card inside it; need >=3 cards to draw a new round
    // (remove old hand card, pick new table card, leave 1 for new hand card).
    // Infinite mode replenishes cards every round, so this check never applies.
    if(!PRESET.infiniteDeck&&currentGs.deck.length<3){
      setScreen('deckempty');
      return;
    }
    setNoFlipAnim(true);
    setRevealed(false);
    setTimeout(()=>{
      const ng=drawNext(currentGs);
      setGs(ng);
      setSel(EMPTY_SEL);setResult(null);setShop(false);
      setNoFlipAnim(false);
      deal();
    },32);
  },[]);

  // Automatically continue after 3 seconds
  useEffect(()=>{
    if(result){
      const timer=setTimeout(()=>{
        continueGame();
      }, 2000);
      return ()=>clearTimeout(timer);
    }
  },[result,continueGame]);

  const rollDice=(guess)=>{
    const sides = PRESET.deathsDoorDiceSides || 4;
    const r = Math.floor(Math.random() * sides) + 1;
    setDiceState(prev=>({...prev, result: r, guess}));
    setTimeout(()=>{
      if(r===guess){
        // Correct guess — cheat death
        setGs(g=>({...g, lives: 1, usedLastChance: true}));
        setDiceState({result: null, guess: null, rollsLeft: 0});
        setLastChance(false);
        setNoFlipAnim(true);
        setRevealed(false);
        setTimeout(()=>{
          if(!PRESET.infiniteDeck&&gsRef.current.deck.length<3){setScreen('deckempty');return;}
          const ng=drawNext(gsRef.current);
          setGs(ng);
          setSel(EMPTY_SEL);setResult(null);setShop(false);
          setNoFlipAnim(false);
          deal();
        },32);
      } else {
        // Wrong guess — consume one attempt
        setDiceState(prev=>{
          const newLeft = (prev.rollsLeft ?? 1) - 1;
          if(newLeft <= 0){
            // Out of attempts — game over
            setGs(g=>({...g, usedLastChance: true}));
            setScreen('gameover');
            return {result: null, guess: null, rollsLeft: 0};
          }
          // More attempts remaining — reset for next roll
          return {result: null, guess: null, rollsLeft: newLeft};
        });
      }
    }, 2800);
  };

  const buyLife=()=>{
    if(gs.streak>=PRESET.costLife){
      const newStreak=gs.streak-PRESET.costLife;
      const newLives=gs.lives+1;
      setGs(g=>({...g,streak:newStreak,lives:newLives}));
      setRoundHistory(h=>[{
        type:'shop',round:gs.round,
        item:'♥ Extra Life',cost:PRESET.costLife,
        score:gs.score,lives:newLives,blanks:gs.blanks,streak:newStreak
      },...h]);
    }
  };
  const buyBlank=()=>{
    if(gs.streak>=PRESET.costBlank){
      const newStreak=gs.streak-PRESET.costBlank;
      const newBlanks=gs.blanks+1;
      setGs(g=>({...g,streak:newStreak,blanks:newBlanks}));
      setRoundHistory(h=>[{
        type:'shop',round:gs.round,
        item:'🛡️ Blank Card',cost:PRESET.costBlank,
        score:gs.score,lives:gs.lives,blanks:newBlanks,streak:newStreak
      },...h]);
    }
  };

  if(screen==='start')return e('div',{className:'app'},
    settingsOpen&&e(SettingsPanel,{draft,onChange:changeDraft,onChangeDeckCount:changeDeckCount,onChangeCardValue:changeCardValue,onChangeGambitDisabled:changeGambitDisabled,onChangeGambitMult:changeGambitMult,onApply:applySettings,onCancel:cancelSettings,gameActive:false}),
    e('div',{className:'start'},
    e('div',{className:'sigil'},'⛧'),
    e('h1',{className:'start-title'},'Devil\'s',e('br'),'Gambit'),
    // e('p',{className:'start-sub'},'A Card Game of Risk & Ruin'),
    e('div',{className:'sep'}),
    // e('p',{className:'start-flavor'},
    //   'The Devil lays two cards before you.',e('br'),
    //   'Guess the hidden one wisely, and claim your reward.',e('br'),
    //   'Guess wrong — pay with your soul.'
    // ),
    e('button',{className:'btn-start',onClick:startGame},'Play Game'),
    e('button',{className:'btn-options',onClick:openSettings},'⚙ Options')
  ));

  if(screen==='win')return e('div',{className:'app'},
    settingsOpen&&e(SettingsPanel,{draft,onChange:changeDraft,onChangeDeckCount:changeDeckCount,onChangeCardValue:changeCardValue,onChangeGambitDisabled:changeGambitDisabled,onChangeGambitMult:changeGambitMult,onApply:applySettings,onCancel:cancelSettings,gameActive:false}),
    e('div',{className:'gameover'},
    e('div',{className:'victory-sigil'},'★'),
    e('h2',{className:'gottl-victory'},'The Devil Yields'),
    e('p',{className:'gosub-victory'},'Your soul remains your own'),
    e('div',{className:'gobox'},
      e('div',{className:'golbl'},'Score Reached'),
      e('div',{className:'goscore'},(gs?.score||0).toLocaleString()),
      e('div',{className:'godet'},'Survived '+(gs?.round||1)+' rounds · Goal of '+(PRESET.scoreToBeat||0).toLocaleString()+' reached')
    ),
    e('button',{className:'btn-start',onClick:startGame},'Play Again'),
    e('button',{className:'btn-options',onClick:openSettings},'⚙ Options')
  ));

  if(screen==='gameover')return e('div',{className:'app'},
    settingsOpen&&e(SettingsPanel,{draft,onChange:changeDraft,onChangeDeckCount:changeDeckCount,onChangeCardValue:changeCardValue,onChangeGambitDisabled:changeGambitDisabled,onChangeGambitMult:changeGambitMult,onApply:applySettings,onCancel:cancelSettings,gameActive:false}),
    e('div',{className:'gameover'},
    e('div',{className:'goskull'},'💀'),
    e('h2',{className:'gottl'},'Your Soul is Forfeit'),
    e('p',{className:'gosub'},'The Devil Wins Again'),
    e('div',{className:'gobox'},
      e('div',{className:'golbl'},'Final Score'),
      e('div',{className:'goscore'},(gs?.score||0).toLocaleString()),
      e('div',{className:'godet'},'Survived '+(gs?.round||1)+' rounds')
    ),
    e('button',{className:'btn-start',onClick:startGame},'Play Again'),
    e('button',{className:'btn-options',onClick:openSettings},'⚙ Options')
  ));

  if(screen==='deckempty')return e('div',{className:'app'},
    settingsOpen&&e(SettingsPanel,{draft,onChange:changeDraft,onChangeDeckCount:changeDeckCount,onChangeCardValue:changeCardValue,onChangeGambitDisabled:changeGambitDisabled,onChangeGambitMult:changeGambitMult,onApply:applySettings,onCancel:cancelSettings,gameActive:false}),
    e('div',{className:'gameover'},
    e('div',{className:'deckend-sigil'},'🂠'),
    e('h2',{className:'gottl-gold'},'The Deck Runs Dry'),
    e('p',{className:'gosub-gold'},'The Devil\'s hand is spent'),
    e('div',{className:'gobox'},
      e('div',{className:'golbl'},'Final Score'),
      e('div',{className:'goscore'},(gs?.score||0).toLocaleString()),
      e('div',{className:'godet'},'Survived '+(gs?.round||1)+' rounds · Soul still intact')
    ),
    e('button',{className:'btn-start',onClick:startGame},'Play Again'),
    e('button',{className:'btn-options',onClick:openSettings},'⚙ Options')
  ));

  const derived=deriveGambit(sel);
  const canCommit=!!derived&&!result&&!isGambitDisabled(derived);
  const deckExhausted=!PRESET.infiniteDeck&&gs.deck.length<3;

  const tc=gs.tableCard,hc=gs.handCard;
  const isHighTC=HIGH.has(tc.value);
  const isLowTC=['2','3','4','5','6','7'].includes(tc.value);
  const tcCat=tc.value==='JOKER'?'Joker':tc.value==='A'?'Ace':isHighTC?'High':isLowTC?'Low':'—';

  return e('div',{className:'app'},
    settingsOpen&&e(SettingsPanel,{draft,onChange:changeDraft,onChangeDeckCount:changeDeckCount,onChangeCardValue:changeCardValue,onChangeGambitDisabled:changeGambitDisabled,onChangeGambitMult:changeGambitMult,onApply:applySettings,onCancel:cancelSettings,gameActive:true}),
    infoOpen&&e(InfoPanel,{gs,history:roundHistory,onClose:()=>setInfoOpen(false)}),
    e('div',{className:'game-wrap'},
    e('div',{className:'hdr'},
      e('span',{className:'hdr-round',onClick:()=>setInfoOpen(true),title:'View Deck & History'},'Round '+gs.round),
      e('span',{className:'hdr-brand'},
        e('button',{
          className:'hdr-gear',
          onClick:openSettings,
          title:'Options'
        },'Devil\'s Gambit ⚙'),
      ),
      e('span',{className:'hdr-score'},
        'Score: ',
        e('b',null,gs.score.toLocaleString()),
        PRESET.scoreToBeatEnabled&&e('span',{className:'hdr-score-goal'},' / '+PRESET.scoreToBeat.toLocaleString())
      )
    ),
    e('div',{className:'stats'},
      e('div',{className:'stat'},
        e('span',{className:'stat-lbl'},'Lives'),
        PRESET.infiniteLives
          ? e('div',{className:'hearts'},e('span',{className:'heart inf'},'∞'))
          : e('div',{className:'hearts'},
              Array.from({length:Math.max(gs.lives,gs.startLives)},(_,i)=>
                e('span',{key:i,className:'heart '+(i<gs.lives?'on':'off')},'♥')
              )
            )
      ),
      e('div',{className:'stat'},
        e('span',{className:'stat-lbl'},'Blanks'),
        PRESET.infiniteBlanks
          ? e('span',{className:'stat-val stat-inf'},'∞')
          : e('span',{className:'stat-val'},+gs.blanks)
      ),
      e('div',{className:'stat'},e('span',{className:'stat-lbl'},'Streak'),e('span',{className:'stat-val'},+gs.streak)),
    ),
    e('div',{className:'table'+(tableFlash?' f'+tableFlash:'')},
      e('div',{className:'cslot'},
        e(CardFace,{card:tc,animate:dealing}),
        e('span',{className:'cpts'},tc.numValue+' pts · '+tcCat)
      ),
      e('div',{className:'cslot'},
        e(HandCard,{card:hc,revealed,animate:dealing,noAnim:noFlipAnim}),
        e('span',{className:'cpts'},revealed?(hc.numValue+' pts'):'?')
      )
    ),

    e('div',{className:'content-area'},
      e('div',null,
        e('div',{className:'actions',style:{gridTemplateColumns:'repeat('+(2+(PRESET.blanksEnabled?1:0)+(PRESET.skipsEnabled?1:0))+',minmax(0,1fr))'}},
          e('button',{className:'btnmain',onClick:commit,disabled:!canCommit || shop || !!result || lastChance},'Set'),
          PRESET.blanksEnabled&&e('button',{className:'btnsec',onClick:doBlank,disabled:(!PRESET.infiniteBlanks&&!gs.blanks) || shop || !!result || lastChance},'Blank'),
          PRESET.skipsEnabled&&e('button',{className:'btnsec',onClick:doSkip, disabled:shop || !!result || lastChance},'Skip'),
          e('button',{className:'btnsec',onClick:()=>setShop(s=>!s),disabled:!!result || lastChance},shop?'Close Shop':'Shop')
        ),
        (result || lastChance || !shop) && e(GambitPanel,{sel,onToggle:toggleSel,derived,gs,disabled:!!result||lastChance,result,lastChance,diceState,onRoll:rollDice}),
        shop && !result && !lastChance && e(Shop,{gs,buyLife,buyBlank})
      )
    )
  ));
}

const root=ReactDOM.createRoot(document.getElementById('root'));
root.render(React.createElement(App));
