import type { Card, Rank, Seat, Suit, Team } from './types.ts';
export const SUITS: readonly Suit[] = Object.freeze(['clubs', 'diamonds', 'hearts', 'spades']);
export const RANKS: readonly Rank[] = Object.freeze(['9', '10', 'J', 'Q', 'K', 'A']);
const partners: Record<Suit, Suit> = {
  clubs: 'spades', spades: 'clubs', diamonds: 'hearts', hearts: 'diamonds',
};
export function deck(): Card[] {
  return SUITS.flatMap(suit => RANKS.map(rank => `${suit}:${rank}` as Card));
}
export function suitOf(card: Card): Suit { return card.split(':')[0] as Suit; }
export function rankOf(card: Card): Rank { return card.split(':')[1] as Rank; }
export function effectiveSuit(card: Card, trump: Suit): Suit {
  return card === `${partners[trump]}:J` ? trump : suitOf(card);
}
/** Rank within an effective suit; trump versus led suit is resolved separately. */
export function strength(card: Card, trump: Suit): number {
  if (card === `${trump}:J`) return 7;
  if (card === `${partners[trump]}:J`) return 6;
  return RANKS.indexOf(rankOf(card));
}
export function teamOf(seat: Seat): Team { return (seat % 2) as Team; }
export function partnerOf(seat: Seat): Seat { return ((seat + 2) % 4) as Seat; }
export function nextSeat(seat: Seat, excluded: Seat | null = null): Seat {
  const next = ((seat + 1) % 4) as Seat;
  return next === excluded ? ((next + 1) % 4) as Seat : next;
}
export function assertSeat(seat: unknown): asserts seat is Seat {
  if (!Number.isInteger(seat) || Number(seat) < 0 || Number(seat) > 3) {
    throw new RangeError('Seat must be 0, 1, 2, or 3');
  }
}
