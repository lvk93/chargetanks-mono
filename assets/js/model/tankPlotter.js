// Port von ocv_teaching/battery_tank_plotter.py (master, live). Baut dieselben Figures wie das Original.
import { formatFixed } from '../core/pyformat.js';
import { interp, linspace } from '../core/numpy.js';
import { pchip } from '../core/scipy.js';
import { interpolate } from './cellReconstruction.js';
import { columnMin } from './materials.js';
import { addAnnotation, addShape, addTrace, concatenate, negate, newFigure, reversed, updateLayout } from './figure.js';

export const BC = {
  dark_gray: '#333333',
  medium_gray: '#444444',
  light_gray: '#CCCCCC',
  white: '#FFFFFF',
  bright_blue: '#5DADE2',
  navy_blue: '#003B73',
  steel_blue: '#44546A',
  green: '#70AD47',
  orange: '#F39C12',
};

// ActiveMaterialReduced.ocv_pchip(direction): PchipInterpolator(SoL_prac, OCV_dir, extrapolate=False)
function ocvPchip(material, direction) {
  return pchip(material.data.SoL_prac, material.data[`OCV_${direction}`]);
}

function axisStyle(title, range, extra = {}) {
  return {
    title: { text: title, font: { size: 24 } },
    range,
    showgrid: true,
    gridcolor: '#666666',
    gridwidth: 0.5,
    griddash: 'dot',
    zeroline: false,
    showline: true,
    linecolor: BC.white,
    linewidth: 3,
    mirror: true,
    tickfont: { size: 18 },
    ...extra,
  };
}

export class BatteryTankPlotter {
  constructor(reconstructor, resolution = 500) {
    this.rec = reconstructor;
    this.resolution = resolution;
    this.grid = linspace(0, 1, resolution);
  }

  setupTankCanvas(width = 500, height = 500) {
    const fig = newFigure();
    const yaxis = axisStyle('Voltage [V]', [-5, 0], {
      tickvals: [-5, -4, -3, -2, -1, 0],
      ticktext: ['5', '4', '3', '2', '1', '0'],
    });
    delete yaxis.zeroline; // im Original fehlt zeroline an der y-Achse des Tank-Charts
    return updateLayout(fig, {
      width,
      height,
      plot_bgcolor: BC.dark_gray,
      paper_bgcolor: BC.navy_blue,
      font: { color: BC.white, family: 'Open Sans', size: 24 },
      margin: { l: 60, r: 60, t: 60, b: 60 },
      xaxis: axisStyle('dQ/dV [Ah/V]', [-5, 5]),
      yaxis,
      legend: { x: 0.5, y: 0.95, xanchor: 'center', yanchor: 'top', font: { size: 20 }, bgcolor: 'rgba(0,0,0,0)' },
    });
  }

  plotTanks(fig, lampe = 0.0, lamne = 0.0) {
    const { an, cath, npRatio } = this.rec;
    const dQdVAn = interp(this.grid, an.data.SoL, an.data.dQ_dV_cha);
    const dQdVCa = interp(this.grid, cath.data.SoL, cath.data.dQ_dV_cha);
    const vAn = interp(this.grid, an.data.SoL, an.data.OCV_cha);
    const vCath = interp(this.grid, cath.data.SoL, cath.data.OCV_cha);

    const addCurvePair = (x, y, color, name, dash = 'solid', showlegend = true) => {
      addTrace(fig, 'scatter', { x, y: negate(y), mode: 'lines', line: { color, dash },
        name: showlegend ? name : null, showlegend });
      // [-xi for xi in x]: Python-Liste (kein numpy-Array)
      addTrace(fig, 'scatter', { x: Array.from(x, (xi) => -xi), y: negate(y), mode: 'lines', line: { color, dash },
        showlegend: false });
    };
    const scale = (values, ...factors) => Float64Array.from(values, (v) => factors.reduce((acc, f) => acc * f, v));

    addCurvePair(scale(dQdVAn, npRatio), vAn, BC.green, 'Anode BOL', 'dash', false);
    addCurvePair(dQdVCa, vCath, BC.orange, 'Cathode BOL', 'dash', false);
    addCurvePair(scale(dQdVAn, npRatio, 1 - lamne), vAn, BC.green, 'Anode', 'solid');
    addCurvePair(scale(dQdVCa, 1 - lampe), vCath, BC.orange, 'Cathode', 'solid');

    updateLayout(fig, {
      legend: { font: { size: 20 }, x: 0.02, y: 0.5, xanchor: 'left', yanchor: 'middle', bgcolor: 'rgba(0,0,0,0)' },
    });
  }

  addReferenceVoltageLines(fig, lampe = 0.0, lamne = 0.0, lli = 0.0) {
    const [an0, ca0, an1, ca1] = this.rec.simulateAgingModes(lampe, lamne, lli);
    const vAn = ocvPchip(this.rec.an, 'cha')([an0, an1]);
    const vCath = ocvPchip(this.rec.cath, 'cha')([ca0, ca1]);
    for (const v of [...vAn, ...vCath]) {
      addShape(fig, { type: 'line', x0: -5, x1: 5, y0: -v, y1: -v,
        line: { color: BC.bright_blue, width: 1, dash: 'dot' } });
    }
  }

