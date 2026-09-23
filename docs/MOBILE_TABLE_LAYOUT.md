# Isolated mobile visual checkpoint

Protected base: cc574d2d03d3410f625c6df3c08877bdcbcf2db4 (PR #6).
Branch: feat/euchre-mobile-table-layout.
Stacked draft PR targets feat/euchre-narrator-and-audio, not main. Do not merge either PR before owner acceptance. Old visual PR #4 is untouched and unused.

## Presentation

The top bar combines a two-line score, native difficulty selector, New Game icon and optional Sound Cues toggle. Controls are 48 px minimum. During gameplay the introductory header and hint are visually clipped, retaining their prior accessibility presence. No setup or game lifecycle code changes.

The responsive felt table is 200–300 px tall depending on content viewport height. Val remains top, West left, East right and You bottom. A gold outer halo identifies dealer; a separate cyan inner border identifies the active player. Both coexist. Dealer words are not visible. A called-suit badge, caller/alone note and compact trick tally supply public state visually without adding swipe stops.

The central up-card shows its face in round one, its patterned back in round two, and disappears on pickup. Four public card positions form a cross. When the current trick empties, the latest completed trick's public plays remain in an aria-hidden, noninteractive visual layer until the next trick's first card is played. The original accessible Current trick list reads only v.trick and stays empty after completion.

Five- and six-card hands each use one flex row, without sorting, overlap, truncating accessible names or disabling unavailable cards. Rank and suit faces are decorative; native buttons retain their exact PR #6 semantic descriptions and handlers, including bower wording. Hearts/diamonds are red and clubs/spades dark.

CSS grid places all bid/action controls below the hand while retaining PR #6 DOM order: positive bids, hand heading/cards, legal Pass, Repeat current state, available Review last trick. Plain/ringed suit bids keep full accessible labels. Repeat uses a decorative star before a call and called-suit glyph afterward, resetting on the next hand. Review uses a local inline SVG of rabbit ears emerging from a top hat. Both keep their exact accessible names. There are no duplicate interactive controls.

## Protected contract

Engine, policies, controller, announcer, presentation summaries, session, main entry/randomness and sound are unchanged. First-legal focus selection and focus bookkeeping in render.ts are unchanged. Existing 112 tests are unchanged. Twelve new tests cover visual accessibility, stable five/six-card hands and actions, privacy of visual faces, independent dealer/active treatment, public completed-trick hold, and byte-identity of protected modules. Full matches, hidden-information and determinism tests remain green.

Validation: npm ci --ignore-scripts; npm run check (124 passing); npm run build; git diff --check.

## Browser layout checks

scripts/mobile-layout-fixtures.ts creates an independent browser regression page using the real production renderer and CSS. It captures public seat-zero states from the real engine for first/second bidding, six-card discard, normal five-card play, completed-trick hold and next-trick opening. Each is rendered in 375×600, 390×650 and 430×740 CSS-pixel iframe document viewports, representing mobile Safari content with chrome excluded. Measurements check document overflow, single-row cards, minimum touch targets and at least 24 px below the lowest control. No overflow-hiding rule masks a failure.

The harness is emitted under /layout-check/ only when Netlify CONTEXT is deploy-preview. It is not included in the normal production build, and is not a game feature. It bundles only the presentation and static sample seat-zero views; the referee used to generate fixtures runs at build time. The app itself retains its protected hidden-information boundary.

Browser measurements and visual review are pending the automatic stacked PR preview. No Netlify CLI, manual deployment or authentication is used. Real iPhone VoiceOver acceptance remains required; DOM/Chromium layout checks cannot certify Safari speech/focus or Dynamic Type behavior. Enlarged text should scroll rather than be clipped.
