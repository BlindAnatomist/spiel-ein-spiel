import type { Action } from '../src/index.ts';
import type { Session, Update } from './session.ts';
import type { createTable } from './render.ts';
export function createController(session: Session, table: ReturnType<typeof createTable>, announce: (text: string) => void,
  wait: (ms: number) => Promise<void> = ms => new Promise(resolve => setTimeout(resolve, ms))) {
  let busy = false;
  let stopped = false;
  async function settle(update?: Update) {
    busy = true;
    try {
      while (!stopped) {
        table.render(session.view(), false);
        for (const message of update?.messages ?? []) {
          if (stopped) return;
          announce(message);
          await wait(Math.max(1600, message.split(' ').length * 300));
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
