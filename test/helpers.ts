import assert from 'node:assert/strict';
import { deck } from '../src/cards.ts';
import type { Action, Card, Seat, Suit } from '../src/types.ts';
import { initialState } from '../src/internal/deal.ts';
import { legalActions } from '../src/internal/legal.ts';
import { transition } from '../src/internal/reducer.ts';
import type { State } from '../src/internal/state.ts';
export const seats: Seat[] = [0, 1, 2, 3];
export function apply(state: State, action: Action, seat: Seat = state.turn!): State {
  const next = transition(state, seat, action);
  assert.ok(next, `Expected legal action ${JSON.stringify(action)} at ${state.phase}`);
  return next;
}
export function passRound(state = initialState(42)): State {
  for (let i = 0; i < 4; i++) state = apply(state, { type: 'pass' });
  return state;
}
export function finishHand(state: State): State {
  while (state.phase !== 'hand-over' && state.phase !== 'game-over') {
    state = apply(state, legalActions(state, state.turn!)[0]!);
  }
  return state;
}
/** Focused trick fixture. Remaining cards are irrelevant to this single-trick assertion. */
export function playing(hand: Card[], lead: Card, trump: Suit): State {
  const state = initialState(42);
  state.phase = 'playing'; state.trump = trump; state.caller = 0;
  state.turn = 1; state.hands[1] = hand; state.trick = [{ seat: 0, card: lead }];
  return state;
}
export function assertConservation(state: State): void {
  const cards = [...state.hands.flat(), ...state.kitty, ...state.trick.map(p => p.card),
    ...state.completedTricks.flatMap(t => t.plays.map(p => p.card))];
  assert.equal(cards.length, 24);
  assert.deepEqual([...cards].sort(), deck().sort());
}
