import type { NarrationAlternative } from './narration-types.ts';
// Twelve complete alternatives approved for this preview; never appended as fragments.
export const narratorVariants: Readonly<Record<string, readonly NarrationAlternative[]>> = {
  "full.pass.val": [
    {
      "clip": "flavor.val-passes-mysteries",
      "text": "Val passes. Fine. Keep your little mysteries.",
      "family": "mock-secrecy"
    }
  ],
  "full.trick.val": [
    {
      "clip": "flavor.val-trick-emotional-support",
      "text": "Val takes the trick. I helped. Emotionally.",
      "family": "undeserved-credit"
    },
    {
      "clip": "flavor.val-trick-piles",
      "text": "Val takes the trick. Yep. That's how piles happen.",
      "family": "obvious-lesson"
    }
  ],
  "full.deal.val": [
    {
      "clip": "flavor.val-deals-attention",
      "text": "Val deals. Good. My attention span just got here.",
      "family": "wandering-attention"
    }
  ],
  "full.trick.you": [
    {
      "clip": "flavor.you-trick-keep-it",
      "text": "You take the trick. Yeah, keep that one. Looks important.",
      "family": "absurd-handling-advice"
    }
  ],
  "event.turned-down": [
    {
      "clip": "flavor.up-card-rejected",
      "text": "The up-card is turned down. Boy. Even the card can't get a yes.",
      "family": "card-rejection"
    }
  ],
  "full.pass.wes": [
    {
      "clip": "flavor.wes-passes-good-talk",
      "text": "Wes passes. Good talk.",
      "family": "abrupt-conversation"
    }
  ],
  "full.trick.eva": [
    {
      "clip": "flavor.eva-trick-fridge",
      "text": "Eva takes the trick. Put that on the fridge.",
      "family": "domestic-celebration"
    }
  ],
  "full.pass.elise": [
    {
      "clip": "flavor.elise-passes-silence",
      "text": "Elise passes. She's lettin' the silence do the work.",
      "family": "mock-strategy"
    }
  ],
  "full.trick.ward": [
    {
      "clip": "flavor.ward-trick-wages",
      "text": "Ward takes the trick. And I'm still on announcer wages.",
      "family": "imaginary-employment"
    }
  ],
  "full.pass.wolf": [
    {
      "clip": "flavor.wolf-passes-spelling",
      "text": "Wolf passes. Finally. A decision I can spell.",
      "family": "limited-vocabulary"
    }
  ],
  "full.trick.etta": [
    {
      "clip": "flavor.etta-trick-theory",
      "text": "Etta takes the trick. Well, there goes my theory.",
      "family": "pretend-expertise"
    }
  ]
};
