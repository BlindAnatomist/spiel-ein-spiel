# Isolated mobile visual checkpoint

Protected base: cc574d2d03d3410f625c6df3c08877bdcbcf2db4 (PR #6).
Branch: feat/euchre-mobile-table-layout.
Stacked draft PR targets feat/euchre-narrator-and-audio, not main. Do not merge either PR before owner acceptance. Old visual PR #4 is untouched and unused.

## Presentation

The top bar combines a two-line score, native difficulty selector, New Game icon and optional Sound Cues toggle. Controls are 48 px minimum. During gameplay the introductory header and hint are visually clipped, retaining their prior accessibility presence. No setup or game lifecycle code changes.

The responsive felt table is 200–300 px tall depending on content viewport height. Val remains top, West left, East right and You bottom. A gold outer halo identifies dealer; a separate cyan inner border identifies the active player. Both coexist. Dealer words are not visible. A called-suit badge, caller/alone note and compact trick tally supply public state visually without adding swipe stops.

The central up-card shows its face in round one, its patterned back in round two, and disappears on pickup. Four public card positions form a cross. When the current trick empties, the latest completed trick's public plays remain in an aria-hidden, noninteractive visual layer until the next trick's first card is played. The original accessible Current trick list reads only v.trick and stays empty after completion.

Five- and six-card hands each use one flex row, without sorting, overlap, truncating accessible names or disabling unavailable cards. Rank and suit faces are decorative; native buttons retain their exact PR #6 semantic descriptions and handlers, including bower wording. Hearts/diamonds are red and clubs/spades dark.

CSS grid places all bid/action controls below the hand. VoiceOver/DOM order is now hand heading/cards, positive bids, legal Pass, Repeat current state, available Review last trick. Automatic bidding focus still lands on the first positive bid, so swiping left immediately reaches the hand. Plain/ringed suit bids keep full accessible labels. Repeat uses a decorative star before a call and called-suit glyph afterward, resetting on the next hand. Review uses a local inline SVG of rabbit ears emerging from a top hat. Both keep their exact accessible names. There are no duplicate interactive controls.

## Protected contract

Engine, policies, announcer, presentation summaries, session, main entry/randomness and sound are unchanged. The controller mirrors PR #6's real-device remediation by extending only the narrator-to-focus quiet guard from 750 ms to 1500 ms; focus selection itself is unchanged. First-legal focus selection and focus bookkeeping in render.ts remain unchanged. Existing coverage is preserved, with an added swipe-order regression for hand → bids → Pass → state → last trick. Full matches, hidden-information and determinism tests remain required to stay green.

Validation: npm ci --ignore-scripts; npm run check; npm run build; git diff --check. Current passing count is recorded by CI for the latest branch head.

## Browser layout checks

scripts/mobile-layout-fixtures.ts creates an independent browser regression page using the real production renderer and CSS. It captures public seat-zero states from the real engine for first/second bidding, six-card discard, normal five-card play, completed-trick hold and next-trick opening. Each is rendered in 375×600, 390×650 and 430×740 CSS-pixel iframe document viewports, representing mobile Safari content with chrome excluded. Measurements check document overflow, single-row cards, minimum touch targets and at least 24 px below the lowest control. No overflow-hiding rule masks a failure.

The harness is emitted under /layout-check/ only when Netlify CONTEXT is deploy-preview. It is not included in the normal production build, and is not a game feature. It bundles only the presentation and static sample seat-zero views; the referee used to generate fixtures runs at build time. The app itself retains its protected hidden-information boundary.

PR #7 was retargeted to main solely for preview generation. The GitHub-connected Netlify project now creates deploy previews automatically for PR #7. Real-device VoiceOver acceptance and browser layout measurements remain required before merge.

The cloud browser also refused localhost and local-file fixture URLs. No browser-policy bypass or alternative automation surface was used. The harness is committed and ready for the authorized automatic preview; browser measurements and visual inspection must be completed once that preview is available. The normal build removes any previously generated preview fixture directory before rebuilding, so fixtures cannot carry over into production output. No Netlify CLI, manual deployment or authentication is used. Real iPhone VoiceOver acceptance remains required; DOM/Chromium layout checks cannot certify Safari speech/focus or Dynamic Type behavior. Enlarged text should scroll rather than be clipped.

Deployment note: PR #7 was retargeted to main solely so the GitHub-connected Netlify project can generate a deploy preview; this documentation-only commit triggers that preview without changing game or layout code.
