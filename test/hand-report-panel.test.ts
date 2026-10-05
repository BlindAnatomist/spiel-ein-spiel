import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { build } from 'esbuild';
import { createHandReportStore, createHandReportRecorder, HAND_REPORT_KEY } from '../web/hand-report.ts';
import { createHandReportPanel } from '../web/hand-report-panel.ts';
import { createSession } from '../web/session.ts';
import { names } from '../web/presentation.ts';
const flush=()=>new Promise<void>(resolve=>setImmediate(resolve));
function panel() {
  const dom=new JSDOM(readFileSync('web/index.html','utf8'),{url:'https://preview.example/'}),d=dom.window.document;
  const store=createHandReportStore(dom.window.localStorage);
  const recorder=createHandReportRecorder(store,{gameId:'finished',buildCommit:'test',catalogSha:'test-sha',seatNames:names},{});
  const view=createSession(4,'strong').view();
  recorder.observe({kind:'checkpoint',view:{...view,phase:'hand-over',turn:null,trump:'hearts',completedTricks:[{winner:0,plays:[{seat:0,card:'hearts:J'},{seat:1,card:'clubs:A'}]}],result:{team:0,makerTricks:3,points:1,reason:'made'}},pacing:'visual',audioEnabled:false});
  const fresh=createHandReportRecorder(store,{gameId:'new',buildCommit:'test',catalogSha:'test-sha',seatNames:names},{});
  fresh.observe({kind:'checkpoint',view,pacing:'visual',audioEnabled:false});
  const order:string[]=[];const focus=dom.window.HTMLElement.prototype.focus;
  dom.window.HTMLElement.prototype.focus=function(){order.push(`focus:${this.id}`);focus.call(this);};
  const api=createHandReportPanel(d,store,()=>{order.push('pause');});
  d.querySelector<HTMLElement>('#help-panel')!.hidden=false;
  const get=<T extends HTMLElement>(id:string)=>d.getElementById(id) as T;
  return {dom,d,store,api,get,order};
}
test('native report controls pause before focus, default to last played hand, and remain available before any new game', () => {
  const h=panel();h.get<HTMLButtonElement>('saved-hand-report').click();
  assert.deepEqual(h.order.slice(0,2),['pause','focus:hand-report-title']);
  assert.equal(h.d.activeElement,h.get('hand-report-title'));
  assert.equal(h.get<HTMLSelectElement>('hand-report-selection').value,'finished:1');
  assert.equal(h.get<HTMLSelectElement>('hand-report-selection').options.length,2);
  assert.match(h.get<HTMLTextAreaElement>('hand-report-text').value,/Engine winner: You/);
  assert.equal(h.get<HTMLTextAreaElement>('hand-report-text').readOnly,true);
  assert.equal(h.d.querySelectorAll('[aria-live]').length,1);assert.equal(h.get('announcements').textContent,'');
  h.get<HTMLButtonElement>('hand-report-close').click();
  assert.equal(h.get('hand-report-panel').hidden,true);assert.equal(h.d.activeElement,h.get('saved-hand-report'));
  assert.equal(h.order.filter(x=>x==='pause').length,1);h.dom.window.close();
});
test('copy success and clipboard denial have accessible native fallback without sighted selection', async () => {
  for(const mode of ['success','denied-native-copy','denied-manual-copy','missing'] as const) {
    const h=panel();let copied='';
    if(mode!=='missing')Object.defineProperty(h.dom.window.navigator,'clipboard',{value:{writeText:async(text:string)=>{if(mode==='success')copied=text;else throw Error('NotAllowedError');}}});
    if(mode==='denied-native-copy')Object.defineProperty(h.d,'execCommand',{value:(command:string)=>{assert.equal(command,'copy');copied=h.get<HTMLTextAreaElement>('hand-report-text').value;return true;}});
    h.get<HTMLButtonElement>('saved-hand-report').click();h.get<HTMLButtonElement>('hand-report-copy').focus();h.get<HTMLButtonElement>('hand-report-copy').click();await flush();
    const text=h.get<HTMLTextAreaElement>('hand-report-text');
    if(mode==='success'||mode==='denied-native-copy'){assert.match(copied,/Euchre saved hand report/);assert.match(h.get('hand-report-status').textContent!,/Report copied/);assert.equal(h.d.activeElement,h.get('hand-report-status'));}
    else {assert.match(h.get('hand-report-status').textContent!,/Automatic copy is unavailable/);assert.equal(h.d.activeElement,text);assert.equal(text.selectionStart,0);assert.equal(text.selectionEnd,text.value.length);}
    assert.equal(h.get('announcements').textContent,'');h.dom.window.close();
  }
});
test('late clipboard completion never steals focus after Close, Select all, another focus target, or a new opening', async () => {
  for(const action of ['close','select','focus','reopen'] as const) {
    const h=panel();let finish:()=>void=()=>{};Object.defineProperty(h.dom.window.navigator,'clipboard',{value:{writeText:()=>new Promise<void>(r=>{finish=r;})}});
    h.get<HTMLButtonElement>('saved-hand-report').click();h.get<HTMLButtonElement>('hand-report-copy').focus();h.get<HTMLButtonElement>('hand-report-copy').click();
    if(action==='close')h.get<HTMLButtonElement>('hand-report-close').click();
    else if(action==='select')h.get<HTMLButtonElement>('hand-report-select-all').click();
    else if(action==='focus')h.get<HTMLSelectElement>('hand-report-selection').focus();
    else h.get<HTMLButtonElement>('saved-hand-report').click();
    const target=h.d.activeElement;finish();await flush();assert.equal(h.d.activeElement,target);h.dom.window.close();
  }
});
test('same-origin closed preview reopens retained report without auto-start, requests, speech or focus jumps', async () => {
  const compiled=await build({entryPoints:['web/main.ts'],bundle:true,write:false,format:'esm',target:'safari16',define:{__BUILD_COMMIT__:JSON.stringify('report-test'),__DEPLOY_CONTEXT__:JSON.stringify('narrator-preview'),__NARRATOR_ASSETS_READY__:'true'}});
  const saved=panel();const raw=saved.dom.window.localStorage.getItem(HAND_REPORT_KEY)!;saved.dom.window.close();
  const load=()=>{const dom=new JSDOM(readFileSync('web/index.html','utf8'),{runScripts:'outside-only',url:'https://preview.example/'});dom.window.structuredClone=structuredClone;let requests=0;dom.window.fetch=async()=>{requests++;throw Error('No upload');};dom.window.localStorage.setItem(`narrator-preview:${HAND_REPORT_KEY}`,raw);dom.window.eval(compiled.outputFiles[0]!.text);return {dom,d:dom.window.document,requests:()=>requests};};
  const h=load();assert.equal(h.d.activeElement,h.d.body);assert.equal(h.d.querySelector<HTMLElement>('#game')!.hidden,true);
  h.d.querySelector<HTMLButtonElement>('#help-button')!.click();h.d.querySelector<HTMLButtonElement>('#saved-hand-report')!.click();
  assert.match(h.d.querySelector<HTMLTextAreaElement>('#hand-report-text')!.value,/Engine winner: You/);assert.equal(h.requests(),0);assert.equal(h.d.querySelector('#announcements')!.textContent,'');h.dom.window.close();
});
test('live browser report pauses speech, preserves card nodes and hides safely on resume, help close and new game', async () => {
  const compiled=await build({entryPoints:['web/main.ts'],bundle:true,write:false,format:'esm',target:'safari16',define:{__BUILD_COMMIT__:JSON.stringify('report-test'),__DEPLOY_CONTEXT__:JSON.stringify('narrator-preview'),__NARRATOR_ASSETS_READY__:'true'}});
  const dom=new JSDOM(readFileSync('web/index.html','utf8'),{runScripts:'outside-only',url:'https://preview.example/'});dom.window.structuredClone=structuredClone;dom.window.fetch=async()=>{throw Error('No upload');};dom.window.setTimeout=((_callback:()=>void)=>1) as typeof dom.window.setTimeout;
  let pauses=0,plays=0;class Media extends EventTarget {src='';preload='';currentTime=0;ended=false;error=null;play(){plays++;return Promise.resolve();}pause(){pauses++;}}dom.window.Audio=Media as unknown as typeof dom.window.Audio;
  dom.window.eval(compiled.outputFiles[0]!.text);const d=dom.window.document;const get=<T extends HTMLElement>(id:string)=>d.getElementById(id) as T;
  get<HTMLButtonElement>('narrator').click();get<HTMLFormElement>('setup').dispatchEvent(new dom.window.Event('submit',{cancelable:true,bubbles:true}));await flush();
  const cards=[...d.querySelectorAll('#hand button')];get<HTMLButtonElement>('help-button').click();const played=plays;get<HTMLButtonElement>('saved-hand-report').click();await flush();
  assert.ok(pauses>0);assert.equal(plays,played);assert.equal(get('pause-game').textContent,'Resume game');assert.equal(d.activeElement,get('hand-report-title'));assert.deepEqual([...d.querySelectorAll('#hand button')],cards);assert.equal(get('announcements').textContent,'');
  get<HTMLButtonElement>('hand-report-close').click();assert.equal(get('pause-game').textContent,'Resume game');get<HTMLButtonElement>('saved-hand-report').click();get<HTMLButtonElement>('pause-game').click();await flush();assert.equal(get('hand-report-panel').hidden,true);
  get<HTMLButtonElement>('saved-hand-report').click();get<HTMLButtonElement>('help-button').click();assert.equal(get('hand-report-panel').hidden,true);assert.equal(d.activeElement,get('help-button'));
  get<HTMLButtonElement>('help-button').click();get<HTMLButtonElement>('saved-hand-report').click();get<HTMLFormElement>('setup').dispatchEvent(new dom.window.Event('submit',{cancelable:true,bubbles:true}));await flush();assert.equal(get('hand-report-panel').hidden,true);dom.window.close();
});
