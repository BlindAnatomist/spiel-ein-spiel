import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createController } from '../web/controller.ts';
import { createSession } from '../web/session.ts';
import { createTable } from '../web/render.ts';
import { createBot } from '../src/bots/index.ts';
import { cardName } from '../web/presentation.ts';
import type { Seat } from '../src/index.ts';
import type { NarrationMessage, NarrationOutput, PlaybackResult } from '../web/narration-types.ts';
const flush = () => new Promise<void>(resolve => setImmediate(resolve));
const policy = createBot('strong');
function fixture(seed = 17, dealer: Seat = 3) {
  const dom = new JSDOM('<button id="pause">Pause game</button><main></main>');
  const d = dom.window.document, root = d.querySelector<HTMLElement>('main')!;
  const session = createSession(seed, 'strong', { dealer });
  let controller: ReturnType<typeof createController>;
  const table = createTable(root, { act: action => { void controller.act(action); }, next: () => { void controller.next(); } });
  const focusedIds: string[] = [];
  d.addEventListener('focusin', event => focusedIds.push((event.target as HTMLElement).id));
  let held = false;
  const releases: Array<(value: PlaybackResult) => void> = [];
  const output: NarrationOutput = {
    enabled: () => true,
    play: async (_message: NarrationMessage): Promise<PlaybackResult> => held
      ? new Promise<PlaybackResult>(resolve => releases.push(resolve)) : 'ended',
    cancel: () => { for (const resolve of releases.splice(0)) resolve('cancelled'); },
  };
  controller = createController(session, table, () => {}, async () => {}, () => {}, undefined, 'voiceover', output);
  return { dom, d, root, session, table, controller, focusedIds,
    hold: () => { held = true; },
    release: () => { held = false; for (const resolve of releases.splice(0)) resolve('ended'); },
  };
}
type Fixture = ReturnType<typeof fixture>;
async function reachPlay(h: Fixture) {
  await h.controller.start();
  for (let count = 0; count < 30 && h.session.view().phase !== 'playing'; count++) await h.controller.act(policy(h.session.view()));
  assert.equal(h.session.view().phase, 'playing');
  assert.equal(h.session.view().turn, 0);
}
function chooseCard(h: Fixture) {
  const view = h.session.view(), action = policy(view);
  assert.equal(action.type, 'play');
  if (action.type !== 'play') throw Error('Expected a play');
  const card = [...h.root.querySelectorAll<HTMLButtonElement>('#hand button')]
    .find(button => button.getAttribute('aria-label')?.startsWith(cardName(action.card, view.trump)));
  assert.ok(card);
  return { action, card };
}
test('review: activated card survives speech and retires after real legal focus transfer', async () => {
  const h = fixture(); await reachPlay(h); const { action, card } = chooseCard(h);
  card.focus(); const count = h.focusedIds.length; h.hold(); const pending = h.controller.act(action); await flush();
  assert.equal(card.isConnected, true); assert.equal(h.d.activeElement, card);
  assert.ok(h.focusedIds.slice(count).every(id => id !== 'turn'));
  h.release(); await pending; assert.equal(card.isConnected, false);
  assert.equal(h.root.querySelectorAll('#hand button').length, h.session.view().hand.length);
  assert.notEqual(h.d.activeElement, h.d.body); h.controller.stop();
});
test('review: native activation identity is retained even when DOM focus stayed elsewhere', async () => {
  const h = fixture(); await h.controller.start(); const buttons = [...h.root.querySelectorAll<HTMLButtonElement>('#bids button')];
  assert.ok(buttons.length > 1); assert.equal(h.d.activeElement, buttons[0]);
  h.hold(); buttons[1]!.click(); await flush();
  try { assert.equal(buttons[1]!.isConnected, true, 'Do not infer activation identity only from activeElement'); }
  finally { h.controller.pause(); h.release(); await flush(); }
  await h.controller.resume(); assert.notEqual(h.d.activeElement, h.d.body);
  assert.equal(buttons[1]!.isConnected, false); h.controller.stop();
});
test('review: paused retirement cleans up without overriding an explicit focus move', async () => {
  const h = fixture(73, 2); await reachPlay(h); const { action, card } = chooseCard(h);
  card.focus(); h.hold(); const pending = h.controller.act(action); await flush(); h.controller.pause(); await pending;
  assert.equal(card.isConnected, true);
  const pause = h.d.querySelector<HTMLButtonElement>('#pause')!; pause.focus(); h.release(); await h.controller.resume();
  assert.equal(h.d.activeElement, pause);
  assert.equal(h.root.querySelectorAll('#hand button').length, h.session.view().hand.length); h.controller.stop();
});
test('review: Next remains exposed through narration and never focuses a progress heading', async () => {
  const h = fixture(); await h.controller.start();
  for (let count = 0; count < 100 && h.session.view().phase !== 'hand-over'; count++) await h.controller.act(policy(h.session.view()));
  assert.equal(h.session.view().phase, 'hand-over');
  const next = h.root.querySelector<HTMLButtonElement>('#next')!; next.focus(); const count = h.focusedIds.length;
  h.hold(); const pending = h.controller.next(); await flush();
  assert.equal(next.hidden, false); assert.equal(h.d.activeElement, next);
  assert.ok(h.focusedIds.slice(count).every(id => id !== 'turn'));
  h.release(); await pending; assert.equal(next.hidden, true); assert.notEqual(h.d.activeElement, h.d.body); h.controller.stop();
});
test('review: first bid description does not change into a busy utterance', async () => {
  const h = fixture(); await h.controller.start(); const bid = h.root.querySelector<HTMLButtonElement>('#bids button')!;
  const before = h.root.querySelector('#turn')!.textContent;
  const action = h.session.view().legalActions.find(candidate => candidate.type === 'order-up'); assert.ok(action);
  bid.focus(); h.hold(); const pending = h.controller.act(action); await flush();
  assert.equal(h.root.querySelector('#turn')!.textContent, before);
  h.release(); await pending; h.controller.stop();
});
