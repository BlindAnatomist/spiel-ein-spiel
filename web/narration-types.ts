/** Public presentation facts only. No player hands, referee or decision data. */
export interface NarrationMessage {
  readonly text: string;
  readonly optional?: boolean;
  readonly gapMs?: number;
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
  readonly context?: string;
  readonly priority?: number;
  /** A final-game payoff wins only among already cooldown-eligible candidates. */
  readonly eventPreference?: 'game-result';
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
export type PlaybackResult = 'ended' | 'fallback' | 'cancelled' | 'skipped';
export interface NarrationProgress { readonly eventId: number; readonly handNumber: number; readonly completedTricks: number; readonly handComplete: boolean; readonly gameComplete?: boolean }
export interface NarrationOutput {
  enabled(): boolean;
  play(message: NarrationMessage): Promise<PlaybackResult>;
  cancel(): void;
  prepareEvent?(messages: readonly (string | NarrationMessage)[]): Array<string | NarrationMessage>;
  observe?(progress: NarrationProgress): void;
  canReact?(message: NarrationMessage): boolean;
  beginHand?(handNumber: number): void;
  endHand?(): void;
}
