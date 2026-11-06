// Local dev server for the map: serves the repo root without caching and takes GM edit-mode writes.
// It binds 127.0.0.1 only and writes two targets:
//   POST /api/places    → spikes/map/places.json
//   POST /api/requests  → spikes/map/requests/<id>.json and <id>.png
// GET /api/requests lists the request files.
// Run from anywhere: node spikes/map/gen/serve.mjs [port]   (default 8766)

import { createServer } from 'node:http';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validPlaces } from './places-shape.mjs';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const MAP = join(ROOT, 'spikes', 'map');
const PLACES = join(MAP, 'places.json');
const REQS = join(MAP, 'requests');
const PORT = +(process.argv[2] ?? 8766);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary',
  '.wasm': 'application/wasm', '.woff2': 'font/woff2', '.md': 'text/plain; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };

const REQ_ID = /^\d{4}-\d{2}-\d{2}-[a-z0-9-]{1,60}$/;

const send = (res, code, body, type = 'application/json') => {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
};

// Body up to 25 MB: a request carries one screenshot.

const readBody = req => new Promise((ok, fail) => {
  const parts = []; let n = 0;
  req.on('data', c => { n += c.length; if (n > 25e6) { fail(new Error('too large')); req.destroy(); } else parts.push(c); });
  req.on('end', () => ok(Buffer.concat(parts).toString('utf8')));
  req.on('error', fail);
});

// Cross-site pages cannot write: a JSON content type forces a CORS preflight this server never answers,
// and the Origin must be this server.

const sameOrigin = req => {
  const o = req.headers.origin;
  return !o || /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(o);
};

async function api(req, res, path) {
  if (path === '/api/requests' && req.method === 'GET') {
    const rows = existsSync(REQS) ? readdirSync(REQS).filter(f => f.endsWith('.json')).sort()
      .map(f => { try { return JSON.parse(readFileSync(join(REQS, f), 'utf8')); } catch { return null; } }).filter(Boolean) : [];
    return send(res, 200, rows);
  }
  if (req.method !== 'POST') return send(res, 405, { error: 'method' });
  if (!sameOrigin(req) || !String(req.headers['content-type']).startsWith('application/json')) return send(res, 403, { error: 'origin' });
  let body;
  try { body = JSON.parse(await readBody(req)); } catch { return send(res, 400, { error: 'json' }); }

  if (path === '/api/places') {
    if (!validPlaces(body)) return send(res, 400, { error: 'places shape' });
    
    // One line per place keeps git diffs readable.

    writeFileSync(PLACES, `{\n${Object.entries(body).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(',\n')}\n}\n`);
    return send(res, 200, { ok: true, file: 'spikes/map/places.json' });
  }

  if (path === '/api/requests') {
    const { request: r, png } = body ?? {};
    if (!r || typeof r !== 'object' || !REQ_ID.test(r.id ?? '') || typeof r.text !== 'string') return send(res, 400, { error: 'request shape' });

    // A new id never overwrites another request; an existing id updates its own file.

    let id = r.id;
    if (!r.update) for (let k = 2; existsSync(join(REQS, `${id}.json`)); k++) id = `${r.id}-${k}`;
    delete r.update;
    r.id = id;
    if (typeof png === 'string' && png.startsWith('data:image/png;base64,')) {
      writeFileSync(join(REQS, `${id}.png`), Buffer.from(png.slice(22), 'base64'));
      r.screenshot = `${id}.png`;
    }
    writeFileSync(join(REQS, `${id}.json`), JSON.stringify(r, null, 2) + '\n');
    return send(res, 200, { ok: true, id, file: `spikes/map/requests/${id}.json` });
  }
  send(res, 404, { error: 'no such api' });
}

createServer(async (req, res) => {
  try {

    // A foreign Host header means DNS rebinding: refuse it, because the repo root holds .env.

    if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.host ?? '')) return send(res, 403, 'host', 'text/plain');
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (path.startsWith('/api/')) return await api(req, res, path);
    if (path === '/favicon.ico') { res.writeHead(204); return res.end(); }
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'method', 'text/plain');

    // Static files stay inside the repo root.

    let file = normalize(join(ROOT, path));
    if (file !== ROOT.slice(0, -1) && !file.startsWith(ROOT)) return send(res, 403, 'forbidden', 'text/plain');
    if (existsSync(file) && statSync(file).isDirectory()) {
      if (!path.endsWith('/')) { res.writeHead(301, { Location: path + '/' + new URL(req.url, 'http://x').search }); return res.end(); }
      file = join(file, 'index.html');
    }
    if (!existsSync(file)) return send(res, 404, 'not found', 'text/plain');
    res.writeHead(200, { 'Content-Type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(req.method === 'HEAD' ? undefined : readFileSync(file));
  } catch (e) {
    send(res, 500, { error: String(e.message) });
  }
}).listen(PORT, '127.0.0.1', () => console.log(`map dev server on http://127.0.0.1:${PORT}/spikes/map/  (edit mode: ?edit=1)`));
