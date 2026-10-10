/** Device-local, public-information-only incident evidence. Never restores a game. */
import type { PlayerView } from '../src/index.ts';
import { writeVerified } from './verified-storage.ts';
import type { NarrationMessage, NarrationManifest } from './narration-types.ts';
import type { NarrationDiagnostic } from './narrator-audio.ts';
import type { SeatNames } from './presentation.ts';
import type { ControllerObservation } from './controller.ts';

export const HAND_REPORT_KEY = 'euchre-hand-reports-v1';
export const HAND_REPORT_LIMIT = 8;
export const HAND_REPORT_EVENT_LIMIT = 512;
export interface ReportStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }
export interface ReportIdentity { gameId: string; buildCommit: string; catalogSha: string; seatNames: SeatNames }
export interface PublicHand {
  handNumber: number; phase: PlayerView['phase']; dealer: PlayerView['dealer']; turn: PlayerView['turn'];
  trump: PlayerView['trump']; caller: PlayerView['caller']; alone: boolean; sittingOut: PlayerView['sittingOut'];
  upCard: PlayerView['upCard']; upCardStatus: PlayerView['upCardStatus'];
  trick: PlayerView['trick']; completedTricks: PlayerView['completedTricks']; score: PlayerView['score'];
  result: PlayerView['result']; winner: PlayerView['winner'];
}
interface ClipReference { id: string; sha256: string; text: string; url: string }
interface PlannedMessage { text: string; optional: boolean; whole: string | null; clips: string[] }
export interface ReportEvent {
  sequence: number; at: string; kind: string; checkpoint: number; detail: string;
  audioEventId: number | null; clips: ClipReference[]; state: PublicHand | null; messages: PlannedMessage[];
}
export interface HandReport extends ReportIdentity {
  id: string; createdAt: string; updatedAt: string; state: PublicHand; status: 'in-progress' | 'completed';
  control: string; sequence: number; discardedEvents: number; events: ReportEvent[];
}
interface ReportBook { version: 1; reports: HandReport[] }
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
/** Explicit allowlist: no hand, legal actions, discard identity, seed, deck or RNG. */
export function publicHand(view: PlayerView): PublicHand {
  return clone({ handNumber:view.handNumber, phase:view.phase, dealer:view.dealer, turn:view.turn,
    trump:view.trump, caller:view.caller, alone:view.alone, sittingOut:view.sittingOut, upCard:view.upCard,
    upCardStatus:view.upCardStatus, trick:view.trick.map(p => ({seat:p.seat,card:p.card})),
    completedTricks:view.completedTricks.map(t => ({winner:t.winner,plays:t.plays.map(p => ({seat:p.seat,card:p.card}))})),
    score:[...view.score] as [number,number], result:view.result ? {makerTricks:view.result.makerTricks,team:view.result.team,points:view.result.points,reason:view.result.reason} : null, winner:view.winner });
}
const hasPlay = (report: HandReport) => report.state.trick.length > 0 || report.state.completedTricks.length > 0;
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const str = (value: unknown, max = 1200): value is string => typeof value === 'string' && value.length <= max;
const integer = (value: unknown, max = 1000000): value is number => Number.isInteger(value) && (value as number) >= 0 && (value as number) <= max;
const seat = (value: unknown) => integer(value,3);
const nullableSeat = (value: unknown) => value === null || seat(value);
const suit = (value: unknown) => ['clubs','diamonds','hearts','spades'].includes(value as string);
const card = (value: unknown) => typeof value === 'string' && /^(clubs|diamonds|hearts|spades):(9|10|J|Q|K|A)$/.test(value);
const array = (value: unknown, max: number, valid: (v: unknown) => boolean): boolean => Array.isArray(value) && value.length <= max && value.every(valid);
const play = (value: unknown) => object(value) && seat(value.seat) && card(value.card) && Object.keys(value).length === 2;
const exactKeys = (value: Record<string, unknown>, keys: string) => Object.keys(value).sort().join(',') === keys.split(' ').sort().join(',');
function validState(v: unknown): v is PublicHand {
  return object(v) && exactKeys(v,'handNumber phase dealer turn trump caller alone sittingOut upCard upCardStatus trick completedTricks score result winner')
    && integer(v.handNumber) && ['bidding','discarding','playing','hand-over','game-over'].includes(v.phase as string)
    && seat(v.dealer) && nullableSeat(v.turn) && (v.trump === null || suit(v.trump)) && nullableSeat(v.caller)
    && typeof v.alone === 'boolean' && nullableSeat(v.sittingOut) && card(v.upCard) && ['face-up','ordered','turned-down'].includes(v.upCardStatus as string)
    && array(v.trick,4,play) && array(v.completedTricks,5,t => object(t) && exactKeys(t,'winner plays') && seat(t.winner) && array(t.plays,4,play))
    && Array.isArray(v.score) && v.score.length === 2 && v.score.every(s => integer(s,20)) && (v.winner === null || integer(v.winner,1))
    && (v.result === null || object(v.result) && exactKeys(v.result,'makerTricks team points reason') && integer(v.result.makerTricks,5)
      && integer(v.result.team,1) && integer(v.result.points,4) && ['made','march','loner-march','euchred'].includes(v.result.reason as string));
}
function validEvent(v: unknown): v is ReportEvent {
  return object(v) && exactKeys(v,'sequence at kind checkpoint detail audioEventId clips state messages') && integer(v.sequence) && str(v.at,40)
    && str(v.kind,80) && integer(v.checkpoint) && str(v.detail) && (v.audioEventId === null || integer(v.audioEventId))
    && array(v.clips,8,c => object(c) && exactKeys(c,'id sha256 text url') && str(c.id,200) && str(c.sha256,64) && str(c.text) && str(c.url,250))
    && (v.state === null || validState(v.state)) && array(v.messages,12,m => object(m) && exactKeys(m,'text optional whole clips') && str(m.text)
      && typeof m.optional === 'boolean' && (m.whole === null || str(m.whole,200)) && array(m.clips,8,c => str(c,200)));
}
function validReport(v: unknown): v is HandReport {
  return object(v) && exactKeys(v,'id gameId buildCommit catalogSha seatNames createdAt updatedAt state status control sequence discardedEvents events')
    && str(v.id,200) && str(v.gameId,120) && str(v.buildCommit,120) && str(v.catalogSha,120)
    && Array.isArray(v.seatNames) && v.seatNames.length === 4 && v.seatNames.every(n => str(n,80))
    && str(v.createdAt,40) && str(v.updatedAt,40) && validState(v.state) && ['in-progress','completed'].includes(v.status as string)
    && str(v.control,80) && integer(v.sequence) && integer(v.discardedEvents) && array(v.events,HAND_REPORT_EVENT_LIMIT,validEvent);
}

