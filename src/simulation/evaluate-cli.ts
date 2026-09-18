import { compare } from './index.ts';
import { allowed, args, level } from './args.ts';
const input = args(process.argv.slice(2));
allowed(input, ['--pairs', '--seed', '--a', '--b']);
console.log(JSON.stringify(compare({ a: level(input['--a'] ?? 'expert'), b: level(input['--b'] ?? 'strong'), pairs: Number(input['--pairs'] ?? 200), seed: Number(input['--seed'] ?? 20260918) }), null, 2));
