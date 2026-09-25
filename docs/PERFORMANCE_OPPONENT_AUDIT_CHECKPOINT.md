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

## Opponent profiles and table identities

The existing Casual, Strong and Expert strategic cores remain. New profiles are immutable parameter variants of those same legal-information policies.

Current strategy profiles:

- Casual: Balanced Casual, Cautious Casual, Bold Casual.
- Strong: Balanced Strong, Conservative Strong, Assertive Strong, Partnership Strong.
- Expert: Balanced Expert, Conservative Expert, Assertive Expert.
- Val remains Val and is not placed in the opponent profile pool.

For live browser games at Casual, Strong or Expert, the two opponent seats receive distinct profiles from the selected tier. For Mixed opponents, the two seats are guaranteed to come from different difficulty tiers.

The programmatic `createSession(seed, level)` default remains the accepted PR #6 baseline: both opponents use the exact named policy selected by `level`. Live browser construction explicitly opts into `opponentMode: 'varied'`. Profile selection is derived from the host's per-game seed; the seed is never passed into a policy.

Table identity is permanent and symmetric by strategy. Every strategy profile owns exactly two compact identities: a W-name for seat 1 (the human's left) and an E-name for seat 3 (the human's right). The same strategy can therefore appear on either side without changing identity semantics, and a recurring name never changes level or strategy.

Permanent pairs:

- Casual Balanced: Walt / Emma.
- Casual Cautious: Wes / Edith.
- Casual Bold: Wyatt / Eva.
- Strong Balanced: Wayne / Elise.
- Strong Conservative: Will / Ellen.
- Strong Assertive: Wade / Erica.
- Strong Partnership: Ward / Erin.
- Expert Balanced: Wolf / Elsa.
- Expert Conservative: Wren / Etta.
- Expert Assertive: Webb / Eden.

All names are five characters or fewer. W always marks the left seat and E always marks the right seat. Profile selection remains independent by seat, so no level or strategy is locked to one side of the table.

The durable record stores seat, permanent table name, strategy profile ID, profile label and level separately. Narration, dealer/current-state review, trick review, turn text and visible seat labels all use the permanent names. A varied session rejects a supplied table name that does not match the selected strategy, preventing identity drift. Default non-varied programmatic tests retain West/East unless names are explicitly supplied.

Balanced profiles exactly reproduce the existing named policies. Profile variation never relaxes legal-play enforcement, grants hidden-card access, changes bowers, or creates separate rule logic.

## Performance tracking and evidence schema

Tracking is local-first but the durable analytical record lives in the Netlify ledger. There are no player accounts, passwords or named human profiles.

The New Game setup has one toggle, defaulting to `My performance`:

- `My performance`: contributes to the owner's longitudinal human record and to bot analysis.
- `Bot data only`: contributes to bot analysis but never to the owner's human statistics or trend.

The choice is captured once when New Game begins and cannot be reclassified during that game.

### Schema version 2, dataset epoch 1

The serious longitudinal dataset begins with:

- `schemaVersion: 2`;
- `datasetEpoch: 1`;
- exact build commit from the Netlify build;
- rules version `euchre-standard-v1`;
- stable game ID and completion timestamp;
- human tracking classification;
- selected difficulty;
- starting dealer;
- four table names;
- exact W/E opponent profile IDs, labels and levels;
- permanent name/profile pairing, so historical Wade always means Strong Assertive on the left and Erica always means Strong Assertive on the right;
- final score and winner.

The earlier single infrastructure-test submission predates this schema and is not part of dataset epoch 1.

Each hand records:

- hand number;
- dealer;
- score before and after the hand;
- up-card;
- the owner's original five-card hand only for `My performance` games;
- every accepted decision in sequence;
- caller, called suit, calling round and loner status;
- maker trick count, awarded team, points and result reason.

Each accepted decision records:

- global decision sequence number;
- acting seat;
- actor kind: owner, other human, Val or opponent;
- table name;
- bot profile ID when applicable;
- action actually chosen;
- exact permitted `PlayerView` immediately before the action, except for an untracked human.

For `My performance`, the owner's decision view is preserved so future analysis can examine the actual hand, public information, legal alternatives and chosen action. For Val and both opponents, the same permitted-view evidence is preserved for bot analysis.

For `Bot data only`, the other human's chosen action and public result remain part of the sequence, but that person's private hand and decision view are deliberately omitted. Val and opponent decision views are still archived.

The recorded decision view is the same capability boundary the policy receives. It may contain that actor's own hand and public state, but never another seat's private hand, the hidden kitty, referee snapshot, engine seed, random words or privileged authoritative state. Recording occurs after a legal action succeeds and cannot feed information back into the live decision path.

