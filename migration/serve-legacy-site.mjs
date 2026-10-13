// Statischer Server fuer den Legacy-Build der Webseite (chargetanks@main, dist/).
// Bildet das Netlify-Verhalten von public/_redirects und der Trailing-Slash-Normalisierung nach,
// wie es live auf chargetanks.com gemessen wurde (Phase 0):
//   /tools, /blog, /blog/<slug>   -> 301 auf dieselbe URL mit "/"
//   /tools/                       -> 200 tools/index.html            (_redirects Zeile 2)
//   /tools/*                      -> 302 auf TOOLS_TARGET + Rest     (_redirects Zeile 3, erzwungen)
//   existierende Datei            -> Datei
//   alles andere                  -> 200 index.html (SPA-Fallback)  (_redirects Zeile 4)
// Aufruf: node migration/serve-legacy-site.mjs [port] [distDir] [toolsTarget]
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';

const port = Number(process.argv[2] || 4173);
const distDir = resolve(process.argv[3] || 'migration/.work/chargetanks/dist');
const toolsTarget = process.argv[4] || 'http://localhost:8501/';

const TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.txt': 'text/plain; charset=UTF-8',
  '.xml': 'application/xml',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
};

async function isFile(path) {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

async function send(res, status, file) {
  const body = await readFile(file);
  res.writeHead(status, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
  res.end(body);
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${port}`);
    const path = decodeURIComponent(url.pathname);
    const local = join(distDir, normalize(path));
    if (!local.startsWith(distDir)) {
      res.writeHead(400).end();
      return;
    }
    if (!path.endsWith('/') && (await isFile(join(local, 'index.html')))) {
      res.writeHead(301, { Location: `${path}/${url.search}` }).end();
      return;
    }
    if (path === '/tools/') {
      await send(res, 200, join(distDir, 'tools', 'index.html'));
      return;
    }
    if (path.startsWith('/tools/')) {
      res.writeHead(302, { Location: new URL(path.slice('/tools/'.length), toolsTarget).toString() }).end();
      return;
    }
    if (await isFile(local)) {
      await send(res, 200, local);
      return;
    }
    if (path.endsWith('/') && (await isFile(join(local, 'index.html')))) {
      await send(res, 200, join(local, 'index.html'));
      return;
    }
    await send(res, 200, join(distDir, 'index.html'));
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'text/plain' }).end(String(error));
  }
}).listen(port, () => {
  console.log(`Legacy-Webseite: http://localhost:${port}/  (dist: ${distDir}, /tools/* -> ${toolsTarget})`);
});
