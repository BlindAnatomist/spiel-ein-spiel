# Spiel ein Spiel

A repository for accessible game experiments. The first active project is a VoiceOver-first four-player Euchre game.

## Current project: Euchre

The initial table is:

- Seat 0: human player
- Seat 1: opponent
- Seat 2: Val, human player's partner
- Seat 3: opponent

Partnerships are seats 0/2 versus 1/3.

The first goal is not a general game platform. It is one trustworthy, playable Euchre implementation with correct hidden information, deterministic deals, competent bots, and deliberate VoiceOver behavior.

## Core contracts

1. The referee may know the complete game state. Decision-making players may not.
2. Each player receives only that player's hand plus public information produced by bidding and play.
3. No bot may inspect another player's private hand.
4. Deals must be reproducible from a seed for testing and debugging.
5. Euchre's effective-suit rule is authoritative: the left bower belongs to trump for following suit and trick resolution.
6. Legal-play enforcement belongs to the engine, not to bot judgment.
7. Accessibility is part of game behavior, not a later presentation layer.
8. The human player's entire hand remains reviewable with VoiceOver; unplayable cards remain present and are announced as not playable.
9. At the human player's turn, focus should land on the first playable card without removing other cards from navigation.
10. Spoken game events must avoid duplicate announcements.

## Initial rules

- 24-card deck: 9, 10, jack, queen, king, ace in each suit.
- Four players, fixed partnerships.
- Five cards per player, four-card kitty.
- Dealer rotates clockwise.
- First player to the dealer's left acts first.
- Standard two-round trump selection.
- Stick the dealer is enabled.
- Going alone is allowed for the maker.
- No defensive loners in the initial version.
- Standard scoring to 10 points.
- No additional house rules in the first implementation.

## Development order

1. Deterministic rules engine and state model.
2. Per-seat information boundary.
3. Complete rule tests, especially bowers, following suit, bidding, dealer rotation, scoring, and stick-the-dealer.
4. Baseline deterministic bots.
5. Human/VoiceOver interaction layer.
6. Difficulty tiers.
7. Headless self-play and bot evaluation.
8. Later experiments with adaptive or evolving strategy.

See `docs/EUCHRE_FOUNDATION.md` and `docs/REFERENCE_RESEARCH.md`.
