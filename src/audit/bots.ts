import { createBot, createBotWithStrategy } from '../bots/index.ts';
import { OPPONENT_PROFILES } from '../bots/profiles.ts';
import type { OpponentLevel, OpponentProfile, OpponentProfileId } from '../bots/profiles.ts';
import { teamOf } from '../cards.ts';
import { createReferee } from '../referee.ts';
import { count, simulationSeed, uint32 } from '../simulation/index.ts';
import type { DecisionPolicy, Seat } from '../types.ts';

export interface CallAudit {
  games: number;
  opportunities: number;
  voluntaryOpportunities: number;
  calls: number;
  voluntaryCalls: number;
  forcedCalls: number;
  roundOneCalls: number;
  roundTwoCalls: number;
  made: number;
  euchred: number;
  marches: number;
  lonerAttempts: number;
  lonerMarches: number;
  makerTricks: number;
  pointsWon: number;
  callRate: number | null;
  voluntaryCallRate: number | null;
  successRate: number | null;
  euchreRate: number | null;
  averageMakerTricks: number | null;
  pointsPerCall: number | null;
}

interface MutableCallAudit {
  games: number;
  opportunities: number;
  voluntaryOpportunities: number;
  calls: number;
  voluntaryCalls: number;
  forcedCalls: number;
  roundOneCalls: number;
  roundTwoCalls: number;
  made: number;
  euchred: number;
  marches: number;
  lonerAttempts: number;
  lonerMarches: number;
  makerTricks: number;
  pointsWon: number;
}

export interface ProfileSeatAudit {
  profileId: OpponentProfileId;
  label: string;
  westName: string;
  eastName: string;
  left: CallAudit;
  right: CallAudit;
  differences: {
    callRatePoints: number | null;
    voluntaryCallRatePoints: number | null;
    successRatePoints: number | null;
    euchreRatePoints: number | null;
    pointsPerCall: number | null;
  };
}

export interface RoundRobinProfileAudit {
  profileId: OpponentProfileId;
  label: string;
  left: CallAudit;
  right: CallAudit;
  combined: CallAudit;
}

export interface BotProfileAuditReport {
  options: {
    tier: OpponentLevel;
    gamesPerCase: number;
    seed: number;
  };
  totalGames: number;
  fixedTeam: {
    seat0: string;
    seat2: 'Val';
  };
  sameProfileSeatAudit: readonly ProfileSeatAudit[];
  roundRobin: readonly RoundRobinProfileAudit[];
}

function blank(): MutableCallAudit {
  return {
    games: 0, opportunities: 0, voluntaryOpportunities: 0, calls: 0, voluntaryCalls: 0,
    forcedCalls: 0, roundOneCalls: 0, roundTwoCalls: 0, made: 0, euchred: 0,
    marches: 0, lonerAttempts: 0, lonerMarches: 0, makerTricks: 0, pointsWon: 0,
  };
}

function ratio(numerator: number, denominator: number): number | null {
  return denominator ? numerator / denominator : null;
}

function finish(value: MutableCallAudit): CallAudit {
  return {
    ...value,
    callRate: ratio(value.calls, value.opportunities),
    voluntaryCallRate: ratio(value.voluntaryCalls, value.voluntaryOpportunities),
    successRate: ratio(value.made, value.calls),
    euchreRate: ratio(value.euchred, value.calls),
    averageMakerTricks: ratio(value.makerTricks, value.calls),
    pointsPerCall: ratio(value.pointsWon, value.calls),
  };
}

function add(target: MutableCallAudit, source: MutableCallAudit): void {
  for (const key of Object.keys(target) as Array<keyof MutableCallAudit>) target[key] += source[key];
}

function difference(a: number | null, b: number | null, percentagePoints = false): number | null {
  if (a === null || b === null) return null;
  return (b - a) * (percentagePoints ? 100 : 1);
}

interface ProfileStats {
  left: MutableCallAudit;
  right: MutableCallAudit;
}

export function auditPolicy(id: OpponentProfileId | 'val'): DecisionPolicy {
  return id === 'val' ? createBot('val') : createBotWithStrategy(OPPONENT_PROFILES[id].strategy);
}
function policy(profile: OpponentProfile): DecisionPolicy {
  return auditPolicy(profile.id);
}

