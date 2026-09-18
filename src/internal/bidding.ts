import { nextSeat, partnerOf, suitOf } from '../cards.ts';
import type { Action, Seat } from '../types.ts';
import type { State } from './state.ts';
export function startPlay(state: State): void {
  state.phase = 'playing';
  state.turn = nextSeat(state.dealer, state.sittingOut);
}
/** Mutates only the reducer's private copy after legality has been established. */
export function applyBid(state: State, seat: Seat, action: Extract<Action, { type: 'pass' | 'order-up' | 'call' }>): void {
  state.bids.push({ seat, round: state.biddingRound, action });
  if (action.type === 'pass') {
    state.passes++;
    state.turn = nextSeat(seat);
    if (state.passes === 4) {
      state.biddingRound = 2;
      state.passes = 0;
      state.upCardStatus = 'turned-down';
    }
    return;
  }
  state.caller = seat;
  state.alone = action.alone;
  state.sittingOut = action.alone ? partnerOf(seat) : null;
  state.trump = action.type === 'call' ? action.suit : suitOf(state.upCard);
  if (action.type === 'order-up') {
    state.upCardStatus = 'ordered';
    state.hands[state.dealer]!.push(state.upCard);
    state.kitty = state.kitty.filter(card => card !== state.upCard);
    state.phase = 'discarding';
    state.turn = state.dealer; // Even a sitting-out dealer must discard.
  } else startPlay(state);
}
