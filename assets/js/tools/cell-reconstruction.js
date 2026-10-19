// Cell-Reconstruction-Tool (Port von apps/cell_tanks.py): Materialien laden, buildCell rechnen, Diagramme zeigen.
import { buildCell } from '../model/cell.js';
import { loadMaterial } from '../ui/data.js';
import { initTool } from '../ui/tool.js';

initTool({
  async compute(s) {
    const [anode, cathode] = await Promise.all([loadMaterial(s.anode), loadMaterial(s.cathode)]);
    return buildCell({ anode, cathode, soc: s.soc, vMin: s.vmin, vMax: s.vmax, npRatio: s.np, lipRatio: s.lip });
  },
  render(r, charts) {
    charts.dqdv.update(r.figDqdv);
    charts.voltage.update(r.figVoltage);
  },
});
