import { narratorManifest } from './narrator-manifest.ts';
import { narratorWholeManifest } from './narrator-whole-manifest.ts';
import type { NarrationManifest } from './narration-types.ts';

export const narrationAssets: NarrationManifest = { ...narratorManifest, ...narratorWholeManifest };
