import test from 'node:test';
import assert from 'node:assert/strict';
import { createAnnouncer } from '../web/announcer.ts';
import { createNarratorAudio, type NarratorMedia } from '../web/narrator-audio.ts';
import { createController, FOCUS_GUARD_MS } from '../web/controller.ts';
import { createSession } from '../web/session.ts';
import type { NarrationMessage, NarrationManifest, NarrationOutput, PlaybackResult } from '../web/narration-types.ts';
import type { PlayerView } from '../src/index.ts';
const flush = () => new Promise<void>(resolve => setImmediate(resolve));
const reaction: NarrationMessage = {optional:true,text:'',clips:[],alternatives:[{clip:'reaction.review',text:'One complete optional reaction.',family:'review'}]};
const manifest: NarrationManifest = {'reaction.review':{id:'reaction.review',text:'One complete optional reaction.',url:'audio/reaction.review.mp3',status:'ready',durationSeconds:1,sha256:'review',bytes:100}};
class Media extends EventTarget implements NarratorMedia {
  src='';preload='';currentTime=0;ended=false;error=null;plays:string[]=[];
  play(){this.ended=false;this.plays.push(this.src);return Promise.resolve();}
  pause(){}
  end(){this.ended=true;this.dispatchEvent(new Event('ended'));}
}
function recording() { const media=new Media();const output=createNarratorAudio(manifest,{enabled:true,media:()=>media,timeout:()=>()=>{}});return {media,output}; }
const playing = ():PlayerView => ({...createSession(17,'strong',{dealer:3}).view(),phase:'playing',turn:0,trump:'hearts',hand:['hearts:A'],legalActions:[{type:'play',card:'hearts:A'}]});
test('review: a requested summary during activation guard drops the pending reaction',async()=>{
  const view=playing(),waits:Array<{ms:number;resolve:()=>void}>=[],played:NarrationMessage[]=[];
  const output:NarrationOutput={enabled:()=>true,canReact:()=>true,cancel:()=>{},play:async message=>{played.push(message);return 'ended';}};
  const session={view:()=>view,human:()=>({view,messages:[],narration:[],reaction}),bot:()=>null,nextHand:()=>view};
  const c=createController(session,{render:()=>{},park:()=>{},focus:()=>{}},()=>{},ms=>new Promise<void>(resolve=>waits.push({ms,resolve})),()=>{},undefined,'voiceover',output);
  const action=c.act(view.legalActions[0]!);assert.equal(waits[0]!.ms,FOCUS_GUARD_MS);const review=c.repeat();
  const summary=waits.find(wait=>wait.ms!==FOCUS_GUARD_MS);assert.ok(summary);summary.resolve();await review;
  waits[0]!.resolve();await flush();const optionalCount=played.filter(message=>message.optional).length;
  for(const wait of waits)wait.resolve();await action;c.stop();assert.equal(optionalCount,0);
});
test('review: summary during optional sentence gap cancels before media starts',async()=>{
  const waits:Array<{ms:number;resolve:()=>void}>=[],played:NarrationMessage[]=[],written:string[]=[];
  const output:NarrationOutput={enabled:()=>true,canReact:()=>true,cancel:()=>{},play:async message=>{played.push(message);return 'ended';}};
  const speech=createAnnouncer(text=>written.push(text),ms=>new Promise<void>(resolve=>waits.push({ms,resolve})),output);
  const pending=speech.say({...reaction,gapMs:300});await flush();assert.equal(waits[0]!.ms,300);
  const review=speech.say('Current state.',true);await flush();assert.equal(played.length,0);
  for(const wait of waits)wait.resolve();await Promise.all([pending,review]);assert.deepEqual(written,['Current state.','']);speech.stop();
});
test('review: failed or missing optional audio never enters VoiceOver fallback',async()=>{
  for(const result of ['fallback','skipped'] as const){const written:string[]=[];const output:NarrationOutput={enabled:()=>true,canReact:()=>true,cancel:()=>{},play:async()=>result};
    const speech=createAnnouncer(text=>written.push(text),async()=>{},output);await speech.say(reaction);assert.deepEqual(written,[]);speech.stop();}
});
test('review: switching to Original cancels active reaction and ignores late media completion',async()=>{
  const {media,output}=recording(),written:string[]=[];const speech=createAnnouncer(text=>written.push(text),async()=>{},output);
  const pending=speech.say(reaction);await flush();assert.equal(media.plays.length,1);output.setEnabled(false);await pending;
  media.end();await speech.say(reaction);assert.equal(media.plays.length,1);assert.deepEqual(written,[]);speech.stop();
});
test('review: pause cancels an active reaction and resume does not replay it',async()=>{
  const {media,output}=recording(),view=playing();
  const session={view:()=>view,human:()=>({view,messages:[],narration:[],reaction}),bot:()=>null,nextHand:()=>view};
  const c=createController(session,{render:()=>{},park:()=>{},focus:()=>{}},()=>{},async()=>{},()=>{},undefined,'voiceover',output);
  const pending=c.act(view.legalActions[0]!);await flush();assert.equal(media.plays.length,1);c.pause();await pending;media.end();await c.resume();
  assert.equal(media.plays.length,1);c.stop();
});
test('review: stopped old queue cannot play its delayed reaction into a replacement game',async()=>{
  const {media,output}=recording();let releaseOld:()=>void=()=>{};
  const old=createAnnouncer(()=>assert.fail('Unexpected old live speech'),()=>new Promise<void>(resolve=>{releaseOld=resolve;}),output);
  const abandoned=old.say({...reaction,gapMs:300});await flush();old.stop();
  const fresh=createAnnouncer(()=>assert.fail('Unexpected new live speech'),async()=>{},output);const next=fresh.say(reaction);await flush();
  assert.equal(media.plays.length,1);releaseOld();media.end();await Promise.all([abandoned,next]);assert.equal(media.plays.length,1);fresh.stop();
});
