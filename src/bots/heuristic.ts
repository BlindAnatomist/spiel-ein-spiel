import { effectiveSuit, partnerOf, rankOf, suitOf, teamOf } from '../cards.ts';
import { strength, trickWinner } from '../rules.ts';
import type { Action, Card, PlayerView } from '../types.ts';
import type { Strategy } from './config.ts';
import { afterSeats, handValue, isMaster, keepValue, makers, partnerWinning, SEATS, trumpCount, unseenCards } from './evaluate.ts';
/** Stable ties use legal-action order supplied by the engine. */
export function bestBy<T>(values: readonly T[], score: (value: T) => number): T {
  if (!values.length) throw new Error('No legal decision');
  let best: T = values[0]!; let value = score(best);
  for (const candidate of values.slice(1)) {
    const next = score(candidate);
    if (next > value) { best = candidate; value = next; }
  }
  return best;
}
export function discardScore(hand: readonly Card[], card: Card, trump: NonNullable<PlayerView['trump']>, config: Strategy): number {
  if (config.level === 'casual') return -keepValue(card, trump);
  const remaining = hand.filter(c => c !== card);
  return handValue(remaining, trump, config) - keepValue(card, trump) * 0.005;
}
export function bidding(view: PlayerView, config: Strategy): Action {
  const pass = view.legalActions.find(a => a.type === 'pass');
  const bids = view.legalActions.filter(a => a.type === 'call' || a.type === 'order-up');
  const candidates = bids.filter(a => !a.alone);
  function assessment(action: (typeof candidates)[number]) {
    const trump = action.type === 'call' ? action.suit : suitOf(view.upCard);
    let hand = [...view.hand];
    if (action.type === 'order-up' && view.seat === view.dealer) {
      hand.push(view.upCard);
      const discard = bestBy(hand, card => discardScore(hand, card, trump, config));
      hand = hand.filter(c => c !== discard);
    }
    let value = handValue(hand, trump, config);
    if (action.type === 'order-up' && view.dealer !== view.seat) {
      value += view.dealer === partnerOf(view.seat) ? config.partnerDealerBonus : -config.opponentDealerPenalty;
    }
    return { trump, hand, value };
  }
  const chosen = bestBy(candidates, action => assessment(action).value);
  const { hand, trump, value } = assessment(chosen);
  const threshold = chosen.type === 'order-up' ? config.orderThreshold : config.callThreshold;
  // Near match point avoid passing a sound call to opponents on nine.
  const pressure = config.level !== 'casual' && view.score[1 - teamOf(view.seat)] === 9 ? 0.1 : 0;
  if (pass && value < threshold - pressure) return pass;
  // At 9, an ordinary made hand already wins; don't shed partner for extra points.
  const alone = handValue(hand, trump, config) >= config.aloneThreshold && trumpCount(hand, trump) >= 3
    && (config.level === 'casual' || view.score[teamOf(view.seat)] < 9);
  return bids.find(a => a.type === chosen.type && a.alone === alone && (a.type !== 'call' || (chosen.type === 'call' && a.suit === chosen.suit))) ?? chosen;
}
export function heuristicPlay(view: PlayerView, config: Strategy): Action {
  const actions = view.legalActions.filter((a): a is Extract<Action, { card: Card }> => a.type === 'play');
  const trump = view.trump!;
  const low = () => bestBy(actions, a => -keepValue(a.card, trump));
  if (config.level === 'casual') {
    if (!view.trick.length) return bestBy(actions, a => strength(a.card, trump));
    if (partnerWinning(view)) return low();
    const winning = actions.filter(a => trickWinner([...view.trick, { seat: view.seat, card: a.card }], trump) === view.seat);
    return winning.length ? bestBy(winning, a => keepValue(a.card, trump)) : low();
  }
  const opponents = SEATS.filter(s => teamOf(s) !== teamOf(view.seat) && s !== view.sittingOut);
  const unseen = unseenCards(view);
  const ownTrump = trumpCount(view.hand, trump);
  const remainingTrump = unseen.filter(c => effectiveSuit(c, trump) === trump).length;
  const partner = partnerOf(view.seat);
  const partnerLead = [...view.completedTricks].reverse().find(t => t.plays[0]?.seat === partner && t.winner === partner)?.plays[0]?.card;
  if (!view.trick.length) {
    return bestBy(actions, a => {
      const suit = effectiveSuit(a.card, trump);
      const master = isMaster(a.card, view);
      const opponentVoid = opponents.filter(s => view.knownVoids[s]!.includes(suit) && !view.knownVoids[s]!.includes(trump)).length;
      let score = strength(a.card, trump) * 0.06;
      if (suit === trump) {
        score += master ? 2.4 : 0;
        if (makers(view) && remainingTrump > 0 && (ownTrump >= 2 || view.caller === partner)) score += config.trumpLead;
        if (!makers(view) && !master) score -= 1.0;
        if (remainingTrump === 0) score -= 1;
      } else {
        score += master ? 2.1 : rankOf(a.card) === 'A' ? 1.8 : 0;
        score -= opponentVoid * config.voidWeight;
        if (view.knownVoids[partner]!.includes(suit) && !view.knownVoids[partner]!.includes(trump) && partner !== view.sittingOut) score += config.voidWeight * 0.6;
        if (partnerLead && effectiveSuit(partnerLead, trump) === suit) score += config.partnerReturn;
        if (!master) score += (5 - view.hand.filter(c => effectiveSuit(c, trump) === suit).length) * 0.08;
      }
      return score;
    });
  }
  const winner = trickWinner(view.trick, trump);
  const futureOpponents = afterSeats(view).filter(s => teamOf(s) !== teamOf(view.seat));
  const winning = actions.filter(a => trickWinner([...view.trick, { seat: view.seat, card: a.card }], trump) === view.seat);
  if (winner === partner) {
    // Keep partner's winner unless a remaining opponent can plausibly overtake it
    // and our master offers meaningful protection.
    if (!futureOpponents.length) return low();
    const card = view.trick.find(p => p.seat === winner)!.card;
    if (isMaster(card, view)) return low();
    const protective = winning.filter(a => isMaster(a.card, view) && effectiveSuit(a.card, trump) === effectiveSuit(card, trump));
    if (protective.length) return bestBy(protective, a => -keepValue(a.card, trump));
    return low();
  }
  if (!winning.length) return low();
  return bestBy(winning, a => {
    // Last hand wins cheaply; earlier positions balance remaining threats and cost.
    const suit = effectiveSuit(a.card, trump);
    const higher = unseen.filter(c => effectiveSuit(c, trump) === suit && strength(c, trump) > strength(a.card, trump)).length;
    const threat = futureOpponents.filter(s => !view.knownVoids[s]!.includes(suit)).length;
    return -(higher * threat * 0.35) - keepValue(a.card, trump) * config.conservation;
  });
}
