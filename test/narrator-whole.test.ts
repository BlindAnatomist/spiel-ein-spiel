import test from 'node:test';
import assert from 'node:assert/strict';
import { createNarratorFlavorHistory } from '../web/narrator-flavor.ts';
import { narrationEvents } from '../web/presentation.ts';
import { createSession } from '../web/session.ts';
import { OPPONENT_PROFILES } from '../src/bots/profiles.ts';
import { wholeEventContract } from '../scripts/narrator-whole-contract.ts';
const first={clip:'joke.one',text:'First factual sentence. Nice try.',family:'mock-strategy'};
const second={clip:'joke.two',text:'Second factual sentence. Sure, big shot.',family:'bravado'};
function clock(random=()=>0) {
 const h=createNarratorFlavorHistory(random);let id=0,hand=1,tricks=0;
 h.beginGame();h.beginHand(hand);
 return {h, event(count=1){for(let n=0;n<count;n++)h.observe({eventId:++id,handNumber:hand,completedTricks:tricks,handComplete:false});},
 trick(){tricks++;h.observe({eventId:++id,handNumber:hand,completedTricks:tricks,handComplete:tricks===5});},
 hand(){while(tricks<5)this.trick();hand++;tricks=0;h.beginHand(hand);},
 game(){h.beginGame();id=0;hand=1;tricks=0;h.beginHand(hand);}};
}
test('flavor requires two finished tricks and six public events, without a full plain-hand ban',()=>{
 const c=clock();c.h.used(first);c.event(10);c.trick();assert.equal(c.h.eligible(second),false);c.trick();assert.equal(c.h.eligible(second),true);
 const j=clock();j.h.used(first);j.trick();j.trick();j.event(3);assert.equal(j.h.eligible(second),false);j.event();assert.equal(j.h.eligible(second),true);
});
test('related families wait four actual tricks and twelve public events',()=>{
 const c=clock();c.h.used(first);c.event(20);for(let n=0;n<3;n++)c.trick();
 assert.equal(c.h.eligible({...second,family:first.family}),false);c.trick();assert.equal(c.h.eligible({...second,family:first.family}),true);
});
test('exact clip and normalized text wait four completed hands and eighty public events',()=>{
 const c=clock();c.h.used(first);for(let n=0;n<3;n++)c.hand();c.event(100);
 assert.equal(c.h.eligible(first),false);c.hand();assert.equal(c.h.eligible(first),true);
 assert.equal(c.h.eligible({...second,text:'FIRST factual sentence... NICE TRY!'}),true);
 c.h.used(first);assert.equal(c.h.eligible({...second,text:'FIRST factual sentence... NICE TRY!'}),false);
});
test('abandoned New Games and duplicate progress cannot manufacture cooldown',()=>{
 const c=clock();c.h.used(first);for(let n=0;n<12;n++){c.game();c.event();}
 assert.equal(c.h.eligible(second),false);c.h.observe({eventId:1,handNumber:1,completedTricks:5,handComplete:true});assert.equal(c.h.eligible(second),false);
 c.trick();c.trick();c.event(6);assert.equal(c.h.eligible(second),true);assert.equal(c.h.eligible(first),false);
});
test('one hand admits at most three distinct remarks even when all families differ',()=>{
 const c=clock();c.h.used(first);c.event(6);c.trick();c.trick();assert.equal(c.h.eligible(second),true);c.h.used(second);
 const third={clip:'three',text:'Third thought',family:'third'};c.event(6);c.trick();c.trick();assert.equal(c.h.eligible(third),true);c.h.used(third);
 c.event(20);c.trick();assert.equal(c.h.eligible({clip:'four',text:'Fourth thought',family:'fourth'}),false);
});
test('release jitter uses independent randomness once per consumed remark',()=>{
 let calls=0;const c=clock(()=>{calls++;return .99;});assert.equal(c.h.select([first,second]),second);c.h.used(second);assert.equal(calls,2);
 c.event(6);c.trick();c.trick();assert.equal(c.h.eligible(first),false);c.event(2);assert.equal(c.h.eligible(first),false);c.event();assert.equal(c.h.eligible(first),true);assert.equal(calls,2);
});
test('completed-trick spacing carries across hands and can admit a later-hand early remark',()=>{
 const c=clock();for(let n=0;n<4;n++)c.trick();c.h.used(first);c.hand();c.event(6);assert.equal(c.h.eligible(second),false);c.trick();assert.equal(c.h.eligible(second),true);
});
test('stage-one keys cover all379 exact named facts and exclude hidden discard identities',()=>{
  const expected=wholeEventContract();assert.equal(Object.keys(expected).length,379);
  const actual:Record<string,string>={};const before=createSession(7,'casual').view();
  const actors=['Val',...Object.values(OPPONENT_PROFILES).flatMap(p=>[p.westName,p.eastName])];
  for(const name of actors){
    const names=['You',name,'Val','East'] as const;
    const add=(messages:ReturnType<typeof narrationEvents>)=>messages.forEach(m=>{if(m.whole)actual[m.whole]=m.text;});
    add(narrationEvents(before,before,1,{type:'pass'},names));
    for(const suit of ['clubs','diamonds','hearts','spades'] as const)for(const alone of [false,true]){
      add(narrationEvents(before,{...before,trump:suit},1,{type:'order-up',alone},names));
      add(narrationEvents(before,{...before,trump:suit},1,{type:'call',suit,alone},names));
    }
    add(narrationEvents(before,{...before,completedTricks:[{plays:[],winner:1}]},0,{type:'play',card:'hearts:9'},names));
    const discard=narrationEvents(before,before,1,{type:'discard',card:'clubs:A'},names);
    assert.equal(discard[0]?.whole,`full.discard.${name.toLowerCase()}`);assert.doesNotMatch(JSON.stringify(discard),/clubs|ace/i);
  }
  const human=narrationEvents(before,{...before,completedTricks:[{plays:[],winner:0}]},0,{type:'play',card:'hearts:9'}).at(-1)!;
  actual[human.whole!]=human.text;assert.deepEqual(actual,expected);
});
test('whole alternatives match exact actors, action, suit and alone state',()=>{
  const v=createSession(7,'casual').view();const names=['You','Walt','Val','Emma'] as const;
  assert.equal(narrationEvents(v,v,3,{type:'pass'},names)[0]?.character?.clip,'whole.emma.passes');
  assert.equal(narrationEvents(v,v,1,{type:'call',suit:'spades',alone:true},names)[0]?.character?.clip,'whole.walt.calls-spades-alone');
  for(const suit of ['hearts','diamonds','clubs'] as const)assert.equal(narrationEvents(v,v,1,{type:'call',suit,alone:true},names)[0]?.character,undefined);
  assert.equal(narrationEvents(v,v,1,{type:'call',suit:'spades',alone:false},names)[0]?.character,undefined);
  assert.equal(narrationEvents(v,{...v,trump:'spades'},1,{type:'order-up',alone:true},names)[0]?.character,undefined);
  const renamed=['You','Walt','Other','Emma'] as const;
  assert.equal(narrationEvents(v,v,2,{type:'call',suit:'hearts',alone:false},renamed)[0]?.character,undefined);
});
