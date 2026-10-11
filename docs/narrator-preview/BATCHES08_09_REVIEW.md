# Peter batches 08–09: audio-only review checkpoint

This additive review checkpoint preserves the deployed 2,133 recordings and all
existing reaction metadata, adding 48 reviewed recordings in two complete batches.
The cumulative catalog contains 2,181 recordings and 244 humorous alternatives,
of which 234 remain active and the same ten remain retired. The extra-reaction
library contains 216 entries in nine complete batches.

No game rules, trigger predicates, remark cadence, history policy, focus behavior,
VoiceOver implementation, UI, production settings, or persistence code changed.
The review branch and audio-only prerelease are separate from publishing the game.

## Verification

- Strict TypeScript check passed.
- The complete local suite passed: 317 tests, using
  `node --test --test-concurrency=1 test/*.test.ts`.
- The default concurrent suite intermittently terminated the interface-test
  subprocess without a useful diagnostic. Its 19 tests passed in isolation;
  the complete serial suite then passed without changing application behavior.
- Local production-context build passed with `NETLIFY=false CONTEXT=production`.
- Strict cumulative archive validation, clean restoration of all 2,181 files,
  and repeat verification/preservation without fetching passed.
- Independent review confirmed exact preservation of all old recordings and
  metadata, all 48 reviewed additions, and bounded source changes.
- Both new packs passed full raw/master decode, hashes, unchanged decoded sample
  counts, constant-gain mastering verification, and exact prompt/metadata checks.
- Existing seven-pack provenance contracts and validator identities are preserved.
  New evidence routes require exact reviewed identities and retain rejection
  checks for altered evidence, unsafe paths, and unsupported perceptual claims.

## Cumulative runtime asset

- File: `peter-runtime-audio-20261011.tar.gz`
- Size: 75,875,870 bytes
- SHA-256: `3a8e5d21001c01247d3497481632d3535a01e819ee2ad2cd64c6003aec9524eb`
- Exact runtime audio bytes: 77,718,836

The immutable runtime pin targets the date-named asset in an explicitly labelled
non-production audio-only prerelease. The date-only name preserves the existing
strict downloader URL contract; it does not designate a production game release.

## Acceptance limits

Mechanical checks do not establish spoken-word accuracy, unspoken delivery tags,
pronunciation, voice likeness, performance, comic timing, listening acceptance,
or real iPhone Safari/VoiceOver behavior. Those remain unverified. Local building
and archive restoration do not establish a deployed game or remote-fetch success.
