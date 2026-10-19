// Plotly-Diagramm wie st.plotly_chart (Streamlit 1.47.0, PlotlyChart.tsx):
// - Template und Config so, wie Streamlit sie an plotly.js uebergibt (plotlyTheme.js, gemessen)
// - use_container_width: Breite = Containerbreite (mind. 150 px), Hoehe aus der Figure
// - Modebar-Button "Fullscreen"/"Close fullscreen": Rahmen fuellt den Viewport (Escape beendet)
import { toPlotlyJson } from '../model/figure.js';
import { FULLSCREEN_BUTTON, FULLSCREEN_EXIT_BUTTON, PLOTLY_TEMPLATE, STREAMLIT_CONFIG, STREAMLIT_TEMPLATE } from './plotlyTheme.js';

const MIN_WIDTH = 150;
const DEFAULT_PLOTLY_HEIGHT = 450;
// Schrift der Webseite statt "open sans" (Original ohne Fallback -> Serifenschrift, B6)
const FONT_FAMILY = 'ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"';

// Kopie mit FONT_FAMILY an jeder Schriftangabe (Template und Figure-Layout); Arrays bleiben unangetastet.
function withFontFamily(value) {
  if (Array.isArray(value)) return value.map(withFontFamily);
  if (value === null || typeof value !== 'object' || ArrayBuffer.isView(value)) return value;
  const out = {};
  for (const [key, v] of Object.entries(value)) out[key] = key === 'family' ? FONT_FAMILY : withFontFamily(v);
  return out;
}

const TEMPLATES = { streamlit: withFontFamily(STREAMLIT_TEMPLATE), plotly: withFontFamily(PLOTLY_TEMPLATE) };

let openChart = null; // hoechstens ein Diagramm im Vollbild

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && openChart) openChart.collapse();
});

export function createChart(container) {
  const frame = container.closest('.st-chart-frame') || container;
  let figure = null;
  let fullscreen = false;
  let lastWidth = null;

  function size() {
    if (fullscreen) {
      const style = getComputedStyle(frame);
      const width = frame.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const height = frame.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
      return { width, height };
    }
    return {
      width: Math.max(container.clientWidth, MIN_WIDTH),
      height: figure.layout.height ?? DEFAULT_PLOTLY_HEIGHT,
    };
  }

  function config() {
    const button = fullscreen ? FULLSCREEN_EXIT_BUTTON : FULLSCREEN_BUTTON;
    return {
      ...STREAMLIT_CONFIG,
      modeBarButtonsToAdd: [{ name: button.name, icon: button.icon, click: () => (fullscreen ? api.collapse() : api.expand()) }],
    };
  }

  function render() {
    if (!figure) return;
    const json = toPlotlyJson(figure);
    const { width, height } = size();
    lastWidth = width;
    // Standard ist Streamlits Template; template="plotly" in der Figure (Blending) -> gemessenes Plotly-Template
    const template = json.layout.template === 'plotly' ? TEMPLATES.plotly : TEMPLATES.streamlit;
    const layout = { ...withFontFamily(json.layout), template, width, height };
    window.Plotly.react(container, json.data, layout, config());
  }

  const observer = new ResizeObserver(() => {
    if (figure && size().width !== lastWidth) render();
  });
  observer.observe(fullscreen ? frame : container);

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
      render();
    },
    collapse() {
      fullscreen = false;
      if (openChart === api) openChart = null;
      frame.classList.remove('is-fullscreen');
      render();
    },
    get element() {
      return container;
    },
  };
  return api;
}
