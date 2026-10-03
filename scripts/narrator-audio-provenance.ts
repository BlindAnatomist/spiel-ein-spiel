import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);
export interface AudioEvidenceInput {
  readonly directory: string;
  readonly proposal: string;
  readonly packId: string;
  readonly proposalSha256: string;
  readonly manifestSha256: string;
  readonly finalQaSha256: string;
}
export type AudioEvidenceVerifier = (input: AudioEvidenceInput) => Promise<Record<string, unknown>>;

// Only byte-identical, already-imported legacy packs retain their original audit route.
// New or changed inputs can never choose that route by removing browser markers.
const preservedLegacy = new Map<string, readonly string[]>([
  ['peter-euchre-library-batch01-20261002', [
    '3e71e076834a320f4d6b244c415532bbc5ecae63b43297e785f13b7fd7081a83',
    '268f3e88141c28f0d24a598155462e3d97ce8d4fb733579e63d734641aca9595',
    '5895ee48ffba8f72a78f1ab3a6fb1af660ae3fb5d723219d828c517cf6ce06a4',
  ]],
  ['peter-euchre-library-batch02-20261002', [
    '9f0ef2dde6bf3592f5ff83548ac9d3e0d12dc6a1faf3d6613c9245caff99e7d7',
    '53eb8e73e8f3e026e04fa9120fe2f244a951549185b8b624d299d43c5e10f25d',
    '835595bfbc3127376a2536e1e23de579b9f88090ed189644dca69f337ed15c55',
  ]],
  ['peter-euchre-library-batch03-20261002', [
    'e8fd872353c86d84de8ff0eda708738c71091080a9de502f7f481bcca650f628',
    '5d3d980b84357de7b1f4cdbdfb72e55fe2890517ad6b5bdcfc85aab78e1c8cb8',
    'ac80664e051ed5a774c9c62aec7dd84c665726dcff670147231fc83f1bd2444f',
  ]],
]);

/** Fresh local-only validation; no browser, provider client, producer, or finalization. */
export const verifyAudioEvidence: AudioEvidenceVerifier = async input => {
  const expected = preservedLegacy.get(input.packId);
  const actual = [input.proposalSha256, input.manifestSha256, input.finalQaSha256];
  if (expected?.every((hash, index) => hash === actual[index])) {
    return { mode: 'preserved-legacy-exact-identity' };
  }
  const script = fileURLToPath(new URL('./verify-narrator-audio.py', import.meta.url));
  let stdout: string;
  try {
    ({ stdout } = await run('python3', ['-I', '-B', script, input.directory, input.proposal], {
      timeout: 180_000, maxBuffer: 1_048_576,
    }));
  } catch (error) {
    throw new Error(`Reviewed complete audio provenance failed for ${input.packId}`, { cause: error });
  }
  const result = JSON.parse(stdout);
  for (const key of ['proposalSha256', 'manifestSha256', 'finalQaSha256'] as const) {
    if (result[key] !== input[key]) throw new Error(`Audio evidence changed during validation: ${key}`);
  }
  const audit = result.summary, resume = result.resume;
  if (audit?.count !== 24 || audit.plannedCount !== 24 || audit.partial !== false
    || audit.rawHashesVerified !== true || audit.equalDecodedSampleCounts !== true
    || audit.networkCalls !== 0 || audit.networkAttemptsBlocked !== 0 || audit.generationCalls !== 0 || audit.producerImported !== false
    || audit.speechContentVerified !== false || audit.audibleQualityVerified !== false
    || audit.priorUnknownOutcomesResolved !== false
    || !Number.isInteger(audit.http200ReceiptCount) || !Number.isInteger(audit.browserUiReceiptCount)
    || audit.http200ReceiptCount < 0 || audit.browserUiReceiptCount < 0 || audit.http200ReceiptCount + audit.browserUiReceiptCount !== 24
    || resume?.readyClipsReused !== 24 || resume.partial !== false
    || resume.networkCalls !== 0 || resume.networkAttemptsBlocked !== 0 || resume.generationCalls !== 0 || resume.producerImported !== false
    || resume.externalProcesses !== 0 || resume.processAttemptsBlocked !== 0 || resume.fileHashesBytesAndModificationTimesUnchanged !== true
    || resume.audibleQualityVerified !== false || resume.speechContentVerified !== false) {
    throw new Error(`Incomplete live provenance verification: ${input.packId}`);
  }
  return {
    mode: 'reviewed-local-evidence-and-audio', scriptSha256: result.scriptSha256, planSha256: result.planSha256,
    http200ReceiptCount: audit.http200ReceiptCount, browserUiReceiptCount: audit.browserUiReceiptCount,
    authorizedBoundedReplacementCount: audit.authorizedBoundedReplacementCount,
    priorUnknownOutcomesResolved: false, listeningAcceptance: false,
  };
};
