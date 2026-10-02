import type { NarrationAlternative, NarrationProgress } from './narration-types.ts';
import { HISTORY_LIMIT, loadNarratorHistory, saveNarratorHistory, type NarratorHistoryStorage, type NarratorStamp } from './narrator-history-storage.ts';

export const FLAVOR_POLICY = {
  recentLines: 8, retainedGames: 8,
  exactHands: 4, exactEvents: 80, priorCompletedGames: 2,
  familyTricks: 4, familyEvents: 12,
  betweenTricks: 1, betweenEvents: 6, perHand: 4, releaseJitterEvents: 1,
} as const;
/** Public progression and independent randomness; controls and reviews never count. */
export function createNarratorFlavorHistory(random: () => number = Math.random, storage?: NarratorHistoryStorage) {
  const saved = loadNarratorHistory(storage);
  let game = saved?.game ?? 0, hand = 0, completedGames = saved?.completedGames ?? 0;
  let completedHands = saved?.completedHands ?? 0, tricks = saved?.tricks ?? 0, event = saved?.event ?? 0;
  let gameOrdinal = completedGames+1, gameComplete = false;
  let handComplete = false, handFlavorCount = 0, observedEvent = 0, observedTricks = 0;
  let lastFlavor = saved?.lastFlavor ?? undefined;
  let releaseEvent = saved?.releaseEvent ?? undefined;
  let releaseJitter = saved?.releaseJitter ?? 0;
  const clips = new Map<string, NarratorStamp>(saved?.clips), lines = new Map<string, NarratorStamp>(saved?.lines), families = new Map<string, NarratorStamp>(saved?.families);
  const seenClips = new Set(saved?.seenClips), seenLines = new Set(saved?.seenLines);
  const recent: string[] = saved?.recent ?? [];
  const normalized = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const exactReady = (stamp: NarratorStamp | undefined) => !stamp || (stamp.game !== game
    && gameOrdinal-stamp.gameOrdinal > FLAVOR_POLICY.priorCompletedGames
    && completedHands-stamp.completedHands >= FLAVOR_POLICY.exactHands && event-stamp.event >= FLAVOR_POLICY.exactEvents);
  const familyReady = (stamp: NarratorStamp | undefined) => !stamp || (tricks-stamp.tricks >= FLAVOR_POLICY.familyTricks && event-stamp.event >= FLAVOR_POLICY.familyEvents);
  const chooseIndex = (length: number) => {
    const value=random(); return Number.isFinite(value) ? Math.max(0,Math.min(length-1,Math.floor(value*length))) : 0;
  };
  function persist() {
    saveNarratorHistory(storage, {version:1,game,completedGames,completedHands,tricks,event,
      clips:[...clips],lines:[...lines],families:[...families],seenClips:[...seenClips],seenLines:[...seenLines],recent:[...recent],
      lastFlavor:lastFlavor??null,releaseEvent:releaseEvent??null,releaseJitter});
  }
  function bound<K,V>(map: Map<K,V>) { while(map.size>HISTORY_LIMIT)map.delete(map.keys().next().value!); }
  function remember(set: Set<string>, key: string) { set.add(key);while(set.size>HISTORY_LIMIT)set.delete(set.values().next().value!); }
  function openGate() {
    if (lastFlavor && releaseEvent === undefined && tricks-lastFlavor.tricks >= FLAVOR_POLICY.betweenTricks && event-lastFlavor.event >= FLAVOR_POLICY.betweenEvents) releaseEvent=event+releaseJitter;
  }
  function beginHand(number?: number) {
    if (number !== undefined && number === hand) return;
    hand = number ?? hand+1; observedTricks=0; handComplete=false; handFlavorCount=0;
  }
  function endHand() { if (hand && !handComplete) { handComplete=true; completedHands++; persist(); } }
  const eligible = (alternative: NarrationAlternative) => handFlavorCount < FLAVOR_POLICY.perHand
    && (!lastFlavor || (releaseEvent !== undefined && event >= releaseEvent))
    && exactReady(clips.get(alternative.clip)) && exactReady(lines.get(normalized(alternative.text)))
    && familyReady(families.get(alternative.family ?? alternative.clip));
  return {
    beginGame() {
      game++; gameOrdinal=completedGames+1; gameComplete=false; hand=0; observedEvent=0; observedTricks=0; handComplete=false; handFlavorCount=0;
      for (const history of [clips,lines,families]) for (const [key,stamp] of history) if(game-stamp.game>=FLAVOR_POLICY.retainedGames&&exactReady(stamp)&&familyReady(stamp))history.delete(key);
      persist();
    },
    beginHand, endHand,
    observe(progress: NarrationProgress) {
      if (progress.eventId <= observedEvent) return;
      if (progress.handNumber !== hand) beginHand(progress.handNumber);
      observedEvent=progress.eventId; event++;
      tricks+=Math.max(0,progress.completedTricks-observedTricks); observedTricks=Math.max(observedTricks,progress.completedTricks);
      if(progress.handComplete)endHand();
      if(progress.gameComplete && progress.handComplete && progress.completedTricks===5 && !gameComplete) { completedGames++; gameComplete=true; persist(); }
      openGate();
    },
    // Kept for explicit opening public facts and isolated history tests only.
    nextEvent() { event++; openGate(); },
    eligible,
    select(alternatives: readonly NarrationAlternative[]) {
      const available=alternatives.filter(eligible); if(!available.length)return undefined;
      const finalResults=available.filter(line=>line.eventPreference==='game-result');
      const eventPool=finalResults.length?finalResults:available;
      const fresh=eventPool.filter(line=>!seenClips.has(line.clip)&&!seenLines.has(normalized(line.text)));
      const candidates=fresh.length?fresh:eventPool;
      const priority=Math.max(...candidates.map(line=>line.priority??1));
      const preferred=candidates.filter(line=>(line.priority??1)===priority);
      const lessRecent=preferred.filter(line=>!recent.includes(line.clip));
      const pool=lessRecent.length?lessRecent:preferred;
      const oldest=Math.min(...pool.map(line=>Math.max(clips.get(line.clip)?.event??-1,lines.get(normalized(line.text))?.event??-1)));
      const leastHeard=pool.filter(line=>Math.max(clips.get(line.clip)?.event??-1,lines.get(normalized(line.text))?.event??-1)===oldest);
      return leastHeard[chooseIndex(leastHeard.length)];
    },
    used(alternative: NarrationAlternative) {
      const stamp={game,gameOrdinal,completedHands,tricks,event};
      const text=normalized(alternative.text),family=alternative.family??alternative.clip;
      for(const [history,key] of [[clips,alternative.clip],[lines,text],[families,family]] as const) { history.delete(key);history.set(key,stamp);bound(history); }
      remember(seenClips,alternative.clip);remember(seenLines,text);
      const prior=recent.indexOf(alternative.clip);if(prior>=0)recent.splice(prior,1);
      recent.push(alternative.clip);if(recent.length>FLAVOR_POLICY.recentLines)recent.shift();
      handFlavorCount++;lastFlavor=stamp;releaseEvent=undefined;releaseJitter=chooseIndex(FLAVOR_POLICY.releaseJitterEvents+1);persist();
    },
  };
}
export type NarratorFlavorHistory = ReturnType<typeof createNarratorFlavorHistory>;
