Euchre bot validation and calibration — completed recovery, September 25, 2026 UTC

No live engine or bot-policy defect was confirmed. All 41,024 scheduled games were backed by per-game evidence in the verified full repair archive. The lost portion was regenerated using the same fixed seeds and assignments. All category game, hand and decision totals and all 26 primary point estimates exactly match the surviving original analysis. No strategy parameters or production behavior were changed.

No meaningful right-seat voluntary-calling advantage was established. Several intervals remain too wide to rule out the predeclared two-percentage-point margin. An exploratory lower right-seat call-success signal remains in one Strong comparison; its mechanism is unresolved.

The pooled evidence supports Casual < Strong < Expert for both same-tier teams and common-partner substitutions. Individual matchup uncertainty remains. Val is practically similar to Balanced and Partnership Strong in the tested pooled contexts. Its small apparent deficit to Assertive Strong is not robust to the primary multiple-comparison adjustment.

No confirmed live defect from this battery blocks PR #8 acceptance. The audit itself is complete; device and VoiceOver acceptance remain outside its scope. Nothing was merged. No simulation entered the human ledger.

Recovery and provenance

The initial PR #8 SHA matched 46e4a0c04f9007387bc98ef4aaf1d256f20aec05. Main remains b6f647c7d64c58e7b147cb03df729433604d3650; PR #7 remains fba6aa22acffb20c27f7f0e2a35a4980d4227082. Only the existing PR #8 branch received audit changes.

A prior executor reset lost unpublished harness files and 254 detailed batches. The 82 recovered batches (7,584 games) were retained byte for byte. The other 254 batches (33,440 games) were rerun, without adding or selecting seeds. Primary point estimates are unchanged. Pooled reconstructed intervals use a documented sorted-stratum bootstrap and can differ slightly from the preserved original intervals. The reconstructed driver exactly replayed a retained game’s permitted decisions, deal signatures, scores and trace digest. Source and the fixed schedule were published before recovery runs. The owner’s verified full repair ZIP preserves all 336 detailed batches plus the historical recovery/checkpoint material; its SHA-256 and publication receipt are recorded in `reports/bot-validation/ARCHIVE_RECORD.md`.

There are 2,688 independent group/seed blocks, 429,260 matching-hand fingerprint comparisons and 48,279 hand occurrences beyond their block’s shortest game. No deal mismatches occurred. Complete games may end at different hands; complete-game outcomes retain tails, while the separate common-prefix analysis is an outcome-dependent sensitivity check.

The predeclared practical margins are 2 percentage points for voluntary calls, 5 percentage points for win differences, and 0.5 final-score points. Every bootstrap retains whole matched blocks; pooled cross-tier and Val comparisons resample within fixed lineup contexts. There are 1,999 deterministic resamples. Ordinary 95% intervals appear below; family-wise intervals for 16 primary comparisons appear in summary.json and COMPARISONS.txt. Subgroups are exploratory. Nonsignificance does not establish equivalence.

Actual coverage

casual: 2,304 games, 26,624 hands, 662,521 decisions, 18 cases, 128 independent blocks; 128 games per case.

expert: 1,152 games, 12,963 hands, 322,014 decisions, 18 cases, 64 independent blocks; 64 games per case.

cross: 10,560 games, 118,967 hands, 2,992,873 decisions, 330 cases, 1056 independent blocks; 32 games per case.

val: 15,360 games, 172,751 hands, 4,344,584 decisions, 960 cases, 768 independent blocks; 16 games per case.

strong: 10,240 games, 115,740 hands, 2,927,187 decisions, 32 cases, 320 independent blocks; 320 games per case.

symmetry: 1,408 games, 15,672 hands, 391,245 decisions, 44 cases, 352 independent blocks; 32 games per case.

