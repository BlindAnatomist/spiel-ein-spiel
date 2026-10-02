import { narratorManifest } from './narrator-manifest.ts';
import { narratorWholeManifest } from './narrator-whole-manifest.ts';
import { narratorCompleteManifest } from './narrator-complete-manifest.ts';
import { narratorFlavorManifest } from './narrator-flavor-manifest.ts';
import type { NarrationManifest } from './narration-types.ts';

export const narrationAssets: NarrationManifest = { ...narratorManifest, ...narratorWholeManifest, ...narratorCompleteManifest, ...narratorFlavorManifest };
