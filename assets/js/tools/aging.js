// Aging-Tool (Port von apps/aging_demo.py): Materialien laden, buildAging rechnen, Diagramme und SoH anzeigen.
import { formatFixed } from '../core/pyformat.js';
import { buildAging } from '../model/aging.js';
import { loadMaterial } from '../ui/data.js';
import { initTool } from '../ui/tool.js';

const soh = document.querySelector('[data-readout="soh"]');

initTool({
  async compute(s) {
    const [anode, cathode] = await Promise.all([loadMaterial(s.anode), loadMaterial(s.cathode)]);
    return buildAging({ anodeName: s.anode, cathodeName: s.cathode, anode, cathode, soc: s.soc, lampe: s.lampe,
      lamne: s.lamne, lli: s.lli });
  },
  render(r, charts) {
    charts.tank.update(r.figTank);
    charts.ocv.update(r.figOcv);
    charts.caps.update(r.figCaps);
    // gleiche Formatierung wie die SoH-Zeile des Originals (f"{100*soh:.2f}")
    soh.textContent = `SoH ${formatFixed(100 * r.caps.soh, 2)}%`;
  },
});
