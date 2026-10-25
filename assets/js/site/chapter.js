// Kapitel "Lithium balance" (/learn/lithium-balance/): Reiter, Quiz und die drei schlanken Tools
// (Einleitung, N/P, N/Li). Gezeichnet wird als SVG ohne Plotly, damit die Seite leicht bleibt.
// Rechnung: assets/js/model/idealCell.js (ideale Tanks, alles Geraden).
import { IDEAL_ANODE, IDEAL_CATHODE, idealCell, lithiumAccount, realElectrode } from '../model/idealCell.js';
import { loadMaterial } from '../ui/data.js';
import { initControls } from '../ui/controls.js';
import { track } from './track.js';

const NS = 'http://www.w3.org/2000/svg';
const C = {
  anode: '#70ad47',
  cathode: '#f39c12',
  water: '#5dade2',
  cell: '#ffffff',
  text: '#e6eaf1',
  muted: 'rgb(255 255 255 / 0.55)',
  grid: 'rgb(255 255 255 / 0.12)',
  tank: 'rgb(255 255 255 / 0.75)',
  metal: '#b8c2cc',
  warn: '#ff8a80',
};

const fmt = (v, d = 2) => (Number.isFinite(v) ? v.toFixed(d) : '–');
const pct = (v) => `${Math.round(v * 100)} %`;

function el(name, attrs = {}, text) {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) node.setAttribute(k, String(v));
  if (text !== undefined) node.textContent = text;
  return node;
}

function svgRoot(container, width, height, label) {
  const svg = el('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': label, class: 'ch-svg' });
  container.replaceChildren(svg);
  return svg;
}

/* Reiter --------------------------------------------------------------------------------------- */
function initTabs() {
  const nav = document.querySelector('[data-chapter-tabs]');
  if (!nav) return;
  const panels = [...document.querySelectorAll('[data-chapter-panel]')];
  const links = [...nav.querySelectorAll('a')];
  document.documentElement.classList.add('has-chapter-tabs');

  function show(id, scroll) {
    const target = panels.find((p) => p.id === id) ? id : panels[0].id;
    for (const p of panels) p.hidden = p.id !== target;
    for (const a of links) {
      const active = a.hash === `#${target}`;
      a.classList.toggle('is-active', active);
      if (active) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    }
    // Beim Umschalten an den Anfang des Kapitels, falls man schon tiefer gescrollt war
    const panel = panels.find((p) => p.id === target);
    if (scroll && panel.getBoundingClientRect().top < 0) panel.scrollIntoView({ block: 'start' });
  }

  // Alle Links auf Reiter (Navigation oben, "Weiter"-Links unten) schalten um, statt zu springen
  document.addEventListener('click', (event) => {
    const a = event.target.closest('a[href^="#"]');
    if (!a || !panels.some((p) => `#${p.id}` === a.hash)) return;
    event.preventDefault();
    history.pushState(null, '', a.hash);
    show(a.hash.slice(1), true);
  });
  window.addEventListener('popstate', () => show(location.hash.slice(1), false));
  show(location.hash.slice(1), false);
}

/* Quiz ----------------------------------------------------------------------------------------- */
function initQuiz() {
  for (const quiz of document.querySelectorAll('[data-quiz]')) {
    const feedback = quiz.querySelector('[data-quiz-feedback]');
    let answered = false;
    quiz.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-answer]');
      if (!button) return;
      const right = button.dataset.correct === 'true';
      for (const b of quiz.querySelectorAll('button[data-answer]')) {
        b.classList.toggle('is-picked', b === button);
        b.classList.toggle('is-right', b.dataset.correct === 'true' && (right || b === button));
        b.classList.toggle('is-wrong', b === button && !right);
      }
      feedback.textContent = right ? button.dataset.yes : button.dataset.no;
      feedback.hidden = false;
      // Nur die erste Antwort zaehlt (anonym, ueber das vorhandene Ereignis tool_used)
      if (!answered) track('tool_used', { tool: `quiz-${quiz.dataset.quiz}:${button.dataset.answer}` });
      answered = true;
    });
  }
}

