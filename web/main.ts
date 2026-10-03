import { createHandReportStore, createHandReportRecorder } from './hand-report.ts';
import { createHandReportPanel } from './hand-report-panel.ts';
import { readCompletedGameExports } from './game-export.ts';
import { createSoundCues } from './sound.ts';
import type { Seat } from '../src/index.ts';
import { selectSeatNames } from '../src/bots/profiles.ts';
import { createSession, type Difficulty } from './session.ts';
import {
  createPerformanceRecorder,
  ensurePerformanceProfile,
  PERFORMANCE_DATASET_EPOCH,
  PERFORMANCE_RULES_VERSION,
  PERFORMANCE_SCHEMA_VERSION,
  loadPendingArchives,
  loadPerformance,
  mergePerformanceBooks,
  markPerformanceArchived,
  removePerformanceGame,
  ownerTrend,
  performanceAnalysisText,
  performanceText,
  summarizePerformance,
  type HumanTracking,
  type PerformanceArchiveItem,
  type PerformanceBook,
  type StorageLike,
} from './performance.ts';
import { createTable } from './render.ts';
import { createController } from './controller.ts';
import { createNarratorAudio } from './narrator-audio.ts';
import type { NarrationDiagnostic } from './narrator-audio.ts';
import { narrationAssets } from './narrator-assets.ts';
import { createNarratorFlavorHistory } from './narrator-flavor.ts';

declare const __BUILD_COMMIT__: string;
declare const __DEPLOY_CONTEXT__: string;
declare const __NARRATOR_ASSETS_READY__: boolean;
declare const __NARRATOR_CATALOG_SHA__: string;
const buildCommit = typeof __BUILD_COMMIT__ === 'string' ? __BUILD_COMMIT__ : 'development';
let controller: ReturnType<typeof createController> | undefined;
let narratorOutput: ReturnType<typeof createNarratorAudio> | undefined;
const narratorDiagnostics = { schema: 1, buildCommit, catalogSha: typeof __NARRATOR_CATALOG_SHA__ === 'string' ? __NARRATOR_CATALOG_SHA__ : 'development', mode: 'whole-sentences', totals: {completed:0, fallbacks:0}, events: [] as NarrationDiagnostic[] };
let narratorEventId = 0;
Object.defineProperty(window, 'euchreNarratorDiagnostics', { get: () => ({
  ...structuredClone(narratorDiagnostics),
  selectedNarrator: document.querySelector<HTMLButtonElement>('#narrator')?.value ?? 'unavailable',
  gameStarted: !!controller,
  audioEnabled: narratorOutput?.enabled() ?? false,
  paused: controller?.isPaused() ?? false,
  catalogEntries: Object.keys(narrationAssets).length,
  buildAssetsVerified: typeof __NARRATOR_ASSETS_READY__ === 'boolean' ? __NARRATOR_ASSETS_READY__ : null,
}) });
const deployContext = typeof __DEPLOY_CONTEXT__ === 'string' ? __DEPLOY_CONTEXT__ : 'development';
const privatePreview = deployContext === 'narrator-preview';
document.querySelector<HTMLElement>('#preview-notice')!.hidden = !privatePreview;
if (privatePreview) document.querySelector<HTMLElement>('#preview-notice')!.textContent = `Private preview · ${buildCommit.slice(0, 7)}`;
// Unlike the legacy performance adapter, this adapter must let storage failures surface.
const handReports = createHandReportStore({
  getItem: key => window.localStorage.getItem(key),
  setItem: (key,value) => window.localStorage.setItem(key,value),
}, `${privatePreview ? 'narrator-preview:' : ''}euchre-hand-reports-v1`);
const handReportPanel = createHandReportPanel(document, handReports, pauseGame, () => readCompletedGameExports({
  getItem: key => window.localStorage.getItem(`${privatePreview ? 'narrator-preview:' : ''}${key}`),
}, handReports));
const narratorButton = document.querySelector<HTMLButtonElement>('#narrator')!;
const pauseButton = document.querySelector<HTMLButtonElement>('#pause-game')!;
const narratorCaption = document.querySelector<HTMLElement>('#narrator-caption')!;
const narratorStatusOutput = document.querySelector<HTMLElement>('#narrator-status-output')!;
if (typeof __NARRATOR_ASSETS_READY__ === 'boolean' && !__NARRATOR_ASSETS_READY__) {
  narratorButton.disabled = true;
  const availability = document.querySelector<HTMLElement>('#narrator-availability')!;
  availability.hidden = false;
  availability.textContent = 'Peter narration is unavailable until the private recordings are restored.';
}

