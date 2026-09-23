# Euchre visual polish

Base: `af259d8a0adbbcc3d06e3d797a31cd34a870e970` (verified main).
Branch: `feat/euchre-visual-polish`. Exact implementation SHA is in the PR.

This is presentation-only. No engine, bot, session, controller, announcement,
card-naming, action, focus-function, hand-order or unavailable-card semantics
changes. Existing 82 tests remain; two new regressions cover the visual card
boundary and public trick-seat placement. Fresh npm ci --ignore-scripts,
npm run check (84 passing tests), and npm run build pass.

## Visual changes

Deep green felt-style gradients, restrained brass framing, cream scoreboard,
compact setup panel, clearer typography and seat labels. Hands use ivory printed
card faces with corner ranks, conventional red/black suits and a central suit
symbol. Gold solid borders and shadows mark playable cards; muted faces and dashed
borders mark unavailable cards. Visible status words remain. No fanning, overlap,
animation, recommended plays or visual bower markers. Card sizing grows with rem
units and wraps on narrow screens; controls retain minimum 48 px targets.

Current trick cards appear in a compact cross: Val above, human below, West left,
East right. CSS positions the public plays without changing DOM play order.
The empty area reserves the same rows to avoid a jump on the opening play.

## Component and accessibility boundary

`web/card-face.ts` accepts only a public card identity. Decorative ranks/suits are
CSS-generated inside an aria-hidden ancestor. The existing exact spoken label is
retained in a visually clipped text span within the same native button. Bower
wording remains in that spoken name and is not drawn on the face. No tabindex,
extra action or labelled region is introduced. Trick items keep their original
player/card text for screen readers and expose no private cards.

`web/render.ts` retains button identity, action handlers and the entire focus
function. Only its card/trick child markup changes. Existing tests still assert
names, illegal-card inertness, full hand/order, first-legal focus, hidden-card
exclusion, and complete games at each difficulty. New tests assert all decoration
is aria-hidden, exact labels survive, no bower decoration exists, and card buttons
retain focus after rendering.

## Review and limitations

HTTPS preview uses only `spiel-ein-spiel-euchre-preview`, site ID
`fd812d71-cb0c-4ec6-92d4-c376214b8ff9`. No other Netlify site is modified.
Browser inspection verifies New Game, card names, hand controls and layout.
The screenshot in this directory records the deployed desktop rendering.
Responsive CSS uses wrapping hand controls, narrow-screen layout and rem-sized
faces. This browser session does not provide an iPhone viewport emulator; actual
mobile Safari, larger text and iPhone VoiceOver need the owner's short acceptance
pass. Browser ARIA checks are not real-device acceptance.

The Netlify platform badge remains outside the game. Refresh still loses a game,
as before. No external fonts or image assets are required by the game. The
screenshot is review evidence only, not a shipped runtime asset.
