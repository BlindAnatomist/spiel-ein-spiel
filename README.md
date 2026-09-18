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

## Implemented: engine checkpoint 1

The presentation-independent TypeScript engine now implements the initial rules,
seeded deals, and restricted player capabilities. Player policies and headless evaluation are implemented in Checkpoint 2; the browser interface is implemented in Checkpoint 3. Node.js 24 or newer runs the TypeScript source directly.

```sh
npm ci --ignore-scripts
npm run check
```

`npm run check` runs strict type checking and the complete automated test suite.
See `docs/ENGINE_CHECKPOINT_1.md` for API usage, trust boundaries, reproducibility,
regression coverage, review findings, and continuation instructions.

## Implemented: players and headless evaluation (checkpoint 2)

Casual, Strong, Expert and Val policies choose from the engine's legal actions
using only their own `PlayerView`. Expert samples hypothetical unseen cards from
public constraints; it never receives the referee's hidden state or deal seed.
The rules engine and its information boundary are unchanged.

```sh
npm run simulate -- --games 100 --seed 20260918 --seats strong,casual,val,casual
npm run evaluate -- --a expert --b strong --pairs 800 --seed 2026091805
npm run benchmark -- --games 30 --seed 1002
```

Simulation/evaluation output is JSON. Each evaluation pair uses the same deal seed
and initial dealer twice, with the strategy teams exchanged. The default example
uses a Strong proxy for the future human at seat 0 and Val at seat 2.

See `docs/PLAYERS_CHECKPOINT_2.md` for the policy API, strategy parameters, testing,
review passes and limitations; `docs/evaluation/RESULTS.md` records the measured
difficulty comparisons and commands. The browser checkpoint below builds on the accepted engine and players.


## Browser interface (checkpoint 3)

Native HTML controls and a small TypeScript bundle provide a complete local game:
human seat 0, Val at seat 2, and the selected opponent level at seats 1 and 3.

```sh
npm ci --ignore-scripts
npm run check
npm run dev
```

Open `http://localhost:4173`. On an iPhone on the same Wi-Fi, open
`http://YOUR-COMPUTER-LAN-IP:4173` in Safari. Allow port 4173 on the computer's
local firewall if prompted. The server listens on the local network; no account,
backend, or cloud database is needed. `npm run build` produces the portable
static `dist/` directory for any HTTPS static host.

See `docs/INTERFACE_CHECKPOINT_3.md` for architecture, tests, review findings,
and the short real-device VoiceOver acceptance procedure. Automated DOM tests do
not establish iPhone VoiceOver acceptance; that device check remains outstanding.