Total: 41,024 complete games, 462,717 hands and 11,640,424 decisions. The schedule covers every category before expanding its predetermined blocks. Four processes ran at most concurrently. Recovery-wave logs and per-batch timing details are preserved in the verified full repair ZIP; compact runtime/provenance evidence remains in `provenance.json` and `benchmark-reconstruction.json`. Cached batches retained their original timings, so the sum is not one contiguous wall-clock measurement.

Casual profiles and seats

Every same-profile control and distinct ordered profile pair ran with both the original seat-zero proxy/Val placement and those opposing players exchanged. Initial dealers were balanced. Relative dealer position, absolute seat, profile, partner and opposing identities remain distinct.

original, right minus left: voluntary call rate +0.55; 95% interval [-2.01, +3.20]; 128 independent blocks percentage points; call make rate -3.48; 95% interval [-7.75, +1.18]; 128 independent blocks percentage points; net points per call -0.12; 95% interval [-0.28, +0.04]; 128 independent blocks.

proxy-swapped, right minus left: voluntary call rate +0.75; 95% interval [-1.70, +3.32]; 128 independent blocks percentage points; call make rate -0.95; 95% interval [-5.41, +3.55]; 128 independent blocks percentage points; net points per call -0.06; 95% interval [-0.21, +0.09]; 128 independent blocks.

casual-cautious-minus-casual-balanced: voluntary call difference -6.96; 95% interval [-7.75, -6.16]; 128 independent blocks percentage points. This describes bidding behavior, not a strength ranking.

casual-bold-minus-casual-balanced: voluntary call difference +8.66; 95% interval [+7.79, +9.49]; 128 independent blocks percentage points. This describes bidding behavior, not a strength ranking.

Expert profiles and seats

Every same-profile control and distinct ordered profile pair ran with both the original seat-zero proxy/Val placement and those opposing players exchanged. Initial dealers were balanced. Relative dealer position, absolute seat, profile, partner and opposing identities remain distinct.

original, right minus left: voluntary call rate -0.16; 95% interval [-4.17, +3.45]; 64 independent blocks percentage points; call make rate -4.83; 95% interval [-11.03, +1.53]; 64 independent blocks percentage points; net points per call -0.10; 95% interval [-0.32, +0.12]; 64 independent blocks.

proxy-swapped, right minus left: voluntary call rate +0.50; 95% interval [-3.12, +4.33]; 64 independent blocks percentage points; call make rate -3.24; 95% interval [-9.33, +3.02]; 64 independent blocks percentage points; net points per call -0.02; 95% interval [-0.25, +0.21]; 64 independent blocks.

expert-conservative-minus-expert-balanced: voluntary call difference -5.49; 95% interval [-6.74, -4.34]; 64 independent blocks percentage points. This describes bidding behavior, not a strength ranking.

expert-assertive-minus-expert-balanced: voluntary call difference +5.59; 95% interval [+4.40, +6.74]; 64 independent blocks percentage points. This describes bidding behavior, not a strength ranking.

Expert retained its real 24-sample, three-card search budget. The 64 blocks leave wide seat intervals; the two-point seat margin is unresolved. benchmark-reconstruction.json records eight games per audited Strong/Expert lineup, with the exact lineup, elapsed time and policy time. Val occupies seat two in those benchmark cases; these are not four-Expert-versus-four-Strong team benchmarks. Per-profile policy cost is recorded separately from playing strength.

Independent Strong replication

Every same-profile control and distinct ordered profile pair ran with both the original seat-zero proxy/Val placement and those opposing players exchanged. Initial dealers were balanced. Relative dealer position, absolute seat, profile, partner and opposing identities remain distinct.

original, right minus left: voluntary call rate +0.66; 95% interval [-0.76, +2.12]; 320 independent blocks percentage points; call make rate -1.98; 95% interval [-4.40, +0.56]; 320 independent blocks percentage points; net points per call -0.07; 95% interval [-0.17, +0.03]; 320 independent blocks.

