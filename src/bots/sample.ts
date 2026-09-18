import { deck, effectiveSuit } from '../cards.ts';
import type { Card, PlayerView } from '../types.ts';
import { publicPlayed, SEATS } from './evaluate.ts';
/** Hypotheses only. These arrays never come from the referee. */
export interface Hypothesis { hands: Card[][]; buried: Card[] }
export function sampleWorld(view: PlayerView, random: () => number): Hypothesis | null {
  const played = publicPlayed(view);
  const known = new Set([...played, ...view.hand]);
  const unknown = deck().filter(c => !known.has(c));
  const playedBySeat = SEATS.map(s => view.completedTricks.flatMap(t => t.plays).concat([...view.trick]).filter(p => p.seat === s).length);
  const capacities = [...SEATS.map(s => s === view.seat ? 0 : 5 - playedBySeat[s]!), 4];
  if (capacities.reduce((a, b) => a + b, 0) !== unknown.length) return null;
  const allowed = (card: Card, slot: number): boolean => {
    if (card === view.upCard) {
      if (view.upCardStatus === 'turned-down' && slot !== 4) return false;
      if (view.upCardStatus === 'ordered' && slot !== 4 && slot !== view.dealer) return false;
    }
    return slot === 4 || !view.knownVoids[slot]!.includes(effectiveSuit(card, view.trump!));
  };
  // Randomized capacity-weighted assignment, most constrained cards first.
  // Bounded retries; an impossible synthetic view falls back to the heuristic.
  for (let attempt = 0; attempt < 48; attempt++) {
    const slots: Card[][] = [[], [], [], [], []];
    const left = [...capacities];
    const order = unknown.map(card => ({ card, tie: random(), options: capacities.map((_, s) => s).filter(s => capacities[s]! > 0 && allowed(card, s)) }))
      .sort((a, b) => a.options.length - b.options.length || a.tie - b.tie);
    let failed = false;
    for (const { card, options } of order) {
      const choices = options.filter(s => left[s]! > 0);
      const total = choices.reduce((n, s) => n + left[s]!, 0);
      if (!total) { failed = true; break; }
      let draw = random() * total;
      let chosen = choices[0]!;
      for (const slot of choices) { chosen = slot; draw -= left[slot]!; if (draw < 0) break; }
      slots[chosen]!.push(card); left[chosen]!--;
    }
    if (!failed) {
      slots[view.seat] = [...view.hand];
      return { hands: slots.slice(0, 4), buried: slots[4]! };
    }
  }
  return null;
}
