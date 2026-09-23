import type { Action } from '../src/index.ts';
import { createAnnouncer } from './announcer.ts';
import { cueEvents, type SoundCue } from './sound.ts';
import { currentState, lastTrick, handAnnouncement, dealerAnnouncement } from './presentation.ts';
import type { Session, Update } from './session.ts';
import type { createTable } from './render.ts';
/** Quiet time after the live region clears, only before automatic focus. */
export const FOCUS_GUARD_MS = 1150;
export function createController(session: Session, table: ReturnType<typeof createTable>, announce: (text: string) => void,
  wait: (ms: number) => Promise<void> = ms => new Promise(resolve => setTimeout(resolve, ms)),
  sound: (cue: SoundCue) => void = () => {}) {
  const speech = createAnnouncer(announce, wait);
  let busy = false;
  let stopped = false;
  let announcedHand = 0;
  async function settle(update?: Update, handStart = false) {
    busy = true;
    const initialSpeech = speech.revision();
    try {
      while (!stopped) {
        const current = session.view();
        table.render(current, false);
        const messages: string[] = [];
        if (handStart && current.handNumber !== announcedHand) {
          announcedHand = current.handNumber;
          messages.push(dealerAnnouncement(current.dealer), handAnnouncement(current));
        }
        messages.push(...(update?.messages ?? []));
        await Promise.all(messages.map(message => speech.say(message)));
        // An explicitly requested review shares the queue and finishes before automatic focus.
        await speech.say('');
        if (stopped) return;
        const view = session.view();
        if (view.turn === null || view.turn === 0) {
          if (speech.revision() !== initialSpeech) {
            // Reviews arriving during the guard must also finish and clear first.
            let revision: number;
            do {
              await speech.say('');
              if (stopped) return;
              revision = speech.revision();
              await wait(FOCUS_GUARD_MS);
              if (stopped) return;
              await speech.say('');
            } while (speech.revision() !== revision);
          }
          if (stopped) return;
          table.render(view); table.focus(); return;
        }
        await wait(350);
        if (stopped) return;
        const before = session.view();
        update = session.bot() ?? undefined;
        if (update) cueEvents(before, update.view).forEach(sound);
        handStart = false;
        if (!update) throw new Error('Bot could not advance');
      }
    } finally { busy = false; }
  }
  return {
    start: () => settle(undefined, true),
    act: async (action: Action) => {
      if (busy || stopped) return;
      const before = session.view();
      const update = session.human(action);
      if (!update) return;
      speech.cancelReviews();
      cueEvents(before, update.view).forEach(sound);
      table.park(); await settle(update);
    },
    next: async () => {
      if (busy || stopped || session.view().phase !== 'hand-over') return;
      speech.cancelReviews();
      table.park(); session.nextHand(); await settle(undefined, true);
    },
    repeat: () => speech.say(() => currentState(session.view()), true),
    review: () => speech.say(() => lastTrick(session.view()), true),
    stop: () => { stopped = true; speech.stop(); },
  };
}
