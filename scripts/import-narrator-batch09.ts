import { readFile, writeFile, mkdir, lstat, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { assertAdditiveReactionImport, validateReactionBatches } from './narrator-extra-contract.ts';
import { extraReactionLines } from '../web/narrator-extra-reactions.ts';
import { narratorExtraReactionManifest } from '../web/narrator-extra-reaction-manifest.ts';
import { narrationAssets } from '../web/narrator-assets.ts';

const sha256 = (data: Buffer | string) => createHash('sha256').update(data).digest('hex');
const identity = (data: object) => sha256(JSON.stringify(Object.entries(data).sort(([a], [b]) => a.localeCompare(b))));

/** A one-time additive path for exactly the reviewed batch09 and frozen baseline plus batch08 catalog.
 * Prior raw production packs need not be regenerated or reinterpreted. Every old
 * runtime byte is verified; the existing all-pack importer remains available.
 */
export async function prepareBatch09(directory: string, proposal: string, oldMediaRoot: string) {
  if (Object.keys(narrationAssets).length !== 2157
    || identity(narrationAssets) !== '84d671136ebde7fdfa0d010882e8a030c5099a7476dae8d5b9e24dc2ffb4881b'
    || identity(extraReactionLines) !== '50137d10f258f6773c8e1c63d149e473fae435a6936e38b56311387603fc3d4f'
    || identity(narratorExtraReactionManifest) !== '9a04fce439daeede45044248494219c53f02f76ab1a3dd25fd97d12ce072e93b')
    throw new Error('Additive batch09 requires the unchanged reviewed 2157-recording baseline');
  const added = await validateReactionBatches([{directory, proposal}]);
  if (added.packs.length !== 1 || added.packs[0]!.packId !== 'peter-euchre-library-batch09-20261011'
    || added.packs[0]!.proposalSha256 !== '97adc6bd0e4e560ba2aa4b3a79d17b0b83630abf8e4d5fc499dc42eb3051c855')
    throw new Error('This additive importer accepts only the reviewed batch09');
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
  if (!directory || !proposal || !oldMediaRoot || !output || extra.length) throw new Error('Usage: node scripts/import-narrator-batch09.ts PACK PROPOSAL OLD_MEDIA_ROOT NEW_STAGING_DIRECTORY');
  const result = await prepareBatch09(directory, proposal, oldMediaRoot);
  await mkdir(output); // fail rather than overwrite/reuse an existing staging tree
  await mkdir(path.join(output, 'web/audio'), {recursive: true});
  await mkdir(path.join(output, 'docs/narrator-preview'), {recursive: true});
  for (const [id, bytes] of result.audioBytes) await writeFile(path.join(output, `web/audio/${id}.mp3`), bytes, {flag: 'wx'});
  await writeFile(path.join(output, 'web/narrator-extra-reactions.ts'), "import type { NarrationAlternative } from './narration-types.ts';\nimport type { ReactionTrigger } from './narrator-reaction-triggers.ts';\n/** Editorially approved, mechanically verified complete recordings only. */\nexport const extraReactionLines: Readonly<Record<string, NarrationAlternative & { readonly trigger: ReactionTrigger }>> = " + JSON.stringify(result.lines, null, 2) + ';\n', {flag: 'wx'});
  await writeFile(path.join(output, 'web/narrator-extra-reaction-manifest.ts'), "import type { NarrationManifest } from './narration-types.ts';\nexport const narratorExtraReactionManifest: NarrationManifest = " + JSON.stringify(result.runtime, null, 2) + ';\n', {flag: 'wx'});
  await writeFile(path.join(output, 'docs/narrator-preview/extra-reaction-batch09-receipt.json'), JSON.stringify({
    targetCount: 216, count: Object.keys(result.runtime).length, totalRuntimeRecordings: result.audioBytes.size,
    preservedRuntimeRecordings: 2157, addedRecordings: 24, packs: result.packs,
    filesVerified: true, listeningAcceptance: false, speechContentVerified: false, audibleQualityVerified: false,
    iphoneVoiceOverVerified: false, publicationPerformed: false,
  }, null, 2) + '\n', {flag: 'wx'});
  console.log(`Prepared ${result.audioBytes.size} runtime recordings in new local staging directory; publication and perceptual acceptance remain separate.`);
}
