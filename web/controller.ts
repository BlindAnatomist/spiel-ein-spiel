import type { Action } from '../src/index.ts';
import { createAnnouncer } from './announcer.ts';
import { cueEvents, type SoundCue } from './sound.ts';
import { currentState, lastTrick, handStartNarration, names } from './presentation.ts';
import type { NarrationMessage, NarrationOutput } from './narration-types.ts';
import type { SeatNames } from './presentation.ts';
import type { Session, Update } from './session.ts';
import type { createTable } from './render.ts';
/** Quiet time after the live region clears, only before automatic focus. */
export const FOCUS_GUARD_MS = 1150;
export type PacingMode = 'voiceover' | 'visual';
export function createController(session: Session, table: ReturnType<typeof createTable>, announce: (text: string) => void,
  wait: (ms: number) => Promise<void> = ms => new Promise(resolve => setTimeout(resolve, ms)),
  sound: (cue: SoundCue) => void = () => {},
  seatNames: SeatNames = names,
  pacing: PacingMode = 'voiceover',
  output?: NarrationOutput) {
  const speech = createAnnouncer(announce, wait, output);
  const voiceoverPacing = () => pacing === 'voiceover' || !!output?.enabled();
  let busy = false;
  let stopped = false;
  let paused = false;
  let settleDone: Promise<void> = Promise.resolve();
  let interruptWait: (() => void) | undefined;
  let announcedHand = 0;
  const interrupted = () => stopped || paused;
  async function waitOrCancel(ms: number) {
    await Promise.race([wait(ms), new Promise<void>(resolve => { interruptWait = resolve; })]);
    interruptWait = undefined;
  }
  async function settle(update?: Update, handStart = false) {
    busy = true;
    const initialSpeech = speech.revision();
    try {
      while (!interrupted()) {
        const current = session.view();
        table.render(current, false);
        const messages: Array<string | NarrationMessage> = [];
        if (handStart && current.handNumber !== announcedHand) {
          announcedHand = current.handNumber;
          output?.beginHand?.(current.handNumber);
          messages.push(...handStartNarration(current, seatNames));
        }
        messages.push(...(update?.narration ?? update?.messages ?? []));
        if (voiceoverPacing()) {
          await Promise.all(messages.map(message => speech.say(message)));
          // An explicitly requested review shares the queue and finishes before automatic focus.
          await speech.say('');
        }
        if (interrupted()) return;
        const view = session.view();
        if (view.turn === null || view.turn === 0) {
          if (voiceoverPacing() && speech.revision() !== initialSpeech) {
            // Reviews arriving during the guard must also finish and clear first.
            let revision: number;
            do {
              await speech.say('');
              if (interrupted()) return;
              revision = speech.revision();
              await waitOrCancel(FOCUS_GUARD_MS);
              if (interrupted()) return;
              await speech.say('');
            } while (speech.revision() !== revision);
          }
          if (interrupted()) return;
          table.render(view); table.focus(); return;
        }
        await waitOrCancel(350);
        if (interrupted()) return;
        const before = session.view();
        update = session.bot() ?? undefined;
        if (update) cueEvents(before, update.view).forEach(sound);
        handStart = false;
        if (!update) throw new Error('Bot could not advance');
      }
    } finally { busy = false; }
  }
  const run = (update?: Update, handStart = false) => {
    if (busy || interrupted()) return settleDone;
    settleDone = settle(update, handStart);
    return settleDone;
  };
  return {
    start: () => run(undefined, true),
    act: async (action: Action) => {
      if (busy || interrupted()) return;
      const before = session.view();
      const update = session.human(action);
      if (!update) return;
      speech.cancelReviews();
      cueEvents(before, update.view).forEach(sound);
      table.park(); await run(update);
    },
    next: async () => {
      if (busy || interrupted() || session.view().phase !== 'hand-over') return;
      speech.cancelReviews();
      table.park(); session.nextHand(); await run(undefined, true);
    },
    repeat: () => !interrupted() && voiceoverPacing() ? speech.say(() => currentState(session.view(), seatNames), true) : Promise.resolve(),
    review: () => !interrupted() && voiceoverPacing() ? speech.say(() => lastTrick(session.view(), seatNames), true) : Promise.resolve(),
    pause: () => {
      if (stopped || paused) return;
      paused = true; speech.cancelPending(); interruptWait?.(); table.render(session.view(), false);
    },
    resume: async () => {
      if (stopped || !paused) return;
      // Keep paused until the abandoned loop fully exits; repeated Resume is harmless.
      await settleDone;
      if (stopped || !paused) return;
      paused = false;
      // Do not park an already-focused unchanged turn; its focus key correctly
      // prevents a second automatic jump. Newly reached turns/results still focus.
      const view = session.view();
      // Hand/game results remain focus-only, including an interrupted final trick.
      await run({ view, messages: view.result ? [] : [currentState(view, seatNames)] });
    },
    isPaused: () => paused,
    stop: () => { stopped = true; speech.stop(); interruptWait?.(); },
  };
}
