/** Local-only browser layout harness; never copied by the production build. */
import { build } from 'esbuild';
import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { createReferee } from '../src/referee.ts';
const output = process.argv[2] ?? '/workspace/scratch/euchre-mobile-layout';
await mkdir(output,{recursive:true});
const bid=createReferee({seed:17,dealer:3});
const round1=bid.player(0).view();
for(let i=0;i<4;i++)bid.player(bid.player(0).view().turn!).act({type:'pass'});
const round2=bid.player(0).view();
const game=createReferee({seed:7,dealer:0});game.player(1).act({type:'order-up',alone:false});
const discard=game.player(0).view();game.player(0).act(discard.legalActions[0]!);
for(let i=0;i<3;i++){const port=game.player(game.player(0).view().turn!);port.act(port.view().legalActions[0]!);}
const play=game.player(0).view();game.player(0).act(play.legalActions[0]!);
const held=game.player(0).view();
const port=game.player(held.turn!);port.act(port.view().legalActions[0]!);
const next=game.player(0).view();
const states={round1,round2,discard,play,held,next};
const html=(await readFile('web/index.html','utf8')).replace('src="app.js"','src="fixture.js"');
await writeFile(`${output}/frame.html`,html);
await copyFile('web/style.css',`${output}/style.css`);
await build({stdin:{contents:`import {createTable} from './web/render.ts';
const states=${JSON.stringify(states)};
const params=new URLSearchParams(location.search);const state=states[params.get('phase')||'play'];
const root=document.querySelector('#game');root.hidden=false;
const table=createTable(root,{act:()=>{},next:()=>{}});table.render(state);
document.querySelector('#setup').onsubmit=e=>e.preventDefault();
requestAnimationFrame(()=>requestAnimationFrame(()=>{
 const d=document.documentElement;const hand=[...document.querySelectorAll('#hand button')];
 const controls=[...document.querySelectorAll('button,select')].filter(e=>e.getBoundingClientRect().width>0);
 const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,bottom:r.bottom,right:r.right}};
 const data={phase:params.get('phase'),width:innerWidth,height:innerHeight,scrollWidth:d.scrollWidth,scrollHeight:d.scrollHeight,
 bottom:Math.max(...controls.map(e=>e.getBoundingClientRect().bottom)),hand:hand.map(rect),table:rect(document.querySelector('.table')),
 controls:controls.map(e=>({name:e.getAttribute('aria-label')||e.textContent,...rect(e)}))};
 parent.postMessage(data,'*');
}));`,resolveDir:process.cwd(),loader:'ts'},bundle:true,format:'iife',outfile:`${output}/fixture.js`,target:'safari16'});
const css=await readFile('web/style.css','utf8');
const js=await readFile(`${output}/fixture.js`,'utf8');
const escape=(s:string)=>s.replaceAll('&','&amp;').replaceAll('"','&quot;');
const frame=(phase:string)=>escape(html.replace('<link rel="stylesheet" href="style.css">',`<style>${css}</style>`).replace('<script type="module" src="fixture.js"></script>','').replace('</body>',`<script>${js.replace("new URLSearchParams(location.search)",`new URLSearchParams('phase=${phase}')`)}</script></body>`));
const widths=[[375,600],[390,650],[430,740]];
await writeFile(`${output}/index.html`,`<!doctype html><html><head><meta charset="utf-8"><title>Mobile layout regression</title></head><body style="margin:16px;background:#eee;font:16px system-ui"><h1>Mobile layout regression</h1><p>Independent document viewports with browser chrome already subtracted. Production CSS and renderer; public engine states only.</p><div id="results"></div><div style="display:flex;gap:20px;flex-wrap:wrap">${widths.flatMap(([w,h])=>Object.keys(states).map(phase=>`<section><h2>${w} × ${h}: ${phase}</h2><iframe title="${w} ${phase}" srcdoc="${frame(phase)}" width="${w}" height="${h}" style="border:1px solid #999"></iframe></section>`)).join('')}</div><script>
addEventListener('message',e=>{if(e.origin!==location.origin)return;const d=e.data;if(!d.hand)return;
const pass=d.scrollWidth===d.width&&d.scrollHeight===d.height&&d.bottom<=d.height-24&&d.hand.every(r=>r.y===d.hand[0].y&&r.w>=48)&&d.controls.every(r=>r.w>=48&&r.h>=48);
const p=document.createElement('pre');p.className=pass?'pass':'fail';p.textContent=JSON.stringify({pass,...d});document.querySelector('#results').append(p);});
</script></body></html>`);
console.log(`Layout fixtures: ${output}/index.html`);
