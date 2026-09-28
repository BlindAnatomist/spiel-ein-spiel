function emptyHistory() {
  return { version: 2, games: [] };
}

function authorized(profileId) {
  const aliases = (process.env.PERFORMANCE_HISTORY_PROFILE_ALIASES ?? '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
  return aliases.includes(profileId);
}

export default async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  let profileId = '';
  try {
    const body = await req.json();
    profileId = typeof body?.profileId === 'string' ? body.profileId : '';
  } catch {
    return Response.json(emptyHistory(), { headers: { 'Cache-Control': 'no-store' } });
  }
  if (!authorized(profileId)) {
    return Response.json(emptyHistory(), { headers: { 'Cache-Control': 'no-store' } });
  }
  try {
    const parsed = JSON.parse(process.env.PERFORMANCE_HISTORY_SEED ?? '');
    if (parsed?.version !== 2 || !Array.isArray(parsed.games)) throw new Error('Invalid history');
    return Response.json(parsed, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json(emptyHistory(), { headers: { 'Cache-Control': 'no-store' } });
  }
};

export const config = { path: '/api/performance-history' };
