import { STRATEGIES } from '../bots/index.ts';
import type { BotLevel } from '../bots/index.ts';
export function args(argv: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i]!; const value = argv[i + 1];
    if (!key.startsWith('--') || value === undefined || key in result) throw new Error('Expected unique --option value pairs');
    result[key] = value;
  }
  return result;
}
export function level(value: string): BotLevel {
  if (!Object.hasOwn(STRATEGIES, value)) throw new Error(`Unknown level: ${value}`);
  return value as BotLevel;
}
export function allowed(input: Record<string, string>, keys: string[]): void {
  if (Object.keys(input).some(k => !keys.includes(k))) throw new Error('Unknown option');
}