proxy-swapped, right minus left: voluntary call rate +0.32; 95% interval [-1.12, +1.79]; 320 independent blocks percentage points; call make rate -2.55; 95% interval [-5.15, -0.14]; 320 independent blocks percentage points; net points per call -0.08; 95% interval [-0.19, +0.02]; 320 independent blocks.

strong-conservative-minus-strong-balanced: voluntary call difference -4.39; 95% interval [-4.79, -3.99]; 320 independent blocks percentage points. This describes bidding behavior, not a strength ranking.

strong-assertive-minus-strong-balanced: voluntary call difference +5.80; 95% interval [+5.28, +6.31]; 320 independent blocks percentage points. This describes bidding behavior, not a strength ranking.

strong-partnership-minus-strong-balanced: voluntary call difference +0.65; 95% interval [+0.47, +0.84]; 320 independent blocks percentage points. This describes bidding behavior, not a strength ranking.

The 320 fresh blocks comprise two predetermined 160-block batches, exceeding the previous 250 games/case. All 320 new seeds were checked against both original base-20260924 streams; none overlap. Common-prefix, same/distinct pairing, profile, batch and dealer-role comparisons are retained. Exchanging proxy and Val did not establish a meaningful right-seat calling advantage.

original/batch-1: voluntary +0.33; 95% interval [-1.70, +2.38]; 160 independent blocks; make rate -0.44; 95% interval [-3.85, +3.32]; 160 independent blocks percentage points.

original/batch-2: voluntary +0.97; 95% interval [-1.23, +3.14]; 160 independent blocks; make rate -3.46; 95% interval [-6.92, -0.15]; 160 independent blocks percentage points.

proxy-swapped/batch-1: voluntary -0.25; 95% interval [-2.23, +1.67]; 160 independent blocks; make rate -1.00; 95% interval [-4.65, +3.00]; 160 independent blocks percentage points.

proxy-swapped/batch-2: voluntary +0.87; 95% interval [-1.39, +3.02]; 160 independent blocks; make rate -4.06; 95% interval [-7.36, -0.68]; 160 independent blocks percentage points.

Observed result: a negative right-minus-left call-success estimate, with one exploratory pooled interval excluding zero. Statistical interpretation: an unadjusted follow-up signal among many comparisons. Suspected cause: unresolved; finite-seed variation and lineup/dealer interactions remain possible. Confirmed defect: none. No bot-versus-bot result measures the owner’s playing strength.

Cross-tier calibration

All 33 profile pairs ran 32 blocks each: two team assignments plus eight common-partner assignments. This is 2,112 team games and 8,448 common-partner games. Team estimates below are higher-tier win percentages (compare with 50%), and higher-tier final-score advantages. Common-partner estimates are higher-minus-lower changes, holding the other three policies at Balanced Strong and rotating the focal seat.

casual-vs-strong
teams: win +70.70; 95% interval [+67.97, +73.31]; 384 independent blocks percentage points; score +2.59; 95% interval [+2.34, +2.82]; 384 independent blocks points.
common: win +13.80; 95% interval [+9.90, +17.97]; 384 independent blocks percentage points; score +1.43; 95% interval [+1.12, +1.75]; 384 independent blocks points.

strong-vs-expert
teams: win +58.33; 95% interval [+55.86, +60.68]; 384 independent blocks percentage points; score +1.10; 95% interval [+0.89, +1.32]; 384 independent blocks points.
common: win +6.84; 95% interval [+3.26, +10.55]; 384 independent blocks percentage points; score +0.71; 95% interval [+0.44, +0.98]; 384 independent blocks points.

casual-vs-expert
teams: win +80.21; 95% interval [+77.43, +82.99]; 288 independent blocks percentage points; score +3.60; 95% interval [+3.33, +3.85]; 288 independent blocks points.
common: win +19.44; 95% interval [+14.58, +24.74]; 288 independent blocks percentage points; score +2.01; 95% interval [+1.64, +2.42]; 288 independent blocks points.

