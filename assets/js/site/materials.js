// Kapitel "Materials" (/blog/materials/): Kurve + Tank je Material, das Regal (Navigation und Einordnung),
// LFP mit Ueberlaufwehr, Partikeln und S-Kurve. Reiter und Quiz kommen aus chapter.js (generisch).
// Daten: assets/data/chapter-materials.json (scripts/build-chapter-materials.mjs). Gezeichnet als SVG.
import { initControls } from '../ui/controls.js';
import { track } from './track.js';
import { C, chart as kitChart, el, fmt, HALO, niceTicks, svgRoot } from './chartKit.js';

// Materials-Diagramme: 5 Achsenmarken in x, Linien an Polen trennen
const chart = (container, opts) => kitChart(container, { height: 260, xTicks: 5, breakPoles: true, ...opts });

// Reihenfolge der Reiter und des Regals (links Anoden, rechts Kathoden)
export const ORDER = ['lithium', 'graphite', 'silicon', 'lto', 'lfp', 'lmfp', 'nmc', 'lco'];
// Tab-IDs der Seite je Material
const TAB = { lithium: 'lithium-metal', graphite: 'graphite', silicon: 'silicon', lto: 'lto', lfp: 'lfp', lmfp: 'lmfp', nmc: 'nmc', lco: 'lco' };

function interp(xs, ys, x) {
  if (x <= xs[0]) return ys[0];
  for (let i = 1; i < xs.length; i += 1) {
    if (xs[i] >= x) return ys[i - 1] + ((x - xs[i - 1]) / (xs[i] - xs[i - 1] || 1)) * (ys[i] - ys[i - 1]);
  }
  return ys[ys.length - 1];
}

let dataPromise = null;
export function loadData() {
  dataPromise ||= fetch('/assets/data/chapter-materials.json').then((r) => r.json());
  return dataPromise;
}

/* Diagramm (Spannung nach oben, datenblattkonform) ------------------------------------------- */
/* Tank (haengt von der Decke, Tiefe = Spannung) ------------------------------------------------ */
// Breite ~ dQ/dU aus der Kurve (x faellt mit u), ueber ein kleines Spannungsfenster geglaettet, gedeckelt.
function profile(xs, us, q, uTop, uBot, n = 180, smooth = 0) {
  const pts = [];
  const h = Math.max(0.004, smooth, (uBot - uTop) / 120);
  for (let i = 0; i <= n; i += 1) {
    const u = uTop + ((uBot - uTop) * i) / n;
    // Fuellgrad bei u (us faellt mit x): Anteil der Stuetzstellen unterhalb von u -> x(u)
    const xAt = (uu) => {
      if (uu >= us[0]) return xs[0];
      for (let j = 1; j < us.length; j += 1) if (us[j] <= uu) return xs[j - 1] + ((us[j - 1] - uu) / (us[j - 1] - us[j] || 1)) * (xs[j] - xs[j - 1]);
      return xs[xs.length - 1];
    };
    pts.push({ u, w: (q * Math.abs(xAt(u - h) - xAt(u + h))) / (2 * h) });
  }
  return pts; // u steigt (von der Decke nach unten)
}