/* Tankbild ------------------------------------------------------------------------------------- */
// Decke = Li/Li+ oben; Tiefe unter der Decke = Spannung. Breite eines Tanks ~ dQ/dU, Flaeche ~ Kapazitaet.
// Ideale Tanks sind Rechtecke; echte Kurven (Graphit, NMC) ergeben Stufen bzw. Trichter. Sehr flache
// Plateaus wuerden unendlich breit - die Breite ist deshalb je Tank gedeckelt.
const PX_PER_V = 60;
const K_WIDTH = 150 / (16 / (IDEAL_ANODE.empty - IDEAL_ANODE.full)); // ideale Anode mit 16 Ah = 150 px

function tankProfile(U, q, { uMin = -Infinity, cap }) {
  const n = 220;
  const pts = [];
  for (let i = 0; i <= n; i += 1) {
    const f = i / n;
    const u = U(f);
    if (u >= uMin) pts.push({ f, u });
  }
  // Breite aus dem Anstieg df/du ueber ein Spannungsfenster (glaettet Rauschen, haelt Geraden konstant)
  const h = 0.025;
  for (const p of pts) {
    let fLo = Infinity;
    let fHi = -Infinity;
    let uLo = Infinity;
    let uHi = -Infinity;
    for (const o of pts) {
      if (Math.abs(o.u - p.u) > h) continue;
      fLo = Math.min(fLo, o.f); fHi = Math.max(fHi, o.f);
      uLo = Math.min(uLo, o.u); uHi = Math.max(uHi, o.u);
    }
    p.w = Math.min(cap, (K_WIDTH * q * (fHi - fLo)) / Math.max(uHi - uLo, 0.004));
  }
  return pts; // f steigt, u faellt (Richtung Decke)
}

