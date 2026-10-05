import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import type { NarrationClip } from '../web/narration-types.ts';
import { narratorVariants } from '../web/narrator-variants.ts';
import { completeEventContract } from './narrator-complete-contract.ts';

const [source, mode = 'canonical'] = process.argv.slice(2);
if (!source || !['canonical', 'flavor'].includes(mode)) throw new Error('Usage: node scripts/import-narrator-complete-pack.ts /path/to/whole-stage2 [canonical|flavor]');
const flavor = mode === 'flavor';
const rawManifest = await readFile(path.join(source, `${mode}-manifest.json`), 'utf8');
const pack = JSON.parse(rawManifest) as { packId: string; revision: string; clips: Record<string, NarrationClip & { decodeVerified: boolean; canonicalEventKey?: string; family?: string }> };
const alternatives = Object.entries(narratorVariants).flatMap(([eventKey, values]) => values.map(value => ({eventKey, ...value})));
const expected = flavor ? Object.fromEntries(alternatives.map(value => [value.clip, value.text])) : completeEventContract();
const count = flavor ? 12 : 1433;
if (Object.keys(pack.clips).length !== count || Object.keys(expected).length !== count) throw new Error(`Expected all ${count} ${mode} recordings`);
const runtime: Record<string, NarrationClip> = {};
for (const [id, text] of Object.entries(expected)) {
  const clip = pack.clips[id];
  if (!clip || clip.id !== id || clip.text !== text || clip.status !== 'ready' || !clip.decodeVerified || clip.url !== `audio/${id}.mp3`) throw new Error(`Unverified ${mode} clip ${id}`);
  const alternative = flavor ? alternatives.find(value => value.clip === id) : undefined;
  if (alternative && (clip.canonicalEventKey !== alternative.eventKey || clip.family !== alternative.family)) throw new Error(`Incorrect flavor event/family ${id}`);
  const bytes = await readFile(path.join(source, clip.url));
  if (bytes.length !== clip.bytes || createHash('sha256').update(bytes).digest('hex') !== clip.sha256) throw new Error(`Integrity failure ${id}`);
  if (!Number.isFinite(clip.durationSeconds) || clip.durationSeconds <= 0) throw new Error(`Invalid duration ${id}`);
  const {url, status, durationSeconds, sha256} = clip;
  runtime[id] = {id, url, text, status, durationSeconds, sha256, bytes: clip.bytes};
}
await mkdir('web/audio', {recursive: true});
for (const clip of Object.values(runtime)) await copyFile(path.join(source, clip.url), path.join('web', clip.url));
const variable = flavor ? 'narratorFlavorManifest' : 'narratorCompleteManifest';
const file = flavor ? 'narrator-flavor-manifest' : 'narrator-complete-manifest';
await writeFile(`web/${file}.ts`, "import type { NarrationManifest } from './narration-types.ts';\n// Generated only from a complete, checksum/decode-verified pack.\nexport const " + variable + ': NarrationManifest = ' + JSON.stringify(runtime, null, 2) + ';\n');
// Detailed generation receipts and raw sources stay in the private recovery pack.
await writeFile(`docs/narrator-preview/${mode}-pack-receipt.json`, JSON.stringify({packId:pack.packId, revision:pack.revision, count, manifestSha256:createHash('sha256').update(rawManifest).digest('hex'), runtimeBytes:Object.values(runtime).reduce((sum,clip)=>sum+clip.bytes,0), filesVerified:true, listeningAcceptance:false}, null, 2)+'\n');
console.log(`Imported ${count} verified ${mode} recordings.`);
