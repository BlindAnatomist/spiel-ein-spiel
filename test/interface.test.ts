import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { createReferee } from '../src/referee.ts';
import { createBot } from '../src/bots/index.ts';
import { effectiveSuit } from '../src/index.ts';
import type { Action, PlayerView } from '../src/index.ts';
import { createSession, policyLevels } from '../web/session.ts';
import { createTable } from '../web/render.ts';
import { createController } from '../web/controller.ts';
import { actionName, cardName, events } from '../web/presentation.ts';
function fixture(v = createSession(1, 'strong').view()) {
  const dom = new JSDOM('<main></main>');
  const root = dom.window.document.querySelector('main')!;
  const actions: Action[] = [];
  const table = createTable(root, { act: a => actions.push(a), next: () => {} });
  table.render(v);
  return { dom, root, table, actions };
}
function humanView(overrides: Partial<PlayerView> = {}): PlayerView {
  return { ...createSession(1, 'strong').view(), turn: 0, phase: 'playing', trump: 'hearts',
    hand: ['clubs:9','diamonds:J','hearts:Q','spades:A','clubs:K'],
    legalActions: [{type:'play',card:'diamonds:J'},{type:'play',card:'hearts:Q'}], ...overrides };
}
test('presentation accepts seat zero only; host returns no other capability or private state', () => {
  const session = createSession(32, 'expert');
  assert.deepEqual(Object.keys(session).sort(), ['bot','human','nextHand','view']);
  assert.equal(session.view().seat,0);
  assert.throws(() => fixture({...session.view(),seat:2}), /seat zero/);
  for (const file of ['render','presentation','controller']) {
    const source = readFileSync(`web/${file}.ts`,'utf8');
    assert.doesNotMatch(source, /import.*(?:referee|internal\/|bots\/)/);
    assert.doesNotMatch(source, /\.snapshot\(/);
  }
});
test('rendered DOM and all attributes exclude other hands and hidden kitty identities', () => {
  const ref = createReferee({seed:127});
  const view = ref.player(0).view();
  const {root} = fixture(view);
  const state = ref.snapshot();
  const forbidden = [...state.hands.slice(1).flat(), ...state.kitty].filter(c => c !== view.upCard);
  for (const card of forbidden) {
    assert.ok(!root.outerHTML.includes(card));
    assert.ok(!root.outerHTML.includes(cardName(card)));
  }
  assert.doesNotMatch(root.outerHTML,/rngState|seed|snapshot|kitty/);
});
test('all cards keep order; unavailable cards are focusable and inert; focus selects first legal card once', () => {
  const view = humanView();
  const {root,table,actions,dom} = fixture(view);
  const buttons = [...root.querySelectorAll<HTMLButtonElement>('#hand button')];
  assert.equal(buttons.length,5);
  assert.deepEqual(buttons.map(b=>b.textContent?.split(',')[0]),view.hand.map(c=>cardName(c)));
  assert.equal(buttons[0]!.disabled,false);
  assert.equal(buttons[0]!.tabIndex,0);
  buttons[0]!.click(); assert.equal(actions.length,0);
  table.focus(); assert.equal(dom.window.document.activeElement,buttons[1]);
  buttons[0]!.focus(); table.focus(); assert.equal(dom.window.document.activeElement,buttons[0]);
  buttons[1]!.click(); assert.deepEqual(actions,[{type:'play',card:'diamonds:J'}]);
  assert.match(buttons[1]!.textContent!,/Jack of diamonds, left bower, counts as hearts, playable/);
  assert.equal(effectiveSuit('diamonds:J','hearts'),'hearts');
});
test('bidding controls exactly reflect engine legal actions, including stuck dealer', () => {
  const ref = createReferee({seed:4});
  for (let i=0;i<7;i++) {
    const turn = ref.player(0).view().turn!;
    if (turn === 0) {
      const v=ref.player(0).view(); const {root,table,dom}=fixture(v);
      assert.deepEqual([...root.querySelectorAll('#bids button')].map(b=>b.textContent),v.legalActions.map(actionName));
      table.focus(); assert.equal(dom.window.document.activeElement,root.querySelector('#bids button'));
      assert.match(root.querySelector('#turn')!.textContent!,/round 1/);
    }
    assert.ok(ref.player(turn).act({type:'pass'}).ok);
  }
  const v=ref.player(0).view(); const {root}=fixture(v);
  assert.equal(v.biddingRound,2);
  assert.equal(v.turn,0);
  assert.equal(root.querySelectorAll('#bids button').length,6);
  assert.ok(!root.querySelector('#bids')!.textContent!.includes('Pass'));
  assert.deepEqual([...root.querySelectorAll('#bids button')].map(b=>b.textContent),v.legalActions.map(actionName));
});
test('dealer pickup displays six distinct discard controls and focuses the first', () => {
  const ref=createReferee({seed:7}); ref.player(1).act({type:'order-up',alone:false});
  const v=ref.player(0).view(); const {root,table,dom,actions}=fixture(v);
  assert.equal(v.phase,'discarding'); assert.equal(root.querySelectorAll('#hand button').length,6);
  assert.ok([...root.querySelectorAll('#hand button')].every(b=>b.textContent!.startsWith('Discard ')));
  table.focus(); assert.equal(dom.window.document.activeElement,root.querySelector('#hand button'));
  (root.querySelector('#hand button') as HTMLButtonElement).click(); assert.equal(actions[0]!.type,'discard');
});
test('public score, trump and actual left-bower identity remain reviewable', () => {
  const {root}=fixture(humanView({score:[4,3]}));
  assert.match(root.querySelector('#score')!.textContent!,/Val 4.*Opponents 3/);
  assert.match(root.querySelector('#trump')!.textContent!,/hearts/);
  assert.equal(cardName('hearts:J','hearts'),'Jack of hearts, right bower');
  assert.equal(cardName('diamonds:J','hearts'),'Jack of diamonds, left bower, counts as hearts');
});
test('policy routing fixes Val at seat two and applies selected level to both opponents', () => {
  for (const level of ['casual','strong','expert'] as const) assert.deepEqual(policyLevels(level),[null,level,'val',level]);
});
test('one event produces one message, discards omit identity and results use focus only', () => {
  const v=humanView();
  assert.deepEqual(events(v,v,1,{type:'play',card:'clubs:Q'}),['West plays queen of clubs.']);
  assert.deepEqual(events(v,v,2,{type:'discard',card:'spades:A'}),['Val discards a card.']);
  const after={...v,result:{makerTricks:2,team:1,points:2,reason:'euchred'}} as PlayerView;
  assert.deepEqual(events(v,after,0,{type:'play',card:'clubs:9'}),[]);
  const html=readFileSync('web/index.html','utf8');
  assert.equal((html.match(/aria-live=/g)??[]).length,1);
  assert.doesNotMatch(readFileSync('web/render.ts','utf8'),/aria-live|role="status"/);
});
test('automatic bot turns and complete UI matches stay synchronized through score ten and hand pauses', async () => {
  for (const level of ['casual','strong','expert'] as const) {
    const session=createSession(92,level);
    const dom=new JSDOM('<main></main>'); const root=dom.window.document.querySelector('main')!;
    let controller: ReturnType<typeof createController>;
    const table=createTable(root,{act:a=>{void controller.act(a);},next:()=>{void controller.next();}});
    const messages:string[]=[];
    controller=createController(session,table,text=>messages.push(text),async()=>{});
    await controller.start();
    assert.ok(session.view().bids.length>0); // opponents advanced without Continue
    const human=createBot('strong'); let count=0; let results=0;
    while(session.view().phase!=='game-over') {
      assert.ok(++count<1200);
      const v=session.view();
      assert.equal(root.querySelectorAll('#hand button').length,v.hand.length);
      if(v.phase==='hand-over') {
        results++;
        assert.equal(dom.window.document.activeElement,root.querySelector('#result'));
        assert.equal((root.querySelector('#next') as HTMLElement).hidden,false);
        assert.equal(session.view().handNumber,v.handNumber); // no automatic redeal
        await controller.next();
      } else {
        assert.equal(v.turn,0);
        const action=human(v);
        if(action.type==='play') {
          const selected=[...root.querySelectorAll<HTMLButtonElement>('#hand button')].find(b=>b.textContent!.startsWith(cardName(action.card,v.trump)))!;
          assert.equal(selected.getAttribute('aria-disabled'),'false');
        }
        await controller.act(action);
        assert.ok(root.contains(dom.window.document.activeElement));
      }
    }
    assert.ok(results>0); assert.ok(Math.max(...session.view().score)>=10);
    assert.match(root.querySelector('#result')!.textContent!,/win the game/);
    assert.equal((root.querySelector('#next') as HTMLElement).hidden,true);
    assert.ok(messages.some(m=>m.includes('Val')));
  }
});
test('restart cancellation prevents an old bot loop from changing the new screen', async () => {
  const session=createSession(1,'casual'); const {table}=fixture(session.view());
  let release:()=>void=()=>{};
  const controller=createController(session,table,()=>{},()=>new Promise<void>(r=>{release=r;}));
  const pending=controller.start(); controller.stop(); release(); await pending;
  assert.equal(session.view().bids.length,0);
});
test('new-hand rendering preserves engine hand order even when a loner left cards held', () => {
  const first=humanView(); const {root,table}=fixture(first);
  const next=humanView({handNumber:first.handNumber+1,hand:[...first.hand].reverse()}); table.render(next);
  assert.deepEqual([...root.querySelectorAll('#hand button')].map(b=>b.textContent!.split(',')[0]),next.hand.map(c=>cardName(c)));
});
test('every rendered transition excludes private cards, including after pickup and discard', () => {
  const ref=createReferee({seed:318});
  const policy=createBot('strong'); const {root,table}=fixture(ref.player(0).view());
  for(let step=0;step<320;step++) {
    const v=ref.player(0).view(); table.render(v);
    const publicCards=new Set([...v.hand,v.upCard,...v.trick.map(p=>p.card),...v.completedTricks.flatMap(t=>t.plays.map(p=>p.card))]);
    const state=ref.snapshot();
    for(const card of [...state.hands.slice(1).flat(),...state.kitty]) if(!publicCards.has(card)) {
      assert.ok(!root.outerHTML.includes(cardName(card)),`Private card leaked: ${card}`);
      assert.ok(!root.outerHTML.includes(card));
    }
    if(v.phase==='game-over') break;
    if(v.phase==='hand-over') ref.nextHand();
    else { const port=ref.player(v.turn!); assert.ok(port.act(policy(port.view())).ok); }
  }
});
test('session decisions match the selected policies and reproduce with identical seeds', () => {
  for(const level of ['casual','strong','expert'] as const) {
    const a=createSession(521,level); const b=createSession(521,level);
    const ref=createReferee({seed:521});
    const policies=[createBot('casual'),createBot(level),createBot('val'),createBot(level)];
    for(let step=0;step<160;step++) {
      const view=a.view(); assert.deepEqual(view,b.view()); assert.deepEqual(view,ref.player(0).view());
      if(view.phase==='game-over') break;
      if(view.phase==='hand-over') {a.nextHand();b.nextHand();ref.nextHand();continue;}
      const seat=view.turn!; const port=ref.player(seat); const action=policies[seat]!(port.view());
      assert.ok(port.act(action).ok);
      if(seat===0) assert.deepEqual(a.human(action),b.human(action));
      else assert.deepEqual(a.bot(),b.bot());
      assert.deepEqual(a.view(),ref.player(0).view());
    }
  }
});
test('focus follows a new human turn without resetting during exploration; rapid duplicate input is ignored', async () => {
  const session=createSession(23,'strong');
  const {root,table,dom}=fixture(session.view());
  const controller=createController(session,table,()=>{},async()=>{}); await controller.start();
  const before=session.view(); const action=createBot('strong')(before);
  const pending=controller.act(action); const duplicate=controller.act(action);
  await Promise.all([pending,duplicate]);
  const after=session.view(); assert.ok(root.contains(dom.window.document.activeElement));
  if(after.turn===0 && !after.result) {
    const legal=root.querySelector<HTMLButtonElement>('#bids button[aria-disabled="false"],#hand button[aria-disabled="false"]');
    assert.equal(dom.window.document.activeElement,legal);
    const other=root.querySelector<HTMLButtonElement>('#hand button');
    other!.focus(); table.focus(); assert.equal(dom.window.document.activeElement,other);
  }
});
test('trick winner uses subject-aware grammar for every seat exactly once', () => {
  for (const winner of [0,1,2,3] as const) {
    const before=humanView();
    const after={...before,completedTricks:[{plays:[],winner}]};
    assert.deepEqual(events(before,after,0,{type:'play',card:'clubs:9'}),[`${['You take','West takes','Val takes','East takes'][winner]} the trick.`]);
    assert.deepEqual(events(after,after,0,{type:'play',card:'clubs:9'}),[]);
  }
});
test('current trick never falls back to completed plays; public winners determine team trick totals', () => {
  const completedTricks=([0,2,1,3] as const).map(winner=>({winner,plays:[{seat:winner,card:'clubs:9' as const}]}));
  const v=humanView({completedTricks,trick:[]}); const {root,table}=fixture(v);
  assert.equal(root.querySelector('#trick')!.children.length,0);
  assert.ok([...root.querySelectorAll('h2')].some(h=>h.textContent==='Current trick'));
  assert.equal(root.querySelector('#tricks')!.textContent,'Tricks: You and Val 2, opponents 2. 4 of 5 complete.');
  assert.match(root.querySelector('#trump')!.textContent!,/^Called suit: hearts/);
  assert.doesNotMatch(root.textContent!,/Trump:/);
  table.render({...v,trick:[{seat:2,card:'hearts:A'}]});
  assert.deepEqual([...root.querySelectorAll('#trick li')].map(li=>li.textContent),['Val: Ace of hearts']);
  table.render(v); assert.equal(root.querySelector('#trick')!.children.length,0);
});
test('left bowers explain effective suit consistently; right bowers and ordinary cards stay concise', () => {
  for(const [trump,left] of [['clubs','spades'],['spades','clubs'],['hearts','diamonds'],['diamonds','hearts']] as const) {
    assert.equal(cardName(`${left}:J`,trump),`Jack of ${left}, left bower, counts as ${trump}`);
    assert.equal(cardName(`${trump}:J`,trump),`Jack of ${trump}, right bower`);
    assert.equal(cardName(`${left}:A`,trump),`Ace of ${left}`);
  }
});
test('announcement lifecycle retains text for its speech budget, then clears before focus; cancellation cannot clear newer speech', async () => {
  const v=humanView(); const {table}=fixture(v);
  const messages:string[]=[]; let release=()=>{}; const delays:number[]=[];
  const session={view:()=>v,human:()=>({view:v,messages:['You take the trick.','Val takes the trick.']}),bot:()=>null,nextHand:()=>v};
  const controller=createController(session,table,t=>messages.push(t),ms=>{delays.push(ms);return new Promise<void>(resolve=>{release=resolve;});});
  const pending=controller.act({type:'play',card:'diamonds:J'});
  assert.deepEqual(messages,['You take the trick.']); assert.equal(delays[0],1600);
  release(); await Promise.resolve();
  assert.deepEqual(messages,['You take the trick.','','Val takes the trick.']);
  release(); await pending; assert.deepEqual(messages,['You take the trick.','','Val takes the trick.','']);
  const old=createController(session,table,t=>messages.push(t),()=>new Promise<void>(resolve=>{release=resolve;}));
  const oldPending=old.act({type:'play',card:'diamonds:J'}); old.stop(); messages.push('New game event'); release(); await oldPending;
  assert.equal(messages.at(-1),'New game event');
});
test('human focus target is the same first legal hand card for all policy configurations', () => {
  for(const level of ['casual','strong','expert'] as const) {
    const v=humanView({...createSession(61,level).view(),turn:0,phase:'playing',hand:['clubs:9','hearts:9','hearts:A'],trump:'hearts',legalActions:[{type:'play',card:'hearts:9'},{type:'play',card:'hearts:A'}]});
    const {root,dom,table}=fixture(v); table.focus();
    assert.equal(dom.window.document.activeElement,root.querySelectorAll('#hand button')[1]);
    assert.deepEqual([...root.querySelectorAll('#hand button')].map(b=>b.textContent?.split(',')[0]),v.hand.map(c=>cardName(c)));
  }
  const source=readFileSync('web/render.ts','utf8');
  assert.doesNotMatch(source,/createBot|DecisionPolicy|strong|expert|\.sort\(/);
});
