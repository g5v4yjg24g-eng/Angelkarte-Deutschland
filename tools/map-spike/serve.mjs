// Minimaler statischer Server für den Spike, mit HTTP-Range-Unterstützung (nötig für PMTiles).
// Aufruf: DATA_DIR=<pipeline-ausgabe> PORT=8130 node serve.mjs
import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(process.env.DATA_DIR ?? join(here, 'data'));
const port = Number(process.env.PORT ?? 8130);
const req = createRequire(import.meta.url);
const pmtilesDir = dirname(req.resolve('pmtiles/package.json'));
const fflateDir = dirname(createRequire(join(pmtilesDir, 'x.js')).resolve('fflate/package.json'));

// URL-Präfix → Verzeichnis
const mounts = [
  ['/vendor/maplibre/', join(dirname(req.resolve('maplibre-gl/package.json')), 'dist')],
  ['/vendor/pmtiles/', join(pmtilesDir, 'dist/esm')],
  ['/vendor/fflate/', join(fflateDir, 'esm')],
  ['/data/', dataDir],
  ['/', here],
];
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.pmtiles': 'application/octet-stream', '.map': 'application/json' };

createServer((rq, rs) => {
  const url = decodeURIComponent(new URL(rq.url ?? '/', 'http://x').pathname);
  const [prefix, dir] = mounts.find(([p]) => url.startsWith(p));
  const file = normalize(join(dir, url.slice(prefix.length) || 'index.html'));
  if (!file.startsWith(dir)) { rs.writeHead(403).end(); return; }
  let size;
  try { size = statSync(file).size; } catch { rs.writeHead(404).end(); return; }
  const headers = { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream', 'Accept-Ranges': 'bytes',
    'Cache-Control': 'no-store' };
  const m = /bytes=(\d+)-(\d*)/.exec(rq.headers.range ?? '');
  if (m) {
    const start = Number(m[1]), end = m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
    rs.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': end - start + 1 });
    createReadStream(file, { start, end }).pipe(rs);
  } else {
    rs.writeHead(200, { ...headers, 'Content-Length': size });
    createReadStream(file).pipe(rs);
  }
}).listen(port, () => console.log(`Spike-Server: http://localhost:${port}  (Daten: ${dataDir})`));
