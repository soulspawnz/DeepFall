import http from 'node:http';
import { readFile } from 'node:fs/promises';

const files = new Map([
  ['/live-replays.mjs',['live-replays.mjs','text/javascript; charset=utf-8']],
  ['/playtests.css',['playtests.css','text/css; charset=utf-8']],
  ...['A','B'].map(id=>[`/docs/live-${id}-won.png`,[`docs/live-${id}-won.png`,'image/png']]),
  ['/playtests.json',['docs/playtest-original.json','application/json; charset=utf-8']],
  ['/docs/playtest-original.json',['docs/playtest-original.json','application/json; charset=utf-8']],
  ['/fullscreen.css',['fullscreen.css','text/css; charset=utf-8']],
  ['/fullscreen.mjs',['fullscreen.mjs','text/javascript; charset=utf-8']],
  ['/vendor/original-media/sprites.png',['vendor/original-media/sprites.png','image/png']],
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/style.css', ['style.css', 'text/css; charset=utf-8']],
  ['/audio.css', ['audio.css', 'text/css; charset=utf-8']],
  ['/campaign.css', ['campaign.css', 'text/css; charset=utf-8']],
  ...['original-data.mjs','original-caves.mjs','sprites.mjs','original-sfx.mjs','original-sfx-data.mjs'].map(file=>['/'+file,[file,'text/javascript; charset=utf-8']]),
  ['/main.mjs', ['main.mjs', 'text/javascript; charset=utf-8']],
  ['/engine.mjs', ['engine.mjs', 'text/javascript; charset=utf-8']],
  ...['audio.mjs', 'sid-engine.mjs', 'sid-worklet.mjs'].map(file => ['/' + file, [file, 'text/javascript; charset=utf-8']]),
  ...['resid.mjs', 'jssid.core.js', 'jssid.resid.js', 'stream.js', 'jsxcompressor.js'].map(file => ['/vendor/jssid/' + file, ['vendor/jssid/' + file, 'text/javascript; charset=utf-8']]),
  ['/vendor/jssid/LICENSE.md', ['vendor/jssid/LICENSE.md', 'text/plain; charset=utf-8']],
  ['/vendor/jssid/UPSTREAM.json', ['vendor/jssid/UPSTREAM.json', 'application/json; charset=utf-8']],
]);
const port = Number(process.env.DEEPFALL_PORT ?? 8767);
const server = http.createServer(async (request, response) => {
  if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405, { Allow: 'GET, HEAD' }).end(); return; }
  const path = request.url.split('?')[0];
  const file = files.get(path);
  if (!file) { response.writeHead(404).end('Not found'); return; }
  try {
    const body = await readFile(new URL(file[0], import.meta.url));
    response.writeHead(200, { 'Content-Type': file[1], 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch { response.writeHead(500).end('Unable to read game file'); }
});
server.on('error', error => { console.error('[FAIL]', error.message); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => console.log(`[OK] Deepfall: http://127.0.0.1:${port}/`));
