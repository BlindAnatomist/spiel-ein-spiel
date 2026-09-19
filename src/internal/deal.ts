import { deck, nextSeat } from '../cards.ts';
import type { Card, Seat } from '../types.ts';
import type { State } from './state.ts';

export type RandomWord = () => number;

function assertWord(value: number): void {
  if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) {
    throw new RangeError('Random word must be an unsigned 32-bit integer');
  }
}

/** Fixed 32-bit LCG for deterministic tests/simulations. */
function nextDeterministicWord(rng: number): number {
  return (Math.imul(rng, 1664525) + 1013904223) >>> 0;
}

/** Integer rejection sampling avoids modulo bias for both deterministic and live random sources. */
function drawBelow(rng: number, bound: number, randomWord?: RandomWord): { rng: number; value: number } {
  const bucket = Math.floor(0x100000000 / bound);
  const limit = bucket * bound;
  let word: number;
  do {
    if (randomWord) {
      word = randomWord();
      assertWord(word);
    } else {
      rng = nextDeterministicWord(rng);
      word = rng;
    }
  } while (word >= limit);
  return { rng, value: Math.floor(word / bucket) };
}

export function deal(rng: number, dealer: Seat, score: [number, number], handNumber: number,
  randomWord?: RandomWord): State {
  const cards = deck();
  for (let i = cards.length - 1; i > 0; i--) {
    const draw = drawBelow(rng, i + 1, randomWord);
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
export function initialState(seed: number, dealer: Seat = 0, randomWord?: RandomWord): State {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new RangeError('Seed must be an unsigned 32-bit integer');
  }
  return deal(seed, dealer, [0, 0], 1, randomWord);
}
