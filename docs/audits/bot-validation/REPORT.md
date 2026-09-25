Euchre bot validation and calibration report
Executed September 25, 2026 UTC. All scheduled categories ran; evidence delivery is INCOMPLETE after an execution-workspace reset.

Read reports/bot-validation/RECOVERY.md first. The surviving report and aggregate outputs describe observed completed runs, but only 82 of 336 detailed batches survived publication. The new harness, full manifest, fixture records and remaining raw batches were lost. Missing evidence now blocks completion and full audit acceptance. No simulations were rerun.

1. Findings and acceptance implications

No live engine or policy defect was confirmed. All 41,024 scheduled complete games passed independent rule checks, permitted-view checks and corresponding-deal matching. These games contained 462,717 hands and 11,640,424 decisions. No simulation was sent to the human-performance ledger.

No meaningful right-seat calling advantage was established. This is not proof that a two-percentage-point effect is absent: several confidence intervals remain wider than that margin. An exploratory lower right-seat call-success signal remains in the Strong proxy-swapped comparison. It is documented below rather than dismissed or converted into a live-game change.

The intended Casual < Strong < Expert hierarchy is supported in the pooled controlled experiments. It is not established for every individual profile pairing. Expert retained its production search budget throughout.

Val performed very similarly to Balanced Strong and Partnership Strong in the declared lineup mixture. It outperformed Conservative Strong directionally; its apparent deficit to Assertive Strong was small and did not survive the primary family-wise adjustment. These results do not warrant silently changing Val's parameters.

The run found no demonstrated live defect, but the subsequent loss of required evidence blocks completion of this audit assignment. The exploratory success-rate finding and limits on individual-matchup precision remain open calibration questions. This audit supplies no iPhone VoiceOver acceptance and does not substitute for the owner's acceptance of the existing interface. Nothing was merged.

2. Experiment and evidence integrity

The starting PR #8 head matched 46e4a0c04f9007387bc98ef4aaf1d256f20aec05. Main was b6f647c7d64c58e7b147cb03df729433604d3650. PR #7 was fba6aa22acffb20c27f7f0e2a35a4980d4227082. Neither protected branch was incorporated or modified.

The fixed manifest preceded the large run. Four processes completed 336 batches in approximately 790 seconds of wall time; summed worker elapsed time was approximately 3,143 seconds. The independent sampling units are 2,688 group/seed blocks, not 41,024 independent policy comparisons and certainly not eleven million independent decisions. All alternative assignments within a block remain together in uncertainty calculations. Pooled cross-tier and Val bootstraps preserve the fixed matchup proportions by resampling within each context.

Each matching check uses a SHA256 fingerprint of the actual initial four hands and kitty, normalized only for a declared clockwise rotation. There were 429,260 repeated-hand fingerprint comparisons and zero mismatches. The records include 48,279 hand occurrences beyond their group/block's shortest game. These tails are included in complete-game outcomes. A separate common-prefix analysis retains only hands reached in every corresponding game; because that prefix depends on game endings, it is a sensitivity check rather than a fixed-length independent experiment.

Primary thresholds were two percentage points for voluntary calling, five percentage points for win-rate differences, and half a point for final-score differences. Ordinary 95% intervals below use 1,999 block-bootstrap resamples. Family-wise intervals across the 16 primary comparisons are also preserved in summary.json. Exploratory subgroup intervals are unadjusted. Zero observed rare events do not establish zero risk; a degenerate percentile interval is marked unavailable for that purpose. Sparse eligible samples are flagged.

3. Casual profile and seat audit

Completed: 2,304 games, 26,624 hands, 18 cases, 128 games per case. This covers all three same-profile controls and all six distinct ordered profile pairings, with both proxy/Val assignments.

Right minus left voluntary calling was +0.55 percentage points, 95% interval [-2.01, +3.20], with the original proxy assignment. After exchanging the proxy and Val, it was +0.75 [-1.70, +3.32]. Neither comparison establishes a two-point advantage or rules one out.

Profile variants demonstrably change behavior in the matched original environment. Relative to Balanced Casual, Cautious called voluntarily 6.96 percentage points less often, interval [-7.77, -6.17]; Bold called 8.66 points more often, interval [7.76, 9.55]. These are differences in bidding behavior, not a ranking of playing strength. Both orientations, dealer-role splits and all profile comparisons are retained in COMPARISONS.txt and the context data.

