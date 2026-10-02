import type { NarrationClip, NarrationManifest, NarrationMessage, NarrationOutput, PlaybackResult } from './narration-types.ts';
import { createNarratorFlavorHistory, type NarratorFlavorHistory } from './narrator-flavor.ts';

/** The same media element is reused after the initiating user gesture (Safari). */
export interface NarratorMedia {
  src: string;
  preload: string;
  currentTime: number;
  readonly ended: boolean;
  readonly error: { readonly code: number } | null;
  readonly readyState?: number;
  readonly currentSrc?: string;
  readonly paused?: boolean;
  play(): Promise<void>;
  pause(): void;
  addEventListener(type: string, callback: EventListener): void;
  removeEventListener(type: string, callback: EventListener): void;
}
export interface AudioOptions {
  enabled?: boolean;
  media?: () => NarratorMedia;
  caption?: (text: string) => void;
  timeout?: (callback: () => void, ms: number) => () => void;
  flavorHistory?: NarratorFlavorHistory;
  /** Complete previews must never silently fall back to stitched fragments. */
  wholeOnly?: boolean;
  diagnostic?: (event: NarrationDiagnostic) => void;
  nextEventId?: () => number;
  now?: () => number;
}
export interface NarrationDiagnostic {
  readonly eventId: number;
  readonly timeMs: number;
  readonly fact: string;
  readonly requestedWhole: string | undefined;
  readonly clips: readonly string[];
  readonly outcome: 'selected' | 'media-request' | 'media-playing' | PlaybackResult;
  readonly reason?: 'missing-complete-recording' | 'missing-recording' | 'media-failure';
}
// Ten milliseconds of PCM silence, used only on an explicit user gesture to
// authorize this same element before an asynchronous resumed bot sequence.
const SILENCE = 'data:audio/wav;base64,UklGRnQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YVAAAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==';
/** Prerecorded narration only: no runtime TTS/provider requests or credentials. */
export function createNarratorAudio(manifest: NarrationManifest, options: AudioOptions = {}): NarrationOutput & { setEnabled(value: boolean): void; prime(): void } {
  let enabled = options.enabled ?? false;
  let media: NarratorMedia | undefined;
  let revision = 0;
  let cancelClip: (() => void) | undefined;
  let hand = 0;
  const flavorHistory = options.flavorHistory ?? createNarratorFlavorHistory();
  let priming: Promise<PlaybackResult> | undefined;
  let unlocked = false;
  let eventSequence = 0;
  const caption = options.caption ?? (() => {});
  const timeout = options.timeout ?? ((callback, ms) => {
    const timer = setTimeout(callback, ms); return () => clearTimeout(timer);
  });
  const valid = (clip: NarrationClip | undefined): clip is NarrationClip => !!clip && clip.status === 'ready'
    && /^audio\/[a-z0-9.-]+\.mp3$/.test(clip.url) && Number.isFinite(clip.durationSeconds) && clip.durationSeconds > 0;

  function cancel() {
    revision++;
    cancelClip?.();
    cancelClip = undefined;
    media?.pause();
    caption('');
  }
  function playClip(clip: NarrationClip, ownRevision: number, onPlaying?: () => void): Promise<PlaybackResult> {
    if (!enabled || ownRevision !== revision) return Promise.resolve('cancelled');
    try { media ??= (options.media ?? (() => new Audio()))(); }
    catch { return Promise.resolve('fallback'); }
    const audio = media;
    return new Promise(resolve => {
      let settled = false;
      let clearTimeout = () => {};
      const finish = (result: PlaybackResult) => {
        if (settled) return;
        settled = true;
        clearTimeout();
        audio.removeEventListener('ended', ended);
        audio.removeEventListener('error', failed);
        audio.removeEventListener('playing', playing);
        // Remove listeners before pause so cancellation cannot report a second outcome.
        audio.pause();
        if (cancelClip === cancelThis) cancelClip = undefined;
        resolve(result);
      };
      const ended: EventListener = () => {
        // A stale queued ended event from a replaced resource must not finish the new clip.
        if (audio.ended) finish(ownRevision === revision ? 'ended' : 'cancelled');
      };
      const failed: EventListener = () => {
        // Like ended, a queued error from the previous src is irrelevant after load reset.
        if (audio.error) finish(ownRevision === revision ? 'fallback' : 'cancelled');
      };
      const playing: EventListener = () => {
        // Observational only. Reject a queued event for the previous media resource.
        if (ownRevision === revision && (audio.readyState ?? 0) >= 3 && audio.paused === false && audio.currentSrc === audio.src) onPlaying?.();
      };
      const cancelThis = () => finish('cancelled');
      cancelClip = cancelThis;
      audio.addEventListener('ended', ended);
      audio.addEventListener('error', failed);
      audio.addEventListener('playing', playing);
      // Timeout is failure recovery, never evidence that speech finished successfully.
      clearTimeout = timeout(() => finish('fallback'), Math.max(8000, clip.durationSeconds * 1000 + 5000));
      try {
        audio.preload = 'auto';
        // Content identity prevents an older recording surviving a new deployment.
        audio.src = /^[a-f0-9]{64}$/.test(clip.sha256) ? `${clip.url}?v=${clip.sha256.slice(0, 16)}` : clip.url;
        const started = audio.play();
        void started.catch(() => finish(ownRevision === revision ? 'fallback' : 'cancelled'));
      } catch { finish('fallback'); }
    });
  }
  return {
    enabled: () => enabled,
    setEnabled(value) { if (value !== enabled) { cancel(); enabled = value; } },
    beginHand(number) { if (number !== hand) { hand = number; flavorHistory.beginHand(number); flavorHistory.nextEvent(); flavorHistory.nextEvent(); } },
    observe(progress) { flavorHistory.observe(progress); },
    canReact(message) { return !!message.optional && !!message.alternatives?.some(line => valid(manifest[line.clip]) && flavorHistory.eligible(line)); },
    endHand() { flavorHistory.endHand(); },
    cancel,
    prime() {
      if (!enabled || unlocked || priming) return;
      // Called synchronously by Start, narrator selection or Resume, never by a timer.
      const ownRevision = revision;
      const pending = playClip({ id: 'silent-unlock', url: SILENCE, text: '', status: 'ready', durationSeconds: 0.01, sha256: '', bytes: 124 }, ownRevision);
      priming = pending;
      void pending.then(result => {
        if (result === 'ended' && ownRevision === revision) unlocked = true;
        if (priming === pending) priming = undefined;
      });
    },
    async play(message: NarrationMessage): Promise<PlaybackResult> {
      if (!enabled) return 'fallback';
      const requestedRevision = revision;
      if (priming) await priming;
      if (!enabled || requestedRevision !== revision) return 'cancelled';

      // Validate the whole fact first; never play only the fragments we happen to have.
      const alternatives = [...(message.character ? [message.character] : []), ...(message.alternatives ?? [])];
      const character = flavorHistory.select(alternatives.filter(line => valid(manifest[line.clip])));
      if (message.optional && !character) return 'skipped';
      const whole = message.whole && valid(manifest[message.whole]) ? message.whole : undefined;
      const ids = character ? [character.clip] : whole ? [whole] : options.wholeOnly ? [] : message.clips;
      const clips = ids.map(id => manifest[id]);
      const eventId = options.nextEventId?.() ?? ++eventSequence;
      const report = (outcome: NarrationDiagnostic['outcome'], reason?: NarrationDiagnostic['reason']) => {
        try { options.diagnostic?.({eventId, timeMs:(options.now ?? (() => performance.now()))(), fact: message.text, requestedWhole: message.whole, clips: ids, outcome, ...(reason ? {reason} : {})}); } catch { /* Diagnostics cannot interfere with game narration. */ }
      };
      if (!clips.length || !clips.every(valid)) {
        report('fallback', options.wholeOnly ? 'missing-complete-recording' : 'missing-recording'); return 'fallback';
      }
      const ownRevision = revision;
      if (character) flavorHistory.used(character);
      caption(character?.text ?? message.text);
      report('selected');
      for (const clip of clips) {
        report('media-request');
        const result = await playClip(clip, ownRevision, () => report('media-playing'));
        if (result !== 'ended') { if (ownRevision === revision) caption(''); const outcome = message.optional && result === 'fallback' ? 'skipped' : result; report(outcome, result === 'fallback' ? 'media-failure' : undefined); return outcome; }
        if (ownRevision !== revision || !enabled) { report('cancelled'); return 'cancelled'; }
      }
      if (ownRevision === revision) caption('');
      report('ended');
      return 'ended';
    },
  };
}
