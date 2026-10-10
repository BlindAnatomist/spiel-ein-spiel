import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import { PERFORMANCE_STORAGE_KEY, PERFORMANCE_PENDING_ARCHIVE_KEY, PERFORMANCE_PROFILE_KEY } from '../web/performance.ts';

const flush = () => new Promise<void>(resolve => setImmediate(resolve));
const profile = 'EUC-01234567-89abcdef-01234567-89abcdef';
async function application(mode: 'working' | 'throwing' | 'silent' | 'blocked', context = 'narrator-preview', values: Record<string,string> = {}) {
  const compiled = await build({entryPoints:['web/main.ts'], bundle:true, write:false, format:'esm', target:'safari16',
    define:{__DEPLOY_CONTEXT__:JSON.stringify(context), __NARRATOR_ASSETS_READY__:'false'}});
  const dom = new JSDOM(readFileSync('web/index.html','utf8'), {runScripts:'outside-only',url:'https://local-test.example/'});
  dom.window.structuredClone = structuredClone;
  dom.window.setTimeout = ((callback:()=>void) => {queueMicrotask(callback); return 1;}) as typeof dom.window.setTimeout;
  const prefix = context === 'narrator-preview' ? 'narrator-preview:' : '';
  const data = new Map<string,string>(Object.entries(values));
  data.set(`${prefix}${PERFORMANCE_PROFILE_KEY}`,profile);
  let storageMode = mode;
  Object.defineProperty(dom.window,'localStorage',{value:{
    getItem(key:string) { if (storageMode === 'blocked') throw Error('SecurityError'); return data.get(key) ?? null; },
    setItem(key:string,value:string) { if (storageMode === 'blocked' || storageMode === 'throwing') throw Error('QuotaExceededError'); if (storageMode !== 'silent') data.set(key,value); },
  }});
  const requests: string[] = [];
  const payloads: {url:string; body:string}[] = [];
  let online = false;
  dom.window.fetch = async (input,init) => {
    requests.push(String(input));
    payloads.push({url:String(input),body:String(init?.body ?? '')});
    if (!online) throw Error('offline');
    return {ok:true,json:async()=>({games:[]})} as Response;
  };
  dom.window.eval(compiled.outputFiles[0]!.text);
  const d = dom.window.document;
  return {dom,d,data,requests,payloads,prefix,recover:()=>{storageMode='working';},online:()=>{online=true;}};
}
async function playGame(h: Awaited<ReturnType<typeof application>>) {
  h.d.querySelector<HTMLButtonElement>('#start-game')!.click(); await flush();
  for (let step=0;step<900;step++) {
    if (h.d.querySelector('#result')?.textContent?.includes('win the game')) return;
    const next=h.d.querySelector<HTMLButtonElement>('#next')!;
    if (!next.hidden) next.click();
    else {
      const control=h.d.querySelector<HTMLButtonElement>('#bids button[aria-disabled="false"],#hand button[aria-disabled="false"]');
      assert.ok(control,'playable native control'); control.click();
    }
    await flush();
  }
  assert.fail('Game did not finish');
}
for (const mode of ['throwing','silent','blocked'] as const) {
  test(`bundled UI exposes ${mode} completion failure and Retry saving recovers without another game`, async () => {
    const h=await application(mode); await playGame(h);
    const status=h.d.querySelector<HTMLElement>('#performance-storage-status')!;
    const retry=h.d.querySelector<HTMLButtonElement>('#performance-retry')!;
    assert.equal(status.hidden,false); assert.match(status.textContent!,/unsaved performance data/); assert.match(status.textContent!,/Closing or reloading can lose/);
    assert.equal(retry.hidden,false); assert.equal(h.data.has(`${h.prefix}${PERFORMANCE_STORAGE_KEY}`),false);
    h.d.querySelector<HTMLButtonElement>('#performance-analysis')!.click(); await flush();
    const output=h.d.querySelector<HTMLElement>('#performance-output')!;
    assert.match(output.textContent!,/unsaved performance data/); assert.doesNotMatch(output.textContent!,/Server archive is current/);
    h.recover(); retry.click(); await flush();
    assert.doesNotMatch(status.textContent!,/unsaved/); assert.equal(h.d.activeElement,status);
    assert.equal(JSON.parse(h.data.get(`${h.prefix}${PERFORMANCE_STORAGE_KEY}`)!).games.length,1);
    assert.equal(JSON.parse(h.data.get(`${h.prefix}${PERFORMANCE_PENDING_ARCHIVE_KEY}`)!).length,1);
    retry.click(); await flush();
    assert.equal(JSON.parse(h.data.get(`${h.prefix}${PERFORMANCE_PENDING_ARCHIVE_KEY}`)!).length,1);
    assert.equal(h.requests.length,0,'private preview must never upload');
    assert.equal(h.d.querySelector('#announcements')!.getAttribute('aria-live'),'polite');
    assert.equal(status.getAttribute('role'),'status','storage feedback has its own polite status region');
    assert.equal(h.d.querySelectorAll('[role="status"]').length,2,'separate game and storage status regions');
    h.dom.window.close();
  });
}
test('new game does not discard failure warning or retained completion', async () => {
  const h=await application('silent'); await playGame(h);
  h.d.querySelector<HTMLButtonElement>('#start-game')!.click(); await flush();
  assert.match(h.d.querySelector('#performance-storage-status')!.textContent!,/unsaved/);
  h.recover(); h.d.querySelector<HTMLButtonElement>('#performance-retry')!.click(); await flush();
  assert.equal(JSON.parse(h.data.get(`${h.prefix}${PERFORMANCE_STORAGE_KEY}`)!).games.length,1);
  assert.equal(h.d.querySelectorAll('#hand button').length,5); h.dom.window.close();
});
test('Analysis reports failed server read instead of claiming the archive is current', async () => {
  const h=await application('working','production');
  h.d.querySelector<HTMLButtonElement>('#performance-analysis')!.click(); await flush();
  assert.match(h.d.querySelector('#performance-output')!.textContent!,/Server history could not be loaded/);
  assert.doesNotMatch(h.d.querySelector('#performance-output')!.textContent!,/Server archive is current/);
  h.dom.window.close();
});
test('saved production queue reload retries once and keeps preview keys untouched', async () => {
  const producer=await application('working'); await playGame(producer);
  const saved=producer.data.get(`${producer.prefix}${PERFORMANCE_PENDING_ARCHIVE_KEY}`)!; producer.dom.window.close();
  const h=await application('working','production',{[PERFORMANCE_PENDING_ARCHIVE_KEY]:saved, ['narrator-preview:'+PERFORMANCE_PENDING_ARCHIVE_KEY]:'[]'});
  await flush(); assert.equal(JSON.parse(h.data.get(PERFORMANCE_STORAGE_KEY)!).games.length,1,'summary recovered before upload');
  h.online(); h.d.querySelector<HTMLButtonElement>('#performance-retry')!.click(); await flush(); await flush();
  assert.equal(h.data.get(PERFORMANCE_PENDING_ARCHIVE_KEY),'[]');
  assert.equal(h.data.get('narrator-preview:'+PERFORMANCE_PENDING_ARCHIVE_KEY),'[]');
  const count=h.requests.filter(value=>value==='/').length;
  h.d.querySelector<HTMLButtonElement>('#performance-analysis')!.click(); await flush();
  assert.equal(h.requests.filter(value=>value==='/').length,count);
  assert.equal(h.d.querySelector<HTMLElement>('#game')!.hidden,true); h.dom.window.close();
});

