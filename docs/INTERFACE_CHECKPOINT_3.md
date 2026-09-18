# Browser interface checkpoint 3

## Base and scope

Authoritative base: `c9f57f7808122d441d7a2961267042a143ff3f3c`, verified as
`origin/main` and the merged Checkpoint 2 commit before starting.
Branch: `feat/euchre-browser-checkpoint-3`. The PR records the exact implementation
commit (a file cannot contain its own commit hash). Do not merge until reviewed.

Complete browser play is implemented, with the existing engine and bot sources
unchanged. Human is seat 0, West seat 1, Val seat 2, East seat 3. Both opponents use
the selected Casual/Strong/Expert level; Val always uses `val`. The default dealer
is the human. Rules remain game to ten, stick the dealer, maker loners only.
No new rules, learning, accounts, networking, backend, or GPT Sites integration.

## Architecture and build

Plain TypeScript, semantic HTML, CSS, and esbuild; no UI framework. The production
JavaScript bundle is approximately 20 KB uncompressed. `dist/` is a portable static
site, with no source maps, external runtime assets, analytics, or remote requests.

- `web/session.ts` is trusted orchestration. It owns the referee and seat-bound
  player ports. Each bot is called with only its own port's view. It never calls
  `snapshot`. Its returned capability exposes only seat-zero views, human action
  submission, one bot step, and next hand. Other ports and policies stay in closure.
- `web/presentation.ts` formats card names, results and public action events.
  Dealer discard messages never include card identities. This module has no
  referee access. Human actions are not repeated as live announcements.
- `web/render.ts` consumes only seat-zero `PlayerView` plus action callbacks. It
  rejects other seat views. It contains no bot, referee or internal-state imports.
- `web/controller.ts` serializes actions, public announcements, and focus. It
  prevents double activation, pauses at hand end, and cancels the old bot loop
  when a new game starts. There is no per-bot Continue button.
- `web/main.ts` wires the native form and table. A fresh cryptographic uint32 seed
  selects each new game, solely in trusted startup. It is not placed in the DOM,
  accessibility labels, URL or storage. Seeded session replay remains deterministic.

This is local software, not an anti-cheat sandbox against someone modifying their
own JavaScript runtime. Ordinary UI components and decision policies cannot access
private state through their capabilities. No private hands, kitty, RNG state,
private discard or referee object is passed to presentation components.

## Focus and speech

Hand controls are retained by card identity and stay in engine hand order. A new
hand resets the control map, including after a loner left a whole hand unplayed.
Unavailable cards remain native, focusable buttons with `aria-disabled="true"`, a
concise “not playable” label, and an inert activation handler. Native `disabled`
is deliberately not used for these reviewable cards. Discarding uses all six
cards and explicit “Discard [card]” labels.

When a human action becomes available, focus moves once to the first bid,
first discard, or first legal play in hand order. The first bidding control
references the visible round heading. Exploring the hand does not reset focus.
After an accepted action, focus briefly parks on a stable “Game in progress”
heading before the previous control can disappear. At hand/game completion,
focus moves to the result, which includes points and score. Deal next hand is
adjacent and explicit. New Game is always available at the top.

There is exactly one polite, atomic live region. Bot actions and trick winners
are emitted once in sequence, with at least 1.6 seconds between messages (longer
messages receive 300 ms per word). Another 350 ms separates bot decisions.
Focus waits until that sequence ends. Hand results are spoken via focus, not
also copied into the live region. Static table/hand changes are not live regions.
The Current trick list contains only the active trick. Completed plays are cleared;
public winners supply both teams’ trick totals. Bowers retain actual card identity plus the bower label.

These delays are a pragmatic speech budget, not a speech-completion API. Safari
cannot tell the app when VoiceOver has finished. Real-device testing may require
adjusting the timing or focus parking; it is not proven by automated tests.

## Launch and iPhone testing

Requires Node.js 24+ on a computer:

```sh
npm ci --ignore-scripts
npm run check
npm run dev
```