function readBook(raw: string | null): ReportBook {
  if (raw === null) return {version:1,reports:[]};
  const parsed: unknown = raw.length < 8_000_000 ? JSON.parse(raw) : null;
  if (object(parsed) && parsed.version !== 1) throw new Error('unsupported-version');
  if (!object(parsed) || !exactKeys(parsed,'version reports') || !array(parsed.reports,HAND_REPORT_LIMIT+1,validReport)) throw new Error('unreadable-data');
  return parsed as unknown as ReportBook;
}
export function createHandReportStore(storage: ReportStorage, key = HAND_REPORT_KEY) {
  let book: ReportBook = {version:1,reports:[]};
  let persistence = 'No hand report saved yet.';
  let blocked = false;
  // An evicted old recorder may still finish a cancellation microtask. It cannot
  // resurrect an obsolete unplayed hand over the new one.
  const retired = new Set<string>();
  function readFailure(error: unknown) {
    blocked = true;
    persistence = error instanceof Error && error.message === 'unsupported-version'
      ? 'Existing reports use an unsupported version. They have been left untouched. New reports are available only while this page stays open.'
      : 'The saved report data could not be read. It has been left untouched. New reports are available only while this page stays open. Reopen the preview to try reading storage again.';
  }
  try {
    const raw = storage.getItem(key); book = readBook(raw);
    if (raw !== null) persistence = 'Reports recovered from this browser’s device-local storage.';
  } catch (error) { readFailure(error); }
  function save() {
    if (blocked) return;
    try {
      const raw = JSON.stringify(book);
      writeVerified(storage, key, raw); // One atomic replacement after every checkpoint or diagnostic.
      persistence = 'Latest report changes saved in this browser’s device-local storage.';
    } catch { persistence = 'Latest report changes could not be saved on this device. They are available in this open page; older saved data may remain. Copy the report before closing.'; }
  }
  return {
    reports: () => clone(book.reports),
    persistence: () => persistence,
    put(report: HandReport) {
      if (retired.has(report.id) && !hasPlay(report)) return;
      if (hasPlay(report)) retired.delete(report.id);
      // Re-read before writing so sequential updates from another open copy do
      // not replace its reports with our startup snapshot. localStorage cannot
      // provide cross-window transactions; simultaneous writes remain best effort.
      let merged = [...book.reports];
      if (!blocked) {
        try {
          for (const other of readBook(storage.getItem(key)).reports) {
            if (retired.has(other.id) && !hasPlay(other)) continue;
            if (hasPlay(other)) retired.delete(other.id);
            const index = merged.findIndex(r => r.id === other.id);
            if (index < 0) merged.push(other);
            else if (other.sequence > merged[index]!.sequence) merged[index] = other;
          }
        } catch (error) { readFailure(error); }
      }
      const index = merged.findIndex(r => r.id === report.id);
      if (index < 0) merged.unshift(clone(report));
      else if (report.sequence >= merged[index]!.sequence) merged[index] = clone(report);
      merged.sort((a,b) => b.createdAt.localeCompare(a.createdAt));
      const played = merged.filter(hasPlay).slice(0,HAND_REPORT_LIMIT);
      const unplayed = merged.find(r => !hasPlay(r));
      const reports = merged.filter(r => played.includes(r) || r === unplayed);
      for (const old of merged) if (!reports.includes(old)) retired.add(old.id);
      book = {version:1,reports}; save();
    },
  };
}
export type HandReportStore = ReturnType<typeof createHandReportStore>;

