const LOW_MOTION = false;
if (LOW_MOTION) document.documentElement.classList.add('low-motion');

const SUITS=['hearts','diamonds','clubs','spades'];
const VALUES=['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
const SYM={hearts:'♥',diamonds:'♦',clubs:'♣',spades:'♠'};
const HIGH=new Set(['8','9','10','J','Q','K']);

const PRESET = {
  startLives:       3,
  startBlanks:      1,
  startStreak:      0,

  multValue:        1,
  multColor:        1,
  multSuit:         3,
  multValueColor:   3,
  multValueSuit:    6,
  multJoker:       10,

  winStreakGain:    1,
  loseLifeLoss:     1,
  loseStreakLoss:   1,
  skipLifeLoss:     1,
  skipStreakGain:   1,

  costLife:         2,
  costBlank:        4,

  defaultCount: 1,
  deckOverrides: { 'JOKER': 2 },
  cardValues: { 'JOKER': 20 }
};

// Populate deck defaults and values dynamically
for (const v of VALUES) {
  const defaultVal = (v === 'A') ? 20 : (['J','Q','K'].includes(v) ? 10 : parseInt(v));
  for (const s of SUITS) {
    PRESET.deckOverrides[`${v}-${s}`] = 1;
    PRESET.cardValues[`${v}-${s}`] = defaultVal;
  }
}


const {useState,useEffect,useCallback,useRef}=React;
const EMPTY_SEL = { value: null, color: null, suit: null, joker: false };

function numVal(v, suit) {
  let result;
  const cardKey = suit ? `${v}-${suit}` : null;

  if (cardKey && PRESET.cardValues && PRESET.cardValues[cardKey] !== undefined) {
    result = PRESET.cardValues[cardKey];
  }
  else if (PRESET.cardValues && PRESET.cardValues[v] !== undefined) {
    result = PRESET.cardValues[v];
  }
  else if (v === 'JOKER' || v === 'A') {
    result = 20;
  } else if (['J', 'Q', 'K'].includes(v)) {
    result = 10;
  } else {
    result = parseInt(v);
  }

  return Math.max(0, Math.min(20, result));
}

function mkDeck() {
  const d = [];
  const clamp = (num) => Math.max(0, Math.min(20, num));

  for (const s of SUITS) {
    for (const v of VALUES) {
      const cardId = `${v}-${s}`;
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

  const rawJokerCount = PRESET.deckOverrides['JOKER'] !== undefined 
                        ? PRESET.deckOverrides['JOKER'] 
                        : 2;
  const jokerCount = clamp(rawJokerCount);

  for (let i = 0; i < jokerCount; i++) {
    d.push({
      suit: 'joker',
      value: 'JOKER',
      numValue: numVal('JOKER', null),
      id: `joker-${i}`
    });
  }

  return d;
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
  if(type==='joker')return false;
  if(hand.value==='JOKER')return true;
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
  if(j)return{type:'joker',pred:{},mult:PRESET.multJoker,label:'Joker Gambit',desc:'⛧ All or Nothing'};
  if(!v&&!c&&!s)return null;
  if(v&&s&&!c)return{type:'valueSuit',pred:{value:v,suit:s},mult:PRESET.multValueSuit, label:'Value & Suit',desc:cap(v)+' + '+SYM[s]+' '+cap(s)};
  if(v&&c&&!s)return{type:'valueColor',pred:{value:v,color:c},mult:PRESET.multValueColor, label:'Value & Color',desc:cap(v)+' + '+cap(c)};
  if(v&&!c&&!s)return{type:'value',pred:{value:v},mult:PRESET.multValue, label:'Value Gambit',desc:cap(v)};
  if(c&&!v&&!s)return{type:'color',pred:{color:c},mult:PRESET.multColor, label:'Color Gambit',desc:colorLabel(c)};
  if(s&&!v&&!c)return{type:'suit',pred:{suit:s},mult:PRESET.multSuit, label:'Suit Gambit',desc:SYM[s]+' '+cap(s)};
  return null;
}

function cap(str){return str?str[0].toUpperCase()+str.slice(1):'';}
function colorLabel(c){return c==='red'?'♥♦ Red':'♠♣ Black';}

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
  const total=gs.deck.length+2;
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
  return e('div',{className:'rhist'},
    e('div',{className:'rhist-hdr',onClick:()=>setOpen(o=>!o)},
      e('span',{className:'rhist-title'},'⛧ Round History'),
      e('span',{className:'rhist-count'},history.length+' entries'),
      e('span',{className:'rhist-toggle'},open?'▲':'▼')
    ),
    open&&e('div',{className:'rhist-cols'},
      e('span',null,'Rnd'),e('span',null,'Table → Hand'),e('span',null,'Gambit'),
      e('span',null,'Result'),e('span',null,'Score'),e('span',null,'♥ 🛡 ~')
    ),
    open&&e('div',{className:'rhist-body'},
      history.map((entry,i)=>{
        if(entry.type==='shop'){
          return e('div',{key:i,className:'rhist-row rhist-shop'},
            e('span',{className:'rh-round'},'R'+entry.round),
            e('span',{className:'rh-shop-item',style:{gridColumn:'2/4'}},entry.item),
            e('span',{className:'rh-shop-cost'},'−'+entry.cost+' stk'),
            e('span',{className:'rh-score'},entry.score.toLocaleString()),
            e('span',{className:'rh-stats'},'♥'+entry.lives+' 🛡'+entry.blanks+' ~'+entry.streak)
          );
        }
        const outIcon=entry.outcome==='win'?'✨':entry.outcome==='blank'?'🛡️':entry.outcome==='skip'?'🌑':entry.outcome==='instant'?'💀':'🩸';
        const outCls=(entry.outcome==='win'||entry.outcome==='blank')?'rh-win':entry.outcome==='skip'?'rh-ntrl':'rh-lose';
        const ptsTxt=entry.pts>0?'+'+entry.pts:'';
        return e('div',{key:i,className:'rhist-row'},
          e('span',{className:'rh-round'},'R'+entry.round),
          e('div',{className:'rh-cards'},
            e('span',{className:'rh-card'+cardColorClass(entry.tableCard)},cardLabel(entry.tableCard)),
            e('span',{className:'rh-vs'},'→'),
            e('span',{className:'rh-card'+cardColorClass(entry.handCard)},cardLabel(entry.handCard))
          ),
          e('span',{className:'rh-gambit'},entry.gambit),
          e('span',{className:'rh-outcome '+outCls},outIcon+' '+ptsTxt),
          e('span',{className:'rh-score'},entry.score.toLocaleString()),
          e('span',{className:'rh-stats'},'♥'+entry.lives+' 🛡'+entry.blanks+' ~'+entry.streak)
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

  const isJoker=derived&&derived.type==='joker';
  const isResultWin=result&&(result.won||result.action==='blank');
  const isResultNtrl=result&&result.action==='skip';
  const displayCls='gambit-display'+(
    lastChance?' last-chance':
    result?(isResultWin?' result-win':isResultNtrl?' result-ntrl':' result-lose'):
    (derived?(isJoker?' active-joker':' active'):'')
  );

  return e('div',{className:'gambit-panel'},
    e('div',{className:displayCls},
      lastChance?e('div',{className:'gd-dice'},
        e('div',{className:'gd-dice-inner'},
          e('div',{className:'gd-restitle dice'},'🎲 Death\'s Door 🎲'),
          e('div',{className:'gd-dice-sub'},'Guess the D4 to cheat death'),
          diceState&&diceState.result?
            e('div',{className:'gd-dice-result'},
              diceState.result===diceState.guess
                ?e('div',{className:'gd-restitle win'},diceState.result)
                :e('div',{className:'gd-restitle lose'},diceState.result)
            ):
            e('div',{className:'gd-dice-row'},
              [1,2,3,4].map(num=>e('button',{key:num,className:'gd-dice-btn',onClick:()=>onRoll(num)},num))
            )
        )
      ):result?e('div',{className:'gd-result'},
        result.action==='gambit'&&result.won&&e('div',{className:'gd-res-inner'},
          e('span',{className:'gd-resicon'},'✨'),
          e('div',{className:'gd-restitle win'},'Victory'),
          e('div',{className:'gd-respts'},'+',e('b',null,result.pts),' pts · +'+PRESET.winStreakGain+' streak')
        ),
        result.action==='gambit'&&!result.won&&!result.instant&&e('div',{className:'gd-res-inner'},
          e('span',{className:'gd-resicon'},'🩸'),
          e('div',{className:'gd-restitle lose'},'Defeat'),
          e('div',{className:'gd-respts'},'−'+PRESET.loseLifeLoss+' life · −'+PRESET.loseStreakLoss+' streak')
        ),
        result.action==='gambit'&&result.instant&&e('div',{className:'gd-res-inner'},
          e('span',{className:'gd-resicon'},'💀'),
          e('div',{className:'gd-restitle lose'},'The Devil Collects'),
          e('div',{className:'gd-respts'},'All lives forfeit')
        ),
        result.action==='skip'&&e('div',{className:'gd-res-inner'},
          e('span',{className:'gd-resicon'},'🌑'),
          e('div',{className:'gd-restitle ntrl'},'Round Skipped'),
          e('div',{className:'gd-respts'},'−'+PRESET.skipLifeLoss+' life · +'+PRESET.skipStreakGain+' streak')
        ),
        result.action==='blank'&&e('div',{className:'gd-res-inner'},
          e('span',{className:'gd-resicon'},'🛡️'),
          e('div',{className:'gd-restitle win'},'Blank Invoked'),
          e('div',{className:'gd-respts'},'+',e('b',null,result.pts),' pts · no life lost')
        )
      ):derived?e('div',{className:'gd-inner'+(isJoker?' gd-joker':''),style:{width:'100%',textAlign:'center'}},
        e('div',{className:'gd-name'},derived.label),
        e('div',{className:'gd-desc'},derived.desc),
        e('div',{className:'gd-mult'},'Multiplier: ',e('b',null,'×'+derived.mult)),
        derived&&gs&&e('div',{className:'potential'},
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

function Shop({gs,buyLife,buyBlank}){
  const e=React.createElement;
  return e('div',{className:'respan'},
    e('div',{className:'shopitems'},
      e('div',{className:'shopitem'},
        e('div',{className:'shopil'},
          e('span',{className:'shopname'},'Extra Life'),
          e('span',{className:'shopcost'},'Cost: '+PRESET.costLife+' streak points')
        ),
        e('button',{className:'btngold',onClick:buyLife,disabled:gs.streak<PRESET.costLife},'Buy')
      ),
      e('div',{className:'shopitem'},
        e('div',{className:'shopil'},
          e('span',{className:'shopname'},'Blank'),
          e('span',{className:'shopcost'},'Cost: '+PRESET.costBlank+' streak points')
        ),
        e('button',{className:'btngold',onClick:buyBlank,disabled:gs.streak<PRESET.costBlank},'Buy')
      )
    )
  );
}

function SettingsPanel({draft, onChange, onChangeDeckCount, onChangeCardValue, onApply, onCancel, gameActive}){
  const e=React.createElement;
  const [secIdx,setSecIdx]=useState(0);

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

  const deckStepper=(key, min=0, max=8)=>{
    const val=draft.deckOverrides[key]??0;
    return e('div',{className:'set-stepper'},
      e('button',{className:'set-stepper-btn',disabled:val<=min,onClick:()=>onChangeDeckCount(key,Math.max(min,val-1))},'◀'),
      e('span',{className:'set-stepper-val'},val),
      e('button',{className:'set-stepper-btn',disabled:val>=max,onClick:()=>onChangeDeckCount(key,Math.min(max,val+1))},'▶'),
    );
  };

  const valStepper=(key, min=0, max=20)=>{
    const val=draft.cardValues[key]??0;
    return e('div',{className:'set-stepper'},
      e('button',{className:'set-stepper-btn',disabled:val<=min,onClick:()=>onChangeCardValue(key,Math.max(min,val-1))},'◀'),
      e('span',{className:'set-stepper-val'},val),
      e('button',{className:'set-stepper-btn',disabled:val>=max,onClick:()=>onChangeCardValue(key,Math.min(max,val+1))},'▶'),
    );
  };

  const sections=[
    {title:'Starting Conditions',content:()=>e('div',null,
      stepper('Lives','startLives',1,10),
      stepper('Blanks','startBlanks',0,10),
      stepper('Streak','startStreak',0,20),
    )},
    {title:'Multipliers',content:()=>e('div',null,
      stepper('Value (High / Low)','multValue',1,20),
      stepper('Color (Red / Black)','multColor',1,20),
      stepper('Suit','multSuit',1,20),
      stepper('Value + Color','multValueColor',1,20),
      stepper('Value + Suit','multValueSuit',1,20),
      stepper('Joker Gambit','multJoker',1,20),
    )},
    {title:'Round Outcomes',content:()=>e('div',null,
      stepper('Win — streak gain','winStreakGain',0,10),
      stepper('Loss — lives lost','loseLifeLoss',0,5),
      stepper('Loss — streak lost','loseStreakLoss',0,10),
      stepper('Skip — lives lost','skipLifeLoss',0,5),
      stepper('Skip — streak gain','skipStreakGain',0,10),
    )},
    {title:'Shop Costs (streak pts)',content:()=>e('div',null,
      stepper('Extra Life','costLife',0,20),
      stepper('Blank Card','costBlank',0,20),
    )},
    {title:'Deck · Card Counts',content:()=>e('div',null,
      ...VALUES.map(v => e('div', {key: v, className: 'set-rank-section'},
        e('div', {className: 'set-rank-hdr'}, v + 's'),
        e('div', {className: 'set-card-grid'},
          ...SUITS.map(s => e('div', {key: s, className: 'set-card-cell'},
            e('span', {className: 'set-card-suit' + (['hearts','diamonds'].includes(s)?' set-card-red':'')}, SYM[s]),
            deckStepper(`${v}-${s}`, 0, 10)
          ))
        )
      )),
      e('div', {className: 'set-rank-section'},
        e('div', {className: 'set-rank-hdr'}, 'Joker'),
        e('div', {className: 'set-card-grid set-joker-row'},
          e('div', {className: 'set-card-cell set-joker-cell'},
            e('span', {className: 'set-card-suit'}, '★'),
            deckStepper('JOKER', 0, 10)
          )
        )
      )
    )},
    {title:'Card Point Values',content:()=>e('div',null,
      ...VALUES.map(v => e('div', {key: v, className: 'set-rank-section'},
        e('div', {className: 'set-rank-hdr'}, v + 's Point Values'),
        e('div', {className: 'set-card-grid'},
          ...SUITS.map(s => e('div', {key: s, className: 'set-card-cell'},
            e('span', {className: 'set-card-suit' + (['hearts','diamonds'].includes(s)?' set-card-red':'')}, SYM[s]),
            valStepper(`${v}-${s}`, 0, 20)
          ))
        )
      )),
      e('div', {className: 'set-rank-section'},
        e('div', {className: 'set-rank-hdr'}, 'Joker Point Value'),
        e('div', {className: 'set-card-grid set-joker-row'},
          e('div', {className: 'set-card-cell set-joker-cell'},
            e('span', {className: 'set-card-suit'}, '★'),
            valStepper('JOKER', 0, 20)
          )
        )
      )
    )},
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
        e('button',{className:'btn-start',onClick:onApply},gameActive?'Apply & Reset':'Apply'),
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
  const [diceState,setDiceState]=useState({result: null, guess: null});
  const [lastChance, setLastChance] = useState(false);
  const [roundHistory,setRoundHistory]=useState([]);

  const e=React.createElement;

  const [settingsOpen,setSettingsOpen]=useState(false);
  const [infoOpen,setInfoOpen]=useState(false);
  const [draft,setDraft]=useState(JSON.parse(JSON.stringify(PRESET)));

  const openSettings=()=>{setDraft(JSON.parse(JSON.stringify(PRESET)));setSettingsOpen(true);};
  const cancelSettings=()=>setSettingsOpen(false);
  const applySettings=()=>{
    Object.assign(PRESET,draft);
    setSettingsOpen(false);
    startGame();
  };
  const changeDraft=(key,val)=>setDraft(d=>({...d,[key]:val}));
  const changeDeckCount = (key, val) => setDraft(d => ({ ...d, deckOverrides: { ...d.deckOverrides, [key]: val } }));
  const changeCardValue = (key, val) => setDraft(d => ({ ...d, cardValues: { ...d.cardValues, [key]: val } }));


  const gsRef=useRef(gs);
  useEffect(()=>{gsRef.current=gs;},[gs]);

  const deal=()=>{setDealing(true);setTimeout(()=>setDealing(false),550);};
  const flash=(t)=>{setFlash(t);setTimeout(()=>setFlash(null),2000);};

  const startGame=()=>{
    const deck=shfl(mkDeck());
    const tableCard=deck[deck.length-1];
    const handCard=deck[deck.length-2];
    setGs({deck:deck.slice(0,-2),tableCard,handCard,lives:PRESET.startLives,startLives:PRESET.startLives,streak:PRESET.startStreak,blanks:PRESET.startBlanks,score:0,round:1,usedLastChance:false});
    setSel(EMPTY_SEL);setRevealed(false);setResult(null);setShop(false);setNoFlipAnim(false);
    setDiceState({result:null, guess:null});
    setLastChance(false);
    setRoundHistory([]);
    deal();setScreen('game');
  };

  const drawNext=(g)=>{
    const d=[...g.deck];
    const tableCard=d[d.length-1];
    const handCard=d[d.length-2];
    return{...g,deck:d.slice(0,-2),tableCard,handCard,round:g.round+1};
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
          ng.score+=pts;ng.streak+=PRESET.winStreakGain;
        } else if(isInstant){
          ng.lives=0;ng.streak=0;
        } else {
          ng.lives-=PRESET.loseLifeLoss;ng.streak=Math.max(0,g.streak-PRESET.loseStreakLoss);
        }
        return ng;
      });
      const newLives=isInstant?0:won?gs.lives:gs.lives-PRESET.loseLifeLoss;
      const newStreak=isInstant?0:won?gs.streak+PRESET.winStreakGain:Math.max(0,gs.streak-PRESET.loseStreakLoss);
      const newScore=gs.score+pts;
      setRoundHistory(h=>[{
        type:'round',round:gs.round,
        tableCard:gs.tableCard,handCard:gs.handCard,
        gambit:dg.label,
        outcome:won?'win':isInstant?'instant':'lose',
        pts,score:newScore,
        lives:newLives,blanks:gs.blanks,streak:newStreak
      },...h]);
      setResult({won,pts,action:'gambit',instant:isInstant});
      flash(won?'win':'lose');
  };

  const doSkip=()=>{
    if(result)return;
    setRevealed(true);
      setGs(g=>({...g,lives:g.lives-PRESET.skipLifeLoss,streak:g.streak+PRESET.skipStreakGain}));
      const newLives=gs.lives-PRESET.skipLifeLoss;
      const newStreak=gs.streak+PRESET.skipStreakGain;
      setRoundHistory(h=>[{
        type:'round',round:gs.round,
        tableCard:gs.tableCard,handCard:gs.handCard,
        gambit:'— Skip —',
        outcome:'skip',
        pts:0,score:gs.score,
        lives:newLives,blanks:gs.blanks,streak:newStreak
      },...h]);
      setResult({won:false,pts:0,action:'skip'});
      flash('lose');
  };

  const doBlank=()=>{
    if(!gs||!gs.blanks||result)return;
    setRevealed(true);
      const pts=gs.tableCard.numValue;
      setGs(g=>({...g,blanks:g.blanks-1,score:g.score+pts}));
      setRoundHistory(h=>[{
        type:'round',round:gs.round,
        tableCard:gs.tableCard,handCard:gs.handCard,
        gambit:'🛡️ Blank',
        outcome:'blank',
        pts,score:gs.score+pts,
        lives:gs.lives,blanks:gs.blanks-1,streak:gs.streak
      },...h]);
      setResult({won:true,pts,action:'blank'});
      flash('win');
  };

  const continueGame=useCallback(()=>{
    const currentGs=gsRef.current;
    if(!currentGs)return;
    if(currentGs.lives<=0){
      if(!currentGs.usedLastChance){
        setResult(null);       
        setLastChance(true);   
        return;
      }
      setScreen('gameover');
      return;
    }
    if(currentGs.deck.length<2){
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

  useEffect(()=>{
    if(result){
      const timer=setTimeout(()=>{
        continueGame();
      }, 2000);
      return ()=>clearTimeout(timer);
    }
  },[result,continueGame]);

  const rollD4=(guess)=>{
    const r = Math.floor(Math.random() * 4) + 1;
    setDiceState({result: r, guess});
    setTimeout(()=>{
      if(r===guess){
        setGs(g=>({...g, lives: 1, usedLastChance: true}));
        setDiceState({result: null, guess: null});
        setLastChance(false); 
        setNoFlipAnim(true);
        setRevealed(false);
        setTimeout(()=>{
          if(gsRef.current.deck.length<2){setScreen('deckempty');return;}
          const ng=drawNext(gsRef.current);
          setGs(ng);
          setSel(EMPTY_SEL);setResult(null);setShop(false);
          setNoFlipAnim(false);
          deal();
        },32);
      } else {
        setGs(g=>({...g, usedLastChance: true}));
        setScreen('gameover');
        setDiceState({result: null, guess: null});
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
    settingsOpen&&e(SettingsPanel,{draft,onChange:changeDraft,onChangeDeckCount:changeDeckCount,onChangeCardValue:changeCardValue,onApply:applySettings,onCancel:cancelSettings,gameActive:false}),
    e('div',{className:'start'},
    e('div',{className:'sigil'},'⛧'),
    e('h1',{className:'start-title'},'Devil\'s',e('br'),'Gambit'),
    e('div',{className:'sep'}),
    e('button',{className:'btn-start',onClick:startGame},'Play Game'),
    e('button',{className:'btn-options',onClick:openSettings},'⚙ Options')
  ));

  if(screen==='gameover')return e('div',{className:'app'},
    settingsOpen&&e(SettingsPanel,{draft,onChange:changeDraft,onChangeDeckCount:changeDeckCount,onChangeCardValue:changeCardValue,onApply:applySettings,onCancel:cancelSettings,gameActive:false}),
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
    settingsOpen&&e(SettingsPanel,{draft,onChange:changeDraft,onChangeDeckCount:changeDeckCount,onChangeCardValue:changeCardValue,onApply:applySettings,onCancel:cancelSettings,gameActive:false}),
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
  const canCommit=!!derived&&!result;

  const tc=gs.tableCard,hc=gs.handCard;
  const isHighTC=HIGH.has(tc.value);
  const isLowTC=['2','3','4','5','6','7'].includes(tc.value);
  const tcCat=tc.value==='JOKER'?'Joker':tc.value==='A'?'Ace':isHighTC?'High':isLowTC?'Low':'—';

  return e('div',{className:'app'},
    settingsOpen&&e(SettingsPanel,{draft,onChange:changeDraft,onChangeDeckCount:changeDeckCount,onChangeCardValue:changeCardValue,onApply:applySettings,onCancel:cancelSettings,gameActive:true}),
    infoOpen&&e(InfoPanel,{gs,history:roundHistory,onClose:()=>setInfoOpen(false)}),
    e('div',{className:'game-wrap'},
    e('div',{className:'hdr'},
      e('span',{className:'hdr-round',onClick:()=>setInfoOpen(true),title:'View Deck & History'},'Round '+gs.round),
      e('span',{className:'hdr-brand'},
        e('button',{className:'hdr-gear',onClick:openSettings,title:'Options'},'Devil\'s Gambit ⚙'),
      ),
      e('span',{className:'hdr-score'},'Score: ',e('b',null,gs.score.toLocaleString()))
    ),
    e('div',{className:'stats'},
      e('div',{className:'stat'},
        e('span',{className:'stat-lbl'},'Lives'),
        e('div',{className:'hearts'},
          Array.from({length:Math.max(gs.lives,gs.startLives)},(_,i)=>
            e('span',{key:i,className:'heart '+(i<gs.lives?'on':'off')},'♥')
          )
        )
      ),
      e('div',{className:'stat'},e('span',{className:'stat-lbl'},'Blanks'),e('span',{className:'stat-val'},+gs.blanks)),
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
        e('div',{className:'actions'},
          e('button',{className:'btnmain',onClick:commit,disabled:!canCommit || shop || !!result || lastChance},'Set'),
          e('button',{className:'btnsec',onClick:doBlank,disabled:!gs.blanks || shop || !!result || lastChance},'Blank'),
          e('button',{className:'btnsec',onClick:doSkip, disabled:shop || !!result || lastChance},'Skip'),
          e('button',{className:'btnsec',onClick:()=>setShop(s=>!s),disabled:!!result || lastChance},shop?'Close Shop':'Shop')
        ),
        (result || lastChance || !shop) && e(GambitPanel,{sel,onToggle:toggleSel,derived,gs,disabled:!!result||lastChance,result,lastChance,diceState,onRoll:rollD4}),
        shop && !result && !lastChance && e(Shop,{gs,buyLife,buyBlank})
      )
    )
  ));
}

const root=ReactDOM.createRoot(document.getElementById('root'));
root.render(React.createElement(App));