// Materialdaten: bytegleich zum Original (sha256 aus migration/convert_materials.py) und vollstaendig.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { getMaterialNames } from '../../assets/js/model/materials.js';
import { materialIndex, rawMaterialBytes } from '../helpers/materials.js';

test('Materialdateien bytegleich zum Original', () => {
  assert.equal(materialIndex.length, 8);
  for (const entry of materialIndex) {
    const digest = createHash('sha256').update(rawMaterialBytes(entry.file)).digest('hex');
    assert.equal(digest, entry.sha256, entry.file);
  }
});

test('Namensreihenfolge wie get_material_names (gemessene Optionen im Original)', () => {
  assert.deepEqual(getMaterialNames(materialIndex),
    ['Ideal Anode', 'Ideal Cathode', 'Graphite', 'LCO', 'LFP', 'NCA', 'NMC', 'Silicon']);
  assert.deepEqual(getMaterialNames(materialIndex, 'anode'), ['Ideal Anode', 'Graphite', 'Silicon']);
  assert.deepEqual(getMaterialNames(materialIndex, 'cathode'), ['Ideal Cathode', 'LCO', 'LFP', 'NCA', 'NMC']);
});