No lower-tier team point estimate won a majority: observed team reversals []. No cross-tier three-profile cycle appears in these measured team edges; within-tier team edges were not all measured, so global transitivity is not established. Individual pair comparisons have only 32 blocks.

Common-partner reversal: casual-bold-vs-strong-balanced -6.25; 95% interval [-21.88, +9.38]; 32 independent blocks percentage points. This is an uncertain matchup, not a reason to tune labels.

Common-partner reversal: strong-partnership-vs-expert-conservative -1.56; 95% interval [-7.03, +2.34]; 32 independent blocks percentage points. This is an uncertain matchup, not a reason to tune labels.

Dealer positions, forced calls and loners

All eleven policies contribute observations at dealer, first bidder, dealer’s partner and third bidder, split by round and forced status. There were 86,870 forced second-round dealer calls and 22,058 natural loner attempts. Each rate in the data carries numerator, denominator and denominator name. An opportunity is one bidding decision; a player can have opportunities in both rounds of a hand. Forced opportunities are excluded from voluntary rates. Undefined rates are null, not zero.

The readable dealer/loner appendix reports every profile, dealer role, round and forced-suit selection, including makes, euchres, gross earned points, conceded points and net points. `controlled-hand-outcomes.json.gz` supplies compact hand outcomes by controlled matchup and focal/opposing team. The full repair ZIP retains the larger lineup-context and per-game evidence. Descriptive pooled profile totals depend on the experiment mixture and are not strength rankings.

casual-balanced: 337 natural attempts; 276 five-trick four-point successes; 61 three/four-trick one-point makes; 0 euchres.

val: 2493 natural attempts; 1664 five-trick four-point successes; 829 three/four-trick one-point makes; 0 euchres.

casual-cautious: 12 natural attempts; 8 five-trick four-point successes; 4 three/four-trick one-point makes; 0 euchres.

casual-bold: 282 natural attempts; 202 five-trick four-point successes; 79 three/four-trick one-point makes; 1 euchres.

expert-balanced: 1010 natural attempts; 767 five-trick four-point successes; 223 three/four-trick one-point makes; 20 euchres.

expert-conservative: 187 natural attempts; 136 five-trick four-point successes; 46 three/four-trick one-point makes; 5 euchres.

expert-assertive: 723 natural attempts; 408 five-trick four-point successes; 312 three/four-trick one-point makes; 3 euchres.

strong-balanced: 8465 natural attempts; 5535 five-trick four-point successes; 2894 three/four-trick one-point makes; 36 euchres.

strong-conservative: 930 natural attempts; 867 five-trick four-point successes; 63 three/four-trick one-point makes; 0 euchres.

strong-assertive: 4734 natural attempts; 2389 five-trick four-point successes; 2322 three/four-trick one-point makes; 23 euchres.

strong-partnership: 2885 natural attempts; 1872 five-trick four-point successes; 993 three/four-trick one-point makes; 20 euchres.

Cautious Casual has only twelve natural attempts. Zero observed loner euchres for a policy is not zero risk; degenerate event-risk intervals are unavailable and sparse eligible blocks are flagged. Attempt rate alone cannot establish timidity or recklessness.

The separate scripted rule supplement ran 128 loner hands across all dealer/caller positions, both rounds and four fixed seeds. Outcomes: {'loner-march': 4, 'euchred': 112, 'made': 12}. All passed opening-lead, sit-out, skip order, pickup/discard and scoring checks. These deliberately forced calls are rule coverage, not natural strategy evidence.

Val-specific controlled and tactical evidence

Val and all four Strong alternatives each played 3,072 games: three partner tiers, all sixteen ordered Strong opponent pairs, four focal rotations, sixteen blocks/context. The 15,360 games contain 768 independent blocks. The same Val games serve multiple comparisons and are not new independent evidence each time.

