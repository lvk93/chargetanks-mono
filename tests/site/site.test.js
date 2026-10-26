// Pruefung der gebauten Seite (_site/, vorher "npm run build"):
// - interne Links und eingebundene Ressourcen zeigen auf vorhandene Dateien (Verzeichnis -> index.html)
// - keine Ressourcen von fremden Domains (src, Stylesheets/Icons/Manifest, url() im CSS)
// - Kopf je Seite: genau ein <title>, eine Description, hoechstens ein JSON-LD-Block, genau eine <h1>
// - Sitemap und llms.txt nennen alle Tool-Seiten; keine Verweise mehr auf Render oder /tools/suite/
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const SITE = fileURLToPath(new URL('../../_site/', import.meta.url));
const built = existsSync(join(SITE, 'index.html'));
const TOOLS = ['materials', 'cell-reconstruction', 'blending', 'aging', 'swelling'];

function files(dir, ext) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path, ext);
    return name.endsWith(ext) ? [path] : [];
  });
}

function exists(url) {
  const local = join(SITE, decodeURIComponent(url.split(/[?#]/)[0]));
  if (existsSync(local) && statSync(local).isFile()) return true;
  return existsSync(join(local, 'index.html'));
}

const pages = built ? files(SITE, '.html') : [];

test('Seite gebaut (npm run build)', { skip: !built && 'kein _site/ - erst "npm run build"' }, () => {
  const names = pages.map((p) => relative(SITE, p).replaceAll('\\', '/'));
  for (const page of ['index.html', '404.html', 'about/index.html', 'learn/lithium-balance/index.html', 'tools/index.html',
    'imprint/index.html', 'privacy/index.html', ...TOOLS.map((t) => `tools/${t}/index.html`)]) {
    assert.ok(names.includes(page), page);
  }
  assert.ok(!names.some((n) => n.startsWith('tools/suite/')), 'tools/suite/ ist entfallen');
  assert.ok(!names.some((n) => n.startsWith('blog/')), 'Blog ist entfallen (Umleitung in _redirects)');
});

for (const file of pages) {
  const name = relative(SITE, file).replaceAll('\\', '/');
  const html = readFileSync(file, 'utf8');

  test(`${name}: interne Links und Ressourcen vorhanden`, () => {
    for (const [, attr, url] of html.matchAll(/\s(href|src)="([^"]*)"/g)) {
      if (/^(https?:|mailto:|data:|#)/.test(url)) continue;
      assert.ok(url.startsWith('/'), `${attr}="${url}" ist nicht absolut`);
      assert.ok(exists(url), `${attr}="${url}" fehlt`);
    }
  });

  test(`${name}: keine Ressourcen fremder Domains`, () => {
    for (const [, url] of html.matchAll(/\ssrc="(https?:[^"]*)"/g)) assert.fail(`src ${url}`);
    for (const [, attrs] of html.matchAll(/<link((?:\s+[\w:-]+="[^"]*")*)\s*\/?>/g)) {
      const rel = attrs.match(/\srel="([^"]*)"/)[1];
      const href = attrs.match(/\shref="([^"]*)"/)[1];
      if (rel === 'canonical') continue; // Verweis, wird nicht geladen
      assert.ok(!/^https?:/.test(href), `link rel=${rel} ${href}`);
    }
  });

  test(`${name}: Kopf vollstaendig, eine h1`, () => {
    assert.equal(html.match(/<title>/g)?.length, 1, 'title');
    assert.equal(html.match(/<meta name="description"/g)?.length, 1, 'description');
    assert.ok((html.match(/application\/ld\+json/g)?.length ?? 0) <= 1, 'hoechstens ein JSON-LD-Block');
    assert.equal(html.match(/<h1[\s>]/g)?.length, 1, 'genau eine h1');
    assert.ok(!html.includes('onrender.com'), 'kein Verweis auf Render');
    assert.ok(!html.includes('/tools/suite/'), 'kein Verweis auf /tools/suite/');
    assert.ok(!html.includes('href="/blog/'), 'kein Verweis auf den entfallenen Blog');
  });
}

test('CSS: keine fremden URLs', { skip: !built }, () => {
  for (const file of files(join(SITE, 'assets/css'), '.css')) {
    const css = readFileSync(file, 'utf8');
    for (const [, url] of css.matchAll(/url\(\s*["']?([^"')]+)/g)) assert.ok(!/^https?:/.test(url), url);
    assert.ok(!/@import/.test(css), file);
  }
});

test('Sitemap und llms.txt nennen alle Tools', { skip: !built }, () => {
  const sitemap = readFileSync(join(SITE, 'sitemap.xml'), 'utf8');
  const llms = readFileSync(join(SITE, 'llms.txt'), 'utf8');
  for (const tool of TOOLS) {
    assert.ok(sitemap.includes(`<loc>https://chargetanks.com/tools/${tool}/</loc>`), `sitemap ${tool}`);
    assert.ok(llms.includes(`https://chargetanks.com/tools/${tool}/`), `llms ${tool}`);
  }
  assert.equal(sitemap.match(/<loc>/g).length, new Set(sitemap.match(/<loc>[^<]*<\/loc>/g)).size, 'keine doppelten URLs');
});

test('Umleitungen: alter Blog fuehrt aufs Kapitel', { skip: !built }, () => {
  const redirects = readFileSync(join(SITE, '_redirects'), 'utf8');
  for (const from of ['/blog', '/blog/*']) {
    const rule = redirects.split('\n').find((l) => l.trim().split(/\s+/)[0] === from);
    assert.ok(rule, `Regel fuer ${from}`);
    const [, to, status] = rule.trim().split(/\s+/);
    assert.equal(to, '/learn/lithium-balance/', `${from} -> ${to}`);
    assert.equal(status, '301', `${from} dauerhaft`);
    assert.ok(exists(to), `Ziel ${to} gebaut`);
  }
});

test('Vorschaubilder: jede Seite verweist auf ein vorhandenes Bild', { skip: !built }, () => {
  for (const file of pages) {
    const html = readFileSync(file, 'utf8');
    const og = html.match(/<meta property="og:image" content="https:\/\/chargetanks\.com([^"]+)"/)?.[1];
    assert.ok(og, `${relative(SITE, file)}: og:image`);
    assert.ok(exists(og), `${relative(SITE, file)}: ${og} fehlt`);
  }
  // Startseite, Kapitel und About haben eigene Bilder statt des Standardbilds
  const ogOf = (page) => readFileSync(join(SITE, page), 'utf8').match(/<meta property="og:image" content="[^"]*(\/assets\/img\/og\/[^"]+)"/)?.[1];
  assert.equal(ogOf('index.html'), '/assets/img/og/home.jpg');
  assert.equal(ogOf('learn/lithium-balance/index.html'), '/assets/img/og/chapter.jpg');
  assert.equal(ogOf('about/index.html'), '/assets/img/og/about.jpg');
});

test('Entwuerfe: Notizen nur mit noindex und ohne Sitemap-Eintrag', { skip: !built }, () => {
  const sitemap = readFileSync(join(SITE, 'sitemap.xml'), 'utf8');
  for (const file of pages) {
    const name = relative(SITE, file).replaceAll('\\', '/');
    const html = readFileSync(file, 'utf8');
    const url = '/' + name.replace(/index\.html$/, '');
    if (html.includes('class="draft-note')) {
      assert.match(html, /<meta name="robots" content="noindex/, `${name}: Entwurf ohne noindex`);
      assert.ok(!sitemap.includes(`<loc>https://chargetanks.com${url}</loc>`), `${name}: Entwurf in der Sitemap`);
    }
  }
});

test('Navigation: eine Ebene, alle Ziele gebaut', { skip: !built }, () => {
  const html = readFileSync(join(SITE, 'index.html'), 'utf8');
  const nav = html.match(/<nav class="site-nav"[^>]*>([\s\S]*?)<\/nav>/)[1];
  const links = [...nav.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(links, ['/learn/lithium-balance/', '/tools/', '/about/']);
});
