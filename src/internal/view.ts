import { effectiveSuit } from '../cards.ts';
import type { PlayerView, Seat, Suit } from '../types.ts';
import { legalActions } from './legal.ts';
import type { State } from './state.ts';
export function frozenCopy<T>(value: T): T {
  function freeze(object: unknown): void {
    if (object && typeof object === 'object') {
      for (const child of Object.values(object)) freeze(child);
      Object.freeze(object);
    }
  }
  const copy = structuredClone(value);
  freeze(copy);
  return copy;
}
export function playerView(state: State, seat: Seat): PlayerView {
  const knownVoids: Suit[][] = [[], [], [], []];
  if (state.trump) {
    for (const plays of [...state.completedTricks.map(trick => trick.plays), state.trick]) {
      if (!plays.length) continue;
      const led = effectiveSuit(plays[0]!.card, state.trump);
      for (const play of plays.slice(1)) {
        if (effectiveSuit(play.card, state.trump) !== led && !knownVoids[play.seat]!.includes(led)) {
          knownVoids[play.seat]!.push(led);
        }
      }
    }
  }
  // Explicit allowlist. New referee fields cannot silently become public.
  return frozenCopy({
    seat, hand: state.hands[seat]!, phase: state.phase, handNumber: state.handNumber,
    dealer: state.dealer, turn: state.turn, biddingRound: state.biddingRound,
    upCard: state.upCard, upCardStatus: state.upCardStatus, bids: state.bids,
    trump: state.trump, caller: state.caller, alone: state.alone, sittingOut: state.sittingOut,
    trick: state.trick, completedTricks: state.completedTricks, knownVoids,
    score: state.score, result: state.result, winner: state.winner,
    legalActions: legalActions(state, seat),
  });
}
