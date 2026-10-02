import test from 'node:test';
import assert from 'node:assert/strict';
import { completeEventContract } from '../scripts/narrator-complete-contract.ts';
import { wholeEventContract } from '../scripts/narrator-whole-contract.ts';
import { narrationEvents, handStartNarration } from '../web/presentation.ts';
import { createNarratorAudio } from '../web/narrator-audio.ts';
import type { NarratorMedia } from '../web/narrator-audio.ts';
import { createController } from '../web/controller.ts';
import { createSession } from '../web/session.ts';
import { createBot } from '../src/bots/index.ts';
import { OPPONENT_PROFILES, selectSeatNames } from '../src/bots/profiles.ts';
import type { Card, PlayerView } from '../src/index.ts';

test('the remaining1433 keys cover every card/bower verb and logistical public fact',()=>{
  const expected=completeEventContract();assert.equal(Object.keys(expected).length,1433);
  const found:Record<string,string>={};const base=createSession(7,'casual').view();
  const add=(messages:ReturnType<typeof narrationEvents>)=>messages.forEach(m=>{if(m.whole&&m.whole in expected)found[m.whole]=m.text;});
  const actors=['Val',...Object.values(OPPONENT_PROFILES).flatMap(p=>[p.westName,p.eastName])];
  const suits=['clubs','diamonds','hearts','spades'] as const;
  const cards=suits.flatMap(suit=>['9','10','J','Q','K','A'].map(rank=>`${suit}:${rank}` as Card));
  for(const actor of actors){
    const names=['You',actor,'Val','East'] as const;
    for(const card of cards)for(const trump of suits)for(const lead of [false,true]){
      const before:PlayerView={...base,phase:'playing',trump,trick:lead?[]:[{seat:2,card:'hearts:9'}]};
      add(narrationEvents(before,{...before,trick:[...before.trick,{seat:1,card}]},1,{type:'play',card},names));
    }
    add(handStartNarration({...base,dealer:1},names));
    add(narrationEvents(base,{...base,dealer:1,upCardStatus:'ordered'},0,{type:'order-up',alone:false},names));
    add(narrationEvents(base,base,1,{type:'discard',card:'diamonds:A'},names));
  }
  for(const card of cards)add(handStartNarration({...base,dealer:0,upCard:card}));
  add(narrationEvents(base,{...base,dealer:0,upCardStatus:'ordered'},0,{type:'order-up',alone:false}));
  assert.deepEqual(found,expected);
});

test('an entire actual named game selects exactly one complete recording for every automatic fact',async()=>{
  const facts={...wholeEventContract(),...completeEventContract(),'event.turned-down':'The up-card is turned down.'};
  assert.equal(Object.keys(facts).length,1813);
  const manifest=Object.fromEntries(Object.entries(facts).map(([id,text])=>[id,{id,text,url:`audio/${id}.mp3`,status:'ready',durationSeconds:1,sha256:'test',bytes:100}]));
  class Media extends EventTarget implements NarratorMedia {
    src='';preload='';currentTime=0;ended=false;error=null;plays:string[]=[];
    play(){this.ended=false;this.plays.push(this.src);queueMicrotask(()=>{this.ended=true;this.dispatchEvent(new Event('ended'));});return Promise.resolve();}
    pause(){}
  }
  const media=new Media();const selected:string[][]=[];
  const output=createNarratorAudio(manifest,{enabled:true,wholeOnly:true,media:()=>media,timeout:()=>()=>{},diagnostic:d=>{if(d.outcome==='selected')selected.push([...d.clips]);if(d.outcome==='fallback')assert.fail(d.reason);}});
  const names=selectSeatNames('mixed',831);const session=createSession(831,'mixed',{seatNames:names,opponentMode:'varied'});
  const c=createController(session,{render:()=>{},park:()=>{},focus:()=>{}},()=>assert.fail('Automatic fact entered VoiceOver fallback'),async()=>{},()=>{},names,'voiceover',output);
  const bot=createBot('strong');await c.start();
  for(let i=0;i<1500&&session.view().phase!=='game-over';i++){
    if(session.view().phase==='hand-over')await c.next();else await c.act(bot(session.view()));
  }
  assert.equal(session.view().phase,'game-over');assert.ok(selected.length>100);
  assert.equal(media.plays.length,selected.length);assert.ok(selected.every(ids=>ids.length===1));
});
