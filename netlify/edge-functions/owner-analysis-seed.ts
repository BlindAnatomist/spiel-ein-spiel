type SeedTuple = readonly [
  id: string,
  completedAt: string,
  winner: 0 | 1,
  ourScore: number,
  theirScore: number,
  hands: number,
  calls: number,
  made: number,
  euchred: number,
  marches: number,
  lonerAttempts: number,
  lonerMarches: number,
];

function decodeSeed(raw: string | undefined) {
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) return [];
  return parsed.flatMap(item => {
    if (!Array.isArray(item) || item.length !== 12) return [];
    const [id, completedAt, winner, ourScore, theirScore, hands, calls, made, euchred, marches, lonerAttempts, lonerMarches] = item as unknown[];
    if (typeof id !== 'string' || typeof completedAt !== 'string') return [];
    if (winner !== 0 && winner !== 1) return [];
    const numeric = [ourScore, theirScore, hands, calls, made, euchred, marches, lonerAttempts, lonerMarches];
    if (numeric.some(value => typeof value !== 'number' || !Number.isFinite(value) || value < 0)) return [];
    const tuple = item as unknown as SeedTuple;
    return [{
      id: tuple[0],
      completedAt: tuple[1],
      winner: tuple[2],
      score: [tuple[3], tuple[4]],
      hands: tuple[5],
      calls: tuple[6],
      made: tuple[7],
      euchred: tuple[8],
      marches: tuple[9],
      lonerAttempts: tuple[10],
      lonerMarches: tuple[11],
    }];
  });
}

export default async (request: Request) => {
  if (request.method !== 'GET') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET' } });
  }
  try {
    const games = decodeSeed(Netlify.env.get('OWNER_ANALYSIS_SEED_V1'));
    return Response.json({ version: 1, games }, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch {
    return Response.json({ version: 1, games: [] }, {
      status: 500,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  }
};

export const config = {
  path: '/api/owner-analysis-seed',
};
