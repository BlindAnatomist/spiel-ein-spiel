import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const verifier = fileURLToPath(new URL('../scripts/verify-narrator-audio.py', import.meta.url));
const inspect = (code: string) => JSON.parse(execFileSync('python3', ['-I', '-B', '-c',
  `import json, runpy\nv = runpy.run_path(${JSON.stringify(verifier)})\n${code}`], { encoding: 'utf8' }));

test('reviewed audio validator preserves the exact04–06 tuple', () => {
  const pins = inspect("print(json.dumps(v['validator_pins']('peter-euchre-library-batch06-20261002', 'a'*64, 'b'*64, 'c'*64)))");
  assert.deepEqual(pins, {
    'audio_provenance.py': '9c0207652880d23ca0f7d4cc114ca90a2dfd4bb126b51f847eaa0f293ea75e29',
    'audit_audio.py': '81fa0c537f27164a19c20748c45225f5a5b3bdec7ceec16675f1f2e80d4d5521',
    'finalize_recovery.py': '2e6febfcdcd1d8d7b6963c49a27722b467957bc9691707cefe6bfe24081804ba',
  });
});

test('batch07 requires the exact complete reviewed identity before selecting its tuple', () => {
  const result = inspect(`identity = v['REVIEWED07_IDENTITY']
select = v['validator_pins']
ready = all(isinstance(value, str) and len(value) == 64 for value in identity[1:])
positive = None
if ready:
    positive = select(*identity)
negative = []
for index in range(4):
    changed = list(identity)
    changed[index] = 'unreviewed-pack' if index == 0 else '0'*64
    try:
        select(*changed)
        negative.append(False)
    except ValueError:
        negative.append(True)
print(json.dumps({'ready': ready, 'positive': positive, 'negative': negative}))`);
  assert.deepEqual(result.negative, [true, true, true, true]);
  if (result.ready) assert.deepEqual(result.positive, {
    'audio_provenance.py': 'ad49af9da1cc13413cf0f53c54453e1e47141851fb2e46a1602298f794d2ffa9',
    'audit_audio.py': '81fa0c537f27164a19c20748c45225f5a5b3bdec7ceec16675f1f2e80d4d5521',
    'finalize_recovery.py': '2f3a9e14f0ea69593970d18a4c90fe6b456ffab19cb101e5fb5956cc3ea9f636',
  });
  else assert.equal(result.positive, null, 'unfinished07 cannot acquire the new validator');
});

test('unrelated pack identity can never select the batch07-only validator tuple', () => {
  const result = inspect(`rows = []
for pack in ['unknown', 'peter-euchre-library-batch04-20261002', 'peter-euchre-library-batch05-20261002', 'peter-euchre-library-batch06-20261002']:
    rows.append(v['validator_pins'](pack, 'a'*64, 'b'*64, 'c'*64) == v['PINS'])
print(json.dumps(rows))`);
  assert.deepEqual(result, [true, true, true, true]);
});
