// Live-Tank auf der Startseite: Tank-Diagramm aus Cell Reconstruction (buildCell) fuer Graphit/NMC mit den
// Zelleinstellungen realer Materialien aus dem Aging-Tool (cellSettingsFor), nur der SoC-Regler.
// Plotly laedt erst nach dem Laden der Seite, sobald der Tank in die Naehe des Bildschirms kommt;
// bis dahin steht ein Standbild desselben Diagramms.
import { cellSettingsFor } from '../model/aging.js';
import { buildCell } from '../model/cell.js';
import { initControls } from '../ui/controls.js';
import { loadMaterial } from '../ui/data.js';
import { createChart } from '../ui/plotly.js';

const root = document.querySelector('[data-hero-tank]');

if (root) {
  const form = root.querySelector('form');
  const slider = form.elements.soc;
  const link = root.querySelector('[data-hero-link]');
  const settings = cellSettingsFor('Graphite', 'NMC');
  let chart = null;
  let frame = 0;
  let run = 0;

  const linkTo = (soc) => `/tools/cell-reconstruction/?anode=graphite&cathode=nmc&soc=${soc}`
    + `&vmin=${settings.vMin}&vmax=${settings.vMax}&np=${settings.npRatio}&lip=${settings.lipRatio}`;

  async function render() {
    const id = ++run;
    const [anode, cathode] = await Promise.all([loadMaterial('Graphite'), loadMaterial('NMC')]);
    if (id !== run) return;
    chart.update(buildCell({ anode, cathode, soc: Number(slider.value), ...settings }).figDqdv);
  }

  const controls = initControls(form, () => {
    link.href = linkTo(slider.value);
    if (chart && !frame) {
      frame = requestAnimationFrame(() => {
        frame = 0;
        render();
      });
    }
  });

  const loadPlotly = () => new Promise((resolve, reject) => {
    if (window.Plotly) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = root.dataset.plotly;
    script.onload = resolve;
    script.onerror = reject;
    document.head.append(script);
  });

  async function start() {
    await loadPlotly();
    chart = createChart(root.querySelector('[data-chart-plot]'));
    await render();
    root.classList.add('is-live');
    slider.disabled = false;
  }

  const begin = () => {
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      start().catch(() => {}); // ohne Plotly bleibt das Standbild stehen
    }, { rootMargin: '200px' });
    observer.observe(root);
  };

  controls.refresh();
  link.href = linkTo(slider.value);
  if (document.readyState === 'complete') begin();
  else window.addEventListener('load', begin, { once: true });
}
