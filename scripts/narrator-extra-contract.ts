import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import type { NarrationAlternative, NarrationClip } from '../web/narration-types.ts';
import { CHARACTER_LIBRARY_TARGET, reactionTriggerMetadata, type ReactionTrigger } from '../web/narrator-reaction-triggers.ts';

export interface ApprovedReaction extends NarrationAlternative { readonly trigger: ReactionTrigger }
export interface ReactionBatchInput { directory: string; proposal: string }
const sha256 = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
const idPattern = /^reaction\.[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const digestPattern = /^[a-f0-9]{64}$/;
const nonempty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

/** Pure validation: every supplied pack is checked before any runtime file changes. */
export async function validateReactionBatches(inputs: readonly ReactionBatchInput[]) {
  if (!inputs.length || inputs.length > CHARACTER_LIBRARY_TARGET / 24) throw new Error('Provide one to seven complete approved 24-line batches');
  const lines: Record<string, ApprovedReaction> = {}, runtime: Record<string, NarrationClip> = {};
  const sources = new Map<string, string>(), packs: Array<Record<string, unknown>> = [];
  const packIds = new Set<string>(), texts = new Set<string>();
  for (const input of inputs) {
    const rawProposal = await readFile(input.proposal, 'utf8');
    const proposal = JSON.parse(rawProposal);
    const rawManifest = await readFile(path.join(input.directory, 'manifest.json'), 'utf8');
    const pack = JSON.parse(rawManifest);
    const rawQa = await readFile(path.join(input.directory, 'final-qa.json'), 'utf8');
    const qa = JSON.parse(rawQa);
    if (!nonempty(proposal.status) || !/^(?:Parent-approved\b|Parent editorial approval and independent review passed\b)/.test(proposal.status)
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
    for (const line of proposal.scripts) {
      const id = line.id, clip = pack.clips[id];
      const trigger = line.trigger as ReactionTrigger;
      if (typeof id !== 'string' || !idPattern.test(id) || id in lines || !Object.hasOwn(reactionTriggerMetadata, trigger)
        || !nonempty(line.text) || !nonempty(line.family) || !nonempty(line.context)
        || !nonempty(line.direction) || !nonempty(line.deliveryTag)
        || !clip || clip.id !== id || ['text', 'trigger', 'family', 'context', 'direction', 'deliveryTag'].some(key => clip[key] !== line[key])
        || clip.status !== 'ready' || clip.decodeVerified !== true || clip.url !== `audio/${id}.mp3` || clip.rawUrl !== `raw/${id}.mp3`
        || clip.prompt !== `[${line.deliveryTag}] ${line.text}` || clip.payload?.text !== clip.prompt
        || clip.payload?.temperature !== 0.85 || clip.payload?.reference_id !== proposal.reference_id
        || !Number.isFinite(clip.durationSeconds) || clip.durationSeconds <= 0
        || !Number.isInteger(clip.bytes) || clip.bytes <= 0 || !Number.isInteger(clip.rawBytes) || clip.rawBytes <= 0
        || !digestPattern.test(clip.sha256) || !digestPattern.test(clip.rawSha256)) throw new Error(`Invalid approved recording: ${id}`);
      const normalized = line.text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      if (texts.has(normalized)) throw new Error(`Duplicate normalized wording: ${id}`);
      texts.add(normalized);
      for (const [url, digest, size] of [[clip.url, clip.sha256, clip.bytes], [clip.rawUrl, clip.rawSha256, clip.rawBytes]]) {
        const bytes = await readFile(path.join(input.directory, url));
        if (bytes.length !== size || sha256(bytes) !== digest) throw new Error(`Corrupt raw/master recording: ${id}`);
      }
      lines[id] = { clip: id, text: line.text, family: line.family, ...reactionTriggerMetadata[trigger], trigger };
      runtime[id] = { id, url: clip.url, text: clip.text, status: 'ready', durationSeconds: clip.durationSeconds, sha256: clip.sha256, bytes: clip.bytes };
      sources.set(id, path.join(input.directory, clip.url));
    }
    packs.push({ packId: pack.packId, count: 24, proposalSha256: sha256(rawProposal), manifestSha256: sha256(rawManifest), finalQaSha256: sha256(rawQa) });
  }
  return { lines, runtime, sources, packs };
}
