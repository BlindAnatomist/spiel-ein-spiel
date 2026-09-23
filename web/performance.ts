import type { HandResult, PlayerView, Seat, Team } from '../src/index.ts';
import type { Difficulty, OpponentIdentity, SessionMeta, SessionObserver } from './session.ts';

export const PERFORMANCE_STORAGE_KEY = 'spiel-ein-spiel:euchre-performance:v1';
export const PERFORMANCE_PROFILE_KEY = 'spiel-ein-spiel:euchre-performance-profile:v1';
export const PERFORMANCE_PENDING_ARCHIVE_KEY = 'spiel-ein-spiel:euchre-performance-pending:v1';
const MAX_RECORDED_GAMES = 500;

export interface HandPerformance {
  readonly handNumber: number;
  readonly dealer: Seat;
  readonly caller: Seat;
  readonly round: 1 | 2;
  readonly alone: boolean;
  readonly makerTricks: number;
  readonly awardedTeam: Team;
  readonly points: number;
  readonly reason: HandResult['reason'];
}

export interface GamePerformance {
  readonly id: string;
  readonly completedAt: string;
  readonly difficulty: Difficulty;
  readonly opponents: readonly OpponentIdentity[];
  readonly winner: Team;
  readonly score: readonly [number, number];
  readonly hands: readonly HandPerformance[];
}

export interface PerformanceBook {
  readonly version: 1;
  readonly games: readonly GamePerformance[];
}