export function createHandReportRecorder(store: HandReportStore, identity: ReportIdentity, manifest: NarrationManifest,
  now = () => new Date().toISOString()) {
  let report: HandReport | undefined;
  let checkpoint = 0;
  const audioCheckpoints = new Map<number, number>();
  function append(kind: string, detail: string, extra: Partial<Pick<ReportEvent,'audioEventId'|'clips'|'state'|'messages'|'checkpoint'>> = {}) {
    if (!report) return;
    report.updatedAt = now();
    report.events.push({sequence:++report.sequence,at:report.updatedAt,kind,checkpoint,detail,audioEventId:null,clips:[],state:null,messages:[],...extra});
    while (report.events.length > HAND_REPORT_EVENT_LIMIT) { report.events.shift(); report.discardedEvents++; }
    store.put(report);
  }
  function observe(event: ControllerObservation) {
    const state = publicHand(event.view);
    if (!report || report.state.handNumber !== state.handNumber) {
      report = {...clone(identity), id:`${identity.gameId}:${state.handNumber}`,createdAt:now(),updatedAt:now(),state,status:'in-progress',control:'running',sequence:0,discardedEvents:0,events:[]};
      checkpoint = 0; audioCheckpoints.clear();
    }
    report.state = state;
    report.status = state.result ? 'completed' : 'in-progress';
    if (event.kind === 'pause' || event.kind === 'stop') report.control = event.kind === 'pause' ? 'paused' : 'stopped';
    if (event.kind === 'resume') report.control = 'running';
    if (event.kind === 'checkpoint') checkpoint = report.sequence + 1;
    append(event.kind, `Game event ${event.gameEventId ?? 'none'}; pacing ${event.pacing}; recorded narrator ${event.audioEnabled ? 'enabled' : 'disabled'}.`,
      {state, messages:(event.messages ?? []).map((m: string | NarrationMessage) => ({text:typeof m === 'string' ? m : m.text,optional:typeof m === 'string' ? false : !!m.optional,whole:typeof m === 'string' ? null : m.whole ?? null,clips:typeof m === 'string' ? [] : [...m.clips]}))});
  }
  return {
    observe,
    liveText(text: string) { append('live-region',text || '(cleared)'); },
    diagnostic(event: NarrationDiagnostic) {
      if (!report) return;
      if (!audioCheckpoints.has(event.eventId)) audioCheckpoints.set(event.eventId,checkpoint);
      append(`audio-${event.outcome}`,`${event.fact} Requested whole: ${event.requestedWhole ?? 'none'}. Media clock: ${event.timeMs}. Reason: ${event.reason ?? 'none'}.`,
        {audioEventId:event.eventId,checkpoint:audioCheckpoints.get(event.eventId)!,clips:event.clips.map(id => ({id,sha256:manifest[id]?.sha256 ?? '',text:manifest[id]?.text ?? '(not in manifest)',url:manifest[id]?.url ?? ''}))});
    },
  };
}

