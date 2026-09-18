import { effectiveSuit, strength } from '../cards.ts';
import type { Card, Play, Seat, Suit } from '../types.ts';
export function playableCards(hand: readonly Card[], trick: readonly Play[], trump: Suit): Card[] {
  if (trick.length === 0) return [...hand];
  const led = effectiveSuit(trick[0]!.card, trump);
  const following = hand.filter(card => effectiveSuit(card, trump) === led);
  return following.length ? following : [...hand];
}
export function trickWinner(plays: readonly Play[], trump: Suit): Seat {
  if (!plays.length) throw new Error('Cannot resolve an empty trick');
  let winning = plays[0]!;
  for (const challenger of plays.slice(1)) {
    const a = effectiveSuit(winning.card, trump);
    const b = effectiveSuit(challenger.card, trump);
    if ((a !== trump && b === trump) || (a === b && strength(challenger.card, trump) > strength(winning.card, trump))) {
      winning = challenger;
    }
  }
  return winning.seat;
}
