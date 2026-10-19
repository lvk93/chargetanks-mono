// Darstellung der Diagramme: kompaktes Plotly-Template, Plotly-Config und die Symbole des Vollbild-Buttons.
// Template und Config uebernehmen die sichtbaren Werte, die Streamlit im Original setzte (Schriftfarbe,
// Hover, Achsabstaende, Raender, Modebar); Schrift ist die Systemschrift der Webseite.
export const FONT_FAMILY = 'ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"';

const TEXT = '#e6eaf1';
const GRID = '#31333F';
const NAVY = '#003B73';

const axis = (standoff) => ({
  automargin: true,
  gridcolor: GRID,
  zerolinecolor: GRID,
  tickcolor: GRID,
  tickfont: { color: TEXT, size: 12 },
  title: { standoff, font: { color: TEXT, size: 14 } },
});

export const CHART_TEMPLATE = {
  layout: {
    font: { family: FONT_FAMILY, color: TEXT, size: 12 },
    paper_bgcolor: NAVY,
    plot_bgcolor: NAVY,
    hovermode: 'closest',
    hoverlabel: { bgcolor: NAVY, bordercolor: 'rgba(255, 255, 255, 0.2)', font: { family: FONT_FAMILY, color: TEXT, size: 12 } },
    legend: { bordercolor: 'transparent', borderwidth: 0, valign: 'top', font: { color: '#fafafa', size: 12 } },
    margin: { pad: 8 },
    xaxis: { ...axis(20), showgrid: false, zeroline: false },
    yaxis: { ...axis(24), ticklabelposition: 'outside' },
  },
};

export const CHART_CONFIG = {
  displayModeBar: 'hover',
  displaylogo: false,
  modeBarButtonsToRemove: ['sendDataToCloud', 'lasso2d', 'select2d'],
  responsive: false,
  doubleClick: 'reset+autosize',
  locale: 'en-US',
};

export const FULLSCREEN_ICON = {
  width: 600,
  height: 470,
  name: 'fullscreen-expand',
  path: 'M32 32C14.3 32 0 46.3 0 64v96c0 17.7 14.3 32 32 32s32-14.3 32-32V96h64c17.7 0 32-14.3 32-32s-14.3-32-32-32H32zM64 352c0-17.7-14.3-32-32-32s-32 14.3-32 32v96c0 17.7 14.3 32 32 32h96c17.7 0 32-14.3 32-32s-14.3-32-32-32H64V352zM320 32c-17.7 0-32 14.3-32 32s14.3 32 32 32h64v64c0 17.7 14.3 32 32 32s32-14.3 32-32V64c0-17.7-14.3-32-32-32H320zM448 352c0-17.7-14.3-32-32-32s-32 14.3-32 32v64H320c-17.7 0-32 14.3-32 32s14.3 32 32 32h96c17.7 0 32-14.3 32-32V352z',
};

export const FULLSCREEN_EXIT_ICON = {
  width: 600,
  height: 470,
  name: 'fullscreen-collapse',
  path: 'M160 64c0-17.7-14.3-32-32-32s-32 14.3-32 32v64H32c-17.7 0-32 14.3-32 32s14.3 32 32 32h96c17.7 0 32-14.3 32-32V64zM32 320c-17.7 0-32 14.3-32 32s14.3 32 32 32H96v64c0 17.7 14.3 32 32 32s32-14.3 32-32V352c0-17.7-14.3-32-32-32H32zM352 64c0-17.7-14.3-32-32-32s-32 14.3-32 32v96c0 17.7 14.3 32 32 32h96c17.7 0 32-14.3 32-32s-14.3-32-32-32H352V64zM320 320c-17.7 0-32 14.3-32 32v96c0 17.7 14.3 32 32 32s32-14.3 32-32V384h64c17.7 0 32-14.3 32-32s-14.3-32-32-32H320z',
};
