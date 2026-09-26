import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { auditDeals } from '../src/audit/deals.ts';
import { createBot } from '../src/bots/index.ts';
import { OPPONENT_PROFILES, seatNamesForProfiles, selectOpponentProfiles, selectSeatNames } from '../src/bots/profiles.ts';
import type { OpponentDifficulty } from '../src/bots/profiles.ts';
import {
  createPerformanceRecorder,
  ensurePerformanceProfile,
  loadPendingArchives,
  loadPerformance,
  markPerformanceArchived,
  ownerTrend,
  performanceAnalysisText,
  performanceText,
  summarizePerformance,
  PERFORMANCE_DATASET_EPOCH,
  PERFORMANCE_RULES_VERSION,
  PERFORMANCE_SCHEMA_VERSION,
} from '../web/performance.ts';
import type { GamePerformance, HandPerformance, PerformanceBook, StorageLike } from '../web/performance.ts';
import { createSession } from '../web/session.ts';
import type { OpponentIdentity } from '../web/session.ts';

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

const namedOpponents: readonly [OpponentIdentity, OpponentIdentity] = [
  { seat: 1, name: 'Wade', id: 'strong-assertive', label: 'Assertive Strong', level: 'strong' },
  { seat: 3, name: 'Ellen', id: 'strong-conservative', label: 'Conservative Strong', level: 'strong' },
];

function hand(caller: 0 | 1 | 2 | 3, reason: HandPerformance['reason'] = 'made'): HandPerformance {
  return {
    handNumber: 1,
    dealer: 0,
    scoreBefore: [0, 0],
    scoreAfter: reason === 'euchred' ? [0, 2] : caller % 2 === 0 ? [1, 0] : [0, 1],
    upCard: 'clubs:9',
    ownerStartingHand: ['clubs:9', 'diamonds:10', 'hearts:J', 'spades:Q', 'clubs:K'],
    caller,
    trump: 'clubs',
    round: 1,
    alone: false,
    makerTricks: reason === 'euchred' ? 2 : 3,
    awardedTeam: reason === 'euchred' ? (1 - (caller % 2)) as 0 | 1 : (caller % 2) as 0 | 1,
    points: reason === 'euchred' ? 2 : 1,
    reason,
  };
}

function game(overrides: Partial<GamePerformance> & Pick<GamePerformance, 'id' | 'humanTracking' | 'winner' | 'score' | 'hands'>): GamePerformance {
  return {
    schemaVersion: PERFORMANCE_SCHEMA_VERSION,
    datasetEpoch: PERFORMANCE_DATASET_EPOCH,
    buildCommit: 'test-build',
    rulesVersion: PERFORMANCE_RULES_VERSION,
    completedAt: '2026-09-23T21:00:00.000Z',
    difficulty: 'strong',
    startingDealer: 0,
    opponents: namedOpponents,
    ...overrides,
  };
}

function book(games: readonly GamePerformance[]): PerformanceBook {
  return { version: 2, games };
}

test('data controls stay compact: one tracking toggle and one Analysis button', () => {
  const html = readFileSync('web/index.html', 'utf8');
  assert.equal((html.match(/id="human-tracking"/g) ?? []).length, 1);
  assert.match(html, /id="human-tracking"[^>]*aria-pressed="false"[^>]*>Bot data only</);
  assert.equal((html.match(/id="performance-analysis"/g) ?? []).length, 1);
  assert.doesNotMatch(html, /Performance summary|Performance recovery code|Human performance data/);
  assert.doesNotMatch(html, /Stick the dealer\. Maker may go alone/);
});

test('ordinary difficulties select distinct strategy profiles within the requested tier', () => {
  assert.equal(Object.keys(OPPONENT_PROFILES).length, 10);
  assert.equal(Object.values(OPPONENT_PROFILES).filter(p => p.level === 'casual').length, 3);
  assert.equal(Object.values(OPPONENT_PROFILES).filter(p => p.level === 'strong').length, 4);
  assert.equal(Object.values(OPPONENT_PROFILES).filter(p => p.level === 'expert').length, 3);
  for (const difficulty of ['casual', 'strong', 'expert'] as const) {
    for (let seed = 0; seed < 40; seed++) {
      const [west, east] = selectOpponentProfiles(difficulty, seed);
      assert.equal(west.level, difficulty);
      assert.equal(east.level, difficulty);
      assert.notEqual(west.id, east.id);
    }
  }
  assert.ok(Object.isFrozen(OPPONENT_PROFILES['strong-balanced'].strategy));
});

