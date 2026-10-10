import { writeVerified } from './verified-storage.ts';
import type { Action, Card, HandResult, PlayerView, Seat, Team } from '../src/index.ts';
import type { Difficulty, OpponentIdentity, SessionMeta, SessionObserver } from './session.ts';

export const PERFORMANCE_SCHEMA_VERSION = 2 as const;
export const PERFORMANCE_DATASET_EPOCH = 1 as const;
export const PERFORMANCE_RULES_VERSION = 'euchre-standard-v1';
export const PERFORMANCE_STORAGE_KEY = 'spiel-ein-spiel:euchre-performance:v2';
export const PERFORMANCE_PROFILE_KEY = 'spiel-ein-spiel:euchre-performance-profile:v1';
export const PERFORMANCE_PENDING_ARCHIVE_KEY = 'spiel-ein-spiel:euchre-performance-pending:v2';
const MAX_RECORDED_GAMES = 300;

export type HumanTracking = 'owner' | 'other';
export type ActorKind = 'owner' | 'other-human' | 'val' | 'opponent';

export interface HandPerformance {
  readonly handNumber: number;
  readonly dealer: Seat;
  readonly scoreBefore: readonly [number, number];
  readonly scoreAfter: readonly [number, number];
  readonly upCard: Card;
  readonly ownerStartingHand: readonly Card[] | null;
  readonly caller: Seat;
  readonly trump: PlayerView['trump'];
  readonly round: 1 | 2;
  readonly alone: boolean;
  readonly makerTricks: number;
  readonly awardedTeam: Team;
  readonly points: number;
  readonly reason: HandResult['reason'];
}

export interface GamePerformance {
  readonly schemaVersion: typeof PERFORMANCE_SCHEMA_VERSION;
  readonly datasetEpoch: typeof PERFORMANCE_DATASET_EPOCH;
  readonly buildCommit: string;
  readonly rulesVersion: string;
  readonly id: string;
  readonly completedAt: string;
  readonly humanTracking: HumanTracking;
  readonly difficulty: Difficulty;
  readonly startingDealer: Seat;
  readonly opponents: readonly OpponentIdentity[];
  readonly winner: Team;
  readonly score: readonly [number, number];
  readonly hands: readonly HandPerformance[];
}

export interface DecisionEvidence {
  readonly sequence: number;
  readonly seat: Seat;
  readonly actorKind: ActorKind;
  readonly actorName: string;
  readonly profileId: string | null;
  /** Exact permitted PlayerView before the action. Omitted for an untracked human. */
  readonly view: PlayerView | null;
  readonly action: Action;
}

export interface ArchivedHandRecord extends HandPerformance {
  readonly decisions: readonly DecisionEvidence[];
}

export interface ArchivedGameRecord {
  readonly schemaVersion: typeof PERFORMANCE_SCHEMA_VERSION;
  readonly datasetEpoch: typeof PERFORMANCE_DATASET_EPOCH;
  readonly buildCommit: string;
  readonly rulesVersion: string;
  readonly id: string;
  readonly completedAt: string;
  readonly humanTracking: HumanTracking;
  readonly difficulty: Difficulty;
  readonly startingDealer: Seat;
  readonly seatNames: SessionMeta['seatNames'];
  readonly opponents: readonly OpponentIdentity[];
  readonly winner: Team;
  readonly score: readonly [number, number];
  readonly hands: readonly ArchivedHandRecord[];
}

export interface PerformanceBook {
  readonly version: 2;
  readonly games: readonly GamePerformance[];
}

