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
    hands: game.hands.map(hand => ({
      handNumber: hand.handNumber,
      caller: hand.caller,
      alone: hand.alone,
      makerTricks: hand.makerTricks,
      reason: hand.reason,
    })),
  };
}

async function callHistory(body) {
  const endpoint = process.env.EUCHRE_ANALYSIS_HISTORY_URL;
  const key = process.env.EUCHRE_ANALYSIS_HISTORY_ANON_KEY;
  if (!endpoint || !key) return Response.json({ error: 'history service unavailable' }, { status: 503 });
  return fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
  });
}

export default async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  let body;
  try { body = await req.json(); } catch { return Response.json({ version: 2, games: [] }); }
  const profileId = typeof body?.profileId === 'string' ? body.profileId : '';
  if (!/^EUC-[A-Za-z0-9-]{16,}$/.test(profileId)) {
    return Response.json({ version: 2, games: [] }, { headers: { 'Cache-Control': 'no-store' } });
  }

  if (body?.action === 'upsert') {
    if (body.environment !== 'production') return Response.json({ stored: false, reason: 'non-production' });
    const game = compactGame(body.game);
    if (!game) return Response.json({ error: 'invalid game summary' }, { status: 400 });
    const response = await callHistory({ action: 'upsert', profileId, environment: 'production', game });
    return new Response(await response.text(), {
      status: response.status,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }

  const response = await callHistory({ action: 'list', profileId });
  return new Response(await response.text(), {
    status: response.status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
};

export const config = { path: '/api/performance-history' };