const sounds = createSoundCues();
const soundToggle = document.querySelector<HTMLButtonElement>('#sound-cues')!;
soundToggle.onclick = () => {
  const enabled = soundToggle.getAttribute('aria-pressed') !== 'true';
  soundToggle.setAttribute('aria-pressed', String(enabled)); sounds.setEnabled(enabled);
};

const startButton = document.querySelector<HTMLButtonElement>('#start-game')!;
const helpButton = document.querySelector<HTMLButtonElement>('#help-button')!;
const helpPanel = document.querySelector<HTMLElement>('#help-panel')!;
helpButton.onclick = () => {
  const opening = helpPanel.hidden;
  if (!opening) handReportPanel.hide(helpButton);
  helpPanel.hidden = !opening;
  helpButton.setAttribute('aria-expanded', String(opening));
};

const storage: StorageLike = {
  getItem(key) {
    try { return window.localStorage.getItem(`${privatePreview ? 'narrator-preview:' : ''}${key}`); } catch { return null; }
  },
  setItem(key, value) {
    try { window.localStorage.setItem(`${privatePreview ? 'narrator-preview:' : ''}${key}`, value); } catch {}
  },
};

function recoveryId(): string {
  return [...crypto.getRandomValues(new Uint32Array(4))]
    .map(value => value.toString(16).padStart(8, '0')).join('-');
}

// Remove the single owner-tracked Casual game from Cynthia's 2026-09-25 sighted test.
removePerformanceGame(storage, '8bc51155-e8a4-4773-984a-02a7bfc536ed');
const profileId = ensurePerformanceProfile(storage, recoveryId);
const trackingToggle = document.querySelector<HTMLButtonElement>('#human-tracking')!;
const analysisButton = document.querySelector<HTMLButtonElement>('#performance-analysis')!;
const analysisPanel = document.querySelector<HTMLElement>('#analysis-panel')!;
const analysisChart = document.querySelector<HTMLElement>('#analysis-chart')!;
const performanceOutput = document.querySelector<HTMLElement>('#performance-output')!;
let humanTracking: HumanTracking = 'other';
function updateTrackingToggle() {
  const owner = humanTracking === 'owner';
  trackingToggle.setAttribute('aria-pressed', String(owner));
  trackingToggle.textContent = owner ? 'My performance' : 'Bot data only';
  trackingToggle.setAttribute('aria-label', owner
    ? 'My performance. VoiceOver pacing.'
    : narratorButton.value === 'peter' ? 'Bot data only. Recorded narrator pacing.' : 'Bot data only. Faster visual pacing.');
}
updateTrackingToggle();
trackingToggle.onclick = () => {
  humanTracking = humanTracking === 'owner' ? 'other' : 'owner';
  updateTrackingToggle();
};