export interface PerformanceArchiveItem {
  readonly profileId: string;
  readonly game: ArchivedGameRecord;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface RecorderOptions {
  readonly profileId?: string;
  readonly gameId?: string;
  readonly humanTracking?: HumanTracking;
  readonly buildCommit?: string;
  readonly rulesVersion?: string;
  readonly completedAt?: () => string;
  readonly archiveQueued?: () => void;
  readonly persistence?: PerformancePersistence;
  readonly persistenceChanged?: () => void;
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

export interface OwnerTrendPoint {
  readonly label: string;
  readonly firstGame: number;
  readonly lastGame: number;
  readonly games: number;
  readonly winRate: number;
  readonly callSuccessRate: number | null;
  readonly averageScoreDifferential: number;
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
  ownerCaller: CallerSummary;
  botGames: number;
  botHands: number;
  botCallsBySeat: readonly [number, number, number, number];
  valCaller: CallerSummary;
  opponents: readonly OpponentSummary[];
}

interface ActiveHand {
  handNumber: number;
  dealer: Seat;
  scoreBefore: readonly [number, number];
  upCard: Card;
  ownerStartingHand: readonly Card[] | null;
  decisions: DecisionEvidence[];
}

function emptyBook(): PerformanceBook {
  return { version: 2, games: [] };
}

function caller(): CallerSummary {
  return { calls: 0, made: 0, euchred: 0, marches: 0, lonerAttempts: 0, lonerMarches: 0 };
}

function currentGames(book: PerformanceBook): readonly GamePerformance[] {
  return book.games.filter(game =>
    game.schemaVersion === PERFORMANCE_SCHEMA_VERSION && game.datasetEpoch === PERFORMANCE_DATASET_EPOCH);
}

function readableGame(value: unknown): value is GamePerformance {
  if (!value || typeof value !== 'object') return false;
  const game = value as Partial<GamePerformance>;
  return typeof game.id === 'string' && typeof game.completedAt === 'string'
    && Array.isArray(game.hands) && game.hands.every(hand => hand && typeof hand === 'object')
    && Array.isArray(game.opponents) && game.opponents.every(opponent => opponent && typeof opponent === 'object')
    && Array.isArray(game.score) && game.score.length === 2 && game.score.every(Number.isFinite);
}

function readPerformance(storage: StorageLike): PerformanceBook {
  const raw = storage.getItem(PERFORMANCE_STORAGE_KEY);
  if (raw === null) return emptyBook();
  const candidate = JSON.parse(raw) as PerformanceBook | null;
  if (!candidate || candidate.version !== 2 || !Array.isArray(candidate.games) || !candidate.games.every(readableGame)) throw new Error('Unreadable performance history');
  return candidate;
}

export function loadPerformance(storage: StorageLike): PerformanceBook {
  try { return readPerformance(storage); } catch { return emptyBook(); }
}

export function mergePerformanceBooks(...books: readonly PerformanceBook[]): PerformanceBook {
  const byId = new Map<string, GamePerformance>();
  for (const book of books) {
    for (const game of currentGames(book)) byId.set(game.id, game);
  }
  const games = [...byId.values()]
    .sort((a, b) => a.completedAt.localeCompare(b.completedAt))
    .slice(-MAX_RECORDED_GAMES);
  return { version: 2, games };
}

function savePerformance(storage: StorageLike, book: PerformanceBook): void {
  writeVerified(storage, PERFORMANCE_STORAGE_KEY, JSON.stringify(book));
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
  // A queue may have survived when only the small profile-key write failed.
  // Recover an unambiguous existing identity instead of inventing a new one.
  const queuedProfiles = [...new Set(loadPendingArchives(storage).map(item => item.profileId)
    .filter(value => /^EUC-[A-Za-z0-9-]{16,}$/.test(value)))];
  const created = queuedProfiles.length === 1 ? queuedProfiles[0]! : `EUC-${createId().replace(/[^A-Za-z0-9-]/g, '')}`;
  retainPerformanceProfile(storage, created);
  return created;
}

/** Keep the same recovery identity during a failed-write/retry cycle. */
export function retainPerformanceProfile(storage: StorageLike, profileId: string): boolean {
  try {
    const existing = storage.getItem(PERFORMANCE_PROFILE_KEY);
    if (existing !== null) return existing === profileId;
    writeVerified(storage, PERFORMANCE_PROFILE_KEY, profileId);
    return true;
  } catch { return false; }
}

function readPendingArchives(storage: StorageLike): readonly PerformanceArchiveItem[] {
  const raw = storage.getItem(PERFORMANCE_PENDING_ARCHIVE_KEY);
  if (raw === null) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed) || parsed.some(item => !item || typeof item.profileId !== 'string' || !readableGame(item.game) || !Array.isArray(item.game.seatNames))) {
    throw new Error('Unreadable performance queue');
  }
  return parsed as PerformanceArchiveItem[];
}

export function loadPendingArchives(storage: StorageLike): readonly PerformanceArchiveItem[] {
  try { return readPendingArchives(storage); } catch { return []; }
}

