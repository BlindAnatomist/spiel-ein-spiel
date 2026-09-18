# Euchre engine: first implementation checkpoint

Dedicated branch: `feat/euchre-engine-checkpoint-1`.
Base main commit: `f6f921bdf55305ca0520c5b874124bd732c3d482`.
The pull request records the exact implementation commit SHA. Retrieve the checked
out revision with `git rev-parse HEAD`; do not treat the base SHA as this checkpoint.
No merge or deployment is part of this checkpoint.

## Implemented scope

A small TypeScript rules engine with no runtime dependencies implements four
clockwise seats (0 human, 1 opponent, 2 Val, 3 opponent), teams 0/2 and 1/3,
the 24-card deck, five-card hands, four-card kitty, both bidding rounds,
stick-the-dealer, dealer pickup/discard, effective-suit following, bowers,
three-player maker loners, trick winners, standard scoring, and termination at
10 or more. No architecture contradiction required changing the foundation.

No UI, Sites integration, strategic bots, adaptation, training, LLM opponents,
or multiplayer has been added. Test drivers select legal actions only to exercise
the engine; they are not baseline playing strategies.

## Modules

- `src/types.ts`: action union, player views, seat-bound capabilities, policy type.
- `src/cards.ts`: deck, printed/effective suits, rank, seat/team arithmetic.
- `src/internal/state.ts`: authoritative state, intentionally separate from views.
- `src/internal/deal.ts`: deterministic generator, shuffle, deal and initial state.
- `src/internal/legal.ts`: legal choices and runtime input validation.
- `src/internal/bidding.ts`: bidding and start-of-play transitions.
- `src/internal/tricks.ts`: mandatory follow-suit and trick resolution.
- `src/internal/scoring.ts`: points and recipient team.
- `src/internal/reducer.ts`: validated transitions and explicit host redeal.
- `src/internal/view.ts`: allowlisted, detached, deeply frozen player views.
- `src/referee.ts`: privileged closure owning state and issuing player ports.
- `src/index.ts`: player-safe exports; no referee factory or state accessor.

## API and trust boundary

The trusted host imports `@spiel-ein-spiel/euchre/referee`:

```ts
import { createReferee } from '@spiel-ein-spiel/euchre/referee';
import type { DecisionPolicy } from '@spiel-ein-spiel/euchre';

const referee = createReferee({ seed: 42 }); // default dealer 0
const val = referee.player(2);              // give Val only this capability
// A future policy has this signature; no policy is implemented yet.
function takeTurn(policy: DecisionPolicy) {
  const view = val.view();
  if (view.legalActions.length) return val.act(policy(view));
}
```

A `PlayerPort` has only `view()` and `act(action)`. Neither accepts a seat selector.
The seat is captured in a closure and all legal-action checks run against that
seat. `act` returns `{ok: true, view}` or `{ok: false, error: 'illegal-action', view}`.
Invalid action errors never quote private state. Runtime action validation accepts
only the exact fields of a currently legal action; caller objects are never stored.
Bidding actions require explicit `alone: false` or `alone: true`.

The public root exports card utilities and player types only. Internal package
subpaths are blocked by the package export map. The separately named `/referee`
entry is privileged: its `snapshot()` returns a detached, deeply frozen diagnostic
copy containing hidden data, and `player(seat)` can issue any seat's capability.
Do not give policies the referee, snapshot, seed, another seat's port, or private
replay records. A policy needs only its `PlayerView` or its seat-bound port.

This is an enforced application API/capability boundary, not a sandbox against
hostile code with debugger, filesystem, arbitrary module loading, or host-process
access. The generator is not cryptographic and must not be used as a multiplayer
secrecy mechanism. Package exports alone are not a JavaScript security sandbox.

Views are constructed by an explicit allowlist, never by spreading referee state.
They contain no hidden hands, kitty, random state, or discard log. Their cards,
bids, tricks, score and legal actions share no mutable references with the engine.
Unknown future state fields therefore remain private by default.

The public upcard identity remains in `upCard` as historical public knowledge,
with `upCardStatus` equal to `face-up`, `ordered`, or `turned-down`. An ordered
upcard can be in the dealer's hand or have been discarded; the view does not reveal
which. This public identity is the deliberate exception to tests rejecting other
players' unplayed card identities. No originally private discard is exposed.

## Hand lifecycle and later interface

Round one starts clockwise from the dealer. Four passes begin round two at the
same seat. After three round-two passes the dealer has six calls (three suits,
with/without a loner) and no pass. Calling the turned-down suit is illegal.

Ordering up transfers the upcard from kitty to dealer (six cards, three-card
kitty). The dealer discards any of those six, including the upcard if desired,
restoring five cards and four in kitty. A dealer sitting out for their partner's
loner still completes this required discard. First lead is clockwise from dealer,
skipping the sitting-out partner. Each subsequent turn also skips that partner.

The fifth trick awards points exactly once. `hand-over` has `turn: null` and no
player actions. The host calls `referee.nextHand()` to rotate dealer and deal;
this explicit pause preserves the completed hand for later presentation.
`game-over` is terminal and rejects redeals. `winner` is a team number, not a seat.
Completed tricks and void knowledge are per-hand; scores persist between hands.

