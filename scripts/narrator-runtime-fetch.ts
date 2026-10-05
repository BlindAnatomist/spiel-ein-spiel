import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { narrationAssets } from '../web/narrator-assets.ts';
import { narratorRuntimeRelease } from './narrator-runtime-release.ts';

export interface RuntimeRelease {
  readonly url: string;
  readonly bytes: number;
  readonly sha256: string;
}
export interface RuntimeAsset {
  readonly file: string;
  readonly bytes: number;
  readonly sha256: string;
}
type FetchArchive = (release: RuntimeRelease) => Promise<Buffer>;
const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const missing = (error: unknown) => (error as NodeJS.ErrnoException)?.code === 'ENOENT';
const MAX_BYTES = 100 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const DOWNLOAD_TIMEOUT_MS = 120_000;
const ASSET_HOSTS = new Set(['release-assets.githubusercontent.com', 'objects.githubusercontent.com']);

export function shouldFetchRuntimeAudio(env: NodeJS.ProcessEnv): boolean {
  return env.NETLIFY === 'true' && ['production', 'deploy-preview'].includes(env.CONTEXT ?? '');
}

export function runtimeAssetPlan(): RuntimeAsset[] {
  const plan = Object.values(narrationAssets).map(clip => {
    if (clip.status !== 'ready' || clip.url !== `audio/${clip.id}.mp3`) {
      throw new Error(`Invalid runtime recording metadata: ${clip.id}`);
    }
    return { file: clip.url, bytes: clip.bytes, sha256: clip.sha256 };
  });
  validatePlan(plan);
  return plan;
}

function validatePlan(plan: readonly RuntimeAsset[]) {
  const names = new Set<string>();
  let total = 0;
  for (const entry of plan) {
    if (!/^audio\/[a-z0-9][a-z0-9.-]*\.mp3$/.test(entry.file)
      || names.has(entry.file) || !/^[a-f0-9]{64}$/.test(entry.sha256)
      || !Number.isSafeInteger(entry.bytes) || entry.bytes <= 0) {
      throw new Error(`Invalid or duplicate runtime asset: ${entry.file}`);
    }
    names.add(entry.file);
    total += entry.bytes;
  }
  if (!plan.length || plan.length > 3_000 || total > MAX_BYTES) throw new Error('Runtime asset plan exceeds limits');
}

function validateRelease(release: RuntimeRelease) {
  // A URL override, token or "latest" shortcut cannot silently change the source.
  if (!/^https:\/\/github\.com\/BlindAnatomist\/spiel-ein-spiel\/releases\/download\/peter-audio-[0-9]{8}\/peter-runtime-audio-[0-9]{8}\.tar\.gz$/.test(release.url)
    || !Number.isSafeInteger(release.bytes) || release.bytes <= 0 || release.bytes > MAX_BYTES
    || !/^[a-f0-9]{64}$/.test(release.sha256)) throw new Error('Invalid pinned runtime release');
}

function validateRedirect(url: URL) {
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash
    || !ASSET_HOSTS.has(url.hostname)) throw new Error('Runtime archive redirect is not an approved GitHub asset host');
}

