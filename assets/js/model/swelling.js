// Port von ocv_teaching/SwellingModel.py und der Figures aus apps/swelling_demo.py (master).
// Potenzen wie numpy: x**2 auf Arrays = Quadrat (x*x), **0.5 auf Arrays = sqrt; Python-Skalar**2 = x*x.
import { formatFixed } from '../core/pyformat.js';
import { clip, interp, linspace } from '../core/numpy.js';
import { getIndexerNearest } from '../core/pandas.js';
import { CellOCVReconstruction } from './cellReconstruction.js';
import { addAnnotation, addShape, addTrace, newFigure, updateLayout } from './figure.js';

const BC = { dark_gray: '#333333', medium_gray: '#444444', light_gray: '#CCCCCC', white: '#FFFFFF',
  bright_blue: '#5DADE2', navy_blue: '#003B73', steel_blue: '#44546A', green: '#70AD47', yellow: '#F39C12' };
const GRID_COLOR = '#666666';

const map = (a, f) => Float64Array.from(a, f);
const minOf = (a) => Math.min(...a);

export class SwellingModel {
  constructor({ rec, an, cath, stack, poro, vSei = 39.56, socPoints = 200 }) {
    Object.assign(this, { rec, an, cath, stack, poro, vSei });
    this.socGrid = linspace(0.0, 1.0, socPoints);
    const { socAn, socCath } = rec.reconstructVoltage(...rec.getStoichiometries());
    const vCathSoc = interp(socCath, cath.data.SoL_prac, cath.data['Molar Volume cm3/mol']);
    const vAnSoc = interp(socAn, an.data.SoL_prac, an.data['Molar Volume cm3/mol']);
    let vCathRel = map(vCathSoc, (v) => v / vCathSoc[0]);
    let vAnRel = map(vAnSoc, (v) => v / vAnSoc[0]);
    if (vCathRel.length !== this.socGrid.length) {
      vCathRel = interp(this.socGrid, linspace(0, 1, vCathRel.length), vCathRel);
      vAnRel = interp(this.socGrid, linspace(0, 1, vAnRel.length), vAnRel);
    }
    this.vCathRel = vCathRel;
    this.vAnRel = vAnRel;
  }

  // Gibson-Ashby (m=2, sigma_s=200): porosity = 1 - ((compression/sigma_s) + (1-eps0)**m) ** (1/m)
  static compressionToPorosity(compression, eps0) {
    return 1 - Math.sqrt(compression / 200.0 + (1 - eps0) * (1 - eps0));
  }

  static porosityToCompression(porosity, eps0) {
    return 200.0 * ((1 - porosity) * (1 - porosity) - (1 - eps0) * (1 - eps0));
  }

  compute({ soh = 0.8, compression = 0.0, cylindrical = false }) {
    const s = this.stack;
    const p = this.poro;
    const ref = s.an_cur_thickness / 2 + s.an_thickness + s.sep_thickness + s.cath_thickness + s.cath_cur_thickness / 2;
    const dead = s.an_cur_thickness / 2 + s.sep_thickness * (1 - p.sep_porosity) + s.cath_cur_thickness / 2;
    const anPore = s.an_thickness * p.an_porosity;
    const cathPore = s.cath_thickness * p.cath_porosity;
    const sepPore = s.sep_thickness * p.sep_porosity;
    const pore = anPore + cathPore + sepPore;
    const anSolid = s.an_thickness * (1 - p.an_porosity);
    const cathSolid = s.cath_thickness * (1 - p.cath_porosity);
    const anMin = minOf(this.vAnRel);
    const cathMin = minOf(this.vCathRel);
    const anSolidSoc = map(this.vAnRel, (v) => anSolid * ((v - anMin) * soh + anMin));
    const cathSolidSoc = map(this.vCathRel, (v) => cathSolid * ((v - cathMin) * soh + cathMin));
    const sei = (1.0 - soh) * this.vSei;
    const n = this.socGrid.length;
    const total = map(anSolidSoc, (a, i) => dead + pore + a + cathSolidSoc[i] + sei);
    const yieldSolid = map(total, (t) => t - (s.an_cur_thickness / 2 + s.cath_cur_thickness / 2));
    const effective = map(yieldSolid, (y) => pore / Math.max(y, 1e-12));
    let applied;
    let compUsed;
    if (!cylindrical) {
      applied = map(effective, (e) => SwellingModel.compressionToPorosity(compression, e));
      compUsed = new Float64Array(n).fill(compression);
    } else {
      applied = map(total, (t, i) => clip((pore - (t - ref)) / Math.max(yieldSolid[i], 1e-12), 1e-8, 0.999));
      compUsed = map(applied, (a, i) => SwellingModel.porosityToCompression(a, effective[i]));
    }
    const scaling = map(applied, (a, i) => a / Math.max(effective[i], 1e-12));
    const anPoreComp = map(scaling, (x) => x * anPore);
    const cathPoreComp = map(scaling, (x) => x * cathPore);
    const sepPoreComp = map(scaling, (x) => x * sepPore);
    const full = (v) => new Float64Array(n).fill(v);
    const sepSolid = s.sep_thickness * (1 - p.sep_porosity);
    const div = (a) => map(a, (v) => v / ref);
    const layers = {
      an_cc: div(full(s.an_cur_thickness / 2)),
      an: div(map(anSolidSoc, (a, i) => a + sei + anPoreComp[i])),
      sep: div(map(sepPoreComp, (x) => sepSolid + x)),
      cath: div(map(cathSolidSoc, (c, i) => c + cathPoreComp[i])),
      cath_cc: div(full(s.cath_cur_thickness / 2)),
    };
    const classes = {
      dead: div(full(dead)),
      SEI: div(full(sei)),
      an_sol: div(anSolidSoc),
      cath_sol: div(cathSolidSoc),
      pore: div(map(anPoreComp, (a, i) => a + cathPoreComp[i] + sepPoreComp[i])),
    };
    return { layers, classes, index: this.socGrid,
      meta: { effective_porosity: effective, applied_porosity: applied, compression_used: compUsed } };
  }
}