function drawTanks(container, cell, x, { only } = {}) {
  const W = 360;
  const top = 30;
  const H = top + 4.45 * PX_PER_V + 26;
  const y = (u) => top + u * PX_PER_V;
  const svg = svgRoot(container, W, H, only === 'cathode'
    ? 'One cathode tank hanging from the Li/Li+ ceiling' : 'Anode and cathode tanks hanging from the Li/Li+ ceiling');

  // Decke
  svg.append(el('rect', { x: 8, y: top - 8, width: W - 16, height: 8, fill: C.metal, opacity: 0.5 }));
  svg.append(el('line', { x1: 8, x2: W - 8, y1: top, y2: top, stroke: C.metal, 'stroke-width': 1.5 }));
  svg.append(el('text', { x: W / 2, y: top - 12, fill: C.muted, 'font-size': 11, 'text-anchor': 'middle' }, 'ceiling = Li/Li⁺ (0 V)'));

  // Symmetrischer Tank: dQ/dU nach links und rechts je zur Haelfte um die Mittelachse
  function tank({ x0, pts, fill, color, name }) {
    const bottom = pts[0];
    const last = pts[pts.length - 1];
    const level = Math.min(1, Math.max(0, fill));
    const yBot = y(bottom.u);
    const maxW = Math.max(...pts.map((p) => p.w));
    const cx = x0 + maxW / 2;
    const L = (p) => (cx - p.w / 2).toFixed(1);
    const R = (p) => (cx + p.w / 2).toFixed(1);
    const Y = (p) => y(p.u).toFixed(1);
    // Wasser: alles unterhalb der Oberflaeche (Fuellgrad <= fill)
    const wet = pts.filter((p) => p.f <= level);
    const surfU = level >= last.f ? last.u : interpU(pts, level);
    const surf = { u: surfU, w: wet.length ? wet[wet.length - 1].w : bottom.w };
    if (level > 0 && wet.length) {
      const water = [`M${R(wet[0])} ${Y(wet[0])}`, ...wet.map((p) => `L${R(p)} ${Y(p)}`), `L${R(surf)} ${Y(surf)}`,
        `L${L(surf)} ${Y(surf)}`, ...[...wet].reverse().map((p) => `L${L(p)} ${Y(p)}`), 'Z'];
      svg.append(el('path', { d: water.join(''), fill: C.water, opacity: 0.85 }));
    }
    const rim = y(last.u) - 3;
    const wall = [`M${L(last)} ${rim.toFixed(1)}`, ...[...pts].reverse().map((p) => `L${L(p)} ${Y(p)}`),
      ...pts.map((p) => `L${R(p)} ${Y(p)}`), `L${R(last)} ${rim.toFixed(1)}`];
    svg.append(el('path', { d: wall.join(''), fill: 'none', stroke: color, 'stroke-width': 2.5, 'stroke-linejoin': 'round' }));
    svg.append(el('text', { x: cx, y: yBot + 16, fill: color, 'font-size': 12, 'font-weight': 600, 'text-anchor': 'middle' }, `${name} ${pct(level)}`));
    return { maxW, ySurf: y(surfU), yTop: y(last.u), x0, yBot };
  }

  const cathPts = tankProfile(cell.cathodeU, cell.qCath, { uMin: cell.real ? 3.3 : -Infinity, cap: 12 * cell.qCath });
  const cathW = Math.max(...cathPts.map((p) => p.w));
  const ca = tank({ x0: only === 'cathode' ? (W - cathW) / 2 : W - 16 - cathW, pts: cathPts, fill: cell.fillCath(x), color: C.cathode, name: 'Cathode' });

  if (only === 'cathode') {
    // Halbzelle: Spannung = Abstand von der Decke bis zur Wasseroberflaeche
    const xv = ca.x0 - 22;
    svg.append(el('line', { x1: xv, x2: xv, y1: top, y2: ca.ySurf, stroke: C.cell, 'stroke-width': 1.5 }));
    svg.append(el('path', { d: `M${xv - 4} ${top + 6}L${xv} ${top}L${xv + 4} ${top + 6}M${xv - 4} ${ca.ySurf - 6}L${xv} ${ca.ySurf}L${xv + 4} ${ca.ySurf - 6}`, stroke: C.cell, fill: 'none', 'stroke-width': 1.5 }));
    svg.append(el('line', { x1: xv, x2: ca.x0, y1: ca.ySurf, y2: ca.ySurf, stroke: C.muted, 'stroke-dasharray': '3 3' }));
    svg.append(el('text', { x: xv - 8, y: (top + ca.ySurf) / 2, fill: C.cell, 'font-size': 13, 'font-weight': 700, 'text-anchor': 'end', 'dominant-baseline': 'middle' }, `${fmt(cell.uCath(x))} V`));
    svg.append(el('text', { x: xv - 8, y: (top + ca.ySurf) / 2 + 16, fill: C.muted, 'font-size': 11, 'text-anchor': 'end', 'dominant-baseline': 'middle' }, 'vs Li/Li⁺'));
    return;
  }

  const anPts = tankProfile(cell.anodeU, cell.qAnode, { cap: 10 * cell.qAnode });
  const an = tank({ x0: 16, pts: anPts, fill: cell.fillAnode(x), color: C.anode, name: 'Anode' });

  // Plating: was nicht mehr in den Anodentank passt, wird selbst zur Decke
  const plated = cell.plated(x);
  let anodeSurface = an.ySurf;
  if (plated > 1e-6) {
    anodeSurface = top;
    svg.append(el('rect', { x: 16, y: top, width: an.maxW, height: Math.max(3, an.yTop - top), fill: C.metal }));
    svg.append(el('text', { x: 16, y: an.yBot + 32, fill: C.warn, 'font-size': 11, 'font-weight': 600 }, `plating: ${fmt(plated)} Ah Li metal`));
  }

  // Zellspannung = Hoehenunterschied der beiden Wasseroberflaechen
  const xv = Math.max(16 + an.maxW + 30, (16 + an.maxW + ca.x0) / 2);
  const v = cell.vCell(x);
  svg.append(el('line', { x1: 16 + an.maxW / 2, x2: xv + 8, y1: anodeSurface, y2: anodeSurface, stroke: C.muted, 'stroke-dasharray': '3 3' }));
  svg.append(el('line', { x1: xv - 8, x2: ca.x0 + 6, y1: ca.ySurf, y2: ca.ySurf, stroke: C.muted, 'stroke-dasharray': '3 3' }));
  svg.append(el('line', { x1: xv, x2: xv, y1: anodeSurface, y2: ca.ySurf, stroke: C.cell, 'stroke-width': 1.5 }));
  svg.append(el('path', { d: `M${xv - 4} ${anodeSurface + 6}L${xv} ${anodeSurface}L${xv + 4} ${anodeSurface + 6}M${xv - 4} ${ca.ySurf - 6}L${xv} ${ca.ySurf}L${xv + 4} ${ca.ySurf - 6}`, stroke: C.cell, fill: 'none', 'stroke-width': 1.5 }));
  svg.append(el('text', { x: xv + 8, y: (anodeSurface + ca.ySurf) / 2, fill: C.cell, 'font-size': 13, 'font-weight': 700, 'dominant-baseline': 'middle' }, `${fmt(v)} V`));
  svg.append(el('text', { x: xv + 8, y: (anodeSurface + ca.ySurf) / 2 + 16, fill: C.muted, 'font-size': 11, 'dominant-baseline': 'middle' }, 'cell voltage'));
}

