import { readFile, writeFile, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { validateReactionBatches } from './narrator-extra-contract.ts';
import { narratorExtraReactionManifest } from '../web/narrator-extra-reaction-manifest.ts';
import { CHARACTER_LIBRARY_TARGET } from '../web/narrator-reaction-triggers.ts';

// Supply the entire approved set as repeated PACK_DIRECTORY APPROVED_PROPOSAL pairs.
// The explicit proposals are chosen after editorial approval; drafts are never scanned.
const args = process.argv.slice(2);
if (!args.length || args.length % 2) throw new Error('Usage: node scripts/import-narrator-extra-reactions.ts PACK_DIRECTORY APPROVED_PROPOSAL [PACK_DIRECTORY APPROVED_PROPOSAL ...]');
const inputs = Array.from({ length: args.length / 2 }, (_, index) => ({ directory: args[index * 2]!, proposal: args[index * 2 + 1]! }));
const { lines, runtime, sources, packs } = await validateReactionBatches(inputs);
for (const [id, old] of Object.entries(narratorExtraReactionManifest)) {
  if (JSON.stringify(runtime[id]) !== JSON.stringify(old)) throw new Error(`Import would remove or replace preserved recording ${id}`);
}
for (const clip of Object.values(runtime)) {
  try {
    const existing = await readFile(`web/${clip.url}`);
    if (createHash('sha256').update(existing).digest('hex') !== clip.sha256) throw new Error(`Import would overwrite audio ${clip.id}`);
  } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
}
for (const clip of Object.values(runtime)) await copyFile(sources.get(clip.id)!, `web/${clip.url}`);
await writeFile('web/narrator-extra-reactions.ts', "import type { NarrationAlternative } from './narration-types.ts';\nimport type { ReactionTrigger } from './narrator-reaction-triggers.ts';\n/** Editorially approved, mechanically verified complete recordings only. */\nexport const extraReactionLines: Readonly<Record<string, NarrationAlternative & { readonly trigger: ReactionTrigger }>> = " + JSON.stringify(lines, null, 2) + ';\n');
await writeFile('web/narrator-extra-reaction-manifest.ts', "import type { NarrationManifest } from './narration-types.ts';\nexport const narratorExtraReactionManifest: NarrationManifest = " + JSON.stringify(runtime, null, 2) + ';\n');
const count = Object.keys(runtime).length;
await writeFile('docs/narrator-preview/extra-reaction-pack-receipt.json', JSON.stringify({ targetCount: CHARACTER_LIBRARY_TARGET, count, complete: count === CHARACTER_LIBRARY_TARGET, packs, runtimeBytes: Object.values(runtime).reduce((n, c) => n + c.bytes, 0), filesVerified: true, listeningAcceptance: false }, null, 2) + '\n');
console.log(`Imported ${count}/${CHARACTER_LIBRARY_TARGET} verified approved reactions; ${count === CHARACTER_LIBRARY_TARGET ? 'catalog complete, independent release review still required' : 'partial catalog remains publication-blocked'}`);
