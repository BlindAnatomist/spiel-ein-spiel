import { createBot } from '../bots/index.ts';
import type { BotLevel } from '../bots/index.ts';
import { hashText } from '../bots/random.ts';
import { createReferee } from '../referee.ts';
import type { DecisionPolicy, HandResult, Seat, Team } from '../types.ts';
export type Lineup = readonly [BotLevel, BotLevel, BotLevel, BotLevel];
export interface HandRecord {
  handNumber: number; dealer: Seat; caller: Seat; alone: boolean; round: 1 | 2; result: HandResult;
}
export interface MatchRecord {
  seed: number; dealer: Seat; levels: Lineup; winner: Team; score: readonly [number, number];
  hands: HandRecord[]; decisions: number; passes: number; digest: number;
}
export function uint32(value: number): void {
  if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) throw new RangeError('Expected uint32 seed');
}
export function count(value: number): void {
  if (!Number.isSafeInteger(value) || value < 1) throw new RangeError('Count must be a positive safe integer');
}
/** Avalanche-mixed, documented host-only sequence; never passed to policies. */
export function simulationSeed(base: number, index: number): number {
  uint32(base);
  if (!Number.isSafeInteger(index) || index < 0 || index > 0xffffffff) throw new RangeError('Invalid seed index');
  let n = (base + Math.imul(index + 1, 0x9e3779b9)) >>> 0;
  n = Math.imul(n ^ (n >>> 16), 0x85ebca6b);
  n = Math.imul(n ^ (n >>> 13), 0xc2b2ae35);
  return (n ^ (n >>> 16)) >>> 0;
}
export function runMatch(options: { seed: number; levels: Lineup; dealer?: Seat }, policies?: readonly DecisionPolicy[]): MatchRecord {
  uint32(options.seed);
  if (options.levels.length !== 4) throw new Error('Four bot levels required');
  const bots = policies ?? options.levels.map(createBot);
  if (bots.length !== 4) throw new Error('Four policies required');
  const dealer = options.dealer ?? 0;
  const referee = createReferee({ seed: options.seed, dealer });
  const ports = ([0, 1, 2, 3] as const).map(seat => referee.player(seat));
  let view = ports[0]!.view();
  const hands: HandRecord[] = [];
  let decisions = 0; let passes = 0; let digest = 0;
  for (;;) {
    if (view.phase === 'hand-over' || view.phase === 'game-over') {
      hands.push({ handNumber: view.handNumber, dealer: view.dealer, caller: view.caller!, alone: view.alone, round: view.biddingRound, result: view.result! });
      if (view.phase === 'game-over') return { seed: options.seed, dealer, levels: [...options.levels], winner: view.winner!, score: view.score, hands, decisions, passes, digest };
      referee.nextHand(); view = ports[0]!.view();
    }
    // Only this seat's view crosses the policy boundary. No snapshots used even by driver.
    const seat = view.turn!; const port = ports[seat]!;
    const observation = port.view();
    const action = bots[seat]!(observation);
    const outcome = port.act(action);
    if (!outcome.ok) throw new Error(`Illegal bot action at hand ${view.handNumber}, seat ${seat}`);
    digest = hashText(`${digest}:${seat}:${JSON.stringify(action)}`);
    passes += Number(action.type === 'pass');
    view = outcome.view;
    if (++decisions > 2000) throw new Error('Match did not terminate within the engine scoring bound');
  }
}
export function summarize(records: readonly MatchRecord[]) {
  if (!records.length) throw new Error('No matches to summarize');
  const teamWins = [0, 0]; const scoreTotals = [0, 0]; const callsBySeat = [0, 0, 0, 0];
  let hands = 0; let euchres = 0; let marches = 0; let lonerAttempts = 0; let lonerSuccesses = 0; let roundOneCalls = 0;
  for (const match of records) {
    teamWins[match.winner]!++;
    for (let team = 0; team < 2; team++) scoreTotals[team]! += match.score[team]!;
    for (const hand of match.hands) {
      hands++; callsBySeat[hand.caller]!++; roundOneCalls += Number(hand.round === 1);
      euchres += Number(hand.result.reason === 'euchred');
      marches += Number(hand.result.makerTricks === 5); // Includes loner marches.
      lonerAttempts += Number(hand.alone);
      lonerSuccesses += Number(hand.alone && hand.result.makerTricks === 5);
    }
  }
  return { games: records.length, teamWins, teamWinRates: teamWins.map(n => n / records.length),
    averageFinalScore: scoreTotals.map(n => n / records.length), hands, averageHands: hands / records.length,
    euchres, euchreRate: euchres / hands, marches, marchRate: marches / hands,
    lonerAttempts, lonerSuccesses, lonerSuccessRate: lonerAttempts ? lonerSuccesses / lonerAttempts : null,
    callsBySeat, roundOneCalls, roundTwoCalls: hands - roundOneCalls,
    passes: records.reduce((n, r) => n + r.passes, 0), decisions: records.reduce((n, r) => n + r.decisions, 0) };
}
export function simulate(options: { games: number; seed: number; levels: Lineup }) {
  count(options.games); uint32(options.seed);
  const records = Array.from({ length: options.games }, (_, i) => runMatch({ seed: simulationSeed(options.seed, i), dealer: (i % 4) as Seat, levels: options.levels }));
  return { options, summary: summarize(records), records };
}
/** Treat each matched seed pair as one statistical cluster, not two independent games. */
export function pairInterval(pairShares: readonly number[]): readonly [number, number] | null {
  if (pairShares.length < 2) return null;
  const mean = pairShares.reduce((a, b) => a + b, 0) / pairShares.length;
  const variance = pairShares.reduce((sum, x) => sum + (x - mean) ** 2, 0) / (pairShares.length - 1);
  const margin = 1.96 * Math.sqrt(variance / pairShares.length);
  return [Math.max(0, mean - margin), Math.min(1, mean + margin)];
}
export function compare(options: { a: BotLevel; b: BotLevel; pairs: number; seed: number }) {
  count(options.pairs); uint32(options.seed);
  const records: MatchRecord[] = []; const pairShares: number[] = [];
  let aWins = 0; let aPoints = 0; let bPoints = 0;
  for (let i = 0; i < options.pairs; i++) {
    const seed = simulationSeed(options.seed, i); const dealer = (i % 4) as Seat;
    const first = runMatch({ seed, dealer, levels: [options.a, options.b, options.a, options.b] });
    const second = runMatch({ seed, dealer, levels: [options.b, options.a, options.b, options.a] });
    const wins = Number(first.winner === 0) + Number(second.winner === 1);
    aWins += wins; pairShares.push(wins / 2);
    aPoints += first.score[0] + second.score[1]; bPoints += first.score[1] + second.score[0];
    records.push(first, second);
  }
  return { options, games: records.length, aWins, bWins: records.length - aWins,
    aWinRate: aWins / records.length, aWinRate95Interval: pairInterval(pairShares),
    aAverageFinalScore: aPoints / records.length, bAverageFinalScore: bPoints / records.length,
    summary: summarize(records), pairShares,
    digest: hashText(records.map(r => r.digest).join(',')) };
}
