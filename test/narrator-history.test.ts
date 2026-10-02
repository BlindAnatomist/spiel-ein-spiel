import test from 'node:test';
import assert from 'node:assert/strict';
import { createNarratorFlavorHistory, type NarratorFlavorHistory } from '../web/narrator-flavor.ts';
import { HISTORY_BYTES, HISTORY_LIMIT, loadNarratorHistory, type NarratorHistoryStorage } from '../web/narrator-history-storage.ts';
import { createNarratorAudio } from '../web/narrator-audio.ts';
import type { NarrationMessage, NarrationManifest } from '../web/narration-types.ts';

const a={clip:'old',text:'Old complete thought.',family:'old-family',priority:2};
const b={clip:'fresh',text:'Fresh complete thought.',family:'fresh-family',priority:1};
function drive(h:NarratorFlavorHistory) {
 let id=0,hand=1,tricks=0;
 return {
  game(){h.beginGame();id=0;hand=1;tricks=0;h.beginHand(hand);},
  event(n=1){for(let i=0;i<n;i++)h.observe({eventId:++id,handNumber:hand,completedTricks:tricks,handComplete:tricks===5});},
  finish(completeGame=false){while(tricks<5){tricks++;h.observe({eventId:++id,handNumber:hand,completedTricks:tricks,handComplete:tricks===5,gameComplete:tricks===5&&completeGame});}},
  hand(){hand++;tricks=0;h.beginHand(hand);},
 };
}
test('exact wording waits for two intervening completed games as well as hand/event cooldowns',()=>{
 const h=createNarratorFlavorHistory(()=>0),d=drive(h);d.game();h.used(a);d.event(100);d.finish(true);
 for(let i=0;i<12;i++)d.game();assert.equal(h.eligible(a),false,'abandoned games do not count');
 d.finish(true);d.game();d.finish(true);d.game();assert.equal(h.eligible(a),false,'three short matches still contain only three completed hands');
 d.finish();assert.equal(h.eligible(a),true);h.used(a);d.hand();d.event(100);d.finish();assert.equal(h.eligible(a),false,'the same match cannot repeat a line');
 assert.equal(h.eligible({...b,text:'OLD complete thought!'}),false,'normalization cannot evade the repeat rule');
});
test('reload preserves exposure while never-heard wording wins across priorities',()=>{
 let saved='';const storage:NarratorHistoryStorage={load:()=>saved||null,save:v=>{saved=v;}};
 const h=createNarratorFlavorHistory(()=>0,storage),d=drive(h);d.game();h.used(a);d.event(100);d.finish(true);
 for(let i=0;i<8;i++){d.game();d.finish(true);}const reloaded=createNarratorFlavorHistory(()=>0,storage),r=drive(reloaded);r.game();r.event(10);
 assert.equal(reloaded.eligible(a),true);assert.equal(reloaded.select([a,b])?.clip,b.clip,'heard high-priority material cannot crowd out a fresh eligible line');
 assert.ok(loadNarratorHistory(storage)?.seenClips.includes(a.clip));
});
test('duplicate game-over progress cannot advance cross-game freshness',()=>{
 let saved='';const storage={load:()=>saved||null,save:(v:string)=>{saved=v;}};
 const h=createNarratorFlavorHistory(()=>0,storage);h.beginGame();h.beginHand(1);h.used(a);
 for(let id=1;id<=8;id++)h.observe({eventId:id,handNumber:1,completedTricks:5,handComplete:true,gameComplete:true});
 assert.equal(loadNarratorHistory(storage)?.completedGames,1);h.beginGame();assert.equal(h.eligible(a),false);
});
test('malformed, future and unavailable storage fails safely to an empty history',()=>{
 for(const raw of ['', '{', '{}',JSON.stringify({version:999}), 'x'.repeat(HISTORY_BYTES+1)]) {
  const h=createNarratorFlavorHistory(()=>0,{load:()=>raw,save:()=>{throw Error('quota');}});h.beginGame();h.beginHand(1);assert.equal(h.eligible(a),true);h.used(a);assert.equal(h.eligible(a),false);
 }
 const h=createNarratorFlavorHistory(()=>0,{load:()=>{throw Error('blocked');},save:()=>{throw Error('blocked');}});h.beginGame();h.beginHand(1);assert.equal(h.select([a])?.clip,a.clip);
});
test('stored history bounds collections and validates impossible counters',()=>{
 let raw='';const storage={load:()=>raw||null,save:(v:string)=>{raw=v;}};const h=createNarratorFlavorHistory(()=>0,storage);h.beginGame();h.beginHand(1);
 for(let i=0;i<600;i++)h.used({clip:`clip.${i}`,text:`A different complete thought number ${i}`,family:`family.${i}`});
 const data=loadNarratorHistory(storage)!;assert.ok(data);assert.equal(data.clips.length,HISTORY_LIMIT);assert.equal(data.lines.length,HISTORY_LIMIT);assert.equal(data.seenClips.length,HISTORY_LIMIT);assert.ok(raw.length<=HISTORY_BYTES);
 const corrupt=JSON.parse(raw);corrupt.clips[0][1].event=999999999;assert.equal(loadNarratorHistory({load:()=>JSON.stringify(corrupt),save:()=>{}}),undefined);
});
test('one shared public-event choice preserves canonical facts and defers old jokes to a fresh reaction',()=>{
 const history=createNarratorFlavorHistory(()=>0),d=drive(history);d.game();history.used(a);d.event(100);d.finish(true);for(let i=0;i<3;i++){d.game();d.finish(true);}d.game();
 const manifest:NarrationManifest=Object.fromEntries([a,b].map(line=>[line.clip,{id:line.clip,text:line.text,url:`audio/${line.clip}.mp3`,status:'ready',durationSeconds:1,sha256:'test',bytes:10}]));
 const output=createNarratorAudio(manifest,{enabled:true,flavorHistory:history});
 const fact:NarrationMessage={text:'Val takes the trick.',clips:[],whole:'full.trick.val',character:a};
 const reaction:NarrationMessage={text:'',clips:[],optional:true,alternatives:[b]};
 const prepared=output.prepareEvent!([fact,reaction]);
 assert.deepEqual(prepared[0],{text:fact.text,clips:[],whole:fact.whole});assert.deepEqual((prepared[1] as NarrationMessage).alternatives,[b]);
 assert.equal(history.eligible(b),true,'planning does not consume unheard material before playback');
});
test('eligible final-game payoff precedes fresh hand jokes, with freshness within final results',()=>{
 const final={clip:'game-result',text:'A completed game payoff.',family:'game-family',priority:3,eventPreference:'game-result' as const};
 const freshFinal={clip:'fresh-game-result',text:'Another completed game payoff.',family:'other-game-family',priority:3,eventPreference:'game-result' as const};
 const h=createNarratorFlavorHistory(()=>0),d=drive(h);d.game();h.used(final);d.event(100);d.finish(true);
 for(let i=0;i<4;i++){d.game();d.finish(true);}d.game();
 assert.equal(h.eligible(final),true);assert.equal(h.select([b,final])?.clip,final.clip);
 assert.equal(h.select([b,final,freshFinal])?.clip,freshFinal.clip);
});
test('cooldown-ineligible game result falls back normally and shared event preparation keeps one quip',()=>{
 const final={clip:'game-result',text:'A completed game payoff.',family:'game-family',priority:3,eventPreference:'game-result' as const};
 const h=createNarratorFlavorHistory(()=>0),d=drive(h);d.game();h.used(final);d.event(100);d.finish();d.hand();d.event(10);
 assert.equal(h.eligible(final),false);assert.equal(h.eligible(b),true);assert.equal(h.select([final,b])?.clip,b.clip);
 const make=(history:NarratorFlavorHistory)=>createNarratorAudio(Object.fromEntries([a,b,final].map(line=>[line.clip,{id:line.clip,text:line.text,url:`audio/${line.clip}.mp3`,status:'ready',durationSeconds:1,sha256:'test',bytes:10}])),{enabled:true,flavorHistory:history});
 const messages:NarrationMessage[]=[{text:'Val takes the trick.',clips:[],whole:'full.trick.val',character:a},{text:'',clips:[],optional:true,alternatives:[b,final]}];
 const fresh=createNarratorFlavorHistory(()=>0),f=drive(fresh);f.game();
 const prepared=make(fresh).prepareEvent!(messages) as NarrationMessage[];
 assert.equal(prepared.flatMap(m=>m.alternatives??[]).length,1);assert.equal(prepared[1]!.alternatives![0]!.clip,final.clip);
 assert.equal(prepared[0]!.whole,'full.trick.val');assert.equal(prepared[0]!.text,'Val takes the trick.');
 const fallback=make(h).prepareEvent!(messages) as NarrationMessage[];
 assert.equal(fallback.flatMap(m=>m.alternatives??[]).length,1);assert.equal(fallback[0]!.alternatives![0]!.clip,a.clip);
});
