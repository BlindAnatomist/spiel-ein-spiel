# Complete Euchre bot validation evidence

All 336 scheduled batches / 41,024 complete games are required. `summary.json` and
`recovery-verification.json` establish completion and reconciliation with the
surviving original analysis. Read `../../docs/audits/bot-validation/REPORT.md`.

The 82 originally recovered detailed chunks remain byte-for-byte unchanged.
The 254 reconstructed chunks are committed in `reconstructed-results.zip` to
keep publication compact. The downloadable result ZIP contains all 336 chunks
individually. The compact pack contains only relative `detailed/*.json.gz` paths.

From the repository root:

```sh
npm ci --ignore-scripts
python3 scripts/restore-bot-validation.py
npm run check
npm run build
git diff --check
npm run audit:validation -- --mode run --workers 4
python3 scripts/analyze-bot-validation.py
python3 scripts/test-bot-validation-analysis.py
python3 scripts/report-bot-validation.py
```

A run validates existing chunks and executes only missing batches. To deliberately
repeat the entire fixed schedule, use a separate output directory, first writing
its manifest with `--mode manifest --output PATH`, then running with `--output PATH`.
Never overwrite complete evidence to change a result. No simulations run on push
or deploy, and none import browser/ledger collection code.

`manifest.json`: source SHA, fixed allocation, seeds, case assignments and settings.
`summary.json`: recomputed comparisons, denominators, block uncertainty and costs.
`COMPARISONS.txt`: readable primary and exploratory comparisons.
`DEALER_AND_LONERS.txt`: explicit-denominator dealer/forced/loner appendix.
`*-position.json.gz`, `profile*.json.gz`, `forced-suit.json.gz`,
`lineup-context.json.gz`, `controlled-hand-outcomes.json.gz`: context counts/rates.
`fixtures.json.gz`, `tactical-summary.json`: complete targeted observations.
`regressions/tactical-bound.json`: reproducible audit-bound regression, not a live defect.
`provenance.json`, `logs/`, `run-wave*.json`, `SHA256SUMS`: commands, versions, checks and costs.

`analysis-final.json`, `REPORT_PRE_RESET.md` (in docs), and files labeled PRE_RESET
are historical artifacts. They are not substitutes for the reconstructed raw
results. `recovery-inventory.json` documents the earlier loss; its lost-file flags
refer to that historical checkpoint, not current completion. `RECOVERY.md` explains
what was repaired. Undefined rates are null. Descriptive profile aggregates are
not independent trials or human skill measurements.