function svgElement(name: string, attributes: Record<string, string> = {}): SVGElement {
  const element = document.createElementNS('http://www.w3.org/2000/svg', name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  return element;
}

function renderAnalysisChart(book: PerformanceBook): void {
  const trend = ownerTrend(book);
  analysisChart.replaceChildren();
  analysisPanel.hidden = trend.length === 0;
  if (!trend.length) return;

  const width = 680;
  const height = 300;
  const left = 54;
  const right = 20;
  const top = 24;
  const bottom = 58;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const svg = svgElement('svg', {
    viewBox: `0 0 ${width} ${height}`,
    role: 'img',
    'aria-hidden': 'true',
    focusable: 'false',
  });

  for (const value of [0, 25, 50, 75, 100]) {
    const y = top + plotHeight - (value / 100) * plotHeight;
    svg.append(svgElement('line', { x1: String(left), y1: String(y), x2: String(width - right), y2: String(y), class: 'analysis-grid' }));
    const label = svgElement('text', { x: String(left - 8), y: String(y + 4), 'text-anchor': 'end', class: 'analysis-axis-label' });
    label.textContent = `${value}%`;
    svg.append(label);
  }

  const x = (index: number) => trend.length === 1 ? left + plotWidth / 2 : left + (index / (trend.length - 1)) * plotWidth;
  const y = (value: number) => top + plotHeight - (value / 100) * plotHeight;
  const winPoints = trend.map((point, index) => `${x(index)},${y(point.winRate)}`).join(' ');
  const callPoints = trend.flatMap((point, index) => point.callSuccessRate === null ? [] : [`${x(index)},${y(point.callSuccessRate)}`]);

  svg.append(svgElement('polyline', { points: winPoints, class: 'analysis-line win-line', fill: 'none' }));
  if (callPoints.length > 1) svg.append(svgElement('polyline', { points: callPoints.join(' '), class: 'analysis-line call-line', fill: 'none' }));

  trend.forEach((point, index) => {
    const win = svgElement('circle', { cx: String(x(index)), cy: String(y(point.winRate)), r: '5', class: 'analysis-point win-point' });
    svg.append(win);
    if (point.callSuccessRate !== null) {
      svg.append(svgElement('circle', { cx: String(x(index)), cy: String(y(point.callSuccessRate)), r: '5', class: 'analysis-point call-point' }));
    }
    const label = svgElement('text', { x: String(x(index)), y: String(height - 28), 'text-anchor': 'middle', class: 'analysis-axis-label' });
    label.textContent = point.firstGame === point.lastGame ? String(point.firstGame) : `${point.firstGame}–${point.lastGame}`;
    svg.append(label);
  });

  analysisChart.append(svg);
}

async function historyRequest(body: Record<string, unknown>): Promise<Response> {
  return fetch('/api/performance-history', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function loadServerPerformance(): Promise<PerformanceBook> {
  if (privatePreview) return { version: 2, games: [] };
  try {
    const response = await historyRequest({ action: 'list', profileId });
    if (!response.ok) return { version: 2, games: [] };
    const parsed: unknown = await response.json();
    if (!parsed || typeof parsed !== 'object') return { version: 2, games: [] };
    const candidate = parsed as { games?: unknown };
    if (!Array.isArray(candidate.games)) return { version: 2, games: [] };
    return { version: 2, games: candidate.games as PerformanceBook['games'] };
  } catch {
    return { version: 2, games: [] };
  }
}

async function submitAnalysisGame(item: PerformanceArchiveItem): Promise<void> {
  const response = await historyRequest({ action: 'upsert', profileId, environment: deployContext, game: item.game });
  if (!response.ok) throw new Error(`Analysis history sync failed with status ${response.status}`);
}

analysisButton.onclick = async () => {
  analysisButton.disabled = true;
  performanceOutput.textContent = 'Loading complete performance history.';
  performanceOutput.hidden = false;
  try {
    const book = mergePerformanceBooks(await loadServerPerformance(), loadPerformance(storage));
    const pending = loadPendingArchives(storage).length;
    const archive = privatePreview ? ' This preview keeps performance on this device only; production history is separate.' : pending
      ? ` Server archive pending: ${pending} completed ${pending === 1 ? 'game' : 'games'}.`
      : ' Server archive is current.';
    performanceOutput.textContent = `${performanceText(summarizePerformance(book))} ${performanceAnalysisText(book)}${archive} Recovery code: ${profileId}.`;
    renderAnalysisChart(book);
    performanceOutput.focus();
  } finally {
    analysisButton.disabled = false;
  }
};

async function submitArchive(item: PerformanceArchiveItem): Promise<void> {
  const body = new URLSearchParams({
    'form-name': 'euchre-performance-ledger',
    profile_id: item.profileId,
    game_id: item.game.id,
    completed_at: item.game.completedAt,
    human_tracking: item.game.humanTracking,
    schema_version: String(PERFORMANCE_SCHEMA_VERSION),
    dataset_epoch: String(PERFORMANCE_DATASET_EPOCH),
    build_commit: item.game.buildCommit,
    rules_version: PERFORMANCE_RULES_VERSION,
    payload: JSON.stringify(item.game),
  });
  // Rich decision transcripts can exceed the browser keepalive body limit.
  // The persistent pending queue already provides retry-after-reload durability.
  const response = await fetch('/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!response.ok) throw new Error(`Performance archive failed with status ${response.status}`);
}

let archiveFlushing = false;
async function flushPerformanceArchive(): Promise<void> {
  if (privatePreview) return;
  if (archiveFlushing) return;
  archiveFlushing = true;
  try {
    for (const item of loadPendingArchives(storage)) {
      try {
        await submitAnalysisGame(item);
        await submitArchive(item);
        markPerformanceArchived(storage, item.game.id);
      } catch {
        break;
      }
    }
  } finally {
    archiveFlushing = false;
  }
}
void flushPerformanceArchive();

const root = document.querySelector<HTMLElement>('#game')!;
const live = document.querySelector<HTMLElement>('#announcements')!;
const narratorFlavorHistory = createNarratorFlavorHistory(Math.random, privatePreview ? {
  load: () => storage.getItem('narrator-dialogue-history-v1'),
  save: value => storage.setItem('narrator-dialogue-history-v1',value),
} : undefined);
const randomWord = () => crypto.getRandomValues(new Uint32Array(1))[0]!;

function pauseGame() {
  if (!controller) return;
  controller.pause();
  pauseButton.textContent = 'Resume game';
}
function hideNarratorStatus(focusTarget?: HTMLElement) {
  if (document.activeElement === narratorStatusOutput && focusTarget) focusTarget.focus();
  narratorStatusOutput.hidden = true;
  narratorStatusOutput.textContent = '';
}
document.querySelector<HTMLButtonElement>('#narrator-status')!.onclick = () => {
  pauseGame();
  const who = narratorButton.value === 'peter' ? 'Peter' : 'Original VoiceOver';
  narratorStatusOutput.textContent = `Narrator: ${who}. Full-sentence preview, version ${buildCommit.slice(0, 7)}. ${controller ? 'Game paused.' : 'No game started.'} Since this page opened: ${narratorDiagnostics.totals.completed} recordings finished; ${narratorDiagnostics.totals.fallbacks} audio failures.`;
  narratorStatusOutput.hidden = false;
  narratorStatusOutput.focus();
};
pauseButton.onclick = () => {
  if (!controller) return;
  if (controller.isPaused()) {
    handReportPanel.hide(pauseButton);
    hideNarratorStatus(pauseButton);
    pauseButton.textContent = 'Pause game';
    narratorOutput?.prime();
    void controller.resume();
  } else pauseGame();
};
narratorButton.onclick = () => {
  narratorButton.value = narratorButton.value === 'peter' ? 'original' : 'peter';
  narratorButton.textContent = narratorButton.value === 'peter' ? 'Narrator: Peter' : 'Narrator: VoiceOver';
  hideNarratorStatus(narratorButton);
  updateTrackingToggle();
  if (controller) {
    pauseGame();
    narratorOutput?.setEnabled(narratorButton.value === 'peter');
    narratorOutput?.prime();
  }
};
// Suspension cannot silently skip a sequence or leave stale audio playing behind another page.
document.addEventListener('visibilitychange', () => { if (document.hidden && narratorOutput?.enabled()) pauseGame(); });
window.addEventListener('pagehide', () => { if (narratorOutput?.enabled()) pauseGame(); });

document.querySelector<HTMLFormElement>('#setup')!.onsubmit = event => {
  event.preventDefault();
  controller?.stop(); live.textContent = '';
  narratorOutput?.cancel();
  narratorFlavorHistory.beginGame();
  handReportPanel.hide(startButton);
  hideNarratorStatus(startButton);
  pauseButton.hidden = false;
  pauseButton.textContent = 'Pause game';
  startButton.textContent = 'New game';
  helpPanel.hidden = true;
  helpButton.setAttribute('aria-expanded', 'false');
  performanceOutput.hidden = true;
  analysisPanel.hidden = true;
  analysisChart.replaceChildren();
  const selectedHumanTracking = humanTracking;
  humanTracking = 'other';
  updateTrackingToggle();
  const level = document.querySelector<HTMLSelectElement>('#difficulty')!.value as Difficulty;
  // Live games use browser cryptographic randomness for the starting dealer and every shuffle.
  const dealer = (randomWord() & 3) as Seat;
  const seed = randomWord();
  const seatNames = selectSeatNames(level, seed);
  const gameId = crypto.randomUUID();
  const handRecorder = createHandReportRecorder(handReports, {gameId,buildCommit,catalogSha:narratorDiagnostics.catalogSha,seatNames}, narrationAssets);
  const session = createSession(seed, level, {
    dealer,
    randomWord,
    observer: createPerformanceRecorder(storage, {
      profileId,
      gameId,
      humanTracking: selectedHumanTracking,
      buildCommit,
      rulesVersion: PERFORMANCE_RULES_VERSION,
      completedAt: () => new Date().toISOString(),
      archiveQueued: () => { void flushPerformanceArchive(); },
    }),
    opponentMode: 'varied',
    seatNames,
  });
  root.hidden = false;
  const table = createTable(root, { act: action => { void controller!.act(action); }, next: () => { void controller!.next(); }, repeat: () => { void controller!.repeat(); }, review: () => { void controller!.review(); } }, seatNames);
  narratorOutput = createNarratorAudio(narrationAssets, { enabled: narratorButton.value === 'peter', wholeOnly: true, flavorHistory: narratorFlavorHistory,
    nextEventId: () => ++narratorEventId,
    diagnostic: event => {
      handRecorder.diagnostic(event);
      narratorDiagnostics.events.push(event); if (narratorDiagnostics.events.length > 100) narratorDiagnostics.events.shift();
      if (event.outcome === 'ended') narratorDiagnostics.totals.completed++;
      if (event.outcome === 'fallback' || event.reason === 'media-failure') narratorDiagnostics.totals.fallbacks++;
    },
    caption: text => { narratorCaption.textContent = text; } });
  narratorOutput.prime();
  controller = createController(session, table, text => { live.textContent = text; try { handRecorder.liveText(text); } catch { /* Evidence must never block narration. */ } }, undefined, cue => sounds.play(cue), seatNames,
    selectedHumanTracking === 'owner' ? 'voiceover' : 'visual', narratorOutput, handRecorder.observe);
  table.render(session.view(), false, narratorOutput.enabled()); table.park(narratorOutput.enabled());
  void controller.start();
};