// Spannung zum Fuellgrad f aus den Stuetzstellen des Profils
function interpU(pts, f) {
  for (let i = 1; i < pts.length; i += 1) {
    if (pts[i].f >= f) {
      const a = pts[i - 1];
      const b = pts[i];
      return a.u + ((f - a.f) / (b.f - a.f || 1)) * (b.u - a.u);
    }
  }
  return pts[pts.length - 1].u;
}

/* Diagramme ------------------------------------------------------------------------------------ */
function niceTicks(min, max, count = 5) {
  const step0 = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0);
  const out = [];
  for (let t = Math.ceil(min / step) * step; t <= max + 1e-9; t += step) out.push(Math.round(t * 1e6) / 1e6);
  return out;
}

function chart(container, { label, xMax, yMin, yMax, xTitle, yTitle, height = 240, draw }) {
  const W = 360;
  const m = { l: 44, r: 12, t: 12, b: 40 };
  const svg = svgRoot(container, W, height, label);
  const px = (x) => m.l + (x / xMax) * (W - m.l - m.r);
  const py = (v) => height - m.b - ((v - yMin) / (yMax - yMin)) * (height - m.t - m.b);
  for (const t of niceTicks(yMin, yMax)) {
    svg.append(el('line', { x1: m.l, x2: W - m.r, y1: py(t), y2: py(t), stroke: C.grid }));
    svg.append(el('text', { x: m.l - 6, y: py(t), fill: C.muted, 'font-size': 10, 'text-anchor': 'end', 'dominant-baseline': 'middle' }, t));
  }
  for (const t of niceTicks(0, xMax, 6)) {
    svg.append(el('text', { x: px(t), y: height - m.b + 14, fill: C.muted, 'font-size': 10, 'text-anchor': 'middle' }, t));
  }
  svg.append(el('text', { x: (m.l + W - m.r) / 2, y: height - 6, fill: C.text, 'font-size': 11, 'text-anchor': 'middle' }, xTitle));
  svg.append(el('text', { x: 12, y: (m.t + height - m.b) / 2, fill: C.text, 'font-size': 11, 'text-anchor': 'middle', transform: `rotate(-90 12 ${(m.t + height - m.b) / 2})` }, yTitle));
  const clip = `clip-${Math.random().toString(36).slice(2)}`;
  const defs = el('defs');
  const cp = el('clipPath', { id: clip });
  cp.append(el('rect', { x: m.l, y: m.t, width: W - m.l - m.r, height: height - m.t - m.b }));
  defs.append(cp);
  svg.append(defs);
  const g = el('g', { 'clip-path': `url(#${clip})` });
  svg.append(g);
  const api = {
    line(points, attrs) {
      const d = points.filter(([, v]) => Number.isFinite(v)).map(([xx, v], i) => `${i ? 'L' : 'M'}${px(xx).toFixed(1)} ${py(v).toFixed(1)}`).join('');
      g.append(el('path', { d, fill: 'none', 'stroke-width': 2.5, 'stroke-linejoin': 'round', ...attrs }));
    },
    hline(v, text, color, dash = '5 4') {
      g.append(el('line', { x1: m.l, x2: W - m.r, y1: py(v), y2: py(v), stroke: color, 'stroke-dasharray': dash, 'stroke-width': 1.25 }));
      if (text) svg.append(el('text', { x: W - m.r - 4, y: py(v) - 4, fill: color, 'font-size': 10, 'text-anchor': 'end' }, text));
    },
    band(x0, x1, color) {
      g.append(el('rect', { x: px(x0), y: m.t, width: Math.max(0, px(x1) - px(x0)), height: height - m.t - m.b, fill: color }));
    },
    vline(xx, v0, v1, color) {
      g.append(el('line', { x1: px(xx), x2: px(xx), y1: py(v0), y2: py(v1), stroke: color, 'stroke-width': 1.5 }));
    },
    dot(xx, v, color) {
      g.append(el('circle', { cx: px(xx), cy: py(v), r: 4.5, fill: color, stroke: '#003b73', 'stroke-width': 1.5 }));
    },
    label(xx, v, text, color, anchor = 'start') {
      svg.append(el('text', { x: px(xx), y: py(v), fill: color, 'font-size': 11, 'font-weight': 600, 'text-anchor': anchor }, text));
    },
  };
  draw(api);
}

