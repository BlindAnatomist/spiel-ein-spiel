# Narrator controls and in-game reactions

This revision follows the user's October 2 device test: the voice work was liked,
but repeated “Game in progress” focus speech, crowded controls and sparse
in-hand commentary remained distracting.

## Focus and controls

Peter mode no longer moves focus to a generic progress heading. The renderer
remembers the actual activated native control as well as the DOM-focus snapshot.
It retains those controls, unavailable, while speech runs; after the quiet guard,
it focuses the real next legal control/result before retiring old nodes. This also
handles activation without a matching DOM focus, interrupted play, discard, bids
and Deal next hand. An explicit move to another control during speech is preserved.
No blank or aria-hidden focus target is introduced. Focused descriptions and
unchanged accessible subtrees stay stable during the busy interval. Original
VoiceOver mode retains its established focus and narration path.

The top controls now use a single native Narrator button showing VoiceOver or
Peter, beside Pause and Help. The explanatory selector text and eight-sample link
are removed from the game controls. Historical comparison assets remain available
in recovery. Build identity and optional narration diagnostics live inside Help.

## Complete optional reactions

Twelve approved complete Peter reactions cover the user's public card plays,
going alone, both opponents' public plays, trick winners and the fourth-trick
boundary. They do not infer hidden cards or intentions, evaluate unplayed choices,
or give strategy advice. Own-hand contents and legal-action lists do not influence
the classifier. An activated human card does not receive an additional factual echo.

Existing factual announcements remain single complete recordings. An occasional
reaction is a separate complete performance after a 300 ms sentence break. Human
activation retains its 1,150 ms guard, and final legal focus retains its quiet guard.
Unavailable or ineligible reactions add no gap. A failed reaction is silent; it
cannot replay a successful fact or enter the VoiceOver live region. Review, Pause,
New Game, narrator changes and page suspension cancel pending optional speech.
A review arriving during the activation guard also discards the pending reaction.

## Shared repetition budget

All old full-event remarks and new reactions share the same history. There must be
at least two actual completed tricks and six public events between remarks, with a
single sampled zero-to-three-event delay to distribute remarks into card play.
There are at most three remarks per hand. Exact wording waits four completed hands
and 80 public events; related joke families wait four tricks and 12 events. Counters
carry across hands and New Game. Abandoned games, duplicate observations, reviews,
status requests and control changes cannot manufacture completed tricks or hands.
Variation uses its own random source and never changes game or bot randomness.

Independent replay of the same 24 complete games and 266 hands changed flavor
frequency from 0.45 to 1.94 moments per hand: 55 hands had one, 172 had two and
39 had three. The 274 new reactions included 124 about the user's play, 114 about
opponents, seven about Val and 29 about the late-hand table state. Tricks 4–5 had
150 moments versus eight before. No spacing or exact-line repeat limit was broken.
These are reproducible software measurements, not an iPhone listening result.

## Assets and recovery

The runtime has 1,965 recordings: the prior 1,953 unchanged files plus the 12 new
complete reactions. Raw originals, mastered files, checksums and request provenance
are preserved in the private recovery. Public GitHub checkpoints contain only
code, tests and metadata. The private build requires the entire verified catalog.
Restore the current integrated Library recovery `libfile_f0edc2c3fbd081918b4a18e10fe5ae07`,
run its RESTORE.py, and follow its build instructions. The optional new pack can be
imported with `node scripts/import-narrator-reactions.ts /path/to/audio-production`.

The repository check passes 217 tests before final review. Independent lifecycle,
source/asset and Original-mode checks are recorded in the final companion report.
Actual iPhone speech, focus behavior and perceived commentary cadence still require
the user's next device test.
