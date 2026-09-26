import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { createReferee } from '../src/referee.ts';
import { createBot } from '../src/bots/index.ts';
import type { PlayerView } from '../src/index.ts';
import { createSession } from '../web/session.ts';
import { createTable } from '../web/render.ts';
import { createController } from '../web/controller.ts';
import { createAnnouncer } from '../web/announcer.ts';
import { cardName, currentState, events, handAnnouncement, lastTrick } from '../web/presentation.ts';
import { createSoundCues, cueEvents, type SoundCue } from '../web/sound.ts';
const flush = () => new Promise<void>(resolve => setImmediate(resolve));
const base = () => createSession(17, 'strong', {dealer: 3}).view();
const playing = (): PlayerView => ({...base(), phase: 'playing', trump: 'hearts', caller: 2, turn: 0,
  hand: ['clubs:9', 'diamonds:J', 'hearts:A'], legalActions: [{type:'play',card:'diamonds:J'},{type:'play',card:'hearts:A'}]});
const completed = (): PlayerView => ({...playing(), completedTricks: [{plays: [
  {seat:3,card:'diamonds:9'}, {seat:0,card:'diamonds:A'}, {seat:1,card:'diamonds:10'}, {seat:2,card:'diamonds:Q'}],winner:0}]});
function fixture(v = playing()) {
  const dom = new JSDOM('<main></main>'); const root = dom.window.document.querySelector('main')!;
  let controller: ReturnType<typeof createController>;
  const table = createTable(root, {act:a=>{void controller.act(a);}, next:()=>{}, repeat:()=>{void controller.repeat();}, review:()=>{void controller.review();}});
  const messages: string[] = [];
  const session = {view:()=>v,human:()=>null,bot:()=>null,nextHand:()=>v};
  controller=createController(session,table,t=>messages.push(t),async()=>{});
  table.render(v); table.focus();
  return {dom,root,table,controller,messages};
}
test('one serialized writer serves events and coalesced review requests', async () => {
  const log:string[]=[]; const release:Array<()=>void>=[];
  const speech=createAnnouncer(t=>log.push(t),()=>new Promise<void>(r=>release.push(r)));
  const event=speech.say('West passes.'); const stale=speech.say('Stale review',true);
  const latest=speech.say('Current review',true);
  assert.deepEqual(log,['West passes.']); release.shift()!(); await flush();
  assert.deepEqual(log,['West passes.','','Current review']);
  release.shift()!(); await Promise.all([event,stale,latest]);
  assert.deepEqual(log,['West passes.','','Current review','']);
  assert.equal((readFileSync('web/index.html','utf8').match(/aria-live=/g)??[]).length,1);
  for(const file of ['controller','render','sound']) assert.doesNotMatch(readFileSync(`web/${file}.ts`,'utf8'),/speechSynthesis|\.textContent\s*=.*message|aria-live/);
});
test('dealer and up-card each occur once per hand, including repeated start', async () => {
  const {controller,messages}=fixture(base()); await controller.start(); await controller.start();
  assert.deepEqual(messages.filter(Boolean),['East deals.',handAnnouncement(base())]);
});
test('four passes announce exactly four bids and one turned-down event', () => {
  const ref=createReferee({seed:17,dealer:3}); const messages:string[]=[];
  for(let i=0;i<4;i++) {const before=ref.player(0).view();const actor=before.turn!;ref.player(actor).act({type:'pass'});
    messages.push(...events(before,ref.player(0).view(),actor,{type:'pass'}));}
  // The human's activated Pass label supplies that bid; the live path supplies the other three.
  assert.deepEqual(messages,['West passes.','Val passes.','East passes.','The up-card is turned down.']);
});
test('order-up and pickup are distinct, once-only public events; discard omits identity', () => {
  const ref=createReferee({seed:7}); const before=ref.player(0).view();
  const action={type:'order-up',alone:true} as const;ref.player(1).act(action);const ordered=ref.player(0).view();
  assert.deepEqual(events(before,ordered,1,action),[`West orders up ${ordered.trump} and goes alone.`,'You pick up.']);
  const discard=ordered.legalActions[0]!;ref.player(0).act(discard);
  assert.deepEqual(events(ordered,ref.player(0).view(),0,discard),[]);
  assert.deepEqual(events(ordered,ordered,3,{type:'discard',card:'spades:A'}),['East discards a card.']);
});
test('valid public opening lead is distinguished from a following play; human play is not duplicated', () => {
  const v=playing(); const after={...v,trick:[{seat:1 as const,card:'clubs:Q' as const}]};
  assert.deepEqual(events(v,after,1,{type:'play',card:'clubs:Q'}),['West leads queen of clubs.']);
  assert.deepEqual(events(after,{...after,trick:[...after.trick,{seat:2,card:'clubs:A'}]},2,{type:'play',card:'clubs:A'}),['Val plays ace of clubs.']);
  assert.deepEqual(events(v,v,0,{type:'play',card:'diamonds:J'}),[]);
});
test('repeat accurately describes both calling rounds, playing, loners and discard phase', () => {
  assert.equal(currentState(base()),`Suit not called yet. Up-card: ${cardName(base().upCard).toLowerCase()}, face-up. First calling round. You to act. You and Val have 0 tricks; opponents have 0. Hand ${base().handNumber}. Dealer: East. Score: you and Val 0, opponents 0. First to 10.`);
  assert.match(currentState({...base(),biddingRound:2,upCardStatus:'turned-down'}),/turned-down\. Second calling round/);
  assert.equal(currentState(completed()),'Called suit: hearts. Caller: Val. You lead. You and Val have 1 trick; opponents have 0. Hand 1. Dealer: East. Score: you and Val 0, opponents 0. First to 10.');
  assert.match(currentState({...playing(),alone:true}),/Val is going alone/);
  assert.match(currentState({...playing(),phase:'discarding',turn:3,upCardStatus:'ordered'}),/ordered\. East must discard/);
  assert.match(currentState({...playing(),trick:[{seat:1,card:'diamonds:J'}]}),/West led jack of diamonds, left bower, counts as hearts\. You to act/);
});
test('last trick uses exact actual order, correct winner and bower explanations', () => {
  assert.equal(lastTrick(completed()),'Last trick. East led nine of diamonds. You played ace of diamonds. West played ten of diamonds. Val played queen of diamonds. You took the trick.');
  for(const winner of [0,1,2,3] as const) {
    assert.ok(lastTrick({...playing(),completedTricks:[{plays:[{seat:2,card:'diamonds:J'}],winner}]}).endsWith(`${['You','West','Val','East'][winner]} took the trick.`));
  }
  assert.equal(lastTrick(playing()),'');
});
test('review controls leave game, hand order, full-hand reachability and focus key untouched', async () => {
  const v=completed();const snapshot=structuredClone(v);const {dom,root,table,controller}=fixture(v);
  const cards=[...root.querySelectorAll<HTMLButtonElement>('#hand button')];
  assert.equal(dom.window.document.activeElement,cards[1]);
  const repeat=root.querySelector<HTMLButtonElement>('#repeat-state')!; repeat.focus();repeat.click();await flush();
  assert.equal(dom.window.document.activeElement,repeat);table.focus();assert.equal(dom.window.document.activeElement,repeat);
  const review=root.querySelector<HTMLButtonElement>('#review-trick')!;assert.equal(review.hidden,false);review.focus();review.click();await flush();
  assert.equal(dom.window.document.activeElement,review);assert.equal(root.querySelector('#trick')!.children.length,0);
  assert.deepEqual([...root.querySelectorAll('#hand button')],cards);assert.deepEqual(v,snapshot);
  assert.equal(cards[0]!.disabled,false);assert.equal(cards[0]!.getAttribute('aria-disabled'),'true');
  table.render({...v,completedTricks:[]});assert.equal(review.hidden,true);controller.stop();
});
test('a legal action interrupts on-demand speech without waiting for its speech budget', async () => {
  const v=playing();const {table}=fixture(v);const messages:string[]=[];let actions=0;
  const session={view:()=>v,human:()=>{actions++;return {view:v,messages:[]};},bot:()=>null,nextHand:()=>v};
  const controller=createController(session,table,t=>messages.push(t),()=>new Promise<void>(()=>{}));
  const review=controller.repeat();await controller.act(v.legalActions[0]!);await review;
  assert.equal(actions,1);assert.deepEqual(messages,[currentState(v),'']);
});
test('automatic events and a requested review finish before focus resumes', async () => {
  const v=playing();const {table}=fixture(v);let focusCount=0;table.focus=()=>{focusCount++;};
  const releases:Array<()=>void>=[];const messages:string[]=[];
  const session={view:()=>v,human:()=>({view:v,messages:['West passes.']}),bot:()=>null,nextHand:()=>v};
  const controller=createController(session,table,t=>messages.push(t),()=>new Promise<void>(r=>releases.push(r)));
  const act=controller.act(v.legalActions[0]!);const review=controller.repeat();
  releases.shift()!();await flush();assert.equal(focusCount,0);assert.equal(messages.at(-1),currentState(v));
  releases.shift()!();await flush();assert.equal(focusCount,0);assert.equal(messages.at(-1),'');
  releases.shift()!();await Promise.all([act,review]);assert.equal(focusCount,1);
});
test('all narrator and review text excludes private cards throughout real games', () => {
  for(const level of ['casual','strong','expert'] as const) {
    const ref=createReferee({seed:318});const policy=createBot(level);let steps=0;
    while(++steps<1200) {
      const before=ref.player(0).view();if(before.phase==='game-over')break;
      if(before.phase==='hand-over'){ref.nextHand();continue;}
      const actor=before.turn!;const port=ref.player(actor);const action=policy(port.view());assert.ok(port.act(action).ok);
      const v=ref.player(0).view(); const text=[...events(before,v,actor,action),currentState(v),lastTrick(v)].join(' ');
      const publicCards=new Set([v.upCard,...v.trick.map(p=>p.card),...v.completedTricks.flatMap(t=>t.plays.map(p=>p.card))]);
      const state=ref.snapshot();
      for(const card of [...state.hands.flat(),...state.kitty]) if(!publicCards.has(card)) assert.ok(!text.toLowerCase().includes(cardName(card).toLowerCase()),`Leaked ${card}`);
      assert.doesNotMatch(text,/rng|kitty|seed|strategy|worlds/);
    }
    assert.equal(ref.player(0).view().phase,'game-over');assert.ok(steps<1200);
  }
});
test('cue selection coalesces results and uses public differences only', () => {
  const v=playing();assert.deepEqual(cueEvents(v,v),[]);
  assert.deepEqual(cueEvents(v,{...v,trick:[{seat:0,card:'hearts:A'}]}),['card']);
  assert.deepEqual(cueEvents(v,completed()),['trick']);
  for(const team of [0,1] as const) {
    const after={...completed(),result:{team,points:1,makerTricks:3,reason:'made' as const}};
    assert.deepEqual(cueEvents(v,after),[team===0?'hand-win':'hand-loss']);
    assert.deepEqual(cueEvents(v,{...after,winner:team}),[team===0?'game-win':'game-loss']);
  }
});
test('sound defaults off, enables only on gesture, stops on disable and tolerates unavailable audio', () => {
  let factories=0;let starts=0;let stops=0;
  const audio={state:'running',currentTime:0,destination:{},resume:async()=>{},
    createOscillator:()=>({type:'',frequency:{value:0},connect(){},disconnect(){},start(){starts++;},stop(){stops++;},onended:null}),
    createGain:()=>({gain:{setValueAtTime(){},linearRampToValueAtTime(){}},connect(){},disconnect(){}})};
  const cues=createSoundCues(()=>{factories++;return audio as unknown as AudioContext;});
  cues.play('card');assert.equal(factories,0);assert.equal(starts,0);
  cues.setEnabled(true);cues.play('trick');assert.equal(starts,1);assert.equal(factories,1);
  cues.setEnabled(false);assert.equal(stops,2);cues.play('card');assert.equal(starts,1);
  const unavailable=createSoundCues(()=>{throw Error('unavailable');});unavailable.setEnabled(true);assert.doesNotThrow(()=>unavailable.play('card'));
  assert.match(readFileSync('web/index.html','utf8'),/id="sound-cues"[^>]*aria-pressed="false"/);
  assert.doesNotMatch(readFileSync('web/sound.ts','utf8'),/fetch\(|https?:|setTimeout|\.focus\(/);
});
test('sound on/off yields identical complete games, messages, focus and hand order at every turn', async () => {
  const a=createSession(92,'casual');const b=createSession(92,'casual');const human=createBot('strong');
  const setup=(session:typeof a,sound:(cue:SoundCue)=>void)=>{
    const dom=new JSDOM('<main></main>');const root=dom.window.document.querySelector('main')!;
    const table=createTable(root,{act:()=>{},next:()=>{}});const messages:string[]=[];
    return {dom,root,messages,controller:createController(session,table,t=>messages.push(t),async()=>{},sound)};
  };
  const cues:SoundCue[]=[];const left=setup(a,()=>{});const right=setup(b,c=>cues.push(c));
  await left.controller.start();await right.controller.start();
  for(let step=0;step<1200;step++) {
    assert.deepEqual(a.view(),b.view());assert.deepEqual(left.messages,right.messages);
    assert.equal(left.root.innerHTML,right.root.innerHTML);
    assert.equal(left.dom.window.document.activeElement?.outerHTML,right.dom.window.document.activeElement?.outerHTML);
    if(a.view().phase==='game-over')break;
    if(a.view().phase==='hand-over'){await left.controller.next();await right.controller.next();}
    else{const action=human(a.view());await left.controller.act(action);await right.controller.act(action);}
  }
  assert.equal(a.view().phase,'game-over');assert.ok(cues.includes('card'));assert.ok(cues.includes('trick'));
});