function savePendingArchives(storage: StorageLike, items: readonly PerformanceArchiveItem[]): void {
  writeVerified(storage, PERFORMANCE_PENDING_ARCHIVE_KEY, JSON.stringify(items));
}

export function enqueuePerformanceArchive(storage: StorageLike, item: PerformanceArchiveItem): boolean {
  try {
    const pending = readPendingArchives(storage);
    if (!pending.some(value => value.game.id === item.game.id)) savePendingArchives(storage, [...pending, item]);
    return true;
  } catch { return false; }
}

export function markPerformanceArchived(storage: StorageLike, gameId: string): boolean {
  try {
    savePendingArchives(storage, readPendingArchives(storage).filter(item => item.game.id !== gameId));
    return true;
  } catch { return false; }
}

export function removePerformanceGame(storage: StorageLike, gameId: string): void {
  // Do not overwrite data that could not be read.
  try {
    const book = readPerformance(storage);
    const games = book.games.filter(game => game.id !== gameId);
    if (games.length !== book.games.length) savePerformance(storage, { version: 2, games });
  } catch {}
  try {
    const pending = readPendingArchives(storage);
    if (pending.some(item => item.game.id === gameId)) savePendingArchives(storage, pending.filter(item => item.game.id !== gameId));
  } catch {}
}

/** Keep failed completions in this page, including after another game starts.
 * Like the public hand-report store, merge before replacing and verify readback.
 * No storage API can recover never-written data after the page is closed.
 */
export function createPerformancePersistence(storage: StorageLike) {
  const retained = new Map<string, { game: GamePerformance; archive: PerformanceArchiveItem | null; queued?: () => void }>();
  const acknowledged = new Set<string>();
  const delivered = new Set<string>();
  let unreadable = false;
  let writeFailed = false;
  function retry(): void {
    unreadable = false;
    writeFailed = false;
    let book: PerformanceBook | undefined;
    let pending: readonly PerformanceArchiveItem[] | undefined;
    try { book = readPerformance(storage); } catch { unreadable = true; }
    try { pending = readPendingArchives(storage); } catch { unreadable = true; }
    // Persist removals before any new upload, so a failed acknowledgement does
    // not resubmit the same archive repeatedly in this open page.
    if (pending && acknowledged.size) {
      try {
        savePendingArchives(storage, pending.filter(item => !acknowledged.has(item.game.id)));
        pending = pending.filter(item => !acknowledged.has(item.game.id));
        acknowledged.clear();
      } catch { writeFailed = true; }
    }
    // A retained queue carries enough information to restore a summary after
    // a reload interrupted the two independent localStorage replacements.
    const recovered = (pending ?? []).map(item => compactGame(item.game));
    let localSaved = false;
    if (book && (retained.size || recovered.some(game => !book!.games.some(saved => saved.id === game.id)))) {
      try {
        const merged = mergePerformanceBooks(book, {version: 2, games: [...recovered, ...[...retained.values()].map(item => item.game)]});
        if (JSON.stringify(merged) !== JSON.stringify(book)) savePerformance(storage, merged);
        localSaved = true;
      } catch { writeFailed = true; }
    } else localSaved = book !== undefined;
    let queueSaved = false;
    if (pending) {
      const byId = new Map(pending.map(item => [item.game.id, item]));
      for (const item of retained.values()) if (item.archive && !delivered.has(item.game.id)) byId.set(item.game.id, item.archive);
      try {
        if ([...retained.values()].some(item => item.archive && !delivered.has(item.game.id) && !pending!.some(saved => saved.game.id === item.game.id))) {
          savePendingArchives(storage, [...byId.values()]);
        }
        queueSaved = true;
      } catch { writeFailed = true; }
    }
    const callbacks: (() => void)[] = [];
    for (const [id,item] of retained) {
      if (localSaved && (!item.archive || queueSaved)) {
        retained.delete(id);
        if (item.archive && item.queued && !delivered.has(id)) callbacks.push(item.queued);
      }
    }
    for (const callback of callbacks) callback();
  }
  return {
    retry,
    record(game: GamePerformance, archive: PerformanceArchiveItem | null, queued?: () => void) {
      if (!retained.has(game.id)) retained.set(game.id, {game, archive, ...(queued ? {queued} : {})});
      retry();
    },
    book(): PerformanceBook {
      let book = emptyBook();
      try { book = readPerformance(storage); } catch { unreadable = true; }
      return mergePerformanceBooks(book, {version: 2, games: [...retained.values()].map(item => item.game)});
    },
    pending(): readonly PerformanceArchiveItem[] {
      try { return readPendingArchives(storage).filter(item => !acknowledged.has(item.game.id)); }
      catch { unreadable = true; return []; }
    },
    archived(gameId: string): boolean {
      delivered.add(gameId);
      acknowledged.add(gameId);
      const saved = markPerformanceArchived(storage, gameId);
      if (saved) acknowledged.delete(gameId);
      else writeFailed = true;
      return saved;
    },
    status(): string {
      if (retained.size) return `${retained.size} completed ${retained.size === 1 ? 'game has' : 'games have'} unsaved performance data. Keep this page open and use Retry saving after freeing storage or allowing browser storage. Closing or reloading can lose unsaved data.`;
      if (acknowledged.size) return 'The server accepted an archive, but its saved queue could not be updated. Keep this page open and use Retry saving. Reloading may retry that upload.';
      if (unreadable) return 'Saved performance data could not be read and has been left untouched. Archive status is unknown. Allow browser storage and use Retry saving.';
      if (writeFailed) return 'Performance storage could not be updated. Keep this page open and use Retry saving.';
      return '';
    },
  };
}
export type PerformancePersistence = ReturnType<typeof createPerformancePersistence>;

