import test from 'node:test';
import assert from 'node:assert/strict';
import {createNarratorFlavorHistory} from '../web/narrator-flavor.ts';
import {loadNarratorHistory} from '../web/narrator-history-storage.ts';
const line={clip:'review.once',text:'One exact review sentence.',family:'review-once'};
test('completed current match must not prematurely expire previous-two-match exclusion',()=>{
 const h=createNarratorFlavorHistory(()=>0);let id=0;
 h.beginGame();h.beginHand(1);h.used(line);
 for(let hand=1;hand<=5;hand++){h.beginHand(hand);for(let n=0;n<20;n++)h.observe({eventId:++id,handNumber:hand,completedTricks:0,handComplete:false});h.observe({eventId:++id,handNumber:hand,completedTricks:5,handComplete:true,gameComplete:hand===5});}
 assert.equal(h.eligible(line),false);h.beginGame();id=0;h.beginHand(1);h.observe({eventId:++id,handNumber:1,completedTricks:5,handComplete:true,gameComplete:true});
 h.beginGame();id=0;h.beginHand(1);h.observe({eventId:++id,handNumber:1,completedTricks:5,handComplete:true,gameComplete:true});
 assert.equal(h.eligible(line),false,'game1 wording must remain blocked through the closing event of game3');h.beginGame();h.beginHand(1);assert.equal(h.eligible(line),true);
});
test('implausibly far future release time in stored history must be rejected',()=>{
 const stamp={game:1,gameOrdinal:1,completedHands:1,tricks:5,event:30};
 const saved={version:1,game:1,completedGames:0,completedHands:1,tricks:5,event:30,clips:[['review.once',stamp]],lines:[['one exact review sentence',stamp]],families:[['review-once',stamp]],seenClips:['review.once'],seenLines:['one exact review sentence'],recent:['review.once'],lastFlavor:stamp,releaseEvent:999999999,releaseJitter:1};
 assert.equal(loadNarratorHistory({load:()=>JSON.stringify(saved),save:()=>{}}),undefined,'a syntactically valid future stamp must not mute reactions for billions of events');
});
