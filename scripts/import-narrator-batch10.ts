import { readFile, writeFile, mkdir, lstat, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { assertAdditiveReactionImport } from './narrator-extra-contract.ts';
import { extraReactionLines } from '../web/narrator-extra-reactions.ts';
import { narratorExtraReactionManifest } from '../web/narrator-extra-reaction-manifest.ts';
import { narrationAssets } from '../web/narrator-assets.ts';
import { reactionTriggerMetadata, type ReactionTrigger } from '../web/narrator-reaction-triggers.ts';
import type { NarrationAlternative, NarrationClip } from '../web/narration-types.ts';

const hash = (data: Buffer | string) => createHash('sha256').update(data).digest('hex');
const identity = (data: object) => hash(JSON.stringify(Object.entries(data).sort(([a], [b]) => a.localeCompare(b))));
export const batch10Pins = {
  proposal: 'b3c573bb1088a676cd3779b27c4a20c30ac4d22e5b732a3abad6bc3baceddc31',
  manifest: '301ee9b97e3665bc52f601153a1efc9eb750cfecabe31a9044058aad98af34af',
  independentQa: 'f2945e963d9097418b93513551dc294c8ce6476b21f7547f65004ee72bf1a899',
} as const;
async function safeRead(root: string, name: string) {
  if (path.isAbsolute(name) || name.split(/[\\/]/).includes('..')) throw new Error('Unsafe evidence path');
  const base = await realpath(root), file = path.join(base, name), resolved = await realpath(file);
  if (!(await lstat(file)).isFile() || !resolved.startsWith(base + path.sep)) throw new Error('Unsafe evidence path');
  return readFile(file);
}
/** Frozen, additive batch10 route. It accepts the exact independently checked pack,
 * not arbitrary QA claims. The older provenance validators remain unchanged.
 * Exact evidence identity establishes mechanical provenance, not listening acceptance.
 */
export async function prepareBatch10(directory: string, qaDirectory: string, oldMediaRoot: string) {
  const proposalBytes = await safeRead(directory, 'approved-candidate24.json');
  const manifestBytes = await safeRead(directory, 'manifest.json');
  const qaBytes = await safeRead(qaDirectory, 'independent-qa.json');
  if (hash(proposalBytes) !== batch10Pins.proposal || hash(manifestBytes) !== batch10Pins.manifest
    || hash(qaBytes) !== batch10Pins.independentQa) throw new Error('Changed frozen batch10 evidence');
  const proposal = JSON.parse(proposalBytes.toString()), pack = JSON.parse(manifestBytes.toString());
  const ids = new Set<string>(proposal.lines.map((line: {clip: string}) => line.clip));
  const baseline = <T>(catalog: Readonly<Record<string, T>>) => Object.fromEntries(Object.entries(catalog).filter(([id]) => !ids.has(id)));
  const oldAssets = baseline(narrationAssets), oldLines = baseline(extraReactionLines), oldRuntime = baseline(narratorExtraReactionManifest);
  if (Object.keys(oldAssets).length !== 2181 || identity(oldAssets) !== '80fed978c803437f84d1cd779055bb2f900fd4f0cfae212375252c4868567953'
    || identity(oldLines) !== '99ca9f80239dcef7295d9a36c64db513eed6cb17cc17271a9fb1cb5abad8a87d'
    || identity(oldRuntime) !== 'a0c50dbd4514859aa03727d3e68190e756321436d6d8678cc3e8d4aa5f8d5677') throw new Error('Changed 2181-recording baseline');
  const lines: Record<string, NarrationAlternative & {readonly trigger: ReactionTrigger}> = {...oldLines};
  const runtime: Record<string, NarrationClip> = {...oldRuntime};
  const audioBytes = new Map<string, Buffer>();
  for (const clip of pack.clips) {
    const approved = proposal.lines.find((line: {clip: string}) => line.clip === clip.clip);
    if (!approved || ['clip','text','trigger','family','context','priority'].some(key => approved[key] !== clip[key])
      || !Object.hasOwn(reactionTriggerMetadata, clip.trigger)) throw new Error('Batch10 mapping mismatch');
    const trigger = clip.trigger as ReactionTrigger;
    for (const kind of ['raw', 'master']) {
      const item = clip[kind], bytes = await safeRead(directory, item.path);
      if (bytes.length !== item.bytes || hash(bytes) !== item.sha256) throw new Error(`Corrupt batch10 ${kind}: ${clip.clip}`);
      if (kind === 'master') audioBytes.set(clip.clip, bytes);
    }
    lines[clip.clip] = {clip: clip.clip, text: clip.text, family: clip.family, ...reactionTriggerMetadata[trigger], trigger};
    runtime[clip.clip] = {id: clip.clip, url: `audio/${clip.clip}.mp3`, text: clip.text, status: 'ready', durationSeconds: clip.durationSeconds, sha256: clip.master.sha256, bytes: clip.master.bytes};
    if (Object.hasOwn(extraReactionLines, clip.clip) && (!isDeepStrictEqual(extraReactionLines[clip.clip], lines[clip.clip])
      || !isDeepStrictEqual(narratorExtraReactionManifest[clip.clip], runtime[clip.clip]))) throw new Error('Changed integrated batch10 metadata');
  }
  assertAdditiveReactionImport(lines, runtime, oldLines, oldRuntime, oldAssets);
  for (const clip of Object.values(oldAssets)) {
    const bytes = await safeRead(oldMediaRoot, clip.url);
    if (bytes.length !== clip.bytes || hash(bytes) !== clip.sha256) throw new Error(`Changed old audio ${clip.id}`);
    audioBytes.set(clip.id, bytes);
  }
  if (audioBytes.size !== 2205 || Object.keys(lines).length !== 240) throw new Error('Incomplete batch10 integration');
  return {lines, runtime, audioBytes};
}
if (import.meta.main) {
  const [directory, qaDirectory, oldMediaRoot, output, ...extra] = process.argv.slice(2);
  if (!directory || !qaDirectory || !oldMediaRoot || !output || extra.length) throw new Error('Usage: node scripts/import-narrator-batch10.ts PACK QA OLD_MEDIA_ROOT NEW_STAGING_DIRECTORY');
  const result = await prepareBatch10(directory, qaDirectory, oldMediaRoot);
  await mkdir(output);
  await mkdir(path.join(output, 'web/audio'), {recursive: true});
  for (const [id, bytes] of result.audioBytes) await writeFile(path.join(output, `web/audio/${id}.mp3`), bytes, {flag: 'wx'});
  await writeFile(path.join(output, 'web/narrator-extra-reactions.ts'), "import type { NarrationAlternative } from './narration-types.ts';\nimport type { ReactionTrigger } from './narrator-reaction-triggers.ts';\n/** Editorially approved, mechanically verified complete recordings only. */\nexport const extraReactionLines: Readonly<Record<string, NarrationAlternative & { readonly trigger: ReactionTrigger }>> = " + JSON.stringify(result.lines, null, 2) + ';\n', {flag: 'wx'});
  await writeFile(path.join(output, 'web/narrator-extra-reaction-manifest.ts'), "import type { NarrationManifest } from './narration-types.ts';\nexport const narratorExtraReactionManifest: NarrationManifest = " + JSON.stringify(result.runtime, null, 2) + ';\n', {flag: 'wx'});
  console.log('Prepared exactly 2205 recordings, preserving all 2181 prior recordings. Listening acceptance remains open.');
}
