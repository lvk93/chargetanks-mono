// Laedt Materialdaten im Browser (einmal pro Material, danach aus dem Speicher - wie @st.cache_data).
import { parseMaterial } from '../model/materials.js';

const BASE = '/assets/data/materials/';
let indexPromise = null;
const cache = new Map();

function loadIndex() {
  indexPromise ||= fetch(`${BASE}index.json`).then((r) => r.json());
  return indexPromise;
}

export function loadMaterial(name) {
  if (!cache.has(name)) {
    cache.set(name, loadIndex().then((index) => {
      const entry = index.find((e) => e.name === name);
      if (!entry) throw new Error(`Material ${name} unbekannt`);
      return fetch(`${BASE}${entry.file}`).then((r) => r.json()).then(parseMaterial);
    }));
  }
  return cache.get(name);
}
