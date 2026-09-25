Evidence recovery: INCOMPLETE DELIVERY

All 41,024 scheduled games ran, followed by final analysis. The execution service reset during publication and erased the local checkout. The unpublished local commit was 977836840c657fcb338e5c6808a0254abc8e6e87. Its complete tree is not available remotely.

92 original file blobs survived through GitHub. They include both report documents, readable statistical appendices, primary machine-readable estimates, benchmark data, dealer-position data, an expected checksum inventory, and 82 of 336 detailed simulation chunks. The modified package.json was uploaded but is intentionally not installed in the recovery branch because it would advertise a lost harness command. Production files and the baseline package scripts remain unchanged.

277 original files were not transferred. Missing items include 254 detailed chunks, the new audit harness and regression tests, the full executable manifest, full summary.json, targeted tactical/loner fixture records and validation logs. The whole battery's per-game statistics cannot be independently recomputed from this partial dataset. Completion and audit acceptance are therefore blocked by evidence loss, although no live defect was confirmed in the executed checks.

No simulations were rerun. No main/PR #7 change, merge, live tuning, browser change or ledger submission occurred.

Read recovery-inventory.json for every expected file hash and the exact seed-generation scheme and original command list. Those run/analysis commands require the missing harness and manifest and must not be presented as currently executable. Restoring a service snapshot would preserve completed work; absent such a snapshot, regenerating missing results would repeat simulations and requires a change to the user's no-repeat instruction.

The available package can be retrieved without running any tests:
git clone --single-branch --branch feat/euchre-performance-opponent-audit https://github.com/BlindAnatomist/spiel-ein-spiel.git

REPORT.md is the current report with recovery qualifications. REPORT_PRE_RESET.md and README_PRE_RESET.md are historical pre-reset artifacts. SHA256SUMS describes the original full set and intentionally lists missing files; use recovery-inventory.json to determine availability.
