// Material-Tool (Port von apps/material_tanks.py): jede Eingabeaenderung = ein Rerun.
import { buildMaterialExplorer } from '../model/materialExplorer.js';
import { loadMaterial } from '../ui/data.js';
import { createChart } from '../ui/plotly.js';
import { initShell } from '../ui/shell.js';
import { initSlider } from '../ui/slider.js';

initShell();

const $ = (selector) => document.querySelector(selector);
const select = $('#material');
const charts = { dqdv: createChart($('[data-st-chart="dqdv"]')), voltage: createChart($('[data-st-chart="voltage"]')) };
let sol = null;

let run = 0;
async function rerun() {
  const id = ++run;
  const name = select.value;
  const material = await loadMaterial(name);
  if (id !== run) return;
  const r = buildMaterialExplorer({ materialName: name, material, sol: sol.value });
  charts.dqdv.update(r.figDqdv);
  charts.voltage.update(r.figVoltage);
}

sol = initSlider($('#sol').closest('[data-st-slider]'), rerun);
select.addEventListener('change', rerun);
rerun();
