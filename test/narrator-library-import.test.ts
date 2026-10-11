import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { assertAdditiveReactionImport, validateReactionBatches as validateWithEvidence } from '../scripts/narrator-extra-contract.ts';
import { extraReactionLines } from '../web/narrator-extra-reactions.ts';
import { narratorExtraReactionManifest } from '../web/narrator-extra-reaction-manifest.ts';
import { CHARACTER_LIBRARY_TARGET } from '../web/narrator-reaction-triggers.ts';

// These fixtures deliberately are not audio. Keep the mechanical contract unit
// separate from the production evidence route, which has no CLI bypass.
const validateReactionBatches = (inputs: Parameters<typeof validateWithEvidence>[0]) =>
 validateWithEvidence(inputs, async () => ({ mode: 'non-audio-unit-test-fixture' }));

async function fixture(batch = 0) {
 const directory = await mkdtemp(path.join(tmpdir(), 'narrator-import-test-'));
 await mkdir(path.join(directory, 'audio'));await mkdir(path.join(directory, 'raw'));
 const fixtureData = (id: string) => Buffer.from(`mechanical-contract-fixture-not-a-playable-recording-${id}`);
 const scripts = Array.from({length:24}, (_,i)=>({id:`reaction.you.trick.fixture-${batch}-${i}`,trigger:'reaction.you.trick',family:`fixture-${batch}-${i}`,context:'Public human trick win',text:`Fixture wording ${batch} ${i}`,direction:'Testing only',deliveryTag:'excited'}));
 const proposal = {status:'Parent-approved fixture',packId:`test-pack-${batch}`,model:'s2.1-pro-free',reference_id:'d75c270eaee14c8aa1e9e980cc37cf1b',temperature:0.85,scripts};
 const clips = Object.fromEntries(scripts.map(line=>{const data=fixtureData(line.id), sha=createHash('sha256').update(data).digest('hex');return [line.id,{...line,prompt:`[${line.deliveryTag}] ${line.text}`,payload:{text:`[${line.deliveryTag}] ${line.text}`,temperature:0.85,reference_id:proposal.reference_id},status:'ready',decodeVerified:true,url:`audio/${line.id}.mp3`,rawUrl:`raw/${line.id}.mp3`,durationSeconds:1,bytes:data.length,rawBytes:data.length,sha256:sha,rawSha256:sha}];}));
 const manifest={...proposal,clips,readyCount:24,plannedCount:24};
 for(const clip of Object.values(clips)){await writeFile(path.join(directory,clip.url),fixtureData(clip.id));await writeFile(path.join(directory,clip.rawUrl),fixtureData(clip.id));}
 const input = {directory, proposal:path.join(directory,'approved.json')};
 const save = async()=>{await writeFile(input.proposal,JSON.stringify(proposal));await writeFile(path.join(directory,'manifest.json'),JSON.stringify(manifest));};
 await writeFile(path.join(directory,'final-qa.json'),JSON.stringify({readyCount:24,exactApprovedContractMapping:true,audioSummary:{count:24,partial:false,rawHashesVerified:true,equalDecodedSampleCounts:true}}));
 await save();return {directory,input,proposal,manifest,save,clean:()=>rm(directory,{recursive:true,force:true})};
}
test('batch import validates the full explicit approved set and derives runtime actor context',async()=>{
 const f=await fixture();try{const v=await validateReactionBatches([f.input]);assert.equal(Object.keys(v.lines).length,24);assert.equal(Object.keys(v.runtime).length,24);assert.equal(v.lines['reaction.you.trick.fixture-0-0']!.context,'you');assert.equal(v.lines['reaction.you.trick.fixture-0-0']!.priority,2);assert.equal(v.packs.length,1);}finally{await f.clean();}
});
test('batch import rejects missing batches, duplicate identities, wrong voice and draft status',async()=>{
 await assert.rejects(()=>validateReactionBatches([]));const f=await fixture();try{
  await assert.rejects(()=>validateReactionBatches([f.input,f.input]),/mismatched/);
  for(const status of ['Unreviewed draft','unapproved','not approved','Parent approval pending','Parent editorial approval and independent script review passed; audio not generated']){f.proposal.status=status;await f.save();await assert.rejects(()=>validateReactionBatches([f.input]),/mismatched/);}
  f.proposal.status='Parent editorial approval and independent review passed 2026-10-02';await f.save();assert.equal(Object.keys((await validateReactionBatches([f.input])).runtime).length,24);
  f.proposal.status='Parent-approved';f.proposal.temperature=0.7;await f.save();await assert.rejects(()=>validateReactionBatches([f.input]),/mismatched/);
 }finally{await f.clean();}
});
test('batch import rejects content drift, unknown predicates and corrupt raw or mastered bytes',async()=>{
 const f=await fixture();try{
  const first=f.proposal.scripts[0]!,clip=f.manifest.clips[first.id]!;
  const text=clip.text;clip.text='Changed without approved contract';await f.save();await assert.rejects(()=>validateReactionBatches([f.input]),/Invalid approved/);clip.text=text;
  const trigger=first.trigger;first.trigger='constructor';clip.trigger='constructor';await f.save();await assert.rejects(()=>validateReactionBatches([f.input]),/Invalid approved/);first.trigger=trigger;clip.trigger=trigger;await f.save();
  const raw=await readFile(path.join(f.directory,clip.rawUrl));await writeFile(path.join(f.directory,clip.rawUrl),'corrupt');await assert.rejects(()=>validateReactionBatches([f.input]),/Corrupt/);await writeFile(path.join(f.directory,clip.rawUrl),raw);
  await writeFile(path.join(f.directory,clip.url),'corrupt');await assert.rejects(()=>validateReactionBatches([f.input]),/Corrupt/);
 }finally{await f.clean();}
});
test('approved runtime contains only matching ready metadata and corrected whole-line takes',()=>{
 const entries=Object.entries(extraReactionLines);assert.ok(entries.length>0&&entries.length<=CHARACTER_LIBRARY_TARGET&&entries.length%24===0);
 assert.equal(Object.keys(narratorExtraReactionManifest).length,entries.length);
 for(const[id,line]of entries){const clip=narratorExtraReactionManifest[id]!;assert.equal(clip.id,id);assert.equal(clip.text,line.text);assert.equal(clip.status,'ready');assert.equal(clip.url,`audio/${id}.mp3`);}
 assert.equal(extraReactionLines['reaction.opponent.trick.pissed']!.text,'That’s bullshit!');
 assert.equal(extraReactionLines['reaction.val.trick.beer']!.text,'Val, I owe you a beer.');
 for(const id of ['reaction.you.trump.slouch','reaction.val.follow-suit.soap-opera','reaction.opponent.ace-lead.tuxedo'])assert.equal(extraReactionLines[id],undefined,'unrecorded speculative line must be absent');
});