test('each strategy owns compact permanent W-left and E-right identities and can occupy either side', () => {
  const westNames = new Set<string>();
  const eastNames = new Set<string>();
  for (const profile of Object.values(OPPONENT_PROFILES)) {
    assert.match(profile.westName, /^W/);
    assert.match(profile.eastName, /^E/);
    assert.ok(profile.westName.length <= 5, profile.westName);
    assert.ok(profile.eastName.length <= 5, profile.eastName);
    assert.equal(westNames.has(profile.westName), false);
    assert.equal(eastNames.has(profile.eastName), false);
    westNames.add(profile.westName);
    eastNames.add(profile.eastName);
    assert.deepEqual(
      seatNamesForProfiles([profile, profile]),
      ['You', profile.westName, 'Val', profile.eastName],
    );
  }
  assert.equal(westNames.size, 10);
  assert.equal(eastNames.size, 10);

  for (const difficulty of ['casual', 'strong', 'expert'] as const) {
    const ids = Object.values(OPPONENT_PROFILES).filter(p => p.level === difficulty).map(p => p.id);
    const left = new Set<string>();
    const right = new Set<string>();
    for (let seed = 0; seed < 1000; seed++) {
      const [leftProfile, rightProfile] = selectOpponentProfiles(difficulty, seed);
      left.add(leftProfile.id);
      right.add(rightProfile.id);
      const names = selectSeatNames(difficulty, seed);
      assert.equal(names[1], leftProfile.westName);
      assert.equal(names[3], rightProfile.eastName);
    }
    assert.deepEqual([...left].sort(), [...ids].sort());
    assert.deepEqual([...right].sort(), [...ids].sort());
  }
});

test('live session narration uses the selected W and E table identities', () => {
  const seatNames = selectSeatNames('casual', 12);
  const session = createSession(12, 'casual', { dealer: 0, seatNames, opponentMode: 'varied' });
  const update = session.bot();
  assert.ok(update);
  assert.ok(update.messages.some(message => message.startsWith(`${seatNames[1]} `)));
});

test('varied session rejects a table name that does not belong to the selected strategy', () => {
  const correct = selectSeatNames('strong', 44);
  const wrong = ['You', correct[1] === 'Wade' ? 'Walt' : 'Wade', 'Val', correct[3]] as const;
  assert.throws(
    () => createSession(44, 'strong', { opponentMode: 'varied', seatNames: wrong }),
    /permanent strategy identities/,
  );
});

test('mixed opponents always use two different difficulty levels and replay from the same seed', () => {
  for (let seed = 0; seed < 80; seed++) {
    const first = selectOpponentProfiles('mixed', seed);
    const replay = selectOpponentProfiles('mixed', seed);
    assert.deepEqual(first.map(profile => profile.id), replay.map(profile => profile.id));
    assert.notEqual(first[0].level, first[1].level);
  }
});

