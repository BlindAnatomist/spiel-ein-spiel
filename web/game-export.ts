/** Read-only exports of existing completed matches. No storage migration or upload. */
import type { Action } from '../src/index.ts';
import type { HandReport, HandReportStore } from './hand-report.ts';
import { PERFORMANCE_STORAGE_KEY, PERFORMANCE_PENDING_ARCHIVE_KEY,
  type GamePerformance, type ArchivedGameRecord, type HandPerformance, type ArchivedHandRecord } from './performance.ts';

type Reader = { getItem(key: string): string | null };
export interface GameExport {
  format: 'euchre-completed-game-v1';
  gameId: string;
  completedAt: string;
  score: readonly [number, number];
  expectedHands: number;
  summary: GamePerformance | null;
  archive: ArchivedGameRecord | null;
  publicReports: HandReport[];
  sourceNotices: string[];
  coverage: string[];
  otherSummaryRecords: GamePerformance[];
  otherArchiveRecords: ArchivedGameRecord[];
}
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const number = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0;
const score = (v: unknown): v is [number,number] => Array.isArray(v) && v.length === 2 && v.every(number);
const card = (v: unknown) => typeof v === 'string' && /^(clubs|diamonds|hearts|spades):(9|10|J|Q|K|A)$/.test(v);
const seat = (v: unknown) => number(v) && v < 4;
const suit = (v: unknown) => ['clubs','diamonds','hearts','spades'].includes(v as string);
const action = (v: unknown): boolean => object(v) && (v.type === 'pass' ||
  ((v.type === 'play' || v.type === 'discard') && card(v.card)) ||
  (v.type === 'order-up' && typeof v.alone === 'boolean') ||
  (v.type === 'call' && suit(v.suit) && typeof v.alone === 'boolean'));
function hand(v: unknown): v is HandPerformance {
  return object(v) && number(v.handNumber) && v.handNumber > 0 && v.handNumber <= 1000 && seat(v.dealer)
    && score(v.scoreBefore) && score(v.scoreAfter) && card(v.upCard) && seat(v.caller) && suit(v.trump)
    && (v.round === 1 || v.round === 2) && typeof v.alone === 'boolean' && number(v.makerTricks)
    && (v.awardedTeam === 0 || v.awardedTeam === 1) && number(v.points)
    && ['made','march','loner-march','euchred'].includes(v.reason as string)
    && (v.ownerStartingHand === null || Array.isArray(v.ownerStartingHand) && v.ownerStartingHand.every(card));
}
function game(v: unknown): v is GamePerformance {
  return object(v) && v.schemaVersion === 2 && v.datasetEpoch === 1 && typeof v.id === 'string' && !!v.id
    && typeof v.buildCommit === 'string' && typeof v.rulesVersion === 'string' && typeof v.completedAt === 'string'
    && (v.humanTracking === 'owner' || v.humanTracking === 'other') && seat(v.startingDealer)
    && ['casual','strong','expert','mixed'].includes(v.difficulty as string)
    && (v.winner === 0 || v.winner === 1) && score(v.score) && v.score[v.winner] >= 10
    && Array.isArray(v.hands) && v.hands.length > 0 && v.hands.length <= 1000 && v.hands.every(hand)
    && Array.isArray(v.opponents) && v.opponents.every(o => object(o) && seat(o.seat) && typeof o.name === 'string' && typeof o.id === 'string' && typeof o.level === 'string' && typeof o.label === 'string');
}
function archive(v: unknown): v is ArchivedGameRecord {
  return game(v) && object(v) && Array.isArray(v.seatNames) && v.seatNames.length === 4 && v.seatNames.every(n => typeof n === 'string')
    && v.hands.every(h => object(h) && Array.isArray(h.decisions) && h.decisions.every(d => object(d) && number(d.sequence) && seat(d.seat)
      && typeof d.actorName === 'string' && action(d.action) && (d.view === null || object(d.view)
        && Array.isArray(d.view.hand) && d.view.hand.every(card) && Array.isArray(d.view.legalActions) && d.view.legalActions.every(action))));
}
function read(storage: Reader, key: string, label: string, notices: string[]): unknown {
  try { const raw = storage.getItem(key); if (raw === null) { notices.push(`${label}: not found in this browser.`); return null; } if (raw.length > 32_000_000) throw new Error('oversized'); return JSON.parse(raw); }
  catch { notices.push(`${label}: could not be read. Existing storage was left untouched.`); return null; }
}
const sameScore = (a: readonly number[], b: readonly number[]) => a[0] === b[0] && a[1] === b[1];
const missing = (n: number, present: number[]) => Array.from({length:n},(_,i)=>i+1).filter(h => !present.includes(h));
const numbers = (values: number[]) => values.length ? values.join(', ') : 'none';
function hasExpectedActions(h: ArchivedHandRecord) {
  const plays = h.decisions.filter(d => d.action.type === 'play');
  return plays.length === (h.alone ? 15 : 20) && h.decisions.filter(d => d.action.type === (h.round === 1 ? 'order-up' : 'call')).length === 1
    && (h.round !== 1 || h.decisions.filter(d => d.action.type === 'discard' && d.seat === h.dealer).length === 1);
}