test('production importer cannot treat arbitrary QA as a legacy provenance exemption',async()=>{
 const f=await fixture();try{
  await assert.rejects(()=>validateWithEvidence([f.input]),/provenance failed/);
  f.proposal.packId='peter-euchre-library-batch01-20261002';f.manifest.packId=f.proposal.packId;await f.save();
  await assert.rejects(()=>validateWithEvidence([f.input]),/provenance failed/);
  for (const batch of ['08', '09']) {
   f.proposal.packId=`peter-euchre-library-batch${batch}-20261011`;f.manifest.packId=f.proposal.packId;await f.save();
   await assert.rejects(()=>validateWithEvidence([f.input]),/Unreviewed batch0[89] proposal|Unexpected|Symlink|Command failed/);
  }
 }finally{await f.clean();}
});
test('batch import rejects reused raw/master identity and symlinked audio',async()=>{
 const f=await fixture();try{
  const first=f.manifest.clips[f.proposal.scripts[0]!.id]!,second=f.manifest.clips[f.proposal.scripts[1]!.id]!;
  const original=second.rawSha256;second.rawSha256=first.rawSha256;await f.save();
  await assert.rejects(()=>validateReactionBatches([f.input]),/Duplicate.*audio identity/);
  second.rawSha256=original;await f.save();
  await rm(path.join(f.directory,first.rawUrl));await symlink(path.join(f.directory,first.url),path.join(f.directory,first.rawUrl));
  await assert.rejects(()=>validateReactionBatches([f.input]),/Unsafe audio evidence path/);
 }finally{await f.clean();}
});
test('verified master bytes are retained for import rather than rereading mutable input paths',async()=>{
 const f=await fixture();try{
  const v=await validateReactionBatches([f.input]),id=f.proposal.scripts[0]!.id,clip=f.manifest.clips[id]!;
  const expected=await readFile(path.join(f.directory,clip.url));
  await writeFile(path.join(f.directory,clip.url),'changed after validation');
  assert.deepEqual(v.audioBytes.get(id),expected);
 }finally{await f.clean();}
});

