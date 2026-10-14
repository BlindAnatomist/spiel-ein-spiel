# Peter batch 10: separate review checkpoint

Adds the 24 approved batch-10 recordings to the existing review branch. All 2,181
prior runtime recordings and their metadata are preserved. The cumulative catalog
contains 2,205 recordings; 240 extra-reaction entries; 268 humorous alternatives,
258 active and the same ten retired.

The additions use the approved existing trigger semantics, contextual priorities,
and families. Trigger predicates, timing/cadence caps, cooldowns, persistence,
VoiceOver, UI, game rules, and deployment settings are unchanged. More eligible
choices can fill previously silent pool-exhaustion slots; unchanged limits do not
promise an identical number or sequence of remarks.

## Mechanical checks

- Strict TypeScript check.
- Full serial local test suite: 322 tests passed, including frozen old catalog/metadata identities,
  exact new recording mapping, evidence rejection, and narrow release URL tests.
- Local production-context build with `NETLIFY=false CONTEXT=production`.
- Strict USTAR validation and clean restoration of all 2,205 recordings, then
  repeat verification preserving all files without a second download.
- Frozen additive importer verifies the original approved proposal, recorded
  manifest, independent QA identity, every new raw/master hash, and every old
  runtime hash. Its separate batch-10 evidence route does not reinterpret or
  weaken the prior batch provenance validators.

The real-controller metadata-driven media audit completed 24 games and
266 hands: 895 remarks (3.365 per hand), maximum
4 per hand, minimum 1 trick and 6 public events between remarks,
zero exact-line/family cooldown violations and zero playback-selection errors.
This simulation does not perform perceptual listening or real-device testing.

## Distinct cumulative runtime asset

- Tag: `peter-audio-20261011-batch10`
- File: `peter-runtime-audio-20261011-batch10.tar.gz`
- Compressed bytes: 77,066,695
- SHA-256: `0570ee98095d35fa4516edee0be5c239def4102c904019c6759298f1d1e6efbc`
- Runtime bytes: 78,925,144
- Review ZIP SHA-256: `e61f7516a9554a1efb7df7630d88134e4b2b42bde13291c531ea78bcc45c7be3`

This distinct non-Latest prerelease must be pinned to the checked review commit.
It does not replace any earlier release or asset. The downloader accepts matched
legacy date-only names and the explicit `-batch10` suffix, with matching dates
and suffixes in the tag and filename. All hash, archive, destination, network,
and redirect restrictions remain in place. Release publication is separate from
these local checks and from deploying the game.

## Acceptance limits

Independent audio QA reports full raw/master decoding, unchanged sample counts,
static-gain-only mastering, and preserved timing. Five peak-constrained masters
(03, 10, 11, 12, 13) remain below the loudness target to respect the peak ceiling;
no dynamic limiter was applied. Highest measured true peak is -2.06 dBTP.

These mechanical checks do not establish spoken-text accuracy, voice likeness,
performance, natural pacing, comic timing, listening acceptance, or actual iPhone
Safari/VoiceOver behavior. Those remain unverified. Prior browser-export
provenance is supported by retained receipts; the original export JSON was not
retained, so that historical chain cannot be independently reproduced.

No new recording generation, paid work, GitHub Actions, pull request, main merge,
production deployment, or laptop operation is part of this checkpoint.
