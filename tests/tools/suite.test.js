// Landing /tools/suite/ gegen den Golden-Fall des Originals (tests/golden/ui/landing/default.json):
// Karten (Titel, Text), Buttons in derselben Reihenfolge mit Ziel-URL (F2), Linkbutton, Fusszeile;
// Vorschaubilder bytegleich zur Quelle (migration/copy_thumbnails.py, SHA256SUMS).
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { loadGolden } from '../helpers/golden.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const html = readFileSync(`${ROOT}tools/suite/index.html`, 'utf8');
const golden = loadGolden('ui/landing/default.json');
const escape = (text) => text.replaceAll('&', '&amp;');
const ROUTES = { Materials: 'materials', 'Cell Reconstruction': 'cell-reconstruction', Blending: 'blending',
  Aging: 'aging', Swelling: 'swelling' };

test('Landing: keine Exceptions im Original', () => {
  assert.deepEqual(golden.exceptions, []);
});

test('Landing: Karten mit Titel und Beschreibung wie im Original', () => {
  const cards = golden.elements.filter((e) => e.type === 'markdown' && e.value.startsWith('<div class="card">'));
  assert.equal(cards.length, 5);
  const found = [...html.matchAll(/<div class="card">[\s\S]*?<h2 id="[^"]+">(.*?)<span[\s\S]*?<p>(.*?)<\/p>/g)]
    .map((m) => [m[1], m[2]]);
  assert.deepEqual(found, cards.map((c) => {
    const [, title, desc] = c.value.match(/<h2>(.*?)<\/h2>\s*<p>(.*?)<\/p>/);
    return [title, escape(desc)];
  }));
});

test('Landing: Buttons in derselben Reihenfolge, Ziel /tools/<tool>/', () => {
  const labels = golden.elements.filter((e) => e.type === 'button').map((e) => e.label);
  const found = [...html.matchAll(/<a class="st-button st-button--landing[^"]*" href="([^"]+)"><div class="st-md"><p>(.*?)<\/p>/g)]
    .map((m) => [m[2], m[1]]);
  assert.deepEqual(found, labels.map((label) => [label, `/tools/${ROUTES[label.replace('Open ', '')]}/`]));
});

test('Landing: Linkbutton und Fusszeile', () => {
  const link = golden.elements.find((e) => e.type === 'link_button');
  assert.ok(html.includes(`href="mailto:lars@chargetanks.com" target="_blank" rel="noreferrer"><div class="st-md"><p>${link.label}</p>`));
  const footer = golden.elements.find((e) => e.type === 'markdown' && e.value.startsWith('<div class="footer">'));
  assert.ok(html.includes(footer.value.replaceAll('<br>', '<br />')));
});

test('Landing: Vorschaubilder bytegleich (SHA256SUMS)', () => {
  const sums = readFileSync(`${ROOT}assets/img/suite/SHA256SUMS`, 'utf8').trim().split('\n').map((l) => l.split(/\s+/));
  assert.equal(sums.length, 5);
  for (const [digest, name] of sums) {
    assert.equal(createHash('sha256').update(readFileSync(`${ROOT}assets/img/suite/${name}`)).digest('hex'), digest, name);
    assert.ok(html.includes(`src="/assets/img/suite/${name}"`), name);
  }
});
