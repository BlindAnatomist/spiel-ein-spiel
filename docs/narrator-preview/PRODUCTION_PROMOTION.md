# Peter production promotion

This is a private release-preparation route. It does not authorize a push, pull
request, Actions run, merge, hosting change, or deployment. The audio remains
excluded from the public repository. Keep the separate dealer-pickup experiment
out of this candidate.

## Restore existing recordings without regenerating them

Materialize the current authorized private recovery artifact using the supported
Library workflow. Recover its complete private source, verify its recorded source
identity, and use that checkout's `web` directory as the input below. Do not use
an arbitrary folder of generated files or download an unverified replacement.

```sh
npm ci --ignore-scripts
node scripts/restore-narrator-assets.ts /path/to/verified-private-source/web
npm run check
CONTEXT=production COMMIT_REF=<final-source-commit> npm run build
```

The restoration script uses this destination checkout's trusted catalog and
comparison checksums. It verifies all source bytes and existing destination files
before writing anything, copies only explicitly listed assets, rejects unsafe
paths and symbolic links, and never overwrites differing destination bytes.
Matching files are left untouched, including their timestamps. It runs no input
code, makes no provider/network request, and creates no new recording. A conflict
must be investigated rather than bypassed.

Production and private-preview builds both fail if the complete 2,133-recording
runtime catalog is absent or invalid. Ordinary code-only development builds still
work with Peter disabled, so a passing code-only CI build is not media-release
verification. Successful media builds copy only the verified runtime allowlist.
Production excludes the separate repair/comparison recordings and page.

## Dialogue history and existing games

Both production and private preview now persist the same bounded dialogue
history. Production uses `narrator-dialogue-history-v1`; preview retains its
existing `narrator-preview:` prefix. Neither context imports, clears, or rewrites
the other's history. No performance profile, game record, saved-report key,
retention policy, or server-history route changes.

Persistence remains device/browser/origin-local and best effort. Blocking or
clearing browser storage loses cross-reload exposure history; the game continues
with in-memory history. This change is not cross-device synchronization and does
not transfer preview-origin games to the production origin. Existing joke
cooldowns, cadence, and game/bot randomness are unchanged. The ten owner-approved
editorial cuts in `web/narrator-retired.ts` are excluded from selection, leaving
186 active humorous lines. Their original definitions, audio and prior exposure
records remain intact for reports and recovery. Complete factual narration still
plays when an associated humorous alternative is retired. No replacement text or
recording has been activated.

## Prepare, then seek release authorization

Keep a private recovery package with the exact candidate source, patch/commit
identity, validation logs, unchanged audio, and the production `dist` checksums.
Record all 2,133 output MP3 hashes/sizes against the source manifest and verify
that Peter is enabled and the compiled context is `production`. Exclude unrelated
local files and comparison assets from the production output.

The production host also needs the unchanged
`netlify/functions/performance-history.mjs`. A static-only deployment must not
replace the existing working API. Preserve the existing hosting configuration,
forms and environment settings. The prepared package should include that function
source with a checksum, separately from the static `dist` directory.

After explicit authorization, promote the code-only candidate through its normal
review/check gates and publish the verified media build to the existing production
host together with the existing function. Do not publish the recordings to GitHub
or introduce a new credential as a shortcut. A Git-linked clean production build
without restored private media will intentionally fail, leaving the prior live
deployment in place; coordinate the approved media-bearing release rather than
assuming a Git merge alone delivers Peter.

Verify the deployed source/catalog identity, asset hashes, narrator availability,
same-origin history across reload, factual fallback, and existing Analysis/API
behavior before calling the release complete. Do not clear actual owner storage
or upload test games to the owner's production archive for acceptance testing.
No fresh subjective listening or iPhone VoiceOver acceptance is implied by these
automated checks; carry forward applicable owner acceptance of unchanged behavior.
