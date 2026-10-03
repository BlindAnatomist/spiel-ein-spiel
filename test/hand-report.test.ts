import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandReportStore, createHandReportRecorder, handReportText, HAND_REPORT_KEY, HAND_REPORT_EVENT_LIMIT } from '../web/hand-report.ts';
import { createSession } from '../web/session.ts';
import { createController } from '../web/controller.ts';
import { createBot } from '../src/bots/index.ts';
import { names, narrationEvents } from '../web/presentation.ts';
import { narrationAssets } from '../web/narrator-assets.ts';
import { createNarratorAudio } from '../web/narrator-audio.ts';
import { createNarratorFlavorHistory } from '../web/narrator-flavor.ts';
import { initialState } from '../src/internal/deal.ts';
import { playerView } from '../src/internal/view.ts';
import { transition } from '../src/internal/reducer.ts';
import type { Action, Card, Seat } from '../src/index.ts';
const memory = () => { const data = new Map<string,string>(); return {data,getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{data.set(key,value);}}; };
const table = {render:()=>{},park:()=>{},focus:()=>{}};
const identity = (gameId='test-game') => ({gameId,buildCommit:'report-build',catalogSha:'test-catalog',seatNames:names});

test('incremental public checkpoints survive a new controller/store, next deal and a new game without exposing private state', async () => {
  const storage=memory();let writes=0;const store=createHandReportStore({...storage,setItem:(k,v)=>{writes++;storage.setItem(k,v);}});
  const session=createSession(76,'strong');
  const recorder=createHandReportRecorder(store,identity(),narrationAssets);
  const controller=createController(session,table,recorder.liveText,async()=>{},undefined,names,'visual',undefined,recorder.observe);
  await controller.start();
  const bot=createBot('strong');
  while (!session.view().result) await controller.act(bot(session.view()));
  const completed=store.reports()[0]!;
  assert.equal(completed.status,'completed');assert.equal(completed.state.completedTricks.length,5);assert.ok(writes>20);
  const raw=storage.getItem(HAND_REPORT_KEY)!;
  const prohibited=new Set(['hand','hands','legalActions','deck','seed','rngState','randomWord','kitty','knownVoids']);
  const inspect=(v:unknown):void=>{if(v && typeof v==='object'){for(const [key,value] of Object.entries(v)){assert.ok(!prohibited.has(key),key);inspect(value);}}};inspect(JSON.parse(raw));
  assert.deepEqual(createHandReportStore(storage).reports()[0],completed);
  await controller.next();
  assert.ok(store.reports().some(r=>r.id===completed.id && r.state.completedTricks.length===5));
  controller.stop();
  const reopened=createHandReportStore(storage);
  const fresh=createSession(76,'strong');const freshRecorder=createHandReportRecorder(reopened,identity('new-game'),narrationAssets);
  const newController=createController(fresh,table,()=>{},async()=>{},undefined,names,'visual',undefined,freshRecorder.observe);
  await newController.start();
  assert.ok(reopened.reports().some(r=>r.id===completed.id));
  assert.ok(createHandReportStore(storage).reports().some(r=>r.id===completed.id));
  newController.stop();
});

test('checkpoint precedes first wait and remains public in bidding, pickup/discard and unfinished play', async () => {
  const storage=memory(),store=createHandReportStore(storage),session=createSession(7,'strong');
  const recorder=createHandReportRecorder(store,identity(),{});
  let release:()=>void=()=>{};
  const controller=createController(session,table,()=>{},()=>new Promise<void>(resolve=>{release=resolve;}),undefined,names,'voiceover',undefined,recorder.observe);
  const started=controller.start();
  assert.ok(storage.getItem(HAND_REPORT_KEY));
  assert.equal(store.reports()[0]!.state.handNumber,1);
  assert.ok(!('hand' in store.reports()[0]!.state));
  controller.pause();release();await started;
  assert.equal(createHandReportStore(storage).reports()[0]!.control,'paused');
});