4. Expert profile and seat audit

Completed: 1,152 games, 12,963 hands, 18 cases, 64 games per case. All three same-profile controls, all six distinct orientations and both proxy assignments ran with the actual 24-sample, three-card search settings.

Right minus left voluntary calling was -0.16 percentage points, interval [-4.17, +3.45], with the original assignment, and +0.50 [-3.12, +4.33] after the proxy swap. Expert seat precision is the principal limitation of this category: these intervals cannot resolve a two-point effect.

Conservative Expert called voluntarily 5.49 points less often than Balanced, interval [-6.69, -4.30]; Assertive called 5.59 points more often, interval [4.42, 6.74]. The profiles are behaviorally distinct without substituting a weaker search policy.

The audited benchmark completed eight all-Expert games in 2.33 seconds versus eight all-Strong games in 0.47 seconds. Expert policy execution accounted for approximately 1.98 seconds of its benchmark. These are Linux/Node timings including the audit workload, not iPhone latency predictions. Per-profile decision costs are recorded separately from wins and scores.

5. Cross-tier calibration

Completed: 10,560 games, 118,967 hands, all 33 cross-tier profile pairs. Each pair has 32 matched seed blocks: two same-tier-team assignments and eight common-partner assignments, covering both candidate policies at all four seats. There are 2,112 team-comparison games and 8,448 common-partner games.

Strong versus Casual: Strong teams won 70.70%, interval [68.10%, 73.44%], across 768 games/384 blocks. Their average final-score advantage was 2.59 points [2.35, 2.83]. Changing only the focal player from Casual to Strong improved its team's win rate by 13.80 percentage points [9.90, 17.72] and score differential by 1.43 points [1.13, 1.76].

Expert versus Strong: Expert teams won 58.33%, interval [55.99%, 60.81%], across 768 games/384 blocks. Their score advantage was 1.10 points [0.89, 1.29]. The common-partner improvement was 6.84 percentage points [3.32, 10.48], with a 0.71-point score improvement [0.45, 0.97]. The directional advantage survives the primary family-wise adjustment; the minimum five-point practical margin is not established under every adjusted comparison.

Expert versus Casual: Expert teams won 80.21%, interval [77.26%, 82.99%], across 576 games/288 blocks. Their score advantage was 3.60 points [3.32, 3.85]. The common-partner improvement was 19.44 percentage points [14.58, 24.57], with a 2.01-point score improvement [1.62, 2.41].

No cross-tier team matchup had a point estimate favoring the lower tier; one Expert/Strong pairing tied at 50%. Consequently no cross-tier three-profile cycle appeared in the observed team estimates. This is not proof of global transitivity: within-tier head-to-head team edges were not part of this cross-tier graph, and individual comparisons have only 32 blocks.

Two common-partner point estimates reversed the tier order: Balanced Strong replacing Bold Casual was -6.25 percentage points [-21.88, +6.41]; Conservative Expert replacing Partnership Strong was -1.56 [-7.03, +1.56]. Both intervals span zero. These unresolved reversals are retained as matchup uncertainty, not used to tune the labels.

6. Dealer position and forced calls

Every profile and Val contributed dealer, first-bidder, dealer-partner and third-bidder observations, split by round and voluntary versus forced opportunity. All 462,717 hands contribute to this audit. There were 86,870 forced calls, all in the required second-round dealer context. No prohibited-suit, turn-order or stick-the-dealer failure occurred.

Each rate includes its actual denominator. An opportunity is a bidding decision, so a player may have one opportunity in each round of the same hand. Forced calls are excluded from the voluntary-call denominator. Makes, euchres, trick averages and points are conditional on calls. Undefined rates remain unavailable.

For example, Val made 6,809 of its 9,090 forced calls and was euchred on 2,281. Those calls earned 8,215 gross points, conceded 4,562, and produced 3,653 net points. Gross points alone would conceal the cost of euchres.

DEALER_AND_LONERS.txt lists every profile's dealer/round/forced counts and all four forced-suit selections, including makes, euchres, points earned and points conceded. lineup-context.json.gz preserves partner and both opponent identities separately from absolute seat and dealer relationship. These conditional rates are descriptive unless a controlled comparison and its uncertainty are explicitly given.

7. Loner audit

