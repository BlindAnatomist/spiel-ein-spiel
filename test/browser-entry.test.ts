import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
test('bundled browser entry starts, bids, discards and plays through the native DOM controls', async () => {
  const output=await build({entryPoints:['web/main.ts'],bundle:true,write:false,format:'esm',target:'safari16'});
  const dom=new JSDOM(readFileSync('web/index.html','utf8'),{runScripts:'outside-only',url:'http://localhost/'});
  // Test time advances instantly; production uses the serial announcement delay.
  dom.window.setTimeout=((callback:()=>void)=>{queueMicrotask(callback);return 1;}) as typeof dom.window.setTimeout;
  // jsdom omits this browser API; use Node's native implementation in the harness.
  dom.window.structuredClone=structuredClone;
  Object.defineProperty(dom.window.crypto,'getRandomValues',{value:(array:Uint32Array)=>{array[0]=72;return array;}});
  dom.window.eval(output.outputFiles[0]!.text);
  const d=dom.window.document;
  (d.querySelector('#setup button') as HTMLButtonElement).click();
  const flush=()=>new Promise<void>(resolve=>setImmediate(resolve));
  await flush();
  assert.equal((d.querySelector('#game') as HTMLElement).hidden,false);
  let hands=0;
  for(let step=0;step<600;step++) {
    const result=d.querySelector('#result')!;
    if(result.textContent!.includes('win the game')) break;
    const next=d.querySelector<HTMLButtonElement>('#next')!;
    if(!next.hidden) {hands++; next.click();}
    else {
      const control=d.querySelector<HTMLButtonElement>('#bids button[aria-disabled="false"],#hand button[aria-disabled="false"]');
      assert.ok(control,`UI has a human action or a hand result after bots settle: ${d.querySelector('#game')!.innerHTML}`); control.click();
    }
    await flush();
  }
  assert.ok(hands>0);
  assert.match(d.querySelector('#result')!.textContent!,/win the game/);
  assert.ok(d.querySelector('#game')!.contains(d.activeElement));
  dom.window.close();
});
