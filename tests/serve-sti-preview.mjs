// Local test harness for the same static candidate and read-only review function.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import handler from '../netlify/preview-functions/review-data.ts';

const root = resolve(import.meta.dirname, '../dist-preview');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp' };
createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost:4173');
  if (url.pathname.startsWith('/api/')) {
    const response = await handler(new Request(url, { method: req.method }));
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
    return;
  }
  const file = resolve(root, '.' + decodeURIComponent(url.pathname) + (url.pathname.endsWith('/') ? 'index.html' : ''));
  if (!file.startsWith(root + sep) || !['GET', 'HEAD'].includes(req.method)) { res.writeHead(403); res.end(); return; }
  try {
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch { res.writeHead(404); res.end(); }
}).listen(4173, '0.0.0.0', () => console.log('STI review test server: http://localhost:4173/dapp/#stats'));
