// Regressionspruefung: Die Tools muessen fuer alle Zustaende aus states.js exakt dieselben Diagrammdaten,
// Markierungen und Texte liefern wie der gegen das Python-Original gepruefte Stand (reference.json).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fingerprintState, TOOLS } from './runners.js';
import { STATES } from './states.js';

const reference = JSON.parse(readFileSync(new URL('./reference.json', import.meta.url), 'utf8'));

test('Referenz deckt genau die Zustaende ab', () => {
  assert.deepEqual(Object.keys(reference), TOOLS);
  for (const tool of TOOLS) assert.deepEqual(Object.keys(reference[tool]), Object.keys(STATES[tool]), tool);
});

for (const tool of TOOLS) {
  for (const [name, state] of Object.entries(STATES[tool])) {
    test(`${tool}: ${name}`, async () => {
      assert.deepEqual(await fingerprintState(tool, state), reference[tool][name]);
    });
  }
}
