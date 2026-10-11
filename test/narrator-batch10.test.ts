import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile, mkdtemp, writeFile, mkdir, rm, symlink} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {narrationAssets} from '../web/narrator-assets.ts';
import {extraReactionLines} from '../web/narrator-extra-reactions.ts';
import {narratorExtraReactionManifest} from '../web/narrator-extra-reaction-manifest.ts';
import {prepareBatch10} from '../scripts/import-narrator-batch10.ts';
import {reactionTriggerMetadata} from '../web/narrator-reaction-triggers.ts';
const receipt = JSON.parse(await readFile(new URL('../docs/narrator-preview/extra-reaction-batch10-receipt.json',import.meta.url),'utf8'));
const ids = new Set<string>(receipt.clips.map((c:{clip:string})=>c.clip));
const identity = (x:object) => createHash('sha256').update(JSON.stringify(Object.entries(x).filter(([id])=>!ids.has(id)).sort(([a],[b])=>a.localeCompare(b)))).digest('hex');
test('batch10 preserves every prior runtime and reaction metadata identity',()=>{
 assert.equal(ids.size,24);assert.equal(Object.keys(narrationAssets).length,2205);
 assert.equal(identity(narrationAssets),'80fed978c803437f84d1cd779055bb2f900fd4f0cfae212375252c4868567953');
 assert.equal(identity(extraReactionLines),'99ca9f80239dcef7295d9a36c64db513eed6cb17cc17271a9fb1cb5abad8a87d');
 assert.equal(identity(narratorExtraReactionManifest),'a0c50dbd4514859aa03727d3e68190e756321436d6d8678cc3e8d4aa5f8d5677');
});
test('all 24 batch10 recordings match reviewed text, family, context and mastered identities',()=>{
 for(const c of receipt.clips){
  assert.deepEqual(extraReactionLines[c.clip],{clip:c.clip,text:c.text,family:c.family,...reactionTriggerMetadata[c.trigger as keyof typeof reactionTriggerMetadata],trigger:c.trigger});
  assert.deepEqual(narratorExtraReactionManifest[c.clip],{id:c.clip,url:`audio/${c.clip}.mp3`,text:c.text,status:'ready',durationSeconds:c.durationSeconds,sha256:c.master.sha256,bytes:c.master.bytes});
 }
 for(const key of ['listeningAcceptance','speechContentVerified','audibleQualityVerified','iphoneVoiceOverVerified']) assert.equal(receipt[key],false);
});
test('batch10 importer rejects arbitrary evidence without touching output or old media',async t=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'batch10-evidence-'));t.after(()=>rm(root,{recursive:true,force:true}));
 for(const name of ['approved-candidate24.json','manifest.json','independent-qa.json'])await writeFile(path.join(root,name),'{}');
 await assert.rejects(prepareBatch10(root,root,path.join(root,'absent-old-media')),/Changed frozen batch10 evidence/);
});
test('batch10 importer rejects a symlinked evidence file',async t=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'batch10-symlink-'));t.after(()=>rm(root,{recursive:true,force:true}));
 await mkdir(path.join(root,'pack'));await writeFile(path.join(root,'outside.json'),'{}');
 await symlink(path.join(root,'outside.json'),path.join(root,'pack/approved-candidate24.json'));
 await assert.rejects(prepareBatch10(path.join(root,'pack'),root,root),/Unsafe evidence path/);
});
