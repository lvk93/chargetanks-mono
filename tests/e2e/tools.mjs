// Browser-Pruefung der Tool-Seiten (nicht Teil von npm test; braucht Chrome und einen Build in _site/):
//   npm run build && node tests/e2e/tools.mjs [tool ...]
// Oeffnet jeden Zustand aus tests/regression/states.js per URL-Parameter, liest die Diagramme aus der Seite
// (Trace-Daten, Shapes, Annotationen) und vergleicht ihren Fingerabdruck mit tests/regression/reference.json.
// Damit sind Verdrahtung, URL-Zustand und Rechnung im Browser gegen den geprueften Stand belegt.
// Chrome: Umgebungsvariable CHROME_PATH oder Standardpfad je Betriebssystem.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FIGURE_IDS, TOOLS } from '../regression/runners.js';
import { STATES } from '../regression/states.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SITE = join(ROOT, '_site');
const reference = JSON.parse(readFileSync(join(ROOT, 'tests/regression/reference.json'), 'utf8'));
const materials = JSON.parse(readFileSync(join(ROOT, 'assets/data/materials/index.json'), 'utf8'));
const slugOf = (name) => materials.find((m) => m.name === name).file.replace(/\.json$/, '');

const CHROME = process.env.CHROME_PATH ?? [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].find((path) => existsSync(path));

if (!existsSync(join(SITE, 'index.html'))) throw new Error('kein _site/ - erst "npm run build"');
if (!CHROME) throw new Error('Chrome nicht gefunden - CHROME_PATH setzen');

// Statischer Server: _site/ und unter /__regression/ die Pruefmodule (fingerprint.js)
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webmanifest': 'application/manifest+json' };
const server = createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = path.startsWith('/__regression/')
    ? normalize(join(ROOT, 'tests/regression', path.slice('/__regression/'.length)))
    : normalize(join(SITE, path));
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file)) {
    res.writeHead(404);
    res.end();
    return;
  }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;

// Chrome per DevTools-Protokoll
const profile = mkdtempSync(join(tmpdir(), 'ct-e2e-'));
const debugPort = 9300 + Math.floor(Math.random() * 500);
// als root (z. B. in Containern) startet Chrome nur ohne Sandbox
const sandbox = process.getuid?.() === 0 ? ['--no-sandbox'] : [];
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', ...sandbox, `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`,
  '--window-size=1280,900', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let target = null;
for (let i = 0; i < 100 && !target; i += 1) {
  try {
    target = (await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json()).find((t) => t.type === 'page');
  } catch { /* Chrome startet noch */ }
  if (!target) await sleep(150);
}
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve) => ws.addEventListener('open', resolve, { once: true }));
let nextId = 1;
const pending = new Map();
const errors = [];
ws.addEventListener('message', (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  } else if (msg.method === 'Runtime.exceptionThrown') {
    errors.push(msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text);
  }
});
const send = (method, params = {}) => new Promise((resolve) => {
  const id = nextId++;
  pending.set(id, resolve);
  ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async (expression) => {
  const { result } = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? 'Fehler im Browser');
  return result.result.value;
};
await send('Runtime.enable');

function query(state) {
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(state)) {
    if (typeof value === 'boolean') params.set(name, value ? '1' : '0');
    else if (typeof value === 'number') params.set(name, String(value));
    else params.set(name, slugOf(value));
  }
  return params.toString();
}

const tools = process.argv.slice(2).length ? process.argv.slice(2) : TOOLS;
let failures = 0;
for (const tool of tools) {
  for (const [name, state] of Object.entries(STATES[tool])) {
    errors.length = 0;
    await send('Page.navigate', { url: `${origin}/tools/${tool}/?${query(state)}` });
    const ids = FIGURE_IDS[tool];
    // warten, bis alle Diagramme gezeichnet sind und keine Neuberechnung mehr aussteht
    let ready = false;
    for (let i = 0; i < 100 && !ready; i += 1) {
      await sleep(100);
      // gezeichnet = Plotly hat das Layout aufgebaut (das Schichtdiagramm von Swelling hat nur Shapes, keine Traces)
      ready = await evaluate(`document.readyState === 'complete' && ${JSON.stringify(ids)}.every((id) =>
        document.querySelector('[data-chart="' + id + '"] [data-chart-plot]')?._fullLayout !== undefined)`).catch(() => false);
    }
    await sleep(150);
    const result = ready ? await evaluate(`(async () => {
      const { fingerprintFigure } = await import('/__regression/fingerprint.js');
      const ids = ${JSON.stringify(ids)};
      // Figure, wie sie an die Darstellungsschicht ging (gd.layout veraendert Plotly selbst, B18)
      const plots = ids.map((id) => document.querySelector('[data-chart="' + id + '"] [data-chart-plot]'));
      const figures = await Promise.all(plots.map((gd) => fingerprintFigure(gd.chargetanksFigure)));
      const soh = document.querySelector('[data-readout="soh"]')?.textContent ?? null;
      return { figures, soh };
    })()`) : null;
    const expected = reference[tool][name];
    const problems = [];
    if (!result) problems.push('Diagramme nicht gezeichnet');
    else {
      result.figures.forEach((figure, i) => {
        const ref = expected.figures[i];
        if (figure.traces !== ref.traces) problems.push(`Diagramm ${ids[i]}: Daten weichen ab`);
        // Shapes/Annotationen: ausser bei Swelling "classes", dort entfernt die Tool-Schicht das leere SEI-Label (B7)
        if (!(tool === 'swelling' && ids[i] === 'classes') && figure.marks !== ref.marks) {
          problems.push(`Diagramm ${ids[i]}: Shapes/Annotationen weichen ab`);
        }
      });
      if (tool === 'aging') {
        const sohRef = expected.headings[0].match(/SoH: ([-\d.]+%)/)[1];
        if (!result.soh?.includes(sohRef)) problems.push(`SoH "${result.soh}" statt ${sohRef}`);
      }
    }
    if (errors.length) problems.push(`Konsole: ${errors.join(' | ')}`);
    if (problems.length) failures += 1;
    console.log(`${problems.length ? 'FEHLER' : 'ok    '} ${tool}: ${name}${problems.length ? ` - ${problems.join('; ')}` : ''}`);
  }
}

ws.close();
chrome.kill();
server.close();
await sleep(300);
try { rmSync(profile, { recursive: true, force: true }); } catch { /* Chrome gibt das Profil noch frei */ }
console.log(failures ? `${failures} Zustaende mit Abweichungen` : 'alle Zustaende gleich');
process.exit(failures ? 1 : 0);
