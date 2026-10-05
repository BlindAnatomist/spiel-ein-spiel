import { effectiveSuit, rankOf, suitOf, teamOf } from '../src/index.ts';
import type { Action, Card, PlayerView, Seat } from '../src/index.ts';
import type { NarrationMessage } from './narration-types.ts';
import { narratorVariants } from './narrator-variants.ts';
export type SeatNames = readonly [string, string, string, string];
export const names: SeatNames = ['You', 'West', 'Val', 'East'];
export function dealerAnnouncement(dealer: Seat, seatNames: SeatNames = names): string {
  return dealer === 0 ? 'You deal.' : `${seatNames[dealer]} deals.`;
}
const actorClip = (name: string) => `actor.${name.toLowerCase()}`;
const withVariants = (message: NarrationMessage): NarrationMessage => {
  const alternatives = message.whole ? narratorVariants[message.whole] : undefined;
  return alternatives ? { ...message, alternatives } : message;
};
export function cardClip(card: Card, trump: PlayerView['trump'] = null): string {
  if (trump && rankOf(card) === 'J' && effectiveSuit(card, trump) === trump) {
    return `bower.${suitOf(card) === trump ? 'right' : 'left'}.${suitOf(card)}`;
  }
  return `card.${suitOf(card)}.${rankOf(card).toLowerCase()}`;
}
export function handStartNarration(v: PlayerView, seatNames: SeatNames = names): NarrationMessage[] {
  return [
    { text: dealerAnnouncement(v.dealer, seatNames), clips: [actorClip(seatNames[v.dealer]), `event.${v.dealer === 0 ? 'deal' : 'deals'}`], whole: `full.deal.${seatNames[v.dealer].toLowerCase()}` },
    { text: handAnnouncement(v), clips: ['event.up-card', cardClip(v.upCard)], whole: `full.up-card.${cardClip(v.upCard)}` },
  ].map(withVariants);
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
export function narrationEvents(before: PlayerView, after: PlayerView, actor: Seat, action: Action, seatNames: SeatNames = names): NarrationMessage[] {
  const messages: NarrationMessage[] = [];
  const who = actorClip(seatNames[actor]);
  if (actor !== 0) {
    if (action.type === 'play') {
      const verb = before.trick.length === 0 && (after.trick.some(p => p.seat === actor && p.card === action.card) || after.completedTricks.length > before.completedTricks.length) ? 'leads' : 'plays';
      messages.push({ text: `${seatNames[actor]} ${verb} ${cardName(action.card, after.trump).toLowerCase()}.`, clips: [`prefix.${seatNames[actor].toLowerCase()}.${verb}`, cardClip(action.card, after.trump)],
        whole: `full.${verb === 'leads' ? 'lead' : 'play'}.${seatNames[actor].toLowerCase()}.${cardClip(action.card, after.trump)}` });
    } else if (action.type === 'discard') messages.push({ text: `${seatNames[actor]} discards a card.`, clips: [who, 'event.discards'], whole: `full.discard.${seatNames[actor].toLowerCase()}` });
    else if (action.type === 'pass') messages.push({ text: `${seatNames[actor]} passes.`, clips: [who, 'event.passes'],
      whole: `full.pass.${seatNames[actor].toLowerCase()}`,
      ...(seatNames[actor] === 'Emma' ? { character: { clip: 'whole.emma.passes', text: "Emma passes. Yeah, we'll call that strategy.", family: 'mock-strategy' } } : {}),
    });
    else if (action.type === 'order-up' || action.type === 'call') {
      const suit = action.type === 'order-up' ? after.trump : action.suit;
      messages.push({ text: `${seatNames[actor]} ${action.type === 'order-up' ? 'orders up' : 'calls'} ${suit}${action.alone ? ' and goes alone' : ''}.`,
        clips: [who, `${action.type === 'order-up' ? 'order' : 'call'}.${suit}`, ...(action.alone ? ['event.goes-alone'] : [])],
        whole: `full.${action.type === 'order-up' ? 'order' : 'call'}.${seatNames[actor].toLowerCase()}.${suit}.${action.alone ? 'alone' : 'team'}`,
        ...(seatNames[actor] === 'Val' && action.type === 'call' && suit === 'hearts' && !action.alone
          ? { character: { clip: 'character.val-calls-hearts', text: 'Val calls hearts. Yeah, hearts. I knew that.', family: 'pretend-expertise' } } : {}),
        ...(seatNames[actor] === 'Walt' && action.type === 'call' && suit === 'spades' && action.alone
          ? { character: { clip: 'whole.walt.calls-spades-alone', text: 'Walt calls spades and goes alone. Sure, make it dramatic.', family: 'solo-drama' } } : {}),
      });
    }
  }
  if (before.upCardStatus !== after.upCardStatus) {
    if (after.upCardStatus === 'turned-down') messages.push({ text: 'The up-card is turned down.', clips: ['event.turned-down'], whole: 'event.turned-down' });
    if (after.upCardStatus === 'ordered') messages.push({ text: `${seatNames[after.dealer]} ${after.dealer === 0 ? 'pick' : 'picks'} up.`, clips: [actorClip(seatNames[after.dealer]), `event.${after.dealer === 0 ? 'pick-up' : 'picks-up'}`], whole: `full.pick-up.${seatNames[after.dealer].toLowerCase()}` });
  }
  if (after.completedTricks.length > before.completedTricks.length) {
    const winner = after.completedTricks.at(-1)!.winner;
    messages.push({ text: `${seatNames[winner]} ${winner === 0 ? 'take' : 'takes'} the trick.`, clips: [actorClip(seatNames[winner]), `event.${winner === 0 ? 'take-trick' : 'takes-trick'}`],
      whole: `full.trick.${seatNames[winner].toLowerCase()}`,
      ...(seatNames[winner] === 'Val' ? { character: { clip: 'character.val-takes-trick', text: "Val wins the trick. Totally saw that comin'.", family: 'pretend-expertise' } } : {}),
    });
  }
  // Results are spoken through focus, never duplicated in the live region.
  return messages.map(withVariants);
}
/** Compatibility path for the original screen-reader narrator. */
export function events(before: PlayerView, after: PlayerView, actor: Seat, action: Action, seatNames: SeatNames = names): string[] {
  return narrationEvents(before, after, actor, action, seatNames).map(message => message.text);
}

export function handAnnouncement(v: PlayerView): string {
  return `Up-card: ${cardName(v.upCard).toLowerCase()}.`;
}
/** No hand, legal actions, hidden state, or strategy is read by either review. */
export function currentState(v: PlayerView, seatNames: SeatNames = names): string {
  const parts: string[] = [];
  const ours = v.completedTricks.filter(t => teamOf(t.winner) === 0).length;
  const opponents = v.completedTricks.length - ours;
  const trickTotals = `You and Val have ${ours} ${ours === 1 ? 'trick' : 'tricks'}; opponents have ${opponents}.`;
  if (v.phase === 'bidding') {
    parts.push('Suit not called yet.',
      `Up-card: ${cardName(v.upCard).toLowerCase()}, ${v.upCardStatus}.`,
      `${v.biddingRound === 1 ? 'First' : 'Second'} calling round.`);
    if (v.turn !== null) parts.push(`${seatNames[v.turn]} to act.`);
    parts.push(trickTotals);
  } else {
    parts.push(`Called suit: ${v.trump}.`, `Caller: ${seatNames[v.caller!]}.`);
    if (v.alone) parts.push(`${seatNames[v.caller!]} ${v.caller === 0 ? 'are' : 'is'} going alone.`);
    if (v.sittingOut !== null) parts.push(`${seatNames[v.sittingOut]} ${v.sittingOut === 0 ? 'sit' : 'sits'} out.`);
    if (v.phase === 'discarding') parts.push(`Up-card: ${cardName(v.upCard).toLowerCase()}, ordered.`);
    if (v.phase === 'playing' && v.trick.length) {
      parts.push('Current trick.', ...v.trick.map((p, i) =>
        `${seatNames[p.seat]} ${i === 0 ? 'led' : 'played'} ${cardName(p.card, v.trump).toLowerCase()}.`));
    }
    if (!v.result && v.turn !== null) parts.push(v.phase === 'discarding' ? `${seatNames[v.turn]} must discard.`
      : v.phase === 'playing' && !v.trick.length ? `${seatNames[v.turn]} ${v.turn === 0 ? 'lead' : 'leads'}.` : `${seatNames[v.turn]} to act.`);
    parts.push(trickTotals);
  }
  parts.push(`Hand ${v.handNumber}. Dealer: ${seatNames[v.dealer]}.`);
  if (v.result) parts.push(resultText(v));
  else parts.push(`Score: you and Val ${v.score[0]}, opponents ${v.score[1]}. First to 10.`);
  return parts.join(' ');
}
export function lastTrick(v: PlayerView, seatNames: SeatNames = names): string {
  const trick = v.completedTricks.at(-1);
  if (!trick) return '';
  return ['Last trick.', ...trick.plays.map((p, i) => `${seatNames[p.seat]} ${i === 0 ? 'led' : 'played'} ${cardName(p.card, v.trump).toLowerCase()}.`),
    `${seatNames[trick.winner]} took the trick.`].join(' ');
}
