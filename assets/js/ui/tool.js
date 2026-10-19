// Gemeinsamer Ablauf der Tool-Seiten: Eingaben lesen -> rechnen (compute) -> anzeigen (render).
// - Neuberechnung live beim Ziehen, hoechstens einmal pro Bildschirm-Frame
// - ein Lauf-Zaehler verwirft Rechnungen, die von neueren Eingaben ueberholt wurden (Materialdaten laden asynchron)
// - Zustand aus der URL beim Laden, danach laufend in die URL (urlState.js)
// - Handy/Tablet: Regler-Panel unten; zugeklappt nur der Hauptregler, "More settings" klappt alles auf
import { initControls } from './controls.js';
import { createChart } from './plotly.js';
import { applyUrlState, writeUrlState } from './urlState.js';

function initPanel(form) {
  // Panel liegt unten fest ueber der Seite: Seitenende um seine Hoehe verlaengern
  const main = form.closest('main');
  const panel = matchMedia('(max-width: 1023.98px)');
  const pad = () => main.style.setProperty('--panel-height', panel.matches ? `${form.offsetHeight + 16}px` : '0px');
  new ResizeObserver(pad).observe(form);
  panel.addEventListener('change', pad);

  const toggle = form.querySelector('[data-controls-toggle]');
  if (!toggle) return;
  const label = toggle.querySelector('[data-controls-toggle-label]');
  toggle.addEventListener('click', () => {
    const expanded = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(expanded));
    form.classList.toggle('is-expanded', expanded);
    label.textContent = expanded ? 'Fewer settings' : 'More settings';
  });
}

export function initTool({ compute, render, onInput }) {
  const form = document.querySelector('[data-controls]');
  const charts = Object.fromEntries([...document.querySelectorAll('[data-chart]')]
    .map((figure) => [figure.dataset.chart, createChart(figure.querySelector('[data-chart-plot]'))]));

  applyUrlState(form);
  let run = 0;
  let frame = 0;

  async function rerun() {
    const id = ++run;
    const state = controls.values();
    const result = await compute(state);
    if (id !== run) return; // neuere Eingabe ueberholt diese Rechnung
    render(result, charts, state);
    writeUrlState(form);
  }

  function schedule(event) {
    if (event && onInput) onInput(event, controls);
    if (!frame) {
      frame = requestAnimationFrame(() => {
        frame = 0;
        rerun();
      });
    }
  }

  const controls = initControls(form, schedule);
  initPanel(form);
  // schmale Bildschirme: aktiven Tab der Tool-Leiste in den sichtbaren Bereich schieben
  const tab = document.querySelector('.tool-tabs [aria-current="page"]');
  const tabs = tab?.closest('ul');
  if (tabs) tabs.scrollLeft += tab.getBoundingClientRect().left - tabs.getBoundingClientRect().left - 16;
  if (onInput) onInput(null, controls);
  rerun();
  return { controls, charts };
}
