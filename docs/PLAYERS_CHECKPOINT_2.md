# Euchre players: second implementation checkpoint

Authoritative base: `374895c8e4ffbcd391c08efb9bd5676d7d939c5c`, the main merge
of PR 1. Its tree matches the accepted Checkpoint 1 implementation.
Implementation branch: `feat/euchre-players-checkpoint-2`.
The PR records the exact implementation commit; use `git rev-parse HEAD` to identify
an actual checkout. No automatic merge or deployment is part of this checkpoint.

## Scope and architecture

The existing engine, seeded dealing, state types, player-view derivation, referee
API and original 43 tests are unchanged. New policy modules implement complete
bidding, loner decisions, discarding and trick play. A headless driver and JSON
reports evaluate full matches. No UI, Sites, LLM player, multiplayer, evolutionary
optimization or persistent learning has been added.

- `src/bots/config.ts`: frozen named strategy parameters for four policies.
- `src/bots/evaluate.ts`: effective-suit hand value, public card counts and position.
- `src/bots/heuristic.ts`: bidding, discard and heuristic play evaluation.
- `src/bots/sample.ts`: bounded sampling of hypothetical unobserved cards.
- `src/bots/search.ts`: Expert candidate evaluation in those hypotheses.
- `src/bots/random.ts`: deterministic observation-derived sampling entropy.
- `src/bots/index.ts`: policy factory accepting a level, returning `DecisionPolicy`.
- `src/rules.ts`: a pure re-export facade for existing card, trick and scoring operations.
- `src/simulation/index.ts`: trusted match driver, statistics and paired comparison.
- CLI files under `src/simulation`: batch, comparison and optional timing commands.

No new runtime dependencies. TypeScript and Node's built-in test runner remain
the development tools. Node 24+ executes the TypeScript directly.

## Player API and hidden-information boundary

```ts
import { createBot } from '@spiel-ein-spiel/euchre/bots';
import type { PlayerPort } from '@spiel-ein-spiel/euchre';

const valPolicy = createBot('val');
function valTurn(valPort: PlayerPort) {
  const view = valPort.view();
  if (view.legalActions.length) return valPort.act(valPolicy(view));
}
```

The host creates Val's port for seat 2 through the existing referee. Neither the
policy factory nor the decision function accepts a referee, game seed, snapshot,
private log or another seat's capability. The factory returns a stateless function
whose only decision input is a `PlayerView`. It returns an existing legal action
from that view. When there is no legal action, the host must not request a decision;
the policy throws instead of inventing an action.

Policies use the view's complete own hand, current trick, public history and legal
actions. No hidden hand or private discard is stored between decisions. Val uses
the same interface and the same restrictions as the opponents. It derives its
partner relative to its seat; it can be assigned elsewhere for fair evaluations,
but the intended human table has human 0 and Val 2.

The simulator is trusted orchestration. It owns the referee and four seat ports,
but calls a policy with exactly the acting seat's view. It does not read snapshots,
even for statistics. Public hand results supply scoring metrics. Optional injected
policies have the same single-view signature and are useful for tests or future
human-action replays. Host configuration and evaluation seeds never enter a policy.

Package subpaths separate `/bots` from the privileged `/referee` and `/simulation`.
The unchanged root remains player-safe. An automated TypeScript AST dependency
walk checks every bot module and its transitive imports against an explicit
allowlist; no host/platform or authoritative-state dependency is permitted.
Compile-time tests reject using State as a bot input or passing a deal seed to the
bot factory. Runtime tests check argument count, fields, frozen views, legal
results and invariance under hidden-card permutations.

This preserves the original application capability boundary, not a sandbox for
hostile code with filesystem/debugger/process access. A host must still keep its
referee and simulation objects outside player code.

## Strategy differences

All policies use effective suit, including the left bower, in hand valuation,
discarding, trump counting and play. The engine supplies root legal choices.
Hypothetical continuations reuse the engine's pure follow-suit and winner helpers;
there is no second implementation of those rules.

Casual:

- Simple weighted hand strength and comparatively simple ordering/calling rules.
- Counts bowers correctly, can call alone with an exceptionally strong hand, and
  chooses its best legal suit when stuck with the deal.
- Discards its weakest card; leads a high card; recognizes a winning partner.
- When an opponent is winning, tends to spend its highest winning card rather
  than calculate the cheapest safe winner. No public counting, void inference,
  historical partner-return tactics or search.
