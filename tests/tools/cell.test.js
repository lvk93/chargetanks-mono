// Cell Reconstruction gegen die Golden-Werte des Originals (tests/golden/ui/cell-reconstruction/).
import { buildCell } from '../../assets/js/model/cell.js';
import { material } from '../helpers/materials.js';
import { runToolGoldens, widgetValue } from '../helpers/toolGoldens.js';

runToolGoldens('cell-reconstruction', {
  build(golden) {
    const v = (label) => widgetValue(golden, label);
    const r = buildCell({
      anode: material(v('Anode')), cathode: material(v('Cathode')), soc: v('SoC'), vMin: v('V min [V]'),
      vMax: v('V max [V]'), npRatio: v('NP Ratio'), lipRatio: v('LiP Ratio'),
    });
    return { figures: [r.figDqdv, r.figVoltage], useContainerWidth: [true, true] };
  },
});
