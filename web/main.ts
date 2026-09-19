import type { Seat } from '../src/index.ts';
import { createSession, type Difficulty } from './session.ts';
import { createTable } from './render.ts';
import { createController } from './controller.ts';
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
  const session = createSession(seed, level, { dealer, randomWord });
  root.hidden = false;
  const table = createTable(root, { act: action => { void controller!.act(action); }, next: () => { void controller!.next(); } });
  controller = createController(session, table, text => { live.textContent = text; });
  table.render(session.view(), false); table.park();
  void controller.start();
};
