// Blend-Tool (Port von apps/blending_tanks.py): Graphite (A) und Silicon (B) fest; jede Eingabe = ein Rerun.
import { buildBlending } from '../model/blend.js';
import { loadMaterial } from '../ui/data.js';
import { createChart } from '../ui/plotly.js';
import { initShell } from '../ui/shell.js';
import { initSlider } from '../ui/slider.js';

initShell();

const $ = (selector) => document.querySelector(selector);
const charts = Object.fromEntries(['tanks1', 'tanks2', 'ocv', 'solmap']
  .map((name) => [name, createChart($(`[data-st-chart="${name}"]`))]));
const sliders = {};

let run = 0;
async function rerun() {
  const id = ++run;
  const [matA, matB] = await Promise.all([loadMaterial('Graphite'), loadMaterial('Silicon')]);
  if (id !== run) return;
  const r = buildBlending({ matA, matB, sol: sliders.sol.value, gamma: sliders.gamma.value });
  charts.tanks1.update(r.figTanks1);
  charts.tanks2.update(r.figTanks2);
  charts.ocv.update(r.figOcv);
  charts.solmap.update(r.figSolmap);
}

for (const name of ['sol', 'gamma']) sliders[name] = initSlider($(`#${name}`).closest('[data-st-slider]'), rerun);
rerun();
