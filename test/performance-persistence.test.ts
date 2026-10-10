import test from 'node:test';
import assert from 'node:assert/strict';
import { createSession } from '../web/session.ts';
import type { SessionMeta } from '../web/session.ts';
import type { PlayerView } from '../src/index.ts';
import {
  createPerformanceRecorder, createPerformancePersistence, loadPerformance, loadPendingArchives,
  ensurePerformanceProfile, retainPerformanceProfile, PERFORMANCE_STORAGE_KEY, PERFORMANCE_PENDING_ARCHIVE_KEY,
  PERFORMANCE_PROFILE_KEY, type StorageLike,
} from '../web/performance.ts';

class FaultStorage implements StorageLike {
  values = new Map<string, string>();
  mode: 'working' | 'throwing' | 'silent' | 'blocked' = 'working';
  failedKey: string | null = null;
  writes = 0;
  getItem(key: string) {
    if (this.mode === 'blocked') throw new Error('SecurityError');
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.writes++;
    if (this.failedKey === null || this.failedKey === key) {
      if (this.mode === 'silent') return;
      if (this.mode !== 'working') throw new Error('QuotaExceededError');
    }
    this.values.set(key, value);
  }
}
const profileId = 'EUC-test-profile-1234567890';
const meta: SessionMeta = {difficulty: 'strong', seatNames: ['You', 'Wes', 'Val', 'Emma'], opponents: [
  {id: 'strong-assertive', name: 'Wes', label: 'Strong', level: 'strong', seat: 1},
  {id: 'strong-conservative', name: 'Emma', label: 'Strong', level: 'strong', seat: 3},
]};
const start = createSession(77, 'strong').view();
const final: PlayerView = {...start, phase: 'game-over', score: [10,0], trump: 'hearts', caller: 0,
  biddingRound: 2, alone: false, result: {team: 0, makerTricks: 3, points: 1, reason: 'made'}, winner: 0};
