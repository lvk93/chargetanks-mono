// Swelling-Tool (Port von apps/swelling_demo.py): Silicon/NMC fest; jede Eingabe = ein Rerun.
// "Cylindrical?" blendet den Compression-Slider aus; da er keinen key hat, kommt er danach mit 0.0 zurueck.
import { buildSwelling, createSwellingModel } from '../model/swelling.js';
import { loadMaterial } from '../ui/data.js';
import { createChart } from '../ui/plotly.js';
import { initShell } from '../ui/shell.js';
import { initSlider } from '../ui/slider.js';

initShell();

const $ = (selector) => document.querySelector(selector);
const charts = Object.fromEntries(['layers', 'classes', 'compression']
  .map((name) => [name, createChart($(`[data-st-chart="${name}"]`))]));
const sliders = {};
const cylindrical = $('#cylindrical');
const compressionElement = $('[data-st-compression]');

let modelPromise = null;
const getModel = () => {
  modelPromise ??= Promise.all([loadMaterial('Silicon'), loadMaterial('NMC')])
    .then(([anode, cathode]) => createSwellingModel(anode, cathode));
  return modelPromise;
};

let run = 0;
async function rerun() {
  const id = ++run;
  const model = await getModel();
  if (id !== run) return;
  const r = buildSwelling({ model, soc: sliders.soc.value, soh: sliders.soh.value,
    compression: cylindrical.checked ? null : sliders.compression.value, cylindrical: cylindrical.checked });
  charts.layers.update(r.figLayers);
  charts.classes.update(r.figClasses);
  charts.compression.update(r.figCompression);
}

for (const name of ['soc', 'soh', 'compression']) sliders[name] = initSlider($(`#${name}`).closest('[data-st-slider]'), rerun);
cylindrical.addEventListener('change', () => {
  if (!cylindrical.checked) sliders.compression.reset(0);
  compressionElement.classList.toggle('st-element--hidden', cylindrical.checked);
  rerun();
});
rerun();