// DataFrame.cumsum(axis=1): zeilenweise kumuliert in Spaltenreihenfolge
function cumsum(frame) {
  const out = {};
  let acc = null;
  for (const [key, col] of Object.entries(frame)) {
    acc = acc ? map(col, (v, i) => acc[i] + v) : Float64Array.from(col);
    out[key] = acc;
  }
  return out;
}

const row = (frame, pos) => Object.fromEntries(Object.entries(frame).map(([k, col]) => [k, col[pos]]));

function setupCanvas(width = 500, height = 500) {
  const axis = { showgrid: true, gridcolor: GRID_COLOR, gridwidth: 0.5, griddash: 'dot', showline: true,
    linecolor: BC.white, linewidth: 3, mirror: true, tickfont: { size: 18 } };
  return updateLayout(newFigure(), {
    width, height, plot_bgcolor: BC.dark_gray, paper_bgcolor: BC.navy_blue,
    font: { color: BC.white, family: 'Open Sans', size: 24 }, margin: { l: 60, r: 60, t: 60, b: 60 },
    xaxis: { ...axis, zeroline: false }, yaxis: { ...axis },
    legend: { x: 0, y: 0, xanchor: 'left', yanchor: 'bottom', font: { size: 20 }, bgcolor: BC.white },
  });
}

export function createSwellingModel(anode, cathode) {
  const rec = new CellOCVReconstruction({ cath: cathode, an: anode, npRatio: 1.1, lipRatio: 0.95, vMin: 2.8, vMax: 4.2 });
  return new SwellingModel({
    rec, an: anode, cath: cathode,
    stack: { an_cur_thickness: 18, an_thickness: 7, sep_thickness: 20, cath_thickness: 47, cath_cur_thickness: 15 },
    poro: { sep_porosity: 0.4, an_porosity: 0.3, cath_porosity: 0.25 },
  });
}