function drawTank(container, { variants, fill, color, uTop, uBot, ceiling, label }) {
  const W = 360;
  const top = 30;
  const Hpx = 250;
  const H = top + Hpx + 34;
  const pxPerV = Hpx / (uBot - uTop);
  const y = (u) => top + (u - uTop) * pxPerV;
  const svg = svgRoot(container, W, H, label);
  if (ceiling) {
    svg.append(el('rect', { x: 8, y: top - 8, width: W - 16, height: 8, fill: C.metal, opacity: 0.5 }));
    svg.append(el('text', { x: W / 2, y: top - 12, fill: C.muted, 'font-size': 11, 'text-anchor': 'middle' }, 'ceiling = Li/Li⁺ (0 V)'));
  } else {
    svg.append(el('text', { x: W / 2, y: top - 12, fill: C.muted, 'font-size': 11, 'text-anchor': 'middle' }, `ceiling = Li/Li⁺ (0 V) is ${fmt(uTop, 1)} V above this view`));
  }
  for (const t of niceTicks(uTop, uBot, 5)) {
    svg.append(el('line', { x1: 40, x2: W - 8, y1: y(t), y2: y(t), stroke: C.grid }));
    svg.append(el('text', { x: 34, y: y(t), fill: C.muted, 'font-size': 10, 'text-anchor': 'end', 'dominant-baseline': 'middle' }, `${t} V`));
  }
  const cap = 230;
  const cx = 200;
  const shapes = variants.map((v) => profile(v.x, v.u, v.q, uTop, uBot));
  // Breiten aller Umrisse mit demselben Massstab: der Median wird ca. 70 px breit, Plateaus gedeckelt
  const ws = shapes[0].map((p) => p.w).filter((w) => w > 1e-6).sort((a, b) => a - b);
  const scale = 70 / (ws[Math.floor(ws.length / 2)] || 1);
  const W_ = (p) => Math.min(cap, Math.max(1.5, p.w * scale));
  variants.forEach((v, i) => {
    const pts = shapes[i].filter((p) => p.u <= v.u[0] + 1e-9 && p.u >= v.u[v.u.length - 1] - 1e-9);
    if (!pts.length) return;
    if (v.wet) {
      const uS = interp(v.x, v.u, fill);
      const wet = pts.filter((p) => p.u >= uS);
      if (wet.length) {
        const d = [`M${cx + W_(wet[0]) / 2} ${y(uS)}`, ...wet.map((p) => `L${(cx + W_(p) / 2).toFixed(1)} ${y(p.u).toFixed(1)}`),
          ...[...wet].reverse().map((p) => `L${(cx - W_(p) / 2).toFixed(1)} ${y(p.u).toFixed(1)}`), 'Z'];
        svg.append(el('path', { d: d.join(''), fill: C.water, opacity: 0.85 }));
      }
      svg.append(el('line', { x1: 40, x2: W - 8, y1: y(uS), y2: y(uS), stroke: C.muted, 'stroke-dasharray': '3 3' }));
      svg.append(el('text', { x: 44, y: y(uS) - 5, fill: C.cell, 'font-size': 12, 'font-weight': 700, ...HALO }, `${fmt(uS)} V`));
    }
    const wall = [...[...pts].reverse().map((p, j) => `${j ? 'L' : 'M'}${(cx - W_(p) / 2).toFixed(1)} ${y(p.u).toFixed(1)}`),
      ...pts.map((p) => `L${(cx + W_(p) / 2).toFixed(1)} ${y(p.u).toFixed(1)}`)];
    svg.append(el('path', { d: wall.join(''), fill: 'none', stroke: v.color ?? color, 'stroke-width': 2.5, 'stroke-linejoin': 'round', 'stroke-dasharray': v.dash }));
  });
  svg.append(el('text', { x: cx, y: H - 8, fill: color, 'font-size': 12, 'font-weight': 600, 'text-anchor': 'middle' }, `${label.split(':')[0]} ${Math.round(fill * 100)} %`));
}

/* Kurve + Tank je Material ---------------------------------------------------------------------- */
const RANGES = { graphite: [0, 0.7], silicon: [0, 1.0], lto: [1.0, 2.1], lfp: [2.9, 4.4], lmfp: [2.8, 4.5], nmc: [2.9, 4.4], lco: [3.3, 4.45] };

function renderMaterial(root, data, slug, values) {
  const m = data[slug];
  const vi = Math.min(m.variants.length - 1, Number(values.variant ?? m.defaultVariant ?? 0));
  const v = m.variants[vi];
  const fill = Math.min(0.999, Math.max(0, values.fill));
  const dir = values.dir === 'out' ? 'uOut' : 'uIn';
  const color = m.kind === 'anode' ? C.anode : C.cathode;
  const [uTop, uBot] = RANGES[slug];
  // NMC/NCA: gemeinsame Achse "Lithium im Material", damit man sieht, wie weit jede Stufe den gleichen Tank leert
  const abs = slug === 'nmc';
  const x0 = abs ? m.qTheo - v.q : 0;
  const xMax = abs ? m.qTheo : Math.ceil(v.q / 50) * 50;
  const curvePts = (u) => v.x.map((x, i) => [x0 + x * v.q, u[i]]);
  const parts = { curve: root.querySelector('[data-curve]'), tank: root.querySelector('[data-tank]') };
  const hyst = slug === 'silicon' || slug === 'lfp';
  chart(parts.curve, {
    label: `${m.name}: potential against Li/Li+ over the lithium in the material`,
    xMin: 0, xMax, yMin: uTop, yMax: uBot, xTitle: 'lithium in the material [mAh/g]', yTitle: 'potential vs Li/Li⁺ [V]',
    draw(p) {
      if (abs) p.hline(4.3, 'upper limit 4.3 V', C.warn);
      if (hyst) {
        p.line(curvePts(v.uIn), { stroke: color, opacity: dir === 'uIn' ? 1 : 0.4 });
        p.line(curvePts(v.uOut), { stroke: C.alt, opacity: dir === 'uOut' ? 1 : 0.4 });
      } else p.line(curvePts(v.uIn), { stroke: color });
      p.dot(x0 + fill * v.q, interp(v.x, v[dir], fill), C.water);
    },
  });
  const outlines = hyst
    ? [{ x: v.x, u: v.uIn, q: v.q, color, wet: dir === 'uIn' }, { x: v.x, u: v.uOut, q: v.q, color: C.alt, dash: '5 4', wet: dir === 'uOut' }]
    : [{ x: v.x, u: v.uIn, q: v.q, wet: true }];
  drawTank(parts.tank, { variants: outlines, fill, color, uTop, uBot, ceiling: uTop === 0, label: `${m.name}: tank, width = dQ/dU` });
  const readout = (key, text) => { const n = root.querySelector(`[data-readout="${key}"]`); if (n) n.textContent = text; };
  readout('voltage', `${fmt(interp(v.x, v[dir], fill), 3)} V`);
  readout('lithium', `${Math.round(fill * v.q)} of ${v.q} mAh/g`);
  if (abs) readout('reach', `${v.q} of ${m.qTheo} mAh/g`);
}

