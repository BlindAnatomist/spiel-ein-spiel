import { OPPONENT_PROFILES } from '../src/bots/profiles.ts';
import type { Card } from '../src/index.ts';
import { cardClip, cardName } from '../web/presentation.ts';

/** The remaining reachable live facts: 1,344 card plays/leads and 89 logistics. */
export function completeEventContract(): Readonly<Record<string, string>> {
  const actors = ['Val', ...Object.values(OPPONENT_PROFILES).flatMap(profile => [profile.westName, profile.eastName])];
  const suits = ['clubs', 'diamonds', 'hearts', 'spades'] as const;
  const cards = suits.flatMap(suit => ['9', '10', 'J', 'Q', 'K', 'A'].map(rank => `${suit}:${rank}` as Card));
  const descriptions = new Map<string, string>();
  for (const card of cards) for (const trump of [null, ...suits]) descriptions.set(cardClip(card, trump), cardName(card, trump).toLowerCase());
  const entries: Record<string, string> = {};
  for (const actor of actors) {
    for (const [action, verb] of [['play', 'plays'], ['lead', 'leads']]) {
      for (const [key, description] of descriptions) entries[`full.${action}.${actor.toLowerCase()}.${key}`] = `${actor} ${verb} ${description}.`;
    }
    entries[`full.discard.${actor.toLowerCase()}`] = `${actor} discards a card.`;
  }
  for (const actor of ['You', ...actors]) {
    entries[`full.deal.${actor.toLowerCase()}`] = `${actor} ${actor === 'You' ? 'deal' : 'deals'}.`;
    entries[`full.pick-up.${actor.toLowerCase()}`] = `${actor} ${actor === 'You' ? 'pick' : 'picks'} up.`;
  }
  for (const card of cards) entries[`full.up-card.${cardClip(card)}`] = `Up-card: ${cardName(card).toLowerCase()}.`;
  return entries;
}
