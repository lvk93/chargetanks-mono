// Port der Rechnung aus apps/aging_demo.py (ocv_teaching@master): Figures und angezeigte Texte.
import { formatFixed } from '../core/pyformat.js';
import { CellOCVReconstruction } from './cellReconstruction.js';
import { addAnnotation, addTrace, newFigure, updateLayout } from './figure.js';
import { DEFAULT_ANODE_MATERIAL, DEFAULT_CATHODE_MATERIAL } from './materials.js';
import { BatteryTankPlotter, BC } from './tankPlotter.js';

// viz/theme.py
const PALETTE = { dark_gray: '#333333', white: '#FFFFFF', navy_blue: '#003B73' };
const COL_LI = '#5DADE2'; // COL_FILL
const COL_AN = '#70AD47'; // COL_ANODE
const COL_CA = '#F39C12'; // COL_CATHODE
const GRID_COLOR = '#666666';

export function cellSettingsFor(anodeName, cathodeName) {
  if (anodeName === DEFAULT_ANODE_MATERIAL && cathodeName === DEFAULT_CATHODE_MATERIAL) {
    return { npRatio: 1.0, lipRatio: 1.0, vMin: 2.0, vMax: 4.0 };
  }
  return { npRatio: 1.1, lipRatio: 0.95, vMin: 2.8, vMax: 4.2 };
}

export function computeCapsSimplified(rec, lampe = 0.0, lamne = 0.0, lli = 0.0) {
  const [solAn0, solCath0, , solCath1] = rec.getStoichiometries();
  const qCaBol = 1.0;
  const qAnBol = rec.npRatio;
  const qLiBol = solAn0 * rec.npRatio + solCath0;
  const qCaAged = qCaBol * (1 - lampe);
  const qAnAged = qAnBol * (1 - lamne);
  const qLiAged = qLiBol * (1 - lli);
  const [, solCath0Aged, , solCath1Aged] = rec.getStoichiometries({
    npRatio: qAnAged / qCaAged, lipRatio: qLiAged / qCaAged,
  });
  const soh = ((solCath0Aged - solCath1Aged) * (1 - lampe)) / (solCath0 - solCath1);
  return {
    labels: ['Lithium', 'Anode', 'Cathode'],
    bol: Float64Array.of(qLiBol, qAnBol, qCaBol),
    aged: Float64Array.of(qLiAged, qAnAged, qCaAged),
    soh,
  };
}

function arrayMax(values) {
  return Array.from(values).some(Number.isNaN) ? NaN : Math.max(...values);
}

function arrayMin(values) {
  return Array.from(values).some(Number.isNaN) ? NaN : Math.min(...values);
}

export function plotCapsBolLineAgedFillHorizontal(caps, showLimitingLine = true) {
  const { labels, bol, aged } = caps;
  const colors = [COL_LI, COL_AN, COL_CA];
  const y = Float64Array.of(0, 1, 2); // np.arange(len(labels), dtype=float)
  const barHeight = 0.6;
  const fig = newFigure();
  labels.forEach((_, i) => {
    addTrace(fig, 'bar', { y: [y[i]], x: [aged[i]], orientation: 'h', marker: { color: colors[i] },
      width: [barHeight], showlegend: false });
  });
  labels.forEach((_, i) => {
    addTrace(fig, 'scatter', { x: [bol[i], bol[i]], y: [y[i] - barHeight / 2, y[i] + barHeight / 2],
      mode: 'lines', line: { color: colors[i], dash: 'dash', width: 3 }, showlegend: false });
  });
  if (showLimitingLine) {
    const minHeight = arrayMin(aged);
    addTrace(fig, 'scatter', { x: [minHeight, minHeight], y: [y[0] - barHeight, y[2] + barHeight], mode: 'lines',
      line: { color: 'white', dash: 'dot', width: 2 }, showlegend: false });
  }
  updateLayout(fig, {
    width: 900,
    height: 420,
    plot_bgcolor: PALETTE.dark_gray,
    paper_bgcolor: PALETTE.navy_blue,
    font: { color: PALETTE.white, family: 'Open Sans', size: 24 },
    margin: { l: 40, r: 40, t: 40, b: 40 },
    xaxis: { rangemode: 'tozero', showline: true, linecolor: PALETTE.white, linewidth: 2, mirror: true,
      gridcolor: GRID_COLOR, griddash: 'dot', tickfont: { size: 24 } },
    yaxis: { tickmode: 'array', tickvals: y, ticktext: labels, autorange: 'reversed', showline: true,
      linecolor: PALETTE.white, linewidth: 2, mirror: true, tickfont: { size: 24 } },
    showlegend: false,
  });
  // scale = max(1.0, float(np.nanmax([bol.max(), aged.max()]))) - Python max() behaelt 1.0 bei NaN
  const candidates = [arrayMax(bol), arrayMax(aged)].filter((v) => !Number.isNaN(v));
  const nanmax = candidates.length ? Math.max(...candidates) : NaN;
  const scale = nanmax > 1.0 ? nanmax : 1.0;
  labels.forEach((_, i) => {
    const yb = bol[i];
    const ya = aged[i];
    addAnnotation(fig, { x: ya / 2, y: y[i], text: formatFixed(ya, 2), showarrow: false,
      font: { size: 16, color: 'white' }, xanchor: 'center', yanchor: 'middle' });
    addAnnotation(fig, { x: yb + 0.03 * scale, y: y[i], text: formatFixed(yb, 2), showarrow: false,
      font: { size: 16, color: 'white' }, xanchor: 'left', yanchor: 'middle' });
  });
  return fig;
}

export function capacitiesHeading(soh) {
  return `Capacities (relative to cathode). SoH: ${formatFixed(100 * soh, 2)}%`;
}

// Komplette Rechnung eines Reruns von aging_demo.run(); materials: {anode, cathode} (parseMaterial).
export function buildAging({ anodeName, cathodeName, anode, cathode, soc, lampe, lamne, lli }) {
  const settings = cellSettingsFor(anodeName, cathodeName);
  const cell = new CellOCVReconstruction({ cath: cathode, an: anode, ...settings });
  const plotter = new BatteryTankPlotter(cell, 600);

  const figTank = plotter.setupTankCanvas(500, 650);
  plotter.plotTanks(figTank, lampe, lamne);
  plotter.addReferenceVoltageLines(figTank);
  const dV = plotter.fillTanks(figTank, soc, lampe, lamne, lli);

  const figOcv = plotter.setupVoltageCanvas(500, 650);
  plotter.plotVoltageVsSoc(figOcv, lampe, lamne, lli);
  plotter.plotVoltagePoint(figOcv, soc, dV);

  const caps = computeCapsSimplified(cell, lampe, lamne, lli);
  const figCaps = plotCapsBolLineAgedFillHorizontal(caps, true);
  return { heading: capacitiesHeading(caps.soh), figCaps, figTank, figOcv, caps, dV };
}

export { BC };