- Deliberate limitations in reasoning, not illegal actions or access restrictions
  imposed selectively on stronger players.

Strong:

- Values trump length and short suits, evaluates the actual five-card hand after
  a hypothetical dealer pickup/discard, and accounts for which team gets the upcard.
- Uses publicly played cards to identify potential master cards and unseen trump.
  Unseen trump may be buried or held by a sitting-out partner; it is not claimed to
  be known opponent trump.
- Balances cheap winners against remaining opponents, supports the maker team's
  trump call, avoids drawing trump indiscriminately while defending, and uses
  effective-suit voids to guide leads.
- Recognizes partner leads that won previous tricks, and conserves cards when
  partner's winner is safe. Current score modestly changes bidding pressure and
  suppresses an unnecessary loner at nine points.

Expert:

- Uses Strong discard and early-play reasoning, with lower ordering/calling
  thresholds (2.65/2.55 versus Strong's 3.0/2.85) to capture sound marginal calls.
  Strong provides the legal search fallback and tie-breaker.
- After two completed tricks, for play decisions with multiple legal choices,
  samples 24 possible unseen-card
  distributions. These hypotheses come entirely from the allowed view, never the
  actual deal or a hidden-state oracle.
- Conditions on remaining hand sizes, public played cards, effective-suit voids,
  and upcard history: a turned-down card is buried; an unplayed ordered card can
  be with the dealer or buried, never in an unrelated hand.
- Gives every root action the same hypothetical worlds for a lower-noise comparison.
- Uses partnership minimax with alpha–beta pruning through all remaining play
  once every active hand has at most three cards. Earlier tricks use Strong's
  heuristic instead of speculative rollouts. Search reuses the engine's pure
  scorer, with additional match-completion value, not just raw trick count.
- Keeps computation bounded: 24 samples, at most 48 constrained-assignment retries
  per sample, at most three remaining tricks, and exact branching only at three
  cards per active seat.
  If sampling cannot satisfy a synthetic/inconsistent view, uses the legal heuristic
  fallback. Timing observations are recorded separately from deterministic results.

Val:

- Strong's public-information tactical machinery with more emphasis on returning
  partner's useful suit, exploiting public voids and conserving valuable trump.
- Slightly more willing to order up the partner's deal. No private human-hand access.
- Does not run Expert search in this checkpoint. It is a partnership-oriented
  configuration, not a claim to be stronger than Expert or universally stronger
  than Strong. Focused tests demonstrate a distinct conservation decision at seat 2.

Tunable policy values live in `config.ts`: order/call/loner thresholds, seven trump
weights, ace value, trump length and void bonuses, partner/opponent dealer values,
trump-lead/partner-return preferences, void weighting, trump conservation, sample
count and exact-search hand size. They are code-versioned and immutable at runtime;
there is no training, automatic tuning or cross-match adaptation.

## Determinism and measurement

Policy tie-breaking uses engine legal-action order. Expert's xorshift stream is
seeded with a fixed FNV-style hash of the allowed view's JSON representation. This
is policy-local sampling, not access to the engine seed or RNG. Identical engine
views and configuration give identical actions. View ordering is defined by the
engine; canonicalizing arbitrary third-party JSON object property order is not
part of this checkpoint.

The driver uses the existing seeded referee unchanged. `simulationSeed(base, i)`
mixes `base + imul(i+1, 0x9e3779b9)` with two fixed 32-bit avalanche rounds using
`0x85ebca6b` and `0xc2b2ae35`. The implementation is committed and covered by replay
tests. Match records include seeds, initial dealer, policy labels, public hand
results and an action digest. The digest is a debugging checksum, not a
cryptographic proof or a serialization of private actions.

`runMatch` takes a seed and four-seat lineup; `simulate` takes game count, base
seed and lineup; `compare` takes A/B levels, seed and number of pairs. Initial
dealer rotates through all four seats by match/pair index. Each comparison pair
uses the same seed and dealer for A/B/A/B followed by B/A/B/A.

Complete games are mandatory. Illegal actions or termination-bound failures abort
the run; no failed games are silently excluded from win rates. Summary denominators:

- Team wins/rates and average final scores: completed games.
- Average hands: completed hands divided by games.
- Euchre rate: hands in which makers take fewer than three, divided by all hands.
- March rate: five maker tricks divided by all hands, including loner marches.
- Loner success rate: five-trick loners divided by loner attempts; null if no attempts.
- Calling frequencies: one caller per completed hand, split by seat and bidding round.

Top-level A/B comparison metrics follow the strategy labels. Nested `summary`
metrics use physical table teams/seats; they must not be mistaken for strategy
win counts after swapping. Approximate 95% intervals use independent seed-pair
shares (0, 0.5 or 1) as clusters, with the usual sample-variance standard error.
They are descriptive uncertainty estimates over deals, not a universal skill rating.
Full methodology, development disclosures and observed results are in
`docs/evaluation/RESULTS.md`; raw JSON reports are committed beside it.

## Verification and seven separate critical reviews

Full `npm run check`: strict type checking plus 62 passing tests, including all
43 unchanged Checkpoint 1 tests and 19 new runtime tests. Compile-only contracts
also run under type checking. The existing CI workflow runs the same command.

New coverage includes legal choices and full matches for every level, no privileged
policy dependencies/arguments, hidden-state noninterference, deterministic replay,
discarding, forced calls, all-color bower handling, effective following, all-seat
partnership identity, Strong/Expert public-void effects, hypothesis conservation,
upcard constraints, Val partner-return/conservation, different configurations,
loner decisions and match-score strategy, statistics reconciliation and paired
assignment/interval arithmetic. No test asserts a tier's superiority solely from
its label; strength is measured in the committed simulation reports.

Separate review passes performed by the implementing agent, not an external agent:

1. Hidden information: traced factory, policy inputs, all imports, hypothetical
   generation and simulator dispatch. No real hidden cards, seed, RNG or private
   logs enter decisions. Existing referee/view files remain unchanged.
2. Bowers/effective suit: checked weighted evaluation indices, discard voids,
   public counting, all sample exclusions and search legality. Every relevant suit
   comparison uses effective suit; printed suit is used only to name upcard trump.
3. Partnerships: checked parity and partner offset at all seats, loner sitting-out
   exclusion, maker/defender objective and host A/B seat swaps. No seat-2 exception
   provides Val with privileged information.
4. Determinism: verified no clock or global randomness in policy dependency graph,
   repeatable sample ordering, no mutated input/shared history, and full-match replay.
   Timing uses clocks only in a separate optional host benchmark.
5. Simulation validity: reconciled hand awards with final scores, correct denominators,
   complete-match-only reporting, matched seeds/dealers, pair-cluster intervals and
   a same-policy control. Held-out comparison seeds are separate from development.
6. Difficulty cheating: confirmed all four policies receive the same allowed fields
   and legal choices. Expert's apparent full hands are internally generated
   hypotheses, not referee data. No tier sees actual kitty cards or hidden discards.
7. Complexity: no game-platform imports, UI, worker framework, training pipeline,
   persistent opponent models or new runtime dependencies. Search is bounded and
   reuses the existing pure rule helpers; reporting is JSON with concise documentation.

## Known weaknesses and next checkpoint

The policies are competent relative to these baselines, not proven expert human
players. Expert's sampled-world method has strategy-fusion/clairvoyance bias: it
chooses continuations as though a sampled world were known. Capacity-weighted,
most-constrained-first assignment is not uniform posterior sampling. Bidding is
not used to infer probabilistic card strength, and bid/discard decisions do not
run deep search. Results against these opponents need not generalize to every
human or future policy. The view does not retain the dealer's private discard,
so the stateless sampler cannot condition on that personal memory either.

Strong/Val use heuristic safety estimates; a master side-suit card can still be
ruffed, and partner-return rules are preferences rather than full tactical proofs.
Expert search compensates for some such cases, but no tier is claimed optimal.

Performance measurements are Linux/Node observations, not Safari/iPhone guarantees.
There are no UI focus or speech tests yet. Timing can change with machine load;
it is deliberately excluded from deterministic result equality.

Recommended next checkpoint, after acceptance: the VoiceOver-first playable
interface. Preserve the full hand and separate legal-action data, seat-bound ports,
explicit human-turn focus, concise nonduplicated speech and host-controlled
hand transitions. Test that interface on the actual iPhone/VoiceOver workflow.
Keep model-driven opponents, networking and adaptive training deferred. Do not
merge this checkpoint automatically.
