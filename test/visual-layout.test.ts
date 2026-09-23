import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { JSDOM } from 'jsdom';
import { createReferee } from '../src/referee.ts';
import { createBot } from '../src/bots/index.ts';
import type { PlayerView } from '../src/index.ts';
import { rankOf, suitOf } from '../src/index.ts';
import { createTable } from '../web/render.ts';
import { cardName } from '../web/presentation.ts';
import { suitGlyph } from '../web/visuals.ts';
function fixture(v:PlayerView) {
  const dom=new JSDOM(readFileSync('web/index.html','utf8'));
  const root=dom.window.document.querySelector<HTMLElement>('#game')!;root.hidden=false;
  const actions: unknown[]=[];
  let repeats=0,reviews=0;
  const table=createTable(root,{act:a=>actions.push(a),next:()=>{},repeat:()=>{repeats++;},review:()=>{reviews++;}});
  table.render(v);
  return {dom,root,table,actions,counts:()=>[repeats,reviews]};
}
const view=()=>createReferee({seed:17,dealer:3}).player(0).view();
test('new-game and difficulty retain native semantics; sound stays off in compact bar',()=>{
  const {dom}=fixture(view());const d=dom.window.document;
  assert.equal(d.querySelector('#setup button')!.getAttribute('aria-label'),'New Game');
  assert.equal(d.querySelector('#setup button')!.tagName,'BUTTON');
  assert.equal(d.querySelector('#difficulty')!.tagName,'SELECT');
  assert.equal(d.querySelector('label[for="difficulty"]')!.textContent,'Opponent difficulty');
  assert.equal(d.querySelector('#sound-cues')!.getAttribute('aria-pressed'),'false');
  assert.equal(d.querySelector('#sound-cues')!.getAttribute('aria-label'),'Sound Cues');
  for(const glyph of d.querySelectorAll('#setup button .new-icon,#sound-cues svg'))assert.equal(glyph.getAttribute('aria-hidden'),'true');
});
test('repeat star changes to each called suit and resets without changing speech or callback',()=>{
  const v=view();const {root,table,counts}=fixture(v);const button=root.querySelector<HTMLButtonElement>('#repeat-state')!;
  const glyph=button.querySelector<HTMLElement>('.state-icon')!;
  assert.equal(glyph.dataset.glyph,'★');assert.equal(glyph.getAttribute('aria-hidden'),'true');
  for(const suit of ['hearts','diamonds','clubs','spades'] as const) {
    table.render({...v,trump:suit,caller:1,phase:'playing'});
    assert.equal(glyph.dataset.glyph,suitGlyph[suit]);assert.equal(button.getAttribute('aria-label'),'Repeat current state');
    assert.equal(button.textContent,'Repeat current state');button.click();
  }
  table.render({...v,handNumber:2});assert.equal(glyph.dataset.glyph,'★');assert.deepEqual(counts(),[4,0]);
});
test('rabbit ears and top hat are decorative; review availability and name remain constant',()=>{
  const v=view();const {root,table,counts}=fixture(v);const button=root.querySelector<HTMLButtonElement>('#review-trick')!;
  assert.equal(button.hidden,true);assert.equal(button.getAttribute('aria-label'),'Review last trick');
  const svg=button.querySelector('svg')!;assert.equal(svg.getAttribute('aria-hidden'),'true');assert.equal(svg.getAttribute('focusable'),'false');
  assert.ok(svg.querySelector('.rabbit'));assert.ok(svg.querySelector('.hat'));assert.ok(svg.querySelector('.brim'));
  assert.equal(svg.querySelector('title'),null);
  table.render({...v,completedTricks:[{plays:[],winner:1}]});assert.equal(button.hidden,false);button.click();assert.deepEqual(counts(),[0,1]);
  assert.equal(button.textContent,'Review last trick');table.render({...v,handNumber:2});assert.equal(button.hidden,true);
});
test('each seat can independently show dealer and active states without changing focus or spoken content',()=>{
  const v=view();const {root,table,dom}=fixture(v);const repeat=root.querySelector<HTMLButtonElement>('#repeat-state')!;repeat.focus();
  for(const dealer of [0,1,2,3] as const)for(const turn of [0,1,2,3] as const){
    table.render({...v,dealer,turn});
    assert.equal(root.querySelectorAll('.seat.dealer').length,1);assert.equal(root.querySelectorAll('.seat.active').length,1);
    assert.equal(root.querySelector<HTMLElement>('.seat.dealer')!.dataset.seat,String(dealer));
    assert.equal(root.querySelector<HTMLElement>('.seat.active')!.dataset.seat,String(turn));
    assert.equal(dom.window.document.activeElement,repeat);
    for(const seat of root.querySelectorAll('.seat')){assert.equal(seat.getAttribute('aria-hidden'),'true');assert.equal(seat.hasAttribute('tabindex'),false);assert.doesNotMatch(seat.textContent!,/dealer/i);}
  }
  assert.ok(root.querySelector('#facts')!.classList.contains('sr-only'));
});
test('up-card turns face-down for round two and disappears when picked up',()=>{
  const v=view();const {root,table}=fixture(v);
  assert.equal(root.querySelector('.up-card .card-face')?.getAttribute('data-rank'),rankOf(v.upCard));
  table.render({...v,biddingRound:2,upCardStatus:'turned-down'});
  assert.ok(root.querySelector('.up-card.card-back'));assert.equal(root.querySelector('.up-card .card-face'),null);
  table.render({...v,phase:'discarding',upCardStatus:'ordered'});assert.equal(root.querySelector('.up-card'),null);
  table.render({...v,phase:'playing',upCardStatus:'ordered'});assert.equal(root.querySelector('.up-card'),null);
});
test('five-card faces preserve semantic labels, stable order, legal handlers and first legal focus',()=>{
  const v:PlayerView={...view(),phase:'playing',turn:0,trump:'hearts',hand:['clubs:9','diamonds:J','hearts:A','spades:K','clubs:10'],legalActions:[{type:'play',card:'diamonds:J'},{type:'play',card:'hearts:A'}]};
  const {root,table,actions,dom}=fixture(v);const cards=[...root.querySelectorAll<HTMLButtonElement>('#hand button')];
  assert.equal(cards.length,5);
  cards.forEach((button,i)=>{
    const card=v.hand[i]!;const face=button.querySelector<HTMLElement>('.card-face')!;
    assert.equal(face.dataset.rank,rankOf(card));assert.equal(face.dataset.suit,suitGlyph[suitOf(card)]);assert.equal(face.getAttribute('aria-hidden'),'true');
    assert.equal(button.getAttribute('aria-label'),button.textContent);assert.ok(button.textContent!.startsWith(cardName(card,v.trump)));
    assert.equal(button.disabled,false);assert.equal(button.tabIndex,0);button.click();
  });
  assert.deepEqual(actions,v.legalActions);table.focus();assert.equal(dom.window.document.activeElement,cards[1]);
  table.render(v);assert.deepEqual([...root.querySelectorAll('#hand button')],cards);
  assert.match(cards[0]!.getAttribute('aria-label')!,/not playable/);
});
test('six-card discard faces keep engine order and each legal discard works; focus stays first legal',()=>{
  const ref=createReferee({seed:7,dealer:0});ref.player(1).act({type:'order-up',alone:false});const v=ref.player(0).view();
  const {root,table,actions,dom}=fixture(v);const buttons=[...root.querySelectorAll<HTMLButtonElement>('#hand button')];
  assert.equal(buttons.length,6);assert.deepEqual(buttons.map(b=>b.getAttribute('aria-label')),v.hand.map(c=>`Discard ${cardName(c,v.trump)}`));
  buttons.forEach(b=>b.click());assert.deepEqual(actions,v.legalActions);table.focus();assert.equal(dom.window.document.activeElement,buttons[0]);
});
test('bidding swipe order is hand then bid choices then Pass and review controls while focus still lands on first bid',()=>{
  const v=view();const {root,table,dom}=fixture(v);
  const hand=root.querySelector('#hand')!;const bids=root.querySelector('#bids')!;const pass=root.querySelector('#pass')!;
  const repeat=root.querySelector('#repeat-state')!;const review=root.querySelector('#review-trick')!;
  const following=dom.window.Node.DOCUMENT_POSITION_FOLLOWING;
  assert.ok(hand.compareDocumentPosition(bids)&following);
  assert.ok(bids.compareDocumentPosition(pass)&following);
  assert.ok(pass.compareDocumentPosition(repeat)&following);
  assert.ok(repeat.compareDocumentPosition(review)&following);
  const cards=[...root.querySelectorAll<HTMLButtonElement>('#hand button')];
  const bidButtons=[...root.querySelectorAll<HTMLButtonElement>('#bids button')];
  assert.ok(cards.length>0);assert.ok(bidButtons.length>0);
  table.focus();assert.equal(dom.window.document.activeElement,bidButtons[0]);
  assert.equal(bidButtons[0]!.previousElementSibling,null);
  assert.ok(hand.lastElementChild===cards.at(-1));
});
test('all compact bids keep full labels and decorative alone rings through both calling rounds',()=>{
  const ref=createReferee({seed:17,dealer:3});
  for(const round of [1,2]) {
    const v=ref.player(0).view();const {root,actions}=fixture(v);const buttons=[...root.querySelectorAll<HTMLButtonElement>('#bids button')];
    const legal=v.legalActions.filter(a=>a.type!=='pass');
    buttons.forEach((b,i)=>{
      const a=legal[i]!;assert.ok(a.type==='call'||a.type==='order-up');const suit=a.type==='call'?a.suit:suitOf(v.upCard);
      assert.equal(b.getAttribute('aria-label'),`${round===1?'Order up':'Call'} ${suit}${a.alone?' and go alone':''}`);
      assert.equal(b.querySelector('.suit-symbol')!.getAttribute('aria-hidden'),'true');assert.equal(!!b.querySelector('.alone'),a.alone);b.click();
    });assert.deepEqual(actions,legal);
    if(round===1)for(let i=0;i<4;i++)ref.player(ref.player(0).view().turn!).act({type:'pass'});
  }
});
test('visual completed-trick hold uses public plays only and never becomes accessible current trick',()=>{
  const plays=[{seat:1,card:'hearts:9'},{seat:2,card:'hearts:J'},{seat:3,card:'hearts:K'},{seat:0,card:'hearts:A'}] as const;
  const v:PlayerView={...view(),phase:'playing',trump:'hearts',caller:1,turn:2,trick:[],completedTricks:[{plays,winner:2}]};
  const {root,table}=fixture(v);
  assert.equal(root.querySelector('#trick')!.children.length,0);assert.equal(root.querySelectorAll('#visual-cards .played').length,4);
  assert.equal(root.querySelector('#visual-held')!.textContent,'Last trick');
  for(const card of root.querySelectorAll('.played'))assert.ok(card.closest('[aria-hidden="true"]'));
  const next={...v,trick:[{seat:2 as const,card:'clubs:Q' as const}]};table.render(next);
  assert.equal(root.querySelectorAll('.played').length,1);assert.equal(root.querySelector('#visual-held')!.textContent,'');
  assert.equal(root.querySelector('#trick li')!.textContent,'Val: Queen of clubs');assert.equal(root.querySelector('#trick li')!.closest('[aria-hidden="true"]'),null);
  table.render({...view(),handNumber:2});assert.equal(root.querySelectorAll('.played').length,0);
});
test('current public trick stays individually reviewable in play order and visual positions match each seat',()=>{
  const v:PlayerView={...view(),phase:'playing',trump:'hearts',trick:[{seat:3,card:'clubs:9'},{seat:0,card:'clubs:K'},{seat:1,card:'clubs:A'}]};
  const {root}=fixture(v);
  assert.deepEqual([...root.querySelectorAll('#trick li')].map(e=>e.textContent),['East: Nine of clubs','You: King of clubs','West: Ace of clubs']);
  assert.deepEqual([...root.querySelectorAll('.played')].map(e=>e.className),['table-card played seat-3','table-card played seat-0','table-card played seat-1']);
  assert.ok([...root.querySelectorAll('h2')].some(e=>e.textContent==='Current trick'&&!e.closest('[aria-hidden="true"]')));
});
test('decorative card faces and data attributes contain only own/public cards through complete matches',()=>{
  for(const level of ['casual','strong','expert'] as const){
    const ref=createReferee({seed:318,dealer:3});const bot=createBot(level);const {root,table}=fixture(ref.player(0).view());let steps=0;
    while(++steps<1200){
      const v=ref.player(0).view();table.render(v);
      const allowed=new Set([...v.hand,v.upCard,...v.trick.map(p=>p.card),...v.completedTricks.flatMap(t=>t.plays.map(p=>p.card))]);
      for(const face of root.querySelectorAll<HTMLElement>('.card-face')){
        const suit=Object.entries(suitGlyph).find(([,glyph])=>glyph===face.dataset.suit)![0];
        assert.ok(allowed.has(`${suit}:${face.dataset.rank}` as typeof v.hand[number]));
      }
      assert.doesNotMatch(root.innerHTML,/data-(?:kitty|seed|world|discard)|rngState|sampledWorld/);
      if(v.phase==='game-over')break;if(v.phase==='hand-over')ref.nextHand();else{const p=ref.player(v.turn!);p.act(bot(p.view()));}
    }assert.equal(ref.player(0).view().phase,'game-over');assert.ok(Math.max(...ref.player(0).view().score)>=10);
  }
});

test('protected PR 6 narrator, 750 ms guard, summaries, session, randomness entry and sound are byte-identical',()=>{
 const hashes={"web/controller.ts": "66cfaccb143d564ed1051a788a84a15df831901808259ba972fb924b4e96b9ac", "web/announcer.ts": "88ed4d2acf557c57737a9dcac252738cde471a5d0f97e58563076d5a65bc4362", "web/presentation.ts": "5bbb5fe8353087724f791a895133633704a55c92baf7ea90d3bf524395739821", "web/session.ts": "557b243ea324efa9c0937ca4f5ba1019acca24565f806599b70a7bab38da622c", "web/main.ts": "32308451f40a1737bfa293a0c1ffad54e1eee8974ccbd8f299d81b5e70e410f1", "web/sound.ts": "7f84776ebdb1467cbb1c86045d1b046c23e87493278551389c804b931dbcbe8b"};
 for(const [file,hash] of Object.entries(hashes))assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'),hash,file);
});
