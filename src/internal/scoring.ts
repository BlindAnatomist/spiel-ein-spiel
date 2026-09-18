import { teamOf } from '../cards.ts';
import type { HandResult, Seat, Team } from '../types.ts';
export function scoreHand(caller: Seat, makerTricks: number, alone: boolean): HandResult {
  if (!Number.isInteger(makerTricks) || makerTricks < 0 || makerTricks > 5) {
    throw new RangeError('A hand has five tricks');
  }
  const makers = teamOf(caller);
  if (makerTricks <= 2) return { makerTricks, team: (1 - makers) as Team, points: 2, reason: 'euchred' };
  if (makerTricks <= 4) return { makerTricks, team: makers, points: 1, reason: 'made' };
  return { makerTricks, team: makers, points: alone ? 4 : 2, reason: alone ? 'loner-march' : 'march' };
}