test('owner game archives rich permitted decision evidence and keeps local history compact', () => {
  const storage = new MemoryStorage();
  const seatNames = selectSeatNames('mixed', 20260923);
  const recorder = createPerformanceRecorder(storage, {
    profileId: 'EUC-test-profile-1234567890',
    gameId: 'game-1',
    humanTracking: 'owner',
    buildCommit: 'test-build',
    completedAt: () => '2026-09-23T21:00:00.000Z',
  });
  let decisions = 0;
  const observer = {
    handStarted(view: Parameters<NonNullable<typeof recorder.handStarted>>[0],
      meta: Parameters<NonNullable<typeof recorder.handStarted>>[1]) {
      recorder.handStarted?.(view, meta);
    },
    decision(seat: Parameters<NonNullable<typeof recorder.decision>>[0],
      view: Parameters<NonNullable<typeof recorder.decision>>[1],
      action: Parameters<NonNullable<typeof recorder.decision>>[2],
      meta: Parameters<NonNullable<typeof recorder.decision>>[3]) {
      for (const forbidden of ['hands', 'kitty', 'rng', 'seed', 'snapshot', 'state']) assert.ok(!(forbidden in view));
      decisions++;
      recorder.decision?.(seat, view, action, meta);
    },
    handCompleted(view: Parameters<NonNullable<typeof recorder.handCompleted>>[0],
      meta: Parameters<NonNullable<typeof recorder.handCompleted>>[1]) {
      recorder.handCompleted?.(view, meta);
    },
    gameCompleted(view: Parameters<NonNullable<typeof recorder.gameCompleted>>[0],
      meta: Parameters<NonNullable<typeof recorder.gameCompleted>>[1]) {
      recorder.gameCompleted?.(view, meta);
    },
  };
  const session = createSession(20260923, 'mixed', {
    dealer: 2, observer, opponentMode: 'varied', seatNames,
  });
  const human = createBot('strong');

  for (let step = 0; step < 3000; step++) {
    const view = session.view();
    if (view.phase === 'game-over') break;
    if (view.phase === 'hand-over') {
      session.nextHand();
      continue;
    }
    if (view.turn === 0) assert.ok(session.human(human(view)));
    else assert.ok(session.bot());
  }

  const final = session.view();
  assert.equal(final.phase, 'game-over');
  assert.ok(decisions > final.handNumber);

  const local = loadPerformance(storage);
  assert.equal(local.version, 2);
  assert.equal(local.games.length, 1);
  const localGame = local.games[0]!;
  assert.equal(localGame.schemaVersion, 2);
  assert.equal(localGame.datasetEpoch, 1);
  assert.equal(localGame.buildCommit, 'test-build');
  assert.equal(localGame.rulesVersion, PERFORMANCE_RULES_VERSION);
  assert.equal(localGame.startingDealer, 2);
  assert.equal(localGame.hands.length, final.handNumber);
  assert.equal('decisions' in localGame.hands[0]!, false);
  assert.match(localGame.opponents[0]!.name, /^W/);
  assert.match(localGame.opponents[1]!.name, /^E/);

  const pending = loadPendingArchives(storage);
  assert.equal(pending.length, 1);
  const archive = pending[0]!.game;
  assert.equal(archive.schemaVersion, 2);
  assert.equal(archive.datasetEpoch, 1);
  assert.deepEqual(archive.seatNames, seatNames);
  assert.equal(archive.hands.length, final.handNumber);
  assert.ok(archive.hands.every(value => value.decisions.length > 0));
  assert.ok(archive.hands.every(value => value.ownerStartingHand?.length === 5));
  const evidence = archive.hands.flatMap(value => value.decisions);
  assert.ok(evidence.some(value => value.actorKind === 'owner' && value.view?.seat === 0));
  assert.ok(evidence.some(value => value.actorKind === 'val' && value.view?.seat === 2));
  assert.ok(evidence.some(value => value.actorKind === 'opponent' && value.seat === 1 && value.view?.seat === 1));
  assert.ok(evidence.some(value => value.actorKind === 'opponent' && value.seat === 3 && value.view?.seat === 3));
  for (const decision of evidence) if (decision.view) {
    for (const forbidden of ['hands', 'kitty', 'rng', 'seed', 'snapshot', 'state']) assert.ok(!(forbidden in decision.view));
  }

  const summary = summarizePerformance(local);
  assert.equal(summary.games, 1);
  assert.equal(summary.botGames, 1);
  assert.equal(summary.botHands, final.handNumber);
  assert.match(performanceText(summary), /Left-seat calls:/);
  assert.match(performanceText(summary), /Right-seat calls:/);
  markPerformanceArchived(storage, 'game-1');
  assert.deepEqual(loadPendingArchives(storage), []);
});

test('other-player games retain bot evidence but never archive that human private view or starting hand', () => {
  const storage = new MemoryStorage();
  const seatNames = selectSeatNames('strong', 99);
  const recorder = createPerformanceRecorder(storage, {
    profileId: 'EUC-other-profile-1234567890',
    gameId: 'other-game',
    humanTracking: 'other',
    buildCommit: 'test-build',
    completedAt: () => '2026-09-23T22:00:00.000Z',
  });
  const session = createSession(99, 'strong', {
    dealer: 1, observer: recorder, opponentMode: 'varied', seatNames,
  });
  const human = createBot('strong');
  for (let step = 0; step < 3000; step++) {
    const view = session.view();
    if (view.phase === 'game-over') break;
    if (view.phase === 'hand-over') { session.nextHand(); continue; }
    if (view.turn === 0) assert.ok(session.human(human(view)));
    else assert.ok(session.bot());
  }
  assert.equal(session.view().phase, 'game-over');
  const archive = loadPendingArchives(storage)[0]!.game;
  assert.equal(archive.humanTracking, 'other');
  assert.ok(archive.hands.every(value => value.ownerStartingHand === null));
  const humanDecisions = archive.hands.flatMap(value => value.decisions).filter(value => value.seat === 0);
  assert.ok(humanDecisions.length > 0);
  assert.ok(humanDecisions.every(value => value.actorKind === 'other-human' && value.view === null));
  const botDecisions = archive.hands.flatMap(value => value.decisions).filter(value => value.seat !== 0);
  assert.ok(botDecisions.every(value => value.view !== null));
  const summary = summarizePerformance(loadPerformance(storage));
  assert.equal(summary.games, 0);
  assert.equal(summary.botGames, 1);
});

test('performance recovery profile survives reload and is not regenerated', () => {
  const storage = new MemoryStorage();
  let calls = 0;
  const first = ensurePerformanceProfile(storage, () => { calls++; return '12345678-1234-1234-1234-123456789abc'; });
  const second = ensurePerformanceProfile(storage, () => { calls++; return 'ffffffff-ffff-ffff-ffff-ffffffffffff'; });
  assert.equal(first, 'EUC-12345678-1234-1234-1234-123456789abc');
  assert.equal(second, first);
  assert.equal(calls, 1);
});

