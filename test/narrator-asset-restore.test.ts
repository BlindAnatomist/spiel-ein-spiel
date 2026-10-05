import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, readdir, rm, stat, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { narratorAssetPlan, restoreVerifiedAssets } from '../scripts/narrator-asset-restore.ts';

async function fixture(t: { after(callback: () => Promise<void>): void }) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'euchre-assets-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = path.join(root, 'source'), destination = path.join(root, 'destination');
  await mkdir(path.join(source, 'audio'), { recursive: true });
  await mkdir(destination);
  const bytes = Buffer.from('verified fixture bytes');
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const plan = [{ file: 'audio/example.mp3', bytes: bytes.length, sha256 }];
  await writeFile(path.join(source, plan[0]!.file), bytes);
  return { root, source, destination, bytes, plan };
}

test('private restoration copies only trusted files and preserves matching bytes and timestamps on retry', async t => {
  const f = await fixture(t);
  await writeFile(path.join(f.source, 'do-not-copy.txt'), 'private unrelated data');
  const first = await restoreVerifiedAssets(f.source, f.destination, f.plan);
  assert.equal(first.restored, 1);
  const file = path.join(f.destination, f.plan[0]!.file), before = await stat(file);
  const retry = await restoreVerifiedAssets(f.source, f.destination, f.plan);
  assert.equal(retry.restored, 0); assert.equal(retry.preserved, 1);
  assert.deepEqual(await readFile(file), f.bytes);
  assert.equal((await stat(file)).mtimeMs, before.mtimeMs);
  assert.deepEqual(await readdir(f.destination), ['audio']);
});

test('missing or corrupted later source prevents all restoration writes', async t => {
  for (const mode of ['missing', 'hash', 'size'] as const) {
    const f = await fixture(t);
    const second = { ...f.plan[0]!, file: 'audio/later.mp3' };
    if (mode !== 'missing') await writeFile(path.join(f.source, second.file), mode === 'hash' ? Buffer.alloc(f.bytes.length) : Buffer.from('short'));
    await assert.rejects(restoreVerifiedAssets(f.source, f.destination, [...f.plan, second]));
    assert.deepEqual(await readdir(f.destination), []);
  }
});

test('different destination bytes are preserved rather than silently overwritten', async t => {
  const f = await fixture(t); await mkdir(path.join(f.destination, 'audio'));
  const file = path.join(f.destination, f.plan[0]!.file); await writeFile(file, 'keep me');
  await assert.rejects(restoreVerifiedAssets(f.source, f.destination, f.plan), /Refusing to overwrite/);
  assert.equal(await readFile(file, 'utf8'), 'keep me');
});

test('unsafe, duplicate and linked inputs are rejected without importing input code', async t => {
  const f = await fixture(t);
  await assert.rejects(restoreVerifiedAssets(f.source, f.destination, [{ ...f.plan[0]!, file: '../outside.mp3' }]), /Unsafe/);
  await assert.rejects(restoreVerifiedAssets(f.source, f.destination, [...f.plan, ...f.plan]), /duplicate/);
  await rm(path.join(f.source, f.plan[0]!.file));
  const outside = path.join(f.root, 'outside'); await writeFile(outside, f.bytes);
  await symlink(outside, path.join(f.source, f.plan[0]!.file));
  await assert.rejects(restoreVerifiedAssets(f.source, f.destination, f.plan), /links/);
  assert.deepEqual(await readdir(f.destination), []);
});

test('the complete restore plan is pinned to all runtime recordings and trusted comparison assets', async () => {
  const plan = await narratorAssetPlan('web');
  assert.equal(plan.filter(entry => entry.file.startsWith('audio/')).length, 2133);
  assert.equal(plan.filter(entry => entry.file.startsWith('repair-audio/')).length, 10);
  assert.equal(new Set(plan.map(entry => entry.file)).size, plan.length);
});

test('production and private-preview builds fail closed before touching output when media is missing', async t => {
  const f = await fixture(t), script = fileURLToPath(new URL('../scripts/build.ts', import.meta.url));
  await mkdir(path.join(f.root, 'dist')); await writeFile(path.join(f.root, 'dist/existing.txt'), 'preserve');
  for (const context of ['production', 'narrator-preview']) {
    assert.throws(() => execFileSync(process.execPath, [script], { cwd: f.root, env: { ...process.env, CONTEXT: context }, stdio: 'pipe' }), /Complete narration requires all 2133/);
  }
  assert.equal(await readFile(path.join(f.root, 'dist/existing.txt'), 'utf8'), 'preserve');
  assert.deepEqual(await readdir(path.join(f.root, 'dist')), ['existing.txt']);
});
