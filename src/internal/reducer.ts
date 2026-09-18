import { nextSeat, teamOf } from '../cards.ts';
import type { Seat } from '../types.ts';
import { applyBid, startPlay } from './bidding.ts';
import { deal } from './deal.ts';
import { canonicalAction } from './legal.ts';
import { scoreHand } from './scoring.ts';
import type { State } from './state.ts';
import { trickWinner } from './tricks.ts';
export function transition(previous: State, seat: Seat, input: unknown): State | null {
  const action = canonicalAction(previous, seat, input);
  if (!action) return null;
  const state = structuredClone(previous);
  switch (action.type) {
    case 'pass': case 'order-up': case 'call':
      applyBid(state, seat, action);
      break;
    case 'discard':
      state.hands[seat] = state.hands[seat]!.filter(card => card !== action.card);
      state.kitty.push(action.card);
      startPlay(state);
      break;
    case 'play': {
      state.hands[seat] = state.hands[seat]!.filter(card => card !== action.card);
      state.trick.push({ seat, card: action.card });
      state.turn = nextSeat(seat, state.sittingOut);
      if (state.trick.length === (state.alone ? 3 : 4)) {
        const winner = trickWinner(state.trick, state.trump!);
        state.completedTricks.push({ plays: state.trick, winner });
        state.trick = [];
        state.turn = winner;
        if (state.completedTricks.length === 5) {
          const count = state.completedTricks.filter(trick => teamOf(trick.winner) === teamOf(state.caller!)).length;
          state.result = scoreHand(state.caller!, count, state.alone);
          state.score[state.result.team] += state.result.points;
          state.winner = state.score[state.result.team] >= 10 ? state.result.team : null;
          state.phase = state.winner === null ? 'hand-over' : 'game-over';
          state.turn = null;
        }
      }
    }
  }
  return state;
}
/** Host action, deliberately absent from the player action union. */
export function nextHand(state: State): State {
  if (state.phase !== 'hand-over') throw new Error('Next hand requires a completed, nonterminal hand');
  return deal(state.rng, nextSeat(state.dealer), state.score, state.handNumber + 1);
}
