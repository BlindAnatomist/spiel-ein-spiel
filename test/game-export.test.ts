import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { createSession } from '../web/session.ts';
import { createBot } from '../src/bots/index.ts';
import { createController } from '../web/controller.ts';
import { createPerformanceRecorder, PERFORMANCE_STORAGE_KEY, PERFORMANCE_PENDING_ARCHIVE_KEY } from '../web/performance.ts';
import { createHandReportStore, createHandReportRecorder, HAND_REPORT_KEY } from '../web/hand-report.ts';
import { readCompletedGameExports, gameExportText, gameExportJson } from '../web/game-export.ts';
import { createHandReportPanel } from '../web/hand-report-panel.ts';
import { names } from '../web/presentation.ts';
const memory = () => { const data=new Map<string,string>();return {data,getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v);}}; };
async function fixture() {
  const storage=memory(),store=createHandReportStore(storage);
  const observer=createPerformanceRecorder(storage,{profileId:'not-exported',gameId:'complete-one',humanTracking:'other',buildCommit:'played-build',completedAt:()=> '2026-10-03T10:00:00Z'});
  const session=createSession(31,'strong',{observer});
  const reports=createHandReportRecorder(store,{gameId:'complete-one',buildCommit:'played-build',catalogSha:'catalog',seatNames:names},{});
  const controller=createController(session,{render:()=>{},park:()=>{},focus:()=>{}},reports.liveText,async()=>{},undefined,names,'visual',undefined,reports.observe);
  const bot=createBot('strong');await controller.start();
  while(session.view().winner===null) { if(session.view().result)await controller.next();else await controller.act(bot(session.view())); }
  controller.stop();return {storage,store,hands:session.view().handNumber};
}
const data=await fixture();
function clone() {const storage=memory();for(const [k,v] of data.storage.data)storage.setItem(k,v);return {storage,store:createHandReportStore(storage)};}

