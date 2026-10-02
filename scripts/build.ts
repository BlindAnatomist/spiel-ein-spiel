import { build } from 'esbuild';
import { mkdir, copyFile, rm, cp, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { narratorManifest } from '../web/narrator-manifest.ts';

const clips = Object.values(narratorManifest);
const available = await Promise.all(clips.map(async clip => {
  try {
    const bytes = await readFile(`web/${clip.url}`);
    return bytes.length === clip.bytes && createHash('sha256').update(bytes).digest('hex') === clip.sha256;
  } catch { return false; }
}));
const narratorAssetsReady = clips.length === 127 && available.every(Boolean);
if (!narratorAssetsReady) {
  const restore = 'Restore the private voice-pack Library ZIP and run node scripts/import-narrator-pack.ts /path/to/extracted/pack. See docs/narrator-preview/CHECKPOINT.md.';
  if (process.env.CONTEXT === 'narrator-preview') throw new Error(`Narrator preview requires all 127 verified recordings. ${restore}`);
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
  },
});
for (const file of ['index.html', 'style.css']) await copyFile(`web/${file}`, `dist/${file}`);
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
