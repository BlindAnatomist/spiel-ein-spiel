import { simulate } from './index.ts';
import type { Lineup } from './index.ts';
import { allowed, args, level } from './args.ts';
const input = args(process.argv.slice(2));
allowed(input, ['--games', '--seed', '--seats']);
const levels = (input['--seats'] ?? 'strong,casual,val,casual').split(',').map(level);
if (levels.length !== 4) throw new Error('Specify four comma-separated seat levels');
const report = simulate({ games: Number(input['--games'] ?? 100), seed: Number(input['--seed'] ?? 20260918), levels: levels as unknown as Lineup });
console.log(JSON.stringify({ options: report.options, summary: report.summary }, null, 2));
