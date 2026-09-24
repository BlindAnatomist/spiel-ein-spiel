import { STRATEGIES } from './config.ts';
import type { BotLevel, Strategy } from './config.ts';
import { hashText } from './random.ts';

export type OpponentLevel = Exclude<BotLevel, 'val'>;
export type OpponentDifficulty = OpponentLevel | 'mixed';
export type OpponentProfileId =
  | 'casual-balanced' | 'casual-cautious' | 'casual-bold'
  | 'strong-balanced' | 'strong-conservative' | 'strong-assertive' | 'strong-partnership'
  | 'expert-balanced' | 'expert-conservative' | 'expert-assertive';

export interface OpponentProfile {
  readonly id: OpponentProfileId;
  readonly label: string;
  readonly level: OpponentLevel;
  readonly strategy: Strategy;
}

function variant(level: OpponentLevel, patch: Partial<Strategy> = {}): Strategy {
  const base = STRATEGIES[level];
  const value: Strategy = { ...base, ...patch, level, trumpWeights: Object.freeze([...base.trumpWeights]) };
  return Object.freeze(value);
}

function profile(id: OpponentProfileId, label: string, level: OpponentLevel,
  patch: Partial<Strategy> = {}): OpponentProfile {
  return Object.freeze({ id, label, level, strategy: variant(level, patch) });
}

export const OPPONENT_PROFILES: Readonly<Record<OpponentProfileId, OpponentProfile>> = Object.freeze({
  'casual-balanced': profile('casual-balanced', 'Balanced Casual', 'casual'),
  'casual-cautious': profile('casual-cautious', 'Cautious Casual', 'casual',
    { orderThreshold: 2.45, callThreshold: 2.25, aloneThreshold: 4.05 }),
  'casual-bold': profile('casual-bold', 'Bold Casual', 'casual',
    { orderThreshold: 1.95, callThreshold: 1.8, aloneThreshold: 3.45 }),
  'strong-balanced': profile('strong-balanced', 'Balanced Strong', 'strong'),
  'strong-conservative': profile('strong-conservative', 'Conservative Strong', 'strong',
    { orderThreshold: 3.25, callThreshold: 3.05, aloneThreshold: 4.55, partnerReturn: 0.82, conservation: 0.22 }),
  'strong-assertive': profile('strong-assertive', 'Assertive Strong', 'strong',
    { orderThreshold: 2.75, callThreshold: 2.65, aloneThreshold: 4.0, trumpLead: 1.38, conservation: 0.12 }),
  'strong-partnership': profile('strong-partnership', 'Partnership Strong', 'strong',
    { partnerDealerBonus: 0.5, partnerReturn: 1.08, voidWeight: 1.5, conservation: 0.2 }),
  'expert-balanced': profile('expert-balanced', 'Balanced Expert', 'expert'),
  'expert-conservative': profile('expert-conservative', 'Conservative Expert', 'expert',
    { orderThreshold: 2.85, callThreshold: 2.75, aloneThreshold: 4.5, partnerReturn: 0.85, conservation: 0.21 }),
  'expert-assertive': profile('expert-assertive', 'Assertive Expert', 'expert',
    { orderThreshold: 2.45, callThreshold: 2.35, aloneThreshold: 4.0, trumpLead: 1.38, conservation: 0.13 }),
});

const POOLS: Readonly<Record<OpponentLevel, readonly OpponentProfileId[]>> = {
  casual: ['casual-balanced', 'casual-cautious', 'casual-bold'],
  strong: ['strong-balanced', 'strong-conservative', 'strong-assertive', 'strong-partnership'],
  expert: ['expert-balanced', 'expert-conservative', 'expert-assertive'],
};

function word(seed: number, salt: string): number {
  return hashText(`${seed >>> 0}:${salt}`);
}

function pick(level: OpponentLevel, seed: number, salt: string): OpponentProfile {
  const pool = POOLS[level];
  return OPPONENT_PROFILES[pool[word(seed, salt) % pool.length]!]!;
}

function distinctPair(level: OpponentLevel, seed: number): readonly [OpponentProfile, OpponentProfile] {
  const pool = POOLS[level];
  const westIndex = word(seed, 'west') % pool.length;
  let eastIndex = word(seed, 'east') % (pool.length - 1);
  if (eastIndex >= westIndex) eastIndex++;
  return [OPPONENT_PROFILES[pool[westIndex]!]!, OPPONENT_PROFILES[pool[eastIndex]!]!];
}

export function selectOpponentProfiles(difficulty: OpponentDifficulty, seed: number):
  readonly [OpponentProfile, OpponentProfile] {
  if (difficulty !== 'mixed') return distinctPair(difficulty, seed);
  const levels: readonly OpponentLevel[] = ['casual', 'strong', 'expert'];
  const westIndex = word(seed, 'mixed-west-level') % levels.length;
  let eastIndex = word(seed, 'mixed-east-level') % (levels.length - 1);
  if (eastIndex >= westIndex) eastIndex++;
  const westLevel = levels[westIndex]!;
  const eastLevel = levels[eastIndex]!;
  return [pick(westLevel, seed, 'mixed-west-profile'), pick(eastLevel, seed, 'mixed-east-profile')];
}


export function baselineOpponentProfiles(level: OpponentLevel):
  readonly [OpponentProfile, OpponentProfile] {
  const id = `${level}-balanced` as OpponentProfileId;
  const profile = OPPONENT_PROFILES[id];
  if (!profile) throw new Error(`Missing balanced profile for ${level}`);
  return [profile, profile];
}


export type SeatNames = readonly ['You', string, 'Val', string];

const WEST_NAMES = Object.freeze([
  'Walter', 'Warren', 'Wesley', 'Wyatt', 'Winston', 'Wallace',
  'Wilbur', 'Waylon', 'Wendell', 'Wayne', 'Willard', 'Woodrow',
] as const);
const EAST_NAMES = Object.freeze([
  'Eleanor', 'Evelyn', 'Edith', 'Eva', 'Esther', 'Erica',
  'Elise', 'Elaine', 'Eileen', 'Erin', 'Emma', 'Elena',
] as const);

/** Table identity is independent of strategy. W always means seat 1; E always means seat 3. */
export function selectSeatNames(seed: number): SeatNames {
  const west = WEST_NAMES[word(seed, 'west-name') % WEST_NAMES.length]!;
  const east = EAST_NAMES[word(seed, 'east-name') % EAST_NAMES.length]!;
  return Object.freeze(['You', west, 'Val', east] as const);
}