function sample(f, x0, x1, n = 160) {
  const out = [];
  for (let i = 0; i <= n; i += 1) {
    const xx = x0 + ((x1 - x0) * i) / n;
    out.push([xx, f(xx)]);
  }
  return out;
}

function drawElectrodes(container, cell, x, xMax) {
  chart(container, {
    label: 'Electrode potentials against Li/Li+ over the lithium in the anode',
    // gleiche Hoehe wie das Tankbild, damit beide nebeneinander gleich gross stehen
    xMax, yMin: 0, yMax: 4.5, xTitle: 'lithium in the anode [Ah]', yTitle: 'potential vs Li/Li⁺ [V]', height: 30 + 4.45 * PX_PER_V + 26,
    draw(p) {
      p.hline(0, null, C.metal, '2 3');
      p.label(0.2, 0.12, 'ceiling Li/Li⁺', C.metal);
      p.band(cell.xMin, cell.xMax, 'rgb(93 173 226 / 0.10)');
      p.line(sample(cell.uCath, cell.xLo, cell.xHi, 240), { stroke: C.cathode });
      const xFull = Math.min(cell.xHi, cell.qAnode);
      const anode = sample(cell.uAnode, 0, xFull, 240);
      if (cell.xHi > cell.qAnode) anode.push([cell.qAnode + 1e-9, 0], [cell.xHi, 0]);
      // Rest des Anodentanks, den das Lithium nie erreicht (Anode zu gross): gestrichelt weiter bis voll
      if (cell.qAnode > cell.xHi + 1e-9) {
        p.line(sample(cell.uAnode, cell.xHi, cell.qAnode, 120), { stroke: C.anode, 'stroke-dasharray': '6 5', opacity: 0.7 });
      }
      p.line(anode, { stroke: C.anode });
      p.vline(x, cell.uAnode(x), cell.uCath(x), C.cell);
      p.dot(x, cell.uCath(x), C.cathode);
      p.dot(x, cell.uAnode(x), C.anode);
      p.label(0.2, 4.15, 'cathode', C.cathode);
      p.label(0.2, 1.05, 'anode', C.anode);
    },
  });
}

