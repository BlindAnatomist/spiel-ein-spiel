/** Trusted coordination. Referee and other seats never cross this module's return boundary. */
import { createReferee } from '../src/referee.ts';
import { createBot } from '../src/bots/index.ts';
import type { Action, PlayerView, Seat } from '../src/index.ts';
import { events } from './presentation.ts';
export type Difficulty = 'casual' | 'strong' | 'expert';
export const policyLevels = (level: Difficulty) => [null, level, 'val', level] as const;
export interface Update { view: PlayerView; messages: readonly string[] }
export interface Session {
  view(): PlayerView;
  human(action: Action): Update | null;
  bot(): Update | null;
  nextHand(): PlayerView;
}
export interface SessionOptions {
  dealer?: Seat;
  /** Live browser games supply cryptographic 32-bit words; tests omit this for deterministic replay. */
  randomWord?: () => number;
}
export function createSession(seed: number, level: Difficulty, options: SessionOptions = {}): Session {
  const referee = createReferee({ seed, dealer: options.dealer, randomWord: options.randomWord });
  const ports = ([0, 1, 2, 3] as const).map(seat => referee.player(seat));
  const policies = policyLevels(level).map(kind => kind === null ? null : createBot(kind));
  const view = () => ports[0]!.view();
  const apply = (actor: Seat, action: Action): Update | null => {
    const before = view();
    const result = ports[actor]!.act(action);
    if (!result.ok) return null;
    const after = view();
    return { view: after, messages: events(before, after, actor, action) };
  };
  return Object.freeze({ view,
    human: (action: Action) => apply(0, action),
    bot: () => {
      const seat = view().turn;
      if (seat === null || seat === 0) return null;
      return apply(seat, policies[seat]!(ports[seat]!.view()));
    },
    nextHand: () => { referee.nextHand(); return view(); },
  });
}
