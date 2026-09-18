import { deck, nextSeat } from '../cards.ts';
import type { Card, Seat } from '../types.ts';
import type { State } from './state.ts';
/** Fixed 32-bit LCG. Integer rejection sampling avoids modulo bias. Not cryptographic. */
function drawBelow(rng: number, bound: number): { rng: number; value: number } {
  const bucket = Math.floor(0x100000000 / bound);
  const limit = bucket * bound;
  do { rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0; } while (rng >= limit);
  return { rng, value: Math.floor(rng / bucket) };
}
export function deal(rng: number, dealer: Seat, score: [number, number], handNumber: number): State {
  const cards = deck();
  for (let i = cards.length - 1; i > 0; i--) {
    const draw = drawBelow(rng, i + 1);
    rng = draw.rng;
    [cards[i], cards[draw.value]] = [cards[draw.value]!, cards[i]!];
  }
  const hands: Card[][] = [[], [], [], []];
  // One card per seat in clockwise order, repeated five times; stable hand order.
  for (let i = 0; i < 20; i++) hands[(dealer + 1 + i) % 4]!.push(cards[i]!);
  return {
    rng, hands, kitty: cards.slice(20), phase: 'bidding', handNumber,
    dealer, turn: nextSeat(dealer), biddingRound: 1, passes: 0,
    upCard: cards[20]!, upCardStatus: 'face-up', bids: [], trump: null, caller: null,
    alone: false, sittingOut: null, trick: [], completedTricks: [], score: [...score],
    result: null, winner: null,
  };
}
export function initialState(seed: number, dealer: Seat = 0): State {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new RangeError('Seed must be an unsigned 32-bit integer');
  }
  return deal(seed, dealer, [0, 0], 1);
}
