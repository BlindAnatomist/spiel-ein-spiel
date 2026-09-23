# Narrator and audio checkpoint — draft, owner acceptance required

Base: `4fb2d0c076afdab50fb324edc8dec78fcdff68c0`.
Branch: `feat/euchre-narrator-and-audio`.
Do not merge until the owner accepts this build on iPhone with VoiceOver. PR #4 is unrelated and untouched.

## Implementation

`web/announcer.ts` owns the single serialized writer to the existing polite ARIA live region. The controller queues automatic messages and on-demand summaries through this writer, retaining the baseline speech budget and bot pacing. Pending reviews are coalesced; their public snapshot is computed when spoken. Legal human actions interrupt on-demand speech without waiting for its timer. Game restart cancels the old writer. Browser speech synthesis, external voices, network audio and a second live region are not used.

Automatic public events: dealer once per hand; up-card once per hand; opponent/Val pass, order-up, call and alone declaration; dealer pickup; generic nonhuman discard without identity; turned-down up-card; nonhuman opening lead or following play; trick winner. Human action labels already provide the selected bid/card, so those are not repeated in the live region. Hand/game results retain their baseline focused-result delivery.

Repeat current state gives hand number, dealer, score and target, team trick totals; up-card status and calling round during bidding; called suit/caller, loner and sitting-out status; every current-trick card in actual play order with the leader, and whose turn it is; pending discard or results where applicable. Result summaries use the result’s score once. It never reads the human hand or legal actions. Review last trick reads only the latest completed trick, in actual play order, with winner and existing bower explanations. Its button is absent from accessibility navigation until a trick completes, and resets for a new hand. Neither review changes state, hand order or focus bookkeeping, and completed cards never repopulate Current Trick.

Sound Cues is an `aria-pressed` button, off on page load and retained across New Game in that page only. Enabling it initializes/resumes Web Audio on the explicit gesture. Sine tones last 55 ms (card) or 140 ms (other results), with an 0.035 peak gain and short envelope. Card, trick, hand win/loss and game win/loss use simple frequencies; simultaneous events coalesce to the highest result. Disabling stops active tones. Unavailable/suspended audio fails silently without changing game behavior. No assets or requests are needed.

## Protection and verification

Engine, bots, session, randomness, rules, scoring, hand rendering/order and focus algorithm are unchanged. Rendering places positive bids before the hand and Pass (when legal), Repeat current state and Review last trick (when available) immediately after it in DOM order. Narration accepts the same public seat-zero view boundary as the baseline. The accepted first-legal-card algorithm and illegal-card reachability are retained.

Commands: `npm ci --ignore-scripts`, `npm run check`, `npm run build`.
112 tests pass: the existing 101 tests plus 11 remediation regressions. Existing assertions were adapted only for the intentional label/order, expanded summary and guarded timing changes; none were weakened. New coverage includes delayed first-legal-card/discard/result focus, no per-bot guard, interruption/review races, restart during guard, both bidding rounds and stuck dealer ordering, glyph labels/decorative hiding, CSS touch target minimums, HUD accessibility and public-summary completeness. The existing once-per-hand dealer test now also asserts the requested up-card announcement; no assertion was removed or weakened. New regressions cover one writer and bounded reviews, bid/pickup/turned-down messages, lead versus follow and human suppression, phase summaries, last-trick order and winner, focus/hand/current-trick preservation, interruption and serialization, privacy across complete games at all three difficulty levels, cue selection, disabled/unavailable audio, and identical full-game state/focus/transcripts with cues enabled or disabled. Existing reproducibility and hidden-information tests remain green.

## Real-device acceptance

DOM tests do not establish iPhone VoiceOver speech timing, interruption, focus or audio mixing. The existing heuristic speech duration cannot detect when VoiceOver actually finishes speaking. Review requests during automatic narration intentionally share its queue. Audio availability depends on browser/device state; all information remains available without it. The owner must test narration clarity and duplication, both review controls, cue levels, first-legal-card focus, full-hand review and overall pacing before merge.

## Later checkpoints — record only

2. Human and bot performance tracking, including East versus West calling frequency.
3. Multiple personalities within difficulty levels, including conservative, assertive, partnership-oriented, card-conserving and aggressive-loner candidates.
Neither is implemented here.

Deployment note: repository linkage to Netlify was established after this checkpoint was created; this documentation-only update exists solely to trigger a fresh PR deployment preview.


## iPhone remediation of f20d0e0

The fixed post-narration quiet guard is **750 ms**. The existing estimated speech budget is unchanged. At the next automatic focus boundary, the controller waits for queued messages/reviews to finish and clear, then waits 750 ms before rendering the interactive state and moving focus. A review arriving during that guard is allowed to finish and clear, followed by a fresh guard. Cancellation prevents old focus. No guard is added to intervening bot decisions (their existing 350 ms pacing is retained), or to focus with no new narration. The focus algorithm, result focus and hand order are unchanged. Sound cues never join the wait chain.

Accessible order during play: Your hand heading → cards in existing order → Repeat current state → Review last trick if available. During bidding: positive choices → Your hand heading → cards → Pass when legal → Repeat current state → Review last trick if available. A stuck dealer has no Pass. The turn heading and individually readable Current trick remain accessible above these controls.

Positive bids show ordinary suit glyphs in 56 px minimum-height buttons, with minimum width 48 px and a 56 px flex basis. The alone glyph has a CSS ring. Every button has the full explicit aria-label (Order up/Call, suit, and go alone where relevant); glyphs are aria-hidden. Pass remains text.

The score, dealer/hand, called suit/caller, team trick totals and decorative Table/seat labels remain visually present but use aria-hidden to reduce swipe repetition. Repeat current state supplies their equivalent public information. Up-card is hidden from swipe navigation only during bidding/discarding, when the summary includes it; its historical display remains accessible in later phases because the compact summary omits it then. Hand, current turn, current-trick list and results are never hidden by this reduction.

Validation: npm ci --ignore-scripts; npm run check; npm run build; git diff --check. Deployment is exclusively the existing GitHub-connected PR #6 Deploy Preview after pushing this branch; no CLI, manual deploy, authentication or production deployment. PR remains draft and unmerged.

Real-device acceptance still required: confirm 750 ms is sufficient at the owner’s VoiceOver speech rate for East-to-human play and West-order-up-to-human-discard; verify actual swipe order, glyph silence/full labels, last-trick availability and repeated reviews during automatic narration. DOM and controlled-clock tests cannot certify Safari/VoiceOver announcement completion. Test sound off/on without timing changes.