function actorIdentity(seat: Seat, humanTracking: HumanTracking, meta: SessionMeta): {
  kind: ActorKind; name: string; profileId: string | null;
} {
  if (seat === 0) return {
    kind: humanTracking === 'owner' ? 'owner' : 'other-human',
    name: humanTracking === 'owner' ? 'Owner' : 'Other player',
    profileId: null,
  };
  if (seat === 2) return { kind: 'val', name: 'Val', profileId: 'val' };
  const opponent = meta.opponents.find(value => value.seat === seat);
  return {
    kind: 'opponent',
    name: opponent?.name ?? meta.seatNames[seat],
    profileId: opponent?.id ?? null,
  };
}

function compactHand(hand: ArchivedHandRecord): HandPerformance {
  const { decisions: _decisions, ...summary } = hand;
  return summary;
}

function compactGame(archive: ArchivedGameRecord): GamePerformance {
  return Object.freeze({
    schemaVersion: archive.schemaVersion,
    datasetEpoch: archive.datasetEpoch,
    buildCommit: archive.buildCommit,
    rulesVersion: archive.rulesVersion,
    id: archive.id,
    completedAt: archive.completedAt,
    humanTracking: archive.humanTracking,
    difficulty: archive.difficulty,
    startingDealer: archive.startingDealer,
    opponents: archive.opponents,
    winner: archive.winner,
    score: archive.score,
    hands: Object.freeze(archive.hands.map(compactHand)),
  });
}

/**
 * Records a compact local summary plus a richer server archive.
 * The archive stores exact permitted pre-decision views for the owner and all bots.
 * An untracked human contributes actions/public outcomes but never a private hand/view.
 */
