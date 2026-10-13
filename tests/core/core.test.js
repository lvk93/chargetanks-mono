// Differential-Tests der Grundbausteine gegen Python/numpy/scipy/pandas (tests/golden/core/).
// Erwartung: bitgenau gleich (Object.is); nur pow (libm) mit Toleranz.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getIndexerNearest } from '../../assets/js/core/pandas.js';
import { formatFixed } from '../../assets/js/core/pyformat.js';
import { interp, linspace } from '../../assets/js/core/numpy.js';
import { interp1d, pchip } from '../../assets/js/core/scipy.js';
import { assertBitEqual, assertClose, loadGolden } from '../helpers/golden.js';

test('formatFixed == Python format(x, ".Nf")', () => {
  const { cases } = loadGolden('core/pyformat.json');
  const failures = cases.filter(([x, fmt, expected]) => formatFixed(x, Number(fmt[1])) !== expected);
  assert.deepEqual(failures.slice(0, 5), [], `${failures.length} von ${cases.length} abweichend`);
});

test('linspace == np.linspace', () => {
  for (const c of loadGolden('core/linspace.json').cases) {
    assertBitEqual(linspace(c.start, c.stop, c.num), c.out, `linspace(${c.start}, ${c.stop}, ${c.num})`);
  }
});

test('interp == np.interp', () => {
  loadGolden('core/interp.json').cases.forEach((c, i) => {
    assertBitEqual(interp(c.x, c.xp, c.fp), c.out, `interp#${i}`);
  });
});

test('interp1d == scipy interp1d (extrapolate und Tupel-Fill)', () => {
  loadGolden('core/interp1d.json').cases.forEach((c, i) => {
    const f = interp1d(c.xp, c.yp, { fillValue: c.fill });
    assertBitEqual(f(c.x), c.out, `interp1d#${i}${c.material ? ` ${c.material}` : ''}`);
  });
});

test('pchip == scipy PchipInterpolator(extrapolate=False)', () => {
  loadGolden('core/pchip.json').cases.forEach((c, i) => {
    assertBitEqual(pchip(c.x, c.y)(c.q), c.out, `pchip#${i}${c.material ? ` ${c.material} ${c.column}` : ''}`);
  });
});

test('getIndexerNearest == pandas get_indexer(method="nearest")', () => {
  for (const c of loadGolden('core/nearest.json').cases) {
    const got = Array.from(c.targets, (t) => getIndexerNearest(c.index, t));
    assertBitEqual(got, c.out, `nearest n=${c.index.length}`);
  }
});

test('Gibson-Ashby (pow) innerhalb Toleranz', () => {
  for (const [comp, eps0, porosity, sigma] of loadGolden('core/pow.json').cases) {
    const p = 1 - (comp / 200.0 + (1 - eps0) ** 2) ** (1 / 2);
    const s = 200.0 * ((1 - p) ** 2 - (1 - eps0) ** 2);
    assertClose([p, s], [porosity, sigma], `pow(${comp}, ${eps0})`);
  }
});
