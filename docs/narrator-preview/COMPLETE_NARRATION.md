# Complete-sentence narrator repair

This is the next isolated preview after the user's second naturalness test failed.
The deployed stage-one game remains version 4 while the complete catalog is made.
No partial new recording batch should be presented as a completed repair.

## What the previous preview missed

A 48-game trace found 9,510 of 14,359 automatic utterances (66.2%) still used
multiple files: every card play, plus dealer, up-card, pickup and discard facts.
The opening dealer line therefore retained a name-to-verb seam. Encoded silence
at fragment joins measured 227 ms median before any browser loading delay. The
379 whole pass/call/order/trick lines worked as mapped, but changed a minority
of the experience. Four narrow alternatives and permanent exact-line exclusions
produced only three flavor moments across those 48 games.

Native Sites metadata confirmed deployed version 4 and its source commit. Direct
served-byte inspection and the user's Safari cache were not established. No
service worker or application cache was found. The new build uses a content-hashed
script name, per-recording hash query, readable build revision and catalog hash;
these identify new documents/assets without claiming to force stale HTML refresh.

## Complete automatic vocabulary

- Existing 379 canonical pass/order/call/trick facts remain
- 1,344 new play/lead sentences: 21 real actor names times two verbs times 32 card
  descriptions, including all printed/effective bower descriptions
- 89 new logistical sentences: dealers, up-cards, pickups and private discards
- Existing one-file up-card-turned-down recording reused
- Twelve approved complete flavor alternatives added alongside four earlier ones

That is 1,813 complete automatic facts and 16 possible full-event alternatives.
The runtime still preserves the original recordings for provenance/compatibility,
but its live complete mode never silently substitutes fragments. An absent or
failed complete recording gets one original full-fact VoiceOver fallback. Human
activated actions are not echoed, discarded identities never enter a sentence,
and results/native controls/requested reviews keep their established speech path.

## Finite flavor history

Every choice matches the exact public event and is a complete replacement sentence.
Selection favors fresh, then less-recent eligible lines using a separate injectable
random source. It never consumes game or bot randomness. The last eight lines are
a preference, not a permanent veto that could exhaust a smaller eligible table.

An exact clip or normalized text can return after at least 12 completed hands AND
160 public events. A semantic family appears at most once per game; across games
it waits at least three completed hands and 40 public events. Any flavor moment
requires one completed unflavored hand and 12 events since the preceding flavor.
Interrupted attempts consume their line. Repeated abandoned New Games cannot
advance completed-hand counts or erase an unexpired cooldown. History older than
eight games is pruned once its cooldown has also expired.

With the actual twelve new flavor recordings and planned canonical metadata,
independent 48-game testing selected 246 flavors, usually four to six per game,
with five in the first game. All cooldown/family rules held and no announcement
selected multiple files. This proves routing and opportunity frequency, not
subjective character quality or real-browser timing.

## Diagnostics and recovery

The page exposes a copy-only euchreNarratorDiagnostics snapshot containing build
and catalog identity plus the latest 100 public narration records. Each record has
an event ID, monotonic timestamp, requested complete key, selected file IDs and
outcome. Media-request, validated actual-playing and completion records distinguish
selection from load/playback timing. These records never write to a live region,
change focus, include hidden hands or leave the page.

The private build requires all 1,953 runtime assets with valid local URLs, ready
status, positive durations, hashes and byte counts, plus the existing comparison
panel. The pending canonical manifest stays empty until all 1,433 new factual files
are verified. Canonical and flavor imports are independently complete-gated:

    node scripts/import-narrator-complete-pack.ts /path/to/euchre-whole-stage2 canonical
    node scripts/import-narrator-complete-pack.ts /path/to/euchre-whole-stage2 flavor

The second command imports all twelve approved alternatives. It cannot make the
partial canonical catalog publishable. Detailed raw/normalized generation receipts
stay in the private audio recovery; the public code checkpoint contains runtime
manifests and source hashes, never MP3/WAV files or credentials.

The in-progress private raw/mastered pack keeps Library identity
`libfile_000be91520888191a1436563bcd95c93`. The complete playable recovery keeps
`libfile_f0edc2c3fbd081918b4a18e10fe5ae07`; its current version 3 is the preceding
stage-one runtime until this full repair is reviewed and published.

Current source check: strict type checking and 193 repository tests pass. The code-
only build succeeds with Peter disabled; the private build correctly refuses the
incomplete catalog. Final full-asset build, actual opening/trick sequence assembly,
independent verification and listening/device acceptance remain outstanding.
