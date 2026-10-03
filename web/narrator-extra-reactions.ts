import type { NarrationAlternative } from './narration-types.ts';
import type { ReactionTrigger } from './narrator-reaction-triggers.ts';
/** Editorially approved, mechanically verified complete recordings only. */
export const extraReactionLines: Readonly<Record<string, NarrationAlternative & { readonly trigger: ReactionTrigger }>> = {
  "reaction.you.follow-suit.complain": {
    "clip": "reaction.you.follow-suit.complain",
    "text": "Same suit. Fine. Happy now, stupid rule?",
    "family": "rule-resistance",
    "context": "you",
    "priority": 1,
    "trigger": "reaction.you.follow-suit"
  },
  "reaction.you.bower.special-rules": {
    "clip": "reaction.you.bower.special-rules",
    "text": "Oh, he gets special rules? Screw that. I'm a jack now.",
    "family": "self-declared-exception",
    "context": "you",
    "priority": 2,
    "trigger": "reaction.you.bower"
  },
  "reaction.you.follow-suit.applause": {
    "clip": "reaction.you.follow-suit.applause",
    "text": "Nobody's gonna clap for doin' it right? Tough room.",
    "family": "accidental-adult",
    "context": "you",
    "priority": 1,
    "trigger": "reaction.you.follow-suit"
  },
  "reaction.you.follow-suit.looks-easy": {
    "clip": "reaction.you.follow-suit.looks-easy",
    "text": "Hey, quit makin' this look easy. Somebody's gonna ask me to do it.",
    "family": "effort-avoidance",
    "context": "you",
    "priority": 1,
    "trigger": "reaction.you.follow-suit"
  },
  "reaction.you.trump.doing-this": {
    "clip": "reaction.you.trump.doing-this",
    "text": "Oh, we're doin' this now? Hell yeah.",
    "family": "impulsive-approval",
    "context": "you",
    "priority": 1,
    "trigger": "reaction.you.trump"
  },
  "reaction.you.trump.standing": {
    "clip": "reaction.you.trump.standing",
    "text": "Oh-ho! Yeah! Aw, crap, I stood up too fast.",
    "family": "physical-celebration",
    "context": "you",
    "priority": 1,
    "trigger": "reaction.you.trump"
  },
  "reaction.you.trump.give-a-crap": {
    "clip": "reaction.you.trump.give-a-crap",
    "text": "Ooh. Okay. Now I give a crap.",
    "family": "wandering-attention",
    "context": "you",
    "priority": 1,
    "trigger": "reaction.you.trump"
  },
  "reaction.you.trick.not-you-val": {
    "clip": "reaction.you.trick.not-you-val",
    "text": "Ha! Suck it! Not you, Val. You're doin' great.",
    "family": "misdirected-taunt",
    "context": "you",
    "priority": 2,
    "trigger": "reaction.you.trick"
  },
  "reaction.you.trick.our-cards": {
    "clip": "reaction.you.trick.our-cards",
    "text": "Ha! Those are our cards now. Go get your own damn cards.",
    "family": "territorial-gloating",
    "context": "you",
    "priority": 2,
    "trigger": "reaction.you.trick"
  },
  "reaction.you.trick.called-it": {
    "clip": "reaction.you.trick.called-it",
    "text": "Yeah! Val, tell 'em I called that. C'mon, be cool.",
    "family": "undeserved-credit",
    "context": "you",
    "priority": 2,
    "trigger": "reaction.you.trick"
  },
  "reaction.opponent.trick.pissed": {
    "clip": "reaction.opponent.trick.pissed",
    "text": "That’s bullshit!",
    "family": "sore-loser-protest",
    "context": "opponent",
    "priority": 2,
    "trigger": "reaction.opponent.trick"
  },
  "reaction.opponent.trick.teacher": {
    "clip": "reaction.opponent.trick.teacher",
    "text": "Who taught you this crap? I wanna be mad at them, too.",
    "family": "anger-by-association",
    "context": "opponent",
    "priority": 2,
    "trigger": "reaction.opponent.trick"
  },
  "reaction.opponent.trick.grudge": {
    "clip": "reaction.opponent.trick.grudge",
    "text": "Fine. Take 'em. You're dead to me till we win somethin'.",
    "family": "conditional-grudge",
    "context": "opponent",
    "priority": 2,
    "trigger": "reaction.opponent.trick"
  },
  "reaction.opponent.trick.boner": {
    "clip": "reaction.opponent.trick.boner",
    "text": "All right, all right. Don't get a boner about it.",
    "family": "resentful-dismissal",
    "context": "opponent",
    "priority": 2,
    "trigger": "reaction.opponent.trick"
  },
  "reaction.opponent.trick.knock-it-off": {
    "clip": "reaction.opponent.trick.knock-it-off",
    "text": "Okay, that was pretty damn good. Knock it off.",
    "family": "reluctant-applause",
    "context": "opponent",
    "priority": 2,
    "trigger": "reaction.opponent.trick"
  },
  "reaction.opponent.ace-lead.relax": {
    "clip": "reaction.opponent.ace-lead.relax",
    "text": "Oh, sure, an ace. God forbid I relax for one lousy second.",
    "family": "relaxation-denied",
    "context": "opponent",
    "priority": 1,
    "trigger": "reaction.opponent.ace-lead"
  },
  "reaction.opponent.ace-lead.middle-finger": {
    "clip": "reaction.opponent.ace-lead.middle-finger",
    "text": "Oh, an ace? Well, I got a middle finger.",
    "family": "impotent-retaliation",
    "context": "opponent",
    "priority": 1,
    "trigger": "reaction.opponent.ace-lead"
  },
  "reaction.opponent.right-bower.saw-it": {
    "clip": "reaction.opponent.right-bower.saw-it",
    "text": "Aw, son of a bitch. Yeah, yeah, we all saw it.",
    "family": "resentful-dismissal",
    "context": "opponent",
    "priority": 2,
    "trigger": "reaction.opponent.right-bower"
  },
  "reaction.val.follow-suit.victimhood": {
    "clip": "reaction.val.follow-suit.victimhood",
    "text": "Goddammit, Val. You're ruinin' my whole 'nobody helps me' thing.",
    "family": "spoiled-victimhood",
    "context": "val",
    "priority": 1,
    "trigger": "reaction.val.follow-suit"
  },
  "reaction.val.follow-suit.exhausting": {
    "clip": "reaction.val.follow-suit.exhausting",
    "text": "Val, quit doin' stuff. You're makin' my sittin' here look bad.",
    "family": "effort-avoidance",
    "context": "val",
    "priority": 1,
    "trigger": "reaction.val.follow-suit"
  },
  "reaction.val.follow-suit.start-something": {
    "clip": "reaction.val.follow-suit.start-something",
    "text": "Val, stop bein' reasonable. I'm tryin' to start somethin'.",
    "family": "unused-tantrum",
    "context": "val",
    "priority": 1,
    "trigger": "reaction.val.follow-suit"
  },
  "reaction.val.trick.beautiful-bastard": {
    "clip": "reaction.val.trick.beautiful-bastard",
    "text": "Yeah, Val! Carry us, you beautiful bastard.",
    "family": "unfiltered-gratitude",
    "context": "val",
    "priority": 2,
    "trigger": "reaction.val.trick"
  },
  "reaction.val.trick.beer": {
    "clip": "reaction.val.trick.beer",
    "text": "Val, I owe you a beer.",
    "family": "unfiltered-gratitude",
    "context": "val",
    "priority": 2,
    "trigger": "reaction.val.trick"
  },
  "reaction.you-team-sweep.badass": {
    "clip": "reaction.you-team-sweep.badass",
    "text": "That was frickin’ badass!",
    "family": "sweep-celebration",
    "context": "table",
    "priority": 3,
    "trigger": "you-team-sweep"
  },
  "reaction.you.alone.behind-you": {
    "clip": "reaction.you.alone.behind-you",
    "text": "Just you? I'll be right behind you. They gotta get through you first.",
    "family": "cowardly-support",
    "context": "you",
    "priority": 2,
    "trigger": "reaction.you.alone"
  },
  "reaction.opponent.right-bower.eat-it": {
    "clip": "reaction.opponent.right-bower.eat-it",
    "text": "Aw, the big jack. Can I eat it? I'm serious.",
    "family": "eat-the-obstacle",
    "context": "opponent",
    "priority": 2,
    "trigger": "reaction.opponent.right-bower"
  },
  "reaction.you.low-lead.little-guy": {
    "clip": "reaction.you.low-lead.little-guy",
    "text": "Aw, little guy. Come here. No, don't actually come here. That would scare the shit outta me.",
    "family": "startled-personification",
    "context": "you",
    "priority": 1,
    "trigger": "reaction.you.low-lead"
  },
  "reaction.opponent.trick.nice-words": {
    "clip": "reaction.opponent.trick.nice-words",
    "text": "Good. Great. Fantastic. There. You used up all my nice words, you greedy prick.",
    "family": "finite-courtesy",
    "context": "opponent",
    "priority": 2,
    "trigger": "reaction.opponent.trick"
  },
  "reaction.you-team-sweep.sorry-kids": {
    "clip": "reaction.you-team-sweep.sorry-kids",
    "text": "This is the best day of my life. Sorry, kids.",
    "family": "distorted-priorities",
    "context": "table",
    "priority": 3,
    "trigger": "you-team-sweep"
  },
  "reaction.val.follow-suit.probation": {
    "clip": "reaction.val.follow-suit.probation",
    "text": "Val, you're all right. Everybody else is on probation. I don't know for what yet, but I'm workin' on it.",
    "family": "arbitrary-probation",
    "context": "val",
    "priority": 1,
    "trigger": "reaction.val.follow-suit"
  },
  "reaction.val.follow-suit.finish-it": {
    "clip": "reaction.val.follow-suit.finish-it",
    "text": "Val, I know I don't say this enough, but... yeah. You know. Don't make me finish it.",
    "family": "withheld-affection",
    "context": "val",
    "priority": 1,
    "trigger": "reaction.val.follow-suit"
  },
  "reaction.val.trick.kiss-you": {
    "clip": "reaction.val.trick.kiss-you",
    "text": "Val, I could kiss you.",
    "family": "unfiltered-gratitude",
    "context": "val",
    "priority": 2,
    "trigger": "reaction.val.trick"
  },
  "reaction.you.trump.furniture": {
    "clip": "reaction.you.trump.furniture",
    "text": "Oh-ho-ho! My pants are still on, but only because I respect the furniture.",
    "family": "misplaced-decency",
    "context": "you",
    "priority": 1,
    "trigger": "reaction.you.trump"
  },
  "reaction.you.trump.pain-in-the-ass": {
    "clip": "reaction.you.trump.pain-in-the-ass",
    "text": "Ha! Look at that card bein' a pain in everybody's ass.",
    "family": "admiring-obnoxiousness",
    "context": "you",
    "priority": 1,
    "trigger": "reaction.you.trump"
  },
  "reaction.you.trump.high-five": {
    "clip": "reaction.you.trump.high-five",
    "text": "Oh, hell yeah! I'd high-five you, but I'd hit way too hard.",
    "family": "overpowered-affection",
    "context": "you",
    "priority": 1,
    "trigger": "reaction.you.trump"
  },
  "reaction.you.follow-suit.vote": {
    "clip": "reaction.you.follow-suit.vote",
    "text": "Same suit. Can we vote on that? I can yell way louder than those other assholes.",
    "family": "loudness-as-authority",
    "context": "you",
    "priority": 1,
    "trigger": "reaction.you.follow-suit"
  },
  "reaction.you.trick.humble": {
    "clip": "reaction.you.trick.humble",
    "text": "Ha! Don't be humble. Humble's what losers call bein' quiet.",
    "family": "contempt-for-humility",
    "context": "you",
    "priority": 2,
    "trigger": "reaction.you.trick"
  },
  "reaction.you.queen.card": {
    "clip": "reaction.you.queen.card",
    "text": "Easy, Peter. It's a card. It's a card.",
    "family": "card-crush",
    "context": "you",
    "priority": 1,
    "trigger": "reaction.you.queen"
  },
  "reaction.you.trick.other-argument": {
    "clip": "reaction.you.trick.other-argument",
    "text": "Yeah! And that's why I get to be right about the other thing.",
    "family": "irrelevant-vindication",
    "context": "you",
    "priority": 2,
    "trigger": "reaction.you.trick"
  },
  "reaction.you.trick.noise-again": {
    "clip": "reaction.you.trick.noise-again",
    "text": "Yes! I'm gonna make that noise again. YEAH!",
    "family": "unrestrained-hype",
    "context": "you",
    "priority": 2,
    "trigger": "reaction.you.trick"
  },
  "reaction.opponent.trick.letting-it": {
    "clip": "reaction.opponent.trick.letting-it",
    "text": "Oh, okay. So we're just lettin' that happen now?",
    "family": "sore-loser-protest",
    "context": "opponent",
    "priority": 2,
    "trigger": "reaction.opponent.trick"
  },
  "reaction.opponent.trick.fine": {
    "clip": "reaction.opponent.trick.fine",
    "text": "Fine. I'm fine. I'M FINE.",
    "family": "failed-composure",
    "context": "opponent",
    "priority": 2,
    "trigger": "reaction.opponent.trick"
  },
  "reaction.val.trick.elsewhere": {
    "clip": "reaction.val.trick.elsewhere",
    "text": "That's our Val! The other two can go be impressive somewhere else.",
    "family": "selective-appreciation",
    "context": "val",
    "priority": 2,
    "trigger": "reaction.val.trick"
  },
  "reaction.val.follow-suit.help-me-move": {
    "clip": "reaction.val.follow-suit.help-me-move",
    "text": "Val, you matched. We're friends now. You gotta help me move.",
    "family": "manufactured-obligation",
    "context": "val",
    "priority": 1,
    "trigger": "reaction.val.follow-suit"
  },
  "reaction.opponent.follow-suit.own-idea": {
    "clip": "reaction.opponent.follow-suit.own-idea",
    "text": "Same suit? Get your own idea!",
    "family": "mocking-conformity",
    "context": "opponent",
    "priority": 1,
    "trigger": "reaction.opponent.follow-suit"
  },
  "reaction.opponent.follow-suit.respect": {
    "clip": "reaction.opponent.follow-suit.respect",
    "text": "Fine, that was legal. Doesn't mean I gotta respect you as a person.",
    "family": "compliance-double-standard",
    "context": "opponent",
    "priority": 1,
    "trigger": "reaction.opponent.follow-suit"
  },
  "reaction.opponent.low-lead.fight-it": {
    "clip": "reaction.opponent.low-lead.fight-it",
    "text": "That card? Yeah, I'd fight that one.",
    "family": "card-sized-courage",
    "context": "opponent",
    "priority": 1,
    "trigger": "reaction.opponent.low-lead"
  },
  "reaction.table.four-tricks.like-you": {
    "clip": "reaction.table.four-tricks.like-you",
    "text": "One more? Aw, crap. I was just startin' to like you people.",
    "family": "reluctant-attachment",
    "context": "table",
    "priority": 2,
    "trigger": "reaction.table.four-tricks"
  },
  "reaction.val.trump.make-it-fun": {
    "clip": "reaction.val.trump.make-it-fun",
    "text": "Yeah, Val. You make this shit fun.",
    "family": "unfiltered-gratitude",
    "context": "val",
    "priority": 1,
    "trigger": "reaction.val.trump"
  },
  "reaction.val.trump.kinda-hot": {
    "clip": "reaction.val.trump.kinda-hot",
    "text": "Val, why the hell was that kinda hot?",
    "family": "inappropriate-admiration",
    "context": "val",
    "priority": 1,
    "trigger": "reaction.val.trump"
  },
  "reaction.val.trump.your-fault": {
    "clip": "reaction.val.trump.your-fault",
    "text": "Eat shit, everybody! Val started it.",
    "family": "outsourced-blame",
    "context": "val",
    "priority": 1,
    "trigger": "reaction.val.trump"
  },
  "reaction.val.bower.less-of-a-dick": {
    "clip": "reaction.val.bower.less-of-a-dick",
    "text": "Val, you make me wanna be less of a dick.",
    "family": "reluctant-self-improvement",
    "context": "val",
    "priority": 2,
    "trigger": "reaction.val.bower"
  },
  "reaction.val.bower.trust-with-meg": {
    "clip": "reaction.val.bower.trust-with-meg",
    "text": "Val, I trust you with Meg. Work your way up.",
    "family": "distorted-priorities",
    "context": "val",
    "priority": 2,
    "trigger": "reaction.val.bower"
  },
  "reaction.table.left-bower.naked-problem": {
    "clip": "reaction.table.left-bower.naked-problem",
    "text": "He changes suits and he's a genius. I get naked and I'm the problem.",
    "family": "self-declared-exception",
    "context": "table",
    "priority": 2,
    "trigger": "reaction.table.left-bower"
  },
  "reaction.table.left-bower.double-life": {
    "clip": "reaction.table.left-bower.double-life",
    "text": "That jack's livin' a double life. I want in.",
    "family": "self-declared-exception",
    "context": "table",
    "priority": 2,
    "trigger": "reaction.table.left-bower"
  },
  "reaction.opponent.alone.sounds-like-lois": {
    "clip": "reaction.opponent.alone.sounds-like-lois",
    "text": "Fine, do it yourself. Christ, you sound like Lois.",
    "family": "solo-drama",
    "context": "opponent",
    "priority": 2,
    "trigger": "reaction.opponent.alone"
  },
  "reaction.opponent.alone.need-this": {
    "clip": "reaction.opponent.alone.need-this",
    "text": "Alone? Oh, please screw this up. I need this.",
    "family": "malicious-hope",
    "context": "opponent",
    "priority": 2,
    "trigger": "reaction.opponent.alone"
  },
  "reaction.table.turned-down.part-of-something": {
    "clip": "reaction.table.turned-down.part-of-something",
    "text": "All right. Screw that card. I wanna be part of somethin'.",
    "family": "herd-belonging",
    "context": "table",
    "priority": 1,
    "trigger": "reaction.table.turned-down"
  },
  "reaction.you.trick.be-obnoxious": {
    "clip": "reaction.you.trick.be-obnoxious",
    "text": "Yes! Be obnoxious. You earned it.",
    "family": "contempt-for-humility",
    "context": "you",
    "priority": 2,
    "trigger": "reaction.you.trick"
  },
  "reaction.val.trick.take-back-one": {
    "clip": "reaction.val.trick.take-back-one",
    "text": "Val, I take back one bad thing I said about you.",
    "family": "conditional-grudge",
    "context": "val",
    "priority": 2,
    "trigger": "reaction.val.trick"
  },
  "reaction.you.ace-lead.hello": {
    "clip": "reaction.you.ace-lead.hello",
    "text": "An ace! That's a hell of a way to say hello.",
    "family": "aggressive-greeting",
    "context": "you",
    "priority": 1,
    "trigger": "reaction.you.ace-lead"
  },
  "reaction.you.alone.fitted-sheet": {
    "clip": "reaction.you.alone.fitted-sheet",
    "text": "Alone? I tried that with a fitted sheet. Lois had to cut me out.",
    "family": "solo-drama",
    "context": "you",
    "priority": 2,
    "trigger": "reaction.you.alone"
  },
  "reaction.you.low-lead.with-us": {
    "clip": "reaction.you.low-lead.with-us",
    "text": "Hey, little card. You're with us, ya little shit.",
    "family": "ragtag-adoption",
    "context": "you",
    "priority": 1,
    "trigger": "reaction.you.low-lead"
  },
  "reaction.you.bower.nepotism": {
    "clip": "reaction.you.bower.nepotism",
    "text": "Ha! Nepotism finally works for us.",
    "family": "selective-fairness",
    "context": "you",
    "priority": 2,
    "trigger": "reaction.you.bower"
  },
  "reaction.you.bower.god-complex": {
    "clip": "reaction.you.bower.god-complex",
    "text": "Oh, that's a jack with a god complex. I love him.",
    "family": "admiring-obnoxiousness",
    "context": "you",
    "priority": 2,
    "trigger": "reaction.you.bower"
  },
  "reaction.you.trick.obituary": {
    "clip": "reaction.you.trick.obituary",
    "text": "Yes! Somebody put that in my obituary. Near the top.",
    "family": "distorted-priorities",
    "context": "you",
    "priority": 2,
    "trigger": "reaction.you.trick"
  },
  "reaction.you.trick.compliment": {
    "clip": "reaction.you.trick.compliment",
    "text": "Ha! Say something nice. I wanna hear it hurt.",
    "family": "malicious-praise",
    "context": "you",
    "priority": 2,
    "trigger": "reaction.you.trick"
  },
  "reaction.opponent.low-lead.adorable": {
    "clip": "reaction.opponent.low-lead.adorable",
    "text": "Oh, that's adorable. I can't even get mad at that little bastard.",
    "family": "disarmed-irritation",
    "context": "opponent",
    "priority": 1,
    "trigger": "reaction.opponent.low-lead"
  },
  "reaction.opponent.low-lead.not-a-narc": {
    "clip": "reaction.opponent.low-lead.not-a-narc",
    "text": "Aww, little guy. You can say 'shit' around me. I'm not a narc.",
    "family": "bad-influence",
    "context": "opponent",
    "priority": 1,
    "trigger": "reaction.opponent.low-lead"
  },
  "reaction.opponent.ace-lead.invented-it": {
    "clip": "reaction.opponent.ace-lead.invented-it",
    "text": "Oh, an ace. Don't act like you invented it.",
    "family": "main-character",
    "context": "opponent",
    "priority": 1,
    "trigger": "reaction.opponent.ace-lead"
  },
  "reaction.table.four-tricks.piss": {
    "clip": "reaction.table.four-tricks.piss",
    "text": "One more? Great. I gotta take a piss.",
    "family": "badly-timed-bathroom",
    "context": "table",
    "priority": 2,
    "trigger": "reaction.table.four-tricks"
  },
  "reaction.table.turned-down.spite": {
    "clip": "reaction.table.turned-down.spite",
    "text": "Everybody passed? Oh, screw you guys. I like that card.",
    "family": "contrarian-loyalty",
    "context": "table",
    "priority": 1,
    "trigger": "reaction.table.turned-down"
  },
  "reaction.you-team.euchred.already-smug": {
    "clip": "reaction.you-team.euchred.already-smug",
    "text": "Aw, crap. I was already bein' smug about that.",
    "family": "premature-celebration",
    "context": "table",
    "priority": 3,
    "trigger": "reaction.you-team.euchred"
  },
  "reaction.you-team.euchred.having-a-face": {
    "clip": "reaction.you-team.euchred.having-a-face",
    "text": "Nobody look at me. I hate havin' a face right now.",
    "family": "embarrassed-exposure",
    "context": "table",
    "priority": 3,
    "trigger": "reaction.you-team.euchred"
  },
  "reaction.you-team.euchred.vals-fault": {
    "clip": "reaction.you-team.euchred.vals-fault",
    "text": "Aw, crap. Val, gimme a second. I'm tryin' to remember why this is your fault.",
    "family": "outsourced-blame",
    "context": "table",
    "priority": 3,
    "trigger": "reaction.you-team.euchred"
  },
  "reaction.you-team.euchred.buyin-groceries": {
    "clip": "reaction.you-team.euchred.buyin-groceries",
    "text": "We got euchred? Val, if Lois asks, we were buyin' groceries.",
    "family": "domestic-cover-story",
    "context": "table",
    "priority": 3,
    "trigger": "reaction.you-team.euchred"
  },
  "reaction.you-team.euchres-opponents.like-rule": {
    "clip": "reaction.you-team.euchres-opponents.like-rule",
    "text": "Ha! I like this rule now!",
    "family": "selective-fairness",
    "context": "table",
    "priority": 3,
    "trigger": "reaction.you-team.euchres-opponents"
  },
  "reaction.you-team.euchres-opponents.you-guys-are-sweet": {
    "clip": "reaction.you-team.euchres-opponents.you-guys-are-sweet",
    "text": "You picked trump and we got the points? Aw, you guys are sweet.",
    "family": "accidental-benefactors",
    "context": "table",
    "priority": 3,
    "trigger": "reaction.you-team.euchres-opponents"
  },
  "reaction.you-team.euchres-opponents.beautiful-dumbasses": {
    "clip": "reaction.you-team.euchres-opponents.beautiful-dumbasses",
    "text": "You called it! You beautiful dumbasses!",
    "family": "malicious-praise",
    "context": "table",
    "priority": 3,
    "trigger": "reaction.you-team.euchres-opponents"
  },
  "reaction.you-team.euchres-opponents.get-comfortable": {
    "clip": "reaction.you-team.euchres-opponents.get-comfortable",
    "text": "Ha! Lemme get comfortable. I wanna enjoy you bein' wrong.",
    "family": "savoring-gloat",
    "context": "table",
    "priority": 3,
    "trigger": "reaction.you-team.euchres-opponents"
  },
  "reaction.val.alone.big-balls": {
    "clip": "reaction.val.alone.big-balls",
    "text": "All right, Val. Big balls. Keep 'em off the table.",
    "family": "misplaced-decency",
    "context": "val",
    "priority": 2,
    "trigger": "reaction.val.alone"
  },
  "reaction.val.alone.home-depot": {
    "clip": "reaction.val.alone.home-depot",
    "text": "Alone? Val, I won't even go to Home Depot without an adult.",
    "family": "solo-drama",
    "context": "val",
    "priority": 2,
    "trigger": "reaction.val.alone"
  },
  "reaction.val.alone.answer-my-calls": {
    "clip": "reaction.val.alone.answer-my-calls",
    "text": "Val, you better not get famous and stop answerin' my calls.",
    "family": "fear-of-abandonment",
    "context": "val",
    "priority": 2,
    "trigger": "reaction.val.alone"
  },
  "reaction.val.alone.shut-up": {
    "clip": "reaction.val.alone.shut-up",
    "text": "Alone? All right, Val. I'm gonna shut up for... okay, that was enough.",
    "family": "unrestrained-hype",
    "context": "val",
    "priority": 2,
    "trigger": "reaction.val.alone"
  },
  "reaction.you-team.game-win.everybody-like-me": {
    "clip": "reaction.you-team.game-win.everybody-like-me",
    "text": "We won! Now everybody has to like me!",
    "family": "manufactured-obligation",
    "context": "table",
    "priority": 3,
    "eventPreference": "game-result",
    "trigger": "reaction.you-team.game-win"
  },
  "reaction.you-team.game-win.buyin-a-cape": {
    "clip": "reaction.you-team.game-win.buyin-a-cape",
    "text": "We won! I'm buyin' a cape.",
    "family": "main-character",
    "context": "table",
    "priority": 3,
    "eventPreference": "game-result",
    "trigger": "reaction.you-team.game-win"
  },
  "reaction.you-team.game-win.family-dinner": {
    "clip": "reaction.you-team.game-win.family-dinner",
    "text": "Yes! I am gonna be such a dick at the next family dinner.",
    "family": "savoring-gloat",
    "context": "table",
    "priority": 3,
    "eventPreference": "game-result",
    "trigger": "reaction.you-team.game-win"
  },
  "reaction.you-team.game-win.brian-anyway": {
    "clip": "reaction.you-team.game-win.brian-anyway",
    "text": "We won! Ha! Suck it, Brian. You're not even here and you can suck it.",
    "family": "misdirected-taunt",
    "context": "table",
    "priority": 3,
    "eventPreference": "game-result",
    "trigger": "reaction.you-team.game-win"
  },
  "reaction.opponent.game-win.congratulations": {
    "clip": "reaction.opponent.game-win.congratulations",
    "text": "Well, congratulations, ya bunch of pricks.",
    "family": "reluctant-applause",
    "context": "opponent",
    "priority": 3,
    "eventPreference": "game-result",
    "trigger": "reaction.opponent.game-win"
  },
  "reaction.opponent.game-win.learned-nothing": {
    "clip": "reaction.opponent.game-win.learned-nothing",
    "text": "Well, I learned nothin', and I'm still mad.",
    "family": "rejected-growth",
    "context": "opponent",
    "priority": 3,
    "eventPreference": "game-result",
    "trigger": "reaction.opponent.game-win"
  },
  "reaction.opponent.game-win.takin-somethin": {
    "clip": "reaction.opponent.game-win.takin-somethin",
    "text": "Fine. You win. I'm takin' my ball. I don't have a ball. I'm takin' somethin'.",
    "family": "impotent-retaliation",
    "context": "opponent",
    "priority": 3,
    "eventPreference": "game-result",
    "trigger": "reaction.opponent.game-win"
  },
  "reaction.opponent.game-win.bitch-in-car": {
    "clip": "reaction.opponent.game-win.bitch-in-car",
    "text": "They won? Oh, I am gonna be such a bitch in the car.",
    "family": "cope-with-loss",
    "context": "opponent",
    "priority": 3,
    "eventPreference": "game-result",
    "trigger": "reaction.opponent.game-win"
  },
  "reaction.you-team-sweep.we-are-assholes": {
    "clip": "reaction.you-team-sweep.we-are-assholes",
    "text": "Five outta five. Holy crap, we're assholes!",
    "family": "admiring-obnoxiousness",
    "context": "table",
    "priority": 3,
    "trigger": "you-team-sweep"
  },
  "reaction.you-team-sweep.cigarette": {
    "clip": "reaction.you-team-sweep.cigarette",
    "text": "All five! Oh, I need a cigarette.",
    "family": "inappropriate-admiration",
    "context": "table",
    "priority": 3,
    "trigger": "you-team-sweep"
  },
  "reaction.you-team-sweep.sympathy-trick": {
    "clip": "reaction.you-team-sweep.sympathy-trick",
    "text": "All five! Goddamn, you didn't even leave 'em a sympathy trick.",
    "family": "admiring-obnoxiousness",
    "context": "table",
    "priority": 3,
    "trigger": "you-team-sweep"
  },
  "reaction.you-team-sweep.self-high-five": {
    "clip": "reaction.you-team-sweep.self-high-five",
    "text": "A clean sweep! I just tried to high-five my other hand. It sucked.",
    "family": "physical-celebration",
    "context": "table",
    "priority": 3,
    "trigger": "you-team-sweep"
  },
  "reaction.you.alone.slow-clap": {
    "clip": "reaction.you.alone.slow-clap",
    "text": "Just you? Oh, man. I know how to do the slow clap, but I don't know when.",
    "family": "misapplied-ceremony",
    "context": "you",
    "priority": 2,
    "trigger": "reaction.you.alone"
  },
  "reaction.you.alone.entire-ham": {
    "clip": "reaction.you.alone.entire-ham",
    "text": "Alone? I tried eatin' an entire ham alone. Woke up with a priest next to me.",
    "family": "solo-drama",
    "context": "you",
    "priority": 2,
    "trigger": "reaction.you.alone"
  },
  "reaction.you.alone.my-moment": {
    "clip": "reaction.you.alone.my-moment",
    "text": "All right. This is your moment. Mine involves a sandwich, but yours looks good too.",
    "family": "distorted-priorities",
    "context": "you",
    "priority": 2,
    "trigger": "reaction.you.alone"
  },
  "reaction.opponent.alone.little-sash": {
    "clip": "reaction.opponent.alone.little-sash",
    "text": "Alone? Do you get a little sash, or are you a pain in the ass for free?",
    "family": "main-character",
    "context": "opponent",
    "priority": 2,
    "trigger": "reaction.opponent.alone"
  },
  "reaction.opponent.alone.still-boo": {
    "clip": "reaction.opponent.alone.still-boo",
    "text": "You're goin' alone? Okay. I'm gonna practice bein' supportive. Boo. Nope. Still boo.",
    "family": "finite-courtesy",
    "context": "opponent",
    "priority": 2,
    "trigger": "reaction.opponent.alone"
  },
  "reaction.opponent.alone.your-movie": {
    "clip": "reaction.opponent.alone.your-movie",
    "text": "Alone? Oh, this is your movie now? Fine. I'm talkin' through it.",
    "family": "main-character",
    "context": "opponent",
    "priority": 2,
    "trigger": "reaction.opponent.alone"
  },
  "reaction.you.low-lead.kings-are-weird": {
    "clip": "reaction.you.low-lead.kings-are-weird",
    "text": "Okay, little card. Don't make eye contact with the kings. They're weird about that.",
    "family": "ragtag-adoption",
    "context": "you",
    "priority": 1,
    "trigger": "reaction.you.low-lead"
  },
  "reaction.you.low-lead.explain-to-dog": {
    "clip": "reaction.you.low-lead.explain-to-dog",
    "text": "Low card. Ah, finally, somethin' I can explain to a dog.",
    "family": "accidental-adult",
    "context": "you",
    "priority": 1,
    "trigger": "reaction.you.low-lead"
  },
  "reaction.opponent.low-lead.put-air-back": {
    "clip": "reaction.opponent.low-lead.put-air-back",
    "text": "A low card? I was all ready to gasp. Now I gotta put the air back.",
    "family": "unused-tantrum",
    "context": "opponent",
    "priority": 1,
    "trigger": "reaction.opponent.low-lead"
  },
  "reaction.opponent.low-lead.erection": {
    "clip": "reaction.opponent.low-lead.erection",
    "text": "Well, that took the erection right outta the room.",
    "family": "inappropriate-admiration",
    "context": "opponent",
    "priority": 1,
    "trigger": "reaction.opponent.low-lead"
  },
  "reaction.you.ace-lead.revolving-door": {
    "clip": "reaction.you.ace-lead.revolving-door",
    "text": "An ace! I like an entrance. I got stuck in a revolving door once and still took a bow.",
    "family": "main-character",
    "context": "you",
    "priority": 1,
    "trigger": "reaction.you.ace-lead"
  },
  "reaction.you.ace-lead.cocky": {
    "clip": "reaction.you.ace-lead.cocky",
    "text": "An ace. Oh, you cocky son of a bitch. I love it.",
    "family": "admiring-obnoxiousness",
    "context": "you",
    "priority": 1,
    "trigger": "reaction.you.ace-lead"
  },
  "reaction.opponent.ace-lead.uncle-trampoline": {
    "clip": "reaction.opponent.ace-lead.uncle-trampoline",
    "text": "An ace? Yeah, well, my uncle owns a trampoline.",
    "family": "irrelevant-vindication",
    "context": "opponent",
    "priority": 1,
    "trigger": "reaction.opponent.ace-lead"
  },
  "reaction.opponent.ace-lead.chewin-ice": {
    "clip": "reaction.opponent.ace-lead.chewin-ice",
    "text": "Oh, an ace. Fine. I'm chewin' my ice right in your ear.",
    "family": "impotent-retaliation",
    "context": "opponent",
    "priority": 1,
    "trigger": "reaction.opponent.ace-lead"
  },
  "reaction.table.four-tricks.clench": {
    "clip": "reaction.table.four-tricks.clench",
    "text": "One more. Everybody clench.",
    "family": "physical-celebration",
    "context": "table",
    "priority": 2,
    "trigger": "reaction.table.four-tricks"
  },
  "reaction.table.four-tricks.peanut-bowl": {
    "clip": "reaction.table.four-tricks.peanut-bowl",
    "text": "One trick left. I should've rationed my peanuts. I ate the bowl.",
    "family": "eat-the-obstacle",
    "context": "table",
    "priority": 2,
    "trigger": "reaction.table.four-tricks"
  },
  "reaction.table.four-tricks.pants-hang-in": {
    "clip": "reaction.table.four-tricks.pants-hang-in",
    "text": "One more trick. All right, pants, hang in there.",
    "family": "physical-celebration",
    "context": "table",
    "priority": 2,
    "trigger": "reaction.table.four-tricks"
  },
  "reaction.table.four-tricks.stop-blinkin": {
    "clip": "reaction.table.four-tricks.stop-blinkin",
    "text": "One trick left. This is the part where I stop blinkin' and everybody gets uncomfortable.",
    "family": "unrestrained-hype",
    "context": "table",
    "priority": 2,
    "trigger": "reaction.table.four-tricks"
  },
  "reaction.table.turned-down.my-stuff": {
    "clip": "reaction.table.turned-down.my-stuff",
    "text": "Nobody wants that card? I got a drawer full of crap nobody wants. It's called my stuff.",
    "family": "ragtag-adoption",
    "context": "table",
    "priority": 1,
    "trigger": "reaction.table.turned-down"
  },
  "reaction.table.turned-down.ask-your-mother": {
    "clip": "reaction.table.turned-down.ask-your-mother",
    "text": "Four passes. Look at us. A whole room full of 'ask your mother.'",
    "family": "collective-buck-passing",
    "context": "table",
    "priority": 1,
    "trigger": "reaction.table.turned-down"
  },
  "reaction.table.turned-down.one-bad-decision": {
    "clip": "reaction.table.turned-down.one-bad-decision",
    "text": "Everybody passed? Come on. This table needs one bad decision we can all get behind.",
    "family": "contrarian-loyalty",
    "context": "table",
    "priority": 1,
    "trigger": "reaction.table.turned-down"
  },
  "reaction.table.turned-down.speed-date": {
    "clip": "reaction.table.turned-down.speed-date",
    "text": "Nobody wants it? Oh, that is a rough speed date.",
    "family": "rejected-romance",
    "context": "table",
    "priority": 1,
    "trigger": "reaction.table.turned-down"
  },
  "reaction.you.queen.pardon-me": {
    "clip": "reaction.you.queen.pardon-me",
    "text": "Your Majesty. Quick question. Can you pardon me for somethin' I haven't done yet?",
    "family": "premeditated-absolution",
    "context": "you",
    "priority": 1,
    "trigger": "reaction.you.queen"
  },
  "reaction.you.queen.just-announcin": {
    "clip": "reaction.you.queen.just-announcin",
    "text": "A queen. Lois, I'm just announcin' the card. Jesus.",
    "family": "domestic-cover-story",
    "context": "you",
    "priority": 1,
    "trigger": "reaction.you.queen"
  }
};
