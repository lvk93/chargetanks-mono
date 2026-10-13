// Materialdaten (Port von activematerial_reduced.py und utils.get_material_names).
// Eingabe: das JSON einer Materialdatei (assets/data/materials/*.json, bytegleich zum Original).

export const DEFAULT_ANODE_MATERIAL = 'Ideal Anode';
export const DEFAULT_CATHODE_MATERIAL = 'Ideal Cathode';

// Wie pd.DataFrame(payload["data"]): eine Spalte je Schluessel des ersten Datensatzes.
export function parseMaterial(payload) {
  const rows = payload.data;
  const data = {};
  for (const key of Object.keys(rows[0])) data[key] = Float64Array.from(rows, (row) => row[key]);
  return { name: payload.name, kind: payload.kind, qTheo: payload.q_theo_mAhg, data };
}

export function columnMin(column) {
  let out = Infinity;
  for (const v of column) if (v < out) out = v;
  return out;
}

export function columnMax(column) {
  let out = -Infinity;
  for (const v of column) if (v > out) out = v;
  return out;
}

const byCodePoint = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// utils.get_material_names(kind): Ideal-Material zuerst, der Rest alphabetisch (Python sorted()).
// entries: [{name, kind}] in der Reihenfolge von assets/data/materials/index.json.
export function getMaterialNames(entries, kind = null) {
  const names = kind === null
    ? entries.map((e) => e.name)
    : entries.filter((e) => e.kind.toLowerCase() === kind.toLowerCase()).map((e) => e.name);
  let priority = [];
  if (kind === null) priority = [DEFAULT_ANODE_MATERIAL, DEFAULT_CATHODE_MATERIAL];
  else if (kind.toLowerCase() === 'anode') priority = [DEFAULT_ANODE_MATERIAL];
  else if (kind.toLowerCase() === 'cathode') priority = [DEFAULT_CATHODE_MATERIAL];
  const prioritized = priority.filter((name) => names.includes(name));
  const remaining = names.filter((name) => !prioritized.includes(name)).sort(byCodePoint);
  return [...prioritized, ...remaining];
}

export function ocvPchipInput(material, direction, theo = false) {
  return { x: material.data[theo ? 'SoL' : 'SoL_prac'], y: material.data[`OCV_${direction}`] };
}
