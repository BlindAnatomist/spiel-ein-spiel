import type { PlayerView } from '../src/index.ts';
export type SoundCue = 'card' | 'trick' | 'hand-win' | 'hand-loss' | 'game-win' | 'game-loss';
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
  return {
    setEnabled(value: boolean) {
      enabled = value;
      if (!value) { for (const node of nodes) { try { node.stop(); } catch {} } nodes.clear(); return; }
      // Called only by an explicit user gesture; failure must never affect the game.
      try { context ??= factory(); void context.resume().catch(() => {}); } catch {}
    },
    play(cue: SoundCue) {
      if (!enabled || !context || context.state !== 'running') return;
      try {
        const frequencies: Record<SoundCue, number> = {card: 360, trick: 480, 'hand-win': 600, 'hand-loss': 280, 'game-win': 720, 'game-loss': 220};
        const oscillator = context.createOscillator(); const gain = context.createGain();
        const start = context.currentTime; const duration = cue === 'card' ? 0.055 : 0.14;
        oscillator.type = 'sine'; oscillator.frequency.value = frequencies[cue];
        gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(0.035, start + 0.008);
        gain.gain.linearRampToValueAtTime(0, start + duration);
        oscillator.connect(gain); gain.connect(context.destination); nodes.add(oscillator);
        oscillator.onended = () => { nodes.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
        oscillator.start(start); oscillator.stop(start + duration);
      } catch {}
    },
  };
}
