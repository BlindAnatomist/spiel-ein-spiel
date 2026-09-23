import { build } from 'esbuild';
import { mkdir, copyFile } from 'node:fs/promises';
await mkdir('dist', { recursive: true });
await build({ entryPoints: ['web/main.ts'], bundle: true, outfile: 'dist/app.js', format: 'esm', target: 'safari16', minify: true });
for (const file of ['index.html', 'style.css']) await copyFile(`web/${file}`, `dist/${file}`);

// Browser-only regression fixtures are published only with an isolated PR preview.
if (process.env.CONTEXT === 'deploy-preview') {
  const { execFileSync } = await import('node:child_process');
  execFileSync(process.execPath, ['scripts/mobile-layout-fixtures.ts', 'dist/layout-check'], { stdio: 'inherit' });
}
