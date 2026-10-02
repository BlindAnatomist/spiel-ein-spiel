# Whole-event narration, stage one

This preview revision replaces 379 frequently repeated public facts with complete
performed sentences: passes, order-ups, calls (including going alone), and trick
winners. Coverage is all 20 permanent opponent identities, Val, and the human
trick-winner announcement. West/East compatibility names and other events retain
the verified 127-clip fallback. Card play/lead sentences, dealing, up-card,
pickup and discard announcements still use that fallback in this stage.

Two previously approved complete sentences are additional rare alternatives:
Emma passing and Walt calling spades alone. The two original Val alternatives
remain eligible with the same stronger variation rules. Alternatives replace the
whole fact in a single recording. No separate joke is played after a successful
fact, so an optional tail cannot cause the whole fact to be repeated by VoiceOver.
The original public text remains the sole failure fallback and caption source
unless an eligible complete alternative is actually selected.

## Variation boundaries

The page owns one history shared across hands, New Game, Pause/Resume, and mode
changes. A clip or normalized full line can be attempted only once in that page
session. Related humor belongs to a semantic family; each family can appear only
once per game. At least one whole hand and 12 automatic public events separate
flavor lines. Reusing a family in a later game additionally requires three hand
starts and 40 public events. Cancellation and failures consume a chosen flavor
line, preventing a partially heard joke from repeating. Reloading the page starts
a new session. Ordinary factual lines are not restricted by these flavor rules.

## Restore and build

The public source branch intentionally excludes audio. Preserve original and
mastered assets in the private recovery ZIP; never publish private recordings to
the code repository. Restore the gain-repaired 127-clip pack first, then the whole
stage-one pack and the already accepted sample pack:

    node scripts/import-narrator-pack.ts /path/to/normalized
    node scripts/import-narrator-whole-pack.ts /path/to/euchre-whole-stage1 /path/to/euchre-narrator-repair
    npm run check
    CONTEXT=narrator-preview COMMIT_REF=<verified-source-commit> npm run build

The second importer expects its repair-pack directory to contain
samples/manifest.json and samples/<clip-id>.mp3, matching the preserved repair
recovery layout. The two approved samples are copied unchanged.

All 379 canonical IDs and exact baseline public text must match the typed contract.
Every file must have ready/decode status, SHA-256, size and positive duration before
any asset is copied. The private build requires 127 fallback recordings, 379 whole
sentences and two accepted alternatives, plus the existing comparison panel. It
refuses a partial pack. Code-only builds disable Peter and print restore guidance.

The existing pre-audio and post-audio quiet guards, stable focused heading/native
card subtrees, actual media completion/cancellation, and original narrator behavior
are retained. Automated validation does not establish iPhone VoiceOver acceptance
or listening quality. The first fragment preview failed the user's cadence and
repetition acceptance; this staged revision requires another real-device listen.