function drawCell(container, cell, x, xMax) {
  chart(container, {
    label: 'Cell voltage over the lithium in the anode with Vmin and Vmax',
    xMax, yMin: 2.8, yMax: 4.5, xTitle: 'lithium in the anode [Ah]', yTitle: 'cell voltage [V]', height: 200,
    draw(p) {
      p.band(cell.xMin, cell.xMax, 'rgb(93 173 226 / 0.18)');
      p.hline(cell.vMax, `Vmax ${fmt(cell.vMax)} V`, C.warn);
      p.hline(cell.vMin, `Vmin ${fmt(cell.vMin)} V`, C.warn);
      p.line(sample(cell.vCell, cell.xLo, cell.xHi, 240), { stroke: C.cell });
      p.dot(x, cell.vCell(x), C.water);
    },
  });
}

// Lithiumkonto als Wasserfall: reversible Kathode + Bonus = erste Ladung, minus SEI = zyklisierbares Lithium
function drawAccount(container, acc) {
  const W = 360;
  const H = 230;
  const m = { l: 40, r: 10, t: 16, b: 46 };
  const yMax = Math.ceil(acc.firstCharge + 0.6);
  // Achse beginnt knapp unter dem kleinsten Balkenende, damit Bonus und SEI sichtbar bleiben
  const yMin = Math.max(0, Math.floor(Math.min(acc.li, acc.qCathRev)) - 2);
  const svg = svgRoot(container, W, H, 'Lithium account of the formation as a waterfall chart');
  const py = (v) => H - m.b - ((Math.max(v, yMin) - yMin) / (yMax - yMin)) * (H - m.t - m.b);
  for (const t of niceTicks(yMin, yMax)) {
    svg.append(el('line', { x1: m.l, x2: W - m.r, y1: py(t), y2: py(t), stroke: C.grid }));
    svg.append(el('text', { x: m.l - 6, y: py(t), fill: C.muted, 'font-size': 10, 'text-anchor': 'end', 'dominant-baseline': 'middle' }, t));
  }
  svg.append(el('text', { x: 12, y: (m.t + H - m.b) / 2, fill: C.text, 'font-size': 11, 'text-anchor': 'middle', transform: `rotate(-90 12 ${(m.t + H - m.b) / 2})` }, 'lithium [Ah]'));
  const bars = [
    { name: ['cathode', 'reversible'], from: 0, to: acc.qCathRev, color: C.cathode },
    { name: ['formation', 'bonus'], from: acc.qCathRev, to: acc.firstCharge, color: C.anode },
    { name: ['SEI'], from: acc.firstCharge, to: acc.li, color: C.warn },
    { name: ['cyclable', 'lithium'], from: 0, to: acc.li, color: C.water },
  ];
  const slot = (W - m.l - m.r) / bars.length;
  bars.forEach((b, i) => {
    const x0 = m.l + i * slot + slot * 0.18;
    const w = slot * 0.64;
    const lo = Math.min(b.from, b.to);
    const hi = Math.max(b.from, b.to);
    svg.append(el('rect', { x: x0, y: py(hi), width: w, height: Math.max(1, py(lo) - py(hi)), fill: b.color, rx: 2 }));
    const delta = b.to - b.from;
    const text = i === 1 ? `+${fmt(delta)}` : i === 2 ? `−${fmt(-delta)}` : fmt(b.to);
    svg.append(el('text', { x: x0 + w / 2, y: py(hi) - 5, fill: C.text, 'font-size': 11, 'font-weight': 600, 'text-anchor': 'middle' }, text));
    b.name.forEach((line, j) => svg.append(el('text', { x: x0 + w / 2, y: H - m.b + 14 + j * 12, fill: C.muted, 'font-size': 10, 'text-anchor': 'middle' }, line)));
    if (i < bars.length - 1) {
      svg.append(el('line', { x1: x0 + w, x2: x0 + slot, y1: py(b.to), y2: py(b.to), stroke: C.muted, 'stroke-dasharray': '2 2' }));
    }
  });
  // Platz in der Kathode zum Vergleich: Lithium unter der Linie heisst Luecke in der Kathode
  svg.append(el('line', { x1: m.l, x2: W - m.r, y1: py(acc.qCathRev), y2: py(acc.qCathRev), stroke: C.cathode, 'stroke-dasharray': '5 4', opacity: 0.7 }));
}