Val minus strong-balanced: win +0.20; 95% interval [-0.85, +1.30]; 768 independent blocks percentage points; score +0.08; 95% interval [+0.00, +0.17]; 768 independent blocks points. Family-wise win interval: +0.20; 95% interval [-1.46, +1.75]; 768 independent blocks.

Val minus strong-conservative: win +4.36; 95% interval [+2.54, +6.22]; 768 independent blocks percentage points; score +0.44; 95% interval [+0.31, +0.58]; 768 independent blocks points. Family-wise win interval: +4.36; 95% interval [+1.83, +7.30]; 768 independent blocks.

Val minus strong-assertive: win -2.15; 95% interval [-4.20, -0.10]; 768 independent blocks percentage points; score -0.23; 95% interval [-0.39, -0.08]; 768 independent blocks points. Family-wise win interval: -2.15; 95% interval [-5.20, +1.01]; 768 independent blocks.

Val minus strong-partnership: win -0.29; 95% interval [-0.91, +0.23]; 768 independent blocks percentage points; score -0.01; 95% interval [-0.04, +0.02]; 768 independent blocks points. Family-wise win interval: -0.29; 95% interval [-1.29, +0.55]; 768 independent blocks.

Balanced and Partnership pooled adjusted win intervals lie inside the plus/minus-five-point practical margin. This supports similarity only in these tested contexts. Conservative’s directional deficit does not establish a five-point minimum advantage for Val. Assertive’s apparent advantage does not survive the family-wise adjustment. Partner-specific and individual context estimates are exploratory; each context has only sixteen blocks.

The reconstructed tactical supplement ran 32 complete games and retained 276 permitted views, with context counts {'bidding': 64, 'lead': 64, 'trump-conservation': 64, 'partner-winning': 64, 'partner-return': 60}. A view can have multiple selected contexts. Its partner-return criterion explicitly means: the player has a lead choice and a completed trick was led by its partner and won by their team. This transparent reconstructed criterion yields a different targeted sample from the lost original supplement; no original tactical sample count is claimed as recovered.

All five policies receive exactly the same permitted view. Each chosen action is followed by fixed production-policy continuations on the actual host deal. Host state stays outside policy inputs. Action differences from Val: {'strong-balanced': 2, 'strong-conservative': 3, 'strong-assertive': 3, 'strong-partnership': 1}. The full views, actions and conditional hand outcomes are retained in fixtures.json.gz.

Conditional-cost example: seed 3389964757, hand 1, decision 7, seat 3; Val {'type': 'play', 'card': 'spades:Q'} gives net -1, strong-balanced {'type': 'play', 'card': 'spades:J'} gives net 2.

Conditional-cost example: seed 2269762794, hand 1, decision 1, seat 1; Val {'type': 'order-up', 'alone': False} gives net -2, strong-conservative {'type': 'pass'} gives net 1.

Conditional-cost example: seed 3389964757, hand 1, decision 7, seat 3; Val {'type': 'play', 'card': 'spades:Q'} gives net -1, strong-assertive {'type': 'play', 'card': 'spades:J'} gives net 2.

All five candidates overtook a winning partner in 3 of 64 selected positions, led trump in 22 of 64 lead choices, returned a previously partner-led team-won suit in 13 of 60 selected return opportunities, and played trump in 29 of 64 selected trump-conservation positions. These frequencies describe decisions; they are not mistake rates.

These are actual conditional differences, not an optimal-play oracle. One actual deal cannot establish which action is best across unseen deals compatible with the player’s information. Heuristic disagreement alone is not called a mistake. Leads, returns, conserving trump and overtaking partners are measured explicitly in tactical-summary.json.

Symmetry, validation and limitations

casual-balanced: rotated all-same-policy right-minus-left voluntary rate +0.00; 95% interval [+0.00, +0.00]; 32 independent blocks percentage points.

