# Euchre Foundation

Status: authoritative design checkpoint for the first implementation.

## 1. Product intent

Build a four-player Euchre game in which the human player and Val are partners against two computer-controlled opponents.

The first implementation should be intentionally narrow: correct Euchre, trustworthy hidden information, competent play, and excellent VoiceOver interaction. Adaptive learning and model-driven behavior come later.

## 2. Seating and rotation

Use four seats in clockwise order:

- Seat 0: human
- Seat 1: opponent
- Seat 2: Val
- Seat 3: opponent

Teams:

- Team 0: seats 0 and 2
- Team 1: seats 1 and 3

The initial dealer may be selected deterministically from the game seed. Dealer then rotates clockwise after each completed hand.

The player immediately clockwise from the dealer acts first during bidding and leads the first trick after trump is established, unless a rule condition changes the active seats.

## 3. Authoritative state versus player knowledge

The referee state may contain:

- all four hands;
- kitty;
- up-card;
- dealer;
- bidding history;
- trump;
- caller;
- loner status;
- current trick;
- completed trick history;
- score;
- current turn;
- deterministic random state or seed-derived deal information.

A decision-making player must never receive the authoritative state directly.

Each seat receives a derived player view containing only:

- that seat's own cards;
- the face-up card while public;
- bidding history;
- trump once established;
- caller and loner status once public;
- cards publicly played;
- who played each public card;
- trick winners;
- known void information derivable from public play;
- dealer and turn information;
- score;
- legal actions available to that seat.

Another player's unplayed cards and the hidden kitty must not appear in the player view.

This boundary must be covered by automated tests.

## 4. Knowledge versus inference

Bots may derive conclusions from public evidence.

Examples of knowledge:

- a player failed to follow a led effective suit and is therefore void in that suit at that moment;
- a particular card has already been played;
- the turned-down suit cannot be called in round two;
- trump and dealer are public.

Examples of inference:

- a player probably holds another trump;
- a caller is likely strong in the called suit;
- a partner may be void in a suit;
- a remaining bower is more likely to be in one opponent's hand than another's.

Inference must never be implemented by consulting hidden cards.

## 5. Deck and bower semantics

Use a 24-card deck:

- 9
- 10
- jack
- queen
- king
- ace

in each of four suits.

When trump is known:

- right bower: jack of trump;
- left bower: jack of the same-colored suit;
- the left bower's effective suit is trump.

All follow-suit validation, trick resolution, void tracking, bot reasoning, and hand presentation logic must use effective suit where appropriate.

This is a high-risk rule and requires dedicated tests.

## 6. Bidding

Use standard two-round bidding.

Round one:

- the up-card suit may be ordered up;
- players act clockwise beginning left of dealer;
- if ordered, the dealer picks up the up-card and discards one card.

Round two:

- after all four players pass round one, players may name one of the other three suits;
- the turned-down suit is not legal;
- stick-the-dealer is enabled;
- if the first three players pass in round two, the dealer must name a legal suit.

Going alone is allowed for the maker.

Initial version: no defensive loner rule.

## 7. Trick play

Players must follow the led effective suit when able.

If unable to follow, any card in hand is legal.

The engine, not the UI and not the bot, determines legal cards.

A trick is resolved only from public played cards plus trump/effective-suit rules.

The winner leads the next trick.

## 8. Scoring

Target score: 10.

Initial scoring:

- makers take 3 or 4 tricks: 1 point;
- makers take all 5 tricks: 2 points;
- maker goes alone and takes all 5 tricks: 4 points;
- makers take fewer than 3 tricks: defenders receive 2 points.

Any additional scoring variant must be explicit and configurable rather than silently introduced.

## 9. Determinism

The game must support reproducible seeded deals.

The same seed and same sequence of player actions should reproduce the same authoritative game state.

This is required for:

- bug reproduction;
- regression tests;
- bot comparisons;
- simulation;
- accessibility focus-state reproduction;
- later training experiments.

Do not use uncontrolled randomness inside rule resolution or bot evaluation.

## 10. Baseline bots

The first bot system should be deterministic or seed-deterministic and rule-based.

Baseline bots need:

- legal bidding;
- legal card play;
- basic hand evaluation;
- trump awareness;
- bower awareness;
- follow-suit correctness;
- partner/opponent seat awareness;
- memory of public plays;
- simple void tracking.

Difficulty should come from decision quality, not hidden information.

Suggested later tiers:

- Casual
- Strong
- Expert

Val may eventually use a partnership-oriented policy distinct from opponent policies, but the first implementation may share a common strategic core.

## 11. VoiceOver interaction contract

The human player's full hand remains navigable at all times when the hand is available.

On the human player's turn:

- focus moves to the first legal card;
- every card in the hand remains reachable by ordinary VoiceOver navigation;
- legal cards are announced as playable;
- cards disallowed by follow-suit rules are announced concisely as not playable;
- unplayable cards remain reviewable but cannot trigger an illegal move.

Do not reorder the hand unexpectedly during a trick merely to put legal cards first. Stable card order is preferred.

During bidding, focus should move to the relevant bidding action.

After the human plays, focus should not wander through stale action controls while bots act.

Game announcements and focused-control speech must be coordinated so the same event is not spoken twice.

## 12. Deferred work

Do not block the first playable version on:

- full LLM-controlled opponents;
- evolutionary training;
- persistent opponent learning;
- multiplayer networking;
- avatars;
- achievements;
- elaborate statistics;
- generalized multi-game framework.

Those remain possible after the engine and interaction model are trustworthy.
