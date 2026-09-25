import { build } from 'esbuild';
import { mkdir, copyFile } from 'node:fs/promises';

await mkdir('dist', { recursive: true });
await build({
  entryPoints: ['web/main.ts'],
  bundle: true,
  outfile: 'dist/app.js',
  format: 'esm',
  target: 'safari16',
  minify: true,
  define: {
    __BUILD_COMMIT__: JSON.stringify(process.env.COMMIT_REF ?? 'development'),
  },
});
for (const file of ['index.html', 'style.css']) await copyFile(`web/${file}`, `dist/${file}`);