test('retention keeps eight played hands plus one unplayed hand, and late old events do not reorder newer hands', () => {
  const storage=memory(),store=createHandReportStore(storage),base=createSession(1,'strong').view();
  const recorder=createHandReportRecorder(store,identity(),{});
  for(let handNumber=1;handNumber<=12;handNumber++) recorder.observe({kind:'checkpoint',view:{...base,handNumber,trick:[{seat:0,card:'hearts:J'}]},pacing:'visual',audioEnabled:false});
  recorder.observe({kind:'checkpoint',view:{...base,handNumber:13},pacing:'visual',audioEnabled:false});
  assert.deepEqual(store.reports().map(r=>r.state.handNumber),[13,12,11,10,9,8,7,6,5]);
  const old=createHandReportRecorder(store,identity('old'),{});old.observe({kind:'checkpoint',view:{...base,trick:[{seat:0,card:'clubs:9'}]},pacing:'visual',audioEnabled:false});
  const newest=createHandReportRecorder(store,identity('newest'),{});newest.observe({kind:'checkpoint',view:base,pacing:'visual',audioEnabled:false});
  old.diagnostic({eventId:1,timeMs:1,fact:'public',requestedWhole:undefined,clips:[],outcome:'cancelled'});
  assert.equal(store.reports()[0]!.gameId,'newest');
  for(let i=0;i<HAND_REPORT_EVENT_LIMIT+10;i++) newest.liveText('Public state.');
  const capped=store.reports()[0]!;assert.equal(capped.events.length,HAND_REPORT_EVENT_LIMIT);assert.ok(capped.discardedEvents>0);
  assert.deepEqual(createHandReportStore(storage).reports()[0],capped);
});

test('blocked, quota, silent write failure, corrupt and unknown-version storage are truthful and never discard unreadable data', () => {
  const base=createSession(1,'strong').view();
  const capture=(store:ReturnType<typeof createHandReportStore>)=>createHandReportRecorder(store,identity(),{}).observe({kind:'checkpoint',view:base,pacing:'visual',audioEnabled:false});
  for(const mode of ['blocked','quota','silent'] as const) {
    const store=createHandReportStore({getItem:()=>{if(mode==='blocked')throw Error('SecurityError');return null;},setItem:()=>{if(mode!=='silent')throw Error('QuotaExceededError');}});
    capture(store);assert.equal(store.reports().length,1);assert.match(store.persistence(),/could not be (saved|read)/);
  }
  for(const raw of ['{broken',JSON.stringify({version:2,reports:[]}),JSON.stringify({version:1,reports:[{hand:['secret']}]}),JSON.stringify({version:1,reports:[],extra:'unexpected'})]) {
    const storage=memory();storage.setItem(HAND_REPORT_KEY,raw);const store=createHandReportStore(storage);capture(store);
    assert.equal(storage.getItem(HAND_REPORT_KEY),raw);assert.match(store.persistence(),/left untouched/);assert.equal(store.reports().length,1);
  }
  const storage=memory();let fail=true;const store=createHandReportStore({...storage,setItem:(k,v)=>{if(fail)throw Error('quota');storage.setItem(k,v);}});
  capture(store);fail=false;capture(store);assert.match(store.persistence(),/Latest report changes saved/);
});

test('right bowers beat off-suit aces; persisted engine winners and selected recording references agree in every suit pair', async () => {
  for(const trump of ['clubs','diamonds','hearts','spades'] as const) for(const other of ['clubs','diamonds','hearts','spades'] as const) {
    if(trump===other)continue;
    const seatNames=['You','Wes','Val','Emma'] as const;
    let state=initialState(42);state.phase='playing';state.trump=trump;state.caller=0;state.turn=0;state.trick=[];state.completedTricks=[];
    state.hands=[[`${trump}:J`],[`${other}:A`],[`${other}:9`],[`${other}:10`]] as Card[][];
    let eventId=0;const view=()=>playerView(state,0);
    const apply=(actor:Seat,action:Action)=>{const before=view(),next=transition(state,actor,action);assert.ok(next);state=next;const after=view(),narration=narrationEvents(before,after,actor,action,seatNames);return {view:after,messages:narration.map(m=>m.text),narration,progress:{eventId:++eventId,handNumber:1,completedTricks:after.completedTricks.length,handComplete:false}};};
    const session={view,human:(a:Action)=>apply(0,a),bot:()=>apply(state.turn!,{type:'play',card:state.hands[state.turn!]![0]!}),nextHand:()=>assert.fail('No redeal')};
    const storage=memory(),store=createHandReportStore(storage),recorder=createHandReportRecorder(store,{...identity(),seatNames},narrationAssets);
    class Media extends EventTarget {src='';preload='';currentTime=0;ended=false;error=null;readyState=4;paused=true;get currentSrc(){return this.src;}play(){this.ended=false;this.paused=false;queueMicrotask(()=>{this.dispatchEvent(new Event('playing'));this.ended=true;this.dispatchEvent(new Event('ended'));});return Promise.resolve();}pause(){this.paused=true;}}
    const output=createNarratorAudio(narrationAssets,{enabled:true,wholeOnly:true,media:()=>new Media(),flavorHistory:createNarratorFlavorHistory(()=>0.99),timeout:()=>()=>{},diagnostic:recorder.diagnostic});
    const controller=createController(session,table,recorder.liveText,async()=>{},undefined,seatNames,'voiceover',output,recorder.observe);
    await controller.start();await controller.act({type:'play',card:`${trump}:J`});
    const report=createHandReportStore(storage).reports()[0]!;
    assert.equal(report.state.completedTricks[0]!.winner,0);
    assert.deepEqual(report.state.completedTricks[0]!.plays.map(p=>p.card),[`${trump}:J`,`${other}:A`,`${other}:9`,`${other}:10`]);
    const selected=report.events.filter(e=>e.kind==='audio-selected');
    const winner=selected.find(e=>e.detail.startsWith('You take the trick.'));assert.ok(winner);assert.equal(winner.clips.length,1);
    assert.ok(['full.trick.you','flavor.you-trick-keep-it'].includes(winner.clips[0]!.id));assert.equal(winner.clips[0]!.sha256,narrationAssets[winner.clips[0]!.id]!.sha256);
    const ended=report.events.find(e=>e.kind==='audio-ended' && e.audioEventId===winner.audioEventId);assert.ok(ended);assert.equal(ended.checkpoint,winner.checkpoint);
    assert.ok(report.events.some(e=>e.sequence===winner.checkpoint && e.state?.completedTricks[0]?.winner===0));
    const text=handReportText(report,store.persistence());assert.match(text,/not proof of audible speech/);assert.match(text,/Engine winner: You \(seat 0\)/);
    controller.stop();
  }
});