export interface PerformanceArchiveItem {
  readonly profileId: string;
  readonly game: GamePerformance;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface RecorderOptions {
  readonly profileId?: string;
  readonly gameId?: string;
  readonly completedAt?: () => string;
  readonly archiveQueued?: () => void;
}

export interface CallerSummary {
  calls: number;
  made: number;
  euchred: number;
  marches: number;
  lonerAttempts: number;
  lonerMarches: number;
}

export interface OpponentSummary {
  id: string;
  label: string;
  level: string;
  games: number;
  humanTeamWins: number;
  opponentTeamWins: number;
  calls: number;
  made: number;
  euchred: number;
  marches: number;
  lonerAttempts: number;
  lonerMarches: number;
}

export interface PerformanceSummary {
  games: number;
  wins: number;
  losses: number;
  winRate: number | null;
  recentGames: number;
  recentWins: number;
  recentWinRate: number | null;
  averageFinalScore: readonly [number, number] | null;
  hands: number;
  callsBySeat: readonly [number, number, number, number];
  callers: readonly [CallerSummary, CallerSummary, CallerSummary, CallerSummary];
  opponents: readonly OpponentSummary[];
}

function emptyBook(): PerformanceBook {
  return { version: 1, games: [] };
}

function caller(): CallerSummary {
  return { calls: 0, made: 0, euchred: 0, marches: 0, lonerAttempts: 0, lonerMarches: 0 };
}

export function loadPerformance(storage: StorageLike): PerformanceBook {
  try {
    const raw = storage.getItem(PERFORMANCE_STORAGE_KEY);
    if (!raw) return emptyBook();
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return emptyBook();
    const candidate = parsed as { version?: unknown; games?: unknown };
    if (candidate.version !== 1 || !Array.isArray(candidate.games)) return emptyBook();
    return { version: 1, games: candidate.games as GamePerformance[] };
  } catch {
    return emptyBook();
  }
}

function savePerformance(storage: StorageLike, book: PerformanceBook): void {
  try { storage.setItem(PERFORMANCE_STORAGE_KEY, JSON.stringify(book)); } catch {}
}

export function getPerformanceProfile(storage: StorageLike): string | null {
  try {
    const value = storage.getItem(PERFORMANCE_PROFILE_KEY);
    return value && /^EUC-[A-Za-z0-9-]{16,}$/.test(value) ? value : null;
  } catch {
    return null;
  }
}

export function ensurePerformanceProfile(storage: StorageLike, createId: () => string): string {
  const existing = getPerformanceProfile(storage);
  if (existing) return existing;
  const created = `EUC-${createId().replace(/[^A-Za-z0-9-]/g, '')}`;
  try { storage.setItem(PERFORMANCE_PROFILE_KEY, created); } catch {}
  return created;
}

export function loadPendingArchives(storage: StorageLike): readonly PerformanceArchiveItem[] {
  try {
    const raw = storage.getItem(PERFORMANCE_PENDING_ARCHIVE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as PerformanceArchiveItem[];
  } catch {
    return [];
  }
}

function savePendingArchives(storage: StorageLike, items: readonly PerformanceArchiveItem[]): void {
  try { storage.setItem(PERFORMANCE_PENDING_ARCHIVE_KEY, JSON.stringify(items)); } catch {}
}

export function enqueuePerformanceArchive(storage: StorageLike, item: PerformanceArchiveItem): void {
  const pending = loadPendingArchives(storage);
  if (pending.some(value => value.game.id === item.game.id)) return;
  savePendingArchives(storage, [...pending, item]);
}

export function markPerformanceArchived(storage: StorageLike, gameId: string): void {
  savePendingArchives(storage, loadPendingArchives(storage).filter(item => item.game.id !== gameId));
}

function handRecord(view: PlayerView): HandPerformance | null {
  if (!view.result || view.caller === null) return null;
  return Object.freeze({
    handNumber: view.handNumber,
    dealer: view.dealer,
    caller: view.caller,
    round: view.biddingRound,
    alone: view.alone,
    makerTricks: view.result.makerTricks,
    awardedTeam: view.result.team,
    points: view.result.points,
    reason: view.result.reason,
  });
}

/** Records completed public results only. Abandoned games are not counted as completed games. */
export function createPerformanceRecorder(storage: StorageLike, options: RecorderOptions = {}): SessionObserver {
  const hands: HandPerformance[] = [];
  let saved = false;
  return {
    handCompleted(view) {
      const record = handRecord(view);
      if (record && !hands.some(hand => hand.handNumber === record.handNumber)) hands.push(record);
    },
    gameCompleted(view, meta: SessionMeta) {
      if (saved || view.winner === null) return;
      saved = true;
      const book = loadPerformance(storage);
      const game: GamePerformance = Object.freeze({
        id: options.gameId ?? `local-${book.games.length + 1}-${view.handNumber}`,
        completedAt: options.completedAt?.() ?? 'local',
        difficulty: meta.difficulty,
        opponents: Object.freeze(meta.opponents.map(opponent => Object.freeze({ ...opponent }))),
        winner: view.winner,
        score: Object.freeze([view.score[0], view.score[1]]) as readonly [number, number],
        hands: Object.freeze(hands.map(hand => Object.freeze({ ...hand }))),
      });
      const games = [...book.games.filter(value => value.id !== game.id), game].slice(-MAX_RECORDED_GAMES);
      savePerformance(storage, { version: 1, games });
      if (options.profileId) {
        enqueuePerformanceArchive(storage, { profileId: options.profileId, game });
        options.archiveQueued?.();
      }
    },
  };
}

function addCaller(summary: CallerSummary, hand: HandPerformance): void {
  summary.calls++;
  summary.euchred += Number(hand.reason === 'euchred');
  summary.made += Number(hand.reason !== 'euchred');
  summary.marches += Number(hand.makerTricks === 5);
  summary.lonerAttempts += Number(hand.alone);
  summary.lonerMarches += Number(hand.alone && hand.makerTricks === 5);
}

export function summarizePerformance(book: PerformanceBook): PerformanceSummary {
  const callers = [caller(), caller(), caller(), caller()] as [CallerSummary, CallerSummary, CallerSummary, CallerSummary];
  const callsBySeat = [0, 0, 0, 0] as [number, number, number, number];
  const profiles = new Map<string, OpponentSummary>();
  let wins = 0;
  let hands = 0;
  let ourPoints = 0;
  let theirPoints = 0;

  for (const game of book.games) {
    wins += Number(game.winner === 0);
    ourPoints += game.score[0];
    theirPoints += game.score[1];
    for (const opponent of game.opponents) {
      let summary = profiles.get(opponent.id);
      if (!summary) {
        summary = {
          id: opponent.id, label: opponent.label, level: opponent.level,
          games: 0, humanTeamWins: 0, opponentTeamWins: 0,
          calls: 0, made: 0, euchred: 0, marches: 0, lonerAttempts: 0, lonerMarches: 0,
        };
        profiles.set(opponent.id, summary);
      }
      summary.games++;
      summary.humanTeamWins += Number(game.winner === 0);
      summary.opponentTeamWins += Number(game.winner === 1);
    }
    for (const hand of game.hands) {
      hands++;
      callsBySeat[hand.caller]++;
      addCaller(callers[hand.caller], hand);
      if (hand.caller === 1 || hand.caller === 3) {
        const opponent = game.opponents.find(value => value.seat === hand.caller);
        const summary = opponent ? profiles.get(opponent.id) : undefined;
        if (summary) addCaller(summary, hand);
      }
    }
  }

  const recent = book.games.slice(-20);
  const recentWins = recent.reduce((sum, game) => sum + Number(game.winner === 0), 0);
  const games = book.games.length;
  return {
    games,
    wins,
    losses: games - wins,
    winRate: games ? wins / games : null,
    recentGames: recent.length,
    recentWins,
    recentWinRate: recent.length ? recentWins / recent.length : null,
    averageFinalScore: games ? [ourPoints / games, theirPoints / games] : null,
    hands,
    callsBySeat,
    callers,
    opponents: [...profiles.values()].sort((a, b) => b.games - a.games || a.label.localeCompare(b.label)),
  };
}

function percent(value: number | null): string {
  return value === null ? 'not available' : `${Math.round(value * 100)} percent`;
}

function callLine(name: string, summary: CallerSummary): string {
  const madeRate = summary.calls ? summary.made / summary.calls : null;
  const euchreRate = summary.calls ? summary.euchred / summary.calls : null;
  return `${name}: ${summary.calls} calls; made ${percent(madeRate)}; euchred ${percent(euchreRate)}; ${summary.marches} marches; ${summary.lonerAttempts} loner attempts, ${summary.lonerMarches} successful.`;
}

export function performanceText(summary: PerformanceSummary): string {
  if (!summary.games) return 'No completed games recorded yet.';
  const score = summary.averageFinalScore!;
  const recent = summary.recentGames
    ? ` Last ${summary.recentGames}: ${summary.recentWins} wins, ${percent(summary.recentWinRate)}.`
    : '';
  const profiles = summary.opponents.length
    ? ` Opponent profiles encountered: ${summary.opponents.map(p => `${p.label}, ${p.games} games`).join('; ')}.`
    : '';
  return `Completed games: ${summary.games}. You and Val: ${summary.wins} wins, ${summary.losses} losses, ${percent(summary.winRate)}. Average final score: ${score[0].toFixed(1)} to ${score[1].toFixed(1)}.${recent} Completed hands: ${summary.hands}. ${callLine('Your calling record', summary.callers[0])} ${callLine('Val calling record', summary.callers[2])} West calls: ${summary.callsBySeat[1]}. East calls: ${summary.callsBySeat[3]}.${profiles}`;
}
