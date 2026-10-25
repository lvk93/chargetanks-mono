// Kapitel "Lithium balance" (/learn/lithium-balance/): Reiter, Quiz und die drei schlanken Tools
// (Einleitung, N/P, N/Li). Gezeichnet wird als SVG ohne Plotly, damit die Seite leicht bleibt.
// Rechnung: assets/js/model/idealCell.js (ideale Tanks, alles Geraden).
import { IDEAL_ANODE, IDEAL_CATHODE, idealCell, lithiumAccount } from '../model/idealCell.js';
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
    if (scroll) nav.scrollIntoView({ block: 'start' });
  }

  // Alle Links auf Reiter (Navigation oben, "Weiter"-Links unten) schalten um, statt zu springen
  document.addEventListener('click', (event) => {
    const a = event.target.closest('a[href^="#"]');
    if (!a || !panels.some((p) => `#${p.id}` === a.hash)) return;
    event.preventDefault();
    history.pushState(null, '', a.hash);
    show(a.hash.slice(1), a.closest('[data-chapter-tabs]') === null);
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
// Decke = Li/Li+ oben; Tiefe unter der Decke = Spannung. Flaeche eines Tanks ~ Kapazitaet.
function drawTanks(container, cell, x, { maxAnode = 16 } = {}) {
  const W = 360;
  const S = 60; // px pro Volt
  const top = 30;
  const H = top + 4.45 * S + 26;
  const y = (u) => top + u * S;
  const k = 150 / ((maxAnode) / (IDEAL_ANODE.empty - IDEAL_ANODE.full)); // breiteste Anode = 150 px
  const svg = svgRoot(container, W, H, 'Anode and cathode tanks hanging from the Li/Li+ ceiling');

  // Decke
  svg.append(el('rect', { x: 8, y: top - 8, width: W - 16, height: 8, fill: C.metal, opacity: 0.5 }));
  svg.append(el('line', { x1: 8, x2: W - 8, y1: top, y2: top, stroke: C.metal, 'stroke-width': 1.5 }));
  svg.append(el('text', { x: W / 2, y: top - 12, fill: C.muted, 'font-size': 11, 'text-anchor': 'middle' }, 'ceiling = Li/Li⁺ (0 V)'));

  function tank({ x0, spec, q, fill, color, name }) {
    const yTop = y(spec.full);
    const yBot = y(spec.empty);
    const w = (k * q) / (spec.empty - spec.full);
    const level = Math.min(1, Math.max(0, fill));
    const ySurf = yBot - level * (yBot - yTop);
    svg.append(el('rect', { x: x0, y: ySurf, width: w, height: yBot - ySurf, fill: C.water, opacity: 0.85 }));
    svg.append(el('path', { d: `M${x0} ${yTop - 3}V${yBot}H${x0 + w}V${yTop - 3}`, fill: 'none', stroke: color, 'stroke-width': 2.5 }));
    svg.append(el('text', { x: x0 + w / 2, y: yBot + 16, fill: color, 'font-size': 12, 'font-weight': 600, 'text-anchor': 'middle' }, `${name} ${pct(level)}`));
    return { w, ySurf, yTop, xMid: x0 + w / 2 };
  }

  const fa = cell.fillAnode(x);
  const fc = cell.fillCath(x);
  const an = tank({ x0: 16, spec: IDEAL_ANODE, q: cell.qAnode, fill: fa, color: C.anode, name: 'Anode' });
  const wc = (k * cell.qCath) / (IDEAL_CATHODE.empty - IDEAL_CATHODE.full);
  const ca = tank({ x0: W - 16 - wc, spec: IDEAL_CATHODE, q: cell.qCath, fill: fc, color: C.cathode, name: 'Cathode' });

  // Plating: was nicht mehr in den Anodentank passt, wird selbst zur Decke
  const plated = cell.plated(x);
  let anodeSurface = an.ySurf;
  if (plated > 1e-6) {
    anodeSurface = top;
    svg.append(el('rect', { x: 16, y: top, width: an.w, height: an.yTop - top, fill: C.metal }));
    svg.append(el('text', { x: 16, y: y(IDEAL_ANODE.empty) + 32, fill: C.warn, 'font-size': 11, 'font-weight': 600 }, `plating: ${fmt(plated)} Ah Li metal`));
  }

  // Zellspannung = Hoehenunterschied der beiden Wasseroberflaechen
  const xv = Math.max(an.xMid + an.w / 2 + 34, (16 + an.w + W - 16 - wc) / 2);
  const v = cell.vCell(x);
  svg.append(el('line', { x1: 16 + an.w, x2: xv + 8, y1: anodeSurface, y2: anodeSurface, stroke: C.muted, 'stroke-dasharray': '3 3' }));
  svg.append(el('line', { x1: xv - 8, x2: W - 16 - wc, y1: ca.ySurf, y2: ca.ySurf, stroke: C.muted, 'stroke-dasharray': '3 3' }));
  svg.append(el('line', { x1: xv, x2: xv, y1: anodeSurface, y2: ca.ySurf, stroke: C.cell, 'stroke-width': 1.5, 'marker-start': '', 'marker-end': '' }));
  svg.append(el('path', { d: `M${xv - 4} ${anodeSurface + 6}L${xv} ${anodeSurface}L${xv + 4} ${anodeSurface + 6}M${xv - 4} ${ca.ySurf - 6}L${xv} ${ca.ySurf}L${xv + 4} ${ca.ySurf - 6}`, stroke: C.cell, fill: 'none', 'stroke-width': 1.5 }));
  svg.append(el('text', { x: xv + 8, y: (anodeSurface + ca.ySurf) / 2, fill: C.cell, 'font-size': 13, 'font-weight': 700, 'dominant-baseline': 'middle' }, `${fmt(v)} V`));
  svg.append(el('text', { x: xv + 8, y: (anodeSurface + ca.ySurf) / 2 + 16, fill: C.muted, 'font-size': 11, 'dominant-baseline': 'middle' }, 'cell voltage'));
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
    xMax, yMin: 0, yMax: 4.5, xTitle: 'lithium in the anode [Ah]', yTitle: 'potential vs Li/Li⁺ [V]',
    draw(p) {
      p.hline(0, 'ceiling Li/Li⁺', C.metal, '2 3');
      p.band(cell.xMin, cell.xMax, 'rgb(93 173 226 / 0.10)');
      p.line([[cell.xLo, cell.uCath(cell.xLo)], [cell.xHi, cell.uCath(cell.xHi)]], { stroke: C.cathode });
      const xFull = Math.min(cell.xHi, cell.qAnode);
      const anode = [[0, cell.uAnode(0)], [xFull, cell.uAnode(xFull)]];
      if (cell.xHi > cell.qAnode) anode.push([cell.qAnode + 1e-9, 0], [cell.xHi, 0]);
      p.line(anode, { stroke: C.anode });
      p.vline(x, cell.uAnode(x), cell.uCath(x), C.cell);
      p.dot(x, cell.uCath(x), C.cathode);
      p.dot(x, cell.uAnode(x), C.anode);
      p.label(0.2, 4.15, 'cathode', C.cathode);
      p.label(0.2, 0.75, 'anode', C.anode);
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
      p.line(sample(cell.vCell, cell.xLo, cell.xHi), { stroke: C.cell });
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
const Q_CATH = 10; // Ah, reversible Kathodenkapazitaet in allen drei Tools

function realLink(np, lip, soc) {
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  return `/tools/cell-reconstruction/?anode=graphite&cathode=nmc&soc=${fmt(soc)}&vmin=2.8&vmax=4.2`
    + `&np=${fmt(clamp(np, 0.8, 1.5))}&lip=${fmt(clamp(lip, 0.5, 1.5))}`;
}

const TOOLS = {
  intro(v) {
    const cell = idealCell({ qCath: Q_CATH, qAnode: 1.2 * Q_CATH, li: Q_CATH, vMin: v.vmin, vMax: v.vmax });
    return {
      cell, xAxis: 12, maxAnode: 12,
      readouts: {
        voltage: `${fmt(cell.vCell(cell.xMin + v.soc * cell.capacity))} V`,
        capacity: `${fmt(cell.capacity)} Ah of ${fmt(Q_CATH)} Ah`,
      },
      link: realLink(1.1, 0.95, v.soc),
    };
  },
  np(v) {
    const cell = idealCell({ qCath: Q_CATH, qAnode: v.np * Q_CATH, li: Q_CATH, vMin: v.vmin, vMax: v.vmax });
    const status = cell.platedAtVmax > 1e-6 ? `plating! ${fmt(cell.platedAtVmax)} Ah`
      : cell.ceilingAtVmax ? 'anode hits the ceiling' : `${fmt(cell.qAnode - cell.xMax)} Ah room left`;
    return {
      cell, xAxis: 16, maxAnode: 16,
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
    const cell = idealCell({ qCath: Q_CATH, qAnode: acc.qAnode, li: acc.li, vMin: v.vmin, vMax: v.vmax });
    return {
      cell, acc, xAxis: 16, maxAnode: 16,
      readouts: {
        li: `${fmt(acc.li)} Ah`, nli: fmt(acc.nLi), gap: `${fmt(cell.cathodeGap)} Ah`,
        limit: acc.lithiumLimits ? 'lithium' : 'cathode (bonus > SEI)',
        capacity: `${fmt(cell.capacity)} Ah`,
      },
      link: realLink(v.np, acc.li / Q_CATH, v.soc),
    };
  },
};

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
    const out = compute(values);
    const { cell } = out;
    const x = cell.xMin + values.soc * cell.capacity;
    if (parts.tanks) drawTanks(parts.tanks, cell, x, { maxAnode: out.maxAnode });
    if (parts.electrodes) drawElectrodes(parts.electrodes, cell, x, out.xAxis);
    if (parts.cell) drawCell(parts.cell, cell, x, out.xAxis);
    if (parts.account && out.acc) drawAccount(parts.account, out.acc);
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

// Fuer Pruefungen ohne Browser (Zeichnen in eine Attrappe des DOM)
export { drawAccount, drawCell, drawElectrodes, drawTanks, TOOLS };
