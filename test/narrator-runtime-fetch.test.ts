import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, readdir, rm, stat, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  downloadRuntimeArchive, ensureRuntimeAudio, readRuntimeArchive, runtimeAssetPlan, shouldFetchRuntimeAudio,
} from '../scripts/narrator-runtime-fetch.ts';
import type { RuntimeAsset, RuntimeRelease } from '../scripts/narrator-runtime-fetch.ts';
import { narratorRuntimeRelease } from '../scripts/narrator-runtime-release.ts';

const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const first = { name: 'audio/first.mp3', bytes: Buffer.from('first existing recording') };
const second = { name: 'audio/second.mp3', bytes: Buffer.from('second existing recording') };
const plan: RuntimeAsset[] = [first, second].map(entry => ({ file: entry.name, bytes: entry.bytes.length, sha256: hash(entry.bytes) }));
function checksum(header: Buffer) {
  header.fill(32, 148, 156);
  header.write(header.reduce((sum, byte) => sum + byte, 0).toString(8).padStart(6, '0') + '\0 ', 148, 'ascii');
}
function tar(entries: readonly { name: string; bytes: Buffer; type?: string; link?: string }[] = [first, second]) {
  const blocks: Buffer[] = [];
  for (const entry of entries) {
    const header = Buffer.alloc(512);
    header.write(entry.name, 0, 'ascii');
    header.write('0000644\0', 100, 'ascii');
    header.write('0000000\0', 108, 'ascii');
    header.write('0000000\0', 116, 'ascii');
    header.write(entry.bytes.length.toString(8).padStart(11, '0') + '\0', 124, 'ascii');
    header.write('00000000000\0', 136, 'ascii');
    header.write(entry.type ?? '0', 156, 'ascii');
    if (entry.link) header.write(entry.link, 157, 'ascii');
    header.write('ustar\0', 257, 'ascii');
    header.write('00', 263, 'ascii');
    checksum(header);
    blocks.push(header, entry.bytes, Buffer.alloc((512 - entry.bytes.length % 512) % 512));
  }
  return Buffer.concat([...blocks, Buffer.alloc(1024)]);
}
function pack(data: Buffer = tar()) {
  const archive = gzipSync(data);
  const release: RuntimeRelease = { ...narratorRuntimeRelease, bytes: archive.length, sha256: hash(archive) };
  return { archive, release };
}
async function destination(t: { after(callback: () => Promise<void>): void }) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'euchre-runtime-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}
function response(bytes: Buffer, headers?: HeadersInit) {
  return new Response(new Uint8Array(bytes), { status: 200, ...(headers ? { headers } : {}) });
}

// No test makes a real network request. The full catalog remains the checkout's trust root.
test('runtime release and catalog pin exactly the 2,181 preserved and additive recordings', () => {
  const entries = runtimeAssetPlan();
  assert.equal(entries.length, 2181);
  assert.equal(entries.reduce((sum, entry) => sum + entry.bytes, 0), 77_718_836);
  assert.equal(new Set(entries.map(entry => entry.file)).size, entries.length);
  assert.equal(narratorRuntimeRelease.bytes, 75_875_870);
  assert.equal(narratorRuntimeRelease.sha256, '3a8e5d21001c01247d3497481632d3535a01e819ee2ad2cd64c6003aec9524eb');
  assert.match(narratorRuntimeRelease.url, /\/peter-audio-20261011\/peter-runtime-audio-20261011\.tar\.gz$/);
});

test('only Netlify production and deploy-preview contexts fetch runtime media', () => {
  for (const CONTEXT of ['production', 'deploy-preview']) {
    assert.equal(shouldFetchRuntimeAudio({ NETLIFY: 'true', CONTEXT }), true);
    for (const NETLIFY of ['', 'false', '1']) assert.equal(shouldFetchRuntimeAudio({ NETLIFY, CONTEXT }), false);
    assert.equal(shouldFetchRuntimeAudio({ CONTEXT }), false);
  }
  for (const CONTEXT of ['', 'dev', 'branch-deploy', 'narrator-preview']) {
    assert.equal(shouldFetchRuntimeAudio({ NETLIFY: 'true', CONTEXT }), false);
  }
});

