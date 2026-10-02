import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { createSession } from '../web/session.ts';
import { createController } from '../web/controller.ts';
import { createNarratorAudio, type NarratorMedia } from '../web/narrator-audio.ts';
import { createNarratorFlavorHistory } from '../web/narrator-flavor.ts';
import { narrationAssets } from '../web/narrator-assets.ts';
import { extraReactionLines } from '../web/narrator-extra-reactions.ts';
import { reactionLines } from '../web/narrator-reactions.ts';
import { narratorVariants } from '../web/narrator-variants.ts';
import { createBot } from '../src/bots/index.ts';
import { selectSeatNames } from '../src/bots/profiles.ts';
import type { Seat } from '../src/index.ts';

const destination=process.argv[2];if(!destination)throw new Error('Provide a report directory');
const randomSeed=Number(process.argv[3]??2171876889), humanLevel=process.argv[4]==='casual'?'casual':'strong';
let state=randomSeed;const random=()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return(state>>>0)/2**32;};
const history=createNarratorFlavorHistory(random),byUrl=new Map(Object.values(narrationAssets).map(c=>[c.url,c]));
for(const clip of Object.values(narrationAssets)){const bytes=await readFile(`web/${clip.url}`);if(bytes.length!==clip.bytes||createHash('sha256').update(bytes).digest('hex')!==clip.sha256)throw new Error(`Asset hash mismatch ${clip.id}`);}
const families:Record<string,string>={
 'whole.emma.passes':'mock-strategy','character.val-calls-hearts':'pretend-expertise','whole.walt.calls-spades-alone':'solo-drama','character.val-takes-trick':'pretend-expertise',
 ...Object.fromEntries([...Object.values(narratorVariants).flat(),...Object.values(reactionLines)].map(line=>[line.clip,line.family??line.clip])),
};
class Media extends EventTarget implements NarratorMedia {
 src='';currentSrc='';preload='';currentTime=0;ended=false;error=null;readyState=4;paused=true;
 play(){this.currentSrc=this.src;this.paused=false;this.ended=false;if(!byUrl.has(this.src.split('?')[0]!))return Promise.reject(Error('Missing real catalog asset'));this.dispatchEvent(new Event('playing'));queueMicrotask(()=>{this.ended=true;this.dispatchEvent(new Event('ended'));});return Promise.resolve();}
 pause(){this.paused=true;}
}
interface Row { clip:string;text:string;family:string|undefined;game:number;hand:number;trick:number;globalEvents:number;globalTricks:number;globalHands:number;character:boolean;fact:boolean }
const rows:Row[]=[],errors:unknown[]=[],games:Array<{game:number;level:string;seed:number;hands:number;remarks:number;newLines:number}>=[];
let actions=0,completeTricks=0,completeHands=0,openingFacts=0;const seen=new Set<string>();
const handCounts:number[]=[],availableByTrigger:Record<string,number>={};
for(const line of Object.values(extraReactionLines))availableByTrigger[line.trigger]=(availableByTrigger[line.trigger]??0)+1;
for(const level of ['casual','strong','expert','mixed'] as const)for(const seed of [17,73,92,318,400,711]){
 const game=games.length+1,names=selectSeatNames(level,seed);let hand=1,handRemarks=0,newLines=0,gameRemarks=0;
 const session=createSession(seed,level,{dealer:seed%4 as Seat,opponentMode:'varied',seatNames:names,observer:{decision(){actions++;}}});
 history.beginGame();openingFacts+=2;
 const audio=createNarratorAudio(narrationAssets,{enabled:true,wholeOnly:true,flavorHistory:history,media:()=>new Media(),timeout:()=>()=>{},diagnostic:d=>{
  if(d.outcome==='fallback')errors.push({game,...d});if(d.outcome!=='selected')return;
  if(d.clips.length!==1)errors.push({game,stitched:d.clips});
  const clip=d.clips[0]!,v=session.view(),text=narrationAssets[clip]!.text,character=Object.hasOwn(families,clip);
  rows.push({clip,text,family:families[clip],game,hand:v.handNumber,trick:v.completedTricks.length,globalEvents:actions+openingFacts,globalTricks:completeTricks+v.completedTricks.length,globalHands:completeHands+(v.result?1:0),character,fact:!!d.fact});
  if(character){handRemarks++;gameRemarks++;if(!seen.has(text)){newLines++;seen.add(text);}}
 }});
 const controller=createController(session,{render:()=>{},park:()=>{},focus:()=>{}},text=>{if(text)errors.push({game,unintendedLive:text});},async()=>{},()=>{},names,'voiceover',audio);
 const human=createBot(humanLevel);await controller.start();
 for(let guard=0;guard<1500;guard++){
  const v=session.view();if(v.result){completeHands++;completeTricks+=v.completedTricks.length;handCounts.push(handRemarks);if(v.phase==='game-over')break;hand++;handRemarks=0;openingFacts+=2;await controller.next();}
  else await controller.act(human(v));
 }
 if(session.view().phase!=='game-over')throw new Error('Simulation failed to complete');controller.stop();games.push({game,level,seed,hands:hand,remarks:gameRemarks,newLines});
}
const remarks=rows.filter(row=>row.character),prior=new Map<string,Row>(),priorFamily=new Map<string,Row>(),violations:unknown[]=[];
const normalized=(text:string)=>text.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
for(const row of remarks){
 const key=normalized(row.text),old=prior.get(key);if(old&&(row.game-old.game<=2||row.globalEvents-old.globalEvents<80||row.globalHands-old.globalHands<4))violations.push({type:'exact',previous:old,current:row});prior.set(key,row);
 const family=priorFamily.get(row.family!);if(family&&(row.globalTricks-family.globalTricks<4||row.globalEvents-family.globalEvents<12))violations.push({type:'family',previous:family,current:row});priorFamily.set(row.family!,row);
}
const gaps=remarks.slice(1).map((row,i)=>({tricks:row.globalTricks-remarks[i]!.globalTricks,events:row.globalEvents-remarks[i]!.globalEvents}));
const exposure=(items:Row[])=>({remarks:items.length,unique:new Set(items.map(row=>normalized(row.text))).size,fraction:items.length?new Set(items.map(row=>normalized(row.text))).size/items.length:0});
const counts=Object.fromEntries([...new Set(handCounts)].sort().map(count=>[count,handCounts.filter(n=>n===count).length]));
const result={basis:'Actual approved runtime catalog, real controller/session/history and metadata-driven fake media completion. No placeholder identities; not audible or device acceptance.',randomSeed,humanPolicy:humanLevel,runtimeAssets:Object.keys(narrationAssets).length,approvedNewChoices:Object.keys(extraReactionLines).length,catalogHashesVerified:true,games:games.length,hands:completeHands,actions,remarks:remarks.length,remarksPerHand:remarks.length/completeHands,handsByRemarkCount:counts,handsAtThreeOrFourFraction:handCounts.filter(n=>n===3||n===4).length/completeHands,maxPerHand:Math.max(...handCounts),minimumTrickGap:Math.min(...gaps.map(g=>g.tricks)),minimumPublicEventGap:Math.min(...gaps.map(g=>g.events)),exactAndFamilyViolations:violations,errors,gameExposure:Object.fromEntries([2,5,10,20,24].map(n=>[n,exposure(remarks.filter(row=>row.game<=n))])),remarkExposure:Object.fromEntries([75,180,350].map(n=>[n,exposure(remarks.slice(0,n))])),availableByTrigger,selectedByTrigger:Object.fromEntries(Object.keys(availableByTrigger).map(trigger=>[trigger,remarks.filter(row=>extraReactionLines[row.clip]?.trigger===trigger).length])),perGame:games};
await mkdir(destination,{recursive:true});await writeFile(path.join(destination,'summary.json'),JSON.stringify(result,null,2)+'\n');await writeFile(path.join(destination,'events.json'),JSON.stringify(rows,null,2)+'\n');console.log(JSON.stringify(result,null,2));
if(errors.length||violations.length||result.maxPerHand>4||result.minimumTrickGap<1||result.minimumPublicEventGap<6)process.exitCode=1;