function runProfileGame(options: {
  seed: number;
  dealer: Seat;
  seat0: OpponentProfile;
  left: OpponentProfile;
  right: OpponentProfile;
  stats: ReadonlyMap<OpponentProfileId, ProfileStats>;
}): void {
  const referee = createReferee({ seed: options.seed, dealer: options.dealer });
  const ports = ([0, 1, 2, 3] as const).map(seat => referee.player(seat));
  const policies: readonly DecisionPolicy[] = [
    policy(options.seat0),
    policy(options.left),
    createBot('val'),
    policy(options.right),
  ];

  const leftStats = options.stats.get(options.left.id)!.left;
  const rightStats = options.stats.get(options.right.id)!.right;
  leftStats.games++;
  rightStats.games++;

  let view = ports[0]!.view();
  for (let decisions = 0; decisions < 2500; decisions++) {
    if (view.phase === 'hand-over' || view.phase === 'game-over') {
      const caller = view.caller!;
      const result = view.result!;
      if (caller === 1 || caller === 3) {
        const target = caller === 1 ? leftStats : rightStats;
        target.makerTricks += result.makerTricks;
        target.euchred += Number(result.reason === 'euchred');
        target.made += Number(result.reason !== 'euchred');
        target.marches += Number(result.makerTricks === 5);
        target.lonerMarches += Number(view.alone && result.makerTricks === 5);
        if (result.team === teamOf(caller)) target.pointsWon += result.points;
      }
      if (view.phase === 'game-over') return;
      referee.nextHand();
      view = ports[0]!.view();
      continue;
    }

    const seat = view.turn!;
    const port = ports[seat]!;
    const observation = port.view();
    const action = policies[seat]!(observation);

    if (seat === 1 || seat === 3) {
      const target = seat === 1 ? leftStats : rightStats;
      if (observation.phase === 'bidding') {
        target.opportunities++;
        const voluntary = observation.legalActions.some(candidate => candidate.type === 'pass');
        target.voluntaryOpportunities += Number(voluntary);
        if (action.type === 'order-up' || action.type === 'call') {
          target.calls++;
          target.voluntaryCalls += Number(voluntary);
          target.forcedCalls += Number(!voluntary);
          target.roundOneCalls += Number(observation.biddingRound === 1);
          target.roundTwoCalls += Number(observation.biddingRound === 2);
          target.lonerAttempts += Number(action.alone);
        }
      }
    }

    const outcome = port.act(action);
    if (!outcome.ok) throw new Error(`Illegal action in profile audit at seat ${seat}, hand ${view.handNumber}`);
    view = outcome.view;
  }
  throw new Error('Profile audit game exceeded termination bound');
}

function tierProfiles(tier: OpponentLevel): OpponentProfile[] {
  return Object.values(OPPONENT_PROFILES).filter(profile => profile.level === tier);
}

function statsMap(profiles: readonly OpponentProfile[]): Map<OpponentProfileId, ProfileStats> {
  return new Map(profiles.map(profile => [profile.id, { left: blank(), right: blank() }]));
}

function combined(stats: ProfileStats): CallAudit {
  const total = blank();
  add(total, stats.left);
  add(total, stats.right);
  return finish(total);
}

export function auditBotProfiles(options: {
  tier: OpponentLevel;
  gamesPerCase: number;
  seed: number;
}): BotProfileAuditReport {
  count(options.gamesPerCase);
  uint32(options.seed);
  const profiles = tierProfiles(options.tier);
  if (profiles.length < 2) throw new Error('Profile audit requires at least two profiles in the tier');

  const seat0 = profiles.find(profile => profile.id === `${options.tier}-balanced`) ?? profiles[0]!;
  const sameStats = statsMap(profiles);
  let totalGames = 0;

  // Same strategy in both opponent seats: direct descriptive seat-effect audit.
  for (const profile of profiles) {
    for (let i = 0; i < options.gamesPerCase; i++) {
      runProfileGame({
        seed: simulationSeed(options.seed, i),
        dealer: (i % 4) as Seat,
        seat0,
        left: profile,
        right: profile,
        stats: sameStats,
      });
      totalGames++;
    }
  }

  const sameProfileSeatAudit = profiles.map(profile => {
    const stats = sameStats.get(profile.id)!;
    const left = finish(stats.left);
    const right = finish(stats.right);
    return {
      profileId: profile.id,
      label: profile.label,
      westName: profile.westName,
      eastName: profile.eastName,
      left,
      right,
      differences: {
        callRatePoints: difference(left.callRate, right.callRate, true),
        voluntaryCallRatePoints: difference(left.voluntaryCallRate, right.voluntaryCallRate, true),
        successRatePoints: difference(left.successRate, right.successRate, true),
        euchreRatePoints: difference(left.euchreRate, right.euchreRate, true),
        pointsPerCall: difference(left.pointsPerCall, right.pointsPerCall),
      },
    } satisfies ProfileSeatAudit;
  });

  // Full round robin. Every unordered pair gets matched seeds twice with seats swapped.
  const roundStats = statsMap(profiles);
  for (let a = 0; a < profiles.length; a++) {
    for (let b = a + 1; b < profiles.length; b++) {
      for (let i = 0; i < options.gamesPerCase; i++) {
        const seed = simulationSeed(options.seed ^ 0x6d2b79f5, i);
        const dealer = (i % 4) as Seat;
        runProfileGame({ seed, dealer, seat0, left: profiles[a]!, right: profiles[b]!, stats: roundStats });
        runProfileGame({ seed, dealer, seat0, left: profiles[b]!, right: profiles[a]!, stats: roundStats });
        totalGames += 2;
      }
    }
  }

  const roundRobin = profiles.map(profile => {
    const stats = roundStats.get(profile.id)!;
    return {
      profileId: profile.id,
      label: profile.label,
      left: finish(stats.left),
      right: finish(stats.right),
      combined: combined(stats),
    };
  });

  return {
    options,
    totalGames,
    fixedTeam: { seat0: seat0.label, seat2: 'Val' },
    sameProfileSeatAudit,
    roundRobin,
  };
}
