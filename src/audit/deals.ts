import { RANKS, SUITS, deck, rankOf, suitOf } from '../cards.ts';
import type { Card, Rank, Seat, Suit } from '../types.ts';
import { deal, type RandomWord } from '../internal/deal.ts';
import { count, simulationSeed, uint32 } from '../simulation/index.ts';

export type DealLocation = 'seat-0' | 'seat-1' | 'seat-2' | 'seat-3' | 'kitty';

export interface DealAuditOptions {
  deals: number;
  seed: number;
  randomWord?: RandomWord;
}

export interface DealAudit {
  deals: number;
  seed: number;
  source: 'deterministic' | 'injected-random';
  expectedCardLocationRates: readonly [number, number, number, number, number];
  cardLocationCounts: Readonly<Record<Card, readonly [number, number, number, number, number]>>;
  maxCardLocationAbsZ: number;
  maxCardLocation: { card: Card; location: DealLocation; count: number; z: number };
  seatZeroRankAverage: Readonly<Record<Rank, number>>;
  seatZeroSuitAverage: Readonly<Record<Suit, number>>;
  seatZeroDistinctSuitsHistogram: readonly number[];
  seatZeroMaxSameSuitHistogram: readonly number[];
  expectedSeatZeroPairRate: number;
  maxSeatZeroPairAbsZ: number;
  maxSeatZeroPair: { cards: readonly [Card, Card]; count: number; z: number };
}

function zScore(observed: number, trials: number, probability: number): number {
  const variance = trials * probability * (1 - probability);
  return variance ? (observed - trials * probability) / Math.sqrt(variance) : 0;
}

function pairKey(a: Card, b: Card): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function auditDeals(options: DealAuditOptions): DealAudit {
  count(options.deals);
  uint32(options.seed);
  const cards = deck();
  const locations = Object.fromEntries(cards.map(card => [card, [0, 0, 0, 0, 0]])) as Record<Card, [number, number, number, number, number]>;
  const rankCounts = Object.fromEntries(RANKS.map(rank => [rank, 0])) as Record<Rank, number>;
  const suitCounts = Object.fromEntries(SUITS.map(suit => [suit, 0])) as Record<Suit, number>;
  const distinctSuits = [0, 0, 0, 0, 0];
  const maxSameSuit = [0, 0, 0, 0, 0, 0];
  const pairCounts = new Map<string, number>();
  for (let i = 0; i < cards.length; i++) {
    for (let j = i + 1; j < cards.length; j++) pairCounts.set(pairKey(cards[i]!, cards[j]!), 0);
  }

  for (let index = 0; index < options.deals; index++) {
    const state = deal(simulationSeed(options.seed, index), (index % 4) as Seat, [0, 0], 1, options.randomWord);
    state.hands.forEach((hand, seat) => {
      for (const card of hand) locations[card]![seat]!++;
    });
    for (const card of state.kitty) locations[card]![4]++;

    const human = state.hands[0]!;
    const seenSuits = new Set<Suit>();
    const handSuits = Object.fromEntries(SUITS.map(suit => [suit, 0])) as Record<Suit, number>;
    for (const card of human) {
      const rank = rankOf(card);
      const suit = suitOf(card);
      rankCounts[rank]++;
      suitCounts[suit]++;
      seenSuits.add(suit);
      handSuits[suit]++;
    }
    distinctSuits[seenSuits.size]!++;
    maxSameSuit[Math.max(...Object.values(handSuits))]!++;
    for (let i = 0; i < human.length; i++) {
      for (let j = i + 1; j < human.length; j++) {
        const key = pairKey(human[i]!, human[j]!);
        pairCounts.set(key, pairCounts.get(key)! + 1);
      }
    }
  }

  const expectedCardLocationRates = [5 / 24, 5 / 24, 5 / 24, 5 / 24, 4 / 24] as const;
  const locationNames: readonly DealLocation[] = ['seat-0', 'seat-1', 'seat-2', 'seat-3', 'kitty'];
  let maxCardLocation = { card: cards[0]!, location: locationNames[0]!, count: 0, z: 0 };
  for (const card of cards) {
    for (let location = 0; location < 5; location++) {
      const observed = locations[card]![location]!;
      const z = zScore(observed, options.deals, expectedCardLocationRates[location]!);
      if (Math.abs(z) > Math.abs(maxCardLocation.z)) {
        maxCardLocation = { card, location: locationNames[location]!, count: observed, z };
      }
    }
  }

  const expectedPairRate = (5 / 24) * (4 / 23);
  let maxPair = { cards: [cards[0]!, cards[1]!] as readonly [Card, Card], count: 0, z: 0 };
  for (let i = 0; i < cards.length; i++) {
    for (let j = i + 1; j < cards.length; j++) {
      const pair = [cards[i]!, cards[j]!] as const;
      const observed = pairCounts.get(pairKey(pair[0], pair[1]))!;
      const z = zScore(observed, options.deals, expectedPairRate);
      if (Math.abs(z) > Math.abs(maxPair.z)) maxPair = { cards: pair, count: observed, z };
    }
  }

  return {
    deals: options.deals,
    seed: options.seed,
    source: options.randomWord ? 'injected-random' : 'deterministic',
    expectedCardLocationRates,
    cardLocationCounts: locations,
    maxCardLocationAbsZ: Math.abs(maxCardLocation.z),
    maxCardLocation,
    seatZeroRankAverage: Object.fromEntries(RANKS.map(rank => [rank, rankCounts[rank] / options.deals])) as Record<Rank, number>,
    seatZeroSuitAverage: Object.fromEntries(SUITS.map(suit => [suit, suitCounts[suit] / options.deals])) as Record<Suit, number>,
    seatZeroDistinctSuitsHistogram: distinctSuits,
    seatZeroMaxSameSuitHistogram: maxSameSuit,
    expectedSeatZeroPairRate: expectedPairRate,
    maxSeatZeroPairAbsZ: Math.abs(maxPair.z),
    maxSeatZeroPair: maxPair,
  };
}
