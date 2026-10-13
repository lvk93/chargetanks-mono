// Swelling gegen die Golden-Werte des Originals (tests/golden/ui/swelling/); Materialien fest Silicon/NMC.
import { buildSwelling, createSwellingModel } from '../../assets/js/model/swelling.js';
import { material } from '../helpers/materials.js';
import { runToolGoldens, widgetValue } from '../helpers/toolGoldens.js';

const model = createSwellingModel(material('Silicon'), material('NMC'));

runToolGoldens('swelling', {
  build(golden) {
    const cylindrical = widgetValue(golden, 'Cylindrical?');
    const r = buildSwelling({ model, soc: widgetValue(golden, 'SoC'), soh: widgetValue(golden, 'State of Health'),
      compression: cylindrical ? null : widgetValue(golden, 'Compression [MPa]'), cylindrical });
    return { figures: [r.figLayers, r.figClasses, r.figCompression], useContainerWidth: [true, true, true] };
  },
});