test('nine complete packs are accepted; a tenth and an incomplete ninth are rejected', async () => {
 const fixtures = await Promise.all(Array.from({length: 10}, (_, i) => fixture(i)));
 try {
  const inputs = fixtures.map(f => f.input);
  const accepted = await validateReactionBatches(inputs.slice(0, 9));
  assert.equal(Object.keys(accepted.runtime).length, 216);
  assert.equal(accepted.packs.length, 9);
  await assert.rejects(() => validateReactionBatches(inputs), /one to nine/);
  const ninth = fixtures[8]!;
  delete ninth.manifest.clips[ninth.proposal.scripts[0]!.id];
  await ninth.save();
  await assert.rejects(() => validateReactionBatches(inputs.slice(0, 9)), /Incomplete/);
 } finally { await Promise.all(fixtures.map(f => f.clean())); }
});

test('new packs reject wrong hashes, duplicate wording, IDs and prompt tags', async () => {
 const f = await fixture();
 try {
  const first = f.proposal.scripts[0]!, second = f.proposal.scripts[1]!;
  const clip = f.manifest.clips[first.id]!, other = f.manifest.clips[second.id]!;
  const hash = clip.sha256; clip.sha256 = '0'.repeat(64); await f.save();
  await assert.rejects(() => validateReactionBatches([f.input]), /Corrupt/);
  clip.sha256 = hash; const prompt = clip.prompt; clip.prompt = '[wrong] ' + first.text; await f.save();
  await assert.rejects(() => validateReactionBatches([f.input]), /Invalid approved/);
  clip.prompt = prompt; const text = second.text;
  second.text = first.text; other.text = first.text; other.prompt = `[${second.deliveryTag}] ${second.text}`; other.payload.text = other.prompt; await f.save();
  await assert.rejects(() => validateReactionBatches([f.input]), /Duplicate normalized/);
  second.text = text; other.text = text; other.prompt = `[${second.deliveryTag}] ${text}`; other.payload.text = other.prompt;
  second.id = first.id; await f.save();
  await assert.rejects(() => validateReactionBatches([f.input]), /Invalid approved/);
 } finally { await f.clean(); }
});

test('additive import preserves all 168 existing recordings and every reaction metadata field', async () => {
 const baseline = JSON.parse(await readFile(new URL('../docs/narrator-preview/checkpoints/20261002-character-library/approved-scripts/all168-reviewed.json', import.meta.url), 'utf8'));
 const baselineIds = new Set<string>(baseline.scripts.map((line: {id: string}) => line.id));
 assert.equal(baselineIds.size, 168, 'fixed baseline subset, not the expansion target');
 const identity = (data: object) => createHash('sha256').update(JSON.stringify(Object.entries(data).filter(([id]) => baselineIds.has(id)).sort(([a], [b]) => a.localeCompare(b)))).digest('hex');
 assert.equal(identity(extraReactionLines), 'e578feee7bc26c2d4d472a418897235b64f0db83bd6667f45222006a890d2e99');
 assert.equal(identity(narratorExtraReactionManifest), '50887dd1e27913639fadf59e0f343e558b35ec3a7c759f861c7b75b3b718b0ab');
 const check = (lines: typeof extraReactionLines, runtime = narratorExtraReactionManifest) =>
  assertAdditiveReactionImport(lines, runtime, extraReactionLines, narratorExtraReactionManifest, narratorExtraReactionManifest);
 check(extraReactionLines);
 const id = Object.keys(extraReactionLines)[0]!;
 for (const field of Object.keys(extraReactionLines[id]!)) {
  const changed = structuredClone(extraReactionLines) as unknown as Record<string, Record<string, unknown>>;
  changed[id]![field] = 'mutated';
  assert.throws(() => check(changed as unknown as typeof extraReactionLines), /preserved reaction metadata/, field);
 }
 const omitted = {...extraReactionLines}; delete omitted[id];
 assert.throws(() => check(omitted), /preserved reaction metadata/);
 const removedAudio = {...narratorExtraReactionManifest}; delete removedAudio[id];
 assert.throws(() => check(extraReactionLines, removedAudio), /preserved recording/);
 const changedAudio = {...narratorExtraReactionManifest};
 changedAudio[id] = {...changedAudio[id]!, sha256: '0'.repeat(64)};
 assert.throws(() => check(extraReactionLines, changedAudio), /preserved recording/);
});

