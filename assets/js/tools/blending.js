// Blend-Tool (Port von apps/blending_tanks.py): Graphite (A) und Silicon (B) fest; buildBlending rechnen, Diagramme zeigen.
import { buildBlending } from '../model/blend.js';
import { loadMaterial } from '../ui/data.js';
import { initTool } from '../ui/tool.js';

initTool({
  async compute(s) {
    const [matA, matB] = await Promise.all([loadMaterial('Graphite'), loadMaterial('Silicon')]);
    return buildBlending({ matA, matB, sol: s.sol, gamma: s.gamma });
  },
  render(r, charts) {
    charts.tanks1.update(r.figTanks1);
    charts.tanks2.update(r.figTanks2);
    charts.ocv.update(r.figOcv);
    charts.solmap.update(r.figSolmap);
  },
});
