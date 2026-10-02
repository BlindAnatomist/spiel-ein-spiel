import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { narrationAssets } from '../web/narrator-assets.ts';
import { createNarratorAudio, type NarratorMedia, type NarrationDiagnostic } from '../web/narrator-audio.ts';
import { createNarratorFlavorHistory } from '../web/narrator-flavor.ts';
import { createController, FOCUS_GUARD_MS } from '../web/controller.ts';
import { createSession } from '../web/session.ts';
import { selectSeatNames } from '../src/bots/profiles.ts';
import { createBot } from '../src/bots/index.ts';

const destination = process.argv[2];
if (!destination || !path.isAbsolute(destination)) throw new Error('Usage: node scripts/narrator-sequence-fixture.ts /absolute/output/directory');
if (Object.keys(narrationAssets).length !== 1953) throw new Error('The complete verified runtime must be imported before creating an audible sequence.');
const seed = 73, dealer = 2 as const;
const seatNames = selectSeatNames('strong', seed);
const session = createSession(seed, 'strong', {dealer, seatNames, opponentMode:'varied'});
const policy = createBot('strong');
let time = 0, randomWord = 20261002;
const flavorHistory = createNarratorFlavorHistory(() => {
  randomWord ^= randomWord << 13; randomWord ^= randomWord >>> 17; randomWord ^= randomWord << 5;
  return (randomWord >>> 0) / 4294967296;
});
flavorHistory.beginGame();
const diagnostics: NarrationDiagnostic[] = [];
const byUrl = new Map(Object.values(narrationAssets).map(clip => [clip.url, clip]));
class Media extends EventTarget implements NarratorMedia {
  src=''; currentSrc=''; preload=''; currentTime=0; ended=false; error=null;
  readyState=4; paused=true;
  play() {
    const clip=byUrl.get(this.src.split('?')[0]!);
    if (!clip) return Promise.reject(Error('Unknown complete recording'));
    this.currentSrc=this.src; this.paused=false; this.ended=false;
    this.dispatchEvent(new Event('playing'));
    return Promise.resolve().then(() => {
      time += clip.durationSeconds*1000; this.ended=true;
      this.dispatchEvent(new Event('ended'));
    });
  }
  pause() { this.paused=true; }
}
const output=createNarratorAudio(narrationAssets,{enabled:true,wholeOnly:true,flavorHistory,media:()=>new Media(),timeout:()=>()=>{},now:()=>time,diagnostic:event=>diagnostics.push(event)});
const original: string[]=[];
const controller=createController(session,{render:()=>{},park:()=>{},focus:()=>{}},text=>original.push(text),async ms=>{time+=ms;},()=>{},seatNames,'voiceover',output);
await controller.start();
for(let guard=0;session.view().completedTricks.length===0&&guard<100;guard++) {
  // A fixed decision interval only separates automatic segments; no human speech is fabricated.
  time+=750;
  await controller.act(policy(session.view()));
}
controller.stop();
const firstWinner=diagnostics.find(event=>event.outcome==='ended'&&event.requestedWhole?.startsWith('full.trick.'));
if (!firstWinner || original.some(Boolean) || diagnostics.some(event=>event.outcome==='fallback')) throw new Error('Fixture did not complete the first trick entirely with recordings');
let previousEnd=0;
const events=[];
for(const event of diagnostics.filter(event=>event.outcome==='ended'&&event.eventId<=firstWinner.eventId)) {
  if(event.clips.length!==1)throw new Error('Intra-sentence clip joining is forbidden');
  const clip=narrationAssets[event.clips[0]!]!;
  const source=path.resolve('web',clip.url); const bytes=await readFile(source);
  if(bytes.length!==clip.bytes||createHash('sha256').update(bytes).digest('hex')!==clip.sha256)throw new Error(`Unverified sequence recording ${clip.id}`);
  const playing=diagnostics.find(item=>item.eventId===event.eventId&&item.outcome==='media-playing');
  if(!playing)throw new Error('Missing playback start');
  events.push({eventId:event.eventId,eventKey:event.requestedWhole,fact:event.fact,clip:clip.id,spokenText:clip.text,relativeFile:clip.url,sha256:clip.sha256,durationSeconds:clip.durationSeconds,gapBeforeMs:events.length?Math.max(0,playing.timeMs-previousEnd):0});
  previousEnd=event.timeMs;
}
await mkdir(destination,{recursive:true});
await writeFile(path.join(destination,'sequence.json'),JSON.stringify({schemaVersion:1,gameSeed:seed,dealer,seatNames,flavorSeed:20261002,initialGuardOmittedMs:FOCUS_GUARD_MS,timingBasis:'Existing controller waits plus asset durations and a 750 ms human decision interval. Not a browser audio capture; native VoiceOver prompts are omitted.',events},null,2)+'\n');
console.log(`Selected ${events.length} complete recordings from the actual opening through the first trick.`);
