import type { NarrationAlternative, NarrationProgress } from './narration-types.ts';

export const FLAVOR_POLICY = {
  recentLines: 8, retainedGames: 8,
  exactHands: 4, exactEvents: 80,
  familyTricks: 4, familyEvents: 12,
  betweenTricks: 2, betweenEvents: 6, perHand: 3,
} as const;
interface Stamp { game: number; completedHands: number; tricks: number; event: number }
/** Public progression and independent randomness; controls and reviews never count. */
export function createNarratorFlavorHistory(random: () => number = Math.random) {
  let game = 0, hand = 0, completedHands = 0, tricks = 0, event = 0;
  let handComplete = false, handFlavorCount = 0, observedEvent = 0, observedTricks = 0;
  let lastFlavor: Stamp | undefined;
  let releaseEvent: number | undefined;
  let releaseJitter = 0;
  const clips = new Map<string, Stamp>(), lines = new Map<string, Stamp>(), families = new Map<string, Stamp>();
  const recent: string[] = [];
  const normalized = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const exactReady = (stamp: Stamp | undefined) => !stamp || (completedHands - stamp.completedHands >= FLAVOR_POLICY.exactHands && event - stamp.event >= FLAVOR_POLICY.exactEvents);
  const familyReady = (stamp: Stamp | undefined) => !stamp || (tricks - stamp.tricks >= FLAVOR_POLICY.familyTricks && event - stamp.event >= FLAVOR_POLICY.familyEvents);
  const chooseIndex = (length: number) => {
    const value=random(); return Number.isFinite(value) ? Math.max(0,Math.min(length-1,Math.floor(value*length))) : 0;
  };
  function openGate() {
    if (lastFlavor && releaseEvent === undefined && tricks-lastFlavor.tricks >= FLAVOR_POLICY.betweenTricks && event-lastFlavor.event >= FLAVOR_POLICY.betweenEvents) releaseEvent=event+releaseJitter;
  }
  function beginHand(number?: number) {
    if (number !== undefined && number === hand) return;
    hand = number ?? hand+1; observedTricks=0; handComplete=false; handFlavorCount=0;
  }
  function endHand() { if (hand && !handComplete) { handComplete=true; completedHands++; } }
  const eligible = (alternative: NarrationAlternative) => handFlavorCount < FLAVOR_POLICY.perHand
    && (!lastFlavor || (releaseEvent !== undefined && event >= releaseEvent))
    && exactReady(clips.get(alternative.clip)) && exactReady(lines.get(normalized(alternative.text)))
    && familyReady(families.get(alternative.family ?? alternative.clip));
  return {
    beginGame() {
      game++; hand=0; observedEvent=0; observedTricks=0; handComplete=false; handFlavorCount=0;
      for (const history of [clips,lines,families]) for (const [key,stamp] of history) if(game-stamp.game>=FLAVOR_POLICY.retainedGames&&exactReady(stamp)&&familyReady(stamp))history.delete(key);
    },
    beginHand, endHand,
    observe(progress: NarrationProgress) {
      if (progress.eventId <= observedEvent) return;
      if (progress.handNumber !== hand) beginHand(progress.handNumber);
      observedEvent=progress.eventId; event++;
      tricks+=Math.max(0,progress.completedTricks-observedTricks); observedTricks=Math.max(observedTricks,progress.completedTricks);
      if(progress.handComplete)endHand();
      openGate();
    },
    // Kept for explicit opening public facts and isolated history tests only.
    nextEvent() { event++; openGate(); },
    eligible,
    select(alternatives: readonly NarrationAlternative[]) {
      const available=alternatives.filter(eligible); if(!available.length)return undefined;
      const priority=Math.max(...available.map(line=>line.priority??1));
      const preferred=available.filter(line=>(line.priority??1)===priority);
      const fresh=preferred.filter(line=>!clips.has(line.clip)&&!lines.has(normalized(line.text)));
      const lessRecent=preferred.filter(line=>!recent.includes(line.clip));
      const pool=fresh.length?fresh:lessRecent.length?lessRecent:preferred;
      return pool[chooseIndex(pool.length)];
    },
    used(alternative: NarrationAlternative) {
      const stamp={game,completedHands,tricks,event};
      clips.set(alternative.clip,stamp);lines.set(normalized(alternative.text),stamp);families.set(alternative.family??alternative.clip,stamp);
      recent.push(alternative.clip);if(recent.length>FLAVOR_POLICY.recentLines)recent.shift();
      handFlavorCount++;lastFlavor=stamp;releaseEvent=undefined;releaseJitter=chooseIndex(4);
    },
  };
}
export type NarratorFlavorHistory = ReturnType<typeof createNarratorFlavorHistory>;
