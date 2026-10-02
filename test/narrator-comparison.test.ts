import test from 'node:test';
import { execFileSync } from 'node:child_process';

test('optional comparison is gesture-only and cancels stop, replacement, hidden and failed attempts', () => {
  execFileSync(process.execPath, ['scripts/test-narrator-comparison.mjs'], {stdio:'pipe'});
});
