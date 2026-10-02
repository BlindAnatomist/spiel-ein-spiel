# Optional Peter narrator preview

Baseline: `776b5d755233c13adcba2c3bed8ccc6a75c50f6d` (main verified 2026-10-02).
Branch: `preview/peter-narrator-20261002`.

This is an isolated work-in-progress preview, not a production release. The engine,
strategies, referee, hidden-hand boundary and sound cues remain unchanged. Native
hand rendering has the narrow Peter-only stability repair described in
DEVICE_REPAIR.md. The full game and all 20 permanently named opponents remain.

For current full-sentence coverage, variation rules and restore commands, see
COMPLETE_NARRATION.md. The checkpoints below retain the earlier implementation history.

## First code checkpoint

- Typed public narration events keep the original text path byte-equivalent.
- Optional finite-pack audio output shares the one announcer queue with original
  VoiceOver reviews; successful audio does not also enter the live region.
- Actual media ended events control progression; rejected play, current media
  error and watchdog timeout stop audio before original-text fallback.
- Cancellation invalidates stale completions. Pause and Resume preserve the game;
  changing narrator pauses without moving focus; New Game cancels the old loop.
- Existing 1150 ms quiet guard and stable native card focus remain authoritative.
- Character asides are limited to one eligible Val call/trick event per hand.
- The pack is generated separately and will be imported only after checksums and
  decode checks. At this checkpoint the committed manifest is intentionally empty;
  selecting Peter falls back to original narration until the pack is imported.

## Verification so far

- Clean baseline: strict TypeScript + all 155 tests passed.
- Integration checkpoint: strict TypeScript + all original 155 tests passed.
- Build passed with the empty development audio directory.
- Independent mapping and media lifecycle review is in progress; final new tests
  and full ready-pack verification have not yet been committed at this checkpoint.
- No real iPhone/Safari/VoiceOver or human listening acceptance is claimed.

## Preview isolation

Build for the eventual new owner-private Site with:

    CONTEXT=narrator-preview COMMIT_REF=<source-commit> npm run build

That build disables server performance loading/uploads and uses its own prefixed
local history. Original builds retain existing behavior. The preview must be a
new owner-private Site, preserving the accepted tiny audio test and live game.
No Voice Lab runtime calls, credentials, paid fallback, main push or merge.

## Ready-pack integration checkpoint

All 127 recordings are now imported locally (123 generated plus four preserved
accepted microtest recordings), totaling 2,301,539 bytes. The ready pack has 143.85
seconds of unique source speech; actual games reuse a bounded subset. The renderer,
engine, policies, sound cues and all 20 opponent identities remain unchanged.

The GitHub repository is public, so this code-only checkpoint deliberately excludes
MP3 files. Recordings and the complete runtime are backed up privately in Library
and the separate owner-private Site. Voice-pack Library identity:
`libfile_4c4c0ad6ada88191aa643d1e8385572f` (rolling ZIP, latest version).
After downloading and extracting that ZIP, restore with:

    node scripts/import-narrator-pack.ts /path/to/extracted/voice-pack
    npm run check
    CONTEXT=narrator-preview COMMIT_REF=<source-commit> npm run build

The importer checks every SHA-256, byte count, ready/decode status, local URL and
expected manifest count before copying assets. A code-only build disables the
Peter option and prints restore instructions; a narrator-preview build refuses
missing or corrupt audio. It never silently publishes an incomplete voice pack.

Current repository checks: strict TypeScript and 172 passing tests, including 17
new audio, priming, cancellation, bower, privacy, focus, full-game equivalence and
preview-isolation tests. All original 155 tests remain green. Complete static build
with all assets passes. The explicit user-gesture priming flow uses the same audio
element for resumed playback; iPhone autoplay/focus coexistence remains device QA.

## Resume-only follow-up correction

After the first private publication, two interrupted-flow defects were independently
reproduced against that version. Resume after the last trick could read the result
through both the state-summary live path and focus. Resume after an already-settled
turn could park focus on the progress heading while the renderer's unchanged key
correctly declined a second automatic jump. Resume now omits the summary when a
result exists and does not park unchanged turns. Native rendering remains unchanged.
Two new regressions bring the complete suite to 174 passing tests. The same private
Site, recovery Library file and isolated GitHub branch receive this correction.
