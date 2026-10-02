import test from 'node:test';
import assert from 'node:assert/strict';
import { publicReactionTriggers } from '../web/narrator-reaction-triggers.ts';
import { createSession } from '../web/session.ts';
import type { Action, Bid, PlayerView, Seat } from '../src/index.ts';

const base: PlayerView = { ...createSession(17, 'strong').view(), phase: 'playing', trump: 'hearts', result: null, winner: null, completedTricks: [] };
const play = (card: 'hearts:J' | 'diamonds:J' | 'clubs:J' | 'hearts:Q' | 'clubs:Q' | 'clubs:A'): Action => ({ type: 'play', card });
test('new played-card contexts distinguish both bowers and ordinary trump for every seat', () => {
  for (const actor of [0, 1, 2, 3] as const) {
    const left = publicReactionTriggers(base, base, actor, play('diamonds:J'));
    assert.ok(left.includes('reaction.table.left-bower'));
    assert.equal(left.includes('reaction.val.bower'), actor === 2);
    assert.equal(left.includes('reaction.you.bower'), actor === 0);
    assert.equal(left.includes('reaction.opponent.right-bower'), false);
    const right = publicReactionTriggers(base, base, actor, play('hearts:J'));
    assert.equal(right.includes('reaction.table.left-bower'), false);
    assert.equal(right.includes('reaction.opponent.right-bower'), actor === 1 || actor === 3);
    assert.equal(publicReactionTriggers(base, base, actor, play('clubs:J')).includes('reaction.table.left-bower'), false);
    const ordinary = publicReactionTriggers(base, base, actor, play('hearts:Q'));
    assert.equal(ordinary.includes('reaction.val.trump'), actor === 2);
    assert.equal(ordinary.includes('reaction.val.bower'), false);
    assert.equal(ordinary.includes('reaction.you.queen'), actor === 0);
  }
});
test('alone contexts are seat-specific and do not claim any outcome', () => {
  for (const actor of [0, 1, 2, 3] as const) for (const type of ['call', 'order-up'] as const) for (const alone of [true, false]) {
    const action: Action = type === 'call' ? { type, alone, suit: 'hearts' } : { type, alone };
    const keys = publicReactionTriggers(base, base, actor, action);
    assert.deepEqual(keys, alone ? [actor === 0 ? 'reaction.you.alone' : actor === 2 ? 'reaction.val.alone' : 'reaction.opponent.alone'] : []);
  }
});
test('turned-down context requires exactly the newly completed four-seat first-round pass sequence', () => {
  const bids: Bid[] = ([0, 1, 2, 3] as const).map(seat => ({ seat, round: 1, action: { type: 'pass' } }));
  const before: PlayerView = { ...base, phase: 'bidding', biddingRound: 1, upCardStatus: 'face-up', bids: bids.slice(0, 3) };
  const after: PlayerView = { ...before, phase: 'bidding', biddingRound: 2, upCardStatus: 'turned-down', bids };
  const has = (b: PlayerView, a: PlayerView, actor: Seat = 3) => publicReactionTriggers(b, a, actor, { type: 'pass' }).includes('reaction.table.turned-down');
  assert.equal(has(before, after), true);
  assert.equal(has(after, after), false);
  assert.equal(has(before, after, 2), false);
  assert.equal(has(before, { ...after, handNumber: after.handNumber + 1 }), false);
  assert.equal(has(before, { ...after, bids: bids.slice(0, 3) }), false);
  assert.equal(has(before, { ...after, bids: bids.map(b => ({ ...b, seat: 0 })) }), false);
  assert.equal(has(before, { ...after, bids: bids.map(b => ({ ...b, round: 2 })) }), false);
  assert.equal(has(before, { ...after, bids: [...bids.slice(0, 3), { seat: 3, round: 1, action: { type: 'order-up', alone: false } }] }), false);
});
test('euchre and game result contexts use newly confirmed public scoring recipient and caller', () => {
  const tricks = Array.from({ length: 5 }, () => ({ winner: 0 as Seat, plays: [] }));
  for (const caller of [0, 1, 2, 3] as const) for (const team of [0, 1] as const) for (const reason of ['made', 'march', 'loner-march', 'euchred'] as const) {
    const after: PlayerView = { ...base, phase: 'hand-over', caller, result: { team, reason, points: 2, makerTricks: 2 }, completedTricks: tricks };
    const keys = publicReactionTriggers(base, after, 3, play('clubs:Q'));
    assert.equal(keys.includes('reaction.you-team.euchred'), reason === 'euchred' && team === 1 && caller % 2 === 0);
    assert.equal(keys.includes('reaction.you-team.euchres-opponents'), reason === 'euchred' && team === 0 && caller % 2 === 1);
    for (const winner of [0, 1] as const) {
      const end: PlayerView = { ...after, phase: 'game-over', winner };
      const last = publicReactionTriggers(base, end, 3, play('clubs:Q'));
      assert.equal(last.includes('reaction.you-team.game-win'), winner === 0);
      assert.equal(last.includes('reaction.opponent.game-win'), winner === 1);
      assert.deepEqual(publicReactionTriggers(end, end, 3, { type: 'pass' }), []);
    }
    assert.ok(!keys.includes('reaction.you-team.game-win') && !keys.includes('reaction.opponent.game-win'));
  }
});
