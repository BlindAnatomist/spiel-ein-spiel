# Performance persistence and retry repair

Base: `43df467b40e6bda56d23015851cf6d5a95a027a1`. Review-only checkpoint, 2026-10-10.

## Behavior

- Performance writes use the existing public hand-report store's write-then-readback mechanism, extracted into `web/verified-storage.ts`. Throwing and silently ineffective writes both fail explicitly. The public hand-report store keeps its same storage, retention, privacy, and failure behavior.
- A completed game's identity, timestamp, summary, and archive are captured once. Failed saves remain available within the page, across repeated completion callbacks and new games. Retry merges with freshly read storage by game ID; it does not discard old pending archives to make space.
- `Retry saving` and Analysis retry retained work. Only verified saved queues are eligible for existing upload paths. If a queue survived a missing summary, retry reconstructs the compact summary after reload. A uniquely identified saved queue can restore a missing recovery-profile key. Both upload endpoints retain the queue item's original profile ID.
- Acknowledgement write failures remain explicit, and accepted uploads are not re-enqueued or repeatedly submitted in the same page. After a successful retry, saved local records and queue entries remain deduplicated.
- Read failures or malformed stored books/queues are left untouched. A storage-only polite status region explains failures without changing game focus, the existing game-announcement region, narration selection, or audio.
- Analysis no longer infers that the server archive is current from an empty queue. It reports failed server-history reads and never claims an empty saved queue when storage status is uncertain.

## Limits

If storage never retained a completion, closing or reloading the page can still lose that in-memory data. The warning says so. If a server accepted an upload but local acknowledgement could not be stored, reloading may retry it; network response loss and cross-window simultaneous writes cannot provide exactly-once guarantees with the existing storage/API. Stable game IDs are preserved. Local compact-history retention remains 300 games. No new backend, cloud storage, upload audience, or gameplay rule is introduced.

Actual iPhone VoiceOver output is not established by automated DOM tests. The ordinary local development build deliberately disables Peter when the private recordings are absent; no recording generation or download is part of this repair.

## Verification

Run `npm run check`, then an ordinary offline `npm run build` with `NETLIFY` and `CONTEXT` unset. Added tests cover throwing, silent, blocked and single-key failures; recovery, repeats, newer games, retained-queue reload, missing-profile recovery, separate queue/page profiles, acknowledgement failure, malformed data, normal working storage, and bundled native UI retry/Analysis behavior. Existing gameplay, effective-suit/bower, privacy, narrator, report, and export tests remain in the aggregate suite.

This checkpoint does not deploy, update main, open a pull request, or run GitHub Actions. A review-branch save uses a final skip-marked commit only after review and current hosting-trigger verification.
