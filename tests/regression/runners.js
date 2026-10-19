// Fuehrt die Rechnung eines Tools fuer einen Zustand aus states.js aus (wie die Tool-Seiten) und liefert
// den Fingerabdruck: je Diagramm traces/marks/texts (fingerprint.js) plus die angezeigten Ueberschriften.
import { buildAging } from '../../assets/js/model/aging.js';
import { buildBlending } from '../../assets/js/model/blend.js';
import { buildCell } from '../../assets/js/model/cell.js';
import { toPlotlyJson } from '../../assets/js/model/figure.js';
import { buildMaterialExplorer } from '../../assets/js/model/materialExplorer.js';
import { buildSwelling, createSwellingModel } from '../../assets/js/model/swelling.js';
import { material } from '../helpers/materials.js';
import { fingerprintFigure } from './fingerprint.js';

let swellingModel = null;

const RUNNERS = {
  materials: (s) => {
    const r = buildMaterialExplorer({ materialName: s.material, material: material(s.material), sol: s.sol });
    return { figures: [r.figDqdv, r.figVoltage] };
  },
  'cell-reconstruction': (s) => {
    const r = buildCell({ anode: material(s.anode), cathode: material(s.cathode), soc: s.soc, vMin: s.vmin, vMax: s.vmax,
      npRatio: s.np, lipRatio: s.lip });
    return { figures: [r.figDqdv, r.figVoltage] };
  },
  blending: (s) => {
    const r = buildBlending({ matA: material('Graphite'), matB: material('Silicon'), sol: s.sol, gamma: s.gamma });
    return { figures: [r.figTanks1, r.figTanks2, r.figOcv, r.figSolmap] };
  },
  aging: (s) => {
    const r = buildAging({ anodeName: s.anode, cathodeName: s.cathode, anode: material(s.anode), cathode: material(s.cathode),
      soc: s.soc, lampe: s.lampe, lamne: s.lamne, lli: s.lli });
    return { figures: [r.figCaps, r.figTank, r.figOcv], headings: [r.heading] };
  },
  swelling: (s) => {
    swellingModel ??= createSwellingModel(material('Silicon'), material('NMC'));
    const r = buildSwelling({ model: swellingModel, soc: s.soc, soh: s.soh, compression: s.cylindrical ? null : s.compression,
      cylindrical: s.cylindrical });
    return { figures: [r.figLayers, r.figClasses, r.figCompression] };
  },
};

export const TOOLS = Object.keys(RUNNERS);

export async function fingerprintState(tool, state) {
  const { figures, headings = [] } = RUNNERS[tool](state);
  const out = [];
  for (const fig of figures) out.push(await fingerprintFigure(toPlotlyJson(fig)));
  return { figures: out, headings };
}
