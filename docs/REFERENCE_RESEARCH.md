# Reference Research

## Parlour

Repository:
https://github.com/braedonsaunders/parlour

License:
MIT.

Relevant package:
`packages/game-euchre`

Observed architecture and patterns worth considering:

1. Pure deterministic TypeScript engine separated from the UI.
2. Seed plus event history used as a reproducibility model.
3. Per-seat `playerView` boundary rather than giving bots the full state.
4. Euchre implemented as a distinct game package.
5. Explicit `effectiveSuit` treatment for the left bower.
6. Separate state, deck/ranking, rules, scoring, bot bidding, bot play, evaluation, simulation, and tests.
7. Stick-the-dealer represented as an explicit rule and enforced by legal-move validation.
8. Bot play receives a player-specific view through the solo runtime.
9. Headless simulation is used to compare bot difficulty over large numbers of games.
10. Dedicated tests cover Euchre rules and hidden-card/veil behavior.

Particularly relevant files inspected:

- `packages/game-euchre/src/state.ts`
- `packages/game-euchre/src/deck.ts`
- `packages/game-euchre/src/config.ts`
- `packages/game-euchre/src/rules.ts`
- `packages/game-euchre/src/index.test.ts`
- `packages/game-euchre/src/veil.test.ts`
- `packages/game-euchre/src/bots/`
- `apps/web/src/lib/solo/EuchreTransport.ts`

## What we should adopt as architecture

These ideas are general architectural patterns and should be part of our implementation whether or not code is reused:

- authoritative referee state;
- restricted per-seat player views;
- deterministic seeded deals;
- rules engine independent of presentation;
- effective-suit abstraction for the left bower;
- automated legal-move enforcement;
- bot strategy separated from rule legality;
- headless simulation for difficulty evaluation;
- regression tests for hidden-information boundaries.

## What we should not copy automatically

Do not import Parlour wholesale.

Our product goals differ:

- VoiceOver behavior is a primary interaction contract;
- the full human hand must remain reviewable even when some cards are not playable;
- focus transitions need explicit testing;
- table speech must avoid duplicate announcements;
- the first target is a compact GPT Sites game rather than a nineteen-game browser platform;
- multiplayer cryptographic veiling is unnecessary for the initial local human-plus-bots game.

Before copying any source file or substantial implementation fragment, record:

1. the exact source path;
2. why reuse is preferable to an independent implementation;
3. the applicable MIT attribution;
4. what was modified for this project.

## Other references identified

Potential later references include:

- Euchre Coach: useful for played-card memory and void/inference ideas.
- Other Euchre bot experiments: useful for Monte Carlo, minimax, or strategy-evaluation concepts.

These have not yet been adopted into the implementation.

## Current conclusion

Use Parlour as a technical reference and possible MIT-licensed donor for narrowly selected rule-engine pieces, not as the base application.

The first implementation should remain small enough that we understand every rule boundary, every hidden-information boundary, and every VoiceOver transition.

## Checkpoint 1 implementation provenance

Reference inspected at Parlour commit
`a5f64d92dcfb87790b9707e563e6e7ffa5076d8a`:

- `packages/game-euchre/src/state.ts`
- `packages/game-euchre/src/deck.ts`
- `packages/game-euchre/src/rules.ts`
- `packages/game-euchre/src/score.ts`
- `packages/game-euchre/src/veil.test.ts`
- root `LICENSE` (MIT, Copyright (c) 2026 Braedon Saunders)

No source file or substantial source fragment was copied or adapted into Spiel
ein Spiel. The implementation is independent and uses the architectural ideas
listed above. No Parlour dependency, UI effects, shared platform engine,
cryptographic veiling, bot strategies, or networking were imported. Consequently
there is no incorporated Parlour code requiring an MIT notice in this checkpoint.
Future reuse still requires the four-part record specified above.

## Checkpoint 2 implementation provenance

The same reference revision, `a5f64d92dcfb87790b9707e563e6e7ffa5076d8a`,
was consulted for these additional files:

- `packages/game-euchre/src/bots/bid.ts`
- `packages/game-euchre/src/bots/evaluate.ts`
- `packages/game-euchre/src/bots/play.ts`
- `packages/game-euchre/src/cli/sim.ts`
- `packages/game-euchre/src/sim/gates.ts`

The reference informed separation of bidding/play parameters, public trick
reasoning and seat-balanced measurement. No source files or substantial source
fragments were reused. Our parameters, policy-only PlayerView API, constrained
hypothesis search and matched-pair statistical reports are independent
implementations. No Parlour package or runtime dependency was introduced, and no
incorporated-source MIT attribution is required. The original MIT provenance
and future reuse requirements above still apply.