/** Anonymous, bounded HTTPS only. Verify the complete compressed bytes before parsing. */
export async function downloadRuntimeArchive(
  release: RuntimeRelease,
  fetcher: typeof fetch = fetch,
  timeoutMs = DOWNLOAD_TIMEOUT_MS,
): Promise<Buffer> {
  validateRelease(release);
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > DOWNLOAD_TIMEOUT_MS) {
    throw new Error('Invalid runtime archive timeout');
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('Runtime archive download timed out')), timeoutMs);
  let url = release.url;
  try {
    for (let redirects = 0; ; redirects++) {
      const response = await fetcher(url, {
        redirect: 'manual', credentials: 'omit', referrerPolicy: 'no-referrer', signal: controller.signal,
        headers: { Accept: 'application/octet-stream', 'Accept-Encoding': 'identity' },
      });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        await response.body?.cancel();
        if (redirects >= MAX_REDIRECTS) throw new Error('Runtime archive redirect limit exceeded');
        const location = response.headers.get('location');
        if (!location) throw new Error('Runtime archive redirect is missing its location');
        const next = new URL(location, url);
        validateRedirect(next);
        url = next.href;
        continue;
      }
      if (response.status !== 200 || !response.body) {
        await response.body?.cancel();
        throw new Error(`Runtime archive download failed (HTTP ${response.status})`);
      }
      const contentLength = response.headers.get('content-length');
      if (contentLength !== null && (!/^\d+$/.test(contentLength) || Number(contentLength) !== release.bytes)) {
        await response.body.cancel();
        throw new Error('Runtime archive Content-Length differs from the pinned size');
      }
      const contentEncoding = response.headers.get('content-encoding');
      if (contentEncoding && contentEncoding !== 'identity') {
        await response.body.cancel();
        throw new Error('Runtime archive must use identity HTTP content encoding');
      }
      const chunks: Uint8Array[] = [];
      let received = 0;
      const reader = response.body.getReader();
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          received += value.byteLength;
          if (received > release.bytes) throw new Error('Runtime archive exceeds its pinned size');
          chunks.push(value);
        }
      } catch (error) {
        await reader.cancel().catch(() => {});
        throw error;
      } finally { reader.releaseLock(); }
      const archive = Buffer.concat(chunks, received);
      if (received !== release.bytes || sha256(archive) !== release.sha256) {
        throw new Error('Runtime archive failed size/SHA256 verification');
      }
      return archive;
    }
  } finally { clearTimeout(timer); }
}

function tarString(header: Buffer, offset: number, length: number): string {
  const field = header.subarray(offset, offset + length);
  const end = field.indexOf(0);
  if (end >= 0 && field.subarray(end).some(byte => byte !== 0)) throw new Error('Invalid tar string padding');
  const value = end < 0 ? field : field.subarray(0, end);
  if (value.some(byte => byte < 32 || byte > 126)) throw new Error('Invalid tar string');
  return value.toString('ascii');
}

function tarOctal(header: Buffer, offset: number, length: number): number {
  const field = header.subarray(offset, offset + length).toString('latin1');
  if (!/^[0-7]+(?:\0| )*$/.test(field)) throw new Error('Invalid tar octal field');
  const value = Number.parseInt(field, 8);
  if (!Number.isSafeInteger(value)) throw new Error('Tar number exceeds safe range');
  return value;
}