casual-cautious: rotated all-same-policy right-minus-left voluntary rate +0.00; 95% interval [+0.00, +0.00]; 32 independent blocks percentage points.

casual-bold: rotated all-same-policy right-minus-left voluntary rate +0.00; 95% interval [+0.00, +0.00]; 32 independent blocks percentage points.

strong-balanced: rotated all-same-policy right-minus-left voluntary rate +0.00; 95% interval [+0.00, +0.00]; 32 independent blocks percentage points.

strong-conservative: rotated all-same-policy right-minus-left voluntary rate +0.00; 95% interval [+0.00, +0.00]; 32 independent blocks percentage points.

strong-assertive: rotated all-same-policy right-minus-left voluntary rate +0.00; 95% interval [+0.00, +0.00]; 32 independent blocks percentage points.

strong-partnership: rotated all-same-policy right-minus-left voluntary rate +0.00; 95% interval [+0.00, +0.00]; 32 independent blocks percentage points.

expert-balanced: rotated all-same-policy right-minus-left voluntary rate +0.34; 95% interval [-0.10, +0.80]; 32 independent blocks percentage points.

expert-conservative: rotated all-same-policy right-minus-left voluntary rate +0.17; 95% interval [-0.46, +0.70]; 32 independent blocks percentage points.

expert-assertive: rotated all-same-policy right-minus-left voluntary rate +0.31; 95% interval [-0.16, +0.82]; 32 independent blocks percentage points.

val: rotated all-same-policy right-minus-left voluntary rate +0.00; 95% interval [+0.00, +0.00]; 32 independent blocks percentage points.

The symmetry control uses four clockwise rotations with matched dealer rotation. No rule direction is reversed. Expert’s deterministic sampling depends on the permitted-view representation, so rotated action traces can differ; matching initial deals is verified independently.

Independent checks cover bidding order, four passes before turn-down, forbidden second-round suit, forced dealer calls, pickup/discard, ownership, effective follow-suit and bowers, every trick winner including the final trick, next leader, loner sit-out, card conservation, score increments, next dealer, termination, deterministic replay and the permitted-view boundary. Existing hidden-state noninterference tests remain in the baseline suite. No invariant failure was excluded from the schedule.

Audit-only defects corrected during development/recovery: the original tactical continuation cap of 25 was too short for a valid remaining bid/discard/play path; it is 29. The reconstructed return selector initially demanded that the immediately preceding trick was won by the current leader’s partner, which cannot be the current leader; it was replaced with the explicit historical team-won criterion above. Undefined/sparse-event bootstrap cases are handled without invented certainty. No engine or policy change followed these harness corrections.

Baseline npm ci --ignore-scripts, npm run check (131 tests), npm run build and git diff --check passed. The final validation logs record the rerun of those required commands and the completed suite. All 136 automated tests passed with zero failures. Seven statistical checks verify denominators, forced losses, loner distinctions, matched ratios, repeated observations, fixed-context weights and zero-event uncertainty. Expensive simulations remain on demand.

Limits: Expert seat effects and individual matchups remain imprecise. Policy-wide summaries mix the declared lineups. Loner attempts can be sparse. Runtime is specific to this Linux/Node environment, not iPhone latency. No optimal-play oracle, automatic learning, human-strength inference or VoiceOver acceptance is claimed.

Reproduction and files

The repository keeps the reusable Node audit harness, regression tests, final report, compact result summaries and selected fixtures. A fresh battery can be generated in a separate output directory with `npm run audit:validation -- --mode manifest --output PATH`, then executed with `npm run audit:validation -- --mode run --workers 4 --output PATH`. The historical 41,024-game raw evidence is intentionally not duplicated in the working tree; the owner’s verified full repair ZIP contains all 336 detailed chunks, the original manifest, analysis sources, recovery logs and hashes. See `reports/bot-validation/ARCHIVE_RECORD.md`.