No permanent judgment such as “good move,” “bad move,” skill score or optimality score is stored. Those are derived analyses that can be recalculated later as evaluation methods improve.

### Local summary versus durable archive

The browser does not retain hundreds of full decision transcripts in localStorage. It keeps a compact version-2 summary, bounded to the most recent 300 completed games, for immediate Analysis use.

The pending archive queue temporarily contains the richer record until Netlify accepts it. The server archive is the durable source for deeper later analysis.

Archival sequence:

1. complete game;
2. construct the versioned rich record;
3. save the compact summary locally;
4. queue the rich record locally;
5. submit it to `euchre-performance-ledger`;
6. remove it from the pending queue only after an HTTP success response.

The queue retries on page load and after subsequent completed games. Network failure never blocks game play. A stable game ID provides the deduplication key if an accepted submission is retried.

The Netlify form exposes searchable envelope fields for profile ID, game ID, completion time, human-tracking mode, schema version, dataset epoch, build commit and rules version; the full rich record is carried in the payload.

A random recovery code identifies this installation's archive without becoming a login credential. It is available through Analysis rather than as a permanent extra button.

### Analysis

There is exactly one Analysis button. The owner-facing trend uses only current-epoch `My performance` games and groups them into sequential 10-game blocks. Accessible text reports win rate, owner calling-success rate and average final-score differential. A sighted SVG chart shows win rate and calling success from the same owner-only blocks.

Bot summaries use all current-epoch completed games, including `Bot data only` games. The richer server evidence permits later analysis of bidding, card play, partnership decisions, opponent personality, dealer position and starting-hand quality without changing the historical record.

### Compact setup and protected action order

The setup is deliberately limited to:

- opponent difficulty;
- one `My performance` / `Bot data only` toggle;
- New Game;
- one Analysis button;
- the existing Sound Cues control.

During bidding, VoiceOver/navigation order is:

1. Your hand heading;
2. cards in stable engine order;
3. positive call/order-up choices;
4. Pass when legal;
5. Repeat current state;
6. Review last trick when available.

Automatic bidding focus may still land on the first positive bid. During play, order remains hand/cards, Repeat current state, then Review last trick when available. The first-legal-card focus rule for play/discard is unchanged.

## Bot-profile simulation audit

The checkpoint now includes an on-demand bot-vs-bot audit for profile balance and seat effects. It uses the authoritative referee and the same bot policies as live play; it does not use the browser UI or any privileged state inside a policy.

Run:

```sh
npm run audit:bots -- --tier strong --games 500 --seed 20260924
```

`--games` means games per audit case. For the four Strong profiles, the audit runs:

- same-profile seat tests, placing the same strategy in seats 1 and 3 over matched seed/dealer sequences;
- a full round robin of every distinct pair;
- each round-robin pair twice on the same seed/dealer, with the profiles swapped left/right.

Seat 0 is held at the tier's Balanced profile and seat 2 is held at Val so the opponent environment is stable while the left/right profiles vary.

For each profile and seat, the report measures:

- bidding opportunities;
- voluntary opportunities, excluding stick-the-dealer forced calls;
- calls and voluntary calls;
- forced calls;
- round-one versus round-two calls;
- made calls and euchres;
- marches;
- loner attempts and successful loners;
- average maker tricks;
- points earned per call;
- overall and voluntary call rates.

The same-profile section reports right-minus-left differences in call rate, voluntary call rate, call success, euchre rate and points per call. The round robin aggregates every profile separately on the left and right as well as combined.

This audit is intended to detect persistent seat effects and strategy-balance differences much faster than human play can. It does not replace real-device testing of VoiceOver, narration timing, table comprehension or subjective game feel.

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

The checkpoint changes presentation only where required for table names and the already-requested cards-first bidding navigation. It does not change:

- Euchre rules, scoring, bowers or legal-action enforcement;
- bot access to hidden information;
- the serialized narrator writer;
- the 1150 ms narration/focus guard;
- the first-legal-card play/discard focus algorithm;
- stable hand order or unavailable-card reachability;
- sound meanings or timing.

Default West/East names remain the programmatic fallback so existing deterministic and narrator tests retain their accepted baseline semantics. Live games pass the W/E table identities explicitly.

The performance observer receives only actor-specific permitted views plus public session metadata. Observer failures are caught and cannot interrupt game play.

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
4. New Game still behaves as expected and does not count an abandoned game;
5. a game begun as `Other player — bot data only` leaves the owner's human summary and Analysis trend unchanged while increasing bot observations;
6. Analysis text and the sighted chart use the same owner-only 10-game block data.
