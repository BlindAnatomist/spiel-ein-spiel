import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as publicAPI from '@spiel-ein-spiel/euchre';
import { createReferee } from '@spiel-ein-spiel/euchre/referee';
import { initialState } from '../src/internal/deal.ts';
import { legalActions } from '../src/internal/legal.ts';
import { playerView } from '../src/internal/view.ts';
import type { State } from '../src/internal/state.ts';
import type { Action, Card } from '../src/types.ts';
import { apply, playing, seats } from './helpers.ts';
function cardsIn(value: unknown): Card[] {
  if (typeof value === 'string' && publicAPI.deck().includes(value as Card)) return [value as Card];
  if (value && typeof value === 'object') return Object.values(value).flatMap(cardsIn);
  return [];
}
function assertBoundary(state: State): void {
  for (const seat of seats) {
    const view = playerView(state, seat);
    assert.deepEqual(view.hand, state.hands[seat]);
    const allowed = new Set([state.upCard, ...state.hands[seat]!, ...state.trick.map(p => p.card),
      ...state.completedTricks.flatMap(t => t.plays.map(p => p.card))]);
    for (const card of cardsIn(view)) assert.ok(allowed.has(card), `Seat ${seat} leaked ${card}`);
    for (const other of seats.filter(s => s !== seat)) for (const card of state.hands[other]!) {
      // Ordered upcard identity was public before entering the dealer's hand.
      if (card !== state.upCard) assert.ok(!cardsIn(view).includes(card));
    }
    assert.ok(!('rng' in view)); assert.ok(!('kitty' in view)); assert.ok(!('hands' in view));
  }
}
test('every seat sees its own full hand and no other private cards in every phase, including loner hands', () => {
  for (const alone of [false, true]) {
    let state = initialState(37);
    assertBoundary(state);
    state = apply(state, { type: 'order-up', alone });
    assertBoundary(state);
    while (state.phase !== 'hand-over') {
      state = apply(state, legalActions(state, state.turn!)[0]!); assertBoundary(state);
    }
  }
});
test('discard identity stays private; historical upcard does not reveal its current location', () => {
  const pickup = apply(initialState(1), { type: 'order-up', alone: false });
  const discard = pickup.hands[0]!.find(c => c !== pickup.upCard)!;
  const state = apply(pickup, { type: 'discard', card: discard });
  for (const seat of seats) assert.ok(!cardsIn(playerView(state, seat)).includes(discard));
  assertBoundary(state);
  const buriedUpcard = apply(pickup, { type: 'discard', card: pickup.upCard });
  const publicBefore = playerView(state, 1); const publicAfter = playerView(buriedUpcard, 1);
  assert.deepEqual(publicBefore, publicAfter);
});
test('noninterference: changing opponents hidden cards, kitty and RNG cannot change a seat view', () => {
  for (const seat of seats) {
    const state = initialState(23); const altered = structuredClone(state);
    const other = ((seat + 1) % 4);
    [altered.hands[other]![0], altered.kitty[1]] = [altered.kitty[1]!, altered.hands[other]![0]!];
    altered.rng = 999;
    assert.deepEqual(playerView(state, seat), playerView(altered, seat));
  }
});
test('view contains illegal cards in stable hand order and lists only legal choices', () => {
  const state = playing(['spades:A', 'clubs:9', 'clubs:A'], 'clubs:K', 'hearts');
  const view = playerView(state, 1);
  assert.deepEqual(view.hand, ['spades:A', 'clubs:9', 'clubs:A']);
  assert.deepEqual(view.legalActions, [{ type: 'play', card: 'clubs:9' }, { type: 'play', card: 'clubs:A' }]);
  assert.equal(view.turn, 1);
});
test('void knowledge derives only from public plays and uses effective suit', () => {
  const state = playing(['clubs:A'], 'diamonds:J', 'hearts');
  assert.deepEqual(playerView(state, 0).knownVoids, [[], [], [], []]);
  const played = apply(state, { type: 'play', card: 'clubs:A' });
  assert.deepEqual(playerView(played, 0).knownVoids, [[], ['hearts'], [], []]);
});
test('seat-bound ports cannot select another view or act as another seat', () => {
  const referee = createReferee({ seed: 5 }); const port = referee.player(2);
  assert.deepEqual(Reflect.ownKeys(port).sort(), ['act', 'view']);
  const attemptedView = (port.view as (...args: unknown[]) => unknown)(0);
  assert.deepEqual(attemptedView, port.view());
  const before = referee.snapshot();
  assert.equal(port.act({ type: 'order-up', alone: false }).ok, false);
  assert.equal(port.act({ type: 'order-up', alone: false, seat: 1 }).ok, false);
  assert.deepEqual(referee.snapshot(), before);
  assert.equal(JSON.stringify(port), '{}'); assert.ok(Object.isFrozen(port));
});
test('public engine exports no authoritative state accessor; internal package paths blocked', async () => {
  assert.deepEqual(Object.keys(publicAPI).sort(), ['RANKS', 'SUITS', 'deck', 'effectiveSuit', 'partnerOf', 'rankOf', 'suitOf', 'teamOf'].sort());
  for (const suffix of ['internal/state', 'internal/deal', 'internal/view', 'src/referee.ts']) {
    await assert.rejects(import(`@spiel-ein-spiel/euchre/${suffix}`), { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' });
  }
});
test('views, accepted/rejected action results and diagnostics have no mutable state aliases', () => {
  const referee = createReferee({ seed: 5 }); const player = referee.player(1);
  const old = player.view(); const before = referee.snapshot();
  assert.throws(() => (old.hand as Card[]).push('clubs:A'));
  assert.throws(() => (old.legalActions as Action[]).splice(0));
  assert.throws(() => { referee.snapshot().hands[0]![0] = 'clubs:A'; });
  assert.deepEqual(referee.snapshot(), before);
  const accepted = player.act({ type: 'order-up', alone: false }); assert.ok(accepted.ok);
  assert.throws(() => { (accepted.view.bids[0]!.action as { alone: boolean }).alone = true; });
  const rejected = player.act({ type: 'pass' }); assert.equal(rejected.ok, false);
  assert.throws(() => (rejected.view.score as unknown as number[]).push(100));
  assert.equal(old.phase, 'bidding'); assert.equal(player.view().phase, 'discarding');
});
test('runtime rejects malformed/unknown actions and private-card probes without state changes', () => {
  const referee = createReferee({ seed: 4 }); const player = referee.player(1);
  const before = referee.snapshot();
  const bad: unknown[] = [null, undefined, 42, {}, [], { type: 'order-up' }, { type: 'order-up', alone: 'true' },
    { type: 'call', suit: 'junk', alone: false }, { type: 'next-hand' },
    { type: 'order-up', alone: false, hidden: 1 }, { type: 'play', card: before.hands[0]![0] }];
  let getterCalled = false;
  bad.push({ get type() { getterCalled = true; return 'pass'; } });
  for (const input of bad) {
    const result = player.act(input);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error, 'illegal-action');
    assert.deepEqual(referee.snapshot(), before);
  }
  assert.equal(getterCalled, false);
  for (const seat of [-1, 4, 1.2, NaN]) assert.throws(() => referee.player(seat as 0));
});
test('proxy reentry cannot inject a second action during validation', () => {
  const referee = createReferee({ seed: 4 }); const player = referee.player(1);
  const input = new Proxy({ type: 'pass' }, { ownKeys(target) {
    assert.equal(player.act({ type: 'order-up', alone: false }).ok, false);
    return Reflect.ownKeys(target);
  } });
  assert.ok(player.act(input).ok);
  assert.equal(referee.snapshot().bids.length, 1);
});

test('round-two bidding and terminal views preserve the same hidden-card boundary', () => {
  let state = initialState(42); state.score = [9, 9];
  for (let i = 0; i < 7; i++) { state = apply(state, { type: 'pass' }); assertBoundary(state); }
  state = apply(state, legalActions(state, state.turn!)[0]!);
  while (state.phase !== 'game-over') { assertBoundary(state); state = apply(state, legalActions(state, state.turn!)[0]!); }
  assertBoundary(state);
});
