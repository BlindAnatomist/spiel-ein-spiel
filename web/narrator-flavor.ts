import type { NarrationAlternative } from './narration-types.ts';

/** Page-session history is shared by successive games and narrator instances. */
export function createNarratorFlavorHistory() {
  let hand = 0;
  let event = 0;
  let lastFlavor = { hand: -Infinity, event: -Infinity };
  const clips = new Set<string>();
  const lines = new Set<string>();
  const families = new Map<string, { hand: number; event: number }>();
  const gameFamilies = new Set<string>();
  const normalized = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  return {
    beginGame() { gameFamilies.clear(); },
    beginHand() { hand++; },
    nextEvent() { event++; },
    eligible(alternative: NarrationAlternative) {
      if (clips.has(alternative.clip) || lines.has(normalized(alternative.text))) return false;
      if (gameFamilies.has(alternative.family ?? alternative.clip)) return false;
      // A quiet hand between flavor lines; routine calls still retain their performance.
      if (hand - lastFlavor.hand < 2 || event - lastFlavor.event < 12) return false;
      const family = families.get(alternative.family ?? alternative.clip);
      return !family || (hand - family.hand >= 3 && event - family.event >= 40);
    },
    used(alternative: NarrationAlternative) {
      // Reserve on attempted playback: interrupted or failed lines must not loop later.
      clips.add(alternative.clip);
      lines.add(normalized(alternative.text));
      lastFlavor = { hand, event };
      families.set(alternative.family ?? alternative.clip, lastFlavor);
      gameFamilies.add(alternative.family ?? alternative.clip);
    },
  };
}
export type NarratorFlavorHistory = ReturnType<typeof createNarratorFlavorHistory>;
