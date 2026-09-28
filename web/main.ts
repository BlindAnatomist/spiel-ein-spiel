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
  type GamePerformance,
  type HumanTracking,
  type PerformanceArchiveItem,
  type PerformanceBook,
  type StorageLike,
} from './performance.ts';
import { createTable } from './render.ts';
import { createController } from './controller.ts';

declare const __BUILD_COMMIT__: string;
declare const __DEPLOY_CONTEXT__: string;
const buildCommit = typeof __BUILD_COMMIT__ === 'string' ? __BUILD_COMMIT__ : 'development';
const deployContext = typeof __DEPLOY_CONTEXT__ === 'string' ? __DEPLOY_CONTEXT__ : 'development';
const HISTORY_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxcXR3aG9ib29wd3J1c2JmZXNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwNDE3MjYsImV4cCI6MjA5OTYxNzcyNn0.7MgaYdYCHSueOnx57G6sEGOswawZAEUzYr-Wm_OR160';

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
  helpPanel.hidden = !opening;
  helpButton.setAttribute('aria-expanded', String(opening));
};

const storage: StorageLike = {
  getItem(key) {
    try { return window.localStorage.getItem(key); } catch { return null; }
  },
  setItem(key, value) {
    try { window.localStorage.setItem(key, value); } catch {}
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
    : 'Bot data only. Faster visual pacing.');
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
    headers: {
      'Content-Type': 'application/json',
      'apikey': HISTORY_ANON_KEY,
      'Authorization': `Bearer ${HISTORY_ANON_KEY}`,
    },
    body: JSON.stringify(body),
  });
}

async function loadServerPerformance(): Promise<PerformanceBook> {
  try {
    const response = await historyRequest({ action: 'list' });
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

function compactAnalysisGame(game: PerformanceArchiveItem['game']): GamePerformance {
  return {
    schemaVersion: game.schemaVersion,
    datasetEpoch: game.datasetEpoch,
    buildCommit: game.buildCommit,
    rulesVersion: game.rulesVersion,
    id: game.id,
    completedAt: game.completedAt,
    humanTracking: game.humanTracking,
    difficulty: game.difficulty,
    startingDealer: game.startingDealer,
    opponents: game.opponents,
    winner: game.winner,
    score: game.score,
    hands: game.hands.map(({ decisions: _decisions, ownerStartingHand: _ownerStartingHand, ...hand }) => ({
      ...hand,
      ownerStartingHand: null,
    })),
  };
}

async function submitAnalysisGame(game: GamePerformance): Promise<void> {
  if (deployContext !== 'production') return;
  const response = await historyRequest({ action: 'upsert', environment: deployContext, game });
  if (!response.ok) throw new Error(`Analysis history sync failed with status ${response.status}`);
}

analysisButton.onclick = async () => {
  analysisButton.disabled = true;
  performanceOutput.textContent = 'Loading complete performance history.';
  performanceOutput.hidden = false;
  try {
    const book = mergePerformanceBooks(await loadServerPerformance(), loadPerformance(storage));
    const pending = loadPendingArchives(storage).length;
    const archive = pending
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
  if (archiveFlushing) return;
  archiveFlushing = true;
  try {
    for (const item of loadPendingArchives(storage)) {
      try {
        await submitAnalysisGame(compactAnalysisGame(item.game));
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
let controller: ReturnType<typeof createController> | undefined;
const randomWord = () => crypto.getRandomValues(new Uint32Array(1))[0]!;

document.querySelector<HTMLFormElement>('#setup')!.onsubmit = event => {
  event.preventDefault();
  controller?.stop(); live.textContent = '';
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
  controller = createController(session, table, text => { live.textContent = text; }, undefined, cue => sounds.play(cue), seatNames,
    selectedHumanTracking === 'owner' ? 'voiceover' : 'visual');
  table.render(session.view(), false); table.park();
  void controller.start();
};
