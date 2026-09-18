import { teamOf } from '../cards.ts';
import { nextSeat, playableCards, scoreHand, trickWinner } from '../rules.ts';
import type { Action, Card, Play, PlayerView, Seat, Suit } from '../types.ts';
import type { Strategy } from './config.ts';
import { hashText, randomFrom } from './random.ts';
import { sampleWorld } from './sample.ts';
interface Position { hands: Card[][]; trick: Play[]; turn: Seat; makerTricks: number; completed: number }
interface Context { trump: Suit; caller: Seat; sittingOut: Seat | null; alone: boolean; team: number; score: readonly [number, number] }
function advance(p: Position, card: Card, ctx: Context): Position {
  const hands = p.hands.map((h, s) => s === p.turn ? h.filter(c => c !== card) : h);
  const trick = [...p.trick, { seat: p.turn, card }];
  if (trick.length < (ctx.alone ? 3 : 4)) return { ...p, hands, trick, turn: nextSeat(p.turn, ctx.sittingOut) };
  const winner = trickWinner(trick, ctx.trump);
  return { hands, trick: [], turn: winner, makerTricks: p.makerTricks + Number(teamOf(winner) === teamOf(ctx.caller)), completed: p.completed + 1 };
}
function payoff(p: Position, ctx: Context): number {
  const { points, team: winningTeam } = scoreHand(ctx.caller, p.makerTricks, ctx.alone);
  const sign = winningTeam === ctx.team ? 1 : -1;
  return sign * (points + (ctx.score[winningTeam]! + points >= 10 ? 4 : 0));
}
function solve(p: Position, ctx: Context, alpha = -Infinity, beta = Infinity): number {
  if (p.completed === 5) return payoff(p, ctx);
  const legal = playableCards(p.hands[p.turn]!, p.trick, ctx.trump);
  const max = teamOf(p.turn) === ctx.team;
  let value = max ? -Infinity : Infinity;
  for (const card of legal) {
    const next = solve(advance(p, card, ctx), ctx, alpha, beta);
    value = max ? Math.max(value, next) : Math.min(value, next);
    if (max) alpha = Math.max(alpha, value); else beta = Math.min(beta, value);
    if (beta <= alpha) break;
  }
  return value;
}
export function searchPlay(view: PlayerView, config: Strategy, fallback: Action): Action {
  const legal = view.legalActions.filter((a): a is Extract<Action, { card: Card }> => a.type === 'play');
  if (legal.length < 2 || view.completedTricks.length < 5 - config.exactCards) return fallback;
  const random = randomFrom(hashText(JSON.stringify(view)));
  const ctx: Context = { trump: view.trump!, caller: view.caller!, sittingOut: view.sittingOut,
    alone: view.alone, team: teamOf(view.seat), score: view.score };
  const totals = legal.map(() => 0);
  let samples = 0;
  for (let i = 0; i < config.samples; i++) {
    const world = sampleWorld(view, random);
    if (!world) continue;
    samples++;
    const position: Position = { hands: world.hands, trick: [...view.trick], turn: view.seat,
      completed: view.completedTricks.length,
      makerTricks: view.completedTricks.filter(t => teamOf(t.winner) === teamOf(view.caller!)).length };
    legal.forEach((action, index) => { totals[index]! += solve(advance(position, action.card, ctx), ctx); });
  }
  if (!samples) return fallback;
  // Use heuristic on numerical ties; all candidate actions share identical worlds.
  let best = legal.findIndex(a => fallback.type === 'play' && a.card === fallback.card);
  if (best < 0) best = 0;
  for (let i = 0; i < legal.length; i++) if (totals[i]! > totals[best]! + 1e-9) best = i;
  return legal[best]!;
}
