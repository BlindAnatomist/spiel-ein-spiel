import { effectiveSuit, rankOf, suitOf, teamOf } from '../src/index.ts';
import type { Action, Card, PlayerView, Seat } from '../src/index.ts';
export const names = ['You', 'West', 'Val', 'East'] as const;
export function dealerAnnouncement(dealer: Seat): string {
  return dealer === 0 ? 'You deal.' : `${names[dealer]} deals.`;
}
export function cardName(card: Card, trump: PlayerView['trump'] = null): string {
  const ranks = { '9': 'Nine', '10': 'Ten', J: 'Jack', Q: 'Queen', K: 'King', A: 'Ace' };
  const bower = trump && rankOf(card) === 'J' && effectiveSuit(card, trump) === trump
    ? suitOf(card) === trump ? ', right bower' : `, left bower, counts as ${trump}` : '';
  return `${ranks[rankOf(card)]} of ${suitOf(card)}${bower}`;
}
export function actionName(action: Action, upCard?: Card): string {
  switch (action.type) {
    case 'pass': return 'Pass';
    case 'order-up': return `${upCard ? `Order up ${suitOf(upCard)}` : 'Order it up'}${action.alone ? ' and go alone' : ''}`;
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
    if (action.type === 'play') messages.push(`${names[actor]} ${before.trick.length === 0 && (after.trick.some(p => p.seat === actor && p.card === action.card) || after.completedTricks.length > before.completedTricks.length) ? 'leads' : 'plays'} ${cardName(action.card, after.trump).toLowerCase()}.`);
    else if (action.type === 'discard') messages.push(`${names[actor]} discards a card.`);
    else if (action.type === 'pass' || action.type === 'order-up' || action.type === 'call') messages.push(`${names[actor]} ${action.type === 'pass' ? 'passes' : action.type === 'order-up' ? `orders up ${after.trump}${action.alone ? ' and goes alone' : ''}` : `calls ${action.suit}${action.alone ? ' and goes alone' : ''}`}.`);
  }
  if (before.upCardStatus !== after.upCardStatus) {
    if (after.upCardStatus === 'turned-down') messages.push('The up-card is turned down.');
    if (after.upCardStatus === 'ordered') messages.push(`${names[after.dealer]} ${after.dealer === 0 ? 'pick' : 'picks'} up.`);
  }
  if (after.completedTricks.length > before.completedTricks.length) {
    const winner = after.completedTricks.at(-1)!.winner;
    messages.push(`${names[winner]} ${winner === 0 ? 'take' : 'takes'} the trick.`);
  }
  // Results are spoken through focus, never duplicated in the live region.
  return messages;
}

export function handAnnouncement(v: PlayerView): string {
  return `Up-card: ${cardName(v.upCard).toLowerCase()}.`;
}
/** No hand, legal actions, hidden state, or strategy is read by either review. */
export function currentState(v: PlayerView): string {
  const parts = [`Hand ${v.handNumber}. Dealer: ${names[v.dealer]}.`];
  if (!v.result) parts.push(`Score: you and Val ${v.score[0]}, opponents ${v.score[1]}. First to 10.`);
  const ours = v.completedTricks.filter(t => teamOf(t.winner) === 0).length;
  parts.push(`You and Val have ${ours} ${ours === 1 ? 'trick' : 'tricks'}; opponents have ${v.completedTricks.length - ours}.`);
  if (v.phase === 'bidding') {
    parts.push(`Up-card: ${cardName(v.upCard).toLowerCase()}, ${v.upCardStatus}.`,
      `${v.biddingRound === 1 ? 'First' : 'Second'} calling round.`);
  } else {
    parts.push(`Called suit: ${v.trump}. Caller: ${names[v.caller!]}.`);
    if (v.alone) parts.push(`${names[v.caller!]} ${v.caller === 0 ? 'are' : 'is'} going alone.`);
    if (v.sittingOut !== null) parts.push(`${names[v.sittingOut]} ${v.sittingOut === 0 ? 'sit' : 'sits'} out.`);
    if (v.phase === 'discarding') parts.push(`Up-card: ${cardName(v.upCard).toLowerCase()}, ordered.`);
    if (v.phase === 'playing' && v.trick.length) {
      parts.push('Current trick.', ...v.trick.map((p, i) =>
        `${names[p.seat]} ${i === 0 ? 'led' : 'played'} ${cardName(p.card, v.trump).toLowerCase()}.`));
    }
  }
  if (v.result) parts.push(resultText(v));
  else if (v.turn !== null) parts.push(v.phase === 'discarding' ? `${names[v.turn]} must discard.`
    : v.phase === 'playing' && !v.trick.length ? `${names[v.turn]} ${v.turn === 0 ? 'lead' : 'leads'}.` : `${names[v.turn]} to act.`);
  return parts.join(' ');
}
export function lastTrick(v: PlayerView): string {
  const trick = v.completedTricks.at(-1);
  if (!trick) return '';
  return ['Last trick.', ...trick.plays.map((p, i) => `${names[p.seat]} ${i === 0 ? 'led' : 'played'} ${cardName(p.card, v.trump).toLowerCase()}.`),
    `${names[trick.winner]} took the trick.`].join(' ');
}
