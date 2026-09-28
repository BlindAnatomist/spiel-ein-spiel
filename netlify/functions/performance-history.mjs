const HISTORY_ENDPOINT = 'https://uqqtwhoboopwrusbfesl.supabase.co/functions/v1/euchre-analysis-history';
const HISTORY_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxcXR3aG9ib29wd3J1c2JmZXNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwNDE3MjYsImV4cCI6MjA5OTYxNzcyNn0.7MgaYdYCHSueOnx57G6sEGOswawZAEUzYr-Wm_OR160';

function compactGame(game) {
  if (!game || typeof game !== 'object' || !game.id || !Array.isArray(game.hands)) return null;
  return {
    schemaVersion: 2,
    datasetEpoch: 1,
    buildCommit: String(game.buildCommit ?? 'unknown'),
    rulesVersion: String(game.rulesVersion ?? 'euchre-standard-v1'),
    id: String(game.id),
    completedAt: String(game.completedAt ?? ''),
    humanTracking: game.humanTracking === 'other' ? 'other' : 'owner',
    difficulty: String(game.difficulty ?? 'strong'),
    startingDealer: Number.isInteger(game.startingDealer) ? game.startingDealer : 0,
    opponents: Array.isArray(game.opponents) ? game.opponents : [],
    winner: game.winner,
    score: Array.isArray(game.score) ? game.score : [0, 0],
    hands: game.hands.map(({ decisions: _decisions, ownerStartingHand: _ownerStartingHand, ...hand }) => ({
      ...hand,
      ownerStartingHand: null,
    })),
  };
}

async function callHistory(body) {
  return fetch(HISTORY_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: HISTORY_ANON_KEY,
      Authorization: `Bearer ${HISTORY_ANON_KEY}`,
    },
    body: JSON.stringify(body),
  });
}

export default async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  let body;
  try { body = await req.json(); } catch { return Response.json({ version: 2, games: [] }); }

  if (body?.action === 'upsert') {
    if (body.environment !== 'production') return Response.json({ stored: false, reason: 'non-production' });
    const game = compactGame(body.game);
    if (!game) return Response.json({ error: 'invalid game summary' }, { status: 400 });
    const response = await callHistory({ action: 'upsert', profileId: body.profileId, environment: 'production', game });
    return new Response(await response.text(), {
      status: response.status,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }

  const response = await callHistory({ action: 'list', profileId: body?.profileId });
  return new Response(await response.text(), {
    status: response.status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
};

export const config = { path: '/api/performance-history' };
