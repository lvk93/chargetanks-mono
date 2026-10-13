// Statische Pruefung aller Seiten (Webseite + Tool-Suite):
// - interne Links und eingebundene Ressourcen zeigen auf vorhandene Dateien (Verzeichnis -> index.html)
// - keine Ressourcen von fremden Domains (src, stylesheet/icon/manifest-Links, Skripte, url() im CSS)
// - Webseite: keine Tailwind-Klassen mehr, nur ct-*-Klassen; alle ct-Klassen in styles.css definiert
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SKIP = new Set(['.git', 'node_modules', 'migration', 'tests', 'scripts']);

function htmlFiles(dir = ROOT) {
  return readdirSync(dir).flatMap((name) => {
    if (SKIP.has(name)) return [];
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return htmlFiles(path);
    return name.endsWith('.html') ? [path] : [];
  });
}

const pages = htmlFiles();
const styles = readFileSync(join(ROOT, 'assets/css/styles.css'), 'utf8');
const SITE_PAGES = ['index.html', '404.html', 'blog/index.html', 'blog/two-tank-battery-model/index.html', 'tools/index.html'];

function resolveLocal(url) {
  const path = decodeURIComponent(url.split(/[?#]/)[0]);
  const local = join(ROOT, path);
  if (existsSync(local) && statSync(local).isFile()) return true;
  return existsSync(join(local, 'index.html'));
}

test('Seiten gefunden', () => {
  const rel = pages.map((p) => relative(ROOT, p).replaceAll('\\', '/'));
  for (const page of SITE_PAGES) assert.ok(rel.includes(page), page);
  assert.ok(rel.includes('tools/suite/index.html'));
  assert.equal(rel.length, 11);
});

for (const file of pages) {
  const name = relative(ROOT, file).replaceAll('\\', '/');
  const text = readFileSync(file, 'utf8');

  test(`${name}: interne Links und Ressourcen vorhanden`, () => {
    for (const [, attr, url] of text.matchAll(/\s(href|src)="([^"]*)"/g)) {
      if (/^(https?:|mailto:|data:|#)/.test(url)) continue;
      assert.ok(url.startsWith('/'), `${attr}="${url}" ist nicht absolut`);
      assert.ok(resolveLocal(url), `${attr}="${url}" fehlt`);
    }
  });

  test(`${name}: keine Ressourcen fremder Domains`, () => {
    for (const [, url] of text.matchAll(/\ssrc="(https?:[^"]*)"/g)) assert.fail(`src ${url}`);
    // Attribute einzeln lesen (data:-Favicons enthalten ">")
    for (const [, attrs] of text.matchAll(/<link((?:\s+[\w:-]+="[^"]*")*)\s*\/?>/g)) {
      const rel = attrs.match(/\srel="([^"]*)"/)[1];
      const href = attrs.match(/\shref="([^"]*)"/)[1];
      if (rel === 'canonical') continue; // Verweis, wird nicht geladen
      assert.ok(!/^https?:/.test(href), `link rel=${rel} ${href}`);
    }
  });
}

test('styles.css: keine fremden URLs', () => {
  for (const [, url] of styles.matchAll(/url\(\s*["']?([^"')]+)/g)) {
    assert.ok(!/^https?:/.test(url), url);
  }
  assert.ok(!/@import/.test(styles));
});

test('Webseite: nur semantische Klassen, alle in styles.css definiert', () => {
  for (const page of SITE_PAGES) {
    const text = readFileSync(join(ROOT, page), 'utf8');
    for (const [, list] of text.matchAll(/\sclass="([^"]*)"/g)) {
      for (const cls of list.split(/\s+/).filter(Boolean)) {
        if (cls === 'ct-page') continue;
        assert.match(cls, /^ct-[a-z0-9-]+$/, `${page}: Klasse ${cls}`);
        assert.ok(styles.includes(`.${cls} `) || styles.includes(`.${cls}:`) || styles.includes(`.${cls}>`)
          || styles.includes(`/* .${cls}:`), `${page}: .${cls} fehlt in styles.css`);
      }
    }
  }
});

test('Webseite: "Launch"-Links zeigen auf die eigene Tool-Suite', () => {
  for (const page of SITE_PAGES) {
    const text = readFileSync(join(ROOT, page), 'utf8');
    assert.ok(!text.includes('onrender.com'), page);
  }
  const tools = readFileSync(join(ROOT, 'tools/index.html'), 'utf8');
  assert.match(tools, /href="\/tools\/suite\/" target="_blank" rel="noopener noreferrer"[^>]*><span>Launch Tool Suite<\/span>/);
});
