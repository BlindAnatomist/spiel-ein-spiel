import { randomFillSync } from 'node:crypto';
import { allowed, args } from '../simulation/args.ts';
import { auditDeals } from './deals.ts';

const input = args(process.argv.slice(2));
allowed(input, ['--deals', '--seed', '--source']);
const source = input['--source'] ?? 'deterministic';
if (source !== 'deterministic' && source !== 'crypto') throw new Error('Source must be deterministic or crypto');

let pool = new Uint32Array(4096);
let cursor = pool.length;
const cryptoWord = () => {
  if (cursor >= pool.length) {
    randomFillSync(pool);
    cursor = 0;
  }
  return pool[cursor++]!;
};

const report = auditDeals({
  deals: Number(input['--deals'] ?? 50000),
  seed: Number(input['--seed'] ?? 20260923),
  ...(source === 'crypto' ? { randomWord: cryptoWord } : {}),
});
console.log(JSON.stringify(report, null, 2));
