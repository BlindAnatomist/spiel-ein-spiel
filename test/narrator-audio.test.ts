import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import { createNarratorAudio } from '../web/narrator-audio.ts';
import type { NarratorMedia } from '../web/narrator-audio.ts';
import type { NarrationManifest, NarrationMessage, NarrationOutput } from '../web/narration-types.ts';
import { createAnnouncer } from '../web/announcer.ts';
import { createController, FOCUS_GUARD_MS } from '../web/controller.ts';
import { createSession } from '../web/session.ts';
import { createTable } from '../web/render.ts';
import { createBot } from '../src/bots/index.ts';
import { cardClip, narrationEvents, handStartNarration } from '../web/presentation.ts';
import { selectSeatNames } from '../src/bots/profiles.ts';

const flush = () => new Promise<void>(resolve => setImmediate(resolve));
class Media extends EventTarget implements NarratorMedia {
  private source = '';
  preload = '';
  currentTime = 0;
  ended = false;
  error: { code: number } | null = null;
  plays: string[] = [];
  pauses = 0;
  nextPlay: (() => Promise<void>) | undefined;
  get src() { return this.source; }
  set src(value: string) { this.source = value; this.ended = false; this.error = null; }
  play() { this.plays.push(this.src); return this.nextPlay?.() ?? Promise.resolve(); }
  pause() { this.pauses++; }
  end() { this.ended = true; this.dispatchEvent(new Event('ended')); }
  fail() { this.error = {code: 3}; this.dispatchEvent(new Event('error')); }
}
const manifest: NarrationManifest = Object.fromEntries(['actor.val', 'prefix.val.plays', 'card.hearts.9', 'event.takes-trick', 'character.val-takes-trick'].map(id => [id, {id,url:`audio/${id}.mp3`,text:id,status:'ready',durationSeconds:1,sha256:'test',bytes:100}]));
const message: NarrationMessage = {text:'Val plays nine of hearts.',clips:['prefix.val.plays','card.hearts.9']};
function harness(enabled = true) {
  const media = new Media(); const captions: string[] = [];
  const timers: {run:()=>void;ms:number;cleared:boolean}[] = [];
  const output = createNarratorAudio(manifest, {enabled,media:()=>media,caption:text=>captions.push(text),timeout:(run,ms)=>{const t={run,ms,cleared:false};timers.push(t);return()=>{t.cleared=true;};}});
  return {media,captions,timers,output};
}