export const REPORT_STORAGE_NOTICE = 'Only public played cards and public table facts are kept, plus narration references. No unplayed hands, deck, seed or random state. Nothing is uploaded automatically. This is a report, not a saved playable game. The last 8 hands with played cards and the newest unplayed hand are retained. Closing and reopening the same preview can recover them only if this browser or embedded app keeps its local storage; clearing it, switching browser or using another preview address can lose access.';
export function handReportText(report: HandReport, persistence: string): string {
  const who = (seat: number) => `${report.seatNames[seat]} (seat ${seat})`;
  const plays = (items: PublicHand['trick']) => items.map((p,i) => `${i+1}. ${who(p.seat)}: ${p.card}`).join('; ');
  const state = report.state;
  return [
    'Euchre saved hand report, format 1',
    persistence, REPORT_STORAGE_NOTICE,
    'Evidence limits: planned or selected recordings are not proof of audible speech. Media-playing and ended are browser media events, not verification of spoken content or VoiceOver output. Live-region writes do not prove they were heard. Focus speech is not recorded. The game state may advance before narration finishes.',
    `Report: ${report.id}. Build: ${report.buildCommit}. Recording catalog SHA256: ${report.catalogSha}.`,
    `Created: ${report.createdAt}. Last checkpoint: ${report.updatedAt}.`,
    `Hand ${state.handNumber}: ${report.status === 'completed' ? 'completed' : 'in progress at last checkpoint'}. Last controls: ${report.control}. Phase: ${state.phase}.`,
    `Seats: ${report.seatNames.map((name,i) => `${i}: ${name}`).join('; ')}.`,
    `Trump: ${state.trump ?? 'not called'}. Dealer: ${who(state.dealer)}. Caller: ${state.caller === null ? 'none' : who(state.caller)}. Alone: ${state.alone}. Sitting out: ${state.sittingOut === null ? 'none' : who(state.sittingOut)}.`,
    `Up-card (public historical identity): ${state.upCard}, ${state.upCardStatus}.`,
    ...state.completedTricks.map((t,i) => `Completed trick ${i+1}: ${plays(t.plays)}. Engine winner: ${who(t.winner)}.`),
    `Current unfinished trick: ${plays(state.trick) || 'none'}. Next turn: ${state.turn === null ? 'none' : who(state.turn)}.`,
    `Score: ${state.score.join(' to ')}. Hand result: ${JSON.stringify(state.result)}. Game winning team: ${state.winner ?? 'none'}.`,
    `Ordered evidence follows. Checkpoint links identify the accepted public state before narration. Omitted oldest events: ${report.discardedEvents}; the latest public trick record above remains intact.`,
    ...report.events.map(e => `${e.sequence}. ${e.at} ${e.kind}; checkpoint ${e.checkpoint}; audio event ${e.audioEventId ?? 'none'}. ${e.detail}\n${e.state ? `Public checkpoint: ${JSON.stringify(e.state)}\n` : ''}${e.messages.length ? `Planned messages (not playback): ${JSON.stringify(e.messages)}\n` : ''}${e.clips.length ? `Recording references: ${JSON.stringify(e.clips)}` : ''}`),
  ].join('\n\n');
}