function initMaterialTool(root, data) {
  const slug = root.dataset.matTool;
  const form = root.querySelector('form');
  let used = false;
  let frame = 0;
  const render = () => { frame = 0; renderMaterial(root, data, slug, controls.values()); };
  const controls = initControls(form, (event) => {
    if (!used && event?.isTrusted) { used = true; track('tool_used', { tool: `materials-${slug}` }); }
    if (!frame) frame = requestAnimationFrame(render);
  });
  controls.refresh();
  render();
}

/* Regal: alle Materialien auf einer Spannungsachse, Flaeche ~ mAh/g ------------------------------ */
const SHORT = { lithium: 'Li', graphite: 'Gr', silicon: 'Si', lto: 'LTO', lfp: 'LFP', lmfp: 'LMFP', nmc: 'NMC', lco: 'LCO' };

export function drawShelf(container, data, current, nav) {
  const W = 360;
  const top = 26;
  const pxPerV = 58;
  const uMax = 4.5;
  const H = top + uMax * pxPerV + 40;
  const y = (u) => top + u * pxPerV;
  const svg = svgRoot(container, W, H, 'All materials on one voltage axis: anodes left, cathodes right, tank shapes normalised to the same width');
  svg.append(el('rect', { x: 30, y: top - 6, width: W - 34, height: 6, fill: C.metal, opacity: 0.5 }));
  svg.append(el('text', { x: 34, y: top - 10, fill: C.muted, 'font-size': 10 }, 'ceiling = Li/Li⁺'));
  for (let t = 0; t <= 4; t += 1) {
    svg.append(el('line', { x1: 30, x2: W - 4, y1: y(t), y2: y(t), stroke: C.grid }));
    svg.append(el('text', { x: 26, y: y(t), fill: C.muted, 'font-size': 10, 'text-anchor': 'end', 'dominant-baseline': 'middle' }, `${t} V`));
  }
  svg.append(el('line', { x1: 195, x2: 195, y1: top, y2: H - 30, stroke: C.grid, 'stroke-dasharray': '2 3' }));
  svg.append(el('text', { x: 112, y: H - 4, fill: C.anode, 'font-size': 10, 'text-anchor': 'middle' }, 'anodes'));
  svg.append(el('text', { x: 278, y: H - 4, fill: C.cathode, 'font-size': 10, 'text-anchor': 'middle' }, 'cathodes'));
  // Form statt Massstab: jeder Tank wird auf die gleiche mittlere Breite normiert (die Kapazitaet steht darunter und im Balkendiagramm)
  const slotW = 40;
  ORDER.forEach((slug, i) => {
    const m = data[slug];
    const cx = i < 4 ? 50 + i * 41 : 216 + (i - 4) * 41;
    const color = m.kind === 'anode' ? C.anode : C.cathode;
    const g = el('g', { class: 'shelf-item', opacity: !current || current === slug ? 1 : 0.4, 'data-slug': slug });
    if (nav) { g.setAttribute('role', 'link'); g.setAttribute('tabindex', '0'); g.setAttribute('aria-label', `${m.name}: open part`); g.style.cursor = 'pointer'; }
    if (slug === 'lithium') {
      g.append(el('rect', { x: cx - slotW / 2, y: top - 2, width: slotW, height: 6, fill: C.cell }));
    } else {
      const v = m.variants[m.defaultVariant ?? 0];
      // Nur das genutzte Fenster: erste und letzte Prozente der Fuellung abschneiden (steile Enden = lange duenne Schwaenze)
      const at = (x) => v.uIn[Math.round(x * (v.uIn.length - 1))];
      const lo = at(0.95);
      const hi = at(0.04);
      const pts = profile(v.x, v.uIn, v.q, Math.max(0, lo), hi, 140, 0.05);
      const sorted = pts.map((p) => p.w).sort((a, b) => a - b);
      const k = 22 / Math.max(1e-6, sorted[Math.floor(sorted.length / 2)]);
      const w = (p) => Math.min(slotW, Math.max(3, p.w * k));
      const d = [...pts.map((p, j) => `${j ? 'L' : 'M'}${(cx - w(p) / 2).toFixed(1)} ${y(p.u).toFixed(1)}`),
        ...[...pts].reverse().map((p) => `L${(cx + w(p) / 2).toFixed(1)} ${y(p.u).toFixed(1)}`), 'Z'];
      g.append(el('path', { d: d.join(''), fill: color, 'fill-opacity': 0.35, stroke: color, 'stroke-width': 1.5 }));
    }
    g.append(el('text', { x: cx, y: H - 30 + 2, fill: color, 'font-size': 10, 'font-weight': 700, 'text-anchor': 'middle' }, SHORT[slug]));
    g.append(el('text', { x: cx, y: H - 18, fill: C.muted, 'font-size': 9, 'text-anchor': 'middle' }, m.q));
    if (current === slug) g.append(el('rect', { x: cx - slotW / 2 - 1, y: top + 2, width: slotW + 2, height: H - top - 34, fill: 'none', stroke: C.water, 'stroke-width': 1, rx: 4 }));
    svg.append(g);
  });
  svg.append(el('text', { x: 4, y: H - 18, fill: C.muted, 'font-size': 9 }, 'mAh/g'));
  if (nav) bindNav(svg, 'shelf');
}

