import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createReferee } from '../src/referee.ts';
import { assertConservation, seats } from './helpers.ts';

test('full-game replay: identical actions reproduce authoritative state after every action and redeal', () => {
  for (let seed = 0; seed < 24; seed++) {
    const a = createReferee({ seed }); const b = createReferee({ seed });
    let steps = 0;
    while (a.snapshot().phase !== 'game-over') {
      assert.ok(++steps < 1000, 'Game must terminate');
      const state = a.snapshot();
      if (state.phase === 'hand-over') { a.nextHand(); b.nextHand(); }
      else {
        const port = a.player(state.turn!); const choices = port.view().legalActions;
        // Deterministic test driver, not a strategic bot. Exercises passes and loners.
        const action = choices[(seed + steps * 7) % choices.length]!;
        assert.ok(port.act(action).ok); assert.ok(b.player(state.turn!).act(action).ok);
      }
      assert.deepEqual(a.snapshot(), b.snapshot()); assertConservation(a.snapshot());
      for (const seat of seats) assert.deepEqual(a.player(seat).view(), b.player(seat).view());
    }
    assert.ok(a.snapshot().score.some(s => s >= 10));
    assert.throws(() => a.nextHand());
    for (const seat of seats) {
      assert.deepEqual(a.player(seat).view().legalActions, []);
      assert.equal(a.player(seat).act({ type: 'pass' }).ok, false);
    }
  }
});
test('no dependency on Math.random or Date.now during construction, actions or redeals', () => {
  const random = Math.random; const now = Date.now;
  try {
    Math.random = () => { throw new Error('Uncontrolled randomness'); };
    Date.now = () => { throw new Error('Clock dependency'); };
    const referee = createReferee({ seed: 73 });
    while (referee.snapshot().phase !== 'game-over') {
      const state = referee.snapshot();
      if (state.phase === 'hand-over') referee.nextHand();
      else {
        const port = referee.player(state.turn!); assert.ok(port.act(port.view().legalActions[0]).ok);
      }
    }
  } finally { Math.random = random; Date.now = now; }
});
test('invalid actions and view reads do not consume randomness or change replay state', () => {
  const referee = createReferee({ seed: 0 }); const before = referee.snapshot();
  for (const seat of seats) {
    referee.player(seat).view(); referee.player(seat).act({ type: 'impossible' });
  }
  assert.deepEqual(referee.snapshot(), before);
});

test('seed 42 deal is pinned to the version-one reproducibility vector', () => {
  const state = createReferee({ seed: 42 }).snapshot();
  assert.equal(state.rng, 2362599119);
  assert.deepEqual(state.hands, [
    ['hearts:K', 'clubs:10', 'spades:10', 'hearts:10', 'diamonds:10'],
    ['clubs:Q', 'spades:J', 'spades:9', 'spades:A', 'spades:K'],
    ['hearts:Q', 'diamonds:K', 'clubs:A', 'diamonds:A', 'diamonds:J'],
    ['hearts:A', 'spades:Q', 'diamonds:Q', 'hearts:J', 'clubs:9'],
  ]);
  assert.deepEqual(state.kitty, ['clubs:K', 'hearts:9', 'clubs:J', 'diamonds:9']);
});