The scheduled games contained 22,058 natural loner attempts. The evidence separates five-trick four-point successes, three/four-trick one-point makes and euchres for every profile. An ordinary made hand alone is never counted as a successful four-point loner.

Val attempted 2,493 natural loners: 1,664 took five tricks and 829 took three or four; none were euchred in this sample. These are repeated observations within matched games, not 2,493 independent risk trials. Zero observed euchres does not establish that Val cannot be euchred alone.

Cautious Casual had only 12 natural attempts: eight five-trick successes and four ordinary makes. Its loner calibration remains sparse. Attempt frequency alone does not establish timidity, recklessness or quality.

The separate rule supplement completed 128 scripted loner hands: all four dealers, all four callers, both bidding rounds and four fixed seeds. All passed partner sit-out, skipped turns, opening lead, dealer pickup/discard and scoring checks. They produced four loner marches, twelve ordinary makes and 112 euchres. The calls were deliberately forced by the fixture, often on unsuitable hands; those outcomes are not policy-performance evidence. The existing final-trick tests additionally cover every scoring result and both teams.

8. Val-specific comparison and tactical evidence

Completed: 15,360 games, 172,751 hands, 768 independent context/seed blocks. There are three partner tiers, all 16 ordered Strong opponent pairings, five focal policies, four seat rotations and 16 blocks per context. Each focal policy played 3,072 games. The same Val games are reused across four comparisons and must not be counted four times as new evidence.

Val minus Balanced Strong: win-rate difference +0.20 percentage points, interval [-0.85, +1.30]; score difference +0.082 points [0.003, 0.164].

Val minus Conservative Strong: +4.36 percentage points [2.47, 6.28]; score +0.442 [0.309, 0.575]. The direction survives family-wise adjustment, but a minimum five-point improvement is not established.

Val minus Assertive Strong: -2.15 percentage points [-4.23, -0.07]; score -0.232 [-0.384, -0.085]. The family-wise win interval is [-5.26, +0.91], so the apparent deficit is not robust to that adjustment.

Val minus Partnership Strong: -0.29 percentage points [-0.81, +0.26]; score -0.007 [-0.036, +0.020].

For Balanced and Partnership, even the adjusted pooled win intervals lie within the predeclared plus/minus-five-point margin. This supports practical similarity in these tested contexts, not universal interchangeability. Val's Assertive deficit was most pronounced with a Strong partner: -4.30 points [-8.20, -0.78], an exploratory subgroup result. Individual partner/opponent contexts have only 16 blocks and remain sparse.

A separate fixed set of 32 complete tactical games retained 272 permitted views: 64 bidding, 64 lead, 52 partner-return, 64 partner-winning and 64 trump-conservation observations; a view can belong to more than one context. All five candidate policies received the same view. Their chosen actions were followed through fixed production-policy continuations in the host's actual deal.

Val differed from Balanced on two retained views, Conservative on three, Assertive on three and Partnership on one. In the 64 partner-winning positions, all five overtook the partner in the same three cases. Lead and return cases produced no disagreement in this selected sample. This is evidence of actual shared tactical behavior, not proof those choices are optimal.

One preserved example deserves attention: seed 3389964757, hand 1, seat 3. Val played spades:Q where Balanced Strong played spades:J. Under the fixed continuation, Val's team conceded one point while the alternative earned two by euchring the makers. The full permitted view, decision location and both continuations are retained in fixtures.json.gz and tactical-summary.json. The result establishes a conditional cost in that actual deal; it does not establish that spending the jack is better across the unseen deals compatible with the player's information. No live-policy defect is asserted from this example.

9. Independent Strong replication and unresolved seat finding

Completed: 10,240 games, 115,740 hands, 32 cases, 320 games per case. Both fresh 160-block batches contain every same-profile control, all swapped distinct pairings and both proxy assignments. The generated seeds were checked against both original seed streams from the base-20260924 audit; no overlap was found.

Original proxy assignment: right minus left voluntary calling +0.66 percentage points [-0.76, +2.12]. Proxy/Val exchanged: +0.32 [-1.12, +1.79]. Same-profile and distinct-profile estimates were nearly identical. Original-assignment batch estimates were +0.33 and +0.97; neither batch interval excluded zero. Common-prefix sensitivity estimates were +0.54 and +0.23 for the two proxy assignments, consistent with the full-game conclusion.