test('audio is off until explicitly selected and does not allocate or autoplay at construction', async () => {
  let allocations=0;
  const output=createNarratorAudio(manifest,{media:()=>{allocations++;return new Media();}});
  assert.equal(allocations,0);output.prime();assert.equal(allocations,0);
  assert.equal(await output.play(message),'fallback');assert.equal(allocations,0);
});
test('the actual ended event serializes every factual unit; no duration completion guess', async () => {
  const h=harness();let completed=false;
  const task=h.output.play(message).then(value=>{completed=true;return value;});
  assert.deepEqual(h.media.plays,['audio/prefix.val.plays.mp3']);
  await flush();assert.equal(completed,false);
  h.media.end();await flush();assert.deepEqual(h.media.plays,['audio/prefix.val.plays.mp3','audio/card.hearts.9.mp3']);
  assert.equal(completed,false);h.media.end();assert.equal(await task,'ended');
  assert.equal(h.captions.at(-1),'');assert.ok(h.timers.every(t=>t.cleared));
});
test('missing or unready fragments fall back the whole fact before any audio starts', async () => {
  for(const clips of [['actor.val','missing'],[],['https://bad.example/secret']]) {
    const h=harness();assert.equal(await h.output.play({...message,clips}),'fallback');assert.equal(h.media.plays.length,0);
  }
});
test('current media error, rejected play, thrown factory and watchdog all report fallback', async () => {
  const bad=harness();const p=bad.output.play(message);bad.media.fail();assert.equal(await p,'fallback');assert.ok(bad.media.pauses>0);
  const denied=harness();denied.media.nextPlay=()=>Promise.reject(Error('NotAllowedError'));assert.equal(await denied.output.play(message),'fallback');
  const missing=createNarratorAudio(manifest,{enabled:true,media:()=>{throw Error('no audio');}});assert.equal(await missing.play(message),'fallback');
  const stalled=harness();const s=stalled.output.play(message);assert.ok(stalled.timers[0]!.ms>=8000);stalled.timers[0]!.run();assert.equal(await s,'fallback');
});
test('stop cancels current audio, resolves promises and ignores stale promise, timer and media events', async () => {
  const h=harness();let reject!: (e:Error)=>void;
  h.media.nextPlay=()=>new Promise((_resolve,r)=>{reject=r;});
  const first=h.output.play(message);const oldTimer=h.timers[0]!;h.output.cancel();assert.equal(await first,'cancelled');
  h.media.nextPlay=undefined;const next=h.output.play(message);
  reject(Error('old rejected promise'));oldTimer.run();h.media.dispatchEvent(new Event('ended'));h.media.dispatchEvent(new Event('error'));
  await flush();assert.equal(h.media.plays.length,2);
  h.media.end();await flush();assert.equal(h.media.plays.length,3);h.media.end();assert.equal(await next,'ended');
});
test('changing mode cancels immediately and never starts the remainder of an old event', async () => {
  const h=harness();const p=h.output.play(message);h.output.setEnabled(false);assert.equal(await p,'cancelled');
  h.media.end();await flush();assert.equal(h.media.plays.length,1);assert.equal(await h.output.play(message),'fallback');
});
test('gesture priming uses the same element and finishes before the first spoken event', async () => {
  const h=harness();h.output.prime();assert.match(h.media.plays[0]!,/^data:audio\/wav/);
  h.output.prime();const p=h.output.play(message);assert.equal(h.media.plays.length,1);
  h.media.end();await flush();assert.equal(h.media.plays[1],'audio/prefix.val.plays.mp3');
  h.media.end();await flush();h.media.end();assert.equal(await p,'ended');h.output.prime();assert.equal(h.media.plays.length,3);
});
test('cancelling priming cannot resurrect narration; a later gesture can prime again', async () => {
  const h=harness();h.output.prime();const p=h.output.play(message);h.output.cancel();assert.equal(await p,'cancelled');
  await flush();h.output.prime();assert.equal(h.media.plays.length,2);h.output.cancel();
});
test('at most one eligible character aside per hand, with exact public alternatives', async () => {
  const h=harness();const win={text:'Val takes the trick.',clips:['actor.val','event.takes-trick'],character:{clip:'character.val-takes-trick',text:"Val wins the trick. Totally saw that comin'."}};
  h.output.beginHand!(1);const a=h.output.play(win);h.media.end();assert.equal(await a,'ended');assert.equal(h.media.plays[0],'audio/character.val-takes-trick.mp3');
  const b=h.output.play(win);assert.equal(h.media.plays[1],'audio/actor.val.mp3');h.media.end();await flush();h.media.end();assert.equal(await b,'ended');
  h.output.beginHand!(2);const c=h.output.play(win);assert.equal(h.media.plays.at(-1),'audio/character.val-takes-trick.mp3');h.media.end();await c;
});
test('successful audio never enters the live region; failed audio stops before one original fallback', async () => {
  const h=harness();const live:string[]=[];const waits:Array<()=>void>=[];
  const speech=createAnnouncer(t=>live.push(t),()=>new Promise<void>(r=>waits.push(r)),h.output);
  const a=speech.say(message);h.media.end();await flush();h.media.end();await a;assert.deepEqual(live,[]);
  const b=speech.say(message);h.media.fail();await flush();assert.deepEqual(live,[message.text]);assert.ok(h.media.pauses>=3);
  waits.shift()!();await b;assert.deepEqual(live,[message.text,'']);
});
test('review requests share the queue and use the original writer after audio finishes', async () => {
  const h=harness();const live:string[]=[];const waits:Array<()=>void>=[];
  const speech=createAnnouncer(t=>live.push(t),()=>new Promise<void>(r=>waits.push(r)),h.output);
  const a=speech.say(message);const stale=speech.say('Old review.',true);const newest=speech.say('Current public review.',true);
  h.media.end();await flush();h.media.end();await a;await flush();assert.deepEqual(live,['Current public review.']);
  speech.cancelReviews();await Promise.all([stale,newest]);assert.equal(live.at(-1),'');speech.stop();
});
test('all bower clip identifiers encode actual printed card and effective-suit variant', () => {
  for(const [trump,left] of [['hearts','diamonds'],['diamonds','hearts'],['clubs','spades'],['spades','clubs']] as const) {
    assert.equal(cardClip(`${left}:J`,trump),`bower.left.${left}`);
    assert.equal(cardClip(`${trump}:J`,trump),`bower.right.${trump}`);
    assert.equal(cardClip(`${left}:Q`,trump),`card.${left}.q`);
  }
});
test('a private discard identity never appears in typed clip IDs or public caption', () => {
  const v=createSession(7,'casual').view();
  const n=narrationEvents(v,v,3,{type:'discard',card:'spades:A'});
  assert.deepEqual(n,[{text:'East discards a card.',clips:['actor.east','event.discards']}]);
});
test('automatic focus waits for audio completion then the existing 1150 ms quiet guard', async () => {
  const v={...createSession(17,'strong',{dealer:3}).view(),phase:'playing' as const,trump:'hearts' as const,turn:0 as const};
  const h=harness();const waits:{ms:number;resolve:()=>void}[]=[];let focus=0;
  const table={render:()=>{},park:()=>{},focus:()=>{focus++;}};
  const session={view:()=>v,human:()=>({view:v,messages:[message.text],narration:[message]}),bot:()=>null,nextHand:()=>v};
  const controller=createController(session,table,()=>assert.fail('successful event must not reach ARIA'),ms=>new Promise<void>(resolve=>waits.push({ms,resolve})),()=>{},undefined,'voiceover',h.output);
  const p=controller.act({type:'play',card:'hearts:9'});assert.equal(focus,0);assert.equal(waits.length,0);
  h.media.end();await flush();assert.equal(waits.length,0);h.media.end();await flush();assert.equal(waits[0]!.ms,FOCUS_GUARD_MS);assert.equal(focus,0);
  waits.shift()!.resolve();await p;assert.equal(focus,1);
});
test('pause cancels active event, keeps game state and native cards, resume does not replay stale event', async () => {
  const session=createSession(17,'strong',{dealer:3});const dom=new JSDOM('<main></main>');const root=dom.window.document.querySelector('main')!;
  const table=createTable(root,{act:()=>{},next:()=>{}});const h=harness();
  const first=handStartNarration(session.view());
  const full: NarrationManifest={...manifest,...Object.fromEntries(first.flatMap(m=>m.clips).map(id=>[id,{id,url:`audio/${id}.mp3`,text:id,status:'ready',durationSeconds:1,sha256:'test',bytes:100}]))};
  const output=createNarratorAudio(full,{enabled:true,media:()=>h.media,timeout:()=>()=>{}});
  const live:string[]=[];const controller=createController(session,table,t=>live.push(t),async()=>{},()=>{},undefined,'voiceover',output);
  const start=controller.start();const before=structuredClone(session.view());const cards=[...root.querySelectorAll('#hand button')];
  controller.pause();await start;assert.deepEqual(session.view(),before);assert.deepEqual([...root.querySelectorAll('#hand button')],cards);assert.equal(controller.isPaused(),true);
  await controller.resume();assert.equal(controller.isPaused(),false);assert.deepEqual(session.view(),before);assert.equal(h.media.plays.length,1);assert.ok(live.some(t=>t.startsWith('Suit not called yet.')));
});
test('recorded output and original output play identical complete games and focus at every human boundary', async () => {
  for(const level of ['casual','strong','expert','mixed'] as const) {
    const seed=92;const names=selectSeatNames(level,seed);const a=createSession(seed,level,{seatNames:names,opponentMode:'varied'});const b=createSession(seed,level,{seatNames:names,opponentMode:'varied'});const policy=createBot('strong');
    const spoken:NarrationMessage[]=[];const output:NarrationOutput={enabled:()=>true,cancel:()=>{},play:async m=>{spoken.push(m);return 'ended';}};
    const setup=(session:typeof a,out?:NarrationOutput)=>{const dom=new JSDOM('<main></main>');const root=dom.window.document.querySelector('main')!;const table=createTable(root,{act:()=>{},next:()=>{}},names);return {dom,root,c:createController(session,table,()=>{},async()=>{},()=>{},names,'voiceover',out)};};
    const left=setup(a);const right=setup(b,output);await left.c.start();await right.c.start();
    for(let step=0;step<1200;step++) {
      assert.deepEqual(a.view(),b.view());assert.equal(left.root.innerHTML,right.root.innerHTML);assert.equal(left.dom.window.document.activeElement?.outerHTML,right.dom.window.document.activeElement?.outerHTML);
      if(a.view().phase==='game-over')break;
      if(a.view().phase==='hand-over'){await left.c.next();await right.c.next();}else{const act=policy(a.view());await left.c.act(act);await right.c.act(act);}
    }
    assert.equal(a.view().phase,'game-over');assert.ok(spoken.length>50);assert.ok(spoken.some(m=>m.clips.some(c=>c.startsWith('prefix.'))));
  }
});
test('resuming an interrupted final trick announces the result through focus only', async () => {
  const v={...createSession(17,'strong',{dealer:3}).view(),phase:'hand-over' as const,turn:null,result:{team:0 as const,points:1,makerTricks:3,reason:'made' as const}};
  const h=harness();const live:string[]=[];let focused=0;
  const table={render:()=>{},park:()=>{},focus:()=>{focused++;}};
  const session={view:()=>v,human:()=>({view:v,messages:[message.text],narration:[message]}),bot:()=>null,nextHand:()=>v};
  const controller=createController(session,table,t=>live.push(t),async()=>{},()=>{},undefined,'voiceover',h.output);
  const action=controller.act({type:'play',card:'hearts:9'});controller.pause();await action;
  assert.equal(focused,0);await controller.resume();assert.equal(focused,1);assert.deepEqual(live,[]);
});
test('resuming an already-settled turn does not park focus on a misleading progress heading', async () => {
  const session=createSession(17,'strong',{dealer:3});const dom=new JSDOM('<button id="resume">Resume game</button><main></main>');
  const d=dom.window.document;const root=d.querySelector('main')!;const table=createTable(root,{act:()=>{},next:()=>{}});
  const controller=createController(session,table,()=>{},async()=>{});await controller.start();
  const before=structuredClone(session.view());controller.pause();const resume=d.querySelector<HTMLButtonElement>('#resume')!;resume.focus();await controller.resume();
  assert.equal(d.activeElement,resume);assert.deepEqual(session.view(),before);assert.ok(root.querySelector('#bids button[aria-disabled="false"]'));
});
test('private preview makes no performance network requests and namespaces its local history', async () => {
  const output=await build({entryPoints:['web/main.ts'],bundle:true,write:false,format:'esm',target:'safari16',define:{__BUILD_COMMIT__:JSON.stringify('test'),__DEPLOY_CONTEXT__:JSON.stringify('narrator-preview')}});
  const dom=new JSDOM(readFileSync('web/index.html','utf8'),{runScripts:'outside-only',url:'https://preview.example/'});
  dom.window.structuredClone=structuredClone;let requests=0;
  dom.window.fetch=async()=>{requests++;throw Error('unexpected network');};
  dom.window.setTimeout=((callback:()=>void)=>{queueMicrotask(callback);return 1;}) as typeof dom.window.setTimeout;
  dom.window.eval(output.outputFiles[0]!.text);const d=dom.window.document;
  d.querySelector<HTMLButtonElement>('#performance-analysis')!.click();await flush();
  assert.equal(requests,0);assert.match(d.querySelector('#performance-output')!.textContent!,/preview keeps performance on this device only/);
  assert.ok(Object.keys(dom.window.localStorage).every(k=>k.startsWith('narrator-preview:')));
  assert.equal(d.querySelector<HTMLElement>('#preview-notice')!.hidden,false);dom.window.close();
});
