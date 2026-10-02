import test from 'node:test';
import assert from 'node:assert/strict';
import { reactionFor, reactionLines, baseReactionLines } from '../web/narrator-reactions.ts';
import { createSession } from '../web/session.ts';
import { effectiveSuit, rankOf, suitOf } from '../src/index.ts';
import type { Card, PlayerView, Seat, Suit } from '../src/index.ts';
const base=createSession(17,'strong',{dealer:3}).view();
const extras:Readonly<Record<string,readonly string[]>>={
 'reaction.you.trump':['reaction.you.trump.slouch'],
 'reaction.val.follow-suit':['reaction.val.follow-suit.soap-opera'],
 'reaction.you.follow-suit':['reaction.you.follow-suit.decorating','reaction.you.follow-suit.parking'],
 'reaction.you.trick':['reaction.you.trick.celebratin-muscle'],
 'reaction.opponent.ace-lead':['reaction.opponent.ace-lead.tuxedo'],
 'reaction.opponent.right-bower':['reaction.opponent.right-bower.bouncer'],
 'reaction.opponent.trick':['reaction.opponent.trick.table-drink','reaction.opponent.trick.stupid-hands'],
 'reaction.val.trick':['reaction.val.trick.dental-benefits'],
 'reaction.table.four-tricks':['reaction.table.four-tricks.attention-span'],
 'you-team-sweep':['reaction.you-team-sweep.badass'],
};
const expand=(triggers:readonly string[])=>triggers.flatMap(trigger=>[...(baseReactionLines[trigger]?[trigger]:[]),...(extras[trigger]??[])]).sort();
const keys=(before:PlayerView,after:PlayerView,seat:Seat,card:Card)=>(reactionFor(before,after,seat,{type:'play',card})?.alternatives??[]).map(line=>line.clip).sort();
test('expanded review: 9,600 play contexts and hidden-hand mutations match the bounded trigger contract',()=>{
 const suits:Suit[]=['clubs','diamonds','hearts','spades'];const cards:Card[]=suits.flatMap(suit=>['9','10','J','Q','K','A'].map(rank=>`${suit}:${rank}` as Card));let cases=0;
 for(const trump of suits)for(const card of cards)for(const actor of [0,1,2,3] as const)for(const led of [null,...cards]){
  const before:PlayerView={...base,phase:'playing',trump,turn:actor,trick:led?[{seat:2,card:led}]:[]},after:PlayerView={...before,trick:[...before.trick,{seat:actor,card}]};
  const wanted:string[]=[],suit=effectiveSuit(card,trump),rank=rankOf(card);
  if(actor===0){if(suit===trump)wanted.push(rank==='J'?'reaction.you.bower':'reaction.you.trump');else if(!led&&['9','10'].includes(rank))wanted.push('reaction.you.low-lead');else if(led&&suit===effectiveSuit(led,trump))wanted.push('reaction.you.follow-suit');}
  if(actor===2&&led&&suit!==trump&&suit===effectiveSuit(led,trump))wanted.push('reaction.val.follow-suit');
  if(actor===1||actor===3){if(rank==='J'&&suitOf(card)===trump)wanted.push('reaction.opponent.right-bower');else if(!led&&rank==='A')wanted.push('reaction.opponent.ace-lead');else if(!led&&suit!==trump&&['9','10'].includes(rank))wanted.push('reaction.opponent.low-lead');}
  const expected=expand(wanted);assert.deepEqual(keys(before,after,actor,card),expected);
  assert.deepEqual(keys({...before,hand:['clubs:9'],legalActions:[]},{...after,hand:['spades:A','diamonds:10'],legalActions:[]},actor,card),expected);cases++;
 }
 assert.equal(cases,9600);
});
test('expanded review: sweep celebration requires new confirmed user-team five-trick march',()=>{
 const trick=(winner:Seat)=>({winner,plays:[]});
 const before:PlayerView={...base,phase:'playing',trump:'hearts',completedTricks:[trick(0),trick(2),trick(0),trick(2)]};
 const after:PlayerView={...before,phase:'hand-over',turn:null,completedTricks:[...before.completedTricks,trick(0)],result:{team:0,points:2,makerTricks:5,reason:'march'}};
 const has=(b:PlayerView,a:PlayerView)=>keys(b,a,2,'clubs:Q').includes('reaction.you-team-sweep.badass');
 assert.equal(has(before,after),true);assert.equal(has(before,{...after,phase:'game-over',winner:0}),true);
 assert.equal(has(before,{...after,result:{team:0,points:4,makerTricks:5,reason:'loner-march'}}),true);
 assert.equal(has(after,after),false);assert.equal(has({...before,result:after.result},after),false);
 assert.equal(has(before,{...after,completedTricks:after.completedTricks.slice(0,4)}),false);
 assert.equal(has(before,{...after,completedTricks:[trick(0),trick(2),trick(1),trick(2),trick(0)]}),false);
 assert.equal(has(before,{...after,result:{team:1,points:2,makerTricks:5,reason:'march'}}),false);
 assert.equal(has(before,{...after,result:{team:0,points:1,makerTricks:4,reason:'made'}}),false);
 assert.equal(has(before,{...after,result:{team:0,points:2,makerTricks:0,reason:'euchred'}}),false);
 const candidate=reactionFor(before,after,2,{type:'play',card:'clubs:Q'})!.alternatives!.find(line=>line.clip==='reaction.you-team-sweep.badass')!;
 assert.equal(candidate.priority,3);assert.equal(candidate.text,'That was frickin’ badass!');
});
test('expanded review: related new premises retain existing semantic cooldowns',()=>{
 assert.equal(Object.keys(baseReactionLines).length,12);assert.equal(Object.keys(reactionLines).length,24);
 for(const [newId,oldId] of [
  ['reaction.you.follow-suit.parking','reaction.you.follow-suit'],
  ['reaction.opponent.ace-lead.tuxedo','reaction.opponent.ace-lead'],
  ['reaction.opponent.trick.table-drink','reaction.opponent.trick'],
  ['reaction.val.trick.dental-benefits','reaction.val.trick'],
 ] as const)assert.equal(reactionLines[newId]!.family,reactionLines[oldId]!.family);
 assert.equal(reactionLines['reaction.table.four-tricks.attention-span']!.family,'wandering-attention');
 for(const actor of [0,1,2,3] as const)assert.equal(reactionFor(base,base,actor,{type:'discard',card:'spades:A'}),undefined);
});