Thus the earlier suspected right-seat calling advantage is not confirmed. Small descriptive same-profile differences persist, but there is no demonstrated meaningful advantage and the original-assignment interval narrowly extends beyond the two-point margin. The experiment does not prove equivalence at that margin.

Exploratory call-success finding: right minus left was -1.98 percentage points [-4.39, +0.56] with the original assignment and -2.55 [-5.15, -0.14] after the proxy swap. The latter interval excludes zero without multiple-comparison adjustment. The second fresh batch carried the stronger negative signal; the first did not. Exchanging the proxy and Val did not reverse the sign, and dealer-role intervals did not isolate a specific mechanism. Net points per call remained uncertain in the pooled comparisons.

Observed result: a lower success rate in one exploratory aggregate. Statistical interpretation: a follow-up signal among numerous related comparisons. Suspected cause: unresolved; finite-seed variation and lineup/dealer interactions remain possible. Confirmed defect: none. A separately predeclared success-rate replication would be the smallest evidential next step; changing rules, bot thresholds or clockwise order is not justified by these results.

10. Symmetry, checks and limits

The symmetry control completed 1,408 games and 15,672 hands: all eleven policies, each alone in all four seats, with four clockwise rotations and 32 blocks per policy. Casual, Strong and Val rotations gave exactly zero aggregated right-left calling difference. Expert differences were approximately +0.17 to +0.34 percentage points, with all 95% intervals crossing zero. Expert's deterministic sampling depends on its permitted-view representation, which changes under rotation; its rotated action traces need not be identical. The deal matching still passed.

The independent oracle checks legal bidding choices, round transitions, four passes before turn-down, prohibited-suit exclusion, forced calls, pickup/discard, ownership and effective follow-suit including bowers, every trick winner including the fifth, next leader, loner sit-out, card conservation, scoring, dealer rotation and termination. Policy inputs are explicitly allowlisted and use the production PlayerView. The unchanged existing suite also checks dependency boundaries and hidden-state noninterference.

Baseline: npm ci --ignore-scripts, npm run check (131 tests), npm run build and git diff --check passed. Final: the same required commands passed; 135 automated tests passed, with zero failures. Seven statistical/denominator self-checks passed. Large simulations are on demand, not attached to pushes or deployments.

Audit-only corrections included the tactical continuation bound and uncertainty handling for zero observed rare events. An initial report serialization issue was corrected by converting NumPy flags to ordinary JSON scalars. None required changes to the engine or policies. The saved tactical-bound diagnostic is explicitly a development failure in the audit harness.

Limits: controlled bot behavior does not measure the owner's playing strength. Profile-wide totals reflect the planned mix of opponents and repeated matched observations. Natural loners and individual matchups can remain sparse despite a large total game count. Expert sampling has its existing modeling limitations; no optimal-play oracle was introduced. Runtime is specific to this execution environment. Browser, narration, focus and VoiceOver acceptance are outside simulation's reach.

11. Recovery status and reproduction limitation

The original complete local commit was 977836840c657fcb338e5c6808a0254abc8e6e87; it never reached the remote branch. A Git credential failure required connector publication, which transferred 92 blobs before the execution service reset and erased the checkout. This recovery commit anchors surviving evidence only. It does not publish the lost commit.

Surviving files include the experiment-design document, this report, the complete readable comparison and dealer/loner appendices, analysis-final.json with primary estimates and intervals, benchmark.json, dealer-position.json.gz and 82 raw batch files. recovery-inventory.json identifies every original file, its Git hash and whether its blob survived. REPORT_PRE_RESET.md and README_PRE_RESET.md preserve the pre-reset documents as historical snapshots; their statements that the whole package exists are superseded by RECOVERY.md.

The executable manifest, new harness and tests, full summary.json, full lineage summaries, fixture data and validation logs were not transferred. References to these files earlier in this report describe what was produced before reset, not what is available in this recovery package. In particular, the full tactical PlayerViews are missing; their result descriptions survive here.

The original resume commands are recorded in recovery-inventory.json, but are not currently runnable without restoring the missing source and manifest. No source reconstruction or simulation rerun was substituted for the lost tested artifacts. There is no honest command that can recover erased raw results from their hashes alone. The user prohibited repeating finished work, so this package preserves the surviving evidence and identifies the remaining gap instead.