export function createPerformanceRecorder(storage: StorageLike, options: RecorderOptions = {}): SessionObserver {
  const humanTracking = options.humanTracking ?? 'owner';
  const active = new Map<number, ActiveHand>();
  const completed: ArchivedHandRecord[] = [];
  let decisionSequence = 0;
  let recorded = false;
  const persistence = options.persistence ?? createPerformancePersistence(storage);
  let startingDealer: Seat | null = null;

  return {
    handStarted(view) {
      if (startingDealer === null) startingDealer = view.dealer;
      if (active.has(view.handNumber) || completed.some(hand => hand.handNumber === view.handNumber)) return;
      active.set(view.handNumber, {
        handNumber: view.handNumber,
        dealer: view.dealer,
        scoreBefore: [view.score[0], view.score[1]] as const,
        upCard: view.upCard,
        ownerStartingHand: humanTracking === 'owner' ? [...view.hand] : null,
        decisions: [],
      });
    },

    decision(seat, view, action, meta) {
      let hand = active.get(view.handNumber);
      if (!hand) {
        hand = {
          handNumber: view.handNumber,
          dealer: view.dealer,
          scoreBefore: [view.score[0], view.score[1]] as const,
          upCard: view.upCard,
          ownerStartingHand: humanTracking === 'owner' && seat === 0 ? [...view.hand] : null,
          decisions: [],
        };
        active.set(view.handNumber, hand);
      }
      const identity = actorIdentity(seat, humanTracking, meta);
      hand.decisions.push(Object.freeze({
        sequence: ++decisionSequence,
        seat,
        actorKind: identity.kind,
        actorName: identity.name,
        profileId: identity.profileId,
        view: seat === 0 && humanTracking === 'other' ? null : structuredClone(view),
        action: structuredClone(action),
      }));
    },

    handCompleted(view) {
      if (!view.result || view.caller === null) return;
      const base = active.get(view.handNumber);
      if (!base || completed.some(hand => hand.handNumber === view.handNumber)) return;
      completed.push(Object.freeze({
        handNumber: base.handNumber,
        dealer: base.dealer,
        scoreBefore: base.scoreBefore,
        scoreAfter: [view.score[0], view.score[1]] as const,
        upCard: base.upCard,
        ownerStartingHand: base.ownerStartingHand,
        decisions: Object.freeze([...base.decisions]),
        caller: view.caller,
        trump: view.trump,
        round: view.biddingRound,
        alone: view.alone,
        makerTricks: view.result.makerTricks,
        awardedTeam: view.result.team,
        points: view.result.points,
        reason: view.result.reason,
      }));
      active.delete(view.handNumber);
    },

    gameCompleted(view, meta: SessionMeta) {
      if (recorded) { persistence.retry(); options.persistenceChanged?.(); return; }
      if (view.winner === null || startingDealer === null) return;
      recorded = true;
      const book = loadPerformance(storage);
      const completedAt = options.completedAt?.() ?? 'local';
      const id = options.gameId ?? `local-${book.games.length + 1}-${view.handNumber}`;
      const buildCommit = options.buildCommit ?? 'development';
      const rulesVersion = options.rulesVersion ?? PERFORMANCE_RULES_VERSION;
      const opponents = Object.freeze(meta.opponents.map(opponent => Object.freeze({ ...opponent })));
      const hands = Object.freeze([...completed].sort((a, b) => a.handNumber - b.handNumber));
      const archive: ArchivedGameRecord = Object.freeze({
        schemaVersion: PERFORMANCE_SCHEMA_VERSION,
        datasetEpoch: PERFORMANCE_DATASET_EPOCH,
        buildCommit,
        rulesVersion,
        id,
        completedAt,
        humanTracking,
        difficulty: meta.difficulty,
        startingDealer,
        seatNames: Object.freeze([...meta.seatNames]) as SessionMeta['seatNames'],
        opponents,
        winner: view.winner,
        score: Object.freeze([view.score[0], view.score[1]]) as readonly [number, number],
        hands,
      });
      persistence.record(compactGame(archive), options.profileId ? {profileId: options.profileId, game: archive} : null, options.archiveQueued);
      options.persistenceChanged?.();
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
  const gamesInEpoch = currentGames(book);
  const ownerCaller = caller();
  const valCaller = caller();
  const botCallsBySeat = [0, 0, 0, 0] as [number, number, number, number];
  const profiles = new Map<string, OpponentSummary>();
  const ownerGames = gamesInEpoch.filter(game => game.humanTracking !== 'other');
  let wins = 0;
  let hands = 0;
  let botHands = 0;
  let ourPoints = 0;
  let theirPoints = 0;

  for (const game of gamesInEpoch) {
    const trackOwner = game.humanTracking !== 'other';
    if (trackOwner) {
      wins += Number(game.winner === 0);
      ourPoints += game.score[0];
      theirPoints += game.score[1];
    }
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
      botHands++;
      botCallsBySeat[hand.caller]++;
      if (trackOwner) {
        hands++;
        if (hand.caller === 0) addCaller(ownerCaller, hand);
      }
      if (hand.caller === 2) addCaller(valCaller, hand);
      if (hand.caller === 1 || hand.caller === 3) {
        const opponent = game.opponents.find(value => value.seat === hand.caller);
        const summary = opponent ? profiles.get(opponent.id) : undefined;
        if (summary) addCaller(summary, hand);
      }
    }
  }

  const recent = ownerGames.slice(-20);
  const recentWins = recent.reduce((sum, game) => sum + Number(game.winner === 0), 0);
  const games = ownerGames.length;
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
    ownerCaller,
    botGames: gamesInEpoch.length,
    botHands,
    botCallsBySeat,
    valCaller,
    opponents: [...profiles.values()].sort((a, b) => b.games - a.games || a.label.localeCompare(b.label)),
  };
}