test('other-player games feed bot analysis without contaminating owner performance', () => {
  const owner = game({
    id: 'owner-game',
    humanTracking: 'owner',
    winner: 0,
    score: [10, 6],
    hands: [hand(0), hand(1), hand(2)],
  });
  const other = game({
    id: 'other-game',
    humanTracking: 'other',
    winner: 1,
    score: [7, 10],
    hands: [hand(0), hand(2), hand(3)],
    completedAt: '2026-09-23T22:00:00.000Z',
  });
  const summary = summarizePerformance(book([owner, other]));
  assert.equal(summary.games, 1);
  assert.equal(summary.wins, 1);
  assert.equal(summary.losses, 0);
  assert.equal(summary.ownerCaller.calls, 1);
  assert.equal(summary.botGames, 2);
  assert.equal(summary.botHands, 6);
  assert.equal(summary.valCaller.calls, 2);
  assert.equal(summary.botCallsBySeat[1], 1);
  assert.equal(summary.botCallsBySeat[3], 1);
  assert.equal(summary.opponents[0]!.games, 2);
  assert.match(performanceText(summary), /My tracked games: 1/);
  assert.match(performanceText(summary), /Bot observations: 2 completed games/);
  const trend = ownerTrend(book([owner, other]), 1);
  assert.equal(trend.length, 1);
  assert.equal(trend[0]!.winRate, 100);
  assert.equal(trend[0]!.callSuccessRate, 100);
});

test('owner trend compares sequential owner-only game blocks', () => {
  const games = Array.from({ length: 20 }, (_, index) => game({
    id: `g-${index + 1}`,
    completedAt: `2026-09-${String(index + 1).padStart(2, '0')}T12:00:00.000Z`,
    humanTracking: 'owner',
    winner: index < 10 ? (index < 4 ? 0 : 1) : (index < 17 ? 0 : 1),
    score: index < 10 ? [8, 10] : [10, 7],
    hands: [hand(0, index < 10 ? 'euchred' : 'made')],
  }));
  const trend = ownerTrend(book(games), 10);
  assert.equal(trend.length, 2);
  assert.equal(trend[0]!.label, 'Games 1–10');
  assert.equal(trend[0]!.winRate, 40);
  assert.equal(trend[0]!.callSuccessRate, 0);
  assert.equal(trend[1]!.winRate, 70);
  assert.equal(trend[1]!.callSuccessRate, 100);
  const text = performanceAnalysisText(book(games), 10);
  assert.match(text, /win rate changed from 40 to 70 percent/);
  assert.match(text, /calling success changed from 0 to 100 percent/);
});

test('invalid or unavailable local storage data fails closed without affecting game statistics', () => {
  const broken: StorageLike = {
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('blocked'); },
  };
  assert.deepEqual(loadPerformance(broken), { version: 2, games: [] });
  assert.equal(performanceText(summarizePerformance(loadPerformance(broken))), 'No games recorded for my performance yet.');
});

test('deal audit finds no large card-location or seat-zero pair anomaly across 20,000 replayable deals', () => {
  const report = auditDeals({ deals: 20000, seed: 20260923 });
  assert.equal(report.source, 'deterministic');
  assert.ok(report.maxCardLocationAbsZ < 6, JSON.stringify(report.maxCardLocation));
  assert.ok(report.maxSeatZeroPairAbsZ < 6, JSON.stringify(report.maxSeatZeroPair));
  for (const average of Object.values(report.seatZeroRankAverage)) assert.ok(Math.abs(average - 5 / 6) < 0.05);
  for (const average of Object.values(report.seatZeroSuitAverage)) assert.ok(Math.abs(average - 1.25) < 0.06);
  assert.equal(report.seatZeroDistinctSuitsHistogram.reduce((a, b) => a + b, 0), 20000);
  assert.equal(report.seatZeroMaxSameSuitHistogram.reduce((a, b) => a + b, 0), 20000);
});

test('deal audit accepts the injected live-random path and validates its source contract', () => {
  let state = 0x12345678;
  const randomWord = () => {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
    return state >>> 0;
  };
  const report = auditDeals({ deals: 100, seed: 7, randomWord });
  assert.equal(report.source, 'injected-random');
  assert.equal(report.deals, 100);
  assert.throws(() => auditDeals({ deals: 0, seed: 1 }));
});

test('rich archive submission relies on the persistent retry queue, not fetch keepalive', () => {
  const source = readFileSync('web/main.ts', 'utf8');
  assert.doesNotMatch(source, /keepalive\s*:\s*true/);
  assert.match(source, /loadPendingArchives/);
  assert.match(source, /markPerformanceArchived/);
});

test('difficulty type includes mixed while preserving all existing named choices', () => {
  const values: OpponentDifficulty[] = ['casual', 'strong', 'expert', 'mixed'];
  assert.deepEqual(values, ['casual', 'strong', 'expert', 'mixed']);
});
