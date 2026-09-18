# Difficulty evaluation: checkpoint 2

## Final protocol

Configuration was frozen before the final run. Each required comparison uses
800 matched seed pairs, 1,600 complete games, and base seed `2026091805`.
Pair indices are 0–799; the seed mixer is `simulationSeed` in
`src/simulation/index.ts`. Initial dealer is `pairIndex % 4`.
Within each pair, identical seed/dealer options are used for A/B/A/B and then
B/A/B/A. Thus each strategy plays both partnerships on the same sequence of deals.
All 4,800 final comparison games completed; no failures or stalled games were dropped.

The seed set was checked to be unique and disjoint from development base seed
1001 (indices 0–199) and the initial evaluation base seed 2026091802 (indices
0–799). No strategy changes were made after this final run started.

Intervals below are approximate 95% normal intervals over 800 seed-pair shares
(0, 0.5 or 1), using sample variance divided by the number of pairs. They account
for dependence within a pair. They are not multiplicity-adjusted or evidence of
universal dominance over every opponent. Raw pair shares and action digests are
in the JSON files. Top-level A/B metrics refer to strategy teams; nested summary
metrics refer to physical seats/teams after alternating assignments.

## Final observed results

### Strong versus Casual

Strong won 1142 of 1600 games: 71.375%.
Paired 95% interval: 69.45%–73.30%.
Average final scores: Strong 9.259; Casual 6.686.
Average hands per game: 11.156 (17849 total hands).
Euchres: 2899 (16.24% of hands).
Marches, including loners: 3956 (22.16% of hands).
Loner attempts: 558; five-trick successes: 404 (72.40%).
Round-one calls: 8887; round-two calls: 8962.
Machine-readable result: `strong-v-casual.json`.

### Expert versus Casual

Expert won 1286 of 1600 games: 80.375%.
Paired 95% interval: 78.67%–82.08%.
Average final scores: Expert 9.560; Casual 6.027.
Average hands per game: 11.006 (17609 total hands).
Euchres: 2575 (14.62% of hands).
Marches, including loners: 3997 (22.70% of hands).
Loner attempts: 516; five-trick successes: 379 (73.45%).
Round-one calls: 10521; round-two calls: 7088.
Machine-readable result: `expert-v-casual.json`.

### Expert versus Strong

Expert won 1011 of 1600 games: 63.188%.
Paired 95% interval: 61.38%–64.99%.
Average final scores: Expert 8.699; Strong 7.325.
Average hands per game: 11.251 (18001 total hands).
Euchres: 2152 (11.95% of hands).
Marches, including loners: 4287 (23.82% of hands).
Loner attempts: 872; five-trick successes: 599 (68.69%).
Round-one calls: 9765; round-two calls: 8236.
Machine-readable result: `expert-v-strong.json`.

All three final lower confidence bounds exceed 50%. The results support genuine
playing-strength separation for these versions and matchups. Expert's gain combines
more assertive bidding with constrained endgame search; this report does not
attribute the entire gain to search alone.

## Additional checks

Val versus Casual: 200 pairs / 400 games, base seed `2026091803`. Val won 281
games (70.25%; paired 95% interval 66.31%–74.19%). See `val-v-casual.json`.
Val and Casual did not change between that check and final evaluation.

Same-policy control: Strong versus Strong, 100 pairs / 200 games, base seed
`2026091804`. Physical team 0 won 106 games (53%); team 1 won 94 (47%).
The A/B share is exactly 50% by construction when identical policies exchange
labels on replayed seeds; it checks pairing/label accounting, not superiority.
See `symmetry-control.json`.

## Development disclosure and rejected prototype

Development used base seed 1001. Casual initially had thresholds mismatched to
its simpler valuation scale, making it excessively passive; those thresholds
were corrected before the initial large evaluation. Strong and Casual were then
fixed throughout both large evaluations.

The initial Expert used 20 sampled worlds, heuristic early rollouts, and exact
search only at two cards per active hand, with Strong's bidding thresholds.
On the initial 1,600-game evaluation per matchup (base seed 2026091802), Expert
won 69.19% versus Casual and only 51.63% versus Strong. The latter interval was
50.03%–53.22%, too marginal to claim a convincing Expert tier. Those reports
are retained under `initial-expert/`, together with the original timing/source
checksums. They describe the rejected prototype, not the final code.

The intermediate development version restricted search to the last three tricks
and searched those tricks completely. With Strong bidding it won 53% over 200
development games. The final version uses 24 samples, exact three-card endgames,
and order/call thresholds 2.65/2.55 instead of 3.0/2.85. It won 61% over 400
development games before configuration was frozen. See
`initial-expert/endgame-only-development.json` and `final-development.json`.
These development results guided implementation and are not held-out evidence.

## Cost and limitations

The final timing run covered 30 mixed-policy games, base seed 1002,
under v24.19.0 on linux/x64. Expert had 1510 play decisions:
mean 1.102 ms, p95 7.272 ms, maximum observed 26.399 ms.
This includes forced and early-heuristic decisions; it is not the cost of every
possible worst-case search. The run shared compute resources with evaluation.
Browser/iPhone latency remains unmeasured. Timing is nondeterministic host
instrumentation and never enters the policy or the win-rate reports.

Expert samples hypotheses rather than the real hidden deal. The sampler is not
a uniform Bayesian posterior and does not infer probabilistic strength from bids.
Perfect-information continuation within each hypothetical world can create
strategy-fusion/clairvoyance bias. More samples do not eliminate that conceptual
limitation. Strong/Val also make heuristic tactical approximations. These results
measure these fixed bot opponents, not expert-human equivalence.

## Reproduction

```sh
npm ci --ignore-scripts
npm run check
npm run evaluate -- --a strong --b casual --pairs 800 --seed 2026091805
npm run evaluate -- --a expert --b casual --pairs 800 --seed 2026091805
npm run evaluate -- --a expert --b strong --pairs 800 --seed 2026091805
npm run evaluate -- --a val --b casual --pairs 200 --seed 2026091803
npm run evaluate -- --a strong --b strong --pairs 100 --seed 2026091804
npm run benchmark -- --games 30 --seed 1002
sha256sum -c docs/evaluation/source-sha256.txt
```

The final source checksum manifest covers all bot modules, the pure rule facade
and simulation core. Node entry points emit JSON to stdout. The exact implementation
commit and authoritative base are recorded in the PR; the existing engine remains
at the accepted Checkpoint 1 implementation. Re-run this protocol after future
bot changes instead of preserving labels by assertion.
