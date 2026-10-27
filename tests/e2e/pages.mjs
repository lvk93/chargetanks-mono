// Browser-Pruefung der Seiten ausserhalb der Tools (nicht Teil von npm test; braucht Chrome und einen Build in _site/):
//   npm run build && node tests/e2e/pages.mjs
// Prueft Startseite, Kapitel und About am Desktop und am Handy (390 px und 320 px):
// - keine JavaScript-Fehler, kein Querscrollen der Seite
// - alle festen Abbildungen und Kapitel-Tools sind gezeichnet (SVG vorhanden), Kennzahlen gefuellt
// - Reiter schalten um, Szenario-Knoepfe aendern die Kennzahlen, Reset stellt sie wieder her
// - Quiz zeigt eine Rueckmeldung, Umschalter "echte Kurven" zeichnet Graphit/NMC
// Chrome: Umgebungsvariable CHROME_PATH oder Standardpfad je Betriebssystem.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SITE = join(ROOT, '_site');
const CHROME = process.env.CHROME_PATH ?? [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].find((path) => existsSync(path));

if (!existsSync(join(SITE, 'index.html'))) throw new Error('kein _site/ - erst "npm run build"');
if (!CHROME) throw new Error('Chrome nicht gefunden - CHROME_PATH setzen');

// Statischer Server fuer _site/; /api/* (Statistik) antwortet leer, damit kein Fehler die Pruefung stoert
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webmanifest': 'application/manifest+json' };
const server = createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path.startsWith('/api/') || path.startsWith('/.netlify/')) {
    res.writeHead(204);
    res.end();
    return;
  }
  let file = normalize(join(SITE, path));
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

// Chrome per DevTools-Protokoll (als root, z. B. in Containern, nur ohne Sandbox)
const profile = mkdtempSync(join(tmpdir(), 'ct-pages-'));
const debugPort = 9300 + Math.floor(Math.random() * 500);
const sandbox = process.getuid?.() === 0 ? ['--no-sandbox'] : [];
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', ...sandbox, `--remote-debugging-port=${debugPort}`,
  `--user-data-dir=${profile}`, '--window-size=1280,900', 'about:blank'], { stdio: 'ignore' });
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
await send('Page.enable');

async function open(path, width) {
  await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 600 });
  errors.length = 0;
  await send('Page.navigate', { url: origin + path });
  for (let i = 0; i < 100; i += 1) {
    await sleep(100);
    if (await evaluate('document.readyState === "complete"').catch(() => false)) break;
  }
  await sleep(800); // Materialkurven laden, Abbildungen zeichnen
}

// Hilfsfunktionen im Browser
const H = `
  const svgIn = (el) => !!el && el.querySelector('svg') !== null;
  const readouts = (tool) => [...tool.querySelectorAll('[data-readout]')].map((d) => d.textContent.trim());
`;

const checks = [];
function check(name, ok, detail = '') {
  checks.push({ name, ok, detail });
  console.log(`${ok ? 'ok    ' : 'FEHLER'} ${name}${ok ? '' : ` - ${detail}`}`);
}

