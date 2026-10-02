import type { NarrationAlternative } from './narration-types.ts';
/** Complete public-context alternatives; triggers never inspect unplayed cards. */
export const extraReactionLines: Readonly<Record<string, NarrationAlternative & { readonly trigger: string }>> = {
  "reaction.you.trump.slouch": {
    "clip": "reaction.you.trump.slouch",
    "text": "Ooh, now I'm sittin' up. This is terrible for my slouch.",
    "family": "posture-alert",
    "context": "you",
    "priority": 1,
    "trigger": "reaction.you.trump"
  },
  "reaction.val.follow-suit.soap-opera": {
    "clip": "reaction.val.follow-suit.soap-opera",
    "text": "Hey, I can follow that. My soap opera lost me three marriages ago.",
    "family": "soap-opera-confusion",
    "context": "val",
    "priority": 1,
    "trigger": "reaction.val.follow-suit"
  },
  "reaction.you.follow-suit.decorating": {
    "clip": "reaction.you.follow-suit.decorating",
    "text": "A matching set. That's practically interior decorating.",
    "family": "matching-decor",
    "context": "you",
    "priority": 1,
    "trigger": "reaction.you.follow-suit"
  },
  "reaction.you.follow-suit.parking": {
    "clip": "reaction.you.follow-suit.parking",
    "text": "Heh, obeyin' the rules. I should try that in a parking lot.",
    "family": "accidental-adult",
    "context": "you",
    "priority": 1,
    "trigger": "reaction.you.follow-suit"
  },
  "reaction.you.trick.celebratin-muscle": {
    "clip": "reaction.you.trick.celebratin-muscle",
    "text": "Aw, hell yeah! I just pulled my celebratin' muscle.",
    "family": "physical-celebration",
    "context": "you",
    "priority": 2,
    "trigger": "reaction.you.trick"
  },
  "reaction.opponent.ace-lead.tuxedo": {
    "clip": "reaction.opponent.ace-lead.tuxedo",
    "text": "Well, look who showed up in a rented tuxedo.",
    "family": "main-character",
    "context": "opponent",
    "priority": 1,
    "trigger": "reaction.opponent.ace-lead"
  },
  "reaction.opponent.right-bower.bouncer": {
    "clip": "reaction.opponent.right-bower.bouncer",
    "text": "Aw, crap. Somebody hired a bouncer for card night.",
    "family": "card-bouncer",
    "context": "opponent",
    "priority": 2,
    "trigger": "reaction.opponent.right-bower"
  },
  "reaction.opponent.trick.table-drink": {
    "clip": "reaction.opponent.trick.table-drink",
    "text": "Ugh. I'd flip the table, but my drink's on it.",
    "family": "cope-with-loss",
    "context": "opponent",
    "priority": 2,
    "trigger": "reaction.opponent.trick"
  },
  "reaction.opponent.trick.stupid-hands": {
    "clip": "reaction.opponent.trick.stupid-hands",
    "text": "Great. Now I gotta clap with my stupid hands.",
    "family": "reluctant-applause",
    "context": "opponent",
    "priority": 2,
    "trigger": "reaction.opponent.trick"
  },
  "reaction.val.trick.dental-benefits": {
    "clip": "reaction.val.trick.dental-benefits",
    "text": "Ooh, a partner benefit! I wonder if dental's included.",
    "family": "partner-credit",
    "context": "val",
    "priority": 2,
    "trigger": "reaction.val.trick"
  },
  "reaction.table.four-tricks.attention-span": {
    "clip": "reaction.table.four-tricks.attention-span",
    "text": "Okay, home stretch. Even my short attention span made it.",
    "family": "wandering-attention",
    "context": "table",
    "priority": 2,
    "trigger": "reaction.table.four-tricks"
  },
  "reaction.you-team-sweep.badass": {
    "clip": "reaction.you-team-sweep.badass",
    "text": "That was frickin’ badass!",
    "family": "sweep-celebration",
    "context": "table",
    "priority": 3,
    "trigger": "you-team-sweep"
  }
};