function bindNav(svg, name) {
  const go = (slug) => {
    document.querySelector(`[data-chapter-tabs] a[href="#${TAB[slug]}"]`)?.click();
    track('tool_used', { tool: `materials-${name}:${slug}` });
  };
  svg.addEventListener('click', (e) => { const g = e.target.closest('.shelf-item'); if (g) go(g.dataset.slug); });
  svg.addEventListener('keydown', (e) => { const g = e.target.closest('.shelf-item'); if (g && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); go(g.dataset.slug); } });
}

// Balken: Kapazitaet je Material (linear, Lithium und Silizium sprengen den Massstab - das ist die Aussage)
export function drawCapacity(container, data, current, nav) {
  const W = 360;
  const rowH = 24;
  const top = 8;
  const left = 56;
  const H = top + ORDER.length * rowH + 34;
  const xMax = 4000;
  const x = (v) => left + (v / xMax) * (W - left - 44);
  const svg = svgRoot(container, W, H, 'Capacity per gram of all eight materials as horizontal bars');
  for (const t of [0, 1000, 2000, 3000, 4000]) {
    svg.append(el('line', { x1: x(t), x2: x(t), y1: top, y2: H - 30, stroke: C.grid }));
    svg.append(el('text', { x: x(t), y: H - 16, fill: C.muted, 'font-size': 10, 'text-anchor': 'middle' }, t));
  }
  svg.append(el('text', { x: (left + W - 44) / 2 + 10, y: H - 3, fill: C.text, 'font-size': 10.5, 'text-anchor': 'middle' }, 'capacity [mAh/g]'));
  ORDER.forEach((slug, i) => {
    const m = data[slug];
    const color = m.kind === 'anode' ? C.anode : C.cathode;
    const y = top + i * rowH;
    const g = el('g', { class: 'shelf-item', opacity: !current || current === slug ? 1 : 0.4, 'data-slug': slug });
    if (nav) { g.setAttribute('role', 'link'); g.setAttribute('tabindex', '0'); g.setAttribute('aria-label', `${m.name}: open part`); g.style.cursor = 'pointer'; }
    g.append(el('rect', { x: 0, y, width: W, height: rowH, fill: 'transparent' }));
    g.append(el('text', { x: left - 8, y: y + rowH / 2, fill: color, 'font-size': 11, 'font-weight': 700, 'text-anchor': 'end', 'dominant-baseline': 'middle' }, SHORT[slug]));
    g.append(el('rect', { x: left, y: y + 5, width: Math.max(2, x(m.q) - left), height: rowH - 10, fill: color, 'fill-opacity': 0.55, stroke: color, rx: 2 }));
    g.append(el('text', { x: x(m.q) + 5, y: y + rowH / 2, fill: C.text, 'font-size': 10.5, 'dominant-baseline': 'middle' }, m.q));
    svg.append(g);
  });
  if (nav) bindNav(svg, 'capacity');
}

