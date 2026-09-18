/** Optional host-side timing only; clocks never enter policy inputs or decisions. */
import { performance } from 'node:perf_hooks';
import { createBot } from '../bots/index.ts';
import { allowed, args } from './args.ts';
import { count, runMatch, simulationSeed } from './index.ts';
import type { Lineup } from './index.ts';
const input = args(process.argv.slice(2)); allowed(input, ['--games', '--seed']);
const games = Number(input['--games'] ?? 20); const seed = Number(input['--seed'] ?? 1002); count(games);
const levels: Lineup = ['expert', 'strong', 'val', 'casual'];
const timings: Record<string, number[]> = {};
for (let i = 0; i < games; i++) {
  const policies = levels.map(level => {
    const bot = createBot(level);
    return ((view: Parameters<typeof bot>[0]) => {
      const start = performance.now(); const action = bot(view);
      (timings[`${level}:${view.phase}`] ??= []).push(performance.now() - start);
      return action;
    });
  });
  runMatch({ seed: simulationSeed(seed, i), levels }, policies);
}
const rows = Object.entries(timings).map(([policyPhase, values]) => {
  values.sort((a, b) => a - b);
  return { policyPhase, decisions: values.length, meanMs: values.reduce((a, b) => a + b, 0) / values.length,
    p95Ms: values[Math.ceil(values.length * 0.95) - 1], maxMs: values.at(-1) };
});
console.log(JSON.stringify({ games, seed, runtime: process.version, platform: process.platform, arch: process.arch, rows }, null, 2));
