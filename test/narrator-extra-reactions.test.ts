import test from 'node:test';
import assert from 'node:assert/strict';
import { reactionFor } from '../web/narrator-reactions.ts';
import { createSession } from '../web/session.ts';
import type { HandResult, PlayerView, Seat } from '../src/index.ts';

const base:PlayerView={...createSession(17,'strong').view(),phase:'playing',trump:'hearts',result:null,completedTricks:[]};
const sweep='reaction.you-team-sweep.badass';
const keys=(before:PlayerView,after:PlayerView)=>reactionFor(before,after,3,{type:'play',card:'clubs:A'})?.alternatives?.map(line=>line.clip)??[];
test('sweep payoff requires a newly confirmed five-trick user-team march',()=>{
 for(const reason of ['made','march','loner-march','euchred'] as const)for(const team of [0,1] as const)for(const count of [4,5])for(const opponentWon of [false,true]){
  const result:HandResult={team,reason,makerTricks:5,points:2};
  const tricks=Array.from({length:count},(_,n)=>({winner:(opponentWon&&n===0?1:n%2?2:0) as Seat,plays:[]}));
  const before={...base,completedTricks:tricks.slice(0,-1)},after:PlayerView={...base,phase:'hand-over',completedTricks:tricks,result};
  assert.equal(keys(before,after).includes(sweep),team===0&&count===5&&!opponentWon&&(reason==='march'||reason==='loner-march'));
  assert.equal(keys({...before,result},after).includes(sweep),false,'an already-completed hand must not trigger again');
 }
});
test('new Val context follows only the public non-trump led suit',()=>{
 const before:PlayerView={...base,trick:[{seat:1,card:'clubs:9'}]};
 for(const card of ['clubs:Q','spades:Q','hearts:Q','diamonds:J'] as const){
  const get=(v:PlayerView)=>reactionFor(v,{...v,trick:[...v.trick,{seat:2,card}]},2,{type:'play',card})?.alternatives?.map(line=>line.clip)??[];
  assert.equal(get(before).includes('reaction.val.follow-suit.finish-it'),card==='clubs:Q');
  assert.deepEqual(get({...before,hand:[],legalActions:[]}),get(before));
 }
});
