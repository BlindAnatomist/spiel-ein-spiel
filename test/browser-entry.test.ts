import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
test('bundled browser entry randomizes dealer, uses live randomness, and plays through native controls', async () => {
  const output=await build({entryPoints:['web/main.ts'],bundle:true,write:false,format:'esm',target:'safari16'});
  const dom=new JSDOM(readFileSync('web/index.html','utf8'),{runScripts:'outside-only',url:'http://localhost/'});
  // Test time advances instantly; production uses the serial announcement delay.
  dom.window.setTimeout=((callback:()=>void)=>{queueMicrotask(callback);return 1;}) as typeof dom.window.setTimeout;
  // jsdom omits this browser API; use Node's native implementation in the harness.
  dom.window.structuredClone=structuredClone;
  let randomCalls=0;
  // 73 & 3 = seat 1, making the randomized left-seat dealer observable.
  Object.defineProperty(dom.window.crypto,'getRandomValues',{value:(array:Uint32Array)=>{randomCalls++;array[0]=73;return array;}});
  dom.window.eval(output.outputFiles[0]!.text);
  const d=dom.window.document;
  (d.querySelector('#setup button[type="submit"]') as HTMLButtonElement).click();
  const flush=()=>new Promise<void>(resolve=>setImmediate(resolve));
  await flush();
  assert.equal((d.querySelector('#game') as HTMLElement).hidden,false);
  assert.match(d.querySelector('#facts')!.textContent!,/Dealer: W/);
  assert.match(d.querySelector('.west')!.textContent!,/^W/);
  assert.match(d.querySelector('.east')!.textContent!,/^E/);
  assert.ok(randomCalls>=25); // dealer + seed + 23 shuffle draws
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
  assert.ok(randomCalls>=25 + hands*23);
  dom.window.close();
});
