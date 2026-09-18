import { SUITS, suitOf } from '../cards.ts';
import type { Action, Seat } from '../types.ts';
import type { State } from './state.ts';
import { playableCards } from './tricks.ts';
export function legalActions(state: State, seat: Seat): Action[] {
  if (state.turn !== seat) return [];
  switch (state.phase) {
    case 'bidding': {
      const bids: Action[] = state.biddingRound === 1
        ? [false, true].map(alone => ({ type: 'order-up', alone }))
        : SUITS.filter(suit => suit !== suitOf(state.upCard)).flatMap(suit =>
          [false, true].map(alone => ({ type: 'call' as const, suit, alone })));
      if (!(state.biddingRound === 2 && seat === state.dealer && state.passes === 3)) bids.push({ type: 'pass' });
      return bids;
    }
    case 'discarding': return state.hands[seat]!.map(card => ({ type: 'discard', card }));
    case 'playing': return playableCards(state.hands[seat]!, state.trick, state.trump!)
      .map(card => ({ type: 'play', card }));
    default: return [];
  }
}
/** Validate runtime inputs and return our canonical action, never caller-owned objects. */
export function canonicalAction(state: State, seat: Seat, input: unknown): Action | null {
  if (!input || typeof input !== 'object') return null;
  try {
    const keys = Reflect.ownKeys(input);
    return legalActions(state, seat).find(action => {
      const expected = Object.keys(action);
      return keys.length === expected.length && expected.every(key => {
        const property = Object.getOwnPropertyDescriptor(input, key);
        return property && 'value' in property && property.value === (action as unknown as Record<string, unknown>)[key];
      });
    }) ?? null;
  } catch { return null; }
}
