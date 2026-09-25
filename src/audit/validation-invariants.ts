/** Host-only oracle: no imports from production card, legality, trick or scoring helpers. */
import assert from 'node:assert/strict';
import type { State } from '../internal/state.ts';
import type { Action, Card, Play, PlayerView, Seat, Suit } from '../types.ts';
const suits: Suit[] = ['clubs','diamonds','hearts','spades'];
const ranks = ['9','10','J','Q','K','A'];
const mate = {clubs:'spades',spades:'clubs',hearts:'diamonds',diamonds:'hearts'};
export function suit(c: Card,t: Suit): string {const [s,r]=c.split(':');return r==='J'&&s===mate[t]?t:s!;}
export function winner(plays: readonly Play[],t: Suit): Seat {
  const led=suit(plays[0]!.card,t);
  const value=(c:Card)=>{const [s,r]=c.split(':');const es=suit(c,t);return (es===t?100:es===led?50:0)+(r==='J'&&es===t?(s===t?8:7):ranks.indexOf(r!));};
  return plays.reduce((a,b)=>value(b.card)>value(a.card)?b:a).seat;
}
export function next(s:Seat,skip:Seat|null=null):Seat{let n=(s+1)%4;if(n===skip)n=(n+1)%4;return n as Seat;}
export function independentActions(s:State):Action[]{
  if(s.turn===null)return [];
  if(s.phase==='bidding'){
    const a:Action[]=s.biddingRound===1?[false,true].map(alone=>({type:'order-up',alone})):suits.filter(t=>t!==s.upCard.split(':')[0]).flatMap(t=>[false,true].map(alone=>({type:'call' as const,suit:t,alone})));
    if(!(s.biddingRound===2&&s.bids.length===7&&s.turn===s.dealer))a.push({type:'pass'});return a;
  }
  let cards=s.hands[s.turn]!;
  if(s.phase==='playing'&&s.trick.length){const following=cards.filter(c=>suit(c,s.trump!)===suit(s.trick[0]!.card,s.trump!));if(following.length)cards=following;}
  return cards.map(card=>({type:s.phase==='discarding'?'discard':'play',card}));
}
const fields='seat hand phase handNumber dealer turn biddingRound upCard upCardStatus bids trump caller alone sittingOut trick completedTricks knownVoids score result winner legalActions'.split(' ').sort();
export function checkView(s:State,v:PlayerView):void{
  assert.deepEqual(Object.keys(v).sort(),fields,'policy allowlist');assert.ok(Object.isFrozen(v)&&Object.isFrozen(v.hand));assert.equal(v.seat,s.turn);assert.deepEqual(v.hand,s.hands[v.seat]);assert.deepEqual(v.legalActions,independentActions(s));
}
export function checkState(s:State):void{
  const cards=[...s.hands.flat(),...s.kitty,...s.trick.map(p=>p.card),...s.completedTricks.flatMap(t=>t.plays.map(p=>p.card))];
  assert.equal(cards.length,24);assert.equal(new Set(cards).size,24);assert.ok(cards.every(c=>suits.includes(c.split(':')[0] as Suit)&&ranks.includes(c.split(':')[1]!)));
  if(s.phase==='bidding'){
    assert.equal(s.turn,(s.dealer+1+s.bids.length)%4);assert.equal(s.biddingRound,s.bids.length<4?1:2);assert.ok(s.bids.length<=7);assert.ok(s.bids.every(b=>b.action.type==='pass'));
    s.bids.forEach((b,i)=>{assert.equal(b.seat,(s.dealer+1+i)%4);assert.equal(b.round,i<4?1:2);});assert.equal(s.upCardStatus,s.bids.length<4?'face-up':'turned-down');
  }
  if(s.caller!==null)assert.equal(s.sittingOut,s.alone?(s.caller+2)%4:null);
  for(const t of s.completedTricks){assert.equal(t.plays.length,s.alone?3:4);assert.equal(t.winner,winner(t.plays,s.trump!));t.plays.forEach((p,i)=>{assert.notEqual(p.seat,s.sittingOut);if(i)assert.equal(p.seat,next(t.plays[i-1]!.seat,s.sittingOut));});}
  if(s.phase==='playing')assert.notEqual(s.turn,s.sittingOut);
  if(s.result){
    assert.equal(s.completedTricks.length,5);const n=s.completedTricks.filter(t=>t.winner%2===s.caller!%2).length;const team=n<3?1-s.caller!%2:s.caller!%2;const points=n<3?2:n<5?1:s.alone?4:2;
    assert.deepEqual(s.result,{makerTricks:n,team,points,reason:n<3?'euchred':n<5?'made':s.alone?'loner-march':'march'});assert.equal(s.winner,s.score[team]!>=10?team:null);assert.equal(s.phase,s.winner===null?'hand-over':'game-over');assert.equal(s.turn,null);if(s.alone)assert.equal(s.hands[s.sittingOut!]!.length,5);
  }
}
export function checkTransition(a:State,action:Action,b:State):void{
  const seat=a.turn!;assert.ok(independentActions(a).some(x=>JSON.stringify(x)===JSON.stringify(action)));assert.equal(b.rng,a.rng);assert.equal(b.dealer,a.dealer);assert.equal(b.handNumber,a.handNumber);
  if(action.type==='pass'){assert.equal(b.bids.length,a.bids.length+1);assert.equal(b.turn,next(seat));assert.equal(b.biddingRound,b.bids.length>=4?2:1);}
  else if(action.type==='call'||action.type==='order-up'){
    assert.equal(b.caller,seat);assert.equal(b.alone,action.alone);assert.equal(b.trump,action.type==='call'?action.suit:a.upCard.split(':')[0]);
    if(action.type==='order-up'){assert.equal(b.phase,'discarding');assert.equal(b.turn,a.dealer);assert.deepEqual(b.hands[a.dealer],[...a.hands[a.dealer]!,a.upCard]);assert.deepEqual(b.kitty,a.kitty.filter(c=>c!==a.upCard));}
    else {assert.equal(b.phase,'playing');assert.equal(b.turn,next(a.dealer,b.sittingOut));}
  }else if(action.type==='discard'){
    assert.equal(seat,a.dealer);assert.equal(a.hands[seat]!.length,6);assert.deepEqual(b.hands[seat],a.hands[seat]!.filter(c=>c!==action.card));assert.deepEqual(b.kitty,[...a.kitty,action.card]);assert.equal(b.turn,next(a.dealer,b.sittingOut));assert.equal(b.phase,'playing');
  }else{
    assert.deepEqual(b.hands[seat],a.hands[seat]!.filter(c=>c!==action.card));const plays=[...a.trick,{seat,card:action.card}];
    if(plays.length===(a.alone?3:4)){assert.deepEqual(b.completedTricks.at(-1),{plays,winner:winner(plays,a.trump!)});assert.equal(b.turn,b.result?null:winner(plays,a.trump!));}else {assert.deepEqual(b.trick,plays);assert.equal(b.turn,next(seat,a.sittingOut));}
  }
  const score=[...a.score];if(!a.result&&b.result)score[b.result.team]!+=b.result.points;assert.deepEqual(b.score,score);checkState(b);
}