function completion(storage: StorageLike, store = createPerformancePersistence(storage), id = 'game-1') {
  let queued = 0, dates = 0, changed = 0;
  const recorder = createPerformanceRecorder(storage, {persistence: store, profileId, gameId: id,
    completedAt: () => { dates++; return '2026-10-10T12:00:00.000Z'; }, archiveQueued: () => {queued++;},
    persistenceChanged: () => {changed++;}, humanTracking: 'other'});
  recorder.handStarted?.(start, meta); recorder.handCompleted?.(final, meta);
  const finish = () => recorder.gameCompleted?.(final, meta);
  finish();
  return {store, finish, queued: () => queued, dates: () => dates, changed: () => changed};
}
for (const mode of ['throwing','silent','blocked'] as const) {
  test(`${mode} storage keeps one stable completion and retries after recovery`, () => {
    const storage = new FaultStorage(); storage.mode = mode;
    const h = completion(storage);
    h.finish(); h.finish();
    assert.equal(h.dates(), 1); assert.equal(h.queued(), 0);
    assert.equal(h.store.book().games.length, 1); assert.match(h.store.status(), /unsaved performance data/);
    assert.match(h.store.status(), /Closing or reloading can lose/);
    assert.equal(storage.values.size, 0);
    storage.mode = 'working'; h.finish(); h.finish(); h.store.retry();
    assert.equal(h.dates(), 1); assert.equal(h.queued(), 1); assert.equal(h.store.status(), '');
    assert.equal(loadPerformance(storage).games.length, 1); assert.equal(loadPendingArchives(storage).length, 1);
    assert.equal(loadPendingArchives(storage)[0]!.game.hands[0]!.ownerStartingHand, null);
    const reloaded = createPerformancePersistence(storage); reloaded.retry();
    assert.equal(reloaded.book().games.length, 1); assert.equal(reloaded.pending().length, 1);
  });
}
test('working storage control is durable and repeated callbacks never requeue an uploaded game', () => {
  const storage = new FaultStorage(), h = completion(storage);
  assert.equal(h.queued(), 1); assert.equal(h.changed(), 1);
  assert.equal(h.store.archived('game-1'), true);
  h.finish(); h.finish();
  const reload = createPerformancePersistence(storage); reload.retry();
  assert.equal(loadPerformance(storage).games.length, 1); assert.equal(reload.pending().length, 0);
  assert.equal(h.queued(), 1);
});
test('failed completions survive new recorders and merge with existing history without duplicates', () => {
  const storage = new FaultStorage(); completion(storage, undefined, 'older');
  storage.mode = 'throwing'; const store = createPerformancePersistence(storage);
  const first = completion(storage, store, 'first'); completion(storage, store, 'second');
  assert.deepEqual(store.book().games.map(g => g.id), ['older','first','second']);
  storage.mode = 'working'; store.retry(); first.finish(); store.retry();
  assert.deepEqual(loadPerformance(storage).games.map(g => g.id), ['older','first','second']);
  assert.deepEqual(loadPendingArchives(storage).map(g => g.game.id), ['older','first','second']);
});
for (const key of [PERFORMANCE_STORAGE_KEY, PERFORMANCE_PENDING_ARCHIVE_KEY]) {
  test(`one-key failure is reported, recovered, and deduplicated: ${key}`, () => {
    const storage = new FaultStorage(); storage.mode = 'silent'; storage.failedKey = key;
    const h = completion(storage);
    assert.match(h.store.status(), /unsaved/); assert.equal(h.queued(), 0);
    assert.equal(h.store.book().games.length, 1);
    storage.mode = 'working'; h.store.retry(); h.finish();
    assert.equal(h.queued(), 1); assert.equal(loadPerformance(storage).games.length, 1);
    assert.equal(loadPendingArchives(storage).length, 1); assert.equal(h.store.status(), '');
  });
}
test('a saved rich queue restores a missing summary after reload', () => {
  const storage = new FaultStorage(); storage.mode = 'throwing'; storage.failedKey = PERFORMANCE_STORAGE_KEY;
  completion(storage); assert.equal(loadPerformance(storage).games.length, 0); assert.equal(loadPendingArchives(storage).length, 1);
  storage.mode = 'working'; const reload = createPerformancePersistence(storage); reload.retry();
  assert.equal(reload.book().games.length, 1); assert.equal(reload.pending().length, 1); assert.equal(reload.status(), '');
});
test('entirely blocked storage cannot survive reload and never pretends otherwise', () => {
  const storage = new FaultStorage(); storage.mode = 'throwing'; const h = completion(storage);
  assert.match(h.store.status(), /Closing or reloading can lose unsaved data/);
  const reload = createPerformancePersistence(storage); reload.retry(); assert.equal(reload.book().games.length, 0);
});
test('unreadable existing history or queue is untouched until repaired externally', () => {
  for (const key of [PERFORMANCE_STORAGE_KEY, PERFORMANCE_PENDING_ARCHIVE_KEY]) {
    const storage = new FaultStorage(); storage.values.set(key, '{unreadable');
    const h = completion(storage); assert.equal(storage.values.get(key), '{unreadable');
    assert.match(h.store.status(), /unsaved/); h.store.retry(); assert.equal(storage.values.get(key), '{unreadable');
    storage.values.delete(key); h.store.retry(); assert.equal(h.store.status(), '');
    assert.equal(loadPerformance(storage).games.length, 1); assert.equal(loadPendingArchives(storage).length, 1);
  }
});
test('quota failure never evicts pending games to hide failure and retry merges older records', () => {
  const storage = new FaultStorage(); const first = completion(storage, undefined, 'older');
  const before = storage.values.get(PERFORMANCE_PENDING_ARCHIVE_KEY);
  storage.mode = 'throwing'; const h = completion(storage, first.store, 'newer');
  assert.equal(storage.values.get(PERFORMANCE_PENDING_ARCHIVE_KEY), before);
  assert.match(h.store.status(), /unsaved/); storage.mode = 'working'; h.store.retry();
  assert.equal(loadPerformance(storage).games.length, 2); assert.equal(loadPendingArchives(storage).length, 2);
});
test('failed archive acknowledgement is not resubmitted in-page and removal can be retried', () => {
  const storage = new FaultStorage(), h = completion(storage);
  storage.mode = 'silent'; storage.failedKey = PERFORMANCE_PENDING_ARCHIVE_KEY;
  assert.equal(h.store.archived('game-1'), false); assert.equal(h.store.pending().length, 0);
  assert.equal(loadPendingArchives(storage).length, 1); assert.match(h.store.status(), /Reloading may retry that upload/);
  h.finish(); assert.equal(h.store.pending().length, 0);
  storage.mode = 'working'; h.store.retry(); assert.equal(loadPendingArchives(storage).length, 0);
  assert.equal(h.store.status(), '');
});
test('failed profile write retries the same identity and does not overwrite another saved profile', () => {
  const storage = new FaultStorage(); storage.mode = 'silent';
  const id = ensurePerformanceProfile(storage, () => '1234567890123456');
  assert.equal(retainPerformanceProfile(storage, id), false); assert.equal(storage.values.size, 0);
  storage.mode = 'working'; assert.equal(retainPerformanceProfile(storage, id), true);
  assert.equal(storage.getItem(PERFORMANCE_PROFILE_KEY), id);
  assert.equal(retainPerformanceProfile(storage, profileId), false);
  assert.equal(storage.getItem(PERFORMANCE_PROFILE_KEY), id);
});

