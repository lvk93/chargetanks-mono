// Laedt Golden-Dateien aus tests/golden/ (Format siehe migration/make_goldens.py) und vergleicht Werte.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const GOLDEN = fileURLToPath(new URL('../golden/', import.meta.url));

const TYPED = {
  f8: Float64Array,
  f4: Float32Array,
  i8: BigInt64Array,
  i4: Int32Array,
  i2: Int16Array,
  i1: Int8Array,
  u1: Uint8Array,
  b1: Uint8Array,
};

const cache = new Map();

export function loadArray(id, dtype) {
  const key = `${id}.${dtype}`;
  if (!cache.has(key)) {
    const bytes = readFileSync(`${GOLDEN}arrays/${key}`);
    const Typed = TYPED[dtype];
    if (!Typed) throw new Error(`unbekannter dtype ${dtype}`);
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    let arr = new Typed(buffer);
    if (dtype === 'i8') arr = Float64Array.from(arr, (v) => Number(v));
    if (dtype === 'b1') arr = Array.from(arr, (v) => v !== 0);
    cache.set(key, arr);
  }
  return cache.get(key);
}

export function decode(value) {
  if (Array.isArray(value)) return value.map(decode);
  if (value && typeof value === 'object') {
    if ('$array' in value) return loadArray(value.$array, value.dtype);
    if ('$float' in value) return { nan: NaN, inf: Infinity, '-inf': -Infinity }[value.$float];
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, decode(v)]));
  }
  return value;
}

export function loadGolden(relPath) {
  return decode(JSON.parse(readFileSync(`${GOLDEN}${relPath}`, 'utf8')));
}

// Bitgenauer Vergleich (Object.is: NaN == NaN, -0 != 0).
export function assertBitEqual(actual, expected, label = '') {
  const a = Array.from(actual);
  const e = Array.from(expected);
  assert.equal(a.length, e.length, `${label}: Laenge ${a.length} != ${e.length}`);
  for (let i = 0; i < e.length; i += 1) {
    if (!Object.is(a[i], e[i])) {
      assert.fail(`${label}[${i}]: ${a[i]} !== ${e[i]} (Differenz ${a[i] - e[i]})`);
    }
  }
}

// Vergleich mit der vereinbarten Toleranz |a-b| <= rtol*max(1,|b|); NaN-Positionen exakt.
export function assertClose(actual, expected, label = '', rtol = 1e-12) {
  const a = Array.from(actual);
  const e = Array.from(expected);
  assert.equal(a.length, e.length, `${label}: Laenge ${a.length} != ${e.length}`);
  for (let i = 0; i < e.length; i += 1) {
    const x = a[i];
    const y = e[i];
    if (Number.isNaN(y) || Number.isNaN(x)) {
      assert.ok(Number.isNaN(x) && Number.isNaN(y), `${label}[${i}]: NaN-Position ${x} vs ${y}`);
      continue;
    }
    if (!Number.isFinite(y)) {
      assert.equal(x, y, `${label}[${i}]`);
      continue;
    }
    const tol = rtol * Math.max(1, Math.abs(y));
    if (!(Math.abs(x - y) <= tol)) assert.fail(`${label}[${i}]: ${x} vs ${y} (|d|=${Math.abs(x - y)} > ${tol})`);
  }
}

// Maximale relative Abweichung (fuer Berichte).
export function maxDeviation(actual, expected) {
  let worst = 0;
  const a = Array.from(actual);
  const e = Array.from(expected);
  for (let i = 0; i < e.length; i += 1) {
    if (Number.isFinite(e[i]) && Number.isFinite(a[i])) {
      worst = Math.max(worst, Math.abs(a[i] - e[i]) / Math.max(1, Math.abs(e[i])));
    }
  }
  return worst;
}
