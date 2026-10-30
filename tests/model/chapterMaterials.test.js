// Kurven des Kapitels Materials (assets/data/chapter-materials.json, scripts/build-chapter-materials.mjs):
// Form und die Zahlen, auf die sich die Texte stuetzen.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const data = JSON.parse(readFileSync(new URL('../../assets/data/chapter-materials.json', import.meta.url), 'utf8'));
const at = (v, x) => { const i = v.x.findIndex((xx) => xx >= x); return v.uIn[i]; };
// Spannung, bei der der groesste Anteil Lithium in ein 10-mV-Fenster passt (flachstes Stueck)
function plateau(v) {
  let best = { u: NaN, n: 0 };
  for (const u0 of v.uIn) {
    const n = v.uIn.filter((u) => Math.abs(u - u0) < 0.005).length;
    if (n > best.n) best = { u: u0, n };
  }
  return best.u;
}

test('alle acht Materialien, Spannung faellt mit dem Fuellgrad', () => {
  assert.deepEqual(Object.keys(data).sort(), ['graphite', 'lco', 'lfp', 'lithium', 'lmfp', 'lto', 'nmc', 'silicon']);
  for (const [slug, m] of Object.entries(data)) {
    for (const v of m.variants) {
      for (const key of ['uIn', 'uOut']) {
        assert.ok(v[key].every((u, i) => i === 0 || u <= v[key][i - 1] + 1e-3), `${slug} ${v.label} ${key}`);
      }
    }
  }
});

test('Zahlen aus den Texten', () => {
  assert.ok(Math.abs(plateau(data.lfp.variants[0]) - 3.4) < 0.05, 'LFP-Plateau ~3,4 V');
  assert.ok(Math.abs(plateau(data.lto.variants[0]) - 1.55) < 0.03, 'LTO-Plateau ~1,55 V');
  const mn = data.lmfp.variants[2];
  assert.ok(Math.abs(at(mn, 0.3) - 4.1) < 0.2 && Math.abs(at(mn, 0.8) - 3.45) < 0.08, 'LMFP: Mn ~4,1 V, Fe ~3,45 V');
  const si = data.silicon.variants[0];
  const mid = si.x.map((x, i) => (x > 0.1 && x < 0.9 ? si.uOut[i] - si.uIn[i] : NaN)).filter(Number.isFinite);
  const h = mid.reduce((a, b) => a + b, 0) / mid.length;
  assert.ok(h > 0.2 && h < 0.4, `Silizium-Hysterese ~0,3 V (${h.toFixed(3)})`);
  assert.ok(data.silicon.q / data.graphite.q > 9, 'Silizium fast zehnmal Graphit');
  assert.ok(at(data.graphite.variants[0], 0.9) < 0.11, 'letztes Graphit-Becken ~0,1 V');
  assert.deepEqual(data.nmc.variants.map((v) => v.q), [155, 161, 173, 208, 220, 200], 'Canrd-Kapazitaeten');
  assert.ok(data.nmc.variants.every((v, i, a) => i === 0 || i === 5 || v.q > a[i - 1].q), 'mehr Nickel, tiefer in den Tank');
});
