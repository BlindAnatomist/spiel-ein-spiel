import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';

const flush = () => new Promise<void>(resolve => setImmediate(resolve));
test('phone narration status pauses before focus and clears on mode, resume and restart', async () => {
  const bundle=await build({entryPoints:['web/main.ts'],bundle:true,write:false,format:'esm',target:'safari16',define:{__BUILD_COMMIT__:JSON.stringify('status-test'),__DEPLOY_CONTEXT__:JSON.stringify('narrator-preview'),__NARRATOR_ASSETS_READY__:'true'}});
  const dom=new JSDOM(readFileSync('web/index.html','utf8'),{runScripts:'outside-only',url:'https://preview.example/'});
  dom.window.structuredClone=structuredClone;
  dom.window.fetch=async()=>{throw Error('Preview status must not send a request');};
  let timer=0;
  dom.window.setTimeout=((_callback:()=>void)=>++timer) as typeof dom.window.setTimeout;
  const order:string[]=[];
  class Media extends EventTarget {
    src='';preload='';currentTime=0;ended=false;error=null;
    play(){return Promise.resolve();} // Hold gesture priming until a user stops it.
    pause(){order.push('media-paused');}
  }
  dom.window.Audio=Media as unknown as typeof dom.window.Audio;
  dom.window.eval(bundle.outputFiles[0]!.text);
  const d=dom.window.document;
  const focus=dom.window.HTMLElement.prototype.focus;
  dom.window.HTMLElement.prototype.focus=function(){order.push(`focus:${this.id}`);focus.call(this);};
  const selector=d.querySelector<HTMLButtonElement>('#narrator')!;
  const setup=d.querySelector<HTMLFormElement>('#setup')!;
  const check=d.querySelector<HTMLButtonElement>('#narrator-status')!;
  const status=d.querySelector<HTMLElement>('#narrator-status-output')!;
  const resume=d.querySelector<HTMLButtonElement>('#pause-game')!;
  const live=d.querySelector<HTMLElement>('#announcements')!;
  selector.click();
  setup.dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));await flush();
  const cards=[...d.querySelectorAll('#hand button')];assert.equal(cards.length,5);
  const labels=cards.map(card=>card.textContent);
  d.querySelector<HTMLButtonElement>('#help-button')!.click();
  order.length=0;check.click();await flush();
  assert.match(status.textContent!,/Narrator: Peter.*version status-.*Game paused/);
  assert.ok(order.indexOf('media-paused')>=0);assert.ok(order.indexOf('media-paused')<order.indexOf('focus:narrator-status-output'));
  assert.equal(live.textContent,'');assert.equal(d.activeElement,status);
  assert.deepEqual([...d.querySelectorAll('#hand button')],cards);assert.deepEqual(cards.map(card=>card.textContent),labels);
  selector.click();
  assert.equal(status.hidden,true);assert.equal(status.textContent,'');assert.equal(d.activeElement,selector);
  check.click();await flush();assert.match(status.textContent!,/Original VoiceOver/);
  resume.click();assert.equal(d.activeElement,resume);await flush();assert.equal(status.hidden,true);assert.equal(status.textContent,'');
  check.click();await flush();assert.equal(status.hidden,false);assert.equal(live.textContent,'');
  setup.dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));await flush();
  assert.equal(status.hidden,true);assert.equal(status.textContent,'');
  resume.click();await flush();dom.window.close();
});
