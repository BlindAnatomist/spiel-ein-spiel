import test from 'node:test';
import assert from 'node:assert/strict';
import { reactionFor, reactionLines, baseReactionLines } from '../web/narrator-reactions.ts';
import { createSession } from '../web/session.ts';
import type { Session } from '../web/session.ts';
import type { Action, PlayerView, Seat } from '../src/index.ts';
import type { NarrationMessage, NarrationOutput } from '../web/narration-types.ts';
import { createAnnouncer } from '../web/announcer.ts';
import { createController, FOCUS_GUARD_MS } from '../web/controller.ts';

const base:PlayerView={...createSession(17,'strong',{dealer:3}).view(),phase:'playing',turn:0,trump:'hearts',trick:[],completedTricks:[]};
const reaction:NarrationMessage={optional:true,text:'',clips:[],alternatives:[reactionLines['reaction.you.trump']!]};
const flush=()=>new Promise<void>(resolve=>setImmediate(resolve));
test('all twelve reaction contexts use only public actions, effective suits and completed tricks',()=>{
 const cases:Array<{id:string;actor:Seat;action:Action;before?:Partial<PlayerView>;after?:Partial<PlayerView>}>= [
  {id:'reaction.you.bower',actor:0,action:{type:'play',card:'diamonds:J'}},
  {id:'reaction.you.trump',actor:0,action:{type:'play',card:'hearts:A'}},
  {id:'reaction.you.low-lead',actor:0,action:{type:'play',card:'clubs:9'}},
  {id:'reaction.you.follow-suit',actor:0,action:{type:'play',card:'spades:Q'},before:{trick:[{seat:1,card:'spades:9'}]}},
  {id:'reaction.you.trick',actor:0,action:{type:'play',card:'clubs:A'},after:{completedTricks:[{plays:[],winner:0}]}},
  {id:'reaction.you.alone',actor:0,action:{type:'call',suit:'spades',alone:true}},
  {id:'reaction.opponent.low-lead',actor:1,action:{type:'play',card:'clubs:10'}},
  {id:'reaction.opponent.ace-lead',actor:3,action:{type:'play',card:'spades:A'}},
  {id:'reaction.opponent.right-bower',actor:1,action:{type:'play',card:'hearts:J'}},
  {id:'reaction.opponent.trick',actor:0,action:{type:'play',card:'clubs:9'},after:{completedTricks:[{plays:[],winner:3}]}},
  {id:'reaction.val.trick',actor:0,action:{type:'play',card:'clubs:9'},after:{completedTricks:[{plays:[],winner:2}]}},
  {id:'reaction.table.four-tricks',actor:3,action:{type:'play',card:'clubs:9'},before:{completedTricks:Array.from({length:3},()=>({plays:[],winner:1}))},after:{completedTricks:Array.from({length:4},()=>({plays:[],winner:1}))}},
 ];
 assert.equal(Object.keys(baseReactionLines).length,12);
 for(const c of cases){
  const before={...base,...c.before},after={...base,...c.after};const expected=reactionFor(before,after,c.actor,c.action);
  assert.ok(expected?.alternatives?.some(line=>line.clip===c.id),c.id);assert.equal(expected?.text,'');assert.deepEqual(expected?.clips,[]);
  assert.deepEqual(reactionFor({...before,hand:[...before.hand].reverse(),legalActions:[]},{...after,hand:[],legalActions:[]},c.actor,c.action),expected,'own cards and available moves must not influence commentary');
 }
 assert.equal(reactionFor(base,base,0,{type:'discard',card:'hearts:J'}),undefined);
 assert.equal(reactionFor(base,base,1,{type:'discard',card:'spades:A'}),undefined);
 const left=reactionFor(base,base,1,{type:'play',card:'diamonds:J'});assert.ok(!left?.alternatives?.some(a=>a.clip==='reaction.opponent.right-bower'));
});
test('an unavailable optional reaction adds no audio, live text or sentence gap',async()=>{
 const calls:string[]=[];const output:NarrationOutput={enabled:()=>true,cancel:()=>{},canReact:()=>false,play:async()=>{calls.push('audio');return 'ended';}};
 const a=createAnnouncer(text=>calls.push(text),async ms=>{calls.push(String(ms));},output);await a.say({...reaction,gapMs:300});assert.deepEqual(calls,[]);assert.equal(a.revision(),0);
});
test('a failed optional remark never replays a successful fact or enters VoiceOver',async()=>{
 const written:string[]=[];let calls=0;const output:NarrationOutput={enabled:()=>true,cancel:()=>{},canReact:()=>true,play:async message=>{calls++;return message.optional?'fallback':'ended';}};
 const a=createAnnouncer(t=>written.push(t),async()=>{},output);await a.say({text:'Val takes the trick.',clips:[],whole:'full.trick.val'});await a.say(reaction);assert.equal(calls,2);assert.deepEqual(written,[]);
});
test('review during the sentence gap cancels the optional recording',async()=>{
 const waits:Array<()=>void>=[],played:NarrationMessage[]=[],written:string[]=[];
 const output:NarrationOutput={enabled:()=>true,cancel:()=>{},canReact:()=>true,play:async m=>{played.push(m);return 'ended';}};
 const a=createAnnouncer(t=>written.push(t),()=>new Promise<void>(r=>waits.push(r)),output);
 const pending=a.say({...reaction,gapMs:300});await flush();const review=a.say('Current state.',true);await flush();waits.forEach(r=>r());await Promise.all([pending,review]);assert.deepEqual(played,[]);assert.deepEqual(written,['Current state.','']);
});
function heldReaction() {
 const waits:Array<{ms:number;resolve:()=>void}>=[],played:NarrationMessage[]=[],written:string[]=[];let focused=0;
 const view:PlayerView={...base,hand:['hearts:A'],legalActions:[{type:'play',card:'hearts:A'}]};
 const session:Session={view:()=>view,human:()=>({view,messages:[],narration:[],reaction}),bot:()=>null,nextHand:()=>view};
 const output:NarrationOutput={enabled:()=>true,cancel:()=>{},canReact:()=>true,play:async m=>{played.push(m);return 'ended';}};
 const c=createController(session,{render:()=>{},park:()=>{},focus:()=>{focused++;}},t=>written.push(t),ms=>new Promise<void>(resolve=>waits.push({ms,resolve})),()=>{},undefined,'voiceover',output);
 return {c,waits,played,written,focused:()=>focused};
}
test('optional-only human reaction respects both native activation and settled-focus guards',async()=>{
 const h=heldReaction();const pending=h.c.act({type:'play',card:'hearts:A'});assert.equal(h.waits[0]?.ms,FOCUS_GUARD_MS);assert.equal(h.played.length,0);
 h.waits[0]!.resolve();await flush();assert.equal(h.played.length,1);assert.equal(h.focused(),0);assert.equal(h.waits[1]?.ms,FOCUS_GUARD_MS);
 h.waits[1]!.resolve();await pending;assert.equal(h.focused(),1);assert.deepEqual(h.written,[]);h.c.stop();
});
test('review during activation guard discards the pending reaction while preserving review speech',async()=>{
 const h=heldReaction();const pending=h.c.act({type:'play',card:'hearts:A'});const review=h.c.repeat();h.waits.find(w=>w.ms!==FOCUS_GUARD_MS)!.resolve();await review;h.waits[0]!.resolve();await flush();h.waits.forEach(w=>w.resolve());await pending;
 assert.deepEqual(h.played,[]);assert.ok(h.written.some(Boolean));h.c.stop();
});
