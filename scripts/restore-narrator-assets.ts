import { narratorAssetPlan, restoreVerifiedAssets } from './narrator-asset-restore.ts';

const sourceWeb = process.argv[2];
if (!sourceWeb || process.argv.length !== 3) throw new Error('Usage: node scripts/restore-narrator-assets.ts /path/to/verified-private-source/web');
const result = await restoreVerifiedAssets(sourceWeb, 'web', await narratorAssetPlan('web'));
console.log(JSON.stringify({ ...result, networkCalls: 0, generationCalls: 0 }, null, 2));
