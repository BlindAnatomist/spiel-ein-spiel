Bot validation evidence

Read ../../docs/audits/bot-validation/REPORT.md for findings and limitations, and ../../docs/audits/bot-validation/EXPERIMENT.md for the fixed design.

manifest.json: complete predeclared cases, strategies, independent seed streams, block ranges and sample counts.
provenance.json: source commit, harness version and source hashes, required checks, commands and supplemental counts.
summary.json: all estimates and uncertainty, including primary family-wise intervals and sparse-sample flags.
detailed/*.json.gz: 336 completed chunks containing all 41,024 scheduled games. No human performance records are included.
COMPARISONS.txt: readable controlled comparisons and exploratory subgroups.
DEALER_AND_LONERS.txt: readable profile, dealer, round, forced-suit and loner results, with denominators.
dealer-position.json.gz, profile-seat.json.gz, forced-suit.json.gz, lineup-context.json.gz: recomputable context summaries.
fixtures.json.gz: 128 targeted loner hands and 272 shared-view tactical comparisons from 32 additional complete games.
tactical-summary.json: fixed-continuation diagnostics and specific differing actions.
benchmark.json: audited Strong/Expert timing with unmodified policies.
run.log: start, completion and zero-failure progress records.
final-check.log, final-install.log, final-build.log: required verification evidence.
fixtures-development-bound-error.log: retained development error in the audit-only tactical rollout bound, corrected before the completed fixture run.
SHA256SUMS: checksums of evidence, documentation and harness sources.

Large runs are on demand. To resume incomplete chunks use:
node src/audit/validation-cli.ts --mode run --workers 4

To recompute analysis from the saved games without replaying them:
python3 scripts/analyze-bot-validation.py
python3 scripts/report-bot-validation.py

To run the inexpensive statistics arithmetic checks:
python3 scripts/analyze-bot-validation.py --self-test

The full experiment is complete; no categories or chunks remain pending. No live policy or game-rule changes are proposed in this commit. No merge is authorized by this audit.
