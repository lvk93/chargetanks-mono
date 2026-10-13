// Anker-IDs der Ueberschriften wie im Original (gemessene IDs aus migration/inventory/suite/*/dom.html).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { anchorId } from '../../assets/js/ui/heading.js';

test('anchorId == Streamlit-Anker (lodash kebabCase)', () => {
  const cases = {
    '🧓 Understand Aging Modes with the Tank Analogy': 'understand-aging-modes-with-the-tank-analogy',
    '⚙️ The knobs you can play with:': 'the-knobs-you-can-play-with',
    'Capacities (relative to cathode). SoH: 100.00%': 'capacities-relative-to-cathode-so-h-100-00',
    '🔋 Electrode dQ/dV Tanks': 'electrode-d-q-d-v-tanks',
    '📈 Voltage vs. SoC': 'voltage-vs-so-c',
  };
  for (const [text, id] of Object.entries(cases)) assert.equal(anchorId(text), id, text);
});
