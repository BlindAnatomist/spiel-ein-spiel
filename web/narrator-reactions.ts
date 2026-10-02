import { extraReactionLines } from './narrator-extra-reactions.ts';
import { effectiveSuit, rankOf, suitOf } from '../src/index.ts';
import type { Action, PlayerView, Seat } from '../src/index.ts';
import type { NarrationAlternative, NarrationMessage } from './narration-types.ts';
export const baseReactionLines: Readonly<Record<string, NarrationAlternative>> = {
  "reaction.you.bower": {
    "clip": "reaction.you.bower",
    "text": "Heh, the fancy jack. The one rule I keep pretending I remembered.",
    "family": "pretend-expertise",
    "context": "you",
    "priority": 2
  },
  "reaction.you.trump": {
    "clip": "reaction.you.trump",
    "text": "Ooh, somebody put on their serious pants.",
    "family": "serious-pants",
    "context": "you",
    "priority": 1
  },
  "reaction.you.low-lead": {
    "clip": "reaction.you.low-lead",
    "text": "Starting small. That's how I approach exercise and responsibility.",
    "family": "small-start",
    "context": "you",
    "priority": 1
  },
  "reaction.you.follow-suit": {
    "clip": "reaction.you.follow-suit",
    "text": "Following suit. Look at us, obeying rules like grown-ups.",
    "family": "accidental-adult",
    "context": "you",
    "priority": 1
  },
  "reaction.you.trick": {
    "clip": "reaction.you.trick",
    "text": "There we go. I did absolutely nothing, and I'm still taking credit.",
    "family": "undeserved-credit",
    "context": "you",
    "priority": 2
  },
  "reaction.you.alone": {
    "clip": "reaction.you.alone",
    "text": "Just you, huh? That's how I assemble furniture, and nobody likes the result.",
    "family": "solo-drama",
    "context": "you",
    "priority": 2
  },
  "reaction.opponent.low-lead": {
    "clip": "reaction.opponent.low-lead",
    "text": "Oh, a little one. Budget cuts hit the cards, too.",
    "family": "card-budget",
    "context": "opponent",
    "priority": 1
  },
  "reaction.opponent.ace-lead": {
    "clip": "reaction.opponent.ace-lead",
    "text": "Well, somebody woke up feeling important.",
    "family": "main-character",
    "context": "opponent",
    "priority": 1
  },
  "reaction.opponent.right-bower": {
    "clip": "reaction.opponent.right-bower",
    "text": "Oh, they brought the big jack. I brought a beverage.",
    "family": "unprepared",
    "context": "opponent",
    "priority": 2
  },
  "reaction.opponent.trick": {
    "clip": "reaction.opponent.trick",
    "text": "Fine, they can have that one. I'm calling it a character-building experience.",
    "family": "cope-with-loss",
    "context": "opponent",
    "priority": 2
  },
  "reaction.val.trick": {
    "clip": "reaction.val.trick",
    "text": "That's my partner. By which I mean your partner. I'm mostly here for the snacks.",
    "family": "partner-credit",
    "context": "val",
    "priority": 2
  },
  "reaction.table.four-tricks": {
    "clip": "reaction.table.four-tricks",
    "text": "One more trick. Finally, some math I can handle.",
    "family": "math-confidence",
    "context": "table",
    "priority": 2
  }
};

export const reactionLines = { ...baseReactionLines, ...extraReactionLines };
function alternativesFor(keys: readonly string[]): NarrationAlternative[] {
  return keys.flatMap(key => [
    ...(baseReactionLines[key] ? [baseReactionLines[key]!] : []),
    ...Object.values(extraReactionLines).filter(line => line.trigger === key),
  ]);
}

/** Classifies only the actual public action and public trick outcome. */
export function reactionFor(before: PlayerView, after: PlayerView, actor: Seat, action: Action): NarrationMessage | undefined {
  const keys: string[] = [];
  if (action.type === 'play') {
    const trump = after.trump;
    const suit = trump ? effectiveSuit(action.card, trump) : suitOf(action.card);
    const rank = rankOf(action.card);
    const leads = before.trick.length === 0;
    if (actor === 0) {
      if (trump && suit === trump) keys.push(rank === 'J' ? 'reaction.you.bower' : 'reaction.you.trump');
      else if (leads && (rank === '9' || rank === '10')) keys.push('reaction.you.low-lead');
      else if (!leads && suit === (trump ? effectiveSuit(before.trick[0]!.card, trump) : suitOf(before.trick[0]!.card))) keys.push('reaction.you.follow-suit');
    } else if (actor === 2 && !leads && suit !== trump && suit === (trump ? effectiveSuit(before.trick[0]!.card, trump) : suitOf(before.trick[0]!.card))) {
      keys.push('reaction.val.follow-suit');
    } else if (actor === 1 || actor === 3) {
      if (trump && rank === 'J' && suitOf(action.card) === trump) keys.push('reaction.opponent.right-bower');
      else if (leads && rank === 'A') keys.push('reaction.opponent.ace-lead');
      else if (leads && suit !== trump && (rank === '9' || rank === '10')) keys.push('reaction.opponent.low-lead');
    }
  } else if (actor === 0 && (action.type === 'call' || action.type === 'order-up') && action.alone) keys.push('reaction.you.alone');
  if (after.completedTricks.length > before.completedTricks.length) {
    const winner = after.completedTricks.at(-1)!.winner;
    keys.push(winner === 0 ? 'reaction.you.trick' : winner === 2 ? 'reaction.val.trick' : 'reaction.opponent.trick');
    if (after.completedTricks.length === 4 && after.phase === 'playing') keys.push('reaction.table.four-tricks');
    if (!before.result && after.result?.team === 0 && ['march','loner-march'].includes(after.result.reason)
      && after.completedTricks.length === 5 && after.completedTricks.every(trick => trick.winner % 2 === 0)) keys.push('you-team-sweep');
  }
  return keys.length ? {text:'', clips:[], optional:true, alternatives:alternativesFor(keys)} : undefined;
}
