import { auditBotProfiles } from './bots.ts';
import type { OpponentLevel } from '../bots/profiles.ts';
import { allowed, args } from '../simulation/args.ts';

function tier(value: string): OpponentLevel {
  if (value === 'casual' || value === 'strong' || value === 'expert') return value;
  throw new Error(`Unknown opponent tier: ${value}`);
}

const input = args(process.argv.slice(2));
allowed(input, ['--tier', '--games', '--seed']);

const report = auditBotProfiles({
  tier: tier(input['--tier'] ?? 'strong'),
  gamesPerCase: Number(input['--games'] ?? 500),
  seed: Number(input['--seed'] ?? 20260924),
});

console.log(JSON.stringify(report, null, 2));