for (const width of [1280, 390, 320]) {
  // Startseite
  await open('/', width);
  const home = await evaluate(`(() => { ${H}
    const fig = document.querySelector('[data-chapter-figure]');
    return { drawn: svgIn(fig), overflow: document.documentElement.scrollWidth - innerWidth,
      tools: document.querySelectorAll('.tool-list li').length };
  })()`);
  check(`[${width}] Startseite: Tank-Bild gezeichnet`, home.drawn);
  check(`[${width}] Startseite: fuenf Tools gelistet`, home.tools === 5, `${home.tools}`);
  check(`[${width}] Startseite: kein Querscrollen`, home.overflow <= 0, `${home.overflow}px`);
  check(`[${width}] Startseite: keine JS-Fehler`, errors.length === 0, errors.join(' | '));

  // Kapitel
  await open('/learn/lithium-balance/', width);
  const chapter = await evaluate(`(async () => { ${H}
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const out = {};
    const panels = [...document.querySelectorAll('[data-chapter-panel]')];
    out.visible = panels.filter((p) => !p.hidden).map((p) => p.id);
    out.tabsOverflow = (() => { const n = document.querySelector('[data-chapter-tabs]'); return n.scrollWidth - n.clientWidth; })();
    out.pageOverflow = document.documentElement.scrollWidth - innerWidth;
    out.figures = [];
    out.tools = [];
    for (const panel of panels) {
      document.querySelector('[data-chapter-tabs] a[href="#' + panel.id + '"]').click();
      await sleep(400);
      for (const fig of panel.querySelectorAll('[data-chapter-figure]')) out.figures.push(svgIn(fig));
      for (const tool of panel.querySelectorAll('[data-chapter-tool]')) {
        const name = tool.dataset.chapterTool;
        const before = readouts(tool);
        const parts = ['tanks', 'electrodes', 'cell', 'account', 'blendtanks', 'potential', 'split', 'dqdv'].filter((k) => tool.querySelector('[data-' + k + ']'))
          .map((k) => svgIn(tool.querySelector('[data-' + k + ']')));
        const chips = [...tool.querySelectorAll('[data-preset]')];
        let changed = false;
        for (const chip of chips) { chip.click(); await sleep(60); if (readouts(tool).join() !== before.join()) changed = true; }
        tool.querySelector('[data-reset]').click(); await sleep(60);
        const reset = readouts(tool).join() === before.join();
        const drawnIdeal = tool.querySelector('.ch-tool__figs').innerHTML;
        const select = tool.querySelector('select[name="curves"]');
        select.value = 'real'; select.dispatchEvent(new Event('input', { bubbles: true })); select.dispatchEvent(new Event('change', { bubbles: true }));
        await sleep(600);
        // echte Kurven zeichnen etwas anderes als die idealen Tanks
        const real = tool.querySelector('.ch-tool__figs svg') !== null && readouts(tool).every((t) => t && t !== '–')
          && tool.querySelector('.ch-tool__figs').innerHTML !== drawnIdeal;
        tool.querySelector('[data-reset]').click(); await sleep(60);
        out.tools.push({ name, parts, filled: before.every((t) => t && t !== '–'), chips: chips.length, changed, reset, real });
      }
    }
    const quiz = document.querySelector('[data-quiz]');
    document.querySelector('[data-chapter-tabs] a').click(); await sleep(200);
    quiz.querySelector('[data-correct="true"]').click(); await sleep(50);
    const fb = quiz.querySelector('[data-quiz-feedback]');
    out.quiz = !fb.hidden && fb.textContent.length > 0;
    return out;
  })()`);
  check(`[${width}] Kapitel: beim Laden genau ein Reiter sichtbar`, chapter.visible.length === 1, chapter.visible.join());
  check(`[${width}] Kapitel: Reiterleiste ohne Querscrollen`, chapter.tabsOverflow <= 0, `${chapter.tabsOverflow}px`);
  check(`[${width}] Kapitel: Seite ohne Querscrollen`, chapter.pageOverflow <= 0, `${chapter.pageOverflow}px`);
  check(`[${width}] Kapitel: alle ${chapter.figures.length} Abbildungen gezeichnet`, chapter.figures.length > 0 && chapter.figures.every(Boolean));
  for (const t of chapter.tools) {
    check(`[${width}] Kapitel-Tool ${t.name}: Diagramme gezeichnet, Kennzahlen gefuellt`, t.parts.every(Boolean) && t.filled, JSON.stringify(t));
    check(`[${width}] Kapitel-Tool ${t.name}: Szenarien aendern Kennzahlen, Reset stellt her`, t.chips > 0 && t.changed && t.reset, JSON.stringify(t));
    check(`[${width}] Kapitel-Tool ${t.name}: echte Kurven gezeichnet`, t.real, JSON.stringify(t));
  }
  check(`[${width}] Kapitel: Quiz gibt Rueckmeldung`, chapter.quiz);
  check(`[${width}] Kapitel: keine JS-Fehler`, errors.length === 0, errors.join(' | '));

  // Direkter Einstieg auf einen Reiter (Links von der Startseite)
  await open('/learn/lithium-balance/#n-li-ratio', width);
  const deep = await evaluate(`[...document.querySelectorAll('[data-chapter-panel]')].filter((p) => !p.hidden).map((p) => p.id).join()`);
  check(`[${width}] Kapitel: Link auf #n-li-ratio oeffnet Reiter 3`, deep === 'n-li-ratio', deep);

  // Scroll-Widerstand: Aufloesung verschleiert, Antwort oder Skip deckt sie auf; Formeln passen in die Breite
  const veil = await evaluate(`(() => {
    const blocks = [...document.querySelectorAll('[data-quiz-answer]')];
    // Bloecke, deren Quiz in diesem Dokument noch nicht beantwortet wurde, muessen verschleiert sein
    const fresh = blocks.filter((b) => !document.querySelector('[data-quiz="' + b.dataset.quizAnswer + '"] .is-picked'));
    const veiled = fresh.filter((b) => b.classList.contains('is-veiled')).length;
    document.querySelector('[data-quiz="lithium-source"] button[data-answer="cathode"]').click();
    document.querySelector('[data-quiz-answer="aging-loss"] .quiz-answer__skip').click();
    const open = ['lithium-source', 'aging-loss'].every((k) => !document.querySelector('[data-quiz-answer="' + k + '"]').classList.contains('is-veiled'));
    return { blocks: blocks.length, fresh: fresh.length, veiled, open };
  })()`);
  check(`[${width}] Kapitel: Quiz-Aufloesung verschleiert, Antwort und Skip decken auf`, veil.blocks === 3 && veil.fresh > 0 && veil.veiled === veil.fresh && veil.open, JSON.stringify(veil));
  const wide = await evaluate(`(() => { document.querySelectorAll('details.math-box').forEach((d) => { d.open = true; });
    return [...document.querySelectorAll('[data-chapter-panel]')].flatMap((p) => { p.hidden = false; return [...p.querySelectorAll('math[display="block"]')]; })
      .filter((m) => m.scrollWidth - m.clientWidth > 1).length; })()`);
  check(`[${width}] Kapitel: keine Formel breiter als die Box`, width < 340 || wide === 0, `${wide} Formeln`);

  // About
  await open('/about/', width);
  const about = await evaluate(`({ overflow: document.documentElement.scrollWidth - innerWidth,
    pubs: document.querySelectorAll('.pubs li').length, photo: document.querySelector('.cv-photo').naturalWidth > 0 })`);
  check(`[${width}] About: Foto geladen, Publikationen gelistet`, about.photo && about.pubs > 0, JSON.stringify(about));
  check(`[${width}] About: kein Querscrollen`, about.overflow <= 0, `${about.overflow}px`);
}

ws.close();
chrome.kill();
server.close();
await sleep(300);
try { rmSync(profile, { recursive: true, force: true }); } catch { /* Chrome gibt das Profil noch frei */ }
const failed = checks.filter((c) => !c.ok).length;
console.log(failed ? `${failed} von ${checks.length} Pruefungen fehlgeschlagen` : `alle ${checks.length} Pruefungen bestanden`);
process.exit(failed ? 1 : 0);
