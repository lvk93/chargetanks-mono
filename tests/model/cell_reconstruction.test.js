// CellOCVReconstruction gegen Direktimporte des Originals (tests/golden/model/cell_reconstruction.json).
import { test } from 'node:test';
import { CellOCVReconstruction } from '../../assets/js/model/cellReconstruction.js';
import { assertBitEqual, loadGolden } from '../helpers/golden.js';
import { material } from '../helpers/materials.js';

const { cases } = loadGolden('model/cell_reconstruction.json');

test('CellOCVReconstruction: Stoechiometrien, Spannungen, Aging-Modi bitgenau', () => {
  for (const c of cases) {
    const label = `${c.anode}+${c.cathode} np=${c.np_ratio} lip=${c.lip_ratio} v=${c.v_min}-${c.v_max}`;
    const rec = new CellOCVReconstruction({
      cath: material(c.cathode), an: material(c.anode), npRatio: c.np_ratio, lipRatio: c.lip_ratio,
      vMin: c.v_min, vMax: c.v_max,
    });
    const st = rec.getStoichiometries();
    assertBitEqual(st, c.stoichiometries, `${label} stoich`);
    const r = rec.reconstructVoltage(...st);
    assertBitEqual(r.vCell, c.reconstruct.V_cell, `${label} V_cell`);
    assertBitEqual(r.vCath, c.reconstruct.V_cath, `${label} V_cath`);
    assertBitEqual(r.vAn, c.reconstruct.V_an, `${label} V_an`);
    assertBitEqual(r.socAn, c.reconstruct.soc_an, `${label} soc_an`);
    assertBitEqual(r.socCath, c.reconstruct.soc_cath, `${label} soc_cath`);
    for (const a of c.aging) {
      assertBitEqual(rec.simulateAgingModes(a.lampe, a.lamne, a.lli), a.stoichiometries,
        `${label} aging ${a.lampe}/${a.lamne}/${a.lli}`);
    }
  }
});
