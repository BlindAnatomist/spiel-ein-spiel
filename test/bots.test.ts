import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import ts from 'typescript';
import { createBot, STRATEGIES } from '../src/bots/index.ts';
import type { BotLevel } from '../src/bots/index.ts';
import { handValue } from '../src/bots/evaluate.ts';
import { sampleWorld } from '../src/bots/sample.ts';
import { randomFrom } from '../src/bots/random.ts';
import { deck, effectiveSuit, partnerOf, teamOf, SUITS } from '../src/cards.ts';
import { initialState } from '../src/internal/deal.ts';
import { legalActions } from '../src/internal/legal.ts';
import { playerView } from '../src/internal/view.ts';
import { createReferee } from '../src/referee.ts';
import { runMatch, simulate, compare, pairInterval, simulationSeed, summarize } from '../src/simulation/index.ts';
import type { Lineup } from '../src/simulation/index.ts';
import type { Action, Card, DecisionPolicy, PlayerView, Seat } from '../src/types.ts';
import { apply, passRound, playing, seats } from './helpers.ts';
const levels: BotLevel[] = ['casual', 'strong', 'expert', 'val'];

test('all policies choose engine-legal actions and complete mixed full matches with only one seat view', () => {
  const seen = new Set<string>();
  for (let rotation = 0; rotation < 4; rotation++) {
    const lineup = levels.map((_, i) => levels[(i + rotation) % 4]!) as unknown as Lineup;
    const policies = lineup.map(level => {
      const bot = createBot(level);
      return function (...args: [PlayerView]): Action {
        assert.equal(args.length, 1);
        const view = args[0];
        for (const forbidden of ['hands', 'kitty', 'rng', 'seed', 'snapshot', 'discard', 'state']) assert.ok(!(forbidden in view));
        assert.ok(Object.isFrozen(view)); seen.add(`${level}:${view.phase}`);
        const action = bot(view);
        assert.ok(view.legalActions.some(a => JSON.stringify(a) === JSON.stringify(action)));
        return action;
      };
    });
    const result = runMatch({ seed: simulationSeed(42, rotation), levels: lineup, dealer: rotation as Seat }, policies);
    assert.ok(result.score[result.winner] >= 10); assert.ok(result.hands.length > 0);
  }
  for (const level of levels) {
    assert.ok(seen.has(`${level}:bidding`)); assert.ok(seen.has(`${level}:playing`));
  }
});
test('bot dependency graph reaches only player types, public card/trick rules and strategy modules', () => {
  const root = resolve('src'); const visited = new Set<string>();
  const permitted = new Set(['types.ts', 'cards.ts', 'rules.ts', 'internal/tricks.ts', 'internal/scoring.ts'].map(f => resolve(root, f)));
  function visit(path: string): void {
    if (visited.has(path)) return; visited.add(path);
    assert.ok(path.startsWith(resolve(root, 'bots') + '/') || permitted.has(path), `Forbidden bot dependency ${path}`);
    const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true);
    function scan(node: ts.Node): void {
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
        assert.ok(ts.isStringLiteral(node.moduleSpecifier));
        const specifier = node.moduleSpecifier.text;
        assert.ok(specifier.startsWith('.'), 'No platform or privileged package imports in policies');
        visit(resolve(dirname(path), specifier));
      }
      if (ts.isCallExpression(node)) {
        assert.notEqual(node.expression.kind, ts.SyntaxKind.ImportKeyword);
        assert.notEqual(node.expression.getText(source), 'require');
      }
      ts.forEachChild(node, scan);
    }
    scan(source);
  }
  for (const file of readdirSync(resolve(root, 'bots'))) if (file.endsWith('.ts')) visit(resolve(root, 'bots', file));
  assert.ok(!readFileSync('src/simulation/index.ts', 'utf8').includes('.snapshot('));
});
test('hidden-state permutations do not affect any bot decision, including Expert samples', () => {
  let state = passRound(initialState(11));
  state = apply(state, { type: 'call', suit: SUITS.find(s => !state.upCard.startsWith(s))!, alone: false });
  for (let step = 0; step < 10; step++) {
    const seat = state.turn!; const changed = structuredClone(state);
    const other = ((seat + 1) % 4) as Seat;
    if (changed.hands[other]!.length) [changed.hands[other]![0], changed.kitty[1]] = [changed.kitty[1]!, changed.hands[other]![0]!];
    changed.rng ^= 12345;
    const a = playerView(state, seat); const b = playerView(changed, seat);
    assert.deepEqual(a, b);
    for (const level of levels) assert.deepEqual(createBot(level)(a), createBot(level)(b));
    state = apply(state, legalActions(state, seat)[0]!);
  }
});
test('dealer discard retains both bowers and trump, Strong/Val prefer creating a side-suit void', () => {
  const state = apply(initialState(42), { type: 'order-up', alone: false });
  state.trump = 'hearts'; state.hands[0] = ['hearts:J', 'diamonds:J', 'hearts:A', 'clubs:9', 'spades:9', 'spades:K'];
  for (const level of levels) {
    const action = createBot(level)(playerView(state, 0));
    assert.equal(action.type, 'discard');
    if (action.type === 'discard') assert.equal(action.card, 'clubs:9');
  }
});
test('all policies comply with stick-the-dealer and choose best available legal suit', () => {
  let state = passRound();
  for (let i = 0; i < 3; i++) state = apply(state, { type: 'pass' });
  for (const level of levels) {
    const view = playerView(state, state.dealer); const action = createBot(level)(view);
    assert.equal(action.type, 'call'); assert.ok(view.legalActions.includes(action));
  }
});
test('all tiers evaluate left bower as trump and follow effective suit in both directions', () => {
  for (const level of levels) for (const trump of SUITS) {
    const left = deck().find(c => effectiveSuit(c, trump) === trump && !c.startsWith(trump))!;
    assert.ok(handValue([left], trump, STRATEGIES[level]) > handValue([`${trump}:A`], trump, STRATEGIES[level]));
    const printed = left.split(':')[0]; const side: Card = `${printed}:A` as Card;
    const state = playing([left, side], `${trump}:9`, trump);
    assert.deepEqual(createBot(level)(playerView(state, 1)), { type: 'play', card: left });
    state.trick = [{ seat: 0, card: `${printed}:9` as Card }];
    assert.deepEqual(createBot(level)(playerView(state, 1)), { type: 'play', card: side });
  }
});
test('partnership is seats 0/2 and 1/3; every tier saves a winning trump behind partner in last position', () => {
  for (const seat of seats) for (const level of levels) {
    const state = playing(['hearts:J', 'clubs:9'], 'clubs:10', 'hearts');
    state.turn = seat; state.hands[seat] = ['hearts:J', 'clubs:9'];
    // Void in spades; partner has already trumped. Right bower would overtake needlessly.
    state.trick = [{ seat: ((seat + 1) % 4) as Seat, card: 'spades:A' }, { seat: partnerOf(seat), card: 'hearts:A' }, { seat: ((seat + 3) % 4) as Seat, card: 'spades:K' }];
    state.caller = seat;
    assert.equal(teamOf(partnerOf(seat)), teamOf(seat));
    assert.deepEqual(createBot(level)(playerView(state, seat)), { type: 'play', card: 'clubs:9' });
  }
});
test('known opponent void changes Strong and Val opening lead using public evidence', () => {
  const state = playing(['clubs:A', 'diamonds:A', 'hearts:9', 'spades:9', 'spades:10'], 'clubs:9', 'hearts');
  state.turn = 1; state.trick = []; state.caller = 0;
  const base = playerView(state, 1);
  const changed: PlayerView = { ...base, knownVoids: [['clubs'], [], [], []] };
  for (const level of ['strong', 'val'] as const) {
    assert.deepEqual(createBot(level)(base), { type: 'play', card: 'clubs:A' });
    assert.deepEqual(createBot(level)(changed), { type: 'play', card: 'diamonds:A' });
  }
});
test('Expert samples obey public card counts, effective-suit voids, upcard location and uniqueness', () => {
  let state = passRound(initialState(53));
  state = apply(state, { type: 'call', suit: SUITS.find(s => !state.upCard.startsWith(s))!, alone: true });
  for (let i = 0; i < 5; i++) state = apply(state, legalActions(state, state.turn!)[0]!);
  const view = playerView(state, state.turn!); const random = randomFrom(5);
  for (let i = 0; i < 30; i++) {
    const world = sampleWorld(view, random); assert.ok(world);
    assert.deepEqual(world.hands[view.seat], view.hand);
    assert.ok(world.buried.includes(view.upCard)); assert.equal(world.buried.length, 4);
    const played = [...view.completedTricks.flatMap(t => t.plays), ...view.trick];
    assert.deepEqual([...world.hands.flat(), ...world.buried, ...played.map(p => p.card)].sort(), deck().sort());
    for (const seat of seats) {
      assert.equal(world.hands[seat]!.length, 5 - played.filter(p => p.seat === seat).length);
      for (const card of world.hands[seat]!) assert.ok(!view.knownVoids[seat]!.includes(effectiveSuit(card, view.trump!)));
    }
  }
  const impossible: PlayerView = { ...view, knownVoids: [SUITS, SUITS, SUITS, SUITS] };
  assert.equal(sampleWorld(impossible, randomFrom(1)), null);
});
test('ordered upcard hypotheses never put it in an unrelated seat', () => {
  let state = apply(initialState(42), { type: 'order-up', alone: false });
  state = apply(state, { type: 'discard', card: state.hands[0]!.find(c => c !== state.upCard)! });
  const view = playerView(state, 1);
  for (let i = 1; i <= 20; i++) {
    const world = sampleWorld(view, randomFrom(i)); assert.ok(world);
    assert.ok(world.hands[0]!.includes(view.upCard) || world.buried.includes(view.upCard));
  }
});
test('Casual, Strong, Expert and Val have immutable distinct configurations, and differing decisions', () => {
  assert.equal(new Set(levels.map(l => JSON.stringify(STRATEGIES[l]))).size, 4);
  assert.equal(STRATEGIES.casual.samples, 0); assert.equal(STRATEGIES.strong.samples, 0);
  assert.ok(STRATEGIES.expert.samples > 0); assert.ok(STRATEGIES.val.partnerReturn > STRATEGIES.strong.partnerReturn);
  for (const level of levels) assert.ok(Object.isFrozen(STRATEGIES[level].trumpWeights));
  const state = playing(['clubs:Q', 'clubs:A'], 'clubs:9', 'hearts');
  state.trick = [{ seat: 2, card: 'clubs:9' }, { seat: 3, card: 'clubs:10' }, { seat: 0, card: 'clubs:J' }];
  const view = playerView(state, 1);
  assert.deepEqual(createBot('casual')(view), { type: 'play', card: 'clubs:A' });
  assert.deepEqual(createBot('strong')(view), { type: 'play', card: 'clubs:Q' });
});
test('simulation and Expert decisions replay identically without Math.random or clock access', () => {
  const options = { seed: 3490, levels: ['strong', 'expert', 'val', 'casual'] as Lineup };
  const a = runMatch(options);
  const random = Math.random; const now = Date.now;
  try {
    Math.random = () => { throw new Error('random'); }; Date.now = () => { throw new Error('clock'); };
    assert.deepEqual(runMatch(options), a);
  } finally { Math.random = random; Date.now = now; }
});
test('simulation statistics reconcile with public hand results and final scores', () => {
  const report = simulate({ games: 4, seed: 71, levels: ['strong', 'casual', 'val', 'casual'] });
  assert.deepEqual(report, simulate({ games: 4, seed: 71, levels: ['strong', 'casual', 'val', 'casual'] }));
  const s = report.summary;
  assert.equal(s.teamWins[0]! + s.teamWins[1]!, 4);
  assert.equal(s.callsBySeat.reduce((a, b) => a + b, 0), s.hands);
  assert.equal(s.roundOneCalls + s.roundTwoCalls, s.hands);
  assert.ok(s.lonerSuccesses <= s.lonerAttempts && s.lonerSuccesses <= s.marches);
  assert.equal(s.euchreRate, s.euchres / s.hands); assert.equal(s.marchRate, s.marches / s.hands);
  for (const match of report.records) {
    const points = [0, 0];
    for (const hand of match.hands) points[hand.result.team]! += hand.result.points;
    assert.deepEqual(points, match.score);
  }
  assert.deepEqual(summarize(report.records), s);
});
test('paired evaluation swaps seats on exactly matching seeds/dealers and has honest uncertainty', () => {
  const report = compare({ a: 'strong', b: 'casual', pairs: 3, seed: 88 });
  assert.equal(report.games, 6); assert.equal(report.aWins + report.bWins, 6);
  let wins = 0;
  for (let i = 0; i < 3; i++) {
    const seed = simulationSeed(88, i); const dealer = (i % 4) as Seat;
    const a = runMatch({ seed, dealer, levels: ['strong', 'casual', 'strong', 'casual'] });
    const b = runMatch({ seed, dealer, levels: ['casual', 'strong', 'casual', 'strong'] });
    wins += Number(a.winner === 0) + Number(b.winner === 1);
  }
  assert.equal(report.aWins, wins);
  assert.equal(pairInterval([0.5]), null);
  assert.deepEqual(pairInterval([0.5, 0.5, 0.5]), [0.5, 0.5]);
  assert.throws(() => simulate({ games: 0, seed: 1, levels: ['casual', 'casual', 'casual', 'casual'] }));
  assert.throws(() => simulationSeed(-1, 0)); assert.throws(() => simulationSeed(1, -1));
});