test('whole-game export joins actual game identity, records every hand in order, keeps privacy and writes nothing',()=>{
  const {storage,store}=clone(),before=[...storage.data];
  const games=readCompletedGameExports(storage,store);assert.equal(games.length,1);const g=games[0]!;
  assert.equal(g.gameId,'complete-one');assert.equal(g.expectedHands,data.hands);assert.equal(g.archive!.hands.length,data.hands);
  assert.ok(g.coverage.some(x => x.startsWith(`Detailed decision records: ${data.hands} of ${data.hands}`) && x.includes('not been independently replayed')));
  const text=gameExportText(g);assert.match(text,/Recorded difficulty: strong/);assert.match(text,/Played build\(s\): played-build/);
  for(let n=1;n<=data.hands;n++){assert.match(text,new RegExp(`HAND ${n}\\n`));if(n>1)assert.ok(text.indexOf(`HAND ${n-1}\n`)<text.indexOf(`HAND ${n}\n`));}
  assert.match(text,/Score 0–0 →/);assert.match(text,/Private view not recorded/);assert.match(text,/Held \[/);
  assert.doesNotMatch(gameExportJson(g),/not-exported/);assert.deepEqual([...storage.data],before);
});
test('public-only records include all available played cards and outcomes and honestly show missing decisions/hands',()=>{
  const {storage,store}=clone();storage.data.delete(PERFORMANCE_STORAGE_KEY);storage.data.delete(PERFORMANCE_PENDING_ARCHIVE_KEY);
  const g=readCompletedGameExports(storage,store)[0]!;assert.equal(g.archive,null);assert.equal(g.summary,null);
  const text=gameExportText(g);assert.match(text,/No readable detailed archive/);assert.match(text,/Recorded difficulty: not recorded/);
  assert.match(text,/Winner/);assert.match(text,/Score \d+–\d+ →/);
  assert.ok(g.publicReports.length<=8);assert.equal(g.expectedHands,data.hands);
  const book=JSON.parse(storage.getItem(HAND_REPORT_KEY)!);book.reports=book.reports.filter((r:{state:{handNumber:number}})=>r.state.handNumber!==data.hands-1);storage.setItem(HAND_REPORT_KEY,JSON.stringify(book));
  const partial=readCompletedGameExports(storage,createHandReportStore(storage))[0]!;
  assert.ok(partial.coverage.some(x=>x.startsWith('Public trick records:')&&x.includes(String(data.hands-1))));
});
test('summary-only game remains exportable, malformed data is untouched, active game cannot expose private data',()=>{
  const {storage}=clone();storage.data.delete(HAND_REPORT_KEY);storage.data.delete(PERFORMANCE_PENDING_ARCHIVE_KEY);
  const before=[...storage.data];const games=readCompletedGameExports(storage,createHandReportStore(storage));assert.equal(games.length,1);assert.match(gameExportText(games[0]!),/Only a scoring summary/);assert.deepEqual([...storage.data],before);
  storage.setItem(PERFORMANCE_PENDING_ARCHIVE_KEY,'{broken');const bad=readCompletedGameExports(storage,createHandReportStore(storage));assert.match(bad[0]!.sourceNotices.join(' '),/could not be read/);assert.equal(storage.getItem(PERFORMANCE_PENDING_ARCHIVE_KEY),'{broken');
  const active=memory(),store=createHandReportStore(active);const recorder=createHandReportRecorder(store,{gameId:'active',buildCommit:'x',catalogSha:'x',seatNames:names},{});
  recorder.observe({kind:'checkpoint',view:createSession(9,'strong').view(),pacing:'visual',audioEnabled:false});assert.equal(readCompletedGameExports(active,store).length,0);
});
test('missing accepted actions, discontinuous scores and source conflicts are marked rather than called complete',()=>{
  const {storage,store}=clone();const raw=JSON.parse(storage.getItem(PERFORMANCE_PENDING_ARCHIVE_KEY)!);raw[0].game.hands[0].decisions.splice(5,1);raw[0].game.hands[1].scoreBefore=[8,8];raw[0].game.score=[15,3];storage.setItem(PERFORMANCE_PENDING_ARCHIVE_KEY,JSON.stringify(raw));
  const g=readCompletedGameExports(storage,store)[0]!;assert.match(g.coverage.join(' '),/gaps or duplicates/);assert.match(g.coverage.join(' '),/incomplete or inconsistent/);assert.match(g.coverage.join(' '),/disagree about the final score/);
});
function panel(summaryOnly=false) {
  const {storage,store}=clone();if(summaryOnly){storage.data.delete(HAND_REPORT_KEY);storage.data.delete(PERFORMANCE_PENDING_ARCHIVE_KEY);}
  const actual=summaryOnly?createHandReportStore(storage):store;
  const dom=new JSDOM(readFileSync('web/index.html','utf8'),{url:'https://example.test/'}),d=dom.window.document;
  let pauses=0;const api=createHandReportPanel(d,actual,()=>{pauses++;},()=>readCompletedGameExports(storage,actual));
  d.querySelector<HTMLElement>('#help-panel')!.hidden=false;
  const get=<T extends HTMLElement>(id:string)=>d.getElementById(id) as T;
  get<HTMLButtonElement>('saved-hand-report').click();return {dom,d,get,api,storage,pauses};
}
const flush=()=>new Promise<void>(resolve=>setImmediate(resolve));
test('one Copy whole game action uses existing panel, fallback selects every hand and Select all retains whole-game text',async()=>{
  const h=panel(),before=[...h.storage.data];assert.equal(h.pauses,1);
  h.get<HTMLButtonElement>('hand-report-copy-game').click();await flush();const text=h.get<HTMLTextAreaElement>('hand-report-text');
  assert.match(text.value,/Euchre completed game/);assert.match(text.value,/HAND 1\n/);assert.equal(text.selectionStart,0);assert.equal(text.selectionEnd,text.value.length);
  h.get<HTMLButtonElement>('hand-report-select-all').click();assert.match(text.value,/Euchre completed game/);assert.equal(text.selectionEnd,text.value.length);
  h.get<HTMLButtonElement>('hand-report-copy').click();await flush();assert.match(text.value,/Euchre saved hand report/);assert.doesNotMatch(text.value,/HAND 1\n/);
  assert.deepEqual([...h.storage.data],before);h.dom.window.close();
});
test('summary-only saved game appears in the same selector without starting another game',async()=>{
  const h=panel(true);assert.equal(h.get<HTMLSelectElement>('hand-report-selection').value,'game:complete-one');assert.equal(h.get<HTMLButtonElement>('hand-report-copy-game').disabled,false);assert.equal(h.get<HTMLButtonElement>('hand-report-copy').disabled,true);
  h.get<HTMLButtonElement>('hand-report-copy-game').click();await flush();assert.match(h.get<HTMLTextAreaElement>('hand-report-text').value,/Only a scoring summary/);h.dom.window.close();
});
test('delayed whole-game copy never steals focus after closing',async()=>{
  const h=panel();let release:()=>void=()=>{};Object.defineProperty(h.dom.window.navigator,'clipboard',{value:{writeText:()=>new Promise<void>(r=>{release=r;})}});
  h.get<HTMLButtonElement>('hand-report-copy-game').focus();h.get<HTMLButtonElement>('hand-report-copy-game').click();h.get<HTMLButtonElement>('hand-report-close').click();release();await flush();assert.equal(h.d.activeElement,h.get('saved-hand-report'));assert.equal(h.get('hand-report-panel').hidden,true);h.dom.window.close();
});


test('per-hand conflicts are visible and huge public hand numbers cannot expand the export',()=>{
  const {storage,store}=clone();const raw=JSON.parse(storage.getItem(PERFORMANCE_PENDING_ARCHIVE_KEY)!);raw[0].game.hands[0].trump=raw[0].game.hands[0].trump==='clubs'?'spades':'clubs';storage.setItem(PERFORMANCE_PENDING_ARCHIVE_KEY,JSON.stringify(raw));
  assert.match(readCompletedGameExports(storage,store)[0]!.coverage.join(' '),/disagree about hand 1/);
  storage.data.delete(PERFORMANCE_STORAGE_KEY);storage.data.delete(PERFORMANCE_PENDING_ARCHIVE_KEY);
  const book=JSON.parse(storage.getItem(HAND_REPORT_KEY)!);book.reports=book.reports.filter((r:{state:{phase:string}})=>r.state.phase==='game-over');book.reports[0].state.handNumber=1000000;storage.setItem(HAND_REPORT_KEY,JSON.stringify(book));
  assert.equal(readCompletedGameExports(storage,createHandReportStore(storage)).length,0);
});
test('missing round-one discard is flagged even when numbering was rewritten',()=>{
  const {storage,store}=clone();const raw=JSON.parse(storage.getItem(PERFORMANCE_PENDING_ARCHIVE_KEY)!);const h=raw[0].game.hands.find((h:{round:number})=>h.round===1);assert.ok(h);
  h.decisions=h.decisions.filter((d:{action:{type:string}})=>d.action.type!=='discard');let i=0;for(const hand of raw[0].game.hands)for(const d of hand.decisions)d.sequence=++i;
  storage.setItem(PERFORMANCE_PENDING_ARCHIVE_KEY,JSON.stringify(raw));assert.match(readCompletedGameExports(storage,store)[0]!.coverage.join(' '),/unexpected play, call or discard counts/);
});
