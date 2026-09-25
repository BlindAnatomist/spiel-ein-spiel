# Bot validation: fixed experiment plan

Source: 46e4a0c04f9007387bc98ef4aaf1d256f20aec05. Harness: bot-validation-v1.
Main: b6f647c7d64c58e7b147cb03df729433604d3650.
PR 7: fba6aa22acffb20c27f7f0e2a35a4980d4227082.
The executable manifest was written before the large run. No live settings are changed.

## Primary questions and practical thresholds

1. Right minus left voluntary calls/opportunities: 2 percentage points. Analyze each tier with the original proxy/Val assignment and with those two players swapped. Calls made and net points per call are secondary. Same-profile and distinct-profile components, dealer relationships, profile variants and Strong replication halves are exploratory.
2. Higher-tier team win share relative to 50%, and common-partner change in win rate: 5 percentage points. Final-score difference: 0.5 points. Evaluate all 33 between-tier profile pairs. Mixed/profile-specific reversals are reported, not optimized away.
3. Val minus each of four Strong variants, with controlled partners, opponents and rotations: 5 percentage points in win rate, 0.5 final-score points. Three partner tiers and all 16 ordered Strong opponent pairings, including identical-profile controls.

Primary estimates have ordinary 95% cluster bootstrap intervals and family-wise Bonferroni intervals across 16 primary comparisons (6 seat, 6 hierarchy, 4 Val). Secondary and subgroup intervals are exploratory and unadjusted. Exactly 1999 resamples, fixed analysis RNG. Small subgroup block counts or sparse call/loner counts are flagged. An interval overlapping zero does not establish equivalence. Even an interval contained inside a practical margin applies only to these controlled bot lineups.

## Allocation

- Casual: 128 games/case × 18 cases = 2,304 games; nine ordered profile pairings × two proxy assignments.
- Expert: 64 × 18 = 1,152 games; actual 24-sample/three-card search retained.
- Cross-tier: 32 blocks × 33 profile pairs × ten cases = 10,560 games. Two team assignments and two focal policies × four clockwise rotations for common-partner tests. Common surrounding lineup is Balanced Strong.
- Val: 16 blocks × 48 partner/opponent contexts × five focal policies × four clockwise rotations = 15,360 games. Each context has its own independent seed stream; comparisons within it share seeds.
- Fresh Strong replication: 320 × 32 = 10,240 games. Two predetermined 160-block batches. Each contains every same-profile and distinct-profile orientation and both proxy assignments. Each case exceeds the original 250 games/case after combining batches.
- Symmetry: 32 × 11 policies × four rotations = 1,408 games. All four seats use the same policy.
- Total: 41,024 scheduled complete games. First eight blocks of every group precede expansion. Four bounded processes. Fixed allocation; no favorable-result stopping or extension.

## Matching, units and identifiability

`simulationSeed` and the production referee generate games. Dealing consumes RNG only between hands. The audit asserts no action changes RNG. Before each hand it hashes all four initial hands plus kitty, undoing only the declared clockwise rotation. All overlapping hand numbers in a group/seed block must match exactly. This verifies the actual cards, not just the starting seed.

Complete games may have different hand counts. Full-game outcomes retain all hands. A separate common-prefix sensitivity analysis uses only hand numbers present in every case within the group/seed block. This is a conditional, outcome-dependent prefix, not an unbiased fixed-length hand experiment. Tail counts are retained. Rotating seats and dealer together preserves the same relative deal. Initial dealer relative to the unrotated lineup cycles across four consecutive blocks. Every scheduled chunk has eight blocks and therefore balanced initial dealer positions.

Independent resampling units are group plus seed-block, never decisions, hands or games within a block. Each block contains all controlled alternatives. Between-group seed streams use a documented SHA256-derived base. Pooled cross-tier and Val estimates weight the declared lineup contexts equally. Within a single Val context only 16 independent blocks exist; aggregate precision does not make every matchup precise.

Physical seat, relative dealer position (0 dealer, 1 first bidder, 2 dealer's partner, 3 third bidder), profile, partner and ordered opposing lineup remain separate dimensions in raw evidence. A relative-position effect is not automatically a physical-seat bias. Common partners address a different estimand from same-tier teams.

## Targeted supplements

128 scripted loner hands: four dealers × four callers × two calling rounds × four fixed seeds derived from base 90192026. These force a loner to exercise rules; they are not natural policy attempt-rate evidence. Production policies handle discard/play. Inspect partner sit-out, opening lead, skip order, pickup/discard and all observed scoring outcomes; the baseline rule suite additionally covers every scoring result at the final trick.

32 fixed reachable tactical games, base 90252026. Retain at most the first two observations per context per game: bidding, lead, partner-return opportunity, partner winning and trump conservation. All five Val/Strong candidates receive the same permitted view. Evaluate each chosen action with fixed production-policy continuations in the host's actual deal. This is a conditional counterfactual diagnostic, not an optimal-play oracle or evidence that any heuristic disagreement is an error. It can miss strategic benefits outside the selected contexts or continuation policies.

## Reproducibility and failure handling

The manifest contains every case, seed base, block range, rotation and policy parameter. Gzipped chunk JSON contains every complete game's seed, lineup, dealer, initial deal signatures, bids, hand outcomes, scores, decision digest and cost. Policy inputs contain only the acting PlayerView. Host snapshots belong only to independent checks and failure evidence; no ledger/browser/network module is imported.

The oracle independently computes legal choices, effective suits, trick winners and scoring, and checks order, pickup/discard, card conservation, next leader, dealer rotation and termination. A failed game saves its seed, case, state and complete action trace; unrelated jobs continue. No failed game is dropped from the expected denominator.

Commands:

```sh
npm ci --ignore-scripts
npm run check
npm run build
git diff --check
node src/audit/validation-cli.ts --mode benchmark
node src/audit/validation-cli.ts --mode manifest
node src/audit/validation-cli.ts --mode run --workers 4
node src/audit/validation-fixtures.ts --run
python3 scripts/analyze-bot-validation.py
```

The manifest command refuses to replace a predeclaration. Resume with the run command; validated complete chunks are retained. Rerunning fixtures uses the same seeds. Expensive runs remain on demand, outside push/deploy gates.

## Analysis details and field keys

The bootstrap for pooled cross-tier and Val comparisons resamples seed blocks within each fixed matchup context, preserving the declared equal context weights. This is a stratified matched-block bootstrap. Profile-wide descriptive rates combine the observed experiment mixture and are not strength rankings. Their exploratory intervals resample whole group/seed blocks.

`dealer-position.json.gz` key: profile, dealer relationship, bidding round, forced flag.
`profile-seat.json.gz` key: profile, absolute seat.
`forced-suit.json.gz` key: profile, called suit; every record is a forced second-round dealer opportunity.
`lineup-context.json.gz` key: category, profile, absolute seat, dealer relationship, partner profile, clockwise opponent profile, counterclockwise opponent profile, bidding round, forced flag.
Each row carries integer counts plus explicit rate numerator, denominator and denominator name. The full raw game records retain bid ordering, per-hand deal hashes and all results so these tables can be recomputed independently.

Development corrections: the first tactical-rollout bound allowed only 25 remaining actions and rejected a valid second-round continuation. The bounded rollout now permits the complete bidding-plus-play path. This was an audit-driver bound error, not a production termination defect; the original diagnostic is retained. Statistical self-checks additionally verify forced-call losses, undefined rates, matched-ratio arithmetic, within-game repetition and fixed-context bootstrap weights.
