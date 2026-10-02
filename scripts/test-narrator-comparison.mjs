import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const html=fs.readFileSync(new URL('../web/repair-audio/index.html',import.meta.url),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
assert.equal((html.match(/data-play=/g)||[]).length,8);
assert.equal((html.match(/<audio /g)||[]).length,1);
assert(!/autoplay|aria-live/.test(html));
const timers=new Map();let id=0;
const events=new Map();const browserEvents=new Map();
const error={value:'',writes:0,get textContent(){return this.value;},set textContent(v){this.value=v;this.writes++;}};
const media={src:'',error:null,history:[],
  play(){this.history.push(this.src);const result=this.nextPromise||Promise.resolve();this.nextPromise=null;return result;},
  pause(){this.paused=true;},removeAttribute(name){if(name==='src')this.src='';},load(){},
  addEventListener(n,f){events.set(n,f);},removeEventListener(n,f){if(events.get(n)===f)events.delete(n);}};
const buttons=[...html.matchAll(/data-play="([^"]+)"/g)].map(m=>({dataset:{play:m[1]},addEventListener(n,f){this[n]=f;}}));
const stops=[{addEventListener(n,f){this[n]=f;}}];
const document={hidden:false,getElementById:id=>id==='player'?media:error,querySelectorAll:s=>s==='[data-play]'?buttons:stops,addEventListener(n,f){browserEvents.set(n,f);}};
const context=vm.createContext({document,window:{addEventListener(n,f){browserEvents.set(n,f);}},performance:{now:()=>0},Promise,
  setTimeout(f,ms){assert(ms>=1800);timers.set(++id,f);return id;},clearTimeout(i){timers.delete(i);}});
vm.runInContext(script,context);
const flush=async()=>{await Promise.resolve();await Promise.resolve();};
const fire=()=>{const callbacks=[...timers.values()];timers.clear();callbacks.forEach(f=>f());};
assert.equal(media.history.length,0,'no autoplay');
buttons[0].click();await flush();assert.equal(media.history.length,1);assert(media.history[0].startsWith('data:audio/wav'));
assert.equal(timers.size,1);fire();assert.equal(media.src,buttons[0].dataset.play);
buttons[1].click();buttons[2].click();await flush();assert.equal(timers.size,1,'newest selection only');fire();assert.equal(media.src,buttons[2].dataset.play);
buttons[3].click();await flush();stops[0].click();fire();assert.equal(media.src,'','stop cancels delayed start');
buttons[4].click();await flush();browserEvents.get('pagehide')();fire();assert.equal(media.src,'','pagehide cancels delayed start');
buttons[5].click();await flush();document.hidden=true;browserEvents.get('visibilitychange')();fire();assert.equal(media.src,'','backgrounding stops playback');document.hidden=false;
buttons[6].click();await flush();media.error={code:4};events.get('error')();assert(error.textContent.includes('could not play'));assert.equal(timers.size,0,'error cancels delayed start');
media.error=null;let resolvePrime;media.nextPromise=new Promise(resolve=>{resolvePrime=resolve;});
buttons[7].click();const staleError=events.get('error');media.error={code:4};staleError();const afterFailure=error.writes;const historyAfterFailure=media.history.length;
staleError();assert.equal(error.writes,afterFailure,'failure text written once');assert(!events.has('error'),'failed attempt detaches error listener');
resolvePrime();await flush();assert.equal(timers.size,0,'late prime resolution cannot revive failed attempt');fire();assert.equal(media.history.length,historyAfterFailure,'no speech after failed prime');
console.log('PASS: no autoplay, one gesture-primed element, delayed playback, newest-selection wins, Stop/pagehide/hidden/error cancellation, late-prime-resolution suppression, single failure announcement');
