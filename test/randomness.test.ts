import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createBot } from '../src/bots/index.ts';
import { deal } from '../src/internal/deal.ts';
import type { PlayerView } from '../src/index.ts';
import { createSession, type Session } from '../web/session.ts';
import { createTable } from '../web/render.ts';
import { createController } from '../web/controller.ts';
import { dealerAnnouncement } from '../web/presentation.ts';

function finishHand(session: Session): void {
  const human = createBot('strong');
  for (let step = 0; step < 200; step++) {
    const view = session.view();
    if (view.phase === 'hand-over') return;
    assert.notEqual(view.phase, 'game-over');
    if (view.turn === 0) assert.ok(session.human(human(view)));
    else assert.ok(session.bot());
  }
  assert.fail('Hand did not complete');
}

test('deterministic deal remains reproducible when no live random source is supplied', () => {
  const a = deal(123456, 2, [0, 0], 1);
  const b = deal(123456, 2, [0, 0], 1);
  assert.deepEqual(a, b);
});

test('live random source drives every Fisher-Yates draw without changing deterministic mode', () => {
  let calls = 0;
  const live = deal(123456, 0, [0, 0], 1, () => { calls++; return 72; });
  const seeded = deal(123456, 0, [0, 0], 1);
  assert.equal(calls, 23);
  assert.notDeepEqual(live.hands, seeded.hands);
  assert.notDeepEqual(live.kitty, seeded.kitty);
});

test('configured starting dealer rotates normally and live random source is reused next hand', () => {
  let word = 0x12345678;
  let calls = 0;
  const randomWord = () => {
    calls++;
    word = (Math.imul(word, 1103515245) + 12345) >>> 0;
    return word;
  };
  const session = createSession(99, 'strong', { dealer: 3, randomWord });
  assert.equal(session.view().dealer, 3);
  assert.equal(session.view().turn, 0);
  const firstHandCalls = calls;
  assert.ok(firstHandCalls >= 23);
  finishHand(session);
  session.nextHand();
  assert.equal(session.view().dealer, 0);
  assert.equal(session.view().turn, 1);
  assert.ok(calls >= firstHandCalls + 23);
});

test('dealer announcement is concise and uses correct grammar', () => {
  assert.deepEqual([0, 1, 2, 3].map(seat => dealerAnnouncement(seat as 0 | 1 | 2 | 3)),
    ['You deal.', 'West deals.', 'Val deals.', 'East deals.']);
});

test('controller announces dealer once at each hand start and not on ordinary rerenders', async () => {
  let view: PlayerView = { ...createSession(1, 'strong').view(), dealer: 0, turn: 0 };
  const session: Session = {
    view: () => view,
    human: () => null,
    bot: () => null,
    nextHand: () => {
      view = { ...view, handNumber: view.handNumber + 1, dealer: 1, turn: 0, phase: 'bidding',
        biddingRound: 1, bids: [], trump: null, caller: null, result: null };
      return view;
    },
  };
  const dom = new JSDOM('<main></main>');
  const root = dom.window.document.querySelector('main')!;
  const table = createTable(root, { act: () => {}, next: () => {} });
  const speech: string[] = [];
  const controller = createController(session, table, text => speech.push(text), async () => {});
  await controller.start();
  assert.deepEqual(speech, ['You deal.', '']);
  await controller.start();
  assert.deepEqual(speech, ['You deal.', '']);
  view = { ...view, phase: 'hand-over', turn: null };
  await controller.next();
  assert.deepEqual(speech, ['You deal.', '', 'West deals.', '']);
  dom.window.close();
});
