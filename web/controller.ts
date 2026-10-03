import type { Action, PlayerView } from '../src/index.ts';
import { createAnnouncer } from './announcer.ts';
import { cueEvents, type SoundCue } from './sound.ts';
import { currentState, lastTrick, handStartNarration, names } from './presentation.ts';
import type { NarrationMessage, NarrationOutput } from './narration-types.ts';
import type { SeatNames } from './presentation.ts';
import type { Session, Update } from './session.ts';
import type { createTable } from './render.ts';
/** Quiet time before recorded narration after activation, and before automatic focus. */
export const FOCUS_GUARD_MS = 1150;
export type PacingMode = 'voiceover' | 'visual';
/** Observational public checkpoints only; observers cannot affect play or speech. */
export interface ControllerObservation {
  kind: 'checkpoint' | 'narration-plan' | 'pause' | 'resume' | 'stop' | 'review-state' | 'review-trick';
  view: PlayerView; pacing: PacingMode; audioEnabled: boolean; gameEventId?: number;
  messages?: readonly (string | NarrationMessage)[];
}
export function createController(session: Session, table: ReturnType<typeof createTable>, announce: (text: string) => void,
  wait: (ms: number) => Promise<void> = ms => new Promise(resolve => setTimeout(resolve, ms)),
  sound: (cue: SoundCue) => void = () => {},
  seatNames: SeatNames = names,
  pacing: PacingMode = 'voiceover',
  output?: NarrationOutput,
  observer?: (event: ControllerObservation) => void) {
  const speech = createAnnouncer(announce, wait, output);
  const voiceoverPacing = () => pacing === 'voiceover' || !!output?.enabled();
  let busy = false;
  let stopped = false;
  let paused = false;
  let settleDone: Promise<void> = Promise.resolve();
  let interruptWait: (() => void) | undefined;
  let announcedHand = 0;
  let reviewEpoch = 0;
  const interrupted = () => stopped || paused;
  function observe(kind: ControllerObservation['kind'], update?: Update, messages?: readonly (string | NarrationMessage)[]) {
    try { observer?.({kind,view:session.view(),pacing,audioEnabled:!!output?.enabled(),
      ...(update?.progress ? {gameEventId:update.progress.eventId} : {}), ...(messages ? {messages} : {})}); } catch { /* Reports must never interrupt the game. */ }
  }
  async function waitOrCancel(ms: number) {
    await Promise.race([wait(ms), new Promise<void>(resolve => { interruptWait = resolve; })]);
    interruptWait = undefined;
  }
  async function settle(update?: Update, handStart = false) {
    busy = true;
    const initialSpeech = speech.revision();
    let needsAudioGuard = !!output?.enabled();
    try {
      while (!interrupted()) {
        const pendingReactionEpoch = reviewEpoch;
        const current = session.view();
        observe('checkpoint', update);
        table.render(current, false, !!output?.enabled());
        const messages: Array<string | NarrationMessage> = [];
        if (handStart && current.handNumber !== announcedHand) {
          announcedHand = current.handNumber;
          output?.beginHand?.(current.handNumber);
          messages.push(...handStartNarration(current, seatNames));
        }
        if (update?.progress) output?.observe?.(update.progress);
        messages.push(...(update?.narration ?? update?.messages ?? []));
        if (output?.enabled() && update?.reaction) messages.push({...update.reaction, gapMs:messages.length ? 300 : 0});
        const prepared = output?.enabled() && output.prepareEvent ? output.prepareEvent(messages) : messages;
        observe('narration-plan', update, prepared);
        if (voiceoverPacing()) {
          // Let the native control/focus-parking utterance settle before Peter.
          // This is a bounded guard, not a claim to observe VoiceOver completion.
          if (needsAudioGuard && prepared.some(message => typeof message !== 'string')) {
            await waitOrCancel(FOCUS_GUARD_MS);
            if (interrupted()) return;
            needsAudioGuard = false;
          }
          await Promise.all(prepared.filter(message => typeof message === 'string' || !message.optional || pendingReactionEpoch === reviewEpoch).map(message => speech.say(message)));
          // An explicitly requested review shares the queue and finishes before automatic focus.
          await speech.say('');
        }
        if (interrupted()) return;
        const view = session.view();
        if (view.turn === null || view.turn === 0) {
          if (view.result) output?.endHand?.();
          if (voiceoverPacing() && speech.revision() !== initialSpeech) {
            // Reviews arriving during the guard must also finish and clear first.
            let revision: number;
            do {
              await speech.say('');
              if (interrupted()) return;
              revision = speech.revision();
              await waitOrCancel(FOCUS_GUARD_MS);
              if (interrupted()) return;
              await speech.say('');
            } while (speech.revision() !== revision);
          }
          if (interrupted()) return;
          table.render(view, true, !!output?.enabled()); table.focus(); return;
        }
        await waitOrCancel(350);
        if (interrupted()) return;
        const before = session.view();
        update = session.bot() ?? undefined;
        if (update) cueEvents(before, update.view).forEach(sound);
        handStart = false;
        if (!update) throw new Error('Bot could not advance');
      }
    } finally { busy = false; }
  }
  const run = (update?: Update, handStart = false) => {
    if (busy || interrupted()) return settleDone;
    settleDone = settle(update, handStart);
    return settleDone;
  };
  return {
    start: () => run(undefined, true),
    act: async (action: Action) => {
      if (busy || interrupted()) return;
      const before = session.view();
      const update = session.human(action);
      if (!update) return;
      speech.cancelReviews();
      cueEvents(before, update.view).forEach(sound);
      table.park(!!output?.enabled()); await run(update);
    },
    next: async () => {
      if (busy || interrupted() || session.view().phase !== 'hand-over') return;
      speech.cancelReviews();
      table.park(!!output?.enabled()); session.nextHand(); await run(undefined, true);
    },
    repeat: () => { if (!interrupted()) observe('review-state'); reviewEpoch++; return !interrupted() && voiceoverPacing() ? speech.say(() => currentState(session.view(), seatNames), true) : Promise.resolve(); },
    review: () => { if (!interrupted()) observe('review-trick'); reviewEpoch++; return !interrupted() && voiceoverPacing() ? speech.say(() => lastTrick(session.view(), seatNames), true) : Promise.resolve(); },
    pause: () => {
      if (stopped || paused) return;
      paused = true; observe('pause'); speech.cancelPending(); interruptWait?.(); table.render(session.view(), false, !!output?.enabled());
    },
    resume: async () => {
      if (stopped || !paused) return;
      // Keep paused until the abandoned loop fully exits; repeated Resume is harmless.
      await settleDone;
      if (stopped || !paused) return;
      paused = false; observe('resume');
      // Do not park an already-focused unchanged turn; its focus key correctly
      // prevents a second automatic jump. Newly reached turns/results still focus.
      const view = session.view();
      // Hand/game results remain focus-only, including an interrupted final trick.
      await run({ view, messages: view.result ? [] : [currentState(view, seatNames)] });
    },
    isPaused: () => paused,
    stop: () => { stopped = true; observe('stop'); speech.stop(); interruptWait?.(); },
  };
}
