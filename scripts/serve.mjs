// Lokaler Server fuer die statische Seite (nur Entwicklung, keine Dependencies).
// Verhaelt sich wie Netlify mit _redirects: Verzeichnis-Index, 301 auf "/" bei Verzeichnissen,
// nicht existierende /tools/*-Pfade -> 302 /tools/suite/, sonst 404.html mit Status 404.
// Aufruf: node scripts/serve.mjs [port]   (Standard 8000)
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const port = Number(process.argv[2] || process.env.PORT || 8000);

const TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.js': 'text/javascript; charset=UTF-8',
  '.mjs': 'text/javascript; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=UTF-8',
  '.xml': 'application/xml',
  '.webmanifest': 'application/manifest+json',
};

async function isFile(path) {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

async function send(res, status, file) {
  if (!(await isFile(file))) {
    res.writeHead(status, { 'Content-Type': 'text/plain; charset=UTF-8' }).end('Not Found');
    return;
  }
  res.writeHead(status, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
  res.end(await readFile(file));
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${port}`);
    const path = decodeURIComponent(url.pathname);
    const local = join(root, normalize(path));
    if (!local.startsWith(root) || /[\\/](\.git|migration|node_modules)([\\/]|$)/.test(local.slice(root.length))) {
      await send(res, 404, join(root, '404.html'));
      return;
    }
    if (await isFile(local)) {
      await send(res, 200, local);
      return;
    }
    if (await isFile(join(local, 'index.html'))) {
      if (!path.endsWith('/')) {
        res.writeHead(301, { Location: `${path}/${url.search}` }).end();
        return;
      }
      await send(res, 200, join(local, 'index.html'));
      return;
    }
    if (path.startsWith('/tools/')) {
      res.writeHead(302, { Location: '/tools/suite/' }).end();
      return;
    }
    await send(res, 404, join(root, '404.html'));
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'text/plain' }).end(String(error));
  }
}).listen(port, () => console.log(`chargetanks lokal: http://localhost:${port}/`));
