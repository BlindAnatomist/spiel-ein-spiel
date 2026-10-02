import type { NarrationAlternative } from './narration-types.ts';

export const FLAVOR_POLICY = {
  recentLines: 8, retainedGames: 8,
  exactHands: 12, exactEvents: 160,
  familyHands: 3, familyEvents: 40,
  betweenEvents: 12,
} as const;
interface Stamp { game: number; completedHands: number; event: number }
/** Flavor randomness and memory never consume the game or bot random stream. */
export function createNarratorFlavorHistory(random: () => number = Math.random) {
  let game = 0, hand = 0, completedHands = 0, event = 0;
  let handComplete = false, handHadFlavor = false, plainHandsSinceFlavor = 0;
  let lastFlavor = { hand: -Infinity, event: -Infinity };
  const clips = new Map<string, Stamp>();
  const lines = new Map<string, Stamp>();
  const families = new Map<string, Stamp>();
  const gameFamilies = new Set<string>();
  const recent: string[] = [];
  const normalized = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const oldEnough = (stamp: Stamp | undefined, hands: number, events: number) => !stamp
    || (completedHands - stamp.completedHands >= hands && event - stamp.event >= events);
  const eligible = (alternative: NarrationAlternative) => {
    const family = alternative.family ?? alternative.clip;
    if (gameFamilies.has(family)) return false;
    if (Number.isFinite(lastFlavor.hand) && (hand === lastFlavor.hand || plainHandsSinceFlavor < 1)) return false;
    if (event - lastFlavor.event < FLAVOR_POLICY.betweenEvents) return false;
    if (!oldEnough(clips.get(alternative.clip), FLAVOR_POLICY.exactHands, FLAVOR_POLICY.exactEvents)
      || !oldEnough(lines.get(normalized(alternative.text)), FLAVOR_POLICY.exactHands, FLAVOR_POLICY.exactEvents)) return false;
    return oldEnough(families.get(family), FLAVOR_POLICY.familyHands, FLAVOR_POLICY.familyEvents);
  };
  return {
    beginGame() {
      game++; gameFamilies.clear();
      for (const history of [clips, lines, families]) for (const [key, stamp] of history) {
        if (game - stamp.game >= FLAVOR_POLICY.retainedGames && oldEnough(stamp, FLAVOR_POLICY.exactHands, FLAVOR_POLICY.exactEvents)) history.delete(key);
      }
    },
    beginHand() { hand++; handComplete = false; handHadFlavor = false; },
    endHand() {
      if (!hand || handComplete) return;
      handComplete = true; completedHands++;
      if (!handHadFlavor) plainHandsSinceFlavor++;
    },
    nextEvent() { event++; },
    eligible,
    select(alternatives: readonly NarrationAlternative[]) {
      const available = alternatives.filter(eligible);
      if (!available.length) return undefined;
      // Fresh lines first; the bounded recent list is a preference, never a permanent veto.
      const fresh = available.filter(line => !clips.has(line.clip) && !lines.has(normalized(line.text)));
      const lessRecent = available.filter(line => !recent.includes(line.clip));
      const pool = fresh.length ? fresh : lessRecent.length ? lessRecent : available;
      const value = random();
      const index = Number.isFinite(value) ? Math.max(0, Math.min(pool.length - 1, Math.floor(value * pool.length))) : 0;
      return pool[index];
    },
    used(alternative: NarrationAlternative) {
      // Attempted lines count even if stopped midway, avoiding an immediate repeated joke.
      const stamp = { game, completedHands, event };
      clips.set(alternative.clip, stamp); lines.set(normalized(alternative.text), stamp);
      const family = alternative.family ?? alternative.clip;
      families.set(family, stamp); gameFamilies.add(family);
      recent.push(alternative.clip); if (recent.length > FLAVOR_POLICY.recentLines) recent.shift();
      handHadFlavor = true; plainHandsSinceFlavor = 0; lastFlavor = { hand, event };
    },
  };
}
export type NarratorFlavorHistory = ReturnType<typeof createNarratorFlavorHistory>;