  // Liefert dV wie fill_tanks(); Annotationstexte mit Python-Formatierung (:.2f).
  fillTanks(fig, soc, lampe = 0.0, lamne = 0.0, lli = 0.0) {
    const { an, cath, npRatio } = this.rec;
    const [an0, ca0, an1, ca1] = this.rec.simulateAgingModes(lampe, lamne, lli);
    const solAnCur = an0 + (an1 - an0) * soc;
    const solCaCur = ca0 + (ca1 - ca0) * soc;
    const solAnVec = linspace(columnMin(an.data.SoL_prac), solAnCur, this.resolution);
    const solCaVec = linspace(columnMin(cath.data.SoL_prac), solCaCur, this.resolution);
    const pAn = ocvPchip(an, 'cha');
    const pCa = ocvPchip(cath, 'cha');
    const vAnCur = pAn(solAnVec);
    const vCaCur = pCa(solCaVec);
    const dQAnCur = interpolate(an.data.SoL_prac, an.data.dQ_dV_cha, solAnVec);
    const dQCathCur = interpolate(cath.data.SoL_prac, cath.data.dQ_dV_cha, solCaVec);
    const vAn0 = pAn(an0);
    const vCa0 = pCa(ca0);

    const leftAn = Float64Array.from(dQAnCur, (v) => -v * npRatio * (1 - lamne));
    const rightAn = Float64Array.from(dQAnCur, (v) => v * npRatio * (1 - lamne));
    const leftCa = Float64Array.from(dQCathCur, (v) => -v * (1 - lampe));
    const rightCa = Float64Array.from(dQCathCur, (v) => v * (1 - lampe));
    const yAn = negate(vAnCur);
    const yCa = negate(vCaCur);

    addTrace(fig, 'scatter', { x: concatenate(leftAn, reversed(rightAn)), y: concatenate(yAn, reversed(yAn)),
      fill: 'toself', fillcolor: BC.bright_blue, line: { width: 0 }, opacity: 0.5, name: 'Anode Fill', showlegend: false });
    addTrace(fig, 'scatter', { x: concatenate(leftCa, reversed(rightCa)), y: concatenate(yCa, reversed(yCa)),
      fill: 'toself', fillcolor: BC.bright_blue, line: { width: 0 }, opacity: 0.5, name: 'Cathode Fill', showlegend: false });

    const last = this.resolution - 1;
    const dV = vCaCur[last] - vAnCur[last];
    const y0 = -vAnCur[last];
    const y1 = -vCaCur[last];
    const arrow = { xref: 'x', yref: 'y', axref: 'x', ayref: 'y', showarrow: true, arrowhead: 3, arrowwidth: 3,
      arrowcolor: BC.white, standoff: 0 };
    addAnnotation(fig, { x: 0, y: y1, ax: 0, ay: y0, ...arrow });
    addAnnotation(fig, { x: 0, y: y0, ax: 0, ay: y1, ...arrow });
    addAnnotation(fig, { x: 0.1, y: 0.5 * (y0 + y1), text: `ΔV = ${formatFixed(dV, 2)} V`, showarrow: false,
      font: { color: BC.white, size: 20 }, xanchor: 'left' });
    addAnnotation(fig, { x: -4.3, y: -vAn0 + 0.2,
      text: `<b>Q<sub>an</sub> = ${formatFixed(solAnCur * npRatio * (1 - lamne), 2)} Ah</b>`, showarrow: false,
      font: { color: BC.bright_blue, size: 20 }, xanchor: 'left' });
    addAnnotation(fig, { x: -4.3, y: -vCa0 + 0.2,
      text: `<b>Q<sub>cath</sub> = ${formatFixed(solCaCur * (1 - lampe), 2)} Ah</b>`, showarrow: false,
      font: { color: BC.bright_blue, size: 20 }, xanchor: 'left' });
    return dV;
  }

  setupVoltageCanvas(width = 500, height = 500) {
    return updateLayout(newFigure(), {
      width,
      height,
      plot_bgcolor: BC.dark_gray,
      paper_bgcolor: BC.navy_blue,
      font: { color: BC.white, family: 'Open Sans', size: 24 },
      margin: { l: 60, r: 60, t: 60, b: 60 },
      xaxis: axisStyle('State of Charge', [0, 1]),
      yaxis: axisStyle('Voltage [V]', [2, 4.5]),
      legend: { x: 0.5, y: 0.95, xanchor: 'center', yanchor: 'top', font: { size: 20 }, bgcolor: 'rgba(0,0,0,0)' },
    });
  }

  plotVoltageVsSoc(fig, lampe = 0.0, lamne = 0.0, lli = 0.0) {
    const [an0b, ca0b, an1b, ca1b] = this.rec.getStoichiometries();
    const [an0a, ca0a, an1a, ca1a] = this.rec.simulateAgingModes(lampe, lamne, lli);
    const vBol = this.rec.reconstructVoltage(an0b, ca0b, an1b, ca1b, 'cha', this.grid).vCell;
    const vAged = this.rec.reconstructVoltage(an0a, ca0a, an1a, ca1a, 'cha', this.grid).vCell;
    addTrace(fig, 'scatter', { x: this.grid, y: vBol, mode: 'lines',
      line: { color: BC.bright_blue, dash: 'dash', width: 2 }, name: 'OCV BOL', showlegend: false });
    addTrace(fig, 'scatter', { x: this.grid, y: vAged, mode: 'lines',
      line: { color: BC.bright_blue, dash: 'solid', width: 2 }, name: 'Battery OCV', showlegend: true });
    updateLayout(fig, {
      legend: { font: { size: 20 }, x: 0.01, y: 0.99, xanchor: 'left', yanchor: 'top', bgcolor: 'rgba(0,0,0,0)' },
    });
  }

  plotVoltagePoint(fig, soc, dV) {
    addTrace(fig, 'scatter', { x: [soc], y: [dV], mode: 'markers',
      marker: { color: BC.white, size: 8, symbol: 'circle' }, showlegend: false });
  }
}
