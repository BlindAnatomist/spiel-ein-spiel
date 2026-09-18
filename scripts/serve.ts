import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
const files = new Map([['/', ['index.html','text/html']], ['/app.js',['app.js','text/javascript']], ['/style.css',['style.css','text/css']]]);
createServer(async (req, res) => {
  const entry = files.get((req.url ?? '/').split('?')[0]!);
  if (!entry) { res.writeHead(404); res.end(); return; }
  try { res.setHeader('Content-Type', entry[1]!); res.end(await readFile(`dist/${entry[0]}`)); }
  catch { res.writeHead(500); res.end('Run npm run build first.'); }
}).listen(4173, '0.0.0.0', () => console.log('Euchre: http://localhost:4173 (or this computer’s LAN address on your iPhone)'));
