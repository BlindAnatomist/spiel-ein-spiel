import type { PlayerView } from '../src/index.ts';

export type SoundCue = 'enabled' | 'card' | 'trick' | 'hand-win' | 'hand-loss' | 'game-win' | 'game-loss';

interface Note {
  readonly frequency: number;
  readonly offset: number;
  readonly duration: number;
  readonly gain: number;
  readonly wave?: OscillatorType;
}

const PATTERNS: Readonly<Record<SoundCue, readonly Note[]>> = Object.freeze({
  enabled: Object.freeze([
    { frequency: 620, offset: 0, duration: 0.07, gain: 0.06, wave: 'triangle' },
    { frequency: 820, offset: 0.075, duration: 0.09, gain: 0.065, wave: 'triangle' },
  ]),
  card: Object.freeze([
    { frequency: 430, offset: 0, duration: 0.065, gain: 0.06, wave: 'triangle' },
  ]),
  trick: Object.freeze([
    { frequency: 500, offset: 0, duration: 0.08, gain: 0.065, wave: 'triangle' },
    { frequency: 680, offset: 0.085, duration: 0.11, gain: 0.07, wave: 'triangle' },
  ]),
  'hand-win': Object.freeze([
    { frequency: 520, offset: 0, duration: 0.09, gain: 0.07, wave: 'triangle' },
    { frequency: 660, offset: 0.095, duration: 0.10, gain: 0.07, wave: 'triangle' },
    { frequency: 820, offset: 0.20, duration: 0.14, gain: 0.075, wave: 'triangle' },
  ]),
  'hand-loss': Object.freeze([
    { frequency: 420, offset: 0, duration: 0.10, gain: 0.065, wave: 'triangle' },
    { frequency: 300, offset: 0.11, duration: 0.16, gain: 0.065, wave: 'triangle' },
  ]),
  'game-win': Object.freeze([
    { frequency: 520, offset: 0, duration: 0.10, gain: 0.075, wave: 'triangle' },
    { frequency: 660, offset: 0.105, duration: 0.10, gain: 0.075, wave: 'triangle' },
    { frequency: 820, offset: 0.21, duration: 0.11, gain: 0.075, wave: 'triangle' },
    { frequency: 1040, offset: 0.325, duration: 0.18, gain: 0.08, wave: 'triangle' },
  ]),
  'game-loss': Object.freeze([
    { frequency: 400, offset: 0, duration: 0.11, gain: 0.07, wave: 'triangle' },
    { frequency: 300, offset: 0.12, duration: 0.13, gain: 0.07, wave: 'triangle' },
    { frequency: 220, offset: 0.26, duration: 0.20, gain: 0.07, wave: 'triangle' },
  ]),
});

/** Coalesce simultaneous results to one short cue, with the most useful result taking priority. */
export function cueEvents(before: PlayerView, after: PlayerView): SoundCue[] {
  if (before.winner === null && after.winner !== null) return [after.winner === 0 ? 'game-win' : 'game-loss'];
  if (!before.result && after.result) return [after.result.team === 0 ? 'hand-win' : 'hand-loss'];
  if (after.completedTricks.length > before.completedTricks.length) return ['trick'];
  if (after.trick.length > before.trick.length) return ['card'];
  return [];
}

export function createSoundCues(factory: () => AudioContext = () => new AudioContext()) {
  let enabled = false;
  let context: AudioContext | undefined;
  const nodes = new Set<OscillatorNode>();

  function stopAll(): void {
    for (const node of nodes) {
      try { node.stop(); } catch {}
    }
    nodes.clear();
  }

  return {
    async setEnabled(value: boolean): Promise<boolean> {
      enabled = value;
      if (!value) {
        stopAll();
        return false;
      }
      // This is called only from the explicit Sound Cues button gesture.
      // Audio startup failure must never affect the game or accessibility timing.
      try {
        context ??= factory();
        if (context.state !== 'running') await context.resume();
        return enabled && context.state === 'running';
      } catch {
        return false;
      }
    },

    play(cue: SoundCue): void {
      if (!enabled || !context || context.state !== 'running') return;
      try {
        const base = context.currentTime + 0.005;
        for (const note of PATTERNS[cue]) {
          const oscillator = context.createOscillator();
          const gain = context.createGain();
          const start = base + note.offset;
          const end = start + note.duration;
          const attack = Math.min(0.008, note.duration / 3);

          oscillator.type = note.wave ?? 'triangle';
          oscillator.frequency.setValueAtTime(note.frequency, start);
          gain.gain.setValueAtTime(0, start);
          gain.gain.linearRampToValueAtTime(note.gain, start + attack);
          gain.gain.linearRampToValueAtTime(0, end);

          oscillator.connect(gain);
          gain.connect(context.destination);
          nodes.add(oscillator);
          oscillator.onended = () => {
            nodes.delete(oscillator);
            oscillator.disconnect();
            gain.disconnect();
          };
          oscillator.start(start);
          oscillator.stop(end);
        }
      } catch {}
    },
  };
}