Desktop: `http://localhost:4173`. On the same Wi-Fi, open
`http://YOUR-COMPUTER-LAN-IP:4173` in iPhone Safari. Substitute the computer's local
Wi-Fi IP from its network settings. Allow local port 4173 if the firewall asks.
The server binds `0.0.0.0`; keep it on a trusted local network. Stop with Ctrl-C.
Restart `npm run dev` after source edits. Nothing needs manual card dealing.

For a shareable HTTPS preview, run `npm run build` and publish the three files in
`dist/` to a static host. A Netlify project matching this repository was not found.
The Netlify deployment tool requires confirmation before creating a new site;
no unrelated existing site was modified and no hosted preview is claimed.

The cloud browser could not navigate to this workspace's localhost address
(`net::ERR_BLOCKED_BY_CLIENT`). Consequently there is no real-browser screenshot
or responsive visual validation in this checkpoint yet. The actual bundled entry
was exercised in jsdom, including form submission and a complete game via native
button activation. jsdom is not a browser rendering engine or a VoiceOver test.

## Concise real-device acceptance sequence

1. Turn on iPhone VoiceOver and open the build in Safari. Choose a difficulty and
   activate New Game. Confirm automatic bidding announcements and direct focus
   on your first relevant action. Confirm the bidding round is understandable.
2. Make a bid or pass. In round two, review the available suits. Automated tests
   cover exclusion of the turned-down suit and absence of Pass for a stuck dealer;
   you do not need to reproduce every bidding permutation on-device.
3. On a play turn, check that focus lands on a playable card. Swipe through the
   entire hand, including “not playable” cards. Activate one unavailable card and
   confirm nothing is played. Return to and play a legal card.
4. Listen to the bot sequence and trick winner. Check for interrupted, collapsed,
   or duplicate speech. Confirm focus returns to your next playable card only
   when your next turn begins, and does not jump during your review.
5. Review score, dealer, trump, caller, trick and trick count with ordinary
   navigation/headings. If a bower is present, confirm its real card name is spoken.
6. When ordered up as dealer, review all six “Discard” choices, discard one, and
   confirm five remain. This can occur in the first hand because you start as
   dealer; if not encountered, test on a later hand. Automated tests cover it too.
7. At hand end, hear the result and score once. Review it before activating Deal
   next hand. Confirm the new hand starts automatically and human action focus
   returns when appropriate. Continue enough to confirm score progression.
8. Try New Game while bots are acting. Confirm the old sequence stops. Separately
   inspect portrait layout, large text and landscape. Automated tests already
   complete games through score ten at all three difficulties.

Record iOS version, Safari version, VoiceOver speech rate, and any exact sequence
that causes focus loss or duplicate speech. Real-device acceptance remains pending.

## Tests and review passes

`npm run check`: strict TypeScript and 82 passing tests, including all 62 existing
engine/player tests. `npm run build`: passes. CI additionally builds the static
site after its existing check command.

New tests cover seat-zero-only presentation; private-card exclusion across many
rendered transitions; full hand/order/reviewability; inert unavailable controls;
first-legal focus and exploration; engine-derived bidding and stuck dealer;
six-card discard; score/trump/bower labels; selected policy routing verified
against independent seat ports; one-message public events and private discards;
automatic bots; complete synchronized UI games to ten at each level; hand-result
pause; cancellation/restart; duplicate activation; deterministic session replay;
new-hand order after loners; and a complete bundled-entry/native-control game.

Separate critical reviews:

1. Hidden information: renderer imports only player-safe types/helpers. Session
   emits only seat-zero views and public messages. DOM/attributes are checked
   against unplayed opponent/kitty identities, allowing genuinely public cards.
2. Semantic verbosity: simple buttons, three structural headings, no nested
   labelled regions per card; brief bower/status labels. First bid describes round.
3. Focus: retained card nodes, transition-key guard, pre-removal focus parking,
   and result focus. Actual iOS accessibility focus remains unverified.
4. Duplicate announcements: one live region and one serial event path; human
   actions and results are not emitted through both focus and live speech.
5. Full-hand review: no filtering/reordering by legality; all six discard choices;
   no native disabled hand controls; inert handlers checked.
