import { readFile, writeFile, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { reactionLines } from '../web/narrator-reactions.ts';
import type { NarrationClip } from '../web/narration-types.ts';
const source=process.argv[2]; if(!source)throw new Error('Provide the complete verified reaction pack directory');
const raw=await readFile(path.join(source,'manifest.json'),'utf8');
const pack=JSON.parse(raw) as {packId:string;clips:Record<string,NarrationClip & {decodeVerified:boolean;family:string}>};
if(Object.keys(pack.clips).length!==12)throw new Error('All 12 reactions are required');
const runtime:Record<string,NarrationClip>={};
for(const [id,line] of Object.entries(reactionLines)){
 const clip=pack.clips[id];
 if(!clip||clip.id!==id||clip.text!==line.text||clip.family!==line.family||clip.status!=='ready'||!clip.decodeVerified||clip.url!==`audio/${id}.mp3`||!Number.isFinite(clip.durationSeconds)||clip.durationSeconds<=0)throw new Error(`Invalid reaction ${id}`);
 const bytes=await readFile(path.join(source,clip.url));
 if(bytes.length!==clip.bytes||createHash('sha256').update(bytes).digest('hex')!==clip.sha256)throw new Error(`Corrupt reaction ${id}`);
 const {url,text,status,durationSeconds,sha256}=clip;runtime[id]={id,url,text,status,durationSeconds,sha256,bytes:clip.bytes};
}
for(const clip of Object.values(runtime))await copyFile(path.join(source,clip.url),path.join('web',clip.url));
await writeFile('web/narrator-reaction-manifest.ts',"import type { NarrationManifest } from './narration-types.ts';\nexport const narratorReactionManifest: NarrationManifest = "+JSON.stringify(runtime,null,2)+';\n');
await writeFile('docs/narrator-preview/reaction-pack-receipt.json',JSON.stringify({packId:pack.packId,count:12,manifestSha256:createHash('sha256').update(raw).digest('hex'),runtimeBytes:Object.values(runtime).reduce((n,c)=>n+c.bytes,0),filesVerified:true,listeningAcceptance:false},null,2)+'\n');
console.log('Imported all 12 verified reactions');
