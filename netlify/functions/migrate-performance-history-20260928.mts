import { getStore } from '@netlify/blobs';

declare const Netlify: { env: { get(name: string): string | undefined } };

// One-time deploy-preview migration. The compact payload/profile are temporary Functions-scoped Netlify variables.
const STORE_NAME = 'euchre-performance-history-v1';
const REASONS = { m: 'made', x: 'march', l: 'loner-march', e: 'euchred' } as const;

type PackedGame = [
  string, string, string, 0 | 1, number, number,
  Array<[0 | 1 | 2 | 3, string, string, string, string]>,
  Array<[0 | 1 | 2 | 3, keyof typeof REASONS, number, 0 | 1]>
];

export default async function handler() {
  const raw = Netlify.env.get('PERFORMANCE_MIGRATION_DATA');
  const profile = Netlify.env.get('PERFORMANCE_MIGRATION_PROFILE');
  if (!raw || !profile) return Response.json({ error: 'Migration is disabled.' }, { status: 404 });

  let packed: PackedGame[];
  try { packed = JSON.parse(raw) as PackedGame[]; } catch {
    return Response.json({ error: 'Invalid migration payload.' }, { status: 500 });
  }

  const store = getStore({ name: STORE_NAME, consistency: 'strong' });
  for (const [id, completedAt, difficulty, winner, ours, theirs, opponents, hands] of packed) {
    const game = {
      schemaVersion: 2,
      datasetEpoch: 1,
      buildCommit: 'migrated-from-forms',
      rulesVersion: 'euchre-standard-v1',
      id,
      completedAt,
      humanTracking: 'owner',
      difficulty,
      startingDealer: 0,
      opponents: opponents.map(([seat, opponentId, label, level, name]) => ({
        seat, id: opponentId, label, level, name: name || (seat === 1 ? 'West' : 'East'),
      })),
      winner,
      score: [ours, theirs],
      hands: hands.map(([caller, reasonCode, makerTricks, alone], index) => {
        const reason = REASONS[reasonCode];
        const makerTeam = (caller % 2) as 0 | 1;
        const awardedTeam = reason === 'euchred' ? ((1 - makerTeam) as 0 | 1) : makerTeam;
        const points = reason === 'loner-march' ? 4 : reason === 'march' || reason === 'euchred' ? 2 : 1;
        return {
          handNumber: index + 1,
          dealer: 0,
          scoreBefore: [0, 0],
          scoreAfter: [0, 0],
          upCard: 'clubs:9',
          ownerStartingHand: null,
          caller,
          trump: null,
          round: 1,
          alone: Boolean(alone),
          makerTricks,
          awardedTeam,
          points,
          reason,
        };
      }),
    };
    await store.setJSON(profile + '/' + id + '.json', game);
  }

  const { blobs } = await store.list({ prefix: profile + '/' });
  return Response.json({ ok: true, migrated: packed.length, stored: blobs.length });
}

export const config = {
  path: '/api/migrate-performance-history-20260928',
};
