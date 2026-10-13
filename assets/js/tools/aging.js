// Aging-Tool (Port von apps/aging_demo.py): Eingaben -> Rechnung -> Diagramme und SoH-Zeile.
// Jede Eingabeaenderung loest wie in Streamlit einen kompletten "Rerun" aus; Slider mit 200 ms Debounce.
import { buildAging } from '../model/aging.js';
import { loadMaterial } from '../ui/data.js';
import { setHeadingText } from '../ui/heading.js';
import { createChart } from '../ui/plotly.js';
import { initShell } from '../ui/shell.js';
import { initSlider } from '../ui/slider.js';

initShell();

const $ = (selector) => document.querySelector(selector);
const anode = $('#anode');
const cathode = $('#cathode');
const charts = {
  caps: createChart($('[data-st-chart="caps"]')),
  tank: createChart($('[data-st-chart="tank"]')),
  ocv: createChart($('[data-st-chart="ocv"]')),
};
const heading = $('[data-st-capacities]');

let run = 0;
async function rerun() {
  const id = ++run;
  const state = {
    anodeName: anode.value,
    cathodeName: cathode.value,
    soc: sliders.soc.value,
    lampe: sliders.lampe.value,
    lamne: sliders.lamne.value,
    lli: sliders.lli.value,
  };
  const [an, ca] = await Promise.all([loadMaterial(state.anodeName), loadMaterial(state.cathodeName)]);
  if (id !== run) return; // neuere Eingabe ueberholt diese Rechnung
  const result = buildAging({ ...state, anode: an, cathode: ca });
  setHeadingText(heading, result.heading);
  charts.caps.update(result.figCaps);
  charts.tank.update(result.figTank);
  charts.ocv.update(result.figOcv);
}

const sliders = Object.fromEntries(['soc', 'lampe', 'lamne', 'lli'].map((name) => [
  name,
  initSlider($(`#${name}`).closest('[data-st-slider]'), rerun),
]));
anode.addEventListener('change', rerun);
cathode.addEventListener('change', rerun);

rerun();
