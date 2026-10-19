// Diagramme mit plotly.js. Die Figures kommen unveraendert aus dem Modell (assets/js/model/); diese
// Darstellungsschicht passt nur das Layout an: Groesse aus dem Container (CSS), Schriftgroessen und Raender
// nach Diagrammbreite, Systemschrift, Template. Die Daten der Traces bleiben unangetastet.
// Modebar-Button "Fullscreen"/"Close fullscreen": Rahmen fuellt den Viewport, Escape beendet.
import { toPlotlyJson } from '../model/figure.js';
import { CHART_CONFIG, CHART_TEMPLATE, FONT_FAMILY, FULLSCREEN_EXIT_ICON, FULLSCREEN_ICON } from './chartTheme.js';

// Breite, fuer die die Schriftgroessen der Modelle (Titel 24 px, Ticks 18 px) gedacht sind
const REFERENCE_WIDTH = 520;
const MIN_SCALE = 0.55;

let openChart = null; // hoechstens ein Diagramm im Vollbild

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && openChart) openChart.collapse();
});

const placed = (...values) => values.every((v) => v !== null && v !== undefined);

// Kopie des Layouts: Schriftgroessen skaliert, Schriftfamilie der Webseite; Arrays bleiben, wie sie sind
function present(value, scale, key = null) {
  if (Array.isArray(value)) return value.map((item) => present(item, scale));
  if (value === null || typeof value !== 'object' || ArrayBuffer.isView(value)) return value;
  const out = {};
  for (const [k, v] of Object.entries(value)) out[k] = present(v, scale, k);
  if (key !== null && /font$/i.test(key)) {
    if (typeof out.size === 'number') out.size = Math.round(out.size * scale * 10) / 10;
    out.family = FONT_FAMILY;
  }
  if (key === 'margin') {
    for (const side of ['l', 'r', 't', 'b']) if (typeof out[side] === 'number') out[side] = Math.round(out[side] * scale);
    // oben und rechts steht nichts (Titel stehen ueber dem Diagramm), automargin vergroessert bei Bedarf
    if (typeof out.t === 'number') out.t = Math.min(out.t, 24);
    if (typeof out.r === 'number') out.r = Math.min(out.r, 30);
  }
  return out;
}

export function createChart(plot) {
  const frame = plot.closest('[data-chart-frame]') ?? plot;
  let figure = null;
  let fullscreen = false;
  let lastSize = '';

  function config() {
    const icon = fullscreen ? FULLSCREEN_EXIT_ICON : FULLSCREEN_ICON;
    const name = fullscreen ? 'Close fullscreen' : 'Fullscreen';
    return { ...CHART_CONFIG, modeBarButtonsToAdd: [{ name, icon, click: () => (fullscreen ? api.collapse() : api.expand()) }] };
  }

  function render() {
    if (!figure) return;
    const width = plot.clientWidth;
    const height = plot.clientHeight;
    if (!width || !height) return;
    lastSize = `${width}x${height}`;
    const json = toPlotlyJson(figure);
    plot.chargetanksFigure = json; // Figure vor der Darstellungsschicht (Pruefung im Browser, Fehlersuche)
    // Fuellflaechen ohne mode zeigen bei weniger als 20 Punkten Marker (B8) - nur Linie, keine Punkte
    const data = json.data.map((trace) => (trace.fill && trace.mode === undefined ? { ...trace, mode: 'lines' } : trace));
    const scale = Math.min(1, Math.max(MIN_SCALE, width / REFERENCE_WIDTH));
    const layout = { ...present({ ...json.layout, template: undefined }, scale), template: CHART_TEMPLATE, width, height };
    // Shapes und Annotationen ohne gueltige Position (NaN aus der Rechnung, z. B. PCHIP ausserhalb des Bereichs)
    // setzt Plotly an Ersatzpositionen: im Original ein schraeger Strich und ein verrutschtes Label (B18)
    if (layout.shapes) layout.shapes = layout.shapes.filter((s) => placed(s.x0, s.x1, s.y0, s.y1));
    if (layout.annotations) layout.annotations = layout.annotations.filter((a) => placed(a.x, a.y) && a.ax !== null && a.ay !== null);
    window.Plotly.react(plot, data, layout, config());
  }

  new ResizeObserver(() => {
    if (figure && `${plot.clientWidth}x${plot.clientHeight}` !== lastSize) render();
  }).observe(plot);

  const api = {
    update(fig) {
      figure = fig;
      render();
    },
    expand() {
      if (openChart && openChart !== api) openChart.collapse();
      fullscreen = true;
      openChart = api;
      frame.classList.add('is-fullscreen');
      document.body.classList.add('has-fullscreen-chart');
      render();
    },
    collapse() {
      fullscreen = false;
      if (openChart === api) openChart = null;
      frame.classList.remove('is-fullscreen');
      document.body.classList.remove('has-fullscreen-chart');
      render();
    },
    get element() {
      return plot;
    },
  };
  return api;
}
