import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import { createNarratorFlavorHistory } from '../web/narrator-flavor.ts';
import { loadNarratorHistory } from '../web/narrator-history-storage.ts';
import { PERFORMANCE_PROFILE_KEY, PERFORMANCE_STORAGE_KEY } from '../web/performance.ts';

const historyKey = 'narrator-dialogue-history-v1';
const profile = 'EUC-01234567-89abcdef-01234567-89abcdef';
const line = { clip: 'reaction.you.trump.doing-this', text: "Oh, we're doin' this now? Hell yeah.", family: 'impulsive-approval' };
function initialHistory() {
  let raw = '';
  const history = createNarratorFlavorHistory(() => 0, { load: () => raw || null, save: value => { raw = value; } });
  history.beginGame(); history.beginHand(1); history.used(line);
  return raw;
}
async function application(context: string, values: Record<string, string>, blocked = false) {
  const compiled = await build({ entryPoints: ['web/main.ts'], bundle: true, write: false, format: 'esm', target: 'safari16',
    define: { __BUILD_COMMIT__: JSON.stringify('production-history-test'), __DEPLOY_CONTEXT__: JSON.stringify(context), __NARRATOR_ASSETS_READY__: 'true' } });
  const dom = new JSDOM(readFileSync('web/index.html', 'utf8'), { runScripts: 'outside-only', url: 'https://game.example/' });
  dom.window.structuredClone = structuredClone;
  dom.window.fetch = async () => { throw Error('No external requests in this test'); };
  dom.window.setTimeout = ((_callback: () => void) => 1) as typeof dom.window.setTimeout;
  for (const [key, value] of Object.entries(values)) dom.window.localStorage.setItem(key, value);
  if (blocked) Object.defineProperty(dom.window, 'localStorage', { get() { throw Error('Storage unavailable'); } });
  dom.window.eval(compiled.outputFiles[0]!.text);
  const start = () => dom.window.document.querySelector<HTMLFormElement>('#setup')!.dispatchEvent(new dom.window.Event('submit', { cancelable: true, bubbles: true }));
  return { dom, start };
}

test('production and preview keep exposure on reload in separate unchanged namespaces', async () => {
  for (const context of ['production', 'narrator-preview']) {
    const prefix = context === 'narrator-preview' ? 'narrator-preview:' : '';
    const otherKey = context === 'narrator-preview' ? historyKey : `narrator-preview:${historyKey}`;
    const saved = initialHistory();
    const games = JSON.stringify({ version: 2, games: [{ id: 'preserved-game', schemaVersion: 2, datasetEpoch: 1, score: [10, 8] }] });
    const values = { [`${prefix}${historyKey}`]: saved, [otherKey]: 'other namespace stays untouched',
      [`${prefix}${PERFORMANCE_PROFILE_KEY}`]: profile, [`${prefix}${PERFORMANCE_STORAGE_KEY}`]: games };
    const first = await application(context, values); first.start();
    const raw = first.dom.window.localStorage.getItem(`${prefix}${historyKey}`)!;
    assert.equal(JSON.parse(raw).game, 2);
    assert.equal(first.dom.window.localStorage.getItem(otherKey), values[otherKey]);
    assert.equal(first.dom.window.localStorage.getItem(`${prefix}${PERFORMANCE_PROFILE_KEY}`), profile);
    assert.equal(first.dom.window.localStorage.getItem(`${prefix}${PERFORMANCE_STORAGE_KEY}`), games);
    first.dom.window.close();
    const reloaded = await application(context, { ...values, [`${prefix}${historyKey}`]: raw }); reloaded.start();
    const adapter = { load: () => reloaded.dom.window.localStorage.getItem(`${prefix}${historyKey}`), save: (_value: string) => {} };
    assert.equal(loadNarratorHistory(adapter)?.game, 3);
    assert.ok(loadNarratorHistory(adapter)?.seenClips.includes(line.clip));
    assert.equal(createNarratorFlavorHistory(() => 0, adapter).eligible(line), false, 'reload must not make the heard joke fresh');
    assert.equal(reloaded.dom.window.localStorage.getItem(otherKey), values[otherKey]);
    reloaded.dom.window.close();
  }
});

test('production first use creates only its history key without consuming preview exposure', async () => {
  const otherKey = `narrator-preview:${historyKey}`, saved = initialHistory();
  const app = await application('production', { [otherKey]: saved }); app.start();
  const raw = app.dom.window.localStorage.getItem(historyKey)!;
  assert.equal(JSON.parse(raw).game, 1); assert.deepEqual(JSON.parse(raw).seenClips, []);
  assert.equal(app.dom.window.localStorage.getItem(otherKey), saved);
  app.dom.window.close();
});

test('blocked production storage retains the existing playable in-memory fallback', async () => {
  const app = await application('production', {}, true);
  assert.doesNotThrow(() => app.start());
  assert.equal(app.dom.window.document.querySelector<HTMLElement>('#game')!.hidden, false);
  assert.equal(app.dom.window.document.querySelectorAll('#hand button').length, 5);
  app.dom.window.close();
});
