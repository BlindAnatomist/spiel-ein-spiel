import { build } from 'esbuild';
import { mkdir, copyFile, rm, cp, readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { narratorManifest } from '../web/narrator-manifest.ts';
import { narratorWholeManifest } from '../web/narrator-whole-manifest.ts';
import { narratorCompleteManifest } from '../web/narrator-complete-manifest.ts';
import { narratorFlavorManifest } from '../web/narrator-flavor-manifest.ts';
import { narratorVariants } from '../web/narrator-variants.ts';
import { narrationAssets } from '../web/narrator-assets.ts';
import { wholeEventContract, acceptedAlternatives } from './narrator-whole-contract.ts';
import { completeEventContract } from './narrator-complete-contract.ts';

const clips = Object.values(narrationAssets);
const available = await Promise.all(clips.map(async clip => {
  try {
    if (clip.status !== 'ready' || !/^[a-z0-9.-]+$/.test(clip.id) || clip.url !== `audio/${clip.id}.mp3`
      || !Number.isFinite(clip.durationSeconds) || clip.durationSeconds <= 0
      || !Number.isInteger(clip.bytes) || clip.bytes <= 0 || !/^[a-f0-9]{64}$/.test(clip.sha256)) return false;
    const bytes = await readFile(`web/${clip.url}`);
    return bytes.length === clip.bytes && createHash('sha256').update(bytes).digest('hex') === clip.sha256;
  } catch { return false; }
}));
const wholeContract = { ...wholeEventContract(), ...acceptedAlternatives };
const completeContract = completeEventContract();
const flavorContract = Object.fromEntries(Object.values(narratorVariants).flat().map(line => [line.clip, line.text]));
const catalogSha = createHash('sha256').update(JSON.stringify(clips.map(clip => [clip.id, clip.sha256, clip.text]))).digest('hex');
const narratorAssetsReady = Object.keys(narratorManifest).length === 127
  && Object.keys(narratorWholeManifest).length === 381
  && Object.entries(wholeContract).every(([id, text]) => narratorWholeManifest[id]?.text === text)
  && Object.keys(narratorCompleteManifest).length === 1433
  && Object.entries(completeContract).every(([id, text]) => narratorCompleteManifest[id]?.text === text)
  && Object.keys(narratorFlavorManifest).length === 12
  && Object.entries(flavorContract).every(([id, text]) => narratorFlavorManifest[id]?.text === text)
  && clips.length === 1953 && available.every(Boolean);
if (!narratorAssetsReady) {
  const restore = 'Restore all private voice packs and run the import scripts. See docs/narrator-preview/COMPLETE_NARRATION.md.';
  if (process.env.CONTEXT === 'narrator-preview') throw new Error(`Complete narration requires all 1,953 runtime recordings. Partial catalogs cannot be published. ${restore}`);
  console.warn(`Private recordings are not in the code checkpoint. Peter option disabled in this build. ${restore}`);
}

await mkdir('dist', { recursive: true });
await rm('dist/layout-check', { recursive: true, force: true });
await build({
  entryPoints: ['web/main.ts'],
  bundle: true,
  outfile: 'dist/app.js',
  format: 'esm',
  target: 'safari16',
  minify: true,
  define: {
    __BUILD_COMMIT__: JSON.stringify(process.env.COMMIT_REF ?? 'development'),
    __DEPLOY_CONTEXT__: JSON.stringify(process.env.CONTEXT ?? 'development'),
    __NARRATOR_ASSETS_READY__: JSON.stringify(narratorAssetsReady),
    __NARRATOR_CATALOG_SHA__: JSON.stringify(catalogSha),
  },
});
for (const file of ['index.html', 'style.css']) await copyFile(`web/${file}`, `dist/${file}`);
// A new HTML document names its exact script content instead of reusing app.js.
for (const file of await readdir('dist')) if (/^app\.[a-f0-9]{16}\.js$/.test(file)) await rm(`dist/${file}`);
const appHash = createHash('sha256').update(await readFile('dist/app.js')).digest('hex').slice(0,16);
const versionedApp = `app.${appHash}.js`;
await copyFile('dist/app.js', `dist/${versionedApp}`);
const html = await readFile('dist/index.html', 'utf8');
if (!html.includes('src="app.js"')) throw new Error('Missing versionable app script');
await writeFile('dist/index.html', html.replace('src="app.js"', `src="${versionedApp}"`));
// Only local, prerecorded assets are shipped. No voice provider is called at runtime.
await rm('dist/audio', { recursive: true, force: true });
await cp('web/audio', 'dist/audio', { recursive: true });
await rm('dist/repair-audio', { recursive: true, force: true });
if (narratorAssetsReady) {
  const checksums = await readFile('web/repair-audio/checksums.sha256', 'utf8');
  for (const line of checksums.trim().split('\n')) {
    const match = /^([a-f0-9]{64})  (audio\/[a-z0-9.-]+\.(?:mp3|wav)|index\.html|measurements\.json)$/.exec(line);
    if (!match) throw new Error('Invalid voice-comparison checksum entry');
    const bytes = await readFile(`web/repair-audio/${match[2]}`);
    if (createHash('sha256').update(bytes).digest('hex') !== match[1]) throw new Error(`Unverified comparison file: ${match[2]}`);
  }
  await cp('web/repair-audio', 'dist/repair-audio', { recursive: true });
}


// Browser-only regression fixtures are published only with an isolated PR preview.
if (process.env.CONTEXT === 'deploy-preview') {
  const { execFileSync } = await import('node:child_process');
  execFileSync(process.execPath, ['scripts/mobile-layout-fixtures.ts', 'dist/layout-check'], { stdio: 'inherit' });
}
