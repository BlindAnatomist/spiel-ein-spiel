import test from 'node:test';
import assert from 'node:assert/strict';
import { createNarratorFlavorHistory } from '../web/narrator-flavor.ts';
import { narrationEvents } from '../web/presentation.ts';
import { createSession } from '../web/session.ts';
import { OPPONENT_PROFILES } from '../src/bots/profiles.ts';
import { wholeEventContract } from '../scripts/narrator-whole-contract.ts';

const first={clip:'joke.one',text:'First factual sentence. Nice try.',family:'mock-strategy'};
const second={clip:'joke.two',text:'Second factual sentence. Sure, big shot.',family:'bravado'};
function advance(history:ReturnType<typeof createNarratorFlavorHistory>,hands=1,events=20) {
  for(let i=0;i<hands;i++)history.beginHand();
  for(let i=0;i<events;i++)history.nextEvent();
}
test('flavor leaves a full plain hand and twelve public events between different families',()=>{
  const h=createNarratorFlavorHistory();h.beginGame();h.beginHand();h.nextEvent();assert.equal(h.eligible(first),true);h.used(first);
  advance(h,1,50);assert.equal(h.eligible(second),false);advance(h,1,0);assert.equal(h.eligible(second),true);
  const j=createNarratorFlavorHistory();j.beginHand();j.used(first);advance(j,2,11);assert.equal(j.eligible(second),false);j.nextEvent();assert.equal(j.eligible(second),true);
});
test('a semantic joke family is used at most once in a match even across a long game',()=>{
  const h=createNarratorFlavorHistory();h.beginGame();h.beginHand();h.used(first);advance(h,20,500);
  assert.equal(h.eligible({...second,family:first.family}),false);
  h.beginGame();assert.equal(h.eligible({...second,family:first.family}),true);
});
test('New Game preserves exact clip and normalized-line history and cross-game cooldowns',()=>{
  const h=createNarratorFlavorHistory();h.beginGame();h.beginHand();h.used(first);h.beginGame();
  advance(h,2,40);assert.equal(h.eligible({...second,family:first.family}),false);
  advance(h,1,0);assert.equal(h.eligible({...second,family:first.family}),true);
  assert.equal(h.eligible(first),false);assert.equal(h.eligible({...second,text:'FIRST factual sentence... NICE TRY!'}),false);
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
    assert.equal(discard[0]?.whole,undefined);assert.doesNotMatch(JSON.stringify(discard),/clubs|ace/i);
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
