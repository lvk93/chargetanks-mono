// Materiallisten fuer die Auswahlfelder der Tools, zur Build-Zeit aus assets/data/materials/index.json.
// Reihenfolge wie im Original (utils.get_material_names): Ideal-Material zuerst, der Rest alphabetisch.
import { readFileSync } from 'node:fs';
import { getMaterialNames } from '../../assets/js/model/materials.js';

const index = JSON.parse(readFileSync(new URL('../../assets/data/materials/index.json', import.meta.url), 'utf8'));
const slugOf = (name) => index.find((entry) => entry.name === name).file.replace(/\.json$/, '');
const list = (kind) => getMaterialNames(index, kind).map((name) => ({ name, slug: slugOf(name) }));

export default {
  all: list(null),
  anode: list('anode'),
  cathode: list('cathode'),
};
