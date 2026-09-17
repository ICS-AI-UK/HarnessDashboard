// Local development server: serves public/ and keeps the data in data.json.
// The deployed copy on Netlify uses netlify/functions/data.js instead, but both
// share lib/model.js so the rules are identical.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { DEFAULT_DATA, readDocument, sanitiseDocument } from './lib/model.js';

const fsp = fs.promises;

const PORT = process.env.PORT || 7333;
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_FILE = path.join(ROOT, 'data.json');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// Serialise writes so two quick saves can't interleave.
let writeQueue = Promise.resolve();

async function readData() {
  try {
    return readDocument(JSON.parse(await fsp.readFile(DATA_FILE, 'utf8')));
  } catch (err) {
    if (err.code === 'ENOENT') return { ...DEFAULT_DATA };
    throw err;
  }
}

function writeData(data) {
  writeQueue = writeQueue.then(async () => {
    const tmp = DATA_FILE + '.tmp';
    await fsp.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
    await fsp.rename(tmp, DATA_FILE); // atomic-ish replace, avoids a truncated data.json
  });
  return writeQueue;
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function readBody(req, limit = 1_000_000) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error('Payload too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function serveStatic(req, res, urlPath) {
  const rel = urlPath === '/' ? 'index.html' : decodeURIComponent(urlPath).replace(/^\/+/, '');
  const filePath = path.join(PUBLIC_DIR, rel);

  if (!filePath.startsWith(PUBLIC_DIR + path.sep)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  try {
    const data = await fsp.readFile(filePath);
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  try {
    if (url.pathname === '/api/data') {
      if (req.method === 'GET') {
        return sendJson(res, 200, await readData());
      }

      if (req.method === 'PUT') {
        const data = sanitiseDocument(JSON.parse((await readBody(req)) || '{}'));
        await writeData(data);
        return sendJson(res, 200, data);
      }

      res.writeHead(405, { Allow: 'GET, PUT' }).end();
      return;
    }

    if (req.method === 'GET' || req.method === 'HEAD') {
      return serveStatic(req, res, url.pathname);
    }

    res.writeHead(404).end();
  } catch (err) {
    sendJson(res, 400, { error: err.message || 'Bad request' });
  }
});

server.listen(PORT, () => {
  console.log(`Harness dashboard running at http://localhost:${PORT}`);
  console.log(`Data file: ${DATA_FILE}`);
});