/* LFP: Ueberlaufwehr, Partikel, S-Kurve ---------------------------------------------------------- */
// Wehr: zwei schmale Tanks (FePO4 tief, LiFePO4 oben) und dazwischen ein Becken auf einer Hoehe
function drawWeir(container, fill) {
  const W = 360;
  const H = 280;
  const svg = svgRoot(container, W, H, 'LFP as a tank with an overflow weir between two narrow tanks');
  const cx = 110;
  const yTopTank = [40, 110];   // oberer schmaler Tank (LiFePO4, nah an der Decke)
  const yPlateau = 150;
  const yBotTank = [150, 250];  // unterer schmaler Tank (FePO4, tief)
  const wN = 34;
  const basin = { x0: cx + wN / 2, x1: 330, y: yPlateau, depth: 26 };
  // Anteile am Lithium: unten 8 %, Becken 84 %, oben 8 %
  const fBot = 0.08;
  const fTop = 0.92;
  const water = (x, y0, w, h) => svg.append(el('rect', { x, y: y0, width: w, height: Math.max(0, h), fill: C.water, opacity: 0.85 }));
  const lo = Math.min(1, fill / fBot);
  water(cx - wN / 2, yBotTank[1] - lo * (yBotTank[1] - yBotTank[0]), wN, lo * (yBotTank[1] - yBotTank[0]));
  if (fill > fBot) {
    const b = Math.min(1, (fill - fBot) / (fTop - fBot));
    water(basin.x0, basin.y - basin.depth * 0 , (basin.x1 - basin.x0) * b, basin.depth);
  }
  if (fill > fTop) {
    const t = (fill - fTop) / (1 - fTop);
    water(cx - wN / 2, yTopTank[1] - t * (yTopTank[1] - yTopTank[0]), wN, t * (yTopTank[1] - yTopTank[0]));
  }
  const stroke = { stroke: C.cathode, 'stroke-width': 2.5, fill: 'none', 'stroke-linejoin': 'round' };
  svg.append(el('path', { d: `M${cx - wN / 2} ${yTopTank[0]}V${yBotTank[1]}H${cx + wN / 2}V${yPlateau + basin.depth}H${basin.x1}V${yPlateau - 6}`, ...stroke }));
  svg.append(el('path', { d: `M${cx + wN / 2} ${yTopTank[0]}V${yPlateau - 4}`, ...stroke }));
  // Wehrkante mit kleiner Schwelle
  svg.append(el('path', { d: `M${cx + wN / 2 - 2} ${yPlateau - 4}h8`, stroke: C.warn, 'stroke-width': 3 }));
  svg.append(el('text', { x: cx + wN / 2 + 10, y: yPlateau - 10, fill: C.warn, 'font-size': 10 }, 'weir, with a small step'));
  svg.append(el('text', { x: cx - wN / 2 - 8, y: (yTopTank[0] + yTopTank[1]) / 2, fill: C.muted, 'font-size': 10, 'text-anchor': 'end' }, 'LiFePO₄ (full)'));
  svg.append(el('text', { x: cx - wN / 2 - 8, y: (yBotTank[0] + yBotTank[1]) / 2 + 20, fill: C.muted, 'font-size': 10, 'text-anchor': 'end' }, 'FePO₄ (empty)'));
  svg.append(el('text', { x: (basin.x0 + basin.x1) / 2, y: yPlateau + basin.depth + 16, fill: C.muted, 'font-size': 10, 'text-anchor': 'middle' }, 'both phases side by side: one height'));
  svg.append(el('text', { x: 12, y: 20, fill: C.cell, 'font-size': 12, 'font-weight': 700 }, `${Math.round(fill * 100)} % full`));
}

