// Vergleicht eine portierte Plotly-Figure (toPlotlyJson) mit der Spec, die Streamlit an den Browser sendet.
// Struktur, Schluessel, Texte und null-Positionen exakt; Zahlen mit Toleranz rtol=1e-12 (|d| <= rtol*max(1,|b|)).
// Das Template wird ausgelassen (es kommt in der neuen Seite aus der gemessenen Browser-Fassung).
import assert from 'node:assert/strict';

const RTOL = 1e-12;

export function newStats() {
  return { numbers: 0, inexact: 0, maxDeviation: 0 };
}

function isArrayLike(v) {
  return Array.isArray(v) || ArrayBuffer.isView(v);
}

function compareNumber(a, e, path, stats) {
  stats.numbers += 1;
  if (Number.isNaN(e)) {
    assert.ok(Number.isNaN(a), `${path}: erwartet NaN, erhalten ${a}`);
    return;
  }
  assert.equal(typeof a, 'number', `${path}: erwartet Zahl ${e}, erhalten ${a}`);
  if (!Object.is(a, e) && !(a === 0 && e === 0)) {
    stats.inexact += 1;
    const deviation = Math.abs(a - e) / Math.max(1, Math.abs(e));
    stats.maxDeviation = Math.max(stats.maxDeviation, deviation);
    assert.ok(deviation <= RTOL, `${path}: ${a} vs ${e} (relativ ${deviation})`);
  }
}

export function compareValue(actual, expected, path, stats) {
  if (expected === null) {
    assert.equal(actual, null, `${path}: erwartet null, erhalten ${actual}`);
    return;
  }
  if (typeof expected === 'number') {
    compareNumber(actual, expected, path, stats);
    return;
  }
  if (isArrayLike(expected)) {
    assert.ok(isArrayLike(actual), `${path}: erwartet Array, erhalten ${typeof actual}`);
    assert.equal(actual.length, expected.length, `${path}: Laenge`);
    for (let i = 0; i < expected.length; i += 1) compareValue(actual[i], expected[i], `${path}[${i}]`, stats);
    return;
  }
  if (typeof expected === 'object') {
    assert.ok(actual && typeof actual === 'object' && !isArrayLike(actual), `${path}: erwartet Objekt`);
    const skip = (k) => path.endsWith('.layout') && k === 'template';
    const keys = Object.keys(expected).filter((k) => !skip(k));
    assert.deepEqual(Object.keys(actual).filter((k) => !skip(k)).sort(), [...keys].sort(), `${path}: Schluessel`);
    for (const key of keys) compareValue(actual[key], expected[key], `${path}.${key}`, stats);
    return;
  }
  assert.equal(actual, expected, `${path}`);
}

export function compareSpec(actual, expectedSpec, label, stats = newStats()) {
  compareValue(actual.data, expectedSpec.data, `${label}.data`, stats);
  compareValue(actual.layout, expectedSpec.layout, `${label}.layout`, stats);
  return stats;
}
