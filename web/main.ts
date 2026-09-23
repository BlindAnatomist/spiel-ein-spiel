import { createSoundCues } from './sound.ts';
import type { Seat } from '../src/index.ts';
import { createSession, type Difficulty } from './session.ts';
import { createPerformanceRecorder, loadPerformance, performanceText, summarizePerformance } from './performance.ts';
import type { StorageLike } from './performance.ts';
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
const performanceButton = document.querySelector<HTMLButtonElement>('#performance-summary')!;
const performanceOutput = document.querySelector<HTMLElement>('#performance-output')!;
performanceButton.onclick = () => {
  performanceOutput.textContent = performanceText(summarizePerformance(loadPerformance(storage)));
  performanceOutput.hidden = false;
  performanceOutput.focus();
};

const root = document.querySelector<HTMLElement>('#game')!;
const live = document.querySelector<HTMLElement>('#announcements')!;
let controller: ReturnType<typeof createController> | undefined;
const randomWord = () => crypto.getRandomValues(new Uint32Array(1))[0]!;

document.querySelector<HTMLFormElement>('#setup')!.onsubmit = event => {
  event.preventDefault();
  controller?.stop(); live.textContent = '';
  const level = document.querySelector<HTMLSelectElement>('#difficulty')!.value as Difficulty;
  // Live games use browser cryptographic randomness for the starting dealer and every shuffle.
  const dealer = (randomWord() & 3) as Seat;
  const seed = randomWord();
  const session = createSession(seed, level, { dealer, randomWord, observer: createPerformanceRecorder(storage), opponentMode: 'varied' });
  root.hidden = false;
  const table = createTable(root, { act: action => { void controller!.act(action); }, next: () => { void controller!.next(); }, repeat: () => { void controller!.repeat(); }, review: () => { void controller!.review(); } });
  controller = createController(session, table, text => { live.textContent = text; }, undefined, cue => sounds.play(cue));
  table.render(session.view(), false); table.park();
  void controller.start();
};