// Partikel: jedes kippt fuer sich (leer oder voll), nur eines ist gerade im Uebergang
function drawParticles(container, fill) {
  const n = 8;
  const W = 360;
  const H = 110;
  const svg = svgRoot(container, W, H, 'Eight LFP particles: each one is either empty or full, they flip one after another');
  const inner = Math.min(1, Math.max(0, (fill - 0.08) / 0.84));
  const done = Math.floor(inner * n);
  const part = inner * n - done;
  for (let i = 0; i < n; i += 1) {
    const x = 14 + i * 42;
    const f = i < done ? 1 : i === done ? part : 0;
    svg.append(el('rect', { x, y: 70 - 50 * f, width: 32, height: 50 * f, fill: C.water, opacity: 0.85 }));
    svg.append(el('rect', { x, y: 20, width: 32, height: 50, fill: 'none', stroke: C.cathode, 'stroke-width': 2, rx: 3 }));
  }
  svg.append(el('text', { x: W / 2, y: 98, fill: C.muted, 'font-size': 11, 'text-anchor': 'middle' }, `${Math.min(done, n)} of ${n} particles full, the voltage stays on the plateau`));
}

// Regular-Solution-Modell: U = U0 - (RT/F) ln(x/(1-x)) - (Omega/F)(1 - 2x), Omega > 2RT gibt die S-Kurve
export function regularSolution(omegaRT = 4.5, U0 = 3.42) {
  const kT = 0.025693;
  const xs = Array.from({ length: 401 }, (_, i) => 0.002 + (i * 0.996) / 400);
  const U = xs.map((x) => U0 - kT * Math.log(x / (1 - x)) - omegaRT * kT * (1 - 2 * x));
  const dQdU = xs.map((x) => 1 / (-kT / (x * (1 - x)) + 2 * omegaRT * kT)); // Kapazitaet 1, Vorzeichen: Fuellen senkt U
  return { xs, U, dQdU, U0 };
}

function drawSCurve(container) {
  const s = regularSolution();
  const top = document.createElement('div');
  const bottom = document.createElement('div');
  container.replaceChildren(top, bottom);
  chart(top, {
    label: 'S-shaped potential of a homogeneous LFP particle (regular solution model) and the flat plateau',
    xMax: 1, yMin: 3.2, yMax: 3.65, xTitle: 'filling x', yTitle: 'potential vs Li/Li⁺ [V]', height: 220,
    draw(p) {
      p.hline(s.U0, 'plateau (both phases)', C.water);
      p.line(s.xs.map((x, i) => [x, s.U[i]]), { stroke: C.cathode });
      p.label(0.04, 3.27, 'forced to stay uniform', C.cathode);
    },
  });
  chart(bottom, {
    label: 'dQ/dV of the S-curve: two poles, negative in between, three branches over one voltage',
    xMin: 3.2, xMax: 3.65, yMin: -60, yMax: 60, xTitle: 'potential vs Li/Li⁺ [V]', yTitle: 'dQ/dV [1/V]', height: 220,
    draw(p) {
      p.hline(0, null, C.muted, '2 3');
      p.line(s.xs.map((x, i) => [s.U[i], -s.dQdU[i]]), { stroke: C.cell });
      p.label(3.22, 50, 'goes to infinity at the turning points', C.cell);
      p.label(3.22, -50, 'negative in between', C.warn);
    },
  });
}

function initLfpExtras(root) {
  const form = root.querySelector('form');
  const parts = { weir: root.querySelector('[data-weir]'), particles: root.querySelector('[data-particles]') };
  let frame = 0;
  const render = () => {
    frame = 0;
    const { fill } = controls.values();
    if (parts.weir) drawWeir(parts.weir, fill);
    if (parts.particles) drawParticles(parts.particles, fill);
  };
  const controls = initControls(form, () => { if (!frame) frame = requestAnimationFrame(render); });
  controls.refresh();
  render();
}

/* Start ---------------------------------------------------------------------------------------- */
async function init() {
  const data = await loadData();
  for (const root of document.querySelectorAll('[data-mat-tool]')) initMaterialTool(root, data);
  for (const fig of document.querySelectorAll('[data-capacity]')) drawCapacity(fig.querySelector('[data-figure-parts]') ?? fig, data, fig.dataset.current, 'nav' in fig.dataset);
  for (const fig of document.querySelectorAll('[data-shelf]')) drawShelf(fig.querySelector('[data-figure-parts]') ?? fig, data, fig.dataset.current, 'nav' in fig.dataset);
  for (const fig of document.querySelectorAll('[data-scurve]')) drawSCurve(fig);
  for (const root of document.querySelectorAll('[data-lfp-extras]')) initLfpExtras(root);
}

if (typeof document !== 'undefined') init().catch(() => {});
