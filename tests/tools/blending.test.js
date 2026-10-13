// Blending gegen die Golden-Werte des Originals (tests/golden/ui/blending/); Materialien fest Graphite/Silicon.
import { buildBlending } from '../../assets/js/model/blend.js';
import { material } from '../helpers/materials.js';
import { runToolGoldens, widgetValue } from '../helpers/toolGoldens.js';

runToolGoldens('blending', {
  build(golden) {
    const r = buildBlending({ matA: material('Graphite'), matB: material('Silicon'),
      sol: widgetValue(golden, 'SoL (Blend)'), gamma: widgetValue(golden, 'q% (Material A)') });
    return { figures: [r.figTanks1, r.figTanks2, r.figOcv, r.figSolmap], useContainerWidth: [true, true, true, true] };
  },
});
