// Port der Rechnung aus apps/material_tanks.py (ocv_teaching@master): beide Figures eines Reruns.
import { interp, nanmax, nanmin } from '../core/numpy.js';
import { addTrace, concatenate, negate, newFigure, reversed, updateLayout } from './figure.js';

const PALETTE = { dark_gray: '#333333', white: '#FFFFFF', navy_blue: '#003B73' };
const COL_ANODE = '#70AD47';
const COL_CATHODE = '#F39C12';
const COL_FILL = '#5DADE2';
const GRID_COLOR = '#666666';

function axis(extra) {
  return {
    showgrid: true, gridcolor: GRID_COLOR, gridwidth: 0.5, griddash: 'dot', showline: true, linecolor: PALETTE.white,
    linewidth: 3, mirror: true, tickfont: { size: 18 }, ...extra,
  };
}

const LEGEND = { x: 0, y: 0, xanchor: 'left', yanchor: 'bottom', font: { size: 20 }, bgcolor: 'rgba(0,0,0,0)' };

function setupTankCanvas(width = 500, height = 500) {
  return updateLayout(newFigure(), {
    width, height, plot_bgcolor: PALETTE.dark_gray, paper_bgcolor: PALETTE.navy_blue,
    font: { color: PALETTE.white, family: 'Open Sans', size: 24 }, margin: { l: 60, r: 60, t: 60, b: 60 },
    xaxis: axis({ title: { text: 'dQ/dV [Ah/V]', font: { size: 24 } }, zeroline: false }),
    yaxis: axis({ title: { text: 'Voltage [V]', font: { size: 24 } }, range: [-5, 0],
      tickvals: [-5, -4, -3, -2, -1, 0], ticktext: ['5', '4', '3', '2', '1', '0'] }),
    legend: { ...LEGEND },
  });
}

function setupVoltageCanvas(width = 500, height = 500) {
  return updateLayout(newFigure(), {
    width, height, plot_bgcolor: PALETTE.dark_gray, paper_bgcolor: PALETTE.navy_blue,
    font: { color: PALETTE.white, family: 'Open Sans', size: 24 }, margin: { l: 60, r: 60, t: 60, b: 60 },
    xaxis: axis({ title: { text: 'State of Lithiation', font: { size: 24 } }, range: [0, 1], zeroline: false }),
    yaxis: axis({ title: { text: 'Voltage [V]', font: { size: 24 } }, range: [2, 4.5], zeroline: false }),
    legend: { ...LEGEND },
  });
}

export function buildMaterialExplorer({ materialName, material, sol }) {
  const { data } = material;
  const dQdV = data.dQ_dV_cha;
  const solMat = data.SoL;
  const vMat = data.OCV_cha;
  // practical_mask = SoL_prac.between(0.0, 1.0) (inklusiv)
  const practical = Array.from(data.SoL_prac, (v) => v >= 0.0 && v <= 1.0);
  const any = practical.some(Boolean);
  const vAxis = any ? vMat.filter((_, i) => practical[i]) : vMat;
  const dQdVAxis = any ? dQdV.filter((_, i) => practical[i]) : dQdV;
  const color = material.kind.toLowerCase() === 'cathode' ? COL_CATHODE : COL_ANODE;

  const voltageMin = nanmin(vAxis);
  const voltageMax = nanmax(vAxis);
  const voltageSpan = Math.max(voltageMax - voltageMin, 0.5);
  const voltagePad = Math.max(0.05 * voltageSpan, 0.1);
  const low = Math.max(0.0, voltageMin - voltagePad);
  const high = voltageMax + voltagePad;
  const dqdvPeak = nanmax(Array.from(dQdVAxis, Math.abs));
  const xlim = Math.max(1.5, Math.ceil(dqdvPeak * 1.25));

  const figDqdv = setupTankCanvas();
  const figVoltage = setupVoltageCanvas();
  updateLayout(figDqdv, { xaxis: { range: [-xlim, xlim] }, yaxis: { range: [-high, -low] } });
  updateLayout(figVoltage, { yaxis: { range: [low, high] } });

  addTrace(figDqdv, 'scatter', { x: dQdV, y: negate(vMat), mode: 'lines', line: { color, width: 3 },
    name: `${materialName} dQ/dV`, showlegend: true });
  addTrace(figDqdv, 'scatter', { x: negate(dQdV), y: negate(vMat), mode: 'lines', line: { color, width: 3 },
    name: '-dQ/dV', showlegend: false });

  const vFill = interp(sol, solMat, vMat);
  const mask = Array.from(vMat, (v) => -v <= -vFill);
  const dQdVMasked = dQdV.filter((_, i) => mask[i]);
  const negVMasked = negate(vMat).filter((_, i) => mask[i]);
  addTrace(figDqdv, 'scatter', {
    x: concatenate(dQdVMasked, reversed(negate(dQdVMasked))),
    y: concatenate(negVMasked, reversed(negVMasked)),
    fill: 'toself', opacity: 0.25, line: { width: 0 }, fillcolor: COL_FILL, name: 'Lithium',
  });
  updateLayout(figDqdv, { legend: { x: 0, y: 0, xanchor: 'left', yanchor: 'bottom' } });

  addTrace(figVoltage, 'scatter', { x: solMat, y: vMat, mode: 'lines', line: { color, width: 3 },
    name: `${materialName} OCV`, showlegend: true });
  addTrace(figVoltage, 'scatter', { x: [sol], y: [vFill], mode: 'markers',
    marker: { color, size: 8, symbol: 'circle' }, showlegend: false });
  updateLayout(figVoltage, { legend: { x: 0, y: 0, xanchor: 'left', yanchor: 'bottom' } });
  return { figDqdv, figVoltage };
}
