# Device-local saved hand reports

This preview can retain public hand evidence for diagnosing reported play or narration discrepancies. It does not change the rules engine, choose a winner, restore a playable game, or establish that a selected recording was heard.

## Open and copy

1. Open **Help**, then **Pause and open saved hand reports**. This also works immediately after reopening the same preview, before starting another game.
2. The newest hand with played cards is selected. A newly dealt or newly started game without played cards does not replace that default. Use **Choose a hand report** for other retained hands.
3. Activate **Copy report**, then paste into the conversation. If clipboard access is missing or denied, the app tries native copy. If that also fails, the read-only report field is focused and its full text selected for the device's Copy command. **Select all report text** repeats that action without requiring sighted text selection.
4. **Close saved reports** returns focus to the opening control and leaves the game paused. Use **Resume game** explicitly when ready.

The panel does not autoplay audio or write to the live announcement queue. Capture does not change focus. Opening the panel intentionally uses the existing pause/cancel path before focusing the title. No claim of real-device iOS VoiceOver acceptance is made by automated DOM tests.

## Scope and retention

- One versioned localStorage book holds the last eight hands with public played cards plus the newest unplayed hand.
- Reports include public trump/caller/dealer/score/result, ordered played cards and trick winners, public table checkpoints, planned public narration, actual selected recording identifiers with manifest text/hash/URL, and observed audio lifecycle outcomes. Build and recording-catalog identities accompany every hand.
- No unplayed hand, private discard identity, legal-action list, deck, kitty, deal seed or random state is serialized. Public historical up-card identity remains explicitly marked as historical.
- Each report retains at most 512 ordered evidence entries. If that bound is exceeded, the report states how many oldest entries were removed; its latest full public trick record remains. Audio outcomes link back to the engine-state checkpoint that preceded their planned narration.
- Selected, requested, playing and ended events are evidence from code/browser media APIs. None proves audible content or VoiceOver delivery. Native focus speech is not recorded.
- Reports are never uploaded automatically. Existing private-preview performance sync remains disabled. Copying is an explicit local user action.

## Persistence and limitations

A public-state checkpoint is serialized before rendering/narration preparation and before asynchronous speech waits. The whole bounded book is replaced with one localStorage setItem after each checkpoint or diagnostic, then read back. No unload handler is needed to obtain the last completed synchronous checkpoint.

The report store uses a separate, exception-reporting storage adapter rather than the legacy performance adapter that swallows failures. Write denial, quota failure and silent failed writes retain the in-memory report and show that the latest changes were not saved. Initial unreadable, malformed or unsupported-version data is left untouched; new reports remain in memory for that page. A later incompatible read similarly blocks overwriting. Reopen after resolving access to retry.

Sequential writes from multiple open copies merge valid reports by ID before bounded retention. Late cancellation callbacks cannot resurrect an obsolete unplayed hand; another still-active hand can re-enter retention when cards are played. localStorage does not provide multi-window transactions, so simultaneous writes across windows are best effort.

Recovery requires the same preview origin and surviving browser storage. An embedded app may clear storage. Clearing browser data, changing browsers/devices or opening another preview origin does not preserve access. This is deliberately described as conditional local recovery, not guaranteed permanent storage.

## Verification

The dedicated hand-report tests cover new store/controller recovery, same-origin bundled-page reopening without autoplay/network requests, Next hand and New game retention, evidence bounds, two-copy merging and promotion, stale cancellation, blocked/quota/silent-write/corrupt/unsupported storage, copied and manually selected fallback text, pause/focus/close/resume contracts, delayed clipboard completion, and 12 right-bower versus off-suit-ace suit pairs using the unchanged reducer and recorded-narration adapter. Those fixtures retain the correct engine winner and the selected winner recording/hash.

A report cannot recover a session that ended before this feature existed. This feature does not claim to fix or explain an unrecorded rules or audio discrepancy. The engine/bots, session, narrator-selection code, manifests and recording files are preserved.
