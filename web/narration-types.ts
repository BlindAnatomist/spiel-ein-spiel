/** Public presentation facts only. No player hands, referee or decision data. */
export interface NarrationMessage {
  readonly text: string;
  readonly clips: readonly string[];
  /** A complete performance of this public fact; fragments remain the fallback. */
  readonly whole?: string;
  /** Complete factual alternatives, never a joke appended after successful speech. */
  readonly character?: NarrationAlternative;
  readonly alternatives?: readonly NarrationAlternative[];
}
export interface NarrationAlternative {
  readonly clip: string;
  readonly text: string;
  /** Related jokes share a cooldown even when their words differ. */
  readonly family?: string;
}
export interface NarrationClip {
  readonly id: string;
  readonly url: string;
  readonly text: string;
  readonly status: string;
  readonly durationSeconds: number;
  readonly sha256: string;
  readonly bytes: number;
}
export type NarrationManifest = Readonly<Record<string, NarrationClip>>;
export type PlaybackResult = 'ended' | 'fallback' | 'cancelled';
export interface NarrationOutput {
  enabled(): boolean;
  play(message: NarrationMessage): Promise<PlaybackResult>;
  cancel(): void;
  beginHand?(handNumber: number): void;
  endHand?(): void;
}
