/** One writer and one queue for automatic events and on-demand public summaries. */
export function createAnnouncer(write: (text: string) => void, wait: (ms: number) => Promise<void>) {
  type Entry = { text: () => string; review: boolean; done: () => void };
  let queue: Entry[] = [];
  let active = false;
  let stopped = false;
  let interrupt: (() => void) | undefined;
  async function drain() {
    if (active) return;
    active = true;
    try {
      while (!stopped && queue.length) {
        const entry = queue.shift()!;
        const text = entry.text();
        if (text) {
          write(text);
          const duration = Math.max(1600, text.split(' ').length * 300);
          if (entry.review) {
            const cancelled = new Promise<void>(resolve => { interrupt = resolve; });
            await Promise.race([wait(duration), cancelled]);
          } else await wait(duration);
          interrupt = undefined;
          if (!stopped) write('');
        }
        entry.done();
      }
    } finally { active = false; }
  }
  function cancelReviews() {
    queue = queue.filter(entry => { if (!entry.review) return true; entry.done(); return false; });
    interrupt?.();
  }
  return {
    say(text: string | (() => string), review = false) {
      if (stopped) return Promise.resolve();
      if (review) cancelReviews(); // repeated requests replace stale reviews, never build a backlog
      return new Promise<void>(done => {
        queue.push({text: typeof text === 'string' ? () => text : text, review, done});
        void drain();
      });
    },
    cancelReviews,
    stop() { stopped = true; cancelReviews(); queue.splice(0).forEach(entry => entry.done()); },
  };
}