export function readCompletedGameExports(storage: Reader, reports: HandReportStore): GameExport[] {
  const sourceNotices: string[] = [];
  const compact = read(storage,PERFORMANCE_STORAGE_KEY,'Saved scoring summaries',sourceNotices);
  const pending = read(storage,PERFORMANCE_PENDING_ARCHIVE_KEY,'Saved detailed decision records',sourceNotices);
  const summaries = object(compact) && compact.version === 2 && Array.isArray(compact.games) ? compact.games.filter(game) : [];
  const archives = Array.isArray(pending) ? pending.flatMap(item => object(item) && archive(item.game) ? [item.game] : []) : [];
  if (compact !== null && (!object(compact) || compact.version !== 2 || !Array.isArray(compact.games) || summaries.length !== compact.games.length)) sourceNotices.push('Some saved scoring data is unsupported or unreadable and was not included. It was left untouched.');
  if (pending !== null && (!Array.isArray(pending) || archives.length !== pending.length)) sourceNotices.push('Some saved detailed data is unsupported or unreadable and was not included. It was left untouched.');
  const publicReports = reports.reports();
  const finals = publicReports.filter(r => r.status === 'completed' && r.state.phase === 'game-over' && r.state.winner !== null && r.state.handNumber > 0 && r.state.handNumber <= 1000);
  if (publicReports.some(r => r.state.handNumber < 1 || r.state.handNumber > 1000)) sourceNotices.push('Some public reports have unsupported hand numbers and cannot define a whole-game export. They remain untouched and can still be copied individually.');
  const ids = new Set([...summaries.map(g=>g.id),...archives.map(g=>g.id),...finals.map(r=>r.gameId)]);
  return [...ids].map(gameId => {
    const summary = summaries.find(g=>g.id === gameId) ?? null;
    const detail = archives.find(g=>g.id === gameId) ?? null;
    const matching = publicReports.filter(r=>r.gameId === gameId).sort((a,b)=>a.state.handNumber-b.state.handNumber);
    const final = finals.find(r=>r.gameId === gameId);
    const finalScore = final?.state.score ?? detail?.score ?? summary!.score;
    const expectedHands = Math.max(final?.state.handNumber ?? 0,...(summary?.hands.map(h=>h.handNumber) ?? []),...(detail?.hands.map(h=>h.handNumber) ?? []));
    const publicHands = matching.filter(r=>r.status === 'completed' && r.state.completedTricks.length === 5 && r.state.handNumber >= 1 && r.state.handNumber <= expectedHands).map(r=>r.state.handNumber);
    const detailedHands = detail?.hands.map(h=>h.handNumber) ?? [];
    const suspectHands = detail?.hands.filter(h=>!hasExpectedActions(h)).map(h=>h.handNumber) ?? [];
    const scoringHands = [...(summary?.hands.map(h=>h.handNumber) ?? []),...(detail?.hands.map(h=>h.handNumber) ?? []),...publicHands];
    const coverage = [
      `Scoring coverage: ${new Set(scoringHands).size} of ${expectedHands} hands. Missing hands: ${numbers(missing(expectedHands,scoringHands))}.`,
      `Public trick records: ${new Set(publicHands).size} of ${expectedHands} hands. Missing hands: ${numbers(missing(expectedHands,publicHands))}.`,
      `Detailed decision records: ${new Set(detailedHands).size} of ${expectedHands} hands. Missing hand records: ${numbers(missing(expectedHands,detailedHands))}. These stored actions have not been independently replayed or verified complete.`,
    ];
    if (!detail) coverage.push('No readable detailed archive was found for this game. Hidden hands, exact bot views, and unrecorded choices cannot be recovered from a scoring summary.');
    else {
      if (suspectHands.length) coverage.push(`Warning: unexpected play, call or discard counts in detailed hands ${numbers(suspectHands)}. These records may be incomplete.`);
      const decisions = detail.hands.flatMap(h=>h.decisions);
      if (decisions.some((d,i)=>d.sequence !== i+1)) coverage.push('Warning: detailed decision numbering has gaps or duplicates. Do not treat it as a complete decision history.');
      if (detail.humanTracking === 'other') coverage.push('Bot data only: human private views were not recorded. Human actions and bot permitted views are included where available.');
    }
    const otherSummaryRecords = summaries.filter(g=>g.id === gameId && g !== summary);
    const otherArchiveRecords = archives.filter(g=>g.id === gameId && g !== detail);
    if (otherSummaryRecords.length || otherArchiveRecords.length) coverage.push('Warning: duplicate records exist for this game. Additional records are preserved in the evidence file; the first readable record is used in this text.');
    if (matching.some(r=>r.discardedEvents)) coverage.push('Some older public narration/checkpoint events were dropped by the existing per-hand limit; final trick records can still be present.');
    for (const g of [summary,detail]) {
      if (!g) continue;
      if (!sameScore(g.score,finalScore)) coverage.push('Warning: stored sources disagree about the final score. Both source records are retained in the evidence file.');
      const ordered = [...g.hands].sort((a,b)=>a.handNumber-b.handNumber);
      if (ordered.some((h,i)=>!sameScore(h.scoreBefore,i ? ordered[i-1]!.scoreAfter : [0,0])) || !sameScore(ordered.at(-1)!.scoreAfter,g.score)) coverage.push('Warning: a saved scoring sequence is incomplete or inconsistent.');
    }
    const normalized = (h: HandPerformance) => ({dealer:h.dealer,caller:h.caller,trump:h.trump,alone:h.alone,upCard:h.upCard,score:h.scoreAfter,makerTricks:h.makerTricks,team:h.awardedTeam,points:h.points,reason:h.reason});
    for (const n of new Set(scoringHands)) {
      const facts = [summary?.hands.find(h=>h.handNumber===n),detail?.hands.find(h=>h.handNumber===n)].filter((h): h is HandPerformance => !!h).map(normalized);
      const state = matching.find(r=>r.state.handNumber===n && r.status==='completed')?.state;
      if (state?.result) facts.push({dealer:state.dealer,caller:state.caller!,trump:state.trump,alone:state.alone,upCard:state.upCard,score:state.score,makerTricks:state.result.makerTricks,team:state.result.team,points:state.result.points,reason:state.result.reason});
      if (facts.some(f=>JSON.stringify(f)!==JSON.stringify(facts[0]))) coverage.push(`Warning: saved sources disagree about hand ${n}. The scoring header prefers the detailed archive, then summary; public trick records are shown separately. Check the original evidence before drawing conclusions.`);
    }
    if (summary && detail && (summary.difficulty !== detail.difficulty || summary.buildCommit !== detail.buildCommit || summary.winner !== detail.winner || JSON.stringify(summary.opponents)!==JSON.stringify(detail.opponents))) coverage.push('Warning: saved game metadata differs between summary and detailed archive. Both records are preserved in the evidence file.');
    return {format:'euchre-completed-game-v1' as const,gameId,completedAt:detail?.completedAt ?? summary?.completedAt ?? final!.updatedAt,
      score:finalScore,expectedHands,summary,archive:detail,publicReports:matching,
      sourceNotices:[...sourceNotices,`Public report status: ${reports.persistence()}`],coverage,otherSummaryRecords,otherArchiveRecords};
  }).sort((a,b)=>b.completedAt.localeCompare(a.completedAt));
}
function describeAction(a: Action) {
  if (a.type === 'pass') return 'pass';
  if (a.type === 'call') return `call ${a.suit}${a.alone ? ' alone' : ''}`;
  if (a.type === 'order-up') return `order up${a.alone ? ' alone' : ''}`;
  return `${a.type} ${a.card}`;
}
export function gameExportText(g: GameExport): string {
  const names = g.archive?.seatNames ?? g.publicReports[0]?.seatNames ?? ['You','West','Val','East'];
  const who = (seat: number) => `${names[seat]} (seat ${seat})`;
  const meta = g.archive ?? g.summary;
  const lines = ['Euchre completed game report, format 1',`Game ID: ${g.gameId}`,`Completed: ${g.completedAt}${!meta ? ' (last public checkpoint time)' : ''}`,
    `Final score: You + Val ${g.score[0]}, opponents ${g.score[1]}. Hands: ${g.expectedHands}.`,
    `Recorded difficulty: ${meta?.difficulty ?? 'not recorded in the available public reports'}.`,
    `Seats: ${names.map((n,i)=>`${i}: ${n}`).join('; ')}.`,
    `Played build(s): ${[...new Set([meta?.buildCommit,...g.publicReports.map(r=>r.buildCommit)].filter(Boolean))].join(', ')}.`,
    ...(meta ? [`Opponent profiles: ${meta.opponents.map(o=>`${o.name}: ${o.level}, ${o.id}`).join('; ')}.`] : []),
    ...g.coverage,...g.sourceNotices,
    'This export reads existing records only. Nothing is uploaded, erased, or restored as a playable game. Detailed bot views can reveal cards from this completed game; share only for game analysis.',
    'The evidence JSON also preserves the original available records, including public checkpoints and narration references. Narration events do not prove what was heard.'];
  for (let n=1;n<=g.expectedHands;n++) {
    const detail = g.archive?.hands.find(h=>h.handNumber===n);
    const summary = detail ?? g.summary?.hands.find(h=>h.handNumber===n);
    const report = g.publicReports.find(r=>r.state.handNumber===n);
    const s=report?.state;
    lines.push(`\nHAND ${n}`);
    if (!summary && !s) { lines.push('No hand record available.'); continue; }
    if (summary) lines.push(`Score ${summary.scoreBefore.join('–')} → ${summary.scoreAfter.join('–')}. Dealer ${who(summary.dealer)}. Up-card ${summary.upCard}. ${who(summary.caller)} called ${summary.trump}, round ${summary.round}${summary.alone ? ', alone' : ''}. Maker tricks ${summary.makerTricks}. ${summary.reason}: team ${summary.awardedTeam} +${summary.points}.`);
    else if (s) lines.push(`Score ${s.score.map((points,team) => points - (s.result?.team === team ? s.result.points : 0)).join('–')} → ${s.score.join('–')}. Dealer ${who(s.dealer)}. Up-card ${s.upCard}, ${s.upCardStatus}. Caller ${s.caller === null ? 'unknown' : who(s.caller)}. Trump ${s.trump}. Alone ${s.alone}. Result ${JSON.stringify(s.result)}.`);
    if (detail) {
      lines.push('Accepted decisions in order. Cards and legal options below are the actor’s recorded pre-action view. Other public context is retained in the evidence JSON.');
      for (const d of detail.decisions) lines.push(`${d.sequence}. ${who(d.seat)}: ${describeAction(d.action)}.${d.view ? ` Held [${d.view.hand.join(', ')}]. Legal [${d.view.legalActions.map(describeAction).join('; ')}].` : ' Private view not recorded.'}`);
    } else if (report) {
      // Keep bidding/public facts useful without repeating hundreds of large state snapshots.
      const facts = report.events.filter(e=>e.kind==='checkpoint').flatMap(e=>e.messages.filter(m=>!m.optional).map(m=>m.text));
      lines.push('Saved public action/narration facts (planned, not proof of playback):',...facts);
    }
    if (s) for (const [i,t] of s.completedTricks.entries()) lines.push(`Trick ${i+1}: ${t.plays.map(p=>`${who(p.seat)} ${p.card}`).join('; ')}. Winner ${who(t.winner)}.`);
    if (!detail && !report) lines.push('Only a scoring summary is available for this hand; actions and trick-by-trick play are missing.');
  }
  return lines.join('\n');
}
export const gameExportJson = (g: GameExport) => JSON.stringify(g,null,2);
