# Recovery history

The original fixed 41,024-game audit completed locally, but an executor reset
removed unpublished source and 254 raw batches before GitHub publication. The
recovery commit d3b44f0530600952bedbb987f10a18c3189c2456 preserved 82 batches
(7,584 games), the complete original primary aggregate results, dealer counters,
and readable report/appendices. Its report correctly described evidence as incomplete.

The owner subsequently authorized regeneration of the lost portion. The production
referee audit driver was reconstructed and its exact actions/deals/outcomes/digest
checked against a recovered game. The original fixed design was reconstructed,
published, and used without selecting new seeds. The 254 missing batches
(33,440 games) were regenerated in four bounded waves; completed original batches
were retained. Source checkpoints and durable result checkpoints protected recovery.

The current completion status is established by summary.json and
recovery-verification.json: all category game, hand and decision totals and all
26 primary point estimates match the surviving original results. Timing is newly
measured for regenerated batches and should not be described as the original run.
The reconstructed tactical selector has an explicit historical partner-return
criterion; its newly measured sample replaces the lost original targeted sample.

No live engine, policy settings, rules, interface, ledger, main or PR #7 change
was made. The previous partial ZIP is superseded by the completed repair ZIP.
