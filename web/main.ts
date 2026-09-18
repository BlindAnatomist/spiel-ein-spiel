import { createSession, type Difficulty } from './session.ts';
import { createTable } from './render.ts';
import { createController } from './controller.ts';
const root = document.querySelector<HTMLElement>('#game')!;
const live = document.querySelector<HTMLElement>('#announcements')!;
let controller: ReturnType<typeof createController> | undefined;
document.querySelector<HTMLFormElement>('#setup')!.onsubmit = event => {
  event.preventDefault();
  controller?.stop(); live.textContent = '';
  const level = document.querySelector<HTMLSelectElement>('#difficulty')!.value as Difficulty;
  // Randomness selects a fresh initial deal only; engine and policies remain deterministic.
  const seed = crypto.getRandomValues(new Uint32Array(1))[0]!;
  const session = createSession(seed, level);
  root.hidden = false;
  const table = createTable(root, { act: action => { void controller!.act(action); }, next: () => { void controller!.next(); } });
  controller = createController(session, table, text => { live.textContent = text; });
  table.render(session.view(), false); table.park();
  void controller.start();
};
