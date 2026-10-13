// Port von ocv_teaching/blend_ocv_reconstructor.py und der Figures aus apps/blending_tanks.py (master).
import { interp, linspace } from '../core/numpy.js';
import { interp1d } from '../core/scipy.js';
import { columnMax, columnMin } from './materials.js';
import { addTrace, concatenate, newFigure, reversed, updateLayout } from './figure.js';

const PALETTE = { dark_gray: '#333333', white: '#FFFFFF', navy_blue: '#003B73' };
const COL_ANODE = '#70AD47';
const COL_CATHODE = '#F39C12';
const COL_BLEND = '#CCCCCC';
const COL_FILL = '#5DADE2';
const GRID_COLOR = '#666666';

export class BlendOCVReconstructor {
  constructor(matA, matB, gamma, resolution = 400, direction = 'cha') {
    if (!(gamma >= 0.0 && gamma <= 1.0)) throw new Error('gamma must be in [0,1]');
    this.gamma = gamma;
    const ocv = `OCV_${direction}`;
    const dq = direction === 'charge' || direction === 'cha' ? 'dQ_dV_cha' : 'dQ_dV_dis';
    const a = matA.data;
    const b = matB.data;
    const vMax = Math.max(columnMax(a[ocv]), columnMax(b[ocv]));
    const vMin = Math.min(columnMin(a[ocv]), columnMin(b[ocv]));
    const v = linspace(vMax, vMin, resolution);
    const last = (col) => col[col.length - 1];
    const solA = interp1d(a[ocv], a.SoL, { fillValue: [last(a.SoL), a.SoL[0]] })(v);
    const solB = interp1d(b[ocv], b.SoL, { fillValue: [last(b.SoL), b.SoL[0]] })(v);
    const g = this.gamma;
    const solBlend = Float64Array.from(solA, (x, i) => g * x + (1.0 - g) * solB[i]);
    const dQdVA = interp1d(a.SoL, a[dq])(solA);
    const dQdVB = interp1d(b.SoL, b[dq])(solB);
    const dQdVBlend = Float64Array.from(dQdVA, (x, i) => g * x + (1.0 - g) * dQdVB[i]);
    // DataFrame(...).set_index("SoL_blend")
    this.index = solBlend;
    this.data = { V: v, SoL_a: solA, SoL_b: solB, dQ_dV_a: dQdVA, dQ_dV_b: dQdVB, dQ_dV_blend: dQdVBlend };
  }

  // data.apply(lambda col: np.interp(soc, data.index, col))
  evaluateSol(soc) {
    return Object.fromEntries(Object.entries(this.data).map(([k, col]) => [k, interp(soc, this.index, col)]));
  }
}

const scale = (values, factor) => Float64Array.from(values, (v) => v * factor);
const negScale = (values, factor) => Float64Array.from(values, (v) => -v * factor);

// def dark_layout(fig) aus blending_tanks.py
function darkLayout(fig) {
  updateLayout(fig, {
    template: 'plotly', plot_bgcolor: PALETTE.dark_gray, paper_bgcolor: PALETTE.navy_blue,
    margin: { l: 70, r: 30, t: 10, b: 70 }, font: { color: PALETTE.white },
    legend: { font: { size: 20 }, x: 0.02, y: 0.98, xanchor: 'left', yanchor: 'top', bgcolor: 'rgba(0,0,0,0)', borderwidth: 0 },
    showlegend: true,
  });
  const axis = { showgrid: true, gridcolor: GRID_COLOR, zeroline: false, linecolor: PALETTE.white, mirror: true,
    ticks: 'outside', tickfont: { size: 18 }, title: { font: { size: 24 } }, linewidth: 3 };
  updateLayout(fig, { xaxis: axis, yaxis: axis });
  return fig;
}