test('blocked queue reads report unknown status without an unverified empty-queue claim', async () => {
  const h=await application('blocked','production');
  h.d.querySelector<HTMLButtonElement>('#performance-analysis')!.click(); await flush();
  const output=h.d.querySelector('#performance-output')!.textContent!;
  assert.match(output,/Archive status is unknown/);
  assert.doesNotMatch(output,/No archives are waiting|Server archive is current/);
  h.dom.window.close();
});

test('queue retries keep the original profile for both endpoints even if the page profile differs', async () => {
  const producer=await application('working'); await playGame(producer);
  const items=JSON.parse(producer.data.get(`${producer.prefix}${PERFORMANCE_PENDING_ARCHIVE_KEY}`)!);
  const original='EUC-original-queued-profile-123456789'; items[0].profileId=original; producer.dom.window.close();
  const h=await application('working','production',{[PERFORMANCE_PENDING_ARCHIVE_KEY]:JSON.stringify(items)});
  await flush(); h.online(); h.d.querySelector<HTMLButtonElement>('#performance-retry')!.click(); await flush(); await flush();
  const summaries=h.payloads.filter(request=>request.url==='/api/performance-history').map(request=>JSON.parse(request.body)).filter(body=>body.action==='upsert');
  assert.ok(summaries.length>0); assert.ok(summaries.every(body=>body.profileId===original));
  const forms=h.payloads.filter(request=>request.url==='/').map(request=>new URLSearchParams(request.body));
  assert.equal(forms.length,1); assert.equal(forms[0]!.get('profile_id'),original);
  assert.equal(h.data.get(PERFORMANCE_PROFILE_KEY),profile,'existing page profile is untouched'); h.dom.window.close();
});
