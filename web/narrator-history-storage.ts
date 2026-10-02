export interface NarratorStamp {
  game: number;
  gameOrdinal: number;
  completedHands: number;
  tricks: number;
  event: number;
}
export interface NarratorHistoryStorage {
  load(): string | null;
  save(value: string): void;
}
export interface StoredNarratorHistory {
  version: 1;
  game: number;
  completedGames: number;
  completedHands: number;
  tricks: number;
  event: number;
  clips: Array<[string, NarratorStamp]>;
  lines: Array<[string, NarratorStamp]>;
  families: Array<[string, NarratorStamp]>;
  seenClips: string[];
  seenLines: string[];
  recent: string[];
  lastFlavor: NarratorStamp | null;
  releaseEvent: number | null;
  releaseJitter: number;
}
export const HISTORY_LIMIT = 512;
export const HISTORY_BYTES = 262144;
const counter = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= 1_000_000_000;
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const key = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 384;
const stamp = (value: unknown): value is NarratorStamp => record(value)
  && ['game','gameOrdinal','completedHands','tricks','event'].every(name => counter(value[name]));
const strings = (value: unknown, limit = HISTORY_LIMIT): value is string[] => Array.isArray(value) && value.length <= limit && value.every(key) && new Set(value).size === value.length;
const entries = (value: unknown): value is Array<[string, NarratorStamp]> => Array.isArray(value) && value.length <= HISTORY_LIMIT
  && value.every(row => Array.isArray(row) && row.length === 2 && key(row[0]) && stamp(row[1]))
  && new Set(value.map(row => row[0])).size === value.length;

/** Local exposure metadata only; malformed/unavailable storage is safely ignored. */
export function loadNarratorHistory(storage?: NarratorHistoryStorage): StoredNarratorHistory | undefined {
  try {
    const raw = storage?.load();
    if (!raw || raw.length > HISTORY_BYTES) return;
    const value: unknown = JSON.parse(raw);
    if (!record(value) || value.version !== 1
      || !['game','completedGames','completedHands','tricks','event','releaseJitter'].every(name => counter(value[name]))
      || (value.releaseJitter as number) > 3
      || (value.releaseEvent !== null && !counter(value.releaseEvent))
      || (value.lastFlavor !== null && !stamp(value.lastFlavor))
      || !entries(value.clips) || !entries(value.lines) || !entries(value.families)
      || !strings(value.seenClips) || !strings(value.seenLines) || !strings(value.recent,8)) return;
    const data = value as unknown as StoredNarratorHistory;
    if (data.releaseEvent !== null && data.releaseEvent > data.event+data.releaseJitter) return;
    const stamps = [...data.clips,...data.lines,...data.families].map(([,seen]) => seen);
    if (data.lastFlavor) stamps.push(data.lastFlavor);
    if (data.completedGames > data.game || stamps.some(seen => seen.game > data.game || seen.gameOrdinal > data.completedGames+1
      || seen.completedHands > data.completedHands || seen.tricks > data.tricks || seen.event > data.event)) return;
    return data;
  } catch { return; }
}

export function saveNarratorHistory(storage: NarratorHistoryStorage | undefined, value: StoredNarratorHistory): void {
  if (!storage) return;
  try {
    const serialized = JSON.stringify(value);
    if (serialized.length <= HISTORY_BYTES) storage.save(serialized);
  } catch { /* Narrator preferences cannot interrupt a game. */ }
}
