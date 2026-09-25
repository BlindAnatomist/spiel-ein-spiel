# Isolated mobile visual checkpoint

Refreshed baseline: e159f97a03b051cc654397702c54c6b98fb350f0 (accepted main after PR #8).
PR branch: feat/euchre-mobile-table-layout.
Pre-refresh PR #7 head fba6aa22acffb20c27f7f0e2a35a4980d4227082 is preserved at backup/pr7-pre-refresh-2026-09-25.
PR #7 targets main. Old visual PR #4 remains untouched and unused. Do not merge PR #7 before refreshed browser checks and owner iPhone/VoiceOver acceptance.

## Presentation

The top bar combines a two-line score, native difficulty selector, explicit Start game / New game control and optional Sound Cues toggle. PR #8's performance classification, Analysis and Help controls remain in a secondary setup row and are removed from the active-play visual layout to preserve table space. Controls remain 48 px minimum. During gameplay the introductory header is visually clipped while its existing accessibility presence is retained. Game rules and lifecycle semantics are unchanged.

The responsive felt table is 200–300 px tall depending on content viewport height. Val remains top and You bottom; the left and right opponent labels come from PR #8's permanent SeatNames identities rather than hard-coded West/East. A gold outer halo identifies dealer; a separate cyan inner border identifies the active player. Both coexist. Dealer words are not visible. A called-suit badge, caller/alone note and compact trick tally supply public state visually without adding swipe stops.

The central up-card shows its face in round one, its patterned back in round two, and disappears on pickup. Four public card positions form a cross. When the current trick empties, the latest completed trick's public plays remain in an aria-hidden, noninteractive visual layer until the next trick's first card is played. The original accessible Current trick list reads only v.trick and stays empty after completion.

Five- and six-card hands each use one flex row, without sorting, overlap, truncating accessible names or disabling unavailable cards. Rank and suit faces are decorative; native buttons retain their exact PR #6 semantic descriptions and handlers, including bower wording. Hearts/diamonds are red and clubs/spades dark.

CSS grid places all bid/action controls below the hand. VoiceOver/DOM order is hand heading/cards, positive bids, legal Pass, Repeat current state, available Review last trick. Automatic bidding focus still lands on the first positive bid, so swiping left immediately reaches the hand. Plain/ringed suit bids keep full accessible labels. Repeat uses one fixed target/bullseye visual identity; its accessible name appends only "Suit not called yet" or the current called suit for fast touch discovery. Review uses a local inline SVG of rabbit ears emerging from a top hat. There are no duplicate interactive controls.

## Protected contract

Engine, policies, announcer, session/randomness, performance recording and sound behavior remain authoritative from accepted main. The controller and its 1150 ms narrator-to-focus quiet guard are unchanged by this refresh; focus selection itself is unchanged. First-legal focus selection and focus bookkeeping in render.ts remain unchanged. The intentional presentation changes are limited to decision-priority Current State wording, the compact sighted panel, explicit Start/New game wording, Help and the visual table. Existing coverage is preserved and extended with swipe-order and visual regressions. Full matches, hidden-information, performance and determinism tests remain required to stay green.

Validation: npm ci --ignore-scripts; npm run check; npm run build; git diff --check. Current passing count is recorded by CI for the latest branch head.

## Browser layout checks

scripts/mobile-layout-fixtures.ts creates an independent browser regression page using the real production renderer and CSS. It captures public seat-zero states from the real engine for first/second bidding, six-card discard, normal five-card play, completed-trick hold and next-trick opening. Each is rendered in 375×600, 390×650 and 430×740 CSS-pixel iframe document viewports, representing mobile Safari content with chrome excluded. Measurements check document overflow, single-row cards, minimum touch targets and at least 24 px below the lowest control. No overflow-hiding rule masks a failure.

The harness is emitted under /layout-check/ only when Netlify CONTEXT is deploy-preview. It is not included in the normal production build, and is not a game feature. It bundles only the presentation and static sample seat-zero views; the referee used to generate fixtures runs at build time. The app itself retains its protected hidden-information boundary.

PR #7 targets accepted main directly after the controlled 2026-09-25 refresh. The GitHub-connected Netlify project creates deploy previews automatically for PR #7. Real-device VoiceOver acceptance and browser layout measurements remain required before merge.

The cloud browser also refused localhost and local-file fixture URLs. No browser-policy bypass or alternative automation surface was used. The harness is committed and ready for the authorized automatic preview; browser measurements and visual inspection must be completed once that preview is available. The normal build removes any previously generated preview fixture directory before rebuilding, so fixtures cannot carry over into production output. No Netlify CLI, manual deployment or authentication is used. Real iPhone VoiceOver acceptance remains required; DOM/Chromium layout checks cannot certify Safari speech/focus or Dynamic Type behavior. Enlarged text should scroll rather than be clipped.

Deployment note: the refreshed PR branch is a clean descendant of accepted main and its Netlify preview is generated from the same PR head that CI validates.

## Owner testing refinements — implemented in the 2026-09-25 refresh

These are accepted design notes from owner/Cynthia testing. The 2026-09-25 refresh implements the structural refinements below on top of accepted main while keeping them subject to automated verification and owner real-device acceptance.

### Non-negotiable accessibility boundary

The current owner-tested VoiceOver game is the protected contract. Visual refinements must not disturb narrator timing, the 1150 ms quiet guard, focus selection/bookkeeping, card semantics, hand order, or the established in-hand swipe sequence. Sighted-only status should be additive and should not create duplicate VoiceOver speech or extra swipe stops. Reuse existing public presentation state rather than creating a second game-state path.

### Current-state control

The Repeat current state control now uses one fixed target/bullseye-style icon. The icon no longer changes when a suit is called. Suit glyphs should mean suits; the state control should have its own stable visual identity.

The control keeps the accessible identity Repeat current state and appends only the most frequently needed fact to its accessible name:
- before a call: "Repeat current state. Suit not called yet."
- after a call: "Repeat current state. Called suit: Hearts." (or the actual suit)

Do not put the entire state summary in the button label. The purpose of the appended suit is fast touch discovery: a VoiceOver user can touch the control and recover trump without activating it or listening through a full report.

The activated Current state report is reordered by decision priority rather than bookkeeping priority. During play, report:
1. called suit/trump;
2. caller, including alone status and the sitting-out partner when relevant;
3. current trick in actual play order, beginning with the leader;
4. whose turn it is;
5. trick totals and other hand state;
6. dealer/hand number and score last.

During bidding, use the equivalent phase-aware priority: suit not yet called, up-card/calling round and whose turn first; bookkeeping later. Preserve the existing public-information boundary.

### Sighted Current state panel

When a sighted player activates Repeat current state, the same summary text is rendered visibly in a compact panel. Do not create parallel summary logic: the visible panel and VoiceOver announcement must derive from the same public summary/source of truth.

The panel must not cover the table, cards, or action controls. It remains visible long enough to read, then disappears on the next state-changing game action. Activating Repeat current state again may dismiss it manually, avoiding a second Close control in the protected swipe flow. The visible panel itself must not be separately auto-announced to VoiceOver; the existing live-region path already supplies the spoken summary.

### Persistent called-suit indicator for sighted play

Keep a small, persistent, noninteractive called-suit/trump indicator in a fixed visual location near the score/dealer status, separate from the bidding/action controls. Once a suit is called, it remains plainly identifiable for the rest of the hand.

This visual indicator is sighted-only presentation and should be hidden from the accessibility tree because the same fact is already available from the Repeat current state accessible label and activated summary. It must never look like another bid choice or interactive suit control.

### Start and instructions

The initial game-start control displays explicit text, "Start game", rather than relying on an icon. After the first start it becomes "New game". The small space cost is justified by immediate recognizability.

A compact Help control is included in the top area and is hidden from the active-play visual layout after a game begins. Its explanation should be short and practical, including at minimum:
- plain suit button = call that suit;
- ringed suit button = call that suit and go alone;
- target/bullseye = current state;
- rabbit/top-hat = review last trick;
- dealer and active-player visual indicators;
- when a player goes alone, that player's partner sits out.

The Help/Instructions control must not alter the established in-hand hand/bid/action order.

### Cynthia test: apparent missing Val card

Do not yet classify the reported missing Val card as a rendering defect. A plausible explanation is an unrecognized loner hand: if Cynthia accidentally selected a ringed suit, Val correctly sits out and therefore plays no card.

Verify this explicitly:
1. confirm Val's played card renders in an ordinary four-player hand;
2. confirm Val is absent when Cynthia goes alone;
3. confirm Current state explicitly identifies the loner and sitting-out partner.

Only treat this as a card-rendering bug if Val fails to render in a hand where he is actually an active player.

### Design objective

PR #7 should remain blind-first and become legible to a sighted first-time player through minimal exposition, not through a second interface or additional game logic. The successful target is that the owner's current VoiceOver play feels unchanged while a sighted player can immediately identify Start game, called suit, loner status, current state, and the meaning of the compact controls.



## 2026-09-25 controlled refresh

The refresh is built from accepted main at e159f97a03b051cc654397702c54c6b98fb350f0 rather than by merging main blindly into the old visual branch. This preserves PR #8's performance ledger, Mixed opponents, opponent profiles and permanent table identities while layering the PR #7 presentation on top.

Protected behavior remains authoritative from main: engine/rules/scoring, hidden-information boundary, opponent/profile selection, performance recording, narrator serialization, 1150 ms focus guard, first-legal-card focus, stable hand order, sound meanings and the established cards-first bidding/play navigation.

The refreshed visual layer consumes the same SeatNames source as narration and Current state. It must not revert permanent opponent identities to generic West/East.

Implemented refinements in this refresh:
- fixed target/bullseye Current state icon;
- called suit appended to the Current state control's accessible name for touch discovery;
- decision-priority Current state summary;
- sighted Current state panel derived from the same currentState source and hidden from the accessibility tree;
- persistent noninteractive visual called-suit/caller state;
- explicit Start game / subsequent New game text;
- compact Help explaining suit calls, loners, Current state, last-trick review, dealer/active indicators and sitting-out partners;
- preservation of PR #8's Mixed opponents, performance toggle, Analysis and Netlify ledger fields;
- visual seat labels driven by PR #8 permanent table identities.

Validation completed on the refreshed implementation before this documentation cleanup:
- GitHub Actions npm ci --ignore-scripts: pass;
- npm run check: pass, 149 tests after the narrator expectation repair;
- npm run build: pass;
- Netlify deploy preview generated from the validated PR head.

Still required before merge:
1. deploy-preview browser layout measurements at the documented mobile viewports;
2. owner iPhone VoiceOver acceptance, especially focus timing, cards-first swipe order, Current state touch discovery and absence of duplicate speech;
3. sighted verification of Start game, called suit, dealer/active state, loner/sitting-out comprehension and ordinary Val-card rendering.