A view always retains its seat's entire remaining hand in stable deal order,
including a loner's sitting-out partner. Only a played/discarded card is removed.
`legalActions` separately identifies playable cards, discard choices, or bidding
choices. Off-turn and sitting-out seats have no actions (except the required
dealer discard). A future UI can find the first legal card without filtering or
reordering the hand. No VoiceOver focus or speech behavior has been implemented.

## Determinism contract, version one

Seeds are unsigned 32-bit integers, including zero. The initial dealer defaults
to seat 0; an explicit dealer 0–3 is supported and is part of the initial options.
Identical initial options and actions, including host `nextHand` calls, reproduce
the entire authoritative state. Preserve private actions such as discards only
in trusted host replay data; no automatic replay log is exposed to players.

The stable deck order is clubs, diamonds, hearts, spades, each in order
9, 10, J, Q, K, A. Fisher–Yates shuffles indices 23 down through 1. The generator
uses `x = (1664525*x + 1013904223) mod 2^32`. Bounded draws divide the 32-bit range
into equal integer buckets, rejecting the incomplete final bucket and using the
bucket index (not weak low-order LCG bits) for selection. Cards are then dealt
one at a time clockwise from the dealer's left, five rounds, followed by kitty.

Only dealing consumes random state. Validation, bidding, discarding, trick play,
view reads and scoring do not. No clock or `Math.random` is used. The seed-42
regression pins the full first deal and final random state. Altering this algorithm
or deck order later requires an explicit reproducibility-version decision.

## Tests and completed review

Local verification: Node 24.19.0, TypeScript 5.9.3. `npm run check` passes strict
type checking and all 43 regression tests, with zero failures or skipped tests.
The GitHub workflow runs the same command after `npm ci --ignore-scripts`.
Remote workflow completion is separate from the recorded local result.

Coverage of the requested minimum:

1. Deck composition and uniqueness: `rules.test.ts`.
2. Seeded deals and complete-state replay: `rules.test.ts`, `determinism.test.ts`.
3. Dealer rotation including wraparound: `rules.test.ts`.
4. Round-one bidding at every seat: `rules.test.ts`.
5. Round-two suit selection and exact bid history: `rules.test.ts`.
6. Turned-down suit exclusion: `rules.test.ts`.
7. Stick-the-dealer, including attempted illegal pass: `rules.test.ts`.
8. Pickup/discard, all six choices and card conservation: `rules.test.ts`.
9. Right-bower ranking in every trump suit: `rules.test.ts`.
10. Left-bower ranking in every trump suit: `rules.test.ts`.
11. Effective suit for every card under every trump: `rules.test.ts`.
12. Left-bower follow rules, printed-suit void, left-bower lead: `rules.test.ts`.
13. Ordinary mandatory following: `rules.test.ts`.
14. Off-suit legality when void: `rules.test.ts`.
15. Winners, play attribution, next leader: `rules.test.ts`.
16. Maker 3/4 scoring: pure scoring plus final-trick integration in `rules.test.ts`.
17. March scoring: same unit and integration coverage.
18. Loner march scoring: same unit and integration coverage.
19. Euchre scoring: same unit and integration coverage, including loners.
20. Exact-10/overshoot termination: `rules.test.ts`, `determinism.test.ts`.
21. Own-hand presence through every phase: `boundary.test.ts`.
22. Other private cards/kitty exclusion through every phase: `boundary.test.ts`.
23. Seat-bound API, blocked internal imports, no state accessors, mutation safety,
    runtime probes and compile-time policy restrictions: `boundary.test.ts`,
    `type-contract.ts` (compile-only).

Additional tests cover 32 dealer/caller/round loner combinations, hidden-state
noninterference, private discard equivalence, effective-suit void knowledge,
malformed inputs, reentry, stable full-hand presentation, and 24 complete seeded
games replayed in pairs with full-state equality and 24-card conservation checked
after every action/redeal.

Separate review passes performed by the implementing agent (not a second agent):

- Hidden information: traced all return paths from the player port. Checked views,
  successful/rejected results, nested aliases, bids, discard handling, upcard
  history and random state. No hidden state is returned through player ports.
- Left bower: verified both color pairs, trump and printed-suit following, a left
  lead, ranking, and public void derivation independently of bidding logic.
- Determinism: audited all entropy and time references, integer arithmetic, seed
  validation, action copying and redeal state. An independent Python integer
  calculation confirmed the seed-42 generator state and kitty vector. Full-game
  replay and pinned-deal tests protect this contract in the repository.
- Reference complexity: no Parlour source or platform machinery was incorporated.
  Source provenance is recorded in `REFERENCE_RESEARCH.md`; no copied-code MIT
  attribution is required for this independent implementation.

## Unresolved items and continuation

No known rule defects remain from these reviews. Test passing is not a claim of
formal verification. The application boundary assumes trusted host orchestration;
untrusted third-party policy execution would need separate isolation.

Deferred by the assignment: strategic bots, UI/VoiceOver behavior, Sites, hosting,
networking and adaptive learning. There is no browser verification to perform yet.
Next engine consumer should take `PlayerView`/`PlayerPort`, never `State` or a
referee snapshot. Read the foundation, this checkpoint and the PR before changing
rules or the shuffle contract. Re-run `npm run check` after changes. Do not merge
this implementation automatically.
