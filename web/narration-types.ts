/** Public presentation facts only. No player hands, referee or decision data. */
export interface NarrationMessage {
  readonly text: string;
  readonly clips: readonly string[];
  readonly character?: { readonly clip: string; readonly text: string };
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
}
