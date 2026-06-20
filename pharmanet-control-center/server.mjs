/**
 * Standalone local server for PharmaNET Control Center.
 *
 * Runs the WHOLE app on your own computer with plain Node.js — no Cloudflare
 * account, no wrangler, no deployment. It serves the same static frontend
 * (public/) and reuses the exact same API handlers (functions/api/*) and
 * logic (src/*) as the deployed Cloudflare Pages version, by adapting Node's
 * http request/response to the Web Request/Response that those handlers
 * already speak.
 *
 * Why a tiny server (and not just a double-click HTML file)? The browser
 * blocks a web page from logging into PharmaNET directly (cross-origin / CORS).
 * This local server makes those PharmaNET calls for the page, exactly like the
 * Cloudflare Functions do online.
 *
 * Usage (Windows / Mac / Linux):
 *   1. Install Node.js LTS from https://nodejs.org   (one time)
 *   2. In this folder, run:  npm install              (one time, fetches fflate)
 *   3. Run:  node server.mjs        (or:  npm start)
 *   4. Open http://localhost:8788 in your browser
 *
 * Stop it with Ctrl+C. Set a PIN with:  APP_PIN=1234 node server.mjs
 * Change the port with:  PORT=3000 node server.mjs
 */
import { createServer } from 'node:http';
import { readFile, readFile as readFileAsync, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, 'public');
const FUNCTIONS_DIR = join(__dirname, 'functions', 'api');
const PORT = Number(process.env.PORT) || 8788;

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.txt': 'text/plain; charset=utf-8',
};

/**
 * File-backed stand-in for the Cloudflare KV namespace (LEARNED_MAPPINGS).
 * Only get/put are used by src/learnedMappings.js. Data persists between
 * restarts in .local-kv.json next to this file.
 */
const KV_FILE = join(__dirname, '.local-kv.json');
const localKv = {
  async _read() {
    try {
      return JSON.parse(await readFileAsync(KV_FILE, 'utf8'));
    } catch {
      return {};
    }
  },
  async get(key) {
    const store = await this._read();
    return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
  },
  async put(key, value) {
    const store = await this._read();
    store[key] = value;
    await writeFile(KV_FILE, JSON.stringify(store, null, 2));
  },
};

// `env` mirrors what the Cloudflare Functions receive.
const env = {
  APP_PIN: process.env.APP_PIN || '',
  LEARNED_MAPPINGS: localKv,
};

function readRequestBody(req) {
  return new Promise((resolvePromise, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolvePromise(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/** Resolve an /api/... URL to its handler file, guarding against path traversal. */
function resolveHandlerFile(apiSubPath) {
  const candidate = resolve(FUNCTIONS_DIR, `${apiSubPath}.js`);
  if (candidate !== FUNCTIONS_DIR && !candidate.startsWith(FUNCTIONS_DIR + '/') && !candidate.startsWith(FUNCTIONS_DIR + '\\')) {
    return null; // escaped the functions/api directory
  }
  return existsSync(candidate) ? candidate : null;
}

async function handleApi(req, res, pathname) {
  const apiSubPath = pathname.replace(/^\/api\//, '').replace(/\/+$/, '');
  const handlerFile = resolveHandlerFile(apiSubPath);
  if (!handlerFile) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: `No API handler for ${pathname}` }));
    return;
  }

  const mod = await import(pathToFileURL(handlerFile).href);
  const handler =
    (req.method === 'GET' && mod.onRequestGet) ||
    (req.method === 'POST' && mod.onRequestPost) ||
    mod.onRequest;
  if (!handler) {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: `${req.method} not supported for ${pathname}` }));
    return;
  }

  // Build a Web Request from the incoming Node request.
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    headers.set(name, Array.isArray(value) ? value.join(', ') : value);
  }
  const url = `http://localhost:${PORT}${req.url}`;
  const init = { method: req.method, headers };
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const body = await readRequestBody(req);
    if (body.length) init.body = body;
  }
  const request = new Request(url, init);

  const response = await handler({ request, env, params: {}, waitUntil: () => {} });

  const outHeaders = {};
  for (const [name, value] of response.headers.entries()) outHeaders[name] = value;
  res.writeHead(response.status, outHeaders);

  // Stream the body through as it arrives instead of buffering the whole
  // thing first — a bulk Run All response is built incrementally (NDJSON
  // progress lines) over several minutes, and buffering it here would send
  // zero bytes to the browser until the very end, defeating the point.
  if (!response.body) {
    res.end();
    return;
  }
  const reader = response.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    res.write(value);
  }
  res.end();
}

async function handleStatic(req, res, pathname) {
  // Friendly routes: "/" -> index.html, "/order" -> order.html
  let relPath = decodeURIComponent(pathname);
  if (relPath === '/') relPath = '/index.html';

  let filePath = resolve(PUBLIC_DIR, '.' + relPath);
  // Path-traversal guard.
  if (filePath !== PUBLIC_DIR && !filePath.startsWith(PUBLIC_DIR + '/') && !filePath.startsWith(PUBLIC_DIR + '\\')) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  // Extensionless path that maps to an .html file (e.g. /order -> order.html).
  if (!existsSync(filePath) && !extname(filePath)) {
    const htmlPath = filePath + '.html';
    if (existsSync(htmlPath)) filePath = htmlPath;
  }

  if (!existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }

  try {
    const data = await readFile(filePath);
    const type = CONTENT_TYPES[extname(filePath).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
    res.end(data);
  } catch {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Server error reading file');
  }
}

const server = createServer(async (req, res) => {
  try {
    const pathname = req.url.split('?')[0];
    if (pathname.startsWith('/api/')) {
      await handleApi(req, res, pathname);
    } else {
      await handleStatic(req, res, pathname);
    }
  } catch (err) {
    console.error(`[error] ${req.method} ${req.url}\n`, err);
    if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error', detail: String(err && err.message || err) }));
  }
});

// A bulk "Run All" processes every row sequentially against the live
// PharmaNET site in one HTTP request/response — for a few hundred rows that
// can run for several minutes. Node's defaults are already fine for this
// (server.timeout/headersTimeout/requestTimeout only bound how long it takes
// to *receive* a request, not how long the handler takes to respond), but
// set them explicitly so a future Node version's defaults can't silently cap
// a long-running batch.
server.timeout = 0;
server.headersTimeout = 0;
server.requestTimeout = 0;
server.keepAliveTimeout = 0;

// One unexpected error from a flaky external site shouldn't take down the
// whole local server (and whatever else it's mid-processing) — log it and
// keep running instead of crashing the process.
process.on('uncaughtException', (err) => {
  console.error('[uncaught exception] (server kept running)\n', err);
});
process.on('unhandledRejection', (err) => {
  console.error('[unhandled rejection] (server kept running)\n', err);
});

server.listen(PORT, () => {
  console.log('');
  console.log('  PharmaNET Control Center is running locally.');
  console.log('');
  console.log(`    →  http://localhost:${PORT}`);
  console.log(`       (Sales Order wizard:  http://localhost:${PORT}/order )`);
  console.log('');
  console.log(`  PIN gate: ${env.APP_PIN ? 'ON' : 'off (set APP_PIN to enable)'}`);
  console.log('  Press Ctrl+C to stop.');
  console.log('');
});
