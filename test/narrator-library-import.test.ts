import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { validateReactionBatches as validateWithEvidence } from '../scripts/narrator-extra-contract.ts';
import { extraReactionLines } from '../web/narrator-extra-reactions.ts';
import { narratorExtraReactionManifest } from '../web/narrator-extra-reaction-manifest.ts';
import { CHARACTER_LIBRARY_TARGET } from '../web/narrator-reaction-triggers.ts';

// These fixtures deliberately are not audio. Keep the mechanical contract unit
// separate from the production evidence route, which has no CLI bypass.
const validateReactionBatches = (inputs: Parameters<typeof validateWithEvidence>[0]) =>
 validateWithEvidence(inputs, async () => ({ mode: 'non-audio-unit-test-fixture' }));

async function fixture() {
 const directory = await mkdtemp(path.join(tmpdir(), 'narrator-import-test-'));
 await mkdir(path.join(directory, 'audio'));await mkdir(path.join(directory, 'raw'));
 const fixtureData = (id: string) => Buffer.from(`mechanical-contract-fixture-not-a-playable-recording-${id}`);
 const scripts = Array.from({length:24}, (_,i)=>({id:`reaction.you.trick.fixture-${i}`,trigger:'reaction.you.trick',family:`fixture-${i}`,context:'Public human trick win',text:`Fixture wording ${i}`,direction:'Testing only',deliveryTag:'excited'}));
 const proposal = {status:'Parent-approved fixture',packId:'test-pack',model:'s2.1-pro-free',reference_id:'d75c270eaee14c8aa1e9e980cc37cf1b',temperature:0.85,scripts};
 const clips = Object.fromEntries(scripts.map(line=>{const data=fixtureData(line.id), sha=createHash('sha256').update(data).digest('hex');return [line.id,{...line,prompt:`[${line.deliveryTag}] ${line.text}`,payload:{text:`[${line.deliveryTag}] ${line.text}`,temperature:0.85,reference_id:proposal.reference_id},status:'ready',decodeVerified:true,url:`audio/${line.id}.mp3`,rawUrl:`raw/${line.id}.mp3`,durationSeconds:1,bytes:data.length,rawBytes:data.length,sha256:sha,rawSha256:sha}];}));
 const manifest={...proposal,clips,readyCount:24,plannedCount:24};
 for(const clip of Object.values(clips)){await writeFile(path.join(directory,clip.url),fixtureData(clip.id));await writeFile(path.join(directory,clip.rawUrl),fixtureData(clip.id));}
 const input = {directory, proposal:path.join(directory,'approved.json')};
 const save = async()=>{await writeFile(input.proposal,JSON.stringify(proposal));await writeFile(path.join(directory,'manifest.json'),JSON.stringify(manifest));};
 await writeFile(path.join(directory,'final-qa.json'),JSON.stringify({readyCount:24,exactApprovedContractMapping:true,audioSummary:{count:24,partial:false,rawHashesVerified:true,equalDecodedSampleCounts:true}}));
 await save();return {directory,input,proposal,manifest,save,clean:()=>rm(directory,{recursive:true,force:true})};
}
test('batch import validates the full explicit approved set and derives runtime actor context',async()=>{
 const f=await fixture();try{const v=await validateReactionBatches([f.input]);assert.equal(Object.keys(v.lines).length,24);assert.equal(Object.keys(v.runtime).length,24);assert.equal(v.lines['reaction.you.trick.fixture-0']!.context,'you');assert.equal(v.lines['reaction.you.trick.fixture-0']!.priority,2);assert.equal(v.packs.length,1);}finally{await f.clean();}
});
test('batch import rejects missing batches, duplicate identities, wrong voice and draft status',async()=>{
 await assert.rejects(()=>validateReactionBatches([]));const f=await fixture();try{
  await assert.rejects(()=>validateReactionBatches([f.input,f.input]),/mismatched/);
  for(const status of ['Unreviewed draft','unapproved','not approved','Parent approval pending']){f.proposal.status=status;await f.save();await assert.rejects(()=>validateReactionBatches([f.input]),/mismatched/);}
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
