import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('variety audit rejects malformed or repeated holdout scenario seeds before reading assets', () => {
  const script = fileURLToPath(new URL('../scripts/audit-narrator-variety.ts', import.meta.url));
  for (const seeds of ['1,2,3', '1,,2,3,4,5', '1,1,2,3,4,5', '1,2,3,4,5,-1', '1,2,3,4,5,NaN', '1,2,3,4,5,0.5', '1,2,3,4,5,4294967296']) {
    const r = spawnSync(process.execPath, [script, 'unused-output', '1597463007', 'casual', seeds], { encoding: 'utf8' });
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /Provide six distinct unsigned32 scenario seeds/);
  }
});