test('Expert changes a decision when the public void constraint changes', () => {
  const state = playing(['clubs:A', 'diamonds:A', 'hearts:9', 'spades:9', 'spades:10'], 'clubs:9', 'hearts');
  state.trick = []; state.caller = 0;
  const view = playerView(state, 1);
  const changed: PlayerView = { ...view, knownVoids: [['clubs'], [], [], []] };
  const bot = createBot('expert');
  assert.notDeepEqual(bot(view), bot(changed));
  // Every hypothetical seat-0 hand is actually constrained by that public void.
  for (let seed = 1; seed <= 10; seed++) {
    const sample = sampleWorld(changed, randomFrom(seed)); assert.ok(sample);
    assert.ok(sample.hands[0]!.every(c => effectiveSuit(c, 'hearts') !== 'clubs'));
  }
});
test('Val at seat 2 conserves trump more strongly in a contested ruff', () => {
  const state = playing([], 'diamonds:10', 'hearts');
  state.turn = 2; state.caller = 2;
  state.hands[2] = ['hearts:J', 'spades:A', 'hearts:9', 'hearts:K'];
  state.trick = [{ seat: 1, card: 'diamonds:10' }];
  state.completedTricks = [{ plays: [{ seat: 1, card: 'diamonds:A' }, { seat: 2, card: 'diamonds:K' }, { seat: 3, card: 'clubs:10' }, { seat: 0, card: 'diamonds:Q' }], winner: 1 }];
  const view = playerView(state, 2);
  assert.deepEqual(createBot('strong')(view), { type: 'play', card: 'hearts:J' });
  assert.deepEqual(createBot('val')(view), { type: 'play', card: 'hearts:9' });
});
test('strong policies support partner trump calls and suppress loner risk at nine', () => {
  const state = playing(['hearts:9', 'clubs:9', 'diamonds:9', 'spades:9', 'clubs:10'], 'clubs:Q', 'hearts');
  state.turn = 2; state.hands[2] = state.hands[1]!; state.trick = []; state.caller = 0;
  for (const level of ['strong', 'val'] as const) assert.deepEqual(createBot(level)(playerView(state, 2)), { type: 'play', card: 'hearts:9' });
  const bidding = initialState(42, 1);
  bidding.hands[2] = ['hearts:J', 'diamonds:J', 'hearts:A', 'hearts:K', 'clubs:A'];
  bidding.upCard = 'hearts:9';
  for (const level of levels) {
    const action = createBot(level)(playerView(bidding, 2));
    assert.equal(action.type, 'order-up');
    if (action.type === 'order-up') assert.equal(action.alone, true);
  }
  bidding.score = [9, 8];
  for (const level of ['strong', 'expert', 'val'] as const) {
    const action = createBot(level)(playerView(bidding, 2));
    assert.equal(action.type, 'order-up');
    if (action.type === 'order-up') assert.equal(action.alone, false);
  }
});

