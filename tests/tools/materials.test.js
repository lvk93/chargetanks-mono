// Materials gegen die Golden-Werte des Originals (tests/golden/ui/materials/).
import { buildMaterialExplorer } from '../../assets/js/model/materialExplorer.js';
import { material } from '../helpers/materials.js';
import { runToolGoldens, widgetValue } from '../helpers/toolGoldens.js';

runToolGoldens('materials', {
  build(golden) {
    const name = widgetValue(golden, 'Material');
    const r = buildMaterialExplorer({ materialName: name, material: material(name), sol: widgetValue(golden, 'SoL') });
    return { figures: [r.figDqdv, r.figVoltage], useContainerWidth: [true, true] };
  },
});
