import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deck, effectiveSuit, nextSeat, partnerOf, RANKS, SUITS } from '../src/cards.ts';
import { initialState } from '../src/internal/deal.ts';
import { legalActions } from '../src/internal/legal.ts';
import { nextHand, transition } from '../src/internal/reducer.ts';
import { scoreHand } from '../src/internal/scoring.ts';
import { playableCards, trickWinner } from '../src/internal/tricks.ts';
import type { Card, Seat, Suit } from '../src/types.ts';
import { apply, assertConservation, finishHand, passRound, playing, seats } from './helpers.ts';

test('24-card deck: six required ranks in each suit, unique IDs', () => {
  assert.equal(deck().length, 24); assert.equal(new Set(deck()).size, 24);
  for (const suit of SUITS) assert.deepEqual(deck().filter(c => c.startsWith(suit)), RANKS.map(r => `${suit}:${r}`));
});
test('seeded deals reproduce full authoritative state with five cards per seat and four-card kitty', () => {
  for (const seed of [0, 1, 42, 0xffffffff]) {
    const a = initialState(seed); assert.deepEqual(a, initialState(seed));
    assert.deepEqual(a.hands.map(h => h.length), [5, 5, 5, 5]);
    assert.equal(a.kitty.length, 4); assert.equal(a.upCard, a.kitty[0]); assertConservation(a);
  }
  assert.notDeepEqual(initialState(1).hands, initialState(2).hands);
});
test('invalid seeds rejected, including fractional, negative and nonfinite values', () => {
  for (const seed of [-1, 1.5, NaN, Infinity, 0x100000000]) assert.throws(() => initialState(seed));
});
test('clockwise dealer rotation wraps and next hand resets bidding/history, retaining score', () => {
  for (const dealer of seats) {
    const ended = finishHand(initialState(2, dealer));
    const next = nextHand(ended);
    assert.equal(next.dealer, nextSeat(dealer)); assert.equal(next.turn, nextSeat(next.dealer));
    assert.equal(next.handNumber, 2); assert.deepEqual(next.score, ended.score);
    assert.equal(next.biddingRound, 1); assert.deepEqual(next.bids, []);
    assert.deepEqual(next.completedTricks, []); assert.equal(next.result, null); assertConservation(next);
  }
  assert.throws(() => nextHand(initialState(0)));
});
test('round-one bidding starts left of dealer and each seat can order up or pass', () => {
  let state = initialState(1);
  for (const seat of [1, 2, 3, 0] as Seat[]) {
    assert.equal(state.turn, seat);
    assert.deepEqual(legalActions(state, seat), [{ type: 'order-up', alone: false }, { type: 'order-up', alone: true }, { type: 'pass' }]);
    assert.equal(transition(state, seat, { type: 'call', suit: 'hearts', alone: false }), null);
    const called = apply(state, { type: 'order-up', alone: false });
    assert.equal(called.caller, seat); assert.equal(called.phase, 'discarding');
    state = apply(state, { type: 'pass' });
  }
  assert.equal(state.biddingRound, 2); assert.equal(state.turn, 1);
  assert.deepEqual(state.bids.map(b => b.seat), [1, 2, 3, 0]);
});
test('round two allows each other suit, excludes turned-down suit, and records exact bid', () => {
  const state = passRound();
  const excluded = state.upCard.split(':')[0];
  for (const suit of SUITS) {
    const action = { type: 'call' as const, suit, alone: false };
    if (suit === excluded) assert.equal(transition(state, state.turn!, action), null);
    else {
      const next = apply(state, action);
      assert.equal(next.phase, 'playing'); assert.equal(next.trump, suit);
      assert.deepEqual(next.bids.at(-1), { seat: 1, round: 2, action });
      assert.equal(next.kitty.length, 4); assertConservation(next);
    }
  }
  assert.equal(legalActions(state, 1).length, 7);
  assert.equal(transition(state, 1, { type: 'order-up', alone: false }), null);
});
test('stick dealer: three round-two passes force dealer to call', () => {
  let state = passRound();
  for (let i = 0; i < 3; i++) state = apply(state, { type: 'pass' });
  assert.equal(state.turn, state.dealer); assert.equal(state.bids.length, 7);
  assert.equal(legalActions(state, state.dealer).length, 6);
  assert.ok(legalActions(state, state.dealer).every(a => a.type === 'call'));
  assert.equal(transition(state, state.dealer, { type: 'pass' }), null);
});
test('dealer pickup removes upcard from kitty; discard restores five/four without duplication', () => {
  const initial = initialState(7);
  const pickup = apply(initial, { type: 'order-up', alone: false });
  assert.equal(pickup.turn, 0); assert.equal(pickup.hands[0]!.length, 6);
  assert.ok(pickup.hands[0]!.includes(initial.upCard)); assert.equal(pickup.kitty.length, 3); assertConservation(pickup);
  assert.equal(transition(pickup, 1, { type: 'discard', card: pickup.hands[1]![0]! }), null);
  for (const card of pickup.hands[0]!) {
    const discarded = apply(pickup, { type: 'discard', card });
    assert.equal(discarded.hands[0]!.length, 5); assert.equal(discarded.kitty.length, 4);
    assert.ok(discarded.kitty.includes(card)); assert.equal(discarded.turn, 1); assertConservation(discarded);
  }
});
const paired: Record<Suit, Suit> = { clubs: 'spades', spades: 'clubs', hearts: 'diamonds', diamonds: 'hearts' };
for (const trump of SUITS) {
  test(`${trump}: right bower beats left; left beats ace; all trump ranks resolve correctly`, () => {
    const order: Card[] = [`${trump}:J`, `${paired[trump]}:J`, `${trump}:A`, `${trump}:K`, `${trump}:Q`, `${trump}:10`, `${trump}:9`];
    for (let i = 0; i < order.length; i++) for (let j = i + 1; j < order.length; j++) {
      assert.equal(trickWinner([{ seat: 0, card: order[j]! }, { seat: 1, card: order[i]! }], trump), 1);
      assert.equal(trickWinner([{ seat: 0, card: order[i]! }, { seat: 1, card: order[j]! }], trump), 0);
    }
  });
  test(`${trump}: left bower effective suit applies to every deck card`, () => {
    for (const card of deck()) assert.equal(effectiveSuit(card, trump), card === `${paired[trump]}:J` ? trump : card.split(':')[0]);
  });
  test(`${trump}: left bower must follow trump; cannot follow its printed suit; a left-bower lead demands trump`, () => {
    const left: Card = `${paired[trump]}:J`;
    const printedAce: Card = `${paired[trump]}:A`;
    let state = playing([left, printedAce], `${trump}:9`, trump);
    assert.deepEqual(legalActions(state, 1), [{ type: 'play', card: left }]);
    assert.equal(transition(state, 1, { type: 'play', card: printedAce }), null);
    state = playing([left, printedAce], `${paired[trump]}:9`, trump);
    assert.deepEqual(legalActions(state, 1), [{ type: 'play', card: printedAce }]);
    assert.equal(transition(state, 1, { type: 'play', card: left }), null);
    state = playing([`${trump}:9`, printedAce], left, trump);
    assert.deepEqual(legalActions(state, 1), [{ type: 'play', card: `${trump}:9` }]);
    // Only the printed-suit jack does not constitute holding that printed suit.
    assert.deepEqual(playableCards([left, `${trump}:A`], [{ seat: 0, card: printedAce }], trump), [left, `${trump}:A`]);
  });
}
test('ordinary follow-suit is mandatory; legal off-suit play when void', () => {
  const state = playing(['clubs:A', 'spades:A'], 'clubs:9', 'hearts');
  assert.equal(transition(state, 1, { type: 'play', card: 'spades:A' }), null);
  assert.ok(transition(state, 1, { type: 'play', card: 'clubs:A' }));
  const voidState = playing(['spades:A', 'hearts:9'], 'clubs:9', 'hearts');
  for (const card of voidState.hands[1]!) assert.ok(transition(voidState, 1, { type: 'play', card }));
});
test('trick winner: highest led suit, off-suit ace loses, any trump beats led ace', () => {
  assert.equal(trickWinner([{ seat: 2, card: 'clubs:K' }, { seat: 3, card: 'spades:A' }, { seat: 0, card: 'clubs:A' }, { seat: 1, card: 'clubs:Q' }], 'hearts'), 0);
  assert.equal(trickWinner([{ seat: 2, card: 'clubs:A' }, { seat: 3, card: 'hearts:9' }, { seat: 0, card: 'clubs:K' }], 'hearts'), 3);
  assert.throws(() => trickWinner([], 'hearts'));
});
test('completed trick records ordered plays and winner leads next trick', () => {
  let state = apply(passRound(), { type: 'call', suit: SUITS.find(s => !passRound().upCard.startsWith(s))!, alone: false });
  for (let i = 0; i < 4; i++) state = apply(state, legalActions(state, state.turn!)[0]!);
  assert.equal(state.completedTricks.length, 1); assert.deepEqual(state.trick, []);
  const trick = state.completedTricks[0]!;
  assert.equal(state.turn, trick.winner); assert.equal(trick.winner, trickWinner(trick.plays, state.trump!));
  assert.deepEqual(trick.plays.map(p => p.seat), [1, 2, 3, 0]);
});
test('maker scoring: 3/4 = 1, march = 2, loner march = 4, euchre = 2 defenders', () => {
  for (const caller of seats) for (const alone of [false, true]) for (let tricks = 0; tricks <= 5; tricks++) {
    const result = scoreHand(caller, tricks, alone);
    assert.equal(result.team, tricks < 3 ? 1 - caller % 2 : caller % 2);
    assert.equal(result.points, tricks < 3 ? 2 : tricks < 5 ? 1 : alone ? 4 : 2);
    assert.equal(result.reason, tricks < 3 ? 'euchred' : tricks < 5 ? 'made' : alone ? 'loner-march' : 'march');
  }
});
test('maker loners: all dealer/caller combinations, both rounds, skip partner including opening lead', () => {
  for (const dealer of seats) for (const caller of seats) for (const round of [1, 2]) {
    let state = initialState(11, dealer);
    if (round === 2) state = passRound(state);
    while (state.turn !== caller) state = apply(state, { type: 'pass' });
    state = apply(state, round === 1 ? { type: 'order-up', alone: true } :
      { type: 'call', suit: SUITS.find(s => !state.upCard.startsWith(s))!, alone: true });
    if (state.phase === 'discarding') state = apply(state, legalActions(state, dealer)[0]!);
    assert.equal(state.turn, nextSeat(dealer, partnerOf(caller)));
    assert.deepEqual(legalActions(state, partnerOf(caller)), []);
    state = finishHand(state);
    assert.equal(state.hands[partnerOf(caller)]!.length, 5);
    assert.equal(state.completedTricks.length, 5);
    for (const trick of state.completedTricks) {
      assert.equal(trick.plays.length, 3); assert.ok(trick.plays.every(p => p.seat !== partnerOf(caller)));
    }
    assertConservation(state);
  }
});
test('no defensive loner action and no changing alone status during play', () => {
  const state = apply(passRound(), { type: 'call', suit: SUITS.find(s => !passRound().upCard.startsWith(s))!, alone: false });
  for (const seat of seats) assert.equal(transition(state, seat, { type: 'go-alone' }), null);
});
test('scores awarded exactly once after fifth trick; target 10 and overshoot terminate', () => {
  for (const initialScore of [8, 9]) {
    let state = initialState(12);
    state.score = [initialScore, initialScore];
    state = finishHand(state);
    const result = state.result!;
    assert.equal(state.score[result.team], initialScore + result.points);
    if (state.score[result.team] >= 10) {
      assert.equal(state.phase, 'game-over'); assert.equal(state.winner, result.team);
      assert.throws(() => nextHand(state));
    } else assert.equal(state.phase, 'hand-over');
    for (const seat of seats) assert.deepEqual(legalActions(state, seat), []);
    assert.equal(transition(state, 0, { type: 'play', card: 'clubs:A' }), null);
  }
});