/* Tools ---------------------------------------------------------------------------------------- */
const Q_CATH = 10; // Ah, reversible Kapazitaet der Kathode in allen drei Tools

// Echte Kurven (Graphit gegen NMC) aus den Materialdaten der Webseite, einmal geladen
let realPromise = null;
let REAL = null;
function loadReal() {
  realPromise ||= Promise.all([loadMaterial('Graphite'), loadMaterial('NMC')])
    .then(([graphite, nmc]) => {
      REAL = { anode: realElectrode(graphite), cathode: realElectrode(nmc) };
      return REAL;
    });
  return realPromise;
}

function electrodes(v) {
  return v.curves === 'real' && REAL ? REAL : { anode: IDEAL_ANODE, cathode: IDEAL_CATHODE };
}

function realLink(np, lip, soc) {
  const clamp = (val, lo, hi) => Math.min(hi, Math.max(lo, val));
  return `/tools/cell-reconstruction/?anode=graphite&cathode=nmc&soc=${fmt(soc)}&vmin=2.8&vmax=4.2`
    + `&np=${fmt(clamp(np, 0.8, 1.5))}&lip=${fmt(clamp(lip, 0.5, 1.5))}`;
}

// Startwerte wie die Regler im Template (fuer die festen Abbildungen zwischen den Texten)
const DEFAULTS = {
  intro: { soc: 0.5, vmin: 3.2, vmax: 4.0, curves: 'ideal' },
  np: { np: 1.1, soc: 1, vmin: 3.0, vmax: 4.2, curves: 'ideal' },
  nli: { np: 1.2, bonus: 6, sei: 10, soc: 0, vmin: 3.0, vmax: 4.2, curves: 'ideal' },
};

const TOOLS = {
  intro(v) {
    const cell = idealCell({ qCath: Q_CATH, qAnode: 1.2 * Q_CATH, li: Q_CATH, vMin: v.vmin, vMax: v.vmax, ...electrodes(v) });
    return {
      cell, xAxis: 12,
      readouts: {
        voltage: `${fmt(cell.vCell(cell.xMin + v.soc * cell.capacity))} V`,
        capacity: `${fmt(cell.capacity)} Ah of ${fmt(Q_CATH)} Ah`,
      },
      link: realLink(1.2, 1.0, v.soc),
    };
  },
  np(v) {
    const cell = idealCell({ qCath: Q_CATH, qAnode: v.np * Q_CATH, li: Q_CATH, vMin: v.vmin, vMax: v.vmax, ...electrodes(v) });
    const status = cell.platedAtVmax > 1e-6 ? `plating! ${fmt(cell.platedAtVmax)} Ah`
      : cell.ceilingAtVmax ? 'anode hits the ceiling' : `${fmt(cell.qAnode - cell.xMax)} Ah room left`;
    return {
      cell, xAxis: 16,
      readouts: {
        npcap: fmt(cell.npCap), npfill: fmt(cell.npFill), anodeVmax: pct(cell.fillAnode(cell.xMax)), status,
        capacity: `${fmt(cell.capacity)} Ah`,
      },
      warn: cell.ceilingAtVmax,
      link: realLink(v.np, 1.0, v.soc),
    };
  },
  nli(v) {
    const acc = lithiumAccount({ qCathRev: Q_CATH, npRatio: v.np, bonus: v.bonus / 100, seiRate: v.sei / 100 });
    const cell = idealCell({ qCath: Q_CATH, qAnode: acc.qAnode, li: acc.li, vMin: v.vmin, vMax: v.vmax, ...electrodes(v) });
    return {
      cell, acc, xAxis: 16,
      readouts: {
        li: `${fmt(acc.li)} Ah`, nli: fmt(acc.nLi), gap: `${fmt(cell.cathodeGap)} Ah`,
        limit: acc.lithiumLimits ? 'lithium' : 'cathode (bonus > SEI)',
        capacity: `${fmt(cell.capacity)} Ah`,
      },
      link: realLink(v.np, acc.li / Q_CATH, v.soc),
    };
  },
};

