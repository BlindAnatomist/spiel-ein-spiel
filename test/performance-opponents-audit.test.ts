import test from 'node:test';
import assert from 'node:assert/strict';
import { auditDeals } from '../src/audit/deals.ts';
import { createBot } from '../src/bots/index.ts';
import { OPPONENT_PROFILES, selectOpponentProfiles } from '../src/bots/profiles.ts';
import type { OpponentDifficulty } from '../src/bots/profiles.ts';
import { createPerformanceRecorder, ensurePerformanceProfile, loadPendingArchives, loadPerformance, markPerformanceArchived, performanceText, summarizePerformance } from '../web/performance.ts';
import type { StorageLike } from '../web/performance.ts';
import { createSession } from '../web/session.ts';

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

test('ordinary difficulties select two distinct profiles within the requested tier', () => {
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

test('mixed opponents always use two different difficulty levels and replay from the same seed', () => {
  for (let seed = 0; seed < 80; seed++) {
    const first = selectOpponentProfiles('mixed', seed);
    const replay = selectOpponentProfiles('mixed', seed);
    assert.deepEqual(first.map(profile => profile.id), replay.map(profile => profile.id));
    assert.notEqual(first[0].level, first[1].level);
  }
});

test('public completion tracking records one complete game without exposing hidden state', () => {
  const storage = new MemoryStorage();
  const recorder = createPerformanceRecorder(storage, { profileId: 'EUC-test-profile-1234567890', gameId: 'game-1', completedAt: () => '2026-09-23T21:00:00.000Z' });
  const seen: string[] = [];
  const observer = {
    handCompleted(view: Parameters<NonNullable<typeof recorder.handCompleted>>[0],
      meta: Parameters<NonNullable<typeof recorder.handCompleted>>[1]) {
      for (const forbidden of ['hands', 'kitty', 'rng', 'seed', 'snapshot', 'state']) assert.ok(!(forbidden in view));
      seen.push(`hand:${view.handNumber}:${meta.opponents[0].id}:${meta.opponents[1].id}`);
      recorder.handCompleted?.(view, meta);
    },
    gameCompleted(view: Parameters<NonNullable<typeof recorder.gameCompleted>>[0],
      meta: Parameters<NonNullable<typeof recorder.gameCompleted>>[1]) {
      seen.push('game');
      recorder.gameCompleted?.(view, meta);
    },
  };
  const session = createSession(20260923, 'mixed', { dealer: 2, observer, opponentMode: 'varied' });
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
  assert.equal(seen.filter(item => item === 'game').length, 1);
  assert.equal(seen.filter(item => item.startsWith('hand:')).length, final.handNumber);

  const book = loadPerformance(storage);
  assert.equal(book.games.length, 1);
  const game = book.games[0]!;
  assert.equal(game.hands.length, final.handNumber);
  assert.deepEqual(game.score, final.score);
  assert.equal(game.id, 'game-1');
  assert.equal(game.completedAt, '2026-09-23T21:00:00.000Z');
  assert.deepEqual(game.opponents.map(opponent => opponent.id), selectOpponentProfiles('mixed', 20260923).map(opponent => opponent.id));

  const summary = summarizePerformance(book);
  assert.equal(summary.games, 1);
  assert.equal(summary.wins + summary.losses, 1);
  assert.equal(summary.hands, final.handNumber);
  assert.equal(summary.callsBySeat.reduce((a, b) => a + b, 0), summary.hands);
  assert.match(performanceText(summary), /West calls:/);
  assert.match(performanceText(summary), /East calls:/);
  assert.equal(loadPendingArchives(storage).length, 1);
  assert.equal(loadPendingArchives(storage)[0]!.profileId, 'EUC-test-profile-1234567890');
  markPerformanceArchived(storage, 'game-1');
  assert.deepEqual(loadPendingArchives(storage), []);
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

test('invalid or unavailable local storage data fails closed without affecting game statistics', () => {
  const broken: StorageLike = {
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('blocked'); },
  };
  assert.deepEqual(loadPerformance(broken), { version: 1, games: [] });
  assert.equal(performanceText(summarizePerformance(loadPerformance(broken))), 'No completed games recorded yet.');
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

test('difficulty type includes mixed while preserving all existing named choices', () => {
  const values: OpponentDifficulty[] = ['casual', 'strong', 'expert', 'mixed'];
  assert.deepEqual(values, ['casual', 'strong', 'expert', 'mixed']);
});
