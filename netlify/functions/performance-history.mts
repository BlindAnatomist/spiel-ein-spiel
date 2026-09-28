import { getStore } from '@netlify/blobs';

const PROFILE_PATTERN = /^EUC-[A-Za-z0-9-]{16,}$/;
const STORE_NAME = 'euchre-performance-history-v1';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validGame(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) return false;
  if (value.schemaVersion !== 2 || value.datasetEpoch !== 1) return false;
  if (typeof value.id !== 'string' || !value.id || typeof value.completedAt !== 'string') return false;
  if (value.humanTracking !== 'owner' && value.humanTracking !== 'other') return false;
  if (!Array.isArray(value.score) || value.score.length !== 2 || !value.score.every(v => Number.isFinite(v))) return false;
  if (!Array.isArray(value.hands) || !Array.isArray(value.opponents)) return false;
  return true;
}

function profileFromUrl(req: Request): string | null {
  const profile = new URL(req.url).searchParams.get('profile');
  return profile && PROFILE_PATTERN.test(profile) ? profile : null;
}

export default async function handler(req: Request) {
  const store = getStore({ name: STORE_NAME, consistency: 'strong' });

  if (req.method === 'GET') {
    const profile = profileFromUrl(req);
    if (!profile) return Response.json({ error: 'Invalid profile.' }, { status: 400 });
    const prefix = profile + '/';
    const { blobs } = await store.list({ prefix });
    const games = (await Promise.all(blobs.map(entry => store.get(entry.key, { type: 'json', consistency: 'strong' }))))
      .filter(validGame)
      .sort((a, b) => String(a.completedAt).localeCompare(String(b.completedAt)));
    return Response.json({ version: 2, games }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  if (req.method === 'POST') {
    let body: unknown;
    try { body = await req.json(); } catch {
      return Response.json({ error: 'Invalid JSON.' }, { status: 400 });
    }
    if (!isRecord(body) || typeof body.profileId !== 'string' || !PROFILE_PATTERN.test(body.profileId) || !validGame(body.game)) {
      return Response.json({ error: 'Invalid performance record.' }, { status: 400 });
    }
    const game = body.game;
    await store.setJSON(body.profileId + '/' + String(game.id) + '.json', game);
    return Response.json({ ok: true, id: game.id });
  }

  return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, POST' } });
}

export const config = {
  path: '/api/performance-history',
};