test('Val returns a useful suit previously led and won by the partner', () => {
  const state = playing([], 'clubs:9', 'hearts');
  state.turn = 2; state.caller = 0; state.trick = [];
  state.hands[2] = ['clubs:9', 'diamonds:9', 'hearts:9'];
  state.completedTricks = [{ plays: [{ seat: 0, card: 'diamonds:A' }, { seat: 1, card: 'diamonds:10' }, { seat: 2, card: 'diamonds:Q' }, { seat: 3, card: 'diamonds:K' }], winner: 0 }];
  assert.deepEqual(createBot('val')(playerView(state, 2)), { type: 'play', card: 'diamonds:9' });
});

test('Expert endgame search changes legal choices on reachable public views', () => {
  const referee = createReferee({ seed: 42 });
  let view = referee.player(0).view(); let changes = 0; let searched = 0;
  const strong = createBot('strong'); const expert = createBot('expert');
  while (view.phase !== 'game-over') {
    if (view.phase === 'hand-over') { referee.nextHand(); view = referee.player(0).view(); }
    const port = referee.player(view.turn!); const own = port.view();
    const baseline = strong(own);
    if (own.phase === 'playing' && own.completedTricks.length >= 2 && own.legalActions.length > 1) {
      searched++;
      const action = expert(own);
      assert.ok(own.legalActions.includes(action));
      changes += Number(JSON.stringify(action) !== JSON.stringify(baseline));
    }
    view = port.act(baseline).view;
  }
  assert.ok(searched > 0); assert.ok(changes > 0);
});