test('valid runtime archive restores only missing files and later reuses the verified cache', async t => {
  const root = await destination(t), { archive, release } = pack();
  await mkdir(path.join(root, 'audio'));
  await writeFile(path.join(root, first.name), first.bytes);
  const before = await stat(path.join(root, first.name));
  let downloads = 0;
  const download = async () => { downloads++; return archive; };
  assert.deepEqual(await ensureRuntimeAudio(root, release, plan, download), { verified: 2, restored: 1, preserved: 1 });
  assert.deepEqual(await readFile(path.join(root, second.name)), second.bytes);
  assert.equal((await stat(path.join(root, first.name))).mtimeMs, before.mtimeMs);
  assert.deepEqual(await readdir(root), ['audio']);
  assert.deepEqual((await readdir(path.join(root, 'audio'))).sort(), ['first.mp3', 'second.mp3']);
  assert.deepEqual(await ensureRuntimeAudio(root, release, plan, download), { verified: 2, restored: 0, preserved: 2 });
  assert.equal(downloads, 1);
});

test('mismatching cached recordings fail before downloading and never get overwritten', async t => {
  const root = await destination(t), { archive, release } = pack();
  await mkdir(path.join(root, 'audio'));
  await writeFile(path.join(root, second.name), 'preserve me');
  let downloads = 0;
  await assert.rejects(ensureRuntimeAudio(root, release, plan, async () => { downloads++; return archive; }), /Refusing to overwrite/);
  assert.equal(downloads, 0);
  assert.equal(await readFile(path.join(root, second.name), 'utf8'), 'preserve me');
  assert.deepEqual(await readdir(path.join(root, 'audio')), ['second.mp3']);
});

test('linked roots, directories and files are rejected before download', async t => {
  const root = await destination(t), real = await destination(t), { archive, release } = pack();
  let downloads = 0;
  const download = async () => { downloads++; return archive; };
  await symlink(real, path.join(root, 'linked'));
  await assert.rejects(ensureRuntimeAudio(path.join(root, 'linked'), release, plan, download), /real directory/);
  await symlink(real, path.join(root, 'audio'));
  await assert.rejects(ensureRuntimeAudio(root, release, plan, download), /link or special/);
  await rm(path.join(root, 'audio')); await mkdir(path.join(root, 'audio'));
  await writeFile(path.join(real, 'recording'), first.bytes);
  await symlink(path.join(real, 'recording'), path.join(root, first.name));
  await assert.rejects(ensureRuntimeAudio(root, release, plan, download), /link or special/);
  assert.equal(downloads, 0);
});

