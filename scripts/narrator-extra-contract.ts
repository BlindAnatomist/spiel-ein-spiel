import { readFile, lstat, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { verifyAudioEvidence, type AudioEvidenceVerifier } from './narrator-audio-provenance.ts';
import type { NarrationAlternative, NarrationClip } from '../web/narration-types.ts';
import { CHARACTER_LIBRARY_TARGET, reactionTriggerMetadata, type ReactionTrigger } from '../web/narrator-reaction-triggers.ts';

export interface ApprovedReaction extends NarrationAlternative { readonly trigger: ReactionTrigger }
export interface ReactionBatchInput { directory: string; proposal: string }
const sha256 = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
const idPattern = /^reaction\.[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const digestPattern = /^[a-f0-9]{64}$/;
const nonempty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

async function localFile(root: string, name: string) {
  const file = path.join(root, name), resolved = await realpath(file), base = await realpath(root);
  if (!(await lstat(file)).isFile() || !resolved.startsWith(base + path.sep)) throw new Error(`Unsafe audio evidence path: ${name}`);
  return readFile(file);
}

/** Pure validation: every supplied pack is checked before any runtime file changes. */
export async function validateReactionBatches(inputs: readonly ReactionBatchInput[], evidenceVerifier: AudioEvidenceVerifier = verifyAudioEvidence) {
  if (!inputs.length || inputs.length > CHARACTER_LIBRARY_TARGET / 24) throw new Error('Provide one to nine complete approved 24-line batches');
  const lines: Record<string, ApprovedReaction> = {}, runtime: Record<string, NarrationClip> = {};
  const sources = new Map<string, string>(), packs: Array<Record<string, unknown>> = [];
  const packIds = new Set<string>(), texts = new Set<string>();
  const rawHashes = new Set<string>(), masterHashes = new Set<string>(), blobs = new Set<string>();
  const audioBytes = new Map<string, Buffer>();
  for (const input of inputs) {
    if (!(await lstat(input.proposal)).isFile()) throw new Error('Unsafe explicit approved proposal');
    const rawProposal = await readFile(input.proposal, 'utf8');
    const proposal = JSON.parse(rawProposal);
    const rawManifest = (await localFile(input.directory, 'manifest.json')).toString('utf8');
    const pack = JSON.parse(rawManifest);
    const rawQa = (await localFile(input.directory, 'final-qa.json')).toString('utf8');
    const qa = JSON.parse(rawQa);
    // Batch09's frozen editorial status distinguishes script review from audio acceptance.
    const reviewedBatch09Status = sha256(rawProposal) === '97adc6bd0e4e560ba2aa4b3a79d17b0b83630abf8e4d5fc499dc42eb3051c855'
      && proposal.status === 'Parent editorial approval and independent script review passed; audio not generated';
    if (!nonempty(proposal.status) || (!/^(?:Parent-approved\b|Parent editorial approval and independent review passed\b)/.test(proposal.status) && !reviewedBatch09Status)
      || !nonempty(proposal.packId) || packIds.has(proposal.packId) || pack.packId !== proposal.packId
      || proposal.model !== 's2.1-pro-free' || pack.model !== proposal.model
      || proposal.reference_id !== 'd75c270eaee14c8aa1e9e980cc37cf1b' || pack.reference_id !== proposal.reference_id
      || proposal.temperature !== 0.85 || pack.temperature !== proposal.temperature
      || !Array.isArray(proposal.scripts) || proposal.scripts.length !== 24
      || !pack.clips || Object.keys(pack.clips).length !== 24 || pack.readyCount !== 24 || pack.plannedCount !== 24
      || qa.readyCount !== 24 || qa.exactApprovedContractMapping !== true || qa.audioSummary?.count !== 24
      || qa.audioSummary?.partial !== false || qa.audioSummary?.rawHashesVerified !== true || qa.audioSummary?.equalDecodedSampleCounts !== true) {
      throw new Error(`Incomplete or mismatched approved batch: ${input.directory}`);
    }
    packIds.add(proposal.packId);
    const identities = { proposalSha256: sha256(rawProposal), manifestSha256: sha256(rawManifest), finalQaSha256: sha256(rawQa) };
    const evidence = await evidenceVerifier({ ...input, packId: proposal.packId, ...identities });
    for (const line of proposal.scripts) {
      const id = line.id, clip = pack.clips[id];
      const trigger = line.trigger as ReactionTrigger;
      const reviewedSweepId = reviewedBatch09Status && ['you-team-sweep.unknown-number', 'you-team-sweep.sticky-fingers'].includes(id);
      if (typeof id !== 'string' || (!idPattern.test(id) && !reviewedSweepId) || id in lines || !Object.hasOwn(reactionTriggerMetadata, trigger)
        || !nonempty(line.text) || !nonempty(line.family) || !nonempty(line.context)
        || !nonempty(line.direction) || !nonempty(line.deliveryTag)
        || !clip || clip.id !== id || ['text', 'trigger', 'family', 'context', 'direction', 'deliveryTag'].some(key => clip[key] !== line[key])
        || clip.status !== 'ready' || clip.decodeVerified !== true || clip.url !== `audio/${id}.mp3` || clip.rawUrl !== `raw/${id}.mp3`
        || clip.prompt !== `[${line.deliveryTag}] ${line.text}` || clip.payload?.text !== clip.prompt
        || clip.payload?.temperature !== 0.85 || clip.payload?.reference_id !== proposal.reference_id
        || !Number.isFinite(clip.durationSeconds) || clip.durationSeconds <= 0
        || !Number.isInteger(clip.bytes) || clip.bytes <= 0 || !Number.isInteger(clip.rawBytes) || clip.rawBytes <= 0
        || !digestPattern.test(clip.sha256) || !digestPattern.test(clip.rawSha256)) throw new Error(`Invalid approved recording: ${id}`);
      if (rawHashes.has(clip.rawSha256) || masterHashes.has(clip.sha256)) throw new Error(`Duplicate/cross-batch audio identity: ${id}`);
      rawHashes.add(clip.rawSha256); masterHashes.add(clip.sha256);
      const blob = clip.afterUiObservation?.downloadHref;
      if (blob !== undefined) {
        if (typeof blob !== 'string' || !blob.startsWith('blob:') || blobs.has(blob)) throw new Error(`Duplicate/invalid browser blob identity: ${id}`);
        blobs.add(blob);
      }
      const normalized = line.text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      if (texts.has(normalized)) throw new Error(`Duplicate normalized wording: ${id}`);
      texts.add(normalized);
      for (const [url, digest, size] of [[clip.url, clip.sha256, clip.bytes], [clip.rawUrl, clip.rawSha256, clip.rawBytes]]) {
        const bytes = await localFile(input.directory, url);
        if (bytes.length !== size || sha256(bytes) !== digest) throw new Error(`Corrupt raw/master recording: ${id}`);
        if (url === clip.url) audioBytes.set(id, bytes);
      }
      lines[id] = { clip: id, text: line.text, family: line.family, ...reactionTriggerMetadata[trigger], trigger };
      runtime[id] = { id, url: clip.url, text: clip.text, status: 'ready', durationSeconds: clip.durationSeconds, sha256: clip.sha256, bytes: clip.bytes };
      sources.set(id, path.join(input.directory, clip.url));
    }
    packs.push({ packId: pack.packId, count: 24, ...identities, evidence });
  }
  return { lines, runtime, sources, packs, audioBytes };
}

/** Additive imports must preserve all prior audio and reaction behavior metadata. */
export function assertAdditiveReactionImport(
  lines: Readonly<Record<string, ApprovedReaction>>,
  runtime: Readonly<Record<string, NarrationClip>>,
  oldLines: Readonly<Record<string, ApprovedReaction>>,
  oldRuntime: Readonly<Record<string, NarrationClip>>,
  existingAssets: Readonly<Record<string, { readonly text: string }>>,
) {
  for (const [id, old] of Object.entries(oldLines)) {
    if (!isDeepStrictEqual(lines[id], old)) throw new Error(`Import would remove or change preserved reaction metadata ${id}`);
  }
  for (const [id, old] of Object.entries(oldRuntime)) {
    if (!isDeepStrictEqual(runtime[id], old)) throw new Error(`Import would remove or replace preserved recording ${id}`);
  }
  const normalize = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const existingTexts = new Set(Object.values(existingAssets).map(asset => normalize(asset.text)));
  for (const [id, line] of Object.entries(lines)) {
    if (Object.hasOwn(oldLines, id)) continue;
    if (Object.hasOwn(existingAssets, id)) throw new Error(`Import would collide with existing recording ${id}`);
    if (existingTexts.has(normalize(line.text))) throw new Error(`Import would repeat existing recording wording ${id}`);
  }
}
