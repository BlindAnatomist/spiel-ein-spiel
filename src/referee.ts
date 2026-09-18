/** Privileged host entry point. Never pass this object or the seed to a policy. */
import { assertSeat } from './cards.ts';
import type { ActionResult, PlayerPort, Seat } from './types.ts';
import { initialState } from './internal/deal.ts';
import { nextHand, transition } from './internal/reducer.ts';
import { frozenCopy, playerView } from './internal/view.ts';
export function createReferee(options: { seed: number; dealer?: Seat }) {
  const dealer = options.dealer ?? 0;
  assertSeat(dealer);
  let state = initialState(options.seed, dealer);
  let applying = false;
  return Object.freeze({
    /** Privileged diagnostic copy for replay tests, never a policy input. */
    snapshot: () => frozenCopy(state),
    nextHand: () => {
      if (applying) throw new Error('Action already in progress');
      state = nextHand(state);
    },
    player: (seat: Seat): PlayerPort => {
      assertSeat(seat);
      return Object.freeze({
        view: () => playerView(state, seat),
        act: (input: unknown): ActionResult => {
          // Prevent accessor/proxy reentry from replacing a newer state with an older one.
          if (applying) return { ok: false, error: 'illegal-action', view: playerView(state, seat) };
          applying = true;
          try {
            const updated = transition(state, seat, input);
            if (!updated) return { ok: false, error: 'illegal-action', view: playerView(state, seat) };
            state = updated;
            return { ok: true, view: playerView(state, seat) };
          } finally { applying = false; }
        },
      });
    },
  });
}
