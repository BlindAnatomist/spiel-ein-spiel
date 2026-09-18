// Compile-only: a policy cannot be constructed with a referee or consume State.
import { createBot } from '../src/bots/index.ts';
import type { State } from '../src/internal/state.ts';
function boundary(state: State) {
  const bot = createBot('expert');
  // @ts-expect-error State is not a PlayerView.
  bot(state);
  // @ts-expect-error Deal seed cannot be injected into a bot factory.
  createBot('expert', { seed: 42 });
}
void boundary;