export function buildSwelling({ model, soc, soh, compression, cylindrical }) {
  const { layers, classes, index, meta } = model.compute({ soh, compression, cylindrical });
  const classesCum = cumsum(classes);
  const pos = getIndexerNearest(index, soc);
  const classesCumSoc = row(classesCum, pos);
  const layersSoc = row(layers, pos);

  // Electrode Stack Geometry
  const figLayers = setupCanvas();
  const specs = [['an_cc', 'Anode CC', BC.light_gray], ['an', 'Anode', BC.green], ['sep', 'Separator', BC.bright_blue],
    ['cath', 'Cathode', BC.yellow], ['cath_cc', 'Cathode CC', BC.light_gray]];
  let y0 = 0.0;
  for (const [name, label, color] of specs) {
    const h = layersSoc[name];
    const y1 = y0 + h;
    addShape(figLayers, { type: 'rect', x0: 0, x1: 1, y0, y1, line: { width: 1, color: BC.dark_gray }, fillcolor: color,
      layer: 'below' });
    addAnnotation(figLayers, { x: 0.5, y: (y0 + y1) / 2, text: `${label} — ${formatFixed(h, 3)} `, showarrow: false,
      font: { size: 24, color: BC.dark_gray }, xanchor: 'center', yanchor: 'middle' });
    y0 = y1;
  }
  const totalN = y0;
  updateLayout(figLayers, {
    xaxis: { title: { text: '', font: { size: 24 }, standoff: 22 }, ticklabelstandoff: 8, ticktext: [' 0', ' 1'],
      ticks: 'outside', tickvals: [0, 1], showgrid: false, tickfont: { color: BC.navy_blue, size: 16 } },
    yaxis: { title: { text: 'Normalized thickness', font: { size: 24 } }, showgrid: false },
    margin: { l: 70, r: 30, t: 10, b: 70 },
    showlegend: false,
  });
  figLayers.layout.annotations = [...figLayers.layout.annotations,
    { x: 0.5, y: Math.min(1.18, totalN + 0.05), text: `Total: ${formatFixed(totalN, 3)}`, showarrow: false,
      font: { size: 24, color: BC.white } }];
  updateLayout(figLayers, { yaxis: { range: [0, 1.2] }, xaxis: { range: [0, 1] } });

  // Stack by categories
  const figClasses = setupCanvas();
  const area = (key, name, color) => {
    addTrace(figClasses, 'scatter', { x: index, y: classesCum[key], mode: 'lines', line: { width: 1.5, color: BC.white },
      fill: figClasses.data.length > 0 ? 'tonexty' : 'tozeroy', fillcolor: color, name, showlegend: false,
      hovertemplate: '%{customdata[0]:.4f}<extra></extra>', customdata: Array.from(classes[key], (v) => [v]) });
  };
  area('dead', 'Dead volume (CCs + Sep)', BC.light_gray);
  area('SEI', 'SEI', BC.steel_blue);
  area('an_sol', 'Anode Particles', BC.green);
  area('cath_sol', 'Cathode Particles', BC.yellow);
  area('pore', 'Pore volume (An+Sep+Cath)', BC.bright_blue);
  addTrace(figClasses, 'scatter', { x: [soc], y: [classesCumSoc.pore], mode: 'markers',
    marker: { size: 10, color: BC.white, line: { color: BC.medium_gray, width: 1.5 } }, name: '', showlegend: false,
    hovertemplate: 'SoC: %{x:.3f}<br>Total: %{y:.4f}<extra></extra>' });
  updateLayout(figClasses, {
    xaxis: { title: { text: 'SoC', font: { size: 24 }, standoff: 22 }, ticklabelstandoff: 8 },
    yaxis: { title: { text: 'Normalized thickness', font: { size: 24 } } },
    hovermode: 'x unified', margin: { l: 70, r: 30, t: 10, b: 70 }, showlegend: false,
  });
  updateLayout(figClasses, { yaxis: { range: [0, 1.2] }, xaxis: { range: [0, 1] } });
  const posMid = getIndexerNearest(index, 0.5);
  const cumMid = row(classesCum, posMid);
  const mid = row(classes, posMid);
  figClasses.layout.annotations = [];
  for (const [text, y, color] of [
    ['Dead volume (CCs + Sep)', cumMid.dead * 0.5, BC.medium_gray],
    ['SEI', cumMid.dead + mid.SEI * 0.5, BC.white],
    ['Anode Particles', cumMid.SEI + mid.an_sol * 0.5, BC.dark_gray],
    ['Cathode Particles', cumMid.an_sol + mid.cath_sol * 0.5, BC.dark_gray],
    ['Pore volume (An + Sep + Cath)', cumMid.cath_sol + mid.pore * 0.5, BC.dark_gray],
  ]) {
    addAnnotation(figClasses, { x: 0.5, y, text, showarrow: false, font: { size: 24, color }, xanchor: 'center',
      yanchor: 'middle' });
  }

  // Compression vs. porosity (im Original 5x in der Schleife gebaut, B5 - Ergebnis identisch)
  const figCompression = setupCanvas();
  const compGrid = linspace(0, 60, 201);
  const eps0 = interp(soc, index, meta.effective_porosity);
  const porCurve = map(compGrid, (c) => SwellingModel.compressionToPorosity(c, eps0));
  const compUsed = interp(soc, index, meta.compression_used);
  const porApplied = interp(soc, index, meta.applied_porosity);
  addTrace(figCompression, 'scatter', { x: porCurve, y: compGrid, mode: 'lines', line: { width: 3, color: BC.bright_blue },
    name: 'Porosity(compression)' });
  addTrace(figCompression, 'scatter', { x: [porApplied], y: [compUsed], mode: 'markers',
    marker: { size: 11, color: BC.white, line: { color: BC.medium_gray, width: 1.5 } }, name: 'Applied',
    hovertemplate: 'Porosity: %{x:.4f}<br>Compression: %{y:.2f} MPa<extra></extra>' });
  updateLayout(figCompression, {
    xaxis: { title: { text: 'Porosity [-]', font: { size: 24 } } },
    yaxis: { title: { text: 'Compression [MPa]', font: { size: 24 } } },
    hovermode: 'closest', margin: { l: 70, r: 40, t: 10, b: 60 }, showlegend: false,
  });
  updateLayout(figCompression, { yaxis: { range: [0, 60], zeroline: false, showgrid: true } });
  updateLayout(figCompression, { xaxis: { range: [0, Math.max(0.3, eps0 * 1.15)], zeroline: false, showgrid: true } });
  return { figLayers, figClasses, figCompression };
}
