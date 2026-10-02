import { effectiveSuit, rankOf, suitOf } from '../src/index.ts';
import type { Action, PlayerView, Seat } from '../src/index.ts';

/** Release contract. A partial approved library may be tested but never published. */
export const CHARACTER_LIBRARY_TARGET = 168;
export const ORIGINAL_NARRATOR_COUNT = 1965;
export const reactionTriggerMetadata = {
  'reaction.you.follow-suit': { context: 'you', priority: 1 },
  'reaction.you.bower': { context: 'you', priority: 2 },
  'reaction.you.trump': { context: 'you', priority: 1 },
  'reaction.you.trick': { context: 'you', priority: 2 },
  'reaction.you.alone': { context: 'you', priority: 2 },
  'reaction.you.low-lead': { context: 'you', priority: 1 },
  'reaction.you.queen': { context: 'you', priority: 1 },
  'reaction.you.ace-lead': { context: 'you', priority: 1 },
  'reaction.val.follow-suit': { context: 'val', priority: 1 },
  'reaction.val.trick': { context: 'val', priority: 2 },
  'reaction.val.trump': { context: 'val', priority: 1 },
  'reaction.val.bower': { context: 'val', priority: 2 },
  'reaction.val.alone': { context: 'val', priority: 2 },
  'reaction.opponent.follow-suit': { context: 'opponent', priority: 1 },
  'reaction.opponent.low-lead': { context: 'opponent', priority: 1 },
  'reaction.opponent.ace-lead': { context: 'opponent', priority: 1 },
  'reaction.opponent.right-bower': { context: 'opponent', priority: 2 },
  'reaction.opponent.trick': { context: 'opponent', priority: 2 },
  'reaction.opponent.alone': { context: 'opponent', priority: 2 },
  'reaction.table.four-tricks': { context: 'table', priority: 2 },
  'reaction.table.left-bower': { context: 'table', priority: 2 },
  'reaction.table.turned-down': { context: 'table', priority: 1 },
  'you-team-sweep': { context: 'table', priority: 3 },
  'reaction.you-team.euchred': { context: 'table', priority: 3 },
  'reaction.you-team.euchres-opponents': { context: 'table', priority: 3 },
  'reaction.you-team.game-win': { context: 'table', priority: 3, eventPreference: 'game-result' },
  'reaction.opponent.game-win': { context: 'opponent', priority: 3, eventPreference: 'game-result' },
} as const;
export type ReactionTrigger = keyof typeof reactionTriggerMetadata;

/** Called only after the referee accepts an action. Never reads hand/legalActions. */
export function publicReactionTriggers(before: PlayerView, after: PlayerView, actor: Seat, action: Action): ReactionTrigger[] {
  const keys: ReactionTrigger[] = [];
  if (action.type === 'play') {
    const trump = after.trump;
    const suit = trump ? effectiveSuit(action.card, trump) : suitOf(action.card);
    const rank = rankOf(action.card), leads = before.trick.length === 0;
    const bower = !!trump && suit === trump && rank === 'J';
    const followsNonTrump = !leads && suit !== trump
      && suit === (trump ? effectiveSuit(before.trick[0]!.card, trump) : suitOf(before.trick[0]!.card));
    if (actor === 0) {
      if (trump && suit === trump) keys.push(bower ? 'reaction.you.bower' : 'reaction.you.trump');
      else if (leads && (rank === '9' || rank === '10')) keys.push('reaction.you.low-lead');
      else if (followsNonTrump) keys.push('reaction.you.follow-suit');
      if (rank === 'Q') keys.push('reaction.you.queen');
      if (leads && rank === 'A') keys.push('reaction.you.ace-lead');
    } else if (actor === 2) {
      if (trump && suit === trump) keys.push(bower ? 'reaction.val.bower' : 'reaction.val.trump');
      else if (followsNonTrump) keys.push('reaction.val.follow-suit');
    } else {
      if (bower && suitOf(action.card) === trump) keys.push('reaction.opponent.right-bower');
      else if (leads && rank === 'A') keys.push('reaction.opponent.ace-lead');
      else if (leads && suit !== trump && (rank === '9' || rank === '10')) keys.push('reaction.opponent.low-lead');
      if (followsNonTrump) keys.push('reaction.opponent.follow-suit');
    }
    if (bower && suitOf(action.card) !== trump) keys.push('reaction.table.left-bower');
  } else if ((action.type === 'call' || action.type === 'order-up') && action.alone) {
    if (actor === 0) keys.push('reaction.you.alone');
    else if (actor === 2) keys.push('reaction.val.alone');
    else if (actor === 1 || actor === 3) keys.push('reaction.opponent.alone');
  } else if (action.type === 'pass' && before.phase === 'bidding' && after.phase === 'bidding'
    && before.handNumber === after.handNumber
    && before.biddingRound === 1 && after.biddingRound === 2
    && before.upCardStatus === 'face-up' && after.upCardStatus === 'turned-down'
    && before.bids.length === 3 && after.bids.length === 4
    && after.bids.every(bid => bid.round === 1 && bid.action.type === 'pass')
    && new Set(after.bids.map(bid => bid.seat)).size === 4 && after.bids.at(-1)?.seat === actor) {
    keys.push('reaction.table.turned-down');
  }
  if (after.completedTricks.length > before.completedTricks.length) {
    const winner = after.completedTricks.at(-1)!.winner;
    keys.push(winner === 0 ? 'reaction.you.trick' : winner === 2 ? 'reaction.val.trick' : 'reaction.opponent.trick');
    if (after.completedTricks.length === 4 && after.phase === 'playing') keys.push('reaction.table.four-tricks');
    if (!before.result && after.result?.team === 0 && ['march', 'loner-march'].includes(after.result.reason)
      && after.completedTricks.length === 5 && after.completedTricks.every(trick => trick.winner % 2 === 0)) keys.push('you-team-sweep');
  }
  if (!before.result && after.result && after.completedTricks.length === 5
    && (after.phase === 'hand-over' || after.phase === 'game-over')) {
    if (after.result.reason === 'euchred' && after.caller !== null) {
      if (after.result.team === 1 && after.caller % 2 === 0) keys.push('reaction.you-team.euchred');
      if (after.result.team === 0 && after.caller % 2 === 1) keys.push('reaction.you-team.euchres-opponents');
    }
    if (before.winner === null && after.phase === 'game-over') {
      if (after.winner === 0) keys.push('reaction.you-team.game-win');
      if (after.winner === 1) keys.push('reaction.opponent.game-win');
    }
  }
  return keys;
}
