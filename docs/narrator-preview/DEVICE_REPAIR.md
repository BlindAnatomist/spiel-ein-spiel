# First device-feedback repair

The first actual full-game test did not pass acceptance. The reported problems
were overlapping/repeated VoiceOver and Peter facts, Peter's lower volume, and
fragmented delivery that lost the tiny test's character. Passing automated tests
had not established device speech coexistence or performance quality.

## Speech and native navigation

An instrumented bundled-entry trace found 20 changes to the focused turn heading
while Peter was speaking. Successful audio did bypass the single live region, but
that did not prevent VoiceOver from announcing a changed focused element.

For Peter's busy turns, the parking heading now stays unchanged, and unchanged
hand labels/subtrees and existing public-trick rows retain their nodes. Essential
card names, bowers, legal/unplayable labels and the full hand remain available.
Original mode retains its previous rendering path. A 1150 ms pre-audio interval
allows short native activation/parking speech to settle; the existing 1150 ms
post-audio focus interval remains. These are bounded guards, not a VoiceOver
speech-completion API. Actual iPhone acceptance remains required.

Requested summaries and Resume still use original VoiceOver. If a recording
fails, the app stops it and reads the complete fact through the original writer.
That can repeat a prefix already heard before the failure. User exploration can
also intentionally revisit public facts. Neither is hidden by removing labels.

## Loudness and performance

The same 127 recordings have reversible gain-only mastering, with no compression
or deliberate timing edit. Originals are retained separately and in the original
private voice-pack backup. The mastered runtime pack is 2,413,285 bytes. Its
measurable integrated loudness median is about -20.45 LUFS; median gain is +10 dB,
and the reported maximum true peak is -2.39 dBTP. Device VoiceOver level and audio
ducking were not measured, so equal perceived volume is not claimed.

The full game still uses the finite stitched pack. The optional comparison page
has eight explicit playback choices, including four new whole-event candidates.
These are listening samples, not complete full-line narration coverage. The panel
also retains original/mastered fragment and accepted-microtest comparisons.

## Recovery

For the current repaired source, mastered assets and optional comparison files,
use the complete private recovery ZIP with Library identity
`libfile_f0edc2c3fbd081918b4a18e10fe5ae07`, latest version. It contains the ready
source tree and built game. The older voice-pack Library file
`libfile_4c4c0ad6ada88191aa643d1e8385572f` intentionally preserves the original
quiet recordings and is not the repaired runtime pack.

No production game or main branch is changed. This remains an owner-private
preview requiring another iPhone/VoiceOver and listening test.

## Automated checks for this repair

The frozen candidate passes strict TypeScript and 177 repository tests. New
regressions observe focused-heading/hand mutations and public-trick node identity,
and the optional panel has a portable mocked lifecycle test. Independent checks
confirm Original transcript/timing equivalence and complete-game state/focus
comparisons, all 127 original source hashes preserved, repaired waveform
correlation at least 0.999435, identical decoded sample counts, and no peak above
the stated ceiling. The panel's error path invalidates the attempt, so a late
silent-prime promise cannot restart speech after failure.

These checks support another private device test. They do not establish that
VoiceOver overlap, perceived balance or character performance is now acceptable.