function drawParts(parts, out, x, opts = {}) {
  const { cell } = out;
  if (parts.tanks) drawTanks(parts.tanks, cell, x, opts);
  if (parts.electrodes) drawElectrodes(parts.electrodes, cell, x, out.xAxis);
  if (parts.cell) drawCell(parts.cell, cell, x, out.xAxis);
  if (parts.account && out.acc) drawAccount(parts.account, out.acc);
}

// Feste Abbildung zwischen den Texten: dieselben Zeichnungen wie die Tools, mit festen Werten
// <figure data-chapter-figure data-tool="np" data-show="tanks,electrodes" data-np="0.8" ...>
async function initFigure(fig) {
  const tool = fig.dataset.tool;
  const values = { ...DEFAULTS[tool] };
  for (const key of Object.keys(values)) {
    if (fig.dataset[key] === undefined) continue;
    values[key] = key === 'curves' ? fig.dataset[key] : Number(fig.dataset[key]);
  }
  if (values.curves === 'real') await loadReal();
  const out = TOOLS[tool](values);
  const x = out.cell.xMin + values.soc * out.cell.capacity;
  const holder = fig.querySelector('[data-figure-parts]');
  const parts = {};
  for (const name of fig.dataset.show.split(',')) {
    parts[name] = document.createElement('div');
    holder.append(parts[name]);
  }
  drawParts(parts, out, x, { only: fig.dataset.only });
}

function initTool(root) {
  const form = root.querySelector('form');
  const compute = TOOLS[root.dataset.chapterTool];
  const parts = {
    tanks: root.querySelector('[data-tanks]'),
    electrodes: root.querySelector('[data-electrodes]'),
    cell: root.querySelector('[data-cell]'),
    account: root.querySelector('[data-account]'),
  };
  const link = root.querySelector('[data-real-link]');
  let frame = 0;
  let used = false;

  function render() {
    frame = 0;
    const values = controls.values();
    if (values.curves === 'real' && !REAL) {
      loadReal().then(render).catch(() => {});
      return;
    }
    const out = compute(values);
    const { cell } = out;
    const x = cell.xMin + values.soc * cell.capacity;
    drawParts(parts, out, x);
    root.classList.toggle('is-real', values.curves === 'real');
    for (const [key, text] of Object.entries(out.readouts)) {
      const node = root.querySelector(`[data-readout="${key}"]`);
      if (node) node.textContent = text;
    }
    root.classList.toggle('is-warning', Boolean(out.warn));
    if (link) link.href = out.link;
  }

  const controls = initControls(form, (event) => {
    if (!used && event?.isTrusted) {
      used = true;
      track('tool_used', { tool: `lithium-balance-${root.dataset.chapterTool}` });
    }
    if (!frame) frame = requestAnimationFrame(render);
  });
  // Szenario-Knoepfe: setzen einige Regler auf feste Werte (statt eines "Try this"-Kastens)
  const chips = [...form.querySelectorAll('[data-preset]')];
  for (const chip of chips) {
    chip.addEventListener('click', () => {
      const preset = JSON.parse(chip.dataset.preset);
      for (const [name, value] of Object.entries(preset)) controls.set(name, value);
      for (const c of chips) c.classList.toggle('is-active', c === chip);
      track('try_this', { tool: `lithium-balance-${root.dataset.chapterTool}`, query: new URLSearchParams(preset).toString() });
      render();
    });
  }
  form.addEventListener('input', () => chips.forEach((c) => c.classList.remove('is-active')));
  form.querySelector('[data-reset]')?.addEventListener('click', () => {
    form.reset();
    controls.refresh();
    render();
  });
  controls.refresh();
  render();
}

initTabs();
initQuiz();
for (const root of document.querySelectorAll('[data-chapter-tool]')) initTool(root);
for (const fig of document.querySelectorAll('[data-chapter-figure]')) initFigure(fig).catch(() => {});

// Fuer Pruefungen ohne Browser (Zeichnen in eine Attrappe des DOM)
export { DEFAULTS, drawAccount, drawCell, drawElectrodes, drawTanks, TOOLS, REAL, loadReal };
