# Euchre bot validation record

This directory keeps the compact permanent record of the completed PR #8 bot-validation battery.

The completed battery covered 41,024 games, 462,717 hands, 11,640,424 decisions and 2,688 independent matched seed blocks. The final report is in `../../docs/audits/bot-validation/REPORT.md`.

The full raw repair package is intentionally not duplicated in the working repository. The owner retained the complete verified ZIP containing all 336 detailed batches, the original fixed manifest, analysis/recovery scripts, historical checkpoint files, logs and hashes. Its identity and SHA-256 are recorded in `ARCHIVE_RECORD.md`.

Permanent repository evidence includes:

- `summary.json`: final comparisons, denominators and uncertainty.
- `analysis-final.json`: compact surviving original-analysis reference used in recovery verification.
- `recovery-verification.json`: reconciliation of category totals and all 26 primary point estimates.
- `COMPARISONS.txt`: readable controlled comparisons.
- `DEALER_AND_LONERS.txt`: dealer, forced-call and loner appendix.
- `profile.json.gz`, `profile-seat.json.gz`, `dealer-position.json.gz`, `forced-suit.json.gz`, and `controlled-hand-outcomes.json.gz`: compact result tables.
- `fixtures.json.gz` and `tactical-summary.json`: targeted Val/tactical evidence.
- `regressions/tactical-bound.json`: reproducible audit-harness bound regression.
- `policy-config.json`, `provenance.json`, and `benchmark-reconstruction.json`: configuration, source identity and runtime provenance.

The reusable audit harness remains under `src/audit/`. Expensive simulations are on demand and are not attached to push or deployment.

To start a new fixed battery without modifying this permanent record:

```sh
npm run audit:validation -- --mode manifest --output reports/bot-validation-run
npm run audit:validation -- --mode run --workers 4 --output reports/bot-validation-run
```

The generated `reports/bot-validation-run/` directory is ignored by Git.
