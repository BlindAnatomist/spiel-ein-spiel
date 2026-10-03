# Complete character library integration checkpoint

October 3, 2026. All 168 approved contextual additions are recorded and integrated
in seven complete batches of 24. The local runtime contains 2,133 primary
recordings, plus the six preserved repair MP3s. Strict local preview builds pass.
Publication and the owner-private preview update are separately coordinated.

## Implemented behavior

- Twenty-seven context predicates read accepted, publicly revealed game events.
  Bowers use effective suit; result comments require newly confirmed results.
- One optional remark can be selected per event, with a maximum of four per hand,
  at least one completed trick and six public events between remarks.
- Exact wording is excluded within the same and two preceding completed games.
  Four-hand/80-event exact and four-trick/12-event family cooldowns also apply.
- Bounded exposure history is separate from game randomness. Abandoned games do
  not advance the completed-game clock. Eligible final-game payoffs have priority
  without bypassing cooldowns or factual narration.
- The importer validates approved text, trigger, family, delivery instructions,
  audio integrity and mechanical QA. It rejects missing or altered prior entries.
- Strict narrator-preview builds still require all 168 additions and 2,133 assets.

The original 1,965 recording references, selector and game rules are unchanged.
All 2,109 pre-final-import primary MP3s and six repair MP3s retain exact hashes,
byte lengths and modification times. The prior 144 addition metadata entries and
ordering are unchanged. All 24 final additions match their independently reviewed
complete pack. Audio remains excluded from this repository.

## Actual-catalog verification

Strict typecheck, all 244 tests and the strict narrator-preview build pass.
All 2,133 actual primary recordings passed exact hash/size checks, FFprobe duration
checks and full FFmpeg decoding. Their contents and modification times stayed
unchanged; there are no duplicate primary audio hashes.

Two actual-catalog controller/session/history audits ran 48 complete games,
520 hands and 12,973 accepted actions. Each audit verified all actual asset hashes
before simulating metadata-driven media completion. No unfinished recordings or
synthetic clip identities were substituted.

| Metric | Baseline | Disjoint-game-seed holdout |
| --- | ---: | ---: |
| Games / hands | 24 / 266 | 24 / 254 |
| Remarks per hand | 3.150 | 3.177 |
| Hands with three or four remarks | 91.7% | 94.5% |
| Maximum remarks per hand | 4 | 4 |
| Minimum trick / public-event gap | 1 / 6 | 1 / 6 |
| Distinct wording in first 75 remarks | 100% | 100% |
| Distinct wording in first 180 remarks | 78.9% | 76.1% |
| Distinct wording in first 350 remarks | 44.3% | 44.9% |
| Exact/family cooldown violations | 0 | 0 |
| Fallback, stitching or unintended live-output errors | 0 | 0 |

All 27 predicates selected an actual contextual recording across the combined
runs. The holdout also changed the selection seed and human policy. The earlier
50% first-350 distinctness projection remains unmet; the measured result is
44.3–44.9%. No cooldown or cadence constraint was relaxed to improve that number.

The tests include 9,600 play contexts with hidden-hand mutations, effective-suit
and result boundaries, focus lifecycle, history persistence/malformed storage,
repeat limits and final-game precedence/fallback. Earlier independent context
review exercised 8,209 accepted actions and all 27 predicates.

Reproducible audit commands:

```sh
node scripts/audit-narrator-variety.ts REPORT_DIR 2171876889 strong
node scripts/audit-narrator-variety.ts HOLDOUT_DIR 1597463007 casual 1201,1607,2017,3001,4001,5039
```

See checkpoints/20261003-character-library-complete/actual-catalog-validation.json
for sanitized measured results. Full private provenance and audio stay in the
private recovery artifact.

## Reviewed browser-evidence imports

The first three legacy packs retain their original route only for their exact
proposal, manifest and final-QA identities. Completed batches04–06 retain their
original three-validator hash tuple. The new batch07 tuple is available only for
its exact reviewed pack ID and approved-proposal, final-manifest and final-QA
hashes. Rewritten or mismatched identities cannot select it.

The local adapter needs Python 3, NumPy, FFmpeg and FFprobe. It starts Python in
isolated, no-bytecode mode and executes only pinned validator bytes, never adding
an input pack to Python's import path. The explicit approved proposal must match
the embedded audited proposal exactly. Fresh complete mechanical audio audit and
read-only evidence validation must agree with saved final QA.

All 41 retained production-route evidence probes and five deep mechanical/JSON
probes pass. Ten additional final07 production-route probes cover exact acceptance,
rewritten identities, tuple scope, missing history and altered audio. Untrusted
neighboring Python modules, missing/corrupt evidence, unsafe paths, invented HTTP
or provider totals and unsupported listening claims remain rejected.

Historical HTTP and visible-browser evidence stay distinct. Browser evidence
does not invent HTTP status or provider request totals. Approved replacements
preserve their original histories, and unknown earlier outcomes remain unknown.
Cross-pack raw/master hashes and browser blob identities must be unique. Every
input is validated before writes; new files use validated in-memory bytes with
exclusive creation, while matching existing audio files are left untouched.

## Acceptance limits

Mechanical decoding and simulated media completion do not establish spoken
wording, unspoken tags, pronunciation, voice likeness, comic timing or listening
acceptance. Automated focus and DOM checks do not establish real iPhone Safari or
VoiceOver acceptance. Those claims remain explicitly unverified.

This checkpoint does not merge main, change sharing or publish a public app.
