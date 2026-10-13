// Laedt die Materialdaten aus assets/data/materials/ fuer Node-Tests (im Browser: assets/js/ui/data.js).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseMaterial } from '../../assets/js/model/materials.js';

const DIR = fileURLToPath(new URL('../../assets/data/materials/', import.meta.url));

export const materialIndex = JSON.parse(readFileSync(`${DIR}index.json`, 'utf8'));

const cache = new Map();

export function material(name) {
  if (!cache.has(name)) {
    const entry = materialIndex.find((e) => e.name === name);
    if (!entry) throw new Error(`Material ${name} fehlt`);
    cache.set(name, parseMaterial(JSON.parse(readFileSync(`${DIR}${entry.file}`, 'utf8'))));
  }
  return cache.get(name);
}

export function rawMaterialBytes(file) {
  return readFileSync(`${DIR}${file}`);
}
