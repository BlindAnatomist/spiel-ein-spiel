import { OPPONENT_PROFILES } from '../src/bots/profiles.ts';

/** Stage one is finite: 21 named bots × 18 public facts, plus the human trick win. */
export function wholeEventContract(): Readonly<Record<string, string>> {
  const actors = ['Val', ...Object.values(OPPONENT_PROFILES).flatMap(profile => [profile.westName, profile.eastName])];
  const entries: Record<string, string> = { 'full.trick.you': 'You take the trick.' };
  for (const actor of actors) {
    const key = actor.toLowerCase();
    entries[`full.pass.${key}`] = `${actor} passes.`;
    entries[`full.trick.${key}`] = `${actor} takes the trick.`;
    for (const suit of ['clubs', 'diamonds', 'hearts', 'spades']) {
      for (const alone of [false, true]) {
        const mode = alone ? 'alone' : 'team';
        const suffix = alone ? ' and goes alone' : '';
        entries[`full.order.${key}.${suit}.${mode}`] = `${actor} orders up ${suit}${suffix}.`;
        entries[`full.call.${key}.${suit}.${mode}`] = `${actor} calls ${suit}${suffix}.`;
      }
    }
  }
  return entries;
}
export const acceptedAlternatives: Readonly<Record<string, string>> = {
  'whole.emma.passes': "Emma passes. Yeah, we'll call that strategy.",
  'whole.walt.calls-spades-alone': 'Walt calls spades and goes alone. Sure, make it dramatic.',
};
