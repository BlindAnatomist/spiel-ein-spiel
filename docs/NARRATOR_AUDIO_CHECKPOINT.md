# Narrator and audio checkpoint — draft, owner acceptance required

Base: `4fb2d0c076afdab50fb324edc8dec78fcdff68c0`.
Branch: `feat/euchre-narrator-and-audio`.
Do not merge until the owner accepts this build on iPhone with VoiceOver. PR #4 is unrelated and untouched.

## Implementation

`web/announcer.ts` owns the single serialized writer to the existing polite ARIA live region. The controller queues automatic messages and on-demand summaries through this writer, retaining the baseline speech budget and bot pacing. Pending reviews are coalesced; their public snapshot is computed when spoken. Legal human actions interrupt on-demand speech without waiting for its timer. Game restart cancels the old writer. Browser speech synthesis, external voices, network audio and a second live region are not used.

Automatic public events: dealer once per hand; up-card once per hand; opponent/Val pass, order-up, call and alone declaration; dealer pickup; generic nonhuman discard without identity; turned-down up-card; nonhuman opening lead or following play; trick winner. Human action labels already provide the selected bid/card, so those are not repeated in the live region. Hand/game results retain their baseline focused-result delivery.

Repeat current state gives dealer; up-card status and calling round during bidding; called suit/caller, loner status, trick totals, current leader/card and whose turn during play; pending discard or results where applicable. It never reads the human hand or legal actions. Review last trick reads only the latest completed trick, in actual play order, with winner and existing bower explanations. Its button is absent from accessibility navigation until a trick completes, and resets for a new hand. Neither review changes state, hand order or focus bookkeeping, and completed cards never repopulate Current Trick.

Sound Cues is an `aria-pressed` button, off on page load and retained across New Game in that page only. Enabling it initializes/resumes Web Audio on the explicit gesture. Sine tones last 55 ms (card) or 140 ms (other results), with an 0.035 peak gain and short envelope. Card, trick, hand win/loss and game win/loss use simple frequencies; simultaneous events coalesce to the highest result. Disabling stops active tones. Unavailable/suspended audio fails silently without changing game behavior. No assets or requests are needed.

## Protection and verification

Engine, bots, session, randomness, rules, scoring, hand rendering/order and focus algorithm are unchanged. Rendering adds only two review controls and their availability. Narration accepts the same public seat-zero view boundary as the baseline. The accepted first-legal-card algorithm and illegal-card reachability are retained.

Commands: `npm ci --ignore-scripts`, `npm run check`, `npm run build`.
101 tests pass: all 87 baseline tests plus 14 focused regressions. The existing once-per-hand dealer test now also asserts the requested up-card announcement; no assertion was removed or weakened. New regressions cover one writer and bounded reviews, bid/pickup/turned-down messages, lead versus follow and human suppression, phase summaries, last-trick order and winner, focus/hand/current-trick preservation, interruption and serialization, privacy across complete games at all three difficulty levels, cue selection, disabled/unavailable audio, and identical full-game state/focus/transcripts with cues enabled or disabled. Existing reproducibility and hidden-information tests remain green.

## Real-device acceptance

DOM tests do not establish iPhone VoiceOver speech timing, interruption, focus or audio mixing. The existing heuristic speech duration cannot detect when VoiceOver actually finishes speaking. Review requests during automatic narration intentionally share its queue. Audio availability depends on browser/device state; all information remains available without it. The owner must test narration clarity and duplication, both review controls, cue levels, first-legal-card focus, full-hand review and overall pacing before merge.

## Later checkpoints — record only

2. Human and bot performance tracking, including East versus West calling frequency.
3. Multiple personalities within difficulty levels, including conservative, assertive, partnership-oriented, card-conserving and aggressive-loner candidates.
Neither is implemented here.
