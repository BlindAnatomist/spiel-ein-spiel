import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { auditPolicy } from './bots.ts';
import { checkState, checkTransition, checkView } from './validation-invariants.ts';
import { createReferee } from '../referee.ts';
import { simulationSeed } from '../simulation/index.ts';
import { OPPONENT_PROFILES } from '../bots/profiles.ts';
import type { OpponentProfileId } from '../bots/profiles.ts';
import type { Action,Seat,HandResult,Suit } from '../types.ts';
export type Profile=OpponentProfileId|'val';
export type Lineup=[Profile,Profile,Profile,Profile];
export const VERSION='bot-validation-v2-reconstruction';
export interface Case{id:string;family:string;group:string;lineup:Lineup;rotation:number;focal:number;variant:string;}
export interface BidRecord{seat:Seat;round:1|2;forced:boolean;action:'pass'|'call';}
export interface Hand{number:number;dealer:Seat;deal:string;bids:BidRecord[];caller:Seat;suit:Suit;alone:boolean;result:HandResult;}
export interface Game{caseId:string;block:number;seed:number;dealer:Seat;lineup:Lineup;hands:Hand[];score:readonly[number,number];winner:number;decisions:number;digest:string;policyMs:number[];policyDecisions:number[];elapsedMs:number;}
const digest=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
export function runValidationGame(c:Case,block:number,baseSeed:number):Game{
  const seed=simulationSeed(baseSeed,block),dealer=((block+c.rotation)%4) as Seat,ref=createReferee({seed,dealer});
  const ports=([0,1,2,3] as const).map(s=>ref.player(s)),bots=c.lineup.map(auditPolicy),start=performance.now();
  const hands:Hand[]=[],trace:Array<{seat:Seat;action:Action}>=[],policyMs=[0,0,0,0],policyDecisions=[0,0,0,0];let decisions=0,s=ref.snapshot(),handDeal='',bids:BidRecord[]=[];
  function begin(){checkState(s);assert.deepEqual(s.hands.map(h=>h.length),[5,5,5,5]);assert.equal(s.kitty.length,4);assert.equal(s.upCard,s.kitty[0]);handDeal=digest({hands:[0,1,2,3].map(i=>s.hands[(i+c.rotation)%4]),kitty:s.kitty});bids=[];}
  try{
    begin();
    for(;;){
      if(s.result){hands.push({number:s.handNumber,dealer:s.dealer,deal:handDeal,bids,caller:s.caller!,suit:s.trump!,alone:s.alone,result:s.result});if(s.phase==='game-over')break;
        const old=s;ref.nextHand();s=ref.snapshot();assert.equal(s.dealer,(old.dealer+1)%4);assert.equal(s.handNumber,old.handNumber+1);assert.deepEqual(s.score,old.score);begin();}
      const seat=s.turn!,view=ports[seat]!.view();checkView(s,view);const t=performance.now(),action=bots[seat]!(view);policyMs[seat]!+=performance.now()-t;policyDecisions[seat]!++;trace.push({seat,action});
      if(s.phase==='bidding')bids.push({seat,round:s.biddingRound,forced:s.biddingRound===2&&s.bids.length===7,action:action.type==='pass'?'pass':'call'});
      assert.ok(ports[seat]!.act(action).ok);const after=ref.snapshot();checkTransition(s,action,after);s=after;assert.ok(++decisions<=2000);
    }
    assert.equal(hands.length,hands.reduce((n,h)=>n+h.bids.filter(b=>b.action==='call').length,0));const score=[0,0];for(const h of hands)score[h.result.team]!+=h.result.points;assert.deepEqual(score,s.score);
    return {caseId:c.id,block,seed,dealer,lineup:c.lineup,hands,score:s.score,winner:s.winner!,decisions,digest:digest(trace),policyMs,policyDecisions,elapsedMs:performance.now()-start};
  }catch(error){throw new Error(JSON.stringify({message:String(error),case:c,block,seed,dealer,hand:s.handNumber,decision:decisions,state:s,trace}));}
}
export function checkMatched(games:readonly Game[]){const signatures=new Map<number,string>();let matchedHands=0,unmatchedTailHands=0;const shortest=Math.min(...games.map(g=>g.hands.length));
  for(const g of games)for(const h of g.hands){const old=signatures.get(h.number);if(old!==undefined){assert.equal(h.deal,old,`deal mismatch ${g.caseId}/${g.block}/${h.number}`);matchedHands++;}else signatures.set(h.number,h.deal);if(h.number>shortest)unmatchedTailHands++;}return {matchedHands,unmatchedTailHands};}
export function profiles(tier:string):Profile[]{return Object.values(OPPONENT_PROFILES).filter(p=>p.level===tier).map(p=>p.id);}
export function rotate(lineup:Lineup,r:number):Lineup{const a=[...lineup] as Lineup;lineup.forEach((p,i)=>{a[(i+r)%4]=p;});return a;}
export function design(category:string):Case[]{
  const cases:Case[]=[];
  function add(family:string,group:string,lineup:Lineup,variant:string,r=0,focal=0){cases.push({id:`${category}-${cases.length}`,family,group,lineup:rotate(lineup,r),rotation:r,focal:(focal+r)%4,variant});}
  if(['casual','expert','strong'].includes(category)){const pool=profiles(category),proxy=pool[0]!;for(const a of pool)for(const b of pool)for(const swap of [false,true])add('seat',`${category}-seat`,swap?['val',a,proxy,b]:[proxy,a,'val',b],swap?'proxy-swapped':'original');}
  else if(category==='symmetry'){for(const p of [...Object.keys(OPPONENT_PROFILES),'val'] as Profile[])for(let r=0;r<4;r++)add('symmetry',`symmetry-${p}`,[p,p,p,p],p,r);}
  else if(category==='cross'){for(const [lo,hi] of [['casual','strong'],['strong','expert'],['casual','expert']])for(const a of profiles(lo!))for(const b of profiles(hi!)){const group=`cross-${a}-${b}`;add('teams',group,[b,a,b,a],b);add('teams',group,[a,b,a,b],b,0,1);for(let r=0;r<4;r++)for(const p of [a,b])add('common',group,[p,'strong-balanced','strong-balanced','strong-balanced'],p,r);}}
  else if(category==='val'){for(const partner of ['casual-balanced','strong-balanced','expert-balanced'] as Profile[])for(const a of profiles('strong'))for(const b of profiles('strong')){const group=`val-${partner}-${a}-${b}`;for(let r=0;r<4;r++)for(const p of ['val',...profiles('strong')] as Profile[])add('val',group,[p,a,partner,b],p,r);}}
  else throw new Error('Unknown category');return cases;
}
