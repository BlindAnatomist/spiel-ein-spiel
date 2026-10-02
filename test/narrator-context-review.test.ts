import test from 'node:test';
import assert from 'node:assert/strict';
import { reactionFor, reactionLines } from '../web/narrator-reactions.ts';
import { createSession } from '../web/session.ts';
import { effectiveSuit, rankOf, suitOf } from '../src/index.ts';
import type { Card, PlayerView, Seat, Suit } from '../src/index.ts';
const base = createSession(17, 'strong', {dealer:3}).view();
const suits: Suit[] = ['clubs', 'diamonds', 'hearts', 'spades'];
const cards: Card[] = suits.flatMap(suit => ['9','10','J','Q','K','A'].map(rank => `${suit}:${rank}` as Card));
const keys = (before: PlayerView, after: PlayerView, seat: Seat, card: Card) => reactionFor(before, after, seat, {type:'play',card})?.alternatives?.map(line => line.clip) ?? [];
test('review: all play reactions depend only on actual public card, actor, trump and led suit', () => {
  let cases = 0;
  for (const trump of suits) for (const card of cards) for (const actor of [0,1,2,3] as const) for (const led of [null,...cards]) {
    const before: PlayerView = {...base,phase:'playing',trump,turn:actor,trick:led ? [{seat:2,card:led}] : []};
    const after: PlayerView = {...before,trick:[...before.trick,{seat:actor,card}]};
    const expected: string[] = [], suit = effectiveSuit(card,trump), rank = rankOf(card);
    if (actor === 0) {
      if (suit === trump) expected.push(rank === 'J' ? 'reaction.you.bower' : 'reaction.you.trump');
      else if (!led && ['9','10'].includes(rank)) expected.push('reaction.you.low-lead');
      else if (led && suit === effectiveSuit(led,trump)) expected.push('reaction.you.follow-suit');
    } else if (actor === 1 || actor === 3) {
      if (rank === 'J' && suitOf(card) === trump) expected.push('reaction.opponent.right-bower');
      else if (!led && rank === 'A') expected.push('reaction.opponent.ace-lead');
      else if (!led && suit !== trump && ['9','10'].includes(rank)) expected.push('reaction.opponent.low-lead');
    }
    assert.deepEqual(keys(before,after,actor,card),expected);
    assert.deepEqual(keys({...before,hand:['spades:A'],legalActions:[]},{...after,hand:['diamonds:9','clubs:10'],legalActions:[]},actor,card),expected);
    cases++;
  }
  assert.equal(cases,9600);
});
test('review: outcome reactions preserve both opposing seats and fourth-trick context', () => {
  const before: PlayerView = {...base,phase:'playing',trump:'hearts',completedTricks:Array.from({length:3},()=>({winner:0,plays:[]}))};
  for (const winner of [0,1,2,3] as const) {
    const after: PlayerView = {...before,completedTricks:[...before.completedTricks,{winner,plays:[]}]};
    const alternatives=reactionFor(before,after,2,{type:'play',card:'clubs:Q'})!.alternatives!;
    assert.deepEqual(alternatives.map(line=>line.clip),[winner===0?'reaction.you.trick':winner===2?'reaction.val.trick':'reaction.opponent.trick','reaction.table.four-tricks']);
    assert.equal(alternatives[0]!.priority,alternatives[1]!.priority);
  }
});
test('review: final scripts avoid inferred intent, share related joke cooldowns, and omit discards', () => {
  assert.equal(Object.keys(reactionLines).length,12);
  assert.equal(reactionLines['reaction.opponent.low-lead']!.text,'Oh, a little one. Budget cuts hit the cards, too.');
  assert.equal(reactionLines['reaction.you.trick']!.family,'undeserved-credit');
  assert.doesNotMatch(JSON.stringify(reactionLines),/sneaky/i);
  for (const actor of [0,1,2,3] as const) assert.equal(reactionFor(base,base,actor,{type:'discard',card:'spades:A'}),undefined);
});
