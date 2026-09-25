import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { jobs, validateChunk } from '../src/audit/validation-cli.ts';
import { design, runValidationGame, checkMatched } from '../src/audit/validation.ts';
import { suit, winner } from '../src/audit/validation-invariants.ts';
test('fixed complete design retains balanced blocks and requested game counts',()=>{const j=jobs();assert.equal(j.length,336);assert.equal(j.reduce((n,j)=>n+j.count*j.cases.length,0),41024);for(const x of j){assert.equal(x.start%4,0);assert.equal(x.count%4,0);}assert.deepEqual(['casual','expert','cross','val','strong','symmetry'].map(c=>design(c).length),[18,18,330,960,32,44]);});
test('reconstructed referee driver replays recovered decisions, hands and outcome exactly',()=>{const old=JSON.parse(gunzipSync(readFileSync('reports/bot-validation/detailed/cross-1e056d8292-0.json.gz')).toString());validateChunk(jobs().find(j=>j.id===old.jobId)!,old);const g=old.games[0];const actual=runValidationGame(design('cross').find(c=>c.id===g.caseId)!,g.block,old.base);for(const k of Object.keys(g))if(!['policyMs','elapsedMs'].includes(k))assert.deepEqual(actual[k as keyof typeof actual],g[k],k);});
test('actual Expert policy is deterministic and clockwise rotations match deals',()=>{const c=design('symmetry').filter(c=>c.variant==='expert-balanced');const a=runValidationGame(c[0]!,0,8910926),b=runValidationGame(c[0]!,0,8910926),r=runValidationGame(c[1]!,0,8910926);assert.equal(a.digest,b.digest);assert.deepEqual(a.hands,b.hands);assert.ok(checkMatched([a,r]).matchedHands>0);const corrupt=structuredClone(r);corrupt.hands[0]!.deal='corrupted';assert.throws(()=>checkMatched([a,corrupt]));});
test('independent oracle ranks bowers and effective follow suit',()=>{assert.equal(suit('clubs:J','spades'),'spades');assert.equal(winner([{seat:0,card:'clubs:A'},{seat:1,card:'clubs:J'},{seat:2,card:'spades:A'},{seat:3,card:'spades:J'}],'spades'),3);assert.equal(winner([{seat:0,card:'hearts:9'},{seat:1,card:'clubs:A'}],'spades'),0);});

test('tactical continuation accepts the saved legal path beyond the old 25-action bound',async()=>{
 const {createReferee}=await import('../src/referee.ts');const {rollout}=await import('../src/audit/validation-fixtures.ts');
 const r=JSON.parse(readFileSync('reports/bot-validation/regressions/tactical-bound.json','utf8'));
 const result=rollout(createReferee({seed:r.seed,dealer:r.dealer}).snapshot(),r.action,r.lineup);
 assert.ok(result.steps>r.oldMaximum&&result.steps<=r.repairedMaximum);assert.deepEqual(result,r.outcome);
});
