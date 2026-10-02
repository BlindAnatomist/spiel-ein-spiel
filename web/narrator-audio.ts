import type { NarrationClip, NarrationManifest, NarrationMessage, NarrationOutput, PlaybackResult } from './narration-types.ts';

/** The same media element is reused after the initiating user gesture (Safari). */
export interface NarratorMedia {
  src: string;
  preload: string;
  currentTime: number;
  readonly ended: boolean;
  readonly error: { readonly code: number } | null;
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
  let characterUsed = false;
  let priming: Promise<PlaybackResult> | undefined;
  let unlocked = false;
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
  function playClip(clip: NarrationClip, ownRevision: number): Promise<PlaybackResult> {
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
      const cancelThis = () => finish('cancelled');
      cancelClip = cancelThis;
      audio.addEventListener('ended', ended);
      audio.addEventListener('error', failed);
      // Timeout is failure recovery, never evidence that speech finished successfully.
      clearTimeout = timeout(() => finish('fallback'), Math.max(8000, clip.durationSeconds * 1000 + 5000));
      try {
        audio.preload = 'auto';
        audio.src = clip.url;
        const started = audio.play();
        void started.catch(() => finish(ownRevision === revision ? 'fallback' : 'cancelled'));
      } catch { finish('fallback'); }
    });
  }
  return {
    enabled: () => enabled,
    setEnabled(value) { if (value !== enabled) { cancel(); enabled = value; } },
    beginHand(number) { if (number !== hand) { hand = number; characterUsed = false; } },
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
      const character = !characterUsed && message.character && valid(manifest[message.character.clip]) ? message.character : undefined;
      const ids = character ? [character.clip] : message.clips;
      const clips = ids.map(id => manifest[id]);
      if (!clips.length || !clips.every(valid)) return 'fallback';
      const ownRevision = revision;
      caption(character?.text ?? message.text);
      if (character) characterUsed = true;
      for (const clip of clips) {
        const result = await playClip(clip, ownRevision);
        if (result !== 'ended') { if (ownRevision === revision) caption(''); return result; }
        if (ownRevision !== revision || !enabled) return 'cancelled';
      }
      if (ownRevision === revision) caption('');
      return 'ended';
    },
  };
}
