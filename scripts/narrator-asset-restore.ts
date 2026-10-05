import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { narrationAssets } from '../web/narrator-assets.ts';

export interface VerifiedAsset {
  readonly file: string;
  readonly sha256: string;
  readonly bytes?: number;
}
const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const missing = (error: unknown) => (error as NodeJS.ErrnoException)?.code === 'ENOENT';

/** The destination checkout, not an input pack, supplies the trusted manifest. */
export async function narratorAssetPlan(webDirectory: string): Promise<VerifiedAsset[]> {
  const plan: VerifiedAsset[] = Object.values(narrationAssets).map(clip => {
    if (clip.status !== 'ready' || !/^[a-z0-9.-]+$/.test(clip.id)
      || clip.url !== `audio/${clip.id}.mp3` || !Number.isSafeInteger(clip.bytes) || clip.bytes <= 0) {
      throw new Error(`Invalid runtime recording metadata: ${clip.id}`);
    }
    return { file: clip.url, sha256: clip.sha256, bytes: clip.bytes };
  });
  const checksums = await readFile(path.join(webDirectory, 'repair-audio/checksums.sha256'), 'utf8');
  for (const line of checksums.trim().split('\n')) {
    const match = /^([a-f0-9]{64})  (audio\/[a-z0-9.-]+\.(?:mp3|wav)|index\.html|measurements\.json)$/.exec(line);
    if (!match) throw new Error('Invalid trusted repair-audio checksum entry');
    plan.push({ file: `repair-audio/${match[2]}`, sha256: match[1]! });
  }
  return plan;
}

async function assetPath(root: string, file: string): Promise<string> {
  if (!/^(?:audio\/[a-z0-9.-]+\.mp3|repair-audio\/(?:audio\/[a-z0-9.-]+\.(?:mp3|wav)|index\.html|measurements\.json))$/.test(file)
    || file.split('/').some(part => part === '..' || part === '.')) throw new Error(`Unsafe asset path: ${file}`);
  let current = path.resolve(root);
  const rootStat = await lstat(current);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error('Asset root must be a real directory');
  const parts = file.split('/');
  for (let index = 0; index < parts.length; index++) {
    current = path.join(current, parts[index]!);
    try {
      const stat = await lstat(current);
      if (stat.isSymbolicLink() || (index < parts.length - 1 ? !stat.isDirectory() : !stat.isFile())) {
        throw new Error(`Asset path must not contain links or special files: ${file}`);
      }
    } catch (error) { if (!missing(error)) throw error; }
  }
  return current;
}

/** Local, allowlisted byte restoration only. No generation, downloads or input code. */
export async function restoreVerifiedAssets(sourceWeb: string, destinationWeb: string, plan: readonly VerifiedAsset[]) {
  const seen = new Set<string>();
  const pending: Array<{ file: string; destination: string; bytes: Buffer }> = [];
  let preserved = 0, bytesVerified = 0;
  // Validate every source and existing destination before creating any file.
  for (const entry of plan) {
    if (seen.has(entry.file) || !/^[a-f0-9]{64}$/.test(entry.sha256)
      || (entry.bytes !== undefined && (!Number.isSafeInteger(entry.bytes) || entry.bytes <= 0))) {
      throw new Error(`Invalid or duplicate asset identity: ${entry.file}`);
    }
    seen.add(entry.file);
    const source = await assetPath(sourceWeb, entry.file);
    const destination = await assetPath(destinationWeb, entry.file);
    const bytes = await readFile(source);
    if ((entry.bytes !== undefined && bytes.length !== entry.bytes) || digest(bytes) !== entry.sha256) {
      throw new Error(`Source recording failed verification: ${entry.file}`);
    }
    bytesVerified += bytes.length;
    try {
      const existing = await readFile(destination);
      if (existing.length !== bytes.length || digest(existing) !== entry.sha256) {
        throw new Error(`Refusing to overwrite a different destination asset: ${entry.file}`);
      }
      preserved++;
    } catch (error) {
      if (!missing(error)) throw error;
      pending.push({ file: entry.file, destination, bytes });
    }
  }
  for (const entry of pending) {
    // Recheck path safety after the preflight. Exclusive creation never replaces data.
    await assetPath(destinationWeb, entry.file);
    await mkdir(path.dirname(entry.destination), { recursive: true });
    await writeFile(entry.destination, entry.bytes, { flag: 'wx' });
  }
  return { verified: plan.length, restored: pending.length, preserved, bytesVerified };
}