6. Left bower: labels use existing effective-suit helper, legal actions remain
   engine-owned; original all-suit bower regression tests still pass.
7. Synchronization: one in-flight loop, engine validates actions, old loops stop,
   human/hand-end boundaries pause, complete matches tested through DOM/controller.
8. iPhone layout: viewport metadata, wrapping hand/actions, minimum 48 px controls,
   mobile CSS and visible text for every state. Visual/device inspection pending.
9. Complexity: no framework, duplicate rules, persistent state, settings panel,
   search changes, animations, sound, or new engine abstractions. Two small scripts
   build/serve the static output. No Parlour code reused; no new attribution needed.

## Limitations and continuation

Refresh loses the game. There is no undo, saved session, previous-trick browser or
error recovery beyond New Game. Browser suspension can pause timers. Very slow
VoiceOver speech may require a longer announcement budget. Font scaling and
Safari focus must be checked on-device. These are explicit acceptance limits,
not claims that automated ARIA/DOM checks prove accessibility.

Next: publish an isolated HTTPS preview after site confirmation, complete the
short iPhone VoiceOver acceptance pass, and address concrete findings before
merging. Then adapt/publish in GPT Sites using these same engine/policy modules
and seat-zero interface boundary; replace only the hosting shell if necessary.
Do not rewrite game logic or add new features as part of that adaptation.


## Real-iPhone remediation, September 18

Remediation base: `ebb174a6fe50348fa91c8fe3c6d51a49971dd97e`. Exact remediation
commit and deployment evidence are recorded in PR #3. This section supersedes
initial checkpoint deployment/acceptance limitations above where applicable:
the owner has now played the HTTPS build with iPhone VoiceOver and supplied
specific findings. A second device pass is still required for these repairs.

Changes are confined to presentation, controller announcement cleanup, tests and
this record. Human trick winners say “You take the trick”; other seats use “takes”.
The one live region is cleared after each existing speech budget: max(1600 ms,
300 ms per word). The serial loop waits before clearing. Cancelled old-game loops
cannot clear a new game's message. No new region or timing preference was added.
Speech completion itself cannot be observed, so verify clearing at your actual
VoiceOver rate. This does not change human focus targets or focus timing.

Current trick now contains only `PlayerView.trick`, never completed-trick fallback
cards. Its visible heading is “Current trick”, followed by the two public team
trick totals and completed count. The displayed term is “Called suit”; internal
trump concepts are unchanged. Left-bower names retain the printed identity and
append “left bower, counts as [suit]”. Right-bower names stay concise.

Static West/East/Val position labels are simple paragraphs, without repeating
labelled-container semantics. They and the visual layout remain unchanged.
Unavailable-card semantics also remain unchanged pending actual evidence of
redundant iOS state speech. The focus function is unchanged: legal actions from
the engine preserve hand order; no policy influences the target.

Five new regression tests cover all four winner phrases, announcement lifecycle
and cancellation, active-only trick cards and public team totals, all four bower
suit pairs, and strategy-independent first-legal focus. Existing naming assertions
are updated for the requested wording. All 77 prior tests remain, including
private-card DOM checks and complete games through ten; all 82 tests pass.
`npm ci --ignore-scripts`, `npm run check`, and `npm run build` succeed.

The badge is Netlify platform injection, not our source. Netlify documents a
per-project “Powered by Netlify badge” switch with no plan change or redeploy:
https://docs.netlify.com/manage/projects/powered-by-netlify-badge/
The connected Netlify tool does not expose that switch, and the cloud dashboard
requires a separate login. It was left unchanged, rather than adding brittle CSS
or changing unrelated settings. No other site was accessed or modified.

Next device pass: confirm “You take”, that old speech is no longer encountered
while navigating, an empty new Current trick, both teams’ trick totals, left-bower
“counts as” wording, and unchanged first-legal focus/full-hand review. Listen for
truncation at the end of the announcement budget; do not treat DOM checks as
VoiceOver acceptance. No engine, policy, rules, layout/CSS or coaching change.