/** Deliberately accepts only the pinned pack's small USTAR subset, not general tar. */
export function readRuntimeArchive(archive: Buffer, release: RuntimeRelease, plan: readonly RuntimeAsset[]): Map<string, Buffer> {
  validateRelease(release);
  validatePlan(plan);
  if (archive.length !== release.bytes || sha256(archive) !== release.sha256) {
    throw new Error('Runtime archive failed size/SHA256 verification');
  }
  const expected = new Map(plan.map(entry => [entry.file, entry]));
  // One header and padded payload per file, two end blocks, at most one tar record of padding.
  const dataBytes = plan.reduce((sum, entry) => sum + 512 + Math.ceil(entry.bytes / 512) * 512, 0);
  const maxOutputLength = Math.ceil((dataBytes + 1024) / 10240) * 10240;
  const tar = gunzipSync(archive, { maxOutputLength });
  if (tar.length % 512 !== 0) throw new Error('Truncated tar archive');
  const result = new Map<string, Buffer>();
  let offset = 0;
  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every(byte => byte === 0)) {
      if (tar.length - offset < 1024 || tar.subarray(offset).some(byte => byte !== 0)) {
        throw new Error('Invalid tar end marker');
      }
      if (result.size !== expected.size) throw new Error('Runtime archive is missing required recordings');
      return result;
    }
    const name = tarString(header, 0, 100);
    if (!/^audio\/[a-z0-9][a-z0-9.-]*\.mp3$/.test(name)) throw new Error(`Unsafe tar path: ${name}`);
    if (header.toString('ascii', 257, 263) !== 'ustar\0' || header.toString('ascii', 263, 265) !== '00'
      || ![0, 48].includes(header[156]!) || tarString(header, 157, 100) !== ''
      || tarString(header, 345, 155) !== '') throw new Error(`Unsupported tar entry: ${name}`);
    const checksum = header.reduce((sum, byte, index) => sum + (index >= 148 && index < 156 ? 32 : byte), 0);
    if (tarOctal(header, 148, 8) !== checksum) throw new Error(`Invalid tar header checksum: ${name}`);
    const entry = expected.get(name);
    if (!entry) throw new Error(`Unexpected runtime archive entry: ${name}`);
    if (result.has(name)) throw new Error(`Duplicate runtime archive entry: ${name}`);
    const size = tarOctal(header, 124, 12);
    if (size !== entry.bytes) throw new Error(`Wrong runtime recording size: ${name}`);
    const start = offset + 512, end = start + size, paddedEnd = start + Math.ceil(size / 512) * 512;
    if (paddedEnd > tar.length) throw new Error(`Truncated runtime recording: ${name}`);
    const bytes = tar.subarray(start, end);
    if (sha256(bytes) !== entry.sha256) throw new Error(`Wrong runtime recording SHA256: ${name}`);
    if (tar.subarray(end, paddedEnd).some(byte => byte !== 0)) throw new Error(`Invalid tar file padding: ${name}`);
    result.set(name, bytes);
    offset = paddedEnd;
  }
  throw new Error('Missing tar end marker');
}

async function safeDestination(webDirectory: string, file: string): Promise<string> {
  let current = path.resolve(webDirectory);
  const root = await lstat(current);
  if (!root.isDirectory() || root.isSymbolicLink()) throw new Error('Runtime asset root must be a real directory');
  const parts = file.split('/');
  for (let index = 0; index < parts.length; index++) {
    current = path.join(current, parts[index]!);
    try {
      const stat = await lstat(current);
      if (stat.isSymbolicLink() || (index === parts.length - 1 ? !stat.isFile() : !stat.isDirectory())) {
        throw new Error(`Runtime asset path contains a link or special file: ${file}`);
      }
    } catch (error) { if (!missing(error)) throw error; }
  }
  return current;
}

/** Reuse verified files; conflicting cache bytes are an error, never an overwrite. */
export async function ensureRuntimeAudio(
  webDirectory: string,
  release: RuntimeRelease = narratorRuntimeRelease,
  plan: readonly RuntimeAsset[] = runtimeAssetPlan(),
  download: FetchArchive = downloadRuntimeArchive,
) {
  validateRelease(release);
  validatePlan(plan);
  let preserved = 0;
  const pending: RuntimeAsset[] = [];
  // Check all existing bytes and paths before a download or any destination writes.
  for (const entry of plan) {
    const destination = await safeDestination(webDirectory, entry.file);
    try {
      const bytes = await readFile(destination);
      if (bytes.length !== entry.bytes || sha256(bytes) !== entry.sha256) {
        throw new Error(`Refusing to overwrite a different destination asset: ${entry.file}`);
      }
      preserved++;
    } catch (error) {
      if (!missing(error)) throw error;
      pending.push(entry);
    }
  }
  if (pending.length) {
    const entries = readRuntimeArchive(await download(release), release, plan);
    // Only after full archive and catalog verification may the missing files be written.
    for (const entry of pending) {
      const destination = await safeDestination(webDirectory, entry.file);
      await mkdir(path.dirname(destination), { recursive: true });
      await writeFile(destination, entries.get(entry.file)!, { flag: 'wx' });
    }
  }
  return { verified: plan.length, restored: pending.length, preserved };
}
