import { readFile, writeFile, mkdir, lstat, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { assertAdditiveReactionImport, validateReactionBatches } from './narrator-extra-contract.ts';
import { extraReactionLines } from '../web/narrator-extra-reactions.ts';
import { narratorExtraReactionManifest } from '../web/narrator-extra-reaction-manifest.ts';
import { narrationAssets } from '../web/narrator-assets.ts';

const sha256 = (data: Buffer | string) => createHash('sha256').update(data).digest('hex');
const identity = (data: object) => sha256(JSON.stringify(Object.entries(data).sort(([a], [b]) => a.localeCompare(b))));

/** A one-time additive path for exactly the reviewed batch08 and frozen main catalog.
 * Prior raw production packs need not be regenerated or reinterpreted. Every old
 * runtime byte is verified; the existing all-pack importer remains available.
 */
export async function prepareBatch08(directory: string, proposal: string, oldMediaRoot: string) {
  if (Object.keys(narrationAssets).length !== 2133
    || identity(narrationAssets) !== '23c3f6feabb143173ed66f0ac54fb51ba6522a9cacd2876c60a0bb218e98fc66'
    || identity(extraReactionLines) !== 'e578feee7bc26c2d4d472a418897235b64f0db83bd6667f45222006a890d2e99'
    || identity(narratorExtraReactionManifest) !== '50887dd1e27913639fadf59e0f343e558b35ec3a7c759f861c7b75b3b718b0ab')
    throw new Error('Additive batch08 requires the unchanged reviewed 2133-recording baseline');
  const added = await validateReactionBatches([{directory, proposal}]);
  if (added.packs.length !== 1 || added.packs[0]!.packId !== 'peter-euchre-library-batch08-20261011'
    || added.packs[0]!.proposalSha256 !== 'a5d2d033827d666a6f2bdc2367384f9ce29ba0eaaea6b5f8adda3edb06c6552b')
    throw new Error('This additive importer accepts only the reviewed batch08');
  const lines = {...extraReactionLines, ...added.lines};
  const runtime = {...narratorExtraReactionManifest, ...added.runtime};
  assertAdditiveReactionImport(lines, runtime, extraReactionLines, narratorExtraReactionManifest, narrationAssets);
  const root = await realpath(oldMediaRoot);
  const audioBytes = new Map(added.audioBytes);
  for (const clip of Object.values(narrationAssets)) {
    const file = path.join(root, clip.url), resolved = await realpath(file);
    if (!(await lstat(file)).isFile() || !resolved.startsWith(root + path.sep)) throw new Error(`Unsafe old audio ${clip.id}`);
    const bytes = await readFile(file);
    if (bytes.length !== clip.bytes || sha256(bytes) !== clip.sha256) throw new Error(`Changed old audio ${clip.id}`);
    audioBytes.set(clip.id, bytes);
  }
  return {lines, runtime, audioBytes, packs: added.packs};
}

// Output is an exclusive NEW staging directory. This never edits the source repo,
// old media, original recording pack, runtime release pin, or deployment settings.
if (import.meta.main) {
  const [directory, proposal, oldMediaRoot, output, ...extra] = process.argv.slice(2);
  if (!directory || !proposal || !oldMediaRoot || !output || extra.length) throw new Error('Usage: node scripts/import-narrator-batch08.ts PACK PROPOSAL OLD_MEDIA_ROOT NEW_STAGING_DIRECTORY');
  const result = await prepareBatch08(directory, proposal, oldMediaRoot);
  await mkdir(output); // fail rather than overwrite/reuse an existing staging tree
  await mkdir(path.join(output, 'web/audio'), {recursive: true});
  await mkdir(path.join(output, 'docs/narrator-preview'), {recursive: true});
  for (const [id, bytes] of result.audioBytes) await writeFile(path.join(output, `web/audio/${id}.mp3`), bytes, {flag: 'wx'});
  await writeFile(path.join(output, 'web/narrator-extra-reactions.ts'), "import type { NarrationAlternative } from './narration-types.ts';\nimport type { ReactionTrigger } from './narrator-reaction-triggers.ts';\n/** Editorially approved, mechanically verified complete recordings only. */\nexport const extraReactionLines: Readonly<Record<string, NarrationAlternative & { readonly trigger: ReactionTrigger }>> = " + JSON.stringify(result.lines, null, 2) + ';\n', {flag: 'wx'});
  await writeFile(path.join(output, 'web/narrator-extra-reaction-manifest.ts'), "import type { NarrationManifest } from './narration-types.ts';\nexport const narratorExtraReactionManifest: NarrationManifest = " + JSON.stringify(result.runtime, null, 2) + ';\n', {flag: 'wx'});
  await writeFile(path.join(output, 'docs/narrator-preview/extra-reaction-batch08-receipt.json'), JSON.stringify({
    targetCount: 192, count: Object.keys(result.runtime).length, totalRuntimeRecordings: result.audioBytes.size,
    preservedRuntimeRecordings: 2133, addedRecordings: 24, packs: result.packs,
    filesVerified: true, listeningAcceptance: false, speechContentVerified: false, audibleQualityVerified: false,
    iphoneVoiceOverVerified: false, publicationPerformed: false,
  }, null, 2) + '\n', {flag: 'wx'});
  console.log(`Prepared ${result.audioBytes.size} runtime recordings in new local staging directory; publication and perceptual acceptance remain separate.`);
}