test('summary failure followed by successful upload never re-enqueues the retained archive', () => {
  const storage = new FaultStorage(); storage.mode = 'throwing'; storage.failedKey = PERFORMANCE_STORAGE_KEY;
  const h = completion(storage); assert.equal(h.store.pending().length,1);
  assert.equal(h.store.archived('game-1'),true); assert.equal(h.store.pending().length,0);
  h.finish(); assert.equal(h.store.pending().length,0); assert.match(h.store.status(),/unsaved/);
  storage.mode='working'; h.store.retry(); h.finish();
  assert.equal(loadPerformance(storage).games.length,1); assert.equal(loadPendingArchives(storage).length,0);
  assert.equal(h.queued(),0); assert.equal(h.store.status(),'');
});
test('malformed nested history and queue entries never interrupt game completion or get overwritten', () => {
  for (const [key,raw] of [[PERFORMANCE_STORAGE_KEY,'{"version":2,"games":[null]}'], [PERFORMANCE_PENDING_ARCHIVE_KEY,'[{"profileId":"profile","game":{"id":"broken"}}]']] as const) {
    const storage=new FaultStorage(); storage.values.set(key,raw);
    assert.doesNotThrow(()=>completion(storage)); assert.equal(storage.values.get(key),raw);
  }
});

test('a uniquely identified saved queue recovers a missing profile key after reload', () => {
  const storage=new FaultStorage(); completion(storage);
  assert.equal(storage.getItem(PERFORMANCE_PROFILE_KEY),null);
  let created=0;
  const recovered=ensurePerformanceProfile(storage,()=>{created++;return 'another-profile-123456789';});
  assert.equal(recovered,profileId); assert.equal(created,0);
  assert.equal(storage.getItem(PERFORMANCE_PROFILE_KEY),profileId);
});

test('a retained summary need not be rewritten when only the archive queue recovers', () => {
  const storage=new FaultStorage(); storage.mode='throwing'; storage.failedKey=PERFORMANCE_PENDING_ARCHIVE_KEY;
  const h=completion(storage); assert.equal(loadPerformance(storage).games.length,1);
  storage.failedKey=PERFORMANCE_STORAGE_KEY; h.store.retry();
  assert.equal(loadPendingArchives(storage).length,1); assert.equal(h.store.status(),''); assert.equal(h.queued(),1);
});