export function ownerTrend(book: PerformanceBook, batchSize = 10): readonly OwnerTrendPoint[] {
  if (!Number.isSafeInteger(batchSize) || batchSize < 1) throw new RangeError('Batch size must be positive');
  const games = currentGames(book).filter(game => game.humanTracking !== 'other');
  const points: OwnerTrendPoint[] = [];
  for (let start = 0; start < games.length; start += batchSize) {
    const batch = games.slice(start, start + batchSize);
    const calls = batch.flatMap(game => game.hands).filter(hand => hand.caller === 0);
    const madeCalls = calls.filter(hand => hand.reason !== 'euchred').length;
    const firstGame = start + 1;
    const lastGame = start + batch.length;
    points.push({
      label: firstGame === lastGame ? `Game ${firstGame}` : `Games ${firstGame}–${lastGame}`,
      firstGame,
      lastGame,
      games: batch.length,
      winRate: 100 * batch.filter(game => game.winner === 0).length / batch.length,
      callSuccessRate: calls.length ? 100 * madeCalls / calls.length : null,
      averageScoreDifferential: batch.reduce((sum, game) => sum + game.score[0] - game.score[1], 0) / batch.length,
    });
  }
  return points;
}

function points(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}`;
}

export function performanceAnalysisText(book: PerformanceBook, batchSize = 10): string {
  const trend = ownerTrend(book, batchSize);
  const games = trend.reduce((sum, point) => sum + point.games, 0);
  if (!games) return 'No games recorded for my performance yet.';
  const latest = trend.at(-1)!;
  const latestCalls = latest.callSuccessRate === null
    ? 'no calls by you in this block'
    : `your calls succeeded ${Math.round(latest.callSuccessRate)} percent of the time`;
  if (trend.length === 1) {
    return `Analysis currently includes ${games} tracked ${games === 1 ? 'game' : 'games'}. ${latest.label}: win rate ${Math.round(latest.winRate)} percent; ${latestCalls}; average final-score differential ${points(latest.averageScoreDifferential)}. More completed games are needed for a multi-block trend.`;
  }
  const first = trend[0]!;
  const callChange = first.callSuccessRate === null || latest.callSuccessRate === null
    ? 'Calling-success comparison is not available because one comparison block contains no calls by you.'
    : `Your calling success changed from ${Math.round(first.callSuccessRate)} to ${Math.round(latest.callSuccessRate)} percent.`;
  return `Analysis includes ${games} tracked games in blocks of ${batchSize}. From ${first.label} to ${latest.label}, win rate changed from ${Math.round(first.winRate)} to ${Math.round(latest.winRate)} percent. ${callChange} Average final-score differential changed from ${points(first.averageScoreDifferential)} to ${points(latest.averageScoreDifferential)} points. The chart shows win rate and calling success for each game block; Other-player games are excluded from these human trends.`;
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
  const owner = summary.games
    ? (() => {
        const score = summary.averageFinalScore!;
        const recent = summary.recentGames
          ? ` Last ${summary.recentGames}: ${summary.recentWins} wins, ${percent(summary.recentWinRate)}.`
          : '';
        return `My tracked games: ${summary.games}. You and Val: ${summary.wins} wins, ${summary.losses} losses, ${percent(summary.winRate)}. Average final score: ${score[0].toFixed(1)} to ${score[1].toFixed(1)}.${recent} My tracked hands: ${summary.hands}. ${callLine('Your calling record', summary.ownerCaller)}`;
      })()
    : 'No games recorded for my performance yet.';
  if (!summary.botGames) return owner;
  const profiles = summary.opponents.length
    ? ` Opponent profiles encountered: ${summary.opponents.map(p => `${p.label}, ${p.games} games`).join('; ')}.`
    : '';
  return `${owner} Bot observations: ${summary.botGames} completed games, ${summary.botHands} hands. ${callLine('Val calling record', summary.valCaller)} Left-seat calls: ${summary.botCallsBySeat[1]}. Right-seat calls: ${summary.botCallsBySeat[3]}.${profiles}`;
}
