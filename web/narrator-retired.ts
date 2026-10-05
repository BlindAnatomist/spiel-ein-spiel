/** Owner-approved rotation cuts. Keep catalog/audio identities for existing reports. */
export const retiredNarratorClips = [
  'flavor.val-trick-piles',
  'flavor.ward-trick-wages',
  'reaction.you.follow-suit.brians-podcast',
  'flavor.etta-trick-theory',
  'flavor.you-trick-keep-it',
  'flavor.elise-passes-silence',
  'reaction.opponent.low-lead',
  'flavor.wolf-passes-spelling',
  'reaction.val.follow-suit.finish-it',
  'reaction.table.four-tricks.like-you',
] as const;

const retired = new Set<string>(retiredNarratorClips);
export const isRetiredNarratorClip = (clip: string): boolean => retired.has(clip);
