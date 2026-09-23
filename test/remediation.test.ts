import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import type { Action, PlayerView } from '../src/index.ts';
import { suitOf } from '../src/index.ts';
import { createReferee } from '../src/referee.ts';
import { type Session, createSession } from '../web/session.ts';
import { createTable } from '../web/render.ts';
import { createController, FOCUS_GUARD_MS } from '../web/controller.ts';
import { cardName, currentState, lastTrick, resultText } from '../web/presentation.ts';
const flush = () => new Promise<void>(r => setImmediate(r));
const playing = (): PlayerView => ({...createSession(17,'strong',{dealer:3}).view(), phase:'playing',turn:0,
  trump:'hearts',caller:2,hand:['clubs:9','diamonds:J','hearts:A'],
  legalActions:[{type:'play',card:'diamonds:J'},{type:'play',card:'hearts:A'}]});
function fixture(v: PlayerView) {
  const dom = new JSDOM('<main></main>'); const root = dom.window.document.querySelector('main')!;
  const actions: Action[] = [];
  const table = createTable(root,{act:a=>actions.push(a),next:()=>{}}); table.render(v);
  return {dom,root,table,actions};
}
function clockFixture(v = playing(), messages = ['East plays ace of clubs.']) {
  const ui = fixture(v); let current = v;
  const log: string[] = []; const waits: {ms:number;release:()=>void}[] = [];
  const session: Session = {view:()=>current,human:()=>({view:current,messages}),bot:()=>null,nextHand:()=>current};
  const focus = ui.table.focus;
  ui.table.focus = () => {log.push('focus'); focus();};
  const controller = createController(session,ui.table,t=>log.push(t ? `say:${t}` : 'clear'),
    ms=>{log.push(`wait:${ms}`); return new Promise<void>(release=>waits.push({ms,release}));});
  return {...ui,controller,log,waits,session,setView:(next:PlayerView)=>{current=next;}};
}
test('automatic event clears before the 1500 ms guard starts; first legal card focuses only after guard', async () => {
  const f=clockFixture(); const pending=f.controller.act(playing().legalActions[0]!);
  assert.deepEqual(f.log,['say:East plays ace of clubs.','wait:1600']);
  assert.equal(f.waits.length,1);
  f.waits.shift()!.release(); await flush();
  assert.deepEqual(f.log.slice(-2),['clear','wait:1500']);
  assert.equal(f.log.includes('focus'),false);
  f.waits.shift()!.release(); await pending;
  assert.equal(f.log.at(-1),'focus');
  assert.equal(f.dom.window.document.activeElement,f.root.querySelectorAll('#hand button')[1]);
  assert.equal(FOCUS_GUARD_MS,1500);
});
test('West order-up and pickup both finish before guarded first-discard focus', async () => {
  const ref=createReferee({seed:7});ref.player(1).act({type:'order-up',alone:false});
  const v=ref.player(0).view();const f=clockFixture(v,['West orders up hearts.','You pick up.']);
  const pending=f.controller.act(v.legalActions[0]!);
  f.waits.shift()!.release();await flush();
  assert.equal(f.waits[0]!.ms,1600);assert.equal(f.log.includes('wait:1500'),false);
  f.waits.shift()!.release();await flush();assert.equal(f.log.at(-1),'wait:1500');
  f.waits.shift()!.release();await pending;
  assert.equal(f.dom.window.document.activeElement,f.root.querySelector('#hand button'));
});
test('quiet guard does not delay un-narrated focus or each intervening bot decision', async () => {
  const f=clockFixture(playing(),[]);await f.controller.act(playing().legalActions[0]!);
  assert.deepEqual(f.log,['focus']);assert.equal(f.waits.length,0);
  const g=clockFixture({...playing(),turn:1},['You take the trick.']);
  let botCalls=0;
  g.session.bot=()=>{botCalls++;g.setView(playing());return {view:playing(),messages:['West leads king of clubs.']};};
  const pending=g.controller.act(playing().legalActions[0]!);
  g.waits.shift()!.release();await flush();
  assert.equal(g.waits[0]!.ms,350);assert.equal(botCalls,0);
  g.waits.shift()!.release();await flush();assert.equal(botCalls,1);
  assert.equal(g.log.includes('wait:1500'),false);
  g.waits.shift()!.release();await flush();assert.equal(g.waits[0]!.ms,1500);
  g.waits.shift()!.release();await pending;
  assert.equal(g.log.filter(x=>x==='wait:1500').length,1);
});
test('review requested during quiet guard finishes and receives a fresh quiet interval', async () => {
  const f=clockFixture();const pending=f.controller.act(playing().legalActions[0]!);
  f.waits.shift()!.release();await flush();const guard=f.waits.shift()!;
  const review=f.controller.repeat();const speech=f.waits.shift()!;
  guard.release();await flush();assert.equal(f.log.includes('focus'),false);
  speech.release();await review;await flush();assert.equal(f.log.at(-1),'wait:1500');
  assert.equal(f.log.includes('focus'),false);f.waits.shift()!.release();await pending;
  assert.equal(f.log.filter(x=>x==='focus').length,1);
});
test('stopping during the guard prevents stale focus; hand/game results retain guarded result focus', async () => {
  const f=clockFixture();const pending=f.controller.act(playing().legalActions[0]!);
  f.waits.shift()!.release();await flush();f.controller.stop();f.waits.shift()!.release();await pending;
  assert.equal(f.log.includes('focus'),false);
  for(const phase of ['hand-over','game-over'] as const) {
    const v:PlayerView={...playing(),phase,turn:null,result:{team:0,points:1,makerTricks:3,reason:'made'},winner:phase==='game-over'?0:null};
    const g=clockFixture(v,['You take the trick.']);const done=g.controller.act({type:'play',card:'hearts:A'});
    g.waits.shift()!.release();await flush();assert.equal(g.log.at(-1),'wait:1500');
    g.waits.shift()!.release();await done;
    assert.equal(g.dom.window.document.activeElement,g.root.querySelector('#result'));
    assert.equal(g.log.filter(x=>x.startsWith('say:')).length,1);
  }
});
function accessibleOrder(root:HTMLElement) {
  return [...root.querySelectorAll('h2,button')].filter(e=>!e.closest('[hidden],[aria-hidden="true"]'))
    .map(e=>e.getAttribute('aria-label')??e.textContent);
}
test('play navigation follows stable hand, then state and available trick review with no Pass', () => {
  const v=playing();const {root,table}=fixture(v);
  const initial=[...root.querySelectorAll('#hand button')];
  table.render({...v,trick:[{seat:1,card:'clubs:A'}]});
  assert.deepEqual([...root.querySelectorAll('#hand button')],initial);
  const order=accessibleOrder(root);const start=order.indexOf('Your hand');
  assert.deepEqual(order.slice(start),['Your hand',...initial.map(b=>b.textContent),'Repeat current state']);
  table.render({...v,completedTricks:[{plays:[{seat:1,card:'clubs:A'}],winner:1}]});
  assert.deepEqual(accessibleOrder(root).slice(-2),['Repeat current state','Review last trick']);
  assert.equal(root.querySelector('#hand')!.nextElementSibling?.id,'bids');
});
test('both calling rounds put stable hand before positive bids and textual Pass before reviews; stuck dealer omits Pass', () => {
  const ref=createReferee({seed:4,dealer:3});
  for(let step=0;step<8;step++) {
    const v=ref.player(0).view();
    if(v.turn===0) {
      const {root,table,dom,actions}=fixture(v);const order=accessibleOrder(root);
      const positive=v.legalActions.filter(a=>a.type==='order-up'||a.type==='call');
      const bids=[...root.querySelectorAll<HTMLButtonElement>('#bids button')];
      assert.equal(bids.length,positive.length);
      assert.ok(order.indexOf('Your hand')<order.indexOf(bids[0]!.getAttribute('aria-label')!));
      assert.deepEqual([...root.querySelectorAll('#hand button')].map(b=>b.textContent?.split(',')[0]),v.hand.map(c=>cardName(c)));
      const pass=root.querySelector<HTMLButtonElement>('#pass')!;
      assert.equal(pass.textContent,'Pass');assert.equal(pass.hidden,false);
      assert.deepEqual(order.slice(-2),['Pass','Repeat current state']);
      pass.click();assert.deepEqual(actions,[{type:'pass'}]);table.focus();assert.equal(dom.window.document.activeElement,bids[0]);
    }
    if(step<7)ref.player(v.turn!).act({type:'pass'});
  }
  // Seat zero is the stuck dealer in this independent deal.
  const stuck=createReferee({seed:4,dealer:0});for(let i=0;i<7;i++)stuck.player(stuck.player(0).view().turn!).act({type:'pass'});
  const v=stuck.player(0).view();const {root}=fixture(v);const order=accessibleOrder(root);
  const stuckBids=[...root.querySelectorAll<HTMLButtonElement>('#bids button')];
  assert.equal(root.querySelector<HTMLButtonElement>('#pass')!.hidden,true);
  assert.deepEqual(order.slice(order.indexOf('Your hand')),['Your hand',...[...root.querySelectorAll('#hand button')].map(b=>b.textContent),...stuckBids.map(b=>b.getAttribute('aria-label')),'Repeat current state']);
});
test('compact order-up and call glyphs preserve explicit speech, legal actions and CSS touch targets', () => {
  const v=playing();
  for(const round of [1,2] as const) {
    const legalActions:Action[]=round===1?[{type:'order-up',alone:false},{type:'order-up',alone:true},{type:'pass'}]:
      ['clubs','spades','diamonds'].flatMap(suit=>[{type:'call',suit,alone:false},{type:'call',suit,alone:true}]) as Action[];
    const {root,actions}=fixture({...v,phase:'bidding',biddingRound:round,legalActions});
    const buttons=[...root.querySelectorAll<HTMLButtonElement>('#bids button')];
    buttons.forEach((b,i)=>{
      const action=legalActions[i]!;assert.ok(action.type==='call'||action.type==='order-up');
      const suit=action.type==='call'?action.suit:suitOf(v.upCard);
      assert.equal(b.getAttribute('aria-label'),`${round===1?'Order up':'Call'} ${suit}${action.alone?' and go alone':''}`);
      assert.equal(b.querySelector('span')!.getAttribute('aria-hidden'),'true');
      assert.equal(b.querySelector('span')!.classList.contains('alone'),action.alone);
      assert.equal(b.textContent,{clubs:'♣',spades:'♠',diamonds:'♦',hearts:'♥'}[suit]);
      b.click();assert.deepEqual(actions.at(-1),action);
    });
  }
  const css=readFileSync('web/style.css','utf8');
  const dom=new JSDOM(`<style>${css}</style><button class="suit-bid">♥</button>`);
  const holder=dom.window.document.createElement('div');holder.id='bids';holder.append(dom.window.document.querySelector('button')!);dom.window.document.body.append(holder);
  const style=dom.window.getComputedStyle(holder.firstElementChild!);
  assert.ok(parseFloat(style.minWidth)>=48);assert.ok(parseFloat(style.minHeight)>=48);
  assert.match(css,/\.suit-symbol\.alone\{border-color:currentColor\}/);
});
test('redundant HUD stays visible while current trick, turn and hand remain individually accessible', () => {
  const v={...playing(),score:[4,3] as const,trick:[{seat:3 as const,card:'clubs:A' as const},{seat:0 as const,card:'clubs:9' as const}]};
  const {root,table}=fixture(v);
  for(const selector of ['#score','#facts','#trump','#tricks','.partner','.west','.east']) {
    const e=root.querySelector<HTMLElement>(selector)!;assert.equal(e.getAttribute('aria-hidden'),'true');assert.equal(e.hidden,false);assert.ok(e.textContent);
  }
  for(const selector of ['#turn','#hand','#trick','#trick li']) for(const e of root.querySelectorAll(selector))assert.equal(e.closest('[aria-hidden="true"],[hidden]'),null);
  assert.deepEqual([...root.querySelectorAll('#trick li')].map(e=>e.textContent),['East: Ace of clubs','You: Nine of clubs']);
  assert.equal(root.querySelector('#upcard')!.getAttribute('aria-hidden'),'false');
  for(const phase of ['bidding','discarding'] as const) {
    table.render({...v,phase});assert.equal(root.querySelector('#upcard')!.getAttribute('aria-hidden'),'true');
    assert.match(currentState({...v,phase}),/Up-card:/);
  }
  const state=currentState(v);assert.match(state,/Score: you and Val 4, opponents 3/);assert.match(state,/Dealer: East/);assert.match(state,/Called suit: hearts. Caller: Val/);
});
test('orientation covers score, dealer, both rounds, all current plays in order, leader, loner, totals, discard and result', () => {
  const v=playing();const current:PlayerView={...v,score:[4,3],alone:true,sittingOut:0,turn:1,trick:[{seat:3,card:'clubs:A'},{seat:2,card:'clubs:9'}],completedTricks:[{plays:[],winner:2},{plays:[],winner:1}]};
  const text=currentState(current);
  for(const expected of ['Hand 1. Dealer: East.','Score: you and Val 4, opponents 3. First to 10.','You and Val have 1 trick; opponents have 1.','Called suit: hearts. Caller: Val.','Val is going alone.','You sit out.','Current trick. East led ace of clubs. Val played nine of clubs.','West to act.'])assert.ok(text.includes(expected),expected);
  for(const round of [1,2] as const)assert.match(currentState({...v,phase:'bidding',biddingRound:round,upCardStatus:round===1?'face-up':'turned-down'}),round===1?/face-up\. First calling round/:/turned-down\. Second calling round/);
  assert.match(currentState({...v,phase:'discarding',upCardStatus:'ordered'}),/ordered\. You must discard/);
  const result:PlayerView={...v,phase:'game-over',turn:null,score:[10,3],result:{team:0,points:1,makerTricks:3,reason:'made'},winner:0};
  assert.ok(currentState(result).endsWith(resultText(result)));assert.equal((currentState(result).match(/Score:/g)??[]).length,1);
  assert.match(currentState({...v,trick:[]}),/You lead\.$/);
});
test('orientation never reads private hand, actions, sampled worlds or strategy; last trick is independent', () => {
  const v={...playing(),trick:[{seat:1 as const,card:'clubs:A' as const}],completedTricks:[{plays:[{seat:2 as const,card:'spades:9' as const},{seat:3 as const,card:'spades:A' as const}],winner:3 as const}]};
  const guarded=new Proxy(v,{get(target,key,receiver){if(['hand','legalActions','kitty','strategy','worlds'].includes(String(key)))throw Error(`private read ${String(key)}`);return Reflect.get(target,key,receiver);}});
  assert.match(currentState(guarded),/West led ace of clubs/);
  assert.doesNotMatch(currentState(guarded),/nine of spades|ace of spades/);
  assert.equal(lastTrick(guarded),'Last trick. Val led nine of spades. East played ace of spades. East took the trick.');
});
