import type { Action } from '../src/index.ts';
import { dealerAnnouncement } from './presentation.ts';
import type { Session, Update } from './session.ts';
import type { createTable } from './render.ts';
export function createController(session: Session, table: ReturnType<typeof createTable>, announce: (text: string) => void,
  wait: (ms: number) => Promise<void> = ms => new Promise(resolve => setTimeout(resolve, ms))) {
  let busy = false;
  let stopped = false;
  let announcedHand = 0;
  async function settle(update?: Update) {
    busy = true;
    try {
      while (!stopped) {
        const current = session.view();
        table.render(current, false);
        const messages: string[] = [];
        if (current.handNumber !== announcedHand) {
          announcedHand = current.handNumber;
          messages.push(dealerAnnouncement(current.dealer));
        }
        messages.push(...(update?.messages ?? []));
        for (const message of messages) {
          if (stopped) return;
          announce(message);
          await wait(Math.max(1600, message.split(' ').length * 300));
          // Clear only this loop's message; a cancelled loop must not erase a new game's speech.
          if (stopped) return;
          announce('');
        }
        if (stopped) return;
        const view = session.view();
        if (view.turn === null || view.turn === 0) {
          table.render(view); table.focus(); return;
        }
        await wait(350);
        if (stopped) return;
        update = session.bot() ?? undefined;
        if (!update) throw new Error('Bot could not advance');
      }
    } finally { busy = false; }
  }
  return {
    start: () => settle(),
    act: async (action: Action) => {
      if (busy || stopped) return;
      const update = session.human(action);
      if (!update) return;
      table.park(); await settle(update);
    },
    next: async () => {
      if (busy || stopped || session.view().phase !== 'hand-over') return;
      table.park(); session.nextHand(); await settle();
    },
    stop: () => { stopped = true; },
  };
}
