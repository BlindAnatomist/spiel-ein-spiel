/** Trusted coordination. Referee and other seats never cross this module's return boundary. */
import { createReferee } from '../src/referee.ts';
import { createBot, createBotWithStrategy } from '../src/bots/index.ts';
import { selectOpponentProfiles } from '../src/bots/profiles.ts';
import type { OpponentDifficulty, OpponentLevel, OpponentProfileId } from '../src/bots/profiles.ts';
import type { Action, PlayerView, Seat } from '../src/index.ts';
import { events } from './presentation.ts';

export type Difficulty = OpponentDifficulty;
export const policyLevels = (level: Difficulty) => {
  const fallback: OpponentLevel = level === 'mixed' ? 'strong' : level;
  return [null, fallback, 'val', fallback] as const;
};

export interface OpponentIdentity {
  readonly seat: 1 | 3;
  readonly id: OpponentProfileId;
  readonly label: string;
  readonly level: OpponentLevel;
}
export interface SessionMeta {
  readonly difficulty: Difficulty;
  readonly opponents: readonly [OpponentIdentity, OpponentIdentity];
}
export interface SessionObserver {
  handCompleted?(view: PlayerView, meta: SessionMeta): void;
  gameCompleted?(view: PlayerView, meta: SessionMeta): void;
}
export interface Update { view: PlayerView; messages: readonly string[] }
export interface Session {
  readonly meta: SessionMeta;
  view(): PlayerView;
  human(action: Action): Update | null;
  bot(): Update | null;
  nextHand(): PlayerView;
}
export interface SessionOptions {
  dealer?: Seat;
  /** Live browser games supply cryptographic 32-bit words; tests omit this for deterministic replay. */
  randomWord?: () => number;
  /** Public completion events only. Observer failures never interrupt play. */
  observer?: SessionObserver;
}

export function createSession(seed: number, level: Difficulty, options: SessionOptions = {}): Session {
  const referee = createReferee({ seed, dealer: options.dealer, randomWord: options.randomWord });
  const ports = ([0, 1, 2, 3] as const).map(seat => referee.player(seat));
  const profiles = selectOpponentProfiles(level, seed);
  const policies = [
    null,
    createBotWithStrategy(profiles[0].strategy),
    createBot('val'),
    createBotWithStrategy(profiles[1].strategy),
  ] as const;
  const opponents = Object.freeze([
    Object.freeze({ seat: 1 as const, id: profiles[0].id, label: profiles[0].label, level: profiles[0].level }),
    Object.freeze({ seat: 3 as const, id: profiles[1].id, label: profiles[1].label, level: profiles[1].level }),
  ] as const);
  const meta: SessionMeta = Object.freeze({ difficulty: level, opponents });
  const view = () => ports[0]!.view();

  function notify(kind: 'handCompleted' | 'gameCompleted', completed: PlayerView): void {
    try { options.observer?.[kind]?.(completed, meta); } catch {}
  }

  const apply = (actor: Seat, action: Action): Update | null => {
    const before = view();
    const result = ports[actor]!.act(action);
    if (!result.ok) return null;
    const after = view();
    if (before.result === null && after.result !== null) {
      notify('handCompleted', after);
      if (after.phase === 'game-over') notify('gameCompleted', after);
    }
    return { view: after, messages: events(before, after, actor, action) };
  };

  return Object.freeze({
    meta,
    view,
    human: (action: Action) => apply(0, action),
    bot: () => {
      const seat = view().turn;
      if (seat === null || seat === 0) return null;
      return apply(seat, policies[seat]!(ports[seat]!.view()));
    },
    nextHand: () => { referee.nextHand(); return view(); },
  });
}