export function buildBlending({ matA, matB, sol, gamma }) {
  const blend = new BlendOCVReconstructor(matA, matB, gamma, 3000);
  const cur = blend.evaluateSol(sol);
  const d = blend.data;
  const index = blend.index;

  const figTanks1 = newFigure();
  updateLayout(figTanks1, { yaxis: { autorange: 'reversed' } });
  addTrace(figTanks1, 'scatter', { x: scale(d.dQ_dV_a, gamma), y: d.V, mode: 'lines',
    line: { color: COL_ANODE, width: 3 }, name: 'dQ/dV A' });
  addTrace(figTanks1, 'scatter', { x: negScale(d.dQ_dV_b, 1 - gamma), y: d.V, mode: 'lines',
    line: { color: COL_CATHODE, width: 3 }, name: 'dQ/dV B' });
  const mask = Array.from(d.V, (v) => v >= cur.V);
  if (mask.filter(Boolean).length >= 2) {
    const yFill = d.V.filter((_, i) => mask[i]);
    const xLeft = scale(d.dQ_dV_a, gamma).filter((_, i) => mask[i]);
    const xRight = negScale(d.dQ_dV_b, 1 - gamma).filter((_, i) => mask[i]);
    const zeros = new Float64Array(yFill.length);
    for (const x of [xLeft, xRight]) {
      addTrace(figTanks1, 'scatter', { x: concatenate(x, zeros), y: concatenate(yFill, reversed(yFill)),
        fill: 'toself', fillcolor: COL_FILL, line: { width: 0 }, showlegend: false });
    }
  }
  updateLayout(figTanks1, { xaxis: { title: { text: 'dQ/dV [Ah/V]' }, range: [-5, 5] } });
  updateLayout(figTanks1, { yaxis: { title: { text: 'Voltage [V]' }, range: [1, 0], tick0: 0, dtick: 0.5 } });
  darkLayout(figTanks1);
  updateLayout(figTanks1, { yaxis: { range: [1, 0], autorange: false } });
  updateLayout(figTanks1, { legend: { x: 0, y: 0, xanchor: 'left', yanchor: 'bottom' } });

  const figTanks2 = newFigure();
  updateLayout(figTanks2, { yaxis: { autorange: 'reversed' } });
  const pair = (values, color, width, name) => {
    addTrace(figTanks2, 'scatter', { x: values, y: d.V, mode: 'lines', line: { color, width }, name });
    addTrace(figTanks2, 'scatter', { x: Float64Array.from(values, (v) => -v), y: d.V, mode: 'lines',
      line: { color, width }, name, showlegend: false });
  };
  // A: +dQ_dV_a*gamma / -dQ_dV_a*gamma ; B analog ; Blend ohne Skalierung
  addTrace(figTanks2, 'scatter', { x: scale(d.dQ_dV_a, gamma), y: d.V, mode: 'lines',
    line: { color: COL_ANODE, width: 1 }, name: 'dQ/dV A' });
  addTrace(figTanks2, 'scatter', { x: negScale(d.dQ_dV_a, gamma), y: d.V, mode: 'lines',
    line: { color: COL_ANODE, width: 1 }, name: 'dQ/dV A', showlegend: false });
  addTrace(figTanks2, 'scatter', { x: scale(d.dQ_dV_b, 1 - gamma), y: d.V, mode: 'lines',
    line: { color: COL_CATHODE, width: 1 }, name: 'dQ/dV B' });
  addTrace(figTanks2, 'scatter', { x: negScale(d.dQ_dV_b, 1 - gamma), y: d.V, mode: 'lines',
    line: { color: COL_CATHODE, width: 1 }, name: 'dQ/dV B', showlegend: false });
  pair(d.dQ_dV_blend, COL_BLEND, 3, 'dQ/dV Blend');
  updateLayout(figTanks2, { xaxis: { title: { text: 'dQ/dV [Ah/V]' }, range: [-5, 5] } });
  updateLayout(figTanks2, { yaxis: { title: { text: 'Voltage [V]' }, range: [0, 1], tick0: 0, dtick: 0.5 } });
  darkLayout(figTanks2);
  updateLayout(figTanks2, { yaxis: { range: [1, 0], autorange: false } });
  updateLayout(figTanks2, { legend: { x: 0, y: 0, xanchor: 'left', yanchor: 'bottom' } });

  const figOcv = newFigure();
  addTrace(figOcv, 'scatter', { x: d.SoL_a, y: d.V, mode: 'lines', line: { color: COL_ANODE, width: 1 }, name: 'OCV A' });
  addTrace(figOcv, 'scatter', { x: d.SoL_b, y: d.V, mode: 'lines', line: { color: COL_CATHODE, width: 1 }, name: 'OCV B' });
  addTrace(figOcv, 'scatter', { x: index, y: d.V, mode: 'lines', line: { color: COL_BLEND, width: 3 }, name: 'OCV Blend' });
  addTrace(figOcv, 'scatter', { x: [cur.SoL_a], y: [cur.V], mode: 'markers', marker: { color: COL_ANODE, size: 8 },
    name: 'A @ V_blend(θ_blend)', showlegend: false });
  addTrace(figOcv, 'scatter', { x: [cur.SoL_b], y: [cur.V], mode: 'markers', marker: { color: COL_CATHODE, size: 8 },
    name: 'B @ V_blend(θ_blend)', showlegend: false });
  addTrace(figOcv, 'scatter', { x: [sol], y: [cur.V], mode: 'markers', marker: { color: COL_BLEND, size: 8 },
    name: 'Blend @ (θ_blend, V_blend)', showlegend: false });
  updateLayout(figOcv, { xaxis: { title: { text: 'State of Lithiation' }, range: [0, 1] } });
  updateLayout(figOcv, { yaxis: { title: { text: 'Voltage [V]' }, range: [0, 1] } });
  darkLayout(figOcv);

  const figSolmap = newFigure();
  addTrace(figSolmap, 'scatter', { x: index, y: d.SoL_a, mode: 'lines', line: { color: COL_ANODE, width: 3 }, name: 'SoL A' });
  addTrace(figSolmap, 'scatter', { x: index, y: d.SoL_b, mode: 'lines', line: { color: COL_CATHODE, width: 3 }, name: 'SoL B' });
  addTrace(figSolmap, 'scatter', { x: index, y: index, mode: 'lines', line: { color: COL_BLEND, width: 1, dash: 'dash' },
    name: 'SoL Blend (ref.)' });
  addTrace(figSolmap, 'scatter', { x: [sol], y: [cur.SoL_a], mode: 'markers', marker: { color: COL_ANODE, size: 8 },
    showlegend: false });
  addTrace(figSolmap, 'scatter', { x: [sol], y: [cur.SoL_b], mode: 'markers', marker: { color: COL_CATHODE, size: 8 },
    showlegend: false });
  updateLayout(figSolmap, { xaxis: { title: { text: 'Blend State of Lithiation' }, range: [0, 1] } });
  updateLayout(figSolmap, { yaxis: { title: { text: 'Material State of Lithiation' }, range: [0, 1] } });
  darkLayout(figSolmap);

  return { figTanks1, figTanks2, figOcv, figSolmap };
}
