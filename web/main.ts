import { createSoundCues } from './sound.ts';
import type { Seat } from '../src/index.ts';
import { createSession, type Difficulty } from './session.ts';
import {
  createPerformanceRecorder,
  ensurePerformanceProfile,
  loadPendingArchives,
  loadPerformance,
  markPerformanceArchived,
  performanceText,
  summarizePerformance,
  type HumanTracking,
  type PerformanceArchiveItem,
  type StorageLike,
} from './performance.ts';
import { createTable } from './render.ts';
import { createController } from './controller.ts';

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
const performanceButton = document.querySelector<HTMLButtonElement>('#performance-summary')!;
const recoveryButton = document.querySelector<HTMLButtonElement>('#performance-recovery')!;
const performanceOutput = document.querySelector<HTMLElement>('#performance-output')!;

performanceButton.onclick = () => {
  const pending = loadPendingArchives(storage).length;
  const archive = pending ? ` Server archive pending: ${pending} completed ${pending === 1 ? 'game' : 'games'}.` : ' Server archive is current.';
  performanceOutput.textContent = performanceText(summarizePerformance(loadPerformance(storage))) + archive;
  performanceOutput.hidden = false;
  performanceOutput.focus();
};

recoveryButton.onclick = () => {
  performanceOutput.textContent = `Performance recovery code: ${profileId}. Keep this code outside the game. It identifies your archived performance history if browser storage is ever lost.`;
  performanceOutput.hidden = false;
  performanceOutput.focus();
};

async function submitArchive(item: PerformanceArchiveItem): Promise<void> {
  const body = new URLSearchParams({
    'form-name': 'euchre-performance-ledger',
    profile_id: item.profileId,
    game_id: item.game.id,
    completed_at: item.game.completedAt,
    human_tracking: item.game.humanTracking,
    payload: JSON.stringify(item.game),
  });
  const response = await fetch('/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
    keepalive: true,
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
  const level = document.querySelector<HTMLSelectElement>('#difficulty')!.value as Difficulty;
  const humanTracking = document.querySelector<HTMLSelectElement>('#human-tracking')!.value as HumanTracking;
  // Live games use browser cryptographic randomness for the starting dealer and every shuffle.
  const dealer = (randomWord() & 3) as Seat;
  const seed = randomWord();
  const gameId = crypto.randomUUID();
  const session = createSession(seed, level, {
    dealer,
    randomWord,
    observer: createPerformanceRecorder(storage, {
      profileId,
      gameId,
      humanTracking,
      completedAt: () => new Date().toISOString(),
      archiveQueued: () => { void flushPerformanceArchive(); },
    }),
    opponentMode: 'varied',
  });
  root.hidden = false;
  const table = createTable(root, { act: action => { void controller!.act(action); }, next: () => { void controller!.next(); }, repeat: () => { void controller!.repeat(); }, review: () => { void controller!.review(); } });
  controller = createController(session, table, text => { live.textContent = text; }, undefined, cue => sounds.play(cue));
  table.render(session.view(), false); table.park();
  void controller.start();
};
