import type { DecisionPolicy } from '../types.ts';
import { STRATEGIES } from './config.ts';
import type { BotLevel } from './config.ts';
import { bestBy, bidding, discardScore, heuristicPlay } from './heuristic.ts';
import { searchPlay } from './search.ts';
export { STRATEGIES } from './config.ts';
export type { BotLevel, Strategy } from './config.ts';
/** Stateless decision function. No referee, deal seed, private logs or seat ports. */
export function createBot(level: BotLevel): DecisionPolicy {
  if (!Object.hasOwn(STRATEGIES, level)) throw new Error('Unknown bot level');
  const config = STRATEGIES[level];
  if (!config) throw new Error('Unknown bot level');
  return view => {
    if (!view.legalActions.length) throw new Error('Bot has no legal action');
    if (view.phase === 'bidding') return bidding(view, config);
    if (view.phase === 'discarding') return bestBy(view.legalActions, action =>
      action.type === 'discard' ? discardScore(view.hand, action.card, view.trump!, config) : -Infinity);
    const fallback = heuristicPlay(view, config);
    return config.samples && view.completedTricks.length >= 5 - config.exactCards
      ? searchPlay(view, config, fallback) : fallback;
  };
}