test('report observer failure cannot stop controller play', async () => {
  const session=createSession(2,'strong');const controller=createController(session,table,()=>{},async()=>{},undefined,names,'visual',undefined,()=>{throw Error('diagnostic failure');});
  await controller.start();assert.equal(session.view().turn,0);await controller.act(session.view().legalActions[0]!);assert.ok(session.view().bids.length);controller.stop();
});

test('two open copies merge played hands; an older active unplayed hand can promote after retention', () => {
  const storage=memory(),a=createHandReportStore(storage),b=createHandReportStore(storage),base=createSession(4,'strong').view();
  let time=0;const now=()=>new Date(1000+time++).toISOString();
  const ar=createHandReportRecorder(a,identity('a'),{},now),br=createHandReportRecorder(b,identity('b'),{},now);
  const checkpoint=(recorder:ReturnType<typeof createHandReportRecorder>,played=false)=>recorder.observe({kind:'checkpoint',view:{...base,trick:played?[{seat:0,card:'hearts:J'}]:[]},pacing:'visual',audioEnabled:false});
  checkpoint(ar);checkpoint(br);checkpoint(ar); // A's older unplayed hand is displaced.
  checkpoint(ar,true);checkpoint(br,true);
  assert.deepEqual(new Set(createHandReportStore(storage).reports().map(r=>r.gameId)),new Set(['a','b']));
  const old=createHandReportRecorder(a,identity('old'),{},now);checkpoint(old);
  const fresh=createHandReportRecorder(a,identity('fresh'),{},now);checkpoint(fresh);
  old.diagnostic({eventId:1,timeMs:1,fact:'old public fact',requestedWhole:undefined,clips:[],outcome:'cancelled'});
  assert.equal(a.reports().find(r=>!r.state.trick.length)?.gameId,'fresh');
});

test('a failed startup read never overwrites unseen reports and later incompatible storage blocks writes', () => {
  const storage=memory(),base=createSession(4,'strong').view();storage.setItem(HAND_REPORT_KEY,JSON.stringify({version:1,reports:[]}));
  let denied=true;let writes=0;const store=createHandReportStore({getItem:k=>{if(denied)throw Error('blocked');return storage.getItem(k);},setItem:(k,v)=>{writes++;storage.setItem(k,v);}});
  denied=false;const recorder=createHandReportRecorder(store,identity(),{});recorder.observe({kind:'checkpoint',view:base,pacing:'visual',audioEnabled:false});assert.equal(writes,0);assert.match(store.persistence(),/left untouched/);
  const readable=createHandReportStore(storage);storage.setItem(HAND_REPORT_KEY,'{"version":99,"reports":[]}');createHandReportRecorder(readable,identity(),{}).observe({kind:'checkpoint',view:base,pacing:'visual',audioEnabled:false});assert.equal(storage.getItem(HAND_REPORT_KEY),'{"version":99,"reports":[]}');assert.match(readable.persistence(),/unsupported version/);
});
