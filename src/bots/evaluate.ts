import { deck, effectiveSuit, partnerOf, rankOf, SUITS, teamOf } from '../cards.ts';
import { strength, trickWinner } from '../rules.ts';
import type { Card, PlayerView, Seat, Suit } from '../types.ts';
import type { Strategy } from './config.ts';
export const SEATS: readonly Seat[] = Object.freeze([0, 1, 2, 3]);
const fullDeck = deck();
export function trumpCount(hand: readonly Card[], trump: Suit): number {
  return hand.filter(card => effectiveSuit(card, trump) === trump).length;
}
export function handValue(hand: readonly Card[], trump: Suit, config: Strategy): number {
  const count = trumpCount(hand, trump);
  const sides = SUITS.filter(s => s !== trump);
  let value = 0;
  for (const card of hand) {
    if (effectiveSuit(card, trump) === trump) {
      const power = strength(card, trump);
      value += config.trumpWeights[power < 2 ? power : power - 1]!;
    } else if (rankOf(card) === 'A') value += config.aceWeight;
  }
  value += Math.max(0, count - 1) * config.lengthBonus;
  if (count >= 2) value += sides.filter(s => !hand.some(c => effectiveSuit(c, trump) === s)).length * config.voidBonus;
  return value;
}
export function publicPlayed(view: PlayerView): Card[] {
  return [...view.completedTricks.flatMap(t => t.plays.map(p => p.card)), ...view.trick.map(p => p.card)];
}
export function unseenCards(view: PlayerView): Card[] {
  const known = new Set([...view.hand, ...publicPlayed(view)]);
  if (view.upCardStatus === 'turned-down') known.add(view.upCard);
  return fullDeck.filter(c => !known.has(c));
}
/** True if no unplayed, unowned higher card in this effective suit remains. */
export function isMaster(card: Card, view: PlayerView): boolean {
  const trump = view.trump!;
  return !unseenCards(view).some(c => effectiveSuit(c, trump) === effectiveSuit(card, trump) && strength(c, trump) > strength(card, trump));
}
export function keepValue(card: Card, trump: Suit): number {
  return (effectiveSuit(card, trump) === trump ? 10 : 0) + strength(card, trump);
}
export function partnerWinning(view: PlayerView): boolean {
  return view.trick.length > 0 && trickWinner(view.trick, view.trump!) === partnerOf(view.seat);
}
export function makers(view: PlayerView): boolean {
  return view.caller !== null && teamOf(view.caller) === teamOf(view.seat);
}
export function afterSeats(view: PlayerView): Seat[] {
  const result: Seat[] = [];
  // Seats still to act after us before returning to this trick's leader.
  const leader = view.trick[0]?.seat ?? view.seat;
  for (let s = (view.seat + 1) % 4; s !== leader; s = (s + 1) % 4) {
    if (s !== view.sittingOut) result.push(s as Seat);
  }
  return result;
}
