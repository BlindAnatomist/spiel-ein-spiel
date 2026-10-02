import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { build } from 'esbuild';
const app = fileURLToPath(new URL('../', import.meta.url));
async function load(ready: boolean) {
  const compiled = await build({ absWorkingDir: app, entryPoints: ['web/main.ts'], bundle: true, write: false, format: 'esm', target: 'safari16',
    define: { __BUILD_COMMIT__: JSON.stringify('review123'), __DEPLOY_CONTEXT__: JSON.stringify('narrator-preview'), __NARRATOR_ASSETS_READY__: String(ready) } });
  const dom = new JSDOM(readFileSync(new URL('../web/index.html', import.meta.url), 'utf8'), { runScripts: 'outside-only', url: 'https://preview.example/' });
  dom.window.structuredClone = structuredClone;
  let requests = 0;
  dom.window.fetch = async () => { requests++; throw Error('Unexpected network'); };
  dom.window.eval(compiled.outputFiles[0]!.text);
  const diagnostics = () => (dom.window as unknown as { euchreNarratorDiagnostics: { selectedNarrator: string; gameStarted: boolean; audioEnabled: boolean } }).euchreNarratorDiagnostics;
  return { dom, d: dom.window.document, diagnostics, requests: () => requests };
}
test('review: Narrator is one concise native button, with explanations and samples removed from the toolbar', async () => {
  const h = await load(true), n = h.d.querySelector<HTMLButtonElement>('#narrator')!;
  assert.equal(n.tagName, 'BUTTON'); assert.equal(n.type, 'button'); assert.equal(n.hasAttribute('aria-describedby'), false);
  assert.match(n.textContent!, /^Narrator: (Original|VoiceOver)$/);
  assert.equal(h.d.querySelector('#voice-samples'), null); assert.equal(h.d.querySelector('#narrator-help'), null);
  assert.equal(h.d.querySelector<HTMLElement>('#help-panel')!.hidden, true);
  assert.equal(h.d.querySelector('#preview-notice')!.closest<HTMLElement>('#help-panel')!.hidden, true);
  n.focus(); n.click(); assert.equal(h.d.activeElement, n); assert.equal(n.textContent, 'Narrator: Peter');
  assert.equal(h.diagnostics().selectedNarrator, 'peter'); assert.equal(h.diagnostics().gameStarted, false); assert.equal(h.diagnostics().audioEnabled, false);
  n.click(); assert.match(n.textContent!, /^Narrator: (Original|VoiceOver)$/); assert.equal(h.diagnostics().selectedNarrator, 'original');
  assert.equal(h.d.querySelector('#announcements')!.textContent, ''); assert.equal(h.requests(), 0); h.dom.window.close();
});
test('review: unavailable recording pack disables Peter safely without a broken samples link', async () => {
  const h = await load(false), n = h.d.querySelector<HTMLButtonElement>('#narrator')!;
  assert.equal(n.disabled, true); n.click(); assert.equal(n.value, 'original');
  assert.equal(h.d.querySelector('#voice-samples'), null); assert.match(h.d.querySelector('#narrator-availability')!.textContent!, /unavailable/);
  h.dom.window.close();
});
test('review: pagehide and hidden-document hooks pause recorded play without stale media or card replacement', async () => {
  for (const kind of ['pagehide','visibilitychange'] as const) {
    const h=await load(true);const instances:Media[]=[];let pauses=0;
    class Media extends EventTarget {
      src='';preload='';currentTime=0;ended=false;error=null;
      constructor(){super();instances.push(this);}
      play(){return Promise.resolve();}
      pause(){pauses++;}
      end(){this.ended=true;this.dispatchEvent(new Event('ended'));}
    }
    h.dom.window.Audio=Media as unknown as typeof h.dom.window.Audio;
    h.dom.window.setTimeout=((_callback:()=>void)=>1) as typeof h.dom.window.setTimeout;
    const narrator=h.d.querySelector<HTMLButtonElement>('#narrator')!;narrator.click();
    h.d.querySelector<HTMLFormElement>('#setup')!.dispatchEvent(new h.dom.window.Event('submit',{bubbles:true,cancelable:true}));
    const cards=[...h.d.querySelectorAll('#hand button')];assert.equal(cards.length,5);
    const labels=cards.map(card=>card.getAttribute('aria-label'));
    if(kind==='pagehide')h.dom.window.dispatchEvent(new h.dom.window.Event('pagehide'));
    else {Object.defineProperty(h.d,'hidden',{configurable:true,value:true});h.d.dispatchEvent(new h.dom.window.Event('visibilitychange'));}
    await new Promise<void>(resolve=>setImmediate(resolve));
    assert.equal((h.diagnostics() as unknown as {paused:boolean}).paused,true);assert.ok(pauses>0);
    for(const media of instances)media.end();await new Promise<void>(resolve=>setImmediate(resolve));
    assert.deepEqual([...h.d.querySelectorAll('#hand button')],cards);assert.deepEqual(cards.map(card=>card.getAttribute('aria-label')),labels);
    assert.equal(h.d.querySelector('#announcements')!.textContent,'');h.dom.window.close();
  }
});
