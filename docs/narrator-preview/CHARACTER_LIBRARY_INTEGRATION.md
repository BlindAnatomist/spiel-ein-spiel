# Character library integration checkpoint

October 3, 2026. This source checkpoint includes 168 approved contextual scripts in
seven batches of 24. Runtime metadata currently includes 144 new recordings, for
2,109 total recording references. The target is 2,133 runtime recordings.
The incomplete catalog remains publication-blocked.

## Implemented behavior

- Twenty-seven context predicates read accepted, publicly revealed game events.
  Bowers use effective suit; result comments require newly confirmed results.
- One optional remark can be selected per event, with a maximum of four per hand,
  at least one completed trick and six public events between remarks.
- Exact wording is excluded within the same and two preceding completed games.
  Four-hand/80-event exact and four-trick/12-event family cooldowns also apply.
- Bounded exposure history is separate from game randomness. Abandoned games do
  not advance the completed-game clock. Eligible final-game payoffs have priority
  without bypassing cooldowns or factual narration.
- The importer validates approved text, trigger, family, delivery instructions,
  audio integrity and mechanical QA. It rejects missing or altered prior entries.
- Strict narrator-preview builds reject incomplete recording catalogs.

The original 1,965 recording references and game rules are unchanged. Audio is
excluded from this repository checkpoint. Approved script contracts are under
checkpoints/20261002-character-library/approved-scripts.

## Verification and remaining work

Strict typecheck and 240 tests passed. Coverage includes 9,600 card/lead/trump
contexts, hidden-hand mutation checks, trigger/result boundaries, importer
corruption and content drift, and final-game selection precedence/fallback.
Independent review exercised 8,209 accepted actions and all 27 predicates.

The 72-line imported pool averaged 2.39 remarks per hand in simulation. A separate
feasibility experiment using all 168 approved scripts with synthetic metadata for
unfinished recordings projected 3.15–3.17 remarks per hand and 92–93% of hands with
three or four remarks. Distinctness among the first 350 remarks was 44–45%, below
the earlier 50% projection. These simulations do not establish audio acceptance.

Remaining work: finish the recording catalog;
integrate verified batches; rerun aggregate tests, actual-catalog cadence/novelty
audits, strict build and audio integrity checks; complete independent final review.
This is work in progress, not release approval or a deployment.

## Reviewed browser-evidence imports

The importer retains the first three previously imported packs only when the
approved proposal, manifest and final QA have their exact preserved SHA-256
identities. Every new or changed pack must include the pinned private evidence
validators and complete final QA. Those private validators and receipts are not
copied into this source repository.

The local adapter needs Python 3, NumPy, FFmpeg and FFprobe. It starts Python in
isolated, no-bytecode mode and executes only the hash-pinned validator bytes;
it never adds an input pack to Python's import path. A fresh mechanical audio
audit and read-only evidence check must pass, with the explicit approved proposal
matching the audited proposal exactly. Saved QA must agree with that fresh audit.

Historical HTTP and visible-browser evidence remain distinct. Browser evidence
does not invent HTTP status or provider request totals. Approved replacements
retain their original history. Validation requires exact prompt/settings/source,
active-result binding where applicable, raw/export byte identity, strict receipt
schemas, hashes, decoding, gain-only consistency and peak limits. It cannot
certify listening, spoken wording, pronunciation, likeness or device behavior.

Cross-pack raw/master hashes and browser blob identities must be unique. Every
input is validated before writes; new files use the validated in-memory bytes and
exclusive creation, while matching existing audio files are left untouched.
The 168-addition strict preview build guard is unchanged. The local 144-addition
catalog is preparation only, not a release or deployment.
