// Cell-Reconstruction-Tool (Port von apps/cell_tanks.py): jede Eingabeaenderung = ein Rerun.
import { buildCell } from '../model/cell.js';
import { loadMaterial } from '../ui/data.js';
import { createChart } from '../ui/plotly.js';
import { initShell } from '../ui/shell.js';
import { initSlider } from '../ui/slider.js';

initShell();

const $ = (selector) => document.querySelector(selector);
const anode = $('#anode');
const cathode = $('#cathode');
const charts = { dqdv: createChart($('[data-st-chart="dqdv"]')), voltage: createChart($('[data-st-chart="voltage"]')) };
const sliders = {};

let run = 0;
async function rerun() {
  const id = ++run;
  const [an, ca] = await Promise.all([loadMaterial(anode.value), loadMaterial(cathode.value)]);
  if (id !== run) return;
  const r = buildCell({
    anode: an, cathode: ca, soc: sliders.soc.value, vMin: sliders.vmin.value, vMax: sliders.vmax.value,
    npRatio: sliders.np.value, lipRatio: sliders.lip.value,
  });
  charts.dqdv.update(r.figDqdv);
  charts.voltage.update(r.figVoltage);
}

for (const name of ['soc', 'vmin', 'vmax', 'np', 'lip']) {
  sliders[name] = initSlider($(`#${name}`).closest('[data-st-slider]'), rerun);
}
anode.addEventListener('change', rerun);
cathode.addEventListener('change', rerun);
rerun();