const invalidArchives: Array<{ label: string; data: () => Buffer; error: RegExp }> = [
  { label: 'missing recordings', data: () => tar([first]), error: /missing required/ },
  { label: 'unexpected recordings', data: () => tar([first, second, { ...first, name: 'audio/extra.mp3' }]), error: /Unexpected/ },
  { label: 'duplicate recordings', data: () => tar([first, first, second]), error: /Duplicate/ },
  { label: 'traversal paths', data: () => tar([{ ...first, name: '../outside.mp3' }, second]), error: /Unsafe/ },
  { label: 'absolute paths', data: () => tar([{ ...first, name: '/audio/first.mp3' }, second]), error: /Unsafe/ },
  { label: 'symbolic links', data: () => tar([{ ...first, type: '2', link: '/outside' }, second]), error: /Unsupported/ },
  { label: 'hard links', data: () => tar([{ ...first, type: '1', link: 'audio/second.mp3' }, second]), error: /Unsupported/ },
  { label: 'PAX headers', data: () => tar([{ ...first, type: 'x' }, second]), error: /Unsupported/ },
  { label: 'wrong recording size', data: () => tar([{ ...first, bytes: Buffer.from('short') }, second]), error: /Wrong.*size/ },
  { label: 'wrong recording hash', data: () => tar([{ ...first, bytes: Buffer.alloc(first.bytes.length) }, second]), error: /Wrong.*SHA256/ },
  { label: 'bad header checksums', data: () => { const b = tar(); b[100] = 49; return b; }, error: /header checksum/ },
  { label: 'bad file padding', data: () => { const b = tar(); b[512 + first.bytes.length] = 1; return b; }, error: /file padding/ },
  { label: 'bad end markers', data: () => { const b = tar(); b[b.length - 1] = 1; return b; }, error: /end marker/ },
  { label: 'missing end markers', data: () => tar().subarray(0, -1024), error: /end marker/ },
  { label: 'truncated tar', data: () => tar().subarray(0, -1), error: /Truncated/ },
  { label: 'oversized decompression', data: () => Buffer.alloc(10240 * 2), error: /larger than/ },
];
for (const example of invalidArchives) {
  test(`runtime archive rejects ${example.label} before restoring any file`, async t => {
    const root = await destination(t), { archive, release } = pack(example.data());
    await assert.rejects(ensureRuntimeAudio(root, release, plan, async () => archive), example.error);
    assert.deepEqual(await readdir(root), []);
  });
}

test('compressed archive hash and size are checked before gzip parsing', () => {
  const { archive, release } = pack();
  const damaged = Buffer.from(archive); damaged[0] = 0;
  assert.throws(() => readRuntimeArchive(damaged, release, plan), /size\/SHA256/);
  assert.throws(() => readRuntimeArchive(archive.subarray(1), release, plan), /size\/SHA256/);
  const malformed = Buffer.from('not a gzip stream');
  assert.throws(() => readRuntimeArchive(malformed, { ...release, bytes: malformed.length, sha256: hash(malformed) }, plan));
});

test('invalid and duplicate trusted plan identities are rejected without filesystem writes', async t => {
  const root = await destination(t), { archive, release } = pack();
  for (const invalid of [[...plan, plan[0]!], [{ ...plan[0]!, file: '../outside' }], [{ ...plan[0]!, bytes: 0 }], [{ ...plan[0]!, sha256: 'invalid' }], []]) {
    await assert.rejects(ensureRuntimeAudio(root, release, invalid, async () => archive), /Invalid|limits/);
  }
  assert.deepEqual(await readdir(root), []);
});

test('anonymous downloader accepts bounded official redirects and verifies complete bytes', async () => {
  const { archive, release } = pack();
  const seen: string[] = [];
  const fetcher: typeof fetch = async (url, options) => {
    seen.push(String(url));
    assert.equal(options?.redirect, 'manual'); assert.equal(options?.credentials, 'omit');
    assert.ok(options?.signal);
    assert.equal(new Headers(options?.headers).get('authorization'), null);
    return seen.length === 1
      ? new Response(null, { status: 302, headers: { location: 'https://release-assets.githubusercontent.com/example?token=signed-download' } })
      : response(archive, { 'content-length': String(archive.length) });
  };
  assert.deepEqual(await downloadRuntimeArchive(release, fetcher), archive);
  assert.equal(seen.length, 2);
});

test('downloader rejects unapproved starting URLs before sending a request', async () => {
  const { release } = pack(); let requests = 0;
  const fetcher: typeof fetch = async () => { requests++; throw new Error('must not request'); };
  for (const url of ['http://github.com/x', 'https://evil.test/archive', release.url + '?token=secret', release.url.replace(/peter-audio-[0-9]{8}/, 'latest')]) {
    await assert.rejects(downloadRuntimeArchive({ ...release, url }, fetcher), /Invalid pinned/);
  }
  assert.equal(requests, 0);
});

