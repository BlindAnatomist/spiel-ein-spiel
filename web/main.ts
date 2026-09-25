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
  markPerformanceArchived,
  ownerTrend,
  performanceAnalysisText,
  performanceText,
  summarizePerformance,
  type HumanTracking,
  type PerformanceArchiveItem,
  type StorageLike,
} from './performance.ts';
import { createTable } from './render.ts';
import { createController } from './controller.ts';

declare const __BUILD_COMMIT__: string;
const buildCommit = typeof __BUILD_COMMIT__ === 'string' ? __BUILD_COMMIT__ : 'development';

const sounds = createSoundCues();
const soundToggle = document.querySelector<HTMLButtonElement>('#sound-cues')!;
soundToggle.onclick = () => {
  const enabled = soundToggle.getAttribute('aria-pressed') !== 'true';
  soundToggle.setAttribute('aria-pressed', String(enabled)); sounds.setEnabled(enabled);
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

const profileId = ensurePerformanceProfile(storage, recoveryId);
const trackingToggle = document.querySelector<HTMLButtonElement>('#human-tracking')!;
const analysisButton = document.querySelector<HTMLButtonElement>('#performance-analysis')!;
const analysisPanel = document.querySelector<HTMLElement>('#analysis-panel')!;
const analysisChart = document.querySelector<HTMLElement>('#analysis-chart')!;
const performanceOutput = document.querySelector<HTMLElement>('#performance-output')!;
let humanTracking: HumanTracking = 'owner';
trackingToggle.onclick = () => {
  humanTracking = humanTracking === 'owner' ? 'other' : 'owner';
  trackingToggle.setAttribute('aria-pressed', String(humanTracking === 'owner'));
  trackingToggle.textContent = humanTracking === 'owner' ? 'My performance' : 'Bot data only';
};

function svgElement(name: string, attributes: Record<string, string> = {}): SVGElement {
  const element = document.createElementNS('http://www.w3.org/2000/svg', name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  return element;
}

function renderAnalysisChart(): void {
  const trend = ownerTrend(loadPerformance(storage));
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

analysisButton.onclick = () => {
  const book = loadPerformance(storage);
  const pending = loadPendingArchives(storage).length;
  const archive = pending
    ? ` Server archive pending: ${pending} completed ${pending === 1 ? 'game' : 'games'}.`
    : ' Server archive is current.';
  performanceOutput.textContent = `${performanceText(summarizePerformance(book))} ${performanceAnalysisText(book)}${archive} Recovery code: ${profileId}.`;
  performanceOutput.hidden = false;
  renderAnalysisChart();
  performanceOutput.focus();
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
  performanceOutput.hidden = true;
  analysisPanel.hidden = true;
  analysisChart.replaceChildren();
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
      humanTracking,
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
  controller = createController(session, table, text => { live.textContent = text; }, undefined, cue => sounds.play(cue), seatNames);
  table.render(session.view(), false); table.park();
  void controller.start();
};
