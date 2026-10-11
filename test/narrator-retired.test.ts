import test from 'node:test';
import assert from 'node:assert/strict';
import { retiredNarratorClips, isRetiredNarratorClip } from '../web/narrator-retired.ts';
import { createNarratorFlavorHistory } from '../web/narrator-flavor.ts';
import { createNarratorAudio, type NarratorMedia } from '../web/narrator-audio.ts';
import { narratorVariants } from '../web/narrator-variants.ts';
import { reactionLines } from '../web/narrator-reactions.ts';
import { narrationAssets } from '../web/narrator-assets.ts';
import type { NarrationAlternative } from '../web/narration-types.ts';

const embedded = [
  'whole.emma.passes', 'character.val-calls-hearts',
  'whole.walt.calls-spades-alone', 'character.val-takes-trick',
];
const alternatives: NarrationAlternative[] = [
  ...Object.values(narratorVariants).flat(), ...Object.values(reactionLines),
  ...embedded.map(clip => ({ clip, text: narrationAssets[clip]!.text })),
];

test('exactly the ten approved choices are retired and all historic recordings remain intact', () => {
  assert.deepEqual([...retiredNarratorClips].sort(), [
    'flavor.val-trick-piles', 'flavor.ward-trick-wages', 'reaction.you.follow-suit.brians-podcast',
    'flavor.etta-trick-theory', 'flavor.you-trick-keep-it', 'flavor.elise-passes-silence',
    'reaction.opponent.low-lead', 'flavor.wolf-passes-spelling', 'reaction.val.follow-suit.finish-it',
    'reaction.table.four-tricks.like-you',
  ].sort());
  assert.equal(alternatives.length, 244);
  assert.equal(alternatives.filter(line => !isRetiredNarratorClip(line.clip)).length, 234);
  assert.equal(Object.keys(narrationAssets).length, 2181);
  for (const clip of retiredNarratorClips) {
    assert.equal(alternatives.filter(line => line.clip === clip).length, 1);
    assert.equal(narrationAssets[clip]?.status, 'ready');
    assert.equal(narrationAssets[clip]?.text, alternatives.find(line => line.clip === clip)!.text);
  }
});

test('retired lines cannot win any selector priority or freshness tie', () => {
  const history = createNarratorFlavorHistory(() => 0);
  history.beginGame(); history.beginHand(1);
  const old = alternatives.filter(line => isRetiredNarratorClip(line.clip)).map(line => ({ ...line, priority: 999, eventPreference: 'game-result' as const }));
  for (const line of old) assert.equal(history.eligible(line), false);
  assert.equal(history.select(old), undefined);
  const active = reactionLines['reaction.you.bower']!;
  assert.equal(history.select([...old, active])?.clip, active.clip);
});

test('retired factual alternatives retain complete canonical narration and optional retired jokes are skipped', async () => {
  const requests: string[] = [];
  class Media extends EventTarget implements NarratorMedia {
    src = ''; preload = ''; currentTime = 0; ended = false; error = null;
    play() { requests.push(this.src); queueMicrotask(() => { this.ended = true; this.dispatchEvent(new Event('ended')); }); return Promise.resolve(); }
    pause() {}
  }
  const history = createNarratorFlavorHistory(() => 0); history.beginGame(); history.beginHand(1);
  const audio = createNarratorAudio(narrationAssets, { enabled: true, wholeOnly: true, flavorHistory: history, media: () => new Media(), timeout: () => () => {} });
  const retired = alternatives.find(line => line.clip === 'flavor.you-trick-keep-it')!;
  const fact = { text: 'You take the trick.', clips: [], whole: 'full.trick.you', alternatives: [retired] };
  const prepared = audio.prepareEvent!([fact]);
  assert.deepEqual(prepared, [{ text: fact.text, clips: [], whole: fact.whole }]);
  assert.equal(await audio.play(fact), 'ended');
  assert.equal(requests.length, 1); assert.ok(requests[0]!.startsWith('audio/full.trick.you.mp3'));
  const optional = { text: '', clips: [], optional: true, alternatives: alternatives.filter(line => isRetiredNarratorClip(line.clip)) };
  assert.equal(audio.canReact!(optional), false);
  assert.equal(await audio.play(optional), 'skipped'); assert.equal(requests.length, 1);
});

test('retirement keeps exposure history unchanged instead of clearing prior games or clips', () => {
  const line = alternatives.find(line => line.clip === retiredNarratorClips[0])!;
  let raw = '';
  const storage = { load: () => raw || null, save: (value: string) => { raw = value; } };
  const prior = createNarratorFlavorHistory(() => 0, storage); prior.beginGame(); prior.beginHand(1); prior.used(line);
  const before = raw, reloaded = createNarratorFlavorHistory(() => 0, storage);
  assert.equal(reloaded.select([line]), undefined); assert.equal(raw, before);
  assert.ok(JSON.parse(raw).seenClips.includes(line.clip));
});