test('fifth-trick integration awards every scoring outcome to either team and terminates exactly at or beyond ten', () => {
  // Focused pre-final-play fixtures isolate transition/scoring wiring; full-game
  // tests separately verify that all histories and card zones are reachable.
  for (const caller of [0, 1] as Seat[]) for (const alone of [false, true]) {
    for (let makerTricks = 0; makerTricks <= 5; makerTricks++) for (const prior of [0, 9]) {
      const finalMakerWin = makerTricks > 0;
      const finalWinner = (finalMakerWin ? caller : 1 - caller) as Seat;
      const state = initialState(1);
      state.phase = 'playing'; state.trump = 'hearts'; state.caller = caller;
      state.alone = alone; state.sittingOut = alone ? partnerOf(caller) : null;
      state.score = [prior, prior];
      const order = seats.filter(s => s !== state.sittingOut);
      // Put the winning seat last with the right bower, all earlier plays lower trump.
      const playOrder = [...order.filter(s => s !== finalWinner), finalWinner];
      state.turn = finalWinner;
      state.hands[finalWinner] = ['hearts:J'];
      const low: Card[] = ['hearts:9', 'hearts:10', 'hearts:Q'];
      state.trick = playOrder.slice(0, -1).map((seat, i) => ({ seat, card: low[i]! }));
      const earlierMakerWins = makerTricks - Number(finalMakerWin);
      state.completedTricks = Array.from({ length: 4 }, (_, i) => ({ plays: [], winner: (i < earlierMakerWins ? caller : 1 - caller) as Seat }));
      const result = apply(state, { type: 'play', card: 'hearts:J' });
      const awardedTeam = makerTricks < 3 ? 1 - caller % 2 : caller % 2;
      const points = makerTricks < 3 ? 2 : makerTricks < 5 ? 1 : alone ? 4 : 2;
      assert.equal(result.score[awardedTeam], prior + points);
      assert.equal(result.score[1 - awardedTeam], prior);
      assert.equal(result.result!.makerTricks, makerTricks);
      assert.equal(result.phase, prior === 9 ? 'game-over' : 'hand-over');
      assert.equal(result.winner, prior === 9 ? awardedTeam : null);
      if (prior === 9) assert.throws(() => nextHand(result));
    }
  }
});
