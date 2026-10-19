// Material-Tool (Port von apps/material_tanks.py): Material laden, buildMaterialExplorer rechnen, Diagramme zeigen.
import { buildMaterialExplorer } from '../model/materialExplorer.js';
import { loadMaterial } from '../ui/data.js';
import { initTool } from '../ui/tool.js';

initTool({
  async compute(s) {
    const material = await loadMaterial(s.material);
    return buildMaterialExplorer({ materialName: s.material, material, sol: s.sol });
  },
  render(r, charts) {
    charts.dqdv.update(r.figDqdv);
    charts.voltage.update(r.figVoltage);
  },
});