test('additive import rejects collisions and repeated wording outside extra reactions', () => {
 const old = Object.values(extraReactionLines)[0]!;
 const id = 'reaction.you.trick.new-fixture';
 const line = {...old, clip: id, text: 'A brand new fixture'};
 const lines = {...extraReactionLines, [id]: line};
 const check = (assets: Record<string, {text: string}>) =>
  assertAdditiveReactionImport(lines, narratorExtraReactionManifest, extraReactionLines, narratorExtraReactionManifest, assets);
 check({});
 assert.throws(() => check({[id]: {text: 'Different old wording'}}), /collide/);
 assert.throws(() => check({'an.old.id': {text: 'A brand-new fixture!'}}), /repeat existing/);
});


test('final expansion preserves all 24 batch08 recordings and reaction metadata', () => {
 const ids = new Set([
  "reaction.you.queen.royal-driveway",
  "reaction.you.queen.royal-coupon",
  "reaction.you.queen.burger-crown",
  "reaction.you.ace-lead.chicken-salute",
  "reaction.you.ace-lead.business-cards",
  "reaction.you.ace-lead.little-chair",
  "reaction.val.alone.couch-access",
  "reaction.val.alone.hold-my-beer",
  "reaction.opponent.alone.apology-camera",
  "reaction.opponent.alone.solo-autograph",
  "reaction.you.low-lead.tiny-helmet",
  "reaction.you.low-lead.kids-menu",
  "reaction.opponent.low-lead.pocket-lint",
  "reaction.opponent.low-lead.tiny-boo",
  "reaction.you-team.euchres-opponents.plan-pants",
  "reaction.you-team.euchres-opponents.thank-you-card",
  "reaction.you-team.game-win.briefly-gracious",
  "reaction.you-team.game-win.raccoon-parade",
  "reaction.opponent.game-win.napkin-review",
  "reaction.opponent.game-win.sore-winner",
  "reaction.table.four-tricks.important-burp",
  "reaction.table.four-tricks.dramatic-lean",
  "reaction.table.turned-down.adoption-fee",
  "reaction.table.turned-down.four-man-shrug"
]);
 const identity = (data: object) => createHash('sha256').update(JSON.stringify(Object.entries(data).filter(([id]) => ids.has(id)).sort(([a], [b]) => a.localeCompare(b)))).digest('hex');
 assert.equal(ids.size, 24);
 assert.equal(identity(extraReactionLines), '920e7d9bab0ba8d722e53a827fbc5fe223ac1b6cbe8a83ffdc82d5ad8a7745fa');
 assert.equal(identity(narratorExtraReactionManifest), 'd24e49df009b81de4a316eeae36fce33ec923157fb8aaebc9a6a51986670d6eb');
});


test('unrelated proposals cannot use the two frozen batch09 sweep ID exceptions', async () => {
 const f = await fixture();
 try {
  const line = f.proposal.scripts[0]!, originalId = line.id;
  const clip = f.manifest.clips[originalId]!;
  delete f.manifest.clips[originalId];
  for (const id of ['you-team-sweep.unknown-number', 'you-team-sweep.sticky-fingers']) {
   line.id = id; line.trigger = 'you-team-sweep';
   f.manifest.clips[id] = {...clip, id, trigger: line.trigger, url: `audio/${id}.mp3`, rawUrl: `raw/${id}.mp3`};
   await f.save();
   await assert.rejects(() => validateReactionBatches([f.input]), /Invalid approved recording/);
   delete f.manifest.clips[id];
  }
 } finally { await f.clean(); }
});
