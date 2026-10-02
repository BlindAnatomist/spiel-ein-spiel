import { extraReactionLines } from './narrator-extra-reactions.ts';
import { publicReactionTriggers } from './narrator-reaction-triggers.ts';
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
  const keys = publicReactionTriggers(before, after, actor, action);
  const alternatives = alternativesFor(keys);
  return alternatives.length ? {text:'', clips:[], optional:true, alternatives} : undefined;
}
