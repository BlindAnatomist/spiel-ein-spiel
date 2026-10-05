# Completed game export

The existing Help → saved hand reports panel now offers **Copy whole game**.
It selects the played game belonging to the selected hand, gathers every readable
matching record already present in this browser, and writes a single text report.
Games whose hand reports have expired but whose summary or archive remains are
also selectable in that same panel. **Copy this hand** preserves the original
single-hand diagnostic. **Save full game evidence file** creates a local JSON
file; no automatic upload occurs.

The whole-game text includes the actual played game ID and build, available
recorded difficulty/opponent identities, chronological hand outcomes and score
progression, public trick/card records, and recorded decisions/permitted cards
where the existing completed-game archive is present. The JSON preserves
available source records and narration evidence. Profile/recovery IDs are omitted.

Coverage is reported separately for scoring, public tricks, and detailed decision
records. Missing data is never reconstructed or invented. Stored action records
are explicitly not claimed independently replayed or verified complete. Detected
source disagreements, missing expected actions, numbering gaps, duplicates, and
unsupported data are reported. Original unreadable data remains in storage.

Only completed games are eligible for rich export. No midgame private views are
introduced. No storage keys, retention policies, game mechanics, bot decisions,
voice catalogs, or narrator pacing are changed. Existing eight-hand public-report
retention and existing performance persistence limitations remain unchanged.

Native button/select/textarea controls preserve pause and focus behavior. Failed
clipboard access selects the entire whole-game text; Select all does not revert
it to one hand. Close, resume, repeated opening and delayed clipboard operations
retain the prior focus-safety behavior. Real-device iPhone VoiceOver acceptance
is not established by automated DOM checks.

Validation: strict TypeScript check, complete automated suite, focused export
and report-panel regressions, and independent code review. Export tests exercise
rich/public/summary-only records, missing/corrupt records, active-game exclusion,
source conflicts, unsupported numbering, preservation, clipboard fallback and
late completion after Close. No GitHub Actions are used for this checkpoint.
