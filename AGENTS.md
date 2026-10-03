# Working on Spiel ein Spiel

Build one trustworthy, VoiceOver-first Euchre game with correct rules, hidden
information, reproducible deals and competent bots. Human seat 0 partners with
Val at seat 2. Preserve the accepted game before expanding scope.

## Establish the source before editing

- Confirm repository, checkout state, branch/full commit, task scope and PR
  base/head. Isolate parallel work; never overwrite an active preview checkout.
- At this guidance checkpoint (2026-10-03), accepted `main` is
  `776b5d755233c13adcba2c3bed8ccc6a75c50f6d`. The separately delivered narrator
  candidate is `preview/peter-narrator-20261002` at
  `526dafc57112c04b6082fba5c3d02e4fbdf19af7`; it has not been promoted to `main`.
  Recheck these dated identities before relying on them.
- Keep source, accepted baseline, candidate, deployed build and device acceptance
  separate. Historical “next” steps and acceptance notes do not reopen completed
  work or authorize merging old PRs.

## Read the relevant contracts

- [README](README.md) and [foundation](docs/EUCHRE_FOUNDATION.md): mission and rules.
- [Engine](docs/ENGINE_CHECKPOINT_1.md) and
  [players](docs/PLAYERS_CHECKPOINT_2.md): capability boundary, deterministic
  replay and policy limits.
- [Interface](docs/INTERFACE_CHECKPOINT_3.md),
  [narrator](docs/NARRATOR_AUDIO_CHECKPOINT.md) and
  [mobile layout](docs/MOBILE_TABLE_LAYOUT.md): focus, speech and remediation;
  read later sections, not just the opening historical scope.
- [Performance and opponent audit](docs/PERFORMANCE_OPPONENT_AUDIT_CHECKPOINT.md):
  tracking classification, observer isolation and table identities.
- On the candidate, read relevant `docs/narrator-preview/` checkpoint,
  device-repair/polish, complete-narration and character-library records. Its
  [saved-hand-report contract](https://github.com/BlindAnatomist/spiel-ein-spiel/blob/526dafc57112c04b6082fba5c3d02e4fbdf19af7/docs/narrator-preview/SAVED_HAND_REPORTS.md)
  defines public-only evidence and conditional local recovery. These preview
  documents are absent from accepted `main`.

## Preserve the game contracts

- Bots receive only their own `PlayerView`. Keep referee snapshots, hidden hands,
  kitty, private discards and deal seeds outside policies and ordinary presentation.
  Engine legal actions and effective-suit/bower rules remain authoritative.
- Keep the full human hand reviewable in stable order, with unavailable cards
  reachable and inert. Preserve first-legal focus, narration queue, quiet guard,
  cancellation and focus bookkeeping; avoid duplicate speech or swipe stops.
- Preserve inherited tests, deterministic replay and source/audio provenance.
  Reuse existing rules and documented repair procedures; do not regenerate valid
  recordings or weaken tests to repair a downstream failure.

## Verify and hand off honestly

Use Node.js 24+: `npm ci --ignore-scripts`, `npm run check` (types/full suite),
then `npm run build`. Check the final revision; distinguish passed, failed and
not-run checks. For docs-only work, verify links, identities, `git diff --check`
and changed-file scope.

A code-only build does not verify complete narrator media; use the candidate's
import/build checks and hashes. Test changed complete-game and interrupted flows,
including New Game, repeated reviews and pause/resume. DOM/focus tests do not
establish iPhone Safari/VoiceOver acceptance; decoded audio or selected/ended
events do not establish what was heard. Carry forward valid acceptance evidence;
identify only changed behavior needing device/listening review.

Before a push/PR, inspect workflow and hosting triggers: every push/PR runs CI,
and GitHub-linked hosting can deploy docs-only previews. Publication, private
delivery, merge and production deployment each need applicable authority. Exclude
private reports, recordings, credentials and delivery identifiers from public
diffs. Successful CI is not release approval.

Handoff: exact source, changed files, checks, deployed identity, acceptance limits,
protected/paused work and next authorized step. Verify remote source and checks
after authorized publication before claiming completion.
