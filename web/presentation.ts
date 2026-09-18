import { effectiveSuit, rankOf, suitOf } from '../src/index.ts';
import type { Action, Card, PlayerView, Seat } from '../src/index.ts';
export const names = ['You', 'West', 'Val', 'East'] as const;
export function cardName(card: Card, trump: PlayerView['trump'] = null): string {
  const ranks = { '9': 'Nine', '10': 'Ten', J: 'Jack', Q: 'Queen', K: 'King', A: 'Ace' };
  const bower = trump && rankOf(card) === 'J' && effectiveSuit(card, trump) === trump
    ? `, ${suitOf(card) === trump ? 'right' : 'left'} bower` : '';
  return `${ranks[rankOf(card)]} of ${suitOf(card)}${bower}`;
}
export function actionName(action: Action): string {
  switch (action.type) {
    case 'pass': return 'Pass';
    case 'order-up': return `Order it up${action.alone ? ' and go alone' : ''}`;
    case 'call': return `Call ${action.suit}${action.alone ? ' and go alone' : ''}`;
    case 'discard': return `Discard ${cardName(action.card)}`;
    case 'play': return cardName(action.card);
  }
}
export function resultText(v: PlayerView): string {
  if (!v.result) return '';
  const side = v.result.team === 0 ? 'You and Val' : 'Opponents';
  const reason = { made: 'Made the hand.', march: 'All five tricks.', 'loner-march': 'Loner takes all five tricks.', euchred: v.result.team === 1 ? 'Your team was euchred.' : 'Opponents were euchred.' }[v.result.reason];
  return `${reason} ${side} score ${v.result.points}. Score: you and Val ${v.score[0]}, opponents ${v.score[1]}.${v.winner !== null ? ` ${v.winner === 0 ? 'You and Val win' : 'Opponents win'} the game.` : ''}`;
}
/** Only public differences; a discard's identity is deliberately never narrated. */
export function events(before: PlayerView, after: PlayerView, actor: Seat, action: Action): string[] {
  const messages: string[] = [];
  if (actor !== 0) {
    if (action.type === 'play') messages.push(`${names[actor]} plays ${cardName(action.card, after.trump).toLowerCase()}.`);
    else if (action.type === 'discard') messages.push(`${names[actor]} discards a card.`);
    else if (action.type === 'pass' || action.type === 'order-up' || action.type === 'call') messages.push(`${names[actor]} ${action.type === 'pass' ? 'passes' : action.type === 'order-up' ? `orders up ${after.trump}${action.alone ? ' and goes alone' : ''}` : `calls ${action.suit}${action.alone ? ' and goes alone' : ''}`}.`);
  }
  if (after.completedTricks.length > before.completedTricks.length) messages.push(`${names[after.completedTricks.at(-1)!.winner]} takes the trick.`);
  // Results are spoken through focus, never duplicated in the live region.
  return messages;
}