test('downloader rejects unsafe redirects before following them', async () => {
  const { release } = pack();
  for (const location of ['http://release-assets.githubusercontent.com/x', 'https://evil.test/x', 'https://release-assets.githubusercontent.com.evil.test/x', 'https://user:password@release-assets.githubusercontent.com/x', 'https://release-assets.githubusercontent.com:444/x', 'https://github.com/login', 'https://release-assets.githubusercontent.com/x#fragment']) {
    let requests = 0;
    await assert.rejects(downloadRuntimeArchive(release, async () => { requests++; return new Response(null, { status: 302, headers: { location } }); }), /approved/);
    assert.equal(requests, 1);
  }
});

test('downloader bounds redirect loops and rejects missing locations', async () => {
  const { release } = pack(); let requests = 0;
  await assert.rejects(downloadRuntimeArchive(release, async () => {
    requests++; return new Response(null, { status: 302, headers: { location: 'https://release-assets.githubusercontent.com/loop' } });
  }), /limit/);
  assert.equal(requests, 4);
  await assert.rejects(downloadRuntimeArchive(release, async () => new Response(null, { status: 302 })), /missing its location/);
});

test('downloader rejects HTTP errors, wrong lengths, corruption and oversized streams', async () => {
  const { archive, release } = pack();
  const bad: Array<{ response: () => Response; error: RegExp }> = [
    { response: () => new Response('missing', { status: 404 }), error: /HTTP 404/ },
    { response: () => response(archive, { 'content-length': String(archive.length + 1) }), error: /Content-Length/ },
    { response: () => response(archive, { 'content-encoding': 'gzip' }), error: /content encoding/ },
    { response: () => response(archive.subarray(1)), error: /size\/SHA256/ },
    { response: () => response(Buffer.alloc(archive.length)), error: /size\/SHA256/ },
    { response: () => response(Buffer.concat([archive, Buffer.from('extra')])), error: /exceeds/ },
  ];
  for (const example of bad) await assert.rejects(downloadRuntimeArchive(release, async () => example.response()), example.error);
});

test('downloader propagates connection failures and times out the entire request', async () => {
  const { release } = pack();
  await assert.rejects(downloadRuntimeArchive(release, async () => { throw new Error('connection failed'); }), /connection failed/);
  await assert.rejects(downloadRuntimeArchive(release, async (_url, options) => new Promise((_resolve, reject) => {
    options?.signal?.addEventListener('abort', () => reject(options.signal!.reason), { once: true });
  }), 20), /timed out/);
});

test('downloader detects interrupted response bodies and aborts a stalled stream', async () => {
  const { release } = pack();
  await assert.rejects(downloadRuntimeArchive(release, async () => new Response(new ReadableStream({
    start(controller) { controller.error(new Error('body interrupted')); },
  }))), /body interrupted/);
  await assert.rejects(downloadRuntimeArchive(release, async (_url, options) => new Response(new ReadableStream({
    start(controller) { options?.signal?.addEventListener('abort', () => controller.error(options.signal!.reason), { once: true }); },
  })), 20), /timed out/);
});

test('download failure leaves destination files untouched', async t => {
  const root = await destination(t), { release } = pack();
  await assert.rejects(ensureRuntimeAudio(root, release, plan, async () => { throw new Error('unavailable'); }), /unavailable/);
  assert.deepEqual(await readdir(root), []);
});

test('code-only deploy-preview builds fail closed before changing existing output', async t => {
  const root = await destination(t), script = fileURLToPath(new URL('../scripts/build.ts', import.meta.url));
  await mkdir(path.join(root, 'dist')); await writeFile(path.join(root, 'dist/existing.txt'), 'preserve');
  assert.throws(() => execFileSync(process.execPath, [script], {
    cwd: root, env: { ...process.env, NETLIFY: 'false', CONTEXT: 'deploy-preview' }, stdio: 'pipe',
  }), /Complete narration requires all 2181/);
  assert.equal(await readFile(path.join(root, 'dist/existing.txt'), 'utf8'), 'preserve');
  assert.deepEqual(await readdir(path.join(root, 'dist')), ['existing.txt']);
});
