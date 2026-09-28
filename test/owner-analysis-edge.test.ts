import test from 'node:test';
import assert from 'node:assert/strict';
import edgeHandler from '../netlify/edge-functions/owner-analysis-seed.ts';
import { parseOwnerAnalysisGames } from '../web/performance.ts';

test('owner analysis edge seed returns compact historical games in browser-compatible shape', async () => {
  const seed = JSON.stringify([
    ['old-1','2026-09-24T00:00:00.000Z',1,4,10,11,1,0,1,0,0,0],
    ['old-2','2026-09-25T00:00:00.000Z',0,10,7,12,4,3,1,1,1,0],
  ]);
  const holder = globalThis as unknown as { Netlify?: { env: { get(name:string): string | undefined } } };
  const previous = holder.Netlify;
  holder.Netlify = { env: { get: name => name === 'OWNER_ANALYSIS_SEED_V1' ? seed : undefined } };
  try {
    const response = await edgeHandler(new Request('https://example.test/api/owner-analysis-seed'));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    const games = parseOwnerAnalysisGames(await response.json());
    assert.equal(games.length, 2);
    assert.deepEqual(games.map(game => game.id), ['old-1','old-2']);
    assert.equal(games[1]!.calls, 4);
    assert.equal(games[1]!.marches, 1);
  } finally {
    if (previous) holder.Netlify = previous;
    else delete holder.Netlify;
  }
});

test('owner analysis edge endpoint rejects non-GET methods', async () => {
  const response = await edgeHandler(new Request('https://example.test/api/owner-analysis-seed',{method:'POST'}));
  assert.equal(response.status,405);
  assert.equal(response.headers.get('allow'),'GET');
});
