# Performance, opponent variety and deal-audit checkpoint

Status: draft checkpoint. Owner acceptance required before merge.

Authoritative base: `b6f647c7d64c58e7b147cb03df729433604d3650`, the merge commit for accepted PR #6.

Branch: `feat/euchre-performance-opponent-audit`.

PR #7 (`feat/euchre-mobile-table-layout`) is a separate visual-review branch and must remain untouched. This checkpoint does not copy or depend on PR #7.

## Goals

1. Record useful human/team and bot performance without inventing an individual skill score.
2. Add opponent variation within each difficulty and permit deliberately mixed opponent tiers.
3. Provide an empirical audit path for deal distribution so perceived runs of weak or unusual hands can be compared with measured distributions.
4. Preserve the accepted PR #6 VoiceOver, narrator, focus, hand-order and hidden-information contracts.

## Opponent profiles

The existing Casual, Strong and Expert strategic cores remain. New profiles are immutable parameter variants of those same legal-information policies.

Current profiles:

- Casual: Cautious Casual, Bold Casual.
- Strong: Balanced Strong, Conservative Strong, Assertive Strong, Partnership Strong.
- Expert: Balanced Expert, Conservative Expert, Assertive Expert.
- Val remains Val and is not placed in the opponent profile pool.

For Casual, Strong or Expert game setup, West and East receive two distinct profiles from the selected tier. For Mixed opponents, West and East are guaranteed to come from two different difficulty tiers.

Profile selection is derived from the host's per-game seed. In live browser games that seed is already generated from `crypto.getRandomValues`. In deterministic tests the same seed reproduces the same profile pair. The seed is never passed into a decision policy.

The profile mechanism changes strategy parameters only. It does not relax legal-play enforcement, grant hidden-card access, alter bowers, or create separate rule logic.

## Performance tracking

Tracking is browser-local and uses `localStorage`. No network request, account, backend, analytics service or telemetry endpoint is added.

Only completed games are persisted. Starting a new game before the current game ends does not count the abandoned game as a completed loss.

The persisted record contains public completion information:

- selected setup difficulty;
- West/East profile identity;
- final score and winning team;
- for each completed hand: dealer, caller, calling round, loner status, maker trick count, awarded team, points and result reason.

It does not store:

- hidden hands;
- kitty contents;
- discarded hidden cards;
- referee snapshots;
- engine seed;
- random words;
- bot inference state.

The current summary reports:

- completed games, wins/losses, win rate and average final score for You and Val;
- a rolling last-20 completed-game win rate;
- total completed hands;
- human calling record: calls, made-call rate, euchre rate, marches and loner results;
- Val calling record with the same public measures;
- West versus East calling counts;
- opponent profiles encountered and number of completed games against each.

These are descriptive records, not a claim that the human alone caused a team outcome. Individual card-play quality is not yet scored.

The history is bounded to the most recent 500 completed games to avoid unbounded browser storage growth.

The Performance summary button is explicitly user-invoked. It writes ordinary static text and moves focus only because the user activated that control. It does not add another live region, automatic announcement or in-game focus transition.

## Deal-distribution audit

`src/audit/deals.ts` uses the authoritative deal function itself rather than a parallel shuffle implementation.

The audit can run in two modes:

- deterministic: replayable seed sequence for regression and debugging;
- crypto: injected Node cryptographic 32-bit words, exercising the same live-random Fisher-Yates path used by the browser.

Run:

```sh
npm run audit:deals -- --deals 50000 --seed 20260923 --source deterministic
npm run audit:deals -- --deals 50000 --seed 20260923 --source crypto
```

The report measures:

- each card's frequency at seats 0, 1, 2, 3 and in the kitty;
- the largest standardized card-location deviation;
- seat-zero average rank counts and suit counts;
- seat-zero distinct-suit and maximum-same-suit histograms;
- every two-card pair's co-occurrence frequency in the seat-zero hand;
- the largest standardized pair-frequency deviation.

The automated regression currently audits 20,000 deterministic deals and requires the largest card-location and seat-zero pair deviations to remain below six standard deviations. The threshold is deliberately loose enough to avoid treating ordinary sampling noise as a defect while still catching major structural bias. It is a regression alarm, not a proof of perfect randomness.

The existing shuffle still uses rejection sampling before Fisher-Yates selection, so modulo bias is not introduced by mapping 32-bit words to shrinking deck bounds.

## Protected PR #6 contract

This checkpoint does not modify:

- `web/controller.ts`;
- `web/announcer.ts`;
- `web/render.ts`;
- `web/presentation.ts`;
- `web/sound.ts`;
- rule, trick, scoring or bower code;
- the first-legal-card focus algorithm;
- the 1150 ms narration/focus guard;
- hand ordering or unavailable-card reachability.

The browser session remains the only trusted coordinator for player ports. Performance observers receive only the seat-zero `PlayerView` plus public opponent-profile metadata. Observer failures are caught so storage problems cannot interrupt game play.

## Validation

Required before acceptance:

```sh
npm ci --ignore-scripts
npm run check
npm run build
npm run audit:deals -- --deals 50000 --seed 20260923 --source deterministic
```

The new test file also completes a full Mixed game through the normal session boundary and asserts that public tracking callbacks contain no hidden state.

Real-device owner testing should confirm that:

1. existing PR #6 VoiceOver timing and focus remain unchanged during ordinary play;
2. Mixed opponents are playable and feel behaviorally varied without illegal actions;
3. Performance summary is easy to reach and does not interfere with game navigation;
4. New Game still behaves as expected and does not count an abandoned game.
