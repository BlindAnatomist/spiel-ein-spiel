import type { NarrationMessage, NarrationOutput, PlaybackResult } from './narration-types.ts';
/** One queue owns audio and the single live writer. Reviews keep original VoiceOver. */
export function createAnnouncer(write: (text: string) => void, wait: (ms: number) => Promise<void>, output?: NarrationOutput) {
  type Content = string | NarrationMessage;
  type Entry = { content: () => Content; review: boolean; optional: boolean; done: () => void };
  let queue: Entry[] = [];
  let active = false;
  let revision = 0;
  let stopped = false;
  let epoch = 0;
  let interrupt: (() => void) | undefined;
  let activeReview = false;
  let activeOptional = false;
  let cancelOptional: (() => void) | undefined;
  let lastFactOutcome: PlaybackResult | undefined;
  let liveWritten = false;
  async function drain() {
    if (active) return;
    active = true;
    try {
      while (!stopped && queue.length) {
        const entry = queue.shift()!;
        const content = entry.content();
        const text = typeof content === 'string' ? content : content.text;
        const ownEpoch = epoch;
        activeReview = entry.review; activeOptional = entry.optional;
        if (text || (entry.optional && output?.enabled() && lastFactOutcome !== 'fallback' && typeof content !== 'string' && (output.canReact?.(content) ?? true))) {
          revision++;
          let optionalCancelled = false;
          const cancelled = new Promise<void>(resolve => { interrupt = resolve; });
          if (entry.optional) cancelOptional = () => { optionalCancelled=true; output?.cancel(); interrupt?.(); };
          if (entry.optional && typeof content !== 'string' && content.gapMs) await Promise.race([wait(content.gapMs),cancelled]);
          let result: PlaybackResult = 'fallback';
          if (!entry.review && !optionalCancelled && !stopped && epoch === ownEpoch && typeof content !== 'string' && output?.enabled()) {
            // A completed clip sequence never also enters the ARIA speech path.
            try { result = await output.play(content); } catch { output.cancel(); result = 'fallback'; }
          }
          if (stopped || optionalCancelled || epoch !== ownEpoch) result = 'cancelled';
          if (!entry.optional && !entry.review && typeof content !== 'string') lastFactOutcome = result;
          if (result === 'fallback' && !entry.optional) {
            write(text); liveWritten = true;
            const budget = wait(Math.max(1600, text.split(' ').length * 300));
            // Preserve the original writer's exact scheduling when no audio adapter is installed.
            if (!entry.review && !output) await budget;
            else await Promise.race([budget, cancelled]);
          }
          interrupt = undefined;
          if (!stopped && epoch === ownEpoch && liveWritten) { write(''); liveWritten = false; }
        }
        activeReview = false; activeOptional = false; cancelOptional=undefined;
        entry.done();
      }
    } finally { active = false; }
  }
  function cancelReviews() {
    queue = queue.filter(entry => { if (!entry.review) return true; entry.done(); return false; });
    if (activeReview) interrupt?.();
  }
  function cancelPending(clear: boolean) {
    epoch++;
    output?.cancel();
    interrupt?.();
    queue.splice(0).forEach(entry => entry.done());
    if (clear && liveWritten) write('');
    liveWritten = false;
  }
  return {
    say(content: Content | (() => Content), review = false) {
      if (stopped) return Promise.resolve();
      if (review) {
        queue = queue.filter(entry => { if(!entry.optional)return true;entry.done();return false; });
        if(activeOptional)cancelOptional?.();
        cancelReviews();
      }
      return new Promise<void>(done => {
        queue.push({optional: typeof content === 'object' && !!content.optional, content: typeof content === 'function' ? content : () => content, review, done});
        void drain();
      });
    },
    revision: () => revision,
    cancelReviews,
    cancelPending: () => cancelPending(true),
    stop() { stopped = true; cancelPending(false); },
  };
}
