// react-range normalizeValue (Streamlit-Slider): Rastung, auch mit negativem Schritt (Swelling SoH 1.0 -> 0.8, -0.01).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeValue } from '../../assets/js/ui/slider.js';

test('positiver Schritt: naechster Rasterwert, Klemmen auf [min, max]', () => {
  assert.equal(normalizeValue(0.504, 0, 1, 0.01), 0.5);
  assert.equal(normalizeValue(0.506, 0, 1, 0.01), 0.51);
  assert.equal(normalizeValue(0.5 + 0.01, 0, 1, 0.01), 0.51);
  assert.equal(normalizeValue(1.05, 0, 1, 0.01), 1);
  assert.equal(normalizeValue(-0.1, 0, 1, 0.01), 0);
  assert.equal(normalizeValue(30 + 10, 0, 60, 1), 40);
});

test('negativer Schritt wie im Browser gemessen (SoH)', () => {
  assert.equal(normalizeValue(0.9, 0.8, 1, -0.01), 0.89); // Klick in die Mitte
  assert.equal(normalizeValue(0.8, 0.8, 1, -0.01), 0.79); // ganz links
  assert.equal(normalizeValue(1 - 0.01, 0.8, 1, -0.01), 0.98); // Pfeil rechts ab 1.00
  assert.equal(normalizeValue(1 + 0.01, 0.8, 1, -0.01), 1); // Pfeil links ab 1.00
  assert.equal(normalizeValue(0.79 - 0.01, 0.8, 1, -0.01), 0.8); // unter min -> min
});
