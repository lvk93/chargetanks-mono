// Kapitel "Lithium balance" (/blog/lithium-balance/): Reiter, Quiz und die schlanken Tools
// (Einleitung, N/P, N/Li, Alterung) plus der feste Vergleich NMC/LFP gegen Graphit. Gezeichnet wird als SVG ohne Plotly, damit die Seite leicht bleibt.
// Rechnung: assets/js/model/idealCell.js (ideale Tanks, alles Geraden).
import { agedBalance, IDEAL_ANODE, IDEAL_CATHODE, idealCell, lithiumAccount, realElectrode } from '../model/idealCell.js';
import { blendElectrode, dqdv, IDEAL_GRAPHITE, IDEAL_SILICON, lineU } from '../model/blendTanks.js';
import { loadMaterial } from '../ui/data.js';
import { initControls } from '../ui/controls.js';
import { track } from './track.js';
import { C, chart, el, fmt, niceTicks, svgRoot } from './chartKit.js';


const pct = (v) => `${Math.round(v * 100)} %`;

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
    // Andere Skripte (z. B. das Regal in materials.js) erfahren, welcher Reiter offen ist
    document.dispatchEvent(new CustomEvent('chapter:tab', { detail: { id: target } }));
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
// Scroll-Widerstand: Die Aufloesung direkt nach einem Quiz bleibt verschleiert, bis man antwortet oder
// "Skip" drueckt. Ohne JavaScript (und fuer Suchmaschinen) steht der Text ganz normal da.
function veilAnswer(quiz) {
  const block = document.querySelector(`[data-quiz-answer="${quiz.dataset.quiz}"]`);
  if (!block) return () => {};
  const skip = document.createElement('button');
  skip.type = 'button';
  skip.className = 'quiz-answer__skip';
  skip.textContent = 'Skip and show the answer';
  const body = document.createElement('div');
  body.className = 'quiz-answer__body';
  body.append(...block.childNodes);
  body.setAttribute('aria-hidden', 'true');
  body.inert = true;
  block.append(body, skip);
  block.classList.add('is-veiled');
  let open = false;
  const reveal = () => {
    if (open) return;
    open = true;
    block.classList.remove('is-veiled');
    body.removeAttribute('aria-hidden');
    body.inert = false;
    skip.remove();
  };
  skip.addEventListener('click', () => {
    track('tool_used', { tool: `quiz-${quiz.dataset.quiz}:skip` });
    reveal();
  });
  return reveal;
}

function initQuiz() {
  for (const quiz of document.querySelectorAll('[data-quiz]')) {
    const feedback = quiz.querySelector('[data-quiz-feedback]');
    const reveal = veilAnswer(quiz);
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
      reveal();
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

function drawCell(container, cell, x, xMax, ref = null) {
  chart(container, {
    label: 'Cell voltage over the lithium in the anode with Vmin and Vmax',
    xMax, yMin: 2.8, yMax: 4.5, xTitle: 'lithium in the anode [Ah]', yTitle: 'cell voltage [V]', height: 200,
    draw(p) {
      p.band(cell.xMin, cell.xMax, 'rgb(93 173 226 / 0.18)');
      // frische Zelle zum Vergleich (Alterung), auf denselben Startpunkt geschoben
      if (ref) {
        const dx = ref.xMin - cell.xMin;
        p.line(sample((xx) => ref.vCell(xx + dx), ref.xLo - dx, ref.xHi - dx, 240), { stroke: C.muted, 'stroke-dasharray': '5 4', 'stroke-width': 1.75 });
      }
      p.hline(cell.vMax, `Vmax ${fmt(cell.vMax)} V`, C.warn);
      p.hline(cell.vMin, `Vmin ${fmt(cell.vMin)} V`, C.warn);
      p.line(sample(cell.vCell, cell.xLo, cell.xHi, 240), { stroke: C.cell });
      p.dot(x, cell.vCell(x), C.water);
    },
  });
}

// Lithiumkonto als Wasserfall (senkrechte Balken): Kathode im Betrieb, + Bonus, (+ Praelithiierung), - SEI,
// = Lithium im Betrieb. Die gestrichelte Linie ist der Platz in der Kathode.
function drawAccount(container, acc) {
  const W = 360;
  const H = 240;
  const m = { l: 40, r: 10, t: 24, b: 46 };
  const top = acc.firstCharge + acc.prelith;
  const yMax = Math.ceil(top + 0.6);
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
    { name: ['cathode', 'in operation'], from: 0, to: acc.qCathRev, color: C.cathode, total: true },
    { name: ['formation', 'bonus'], from: acc.qCathRev, to: acc.firstCharge, color: C.anode },
  ];
  if (acc.prelith > 1e-9) bars.push({ name: ['prelithi-', 'ation'], from: acc.firstCharge, to: top, color: C.metal });
  bars.push({ name: ['SEI'], from: top, to: acc.li, color: C.warn });
  bars.push({ name: ['lithium', 'in operation'], from: 0, to: acc.li, color: C.water, total: true });
  const slot = (W - m.l - m.r) / bars.length;
  bars.forEach((b, i) => {
    const x0 = m.l + i * slot + slot * 0.18;
    const w = slot * 0.64;
    const lo = Math.min(b.from, b.to);
    const hi = Math.max(b.from, b.to);
    svg.append(el('rect', { x: x0, y: py(hi), width: w, height: Math.max(1, py(lo) - py(hi)), fill: b.color, rx: 2 }));
    const delta = b.to - b.from;
    const text = b.total ? fmt(b.to) : delta >= 0 ? `+${fmt(delta)}` : `−${fmt(-delta)}`;
    svg.append(el('text', { x: x0 + w / 2, y: py(hi) - 5, fill: C.text, 'font-size': 11, 'font-weight': 600, 'text-anchor': 'middle' }, text));
    b.name.forEach((line, j) => svg.append(el('text', { x: x0 + w / 2, y: H - m.b + 14 + j * 12, fill: C.muted, 'font-size': 10, 'text-anchor': 'middle' }, line)));
    if (i < bars.length - 1) {
      svg.append(el('line', { x1: x0 + w, x2: x0 + slot, y1: py(b.to), y2: py(b.to), stroke: C.muted, 'stroke-dasharray': '2 2' }));
    }
  });
  // Platz in der Kathode zum Vergleich: Lithium unter der Linie heisst Luecke in der Kathode
  svg.append(el('line', { x1: m.l, x2: W - m.r, y1: py(acc.qCathRev), y2: py(acc.qCathRev), stroke: C.cathode, 'stroke-dasharray': '5 4', opacity: 0.7 }));
  // Legende oben links, wo keine Balken stehen
  svg.append(el('line', { x1: m.l + 6, x2: m.l + 26, y1: 10, y2: 10, stroke: C.cathode, 'stroke-dasharray': '5 4', opacity: 0.85 }));
  svg.append(el('text', { x: m.l + 30, y: 10, fill: C.cathode, 'font-size': 10, 'dominant-baseline': 'middle', opacity: 0.9 }, 'room in the cathode'));
}

/* Blend (Tab 5) ------------------------------------------------------------------------------- */
const BLEND_PX_PER_V = 380;

// Tankprofil einer Blend-Komponente: Breite ~ dQ/dU, ueber ein kleines Spannungsfenster geglaettet und gedeckelt
function blendProfile(U, q, cap) {
  const n = 200;
  const pts = [];
  for (let i = 0; i <= n; i += 1) pts.push({ f: i / n, u: U(i / n) });
  const h = 0.008;
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
    p.w = Math.max(14, Math.min(cap, (2.6 * q * (fHi - fLo)) / Math.max(uHi - uLo, 0.002)));
  }
  return pts.filter((p) => p.u <= U_RANGE && p.u >= 0);
}

function drawBlendTanks(container, blend, q) {
  const W = 360;
  const top = 30;
  const y = (u) => top + u * BLEND_PX_PER_V;
  const H = top + U_RANGE * BLEND_PX_PER_V + 34;
  const svg = svgRoot(container, W, H, 'Silicon and graphite tanks of a blended anode, connected at the bottom');
  svg.append(el('rect', { x: 8, y: top - 8, width: W - 16, height: 8, fill: C.metal, opacity: 0.5 }));
  svg.append(el('line', { x1: 8, x2: W - 8, y1: top, y2: top, stroke: C.metal, 'stroke-width': 1.5 }));
  svg.append(el('text', { x: W / 2, y: top - 12, fill: C.muted, 'font-size': 11, 'text-anchor': 'middle' }, 'ceiling = Li/Li⁺ (0 V)'));
  const uS = blend.U(q);
  const fills = blend.split(q);
  const centers = [100, 250];
  const bottoms = [];
  blend.parts.forEach((part, i) => {
    if (part.share <= 1e-6) return;
    const pts = blendProfile(part.U, part.share * Q_BLEND, 150);
    const cx = centers[i];
    const L = (p) => (cx - p.w / 2).toFixed(1);
    const R = (p) => (cx + p.w / 2).toFixed(1);
    const Y = (p) => y(p.u).toFixed(1);
    const wet = pts.filter((p) => p.u >= uS);
    if (fills[i] > 0 && wet.length) {
      const sw = wet[wet.length - 1].w;
      const water = [`M${R(wet[0])} ${Y(wet[0])}`, ...wet.map((p) => `L${R(p)} ${Y(p)}`), `L${(cx + sw / 2).toFixed(1)} ${y(uS).toFixed(1)}`,
        `L${(cx - sw / 2).toFixed(1)} ${y(uS).toFixed(1)}`, ...[...wet].reverse().map((p) => `L${L(p)} ${Y(p)}`), 'Z'];
      svg.append(el('path', { d: water.join(''), fill: C.water, opacity: 0.85 }));
    }
    const last = pts[pts.length - 1];
    const wall = [`M${L(last)} ${(y(last.u) - 3).toFixed(1)}`, ...[...pts].reverse().map((p) => `L${L(p)} ${Y(p)}`),
      ...pts.map((p) => `L${R(p)} ${Y(p)}`), `L${R(last)} ${(y(last.u) - 3).toFixed(1)}`];
    svg.append(el('path', { d: wall.join(''), fill: 'none', stroke: part.color, 'stroke-width': 2.5, 'stroke-linejoin': 'round' }));
    bottoms.push({ cx, y: y(pts[0].u) });
    // Beschriftung neben dem Rohr, damit sie nicht darauf liegt
    svg.append(el('text', { x: i === 0 ? cx - 12 : cx + 12, y: Math.min(H - 4, y(pts[0].u) + 18), fill: part.color, 'font-size': 12, 'font-weight': 600, 'text-anchor': i === 0 ? 'end' : 'start' }, `${part.name} ${pct(fills[i])}`));
  });
  // Rohr am Boden: verbindet die Tanks, deshalb ist der Pegel in beiden gleich hoch
  if (bottoms.length === 2) {
    const yp = Math.max(bottoms[0].y, bottoms[1].y) + 12;
    const d = `M${bottoms[0].cx} ${bottoms[0].y}L${bottoms[0].cx} ${yp}L${bottoms[1].cx} ${yp}L${bottoms[1].cx} ${bottoms[1].y}`;
    svg.append(el('path', { d, fill: 'none', stroke: C.tank, 'stroke-width': 9, 'stroke-linejoin': 'round', opacity: 0.5 }));
    svg.append(el('path', { d, fill: 'none', stroke: C.water, 'stroke-width': 5, 'stroke-linejoin': 'round', opacity: q > 0 ? 0.9 : 0 }));
  }
  // gemeinsamer Pegel und Potenzial
  svg.append(el('line', { x1: 16, x2: W - 16, y1: y(uS), y2: y(uS), stroke: C.muted, 'stroke-dasharray': '3 3' }));
  const xv = 150;
  svg.append(el('line', { x1: xv, x2: xv, y1: top, y2: y(uS), stroke: C.cell, 'stroke-width': 1.5 }));
  svg.append(el('text', { x: xv + 6, y: Math.max(top + 14, (top + y(uS)) / 2), fill: C.cell, 'font-size': 12, 'font-weight': 700, 'dominant-baseline': 'middle' }, `${fmt(uS, 2)} V`));
}

function drawBlendPotential(container, blend, q) {
  chart(container, {
    label: 'Potential of the blended anode over its lithium content',
    xMax: Q_BLEND, yMin: 0, yMax: U_RANGE, xTitle: 'lithium in the anode [Ah]', yTitle: 'potential vs Li/Li⁺ [V]', height: 240,
    draw(p) {
      p.line(sample((x) => blend.U(x / Q_BLEND), 0, Q_BLEND * 0.999, 300), { stroke: C.cell });
      p.dot(q * Q_BLEND, blend.U(q), C.water);
    },
  });
}

function drawBlendSplit(container, blend, q) {
  chart(container, {
    label: 'How the lithium splits between silicon and graphite',
    xMax: Q_BLEND, yMin: 0, yMax: Q_BLEND, xTitle: 'lithium in the anode [Ah]', yTitle: 'lithium per material [Ah]', height: 240,
    draw(p) {
      blend.parts.forEach((part, i) => {
        p.line(sample((x) => part.share * Q_BLEND * blend.split(x / Q_BLEND)[i], 0, Q_BLEND * 0.999, 200), { stroke: part.color });
        p.dot(q * Q_BLEND, part.share * Q_BLEND * blend.split(q)[i], part.color);
      });
      p.label(0.3, Q_BLEND * 0.9, 'graphite', C.anode);
      p.label(0.3, Q_BLEND * 0.8, 'silicon', '#c39bd3');
    },
  });
}

function drawDqdv(container, d) {
  // Oben in voller Hoehe: Blend und der geschaetzte Graphit, damit man die Graphitpeaks wirklich anpassen kann.
  // Unten eigener Massstab: was fuer das Silizium uebrig bleibt.
  const top = document.createElement('div');
  const bottom = document.createElement('div');
  container.replaceChildren(top, bottom);
  const pts = (arr) => d.grid.map((u, i) => [u, arr[i]]);
  const yTop = Math.ceil(Math.max(...d.blendCurve, ...d.graphite) * 1.08);
  chart(top, {
    label: 'dQ/dV of the blend and of your graphite share',
    xMax: U_RANGE, yMin: 0, yMax: yTop, xTitle: 'potential vs Li/Li⁺ [V]', yTitle: 'dQ/dV [Ah/V]', height: 240,
    draw(p) {
      p.line(pts(d.blendCurve), { stroke: C.cell, 'stroke-width': 2.5 });
      p.line(pts(d.graphite), { stroke: C.anode, 'stroke-dasharray': '5 4', 'stroke-width': 2 });
      p.label(0.42, yTop * 0.85, 'blend', C.cell);
      p.label(0.42, yTop * 0.72, 'your graphite', C.anode);
    },
  });
  const yRest = Math.ceil(Math.max(...d.si) * 2.2);
  chart(bottom, {
    label: 'Remainder: blend minus your graphite',
    xMax: U_RANGE, yMin: -yRest, yMax: yRest, xTitle: 'potential vs Li/Li⁺ [V]', yTitle: 'remainder [Ah/V]', height: 200,
    draw(p) {
      p.hline(0, null, C.muted, '2 3');
      p.line(pts(d.si), { stroke: '#c39bd3', 'stroke-dasharray': '4 4', 'stroke-width': 1.5, opacity: 0.8 });
      p.line(pts(d.rest), { stroke: C.water, 'stroke-width': 3 });
      p.label(0.42, yRest * 0.8, 'remainder', C.water);
      p.label(0.42, yRest * 0.6, 'true silicon', '#c39bd3');
    },
  });
}

/* Tools ---------------------------------------------------------------------------------------- */
const Q_CATH = 10; // Ah, reversible Kapazitaet der Kathode in allen drei Tools

// Echte Kurven (Graphit gegen NMC, fuer den Vergleich auch LFP) aus den Materialdaten der Webseite, einmal geladen
let realPromise = null;
let REAL = null;
let LFP = null;
let SILICON = null;
function loadReal() {
  realPromise ||= Promise.all([loadMaterial('Graphite'), loadMaterial('NMC'), loadMaterial('LFP'), loadMaterial('Silicon')])
    .then(([graphite, nmc, lfp, silicon]) => {
      REAL = { anode: realElectrode(graphite), cathode: realElectrode(nmc) };
      LFP = realElectrode(lfp);
      SILICON = realElectrode(silicon);
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
  nli: { np: 1.1, bonus: 6, sei: 10, prelith: 0, soc: 0, vmin: 3.0, vmax: 4.2, curves: 'ideal' },
  aging: { lama: 0, lamc: 0, lli: 0, soc: 1, vmin: 3.0, vmax: 4.2, curves: 'ideal' },
  blend: { si: 25, soc: 0.5, curves: 'ideal' },
  dqdv: { guess: 70, curves: 'ideal' },
};

// Blend-Anode (Tab 5): 10 Ah, Silizium- und Graphitanteil an der Kapazitaet
const Q_BLEND = 10;
const DQDV_SILICON = 0.2; // wahrer Siliziumanteil im Zerlegungs-Tool
const U_RANGE = 0.7;      // Potenzialbereich der Blend-Bilder gegen Li/Li+

function blendParts(v, si) {
  const real = v.curves === 'real' && REAL;
  return [
    { name: 'Silicon', share: si, U: real ? SILICON.U : lineU(IDEAL_SILICON), color: '#c39bd3' },
    { name: 'Graphite', share: 1 - si, U: real ? REAL.anode.U : lineU(IDEAL_GRAPHITE), color: C.anode },
  ];
}

// Ausgangszelle fuer die Alterung (Tab 4): N/P = 1.1 und N/Li = 1.2 wie im Quiz
const AGING_BASE = { qCath: 10, qAnode: 11, li: 11 / 1.2 };
const LIMITER = { lithium: 'lithium', cathode: 'cathode tank', anode: 'anode tank' };

// Vergleich NMC und LFP gegen Graphit bei gleichem N/P (Tab 3, fester Vergleich; auch Bild zum Launch-Post).
// Formierung: die SEI bucht bei beiden gleich viel ab; NMC bringt einen grossen Bonus mit, LFP kaum einen.
export const COMPARE = {
  np: 1.1,
  sei: 0.08,
  cells: [
    { key: 'nmc', name: 'NMC vs graphite', bonus: 0.09, vMin: 2.8, vMax: 4.2 },
    { key: 'lfp', name: 'LFP vs graphite', bonus: 0.02, vMin: 2.5, vMax: 3.65 },
  ],
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
    const acc = lithiumAccount({ qCathRev: Q_CATH, npRatio: v.np, bonus: v.bonus / 100, seiRate: v.sei / 100, prelith: v.prelith ?? 0 });
    const cell = idealCell({ qCath: Q_CATH, qAnode: acc.qAnode, li: acc.li, vMin: v.vmin, vMax: v.vmax, ...electrodes(v) });
    const status = cell.platedAtVmax > 1e-6 ? `plating! ${fmt(cell.platedAtVmax)} Ah`
      : cell.ceilingAtVmax ? 'at the ceiling!' : pct(cell.fillAnode(cell.xMax));
    return {
      cell, acc, xAxis: 16,
      readouts: {
        li: `${fmt(acc.li)} Ah`, nli: fmt(acc.nLi), gap: `${fmt(cell.cathodeGap)} Ah`,
        anodeVmax: status,
        limit: acc.lithiumLimits ? 'lithium' : 'cathode tank',
        capacity: `${fmt(cell.capacity)} Ah`,
      },
      warn: cell.ceilingAtVmax,
      link: realLink(v.np, acc.li / Q_CATH, v.soc),
    };
  },
  blend(v) {
    const blend = blendElectrode(blendParts(v, v.si / 100));
    const q = Math.min(0.999, Math.max(0, v.soc));
    const fills = blend.split(q);
    const amounts = blend.parts.map((p, i) => p.share * Q_BLEND * fills[i]);
    return {
      blend, q,
      render(parts) {
        if (parts.blendtanks) drawBlendTanks(parts.blendtanks, blend, q);
        if (parts.potential) drawBlendPotential(parts.potential, blend, q);
        if (parts.split) drawBlendSplit(parts.split, blend, q);
      },
      readouts: {
        potential: `${fmt(blend.U(q), 3)} V`,
        silicon: `${fmt(amounts[0])} Ah`,
        graphite: `${fmt(amounts[1])} Ah`,
      },
    };
  },
  dqdv(v) {
    const parts = blendParts(v, DQDV_SILICON);
    const grid = Array.from({ length: 351 }, (_, i) => 0.02 + (i * (U_RANGE - 0.02)) / 350);
    const si = dqdv(parts[0].U, parts[0].share * Q_BLEND, grid);
    const gr1 = dqdv(parts[1].U, Q_BLEND, grid); // reiner Graphit, 10 Ah
    const blendCurve = grid.map((_, i) => si[i] + (1 - DQDV_SILICON) * gr1[i]);
    const w = v.guess / 100;
    const rest = grid.map((_, i) => blendCurve[i] - w * gr1[i]);
    const truth = 1 - DQDV_SILICON;
    const status = Math.abs(w - truth) < 0.005 ? 'clean: that is the silicon'
      : w > truth ? 'dips below zero: too much graphite' : 'graphite peaks left over: too little';
    return {
      render(p) {
        if (p.dqdv) drawDqdv(p.dqdv, { grid, blendCurve, graphite: gr1.map((g) => w * g), rest, si });
      },
      readouts: { guess: `${Math.round(w * 100)} %`, status },
      warn: Math.abs(w - truth) >= 0.005,
    };
  },
  aging(v) {
    const fresh = idealCell({ ...AGING_BASE, vMin: v.vmin, vMax: v.vmax, ...electrodes(v) });
    const aged = agedBalance({ ...AGING_BASE, lamAnode: v.lama / 100, lamCath: v.lamc / 100, lli: v.lli / 100 });
    const cell = idealCell({ qCath: aged.qCath, qAnode: aged.qAnode, li: aged.li, vMin: v.vmin, vMax: v.vmax, ...electrodes(v) });
    return {
      cell, ref: fresh, xAxis: 12,
      readouts: {
        capacity: `${fmt(cell.capacity)} Ah of ${fmt(fresh.capacity)} Ah`,
        loss: pct(1 - cell.capacity / fresh.capacity),
        limit: LIMITER[aged.scarcest],
        np: fmt(aged.np),
        nli: fmt(aged.nLi),
      },
      warn: cell.platedAtVmax > 1e-6,
      link: realLink(aged.np, aged.li / aged.qCath, v.soc),
    };
  },
};

function drawParts(parts, out, x, opts = {}) {
  const { cell } = out;
  if (parts.tanks) drawTanks(parts.tanks, cell, x, opts);
  if (parts.electrodes) drawElectrodes(parts.electrodes, cell, x, out.xAxis);
  if (parts.cell) drawCell(parts.cell, cell, x, out.xAxis, out.ref);
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
  const holder = fig.querySelector('[data-figure-parts]');
  const parts = {};
  for (const name of fig.dataset.show.split(',')) {
    parts[name] = document.createElement('div');
    holder.append(parts[name]);
  }
  if (out.render) {
    out.render(parts);
    return;
  }
  const x = out.cell.xMin + values.soc * out.cell.capacity;
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
    blendtanks: root.querySelector('[data-blendtanks]'),
    potential: root.querySelector('[data-potential]'),
    split: root.querySelector('[data-split]'),
    dqdv: root.querySelector('[data-dqdv]'),
  };
  const link = root.querySelector('[data-real-link]');
  let frame = 0;
  let used = false;

  function render() {
    frame = 0;
    // Regler, die ein Tool nicht hat (z. B. Vmin/Vmax bei der Alterung), kommen aus den Startwerten
    const values = { ...DEFAULTS[root.dataset.chapterTool], ...controls.values() };
    if (values.curves === 'real' && !REAL) {
      loadReal().then(render).catch(() => {});
      return;
    }
    const out = compute(values);
    if (out.render) out.render(parts);
    else drawParts(parts, out, out.cell.xMin + values.soc * out.cell.capacity);
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

// Fester Vergleich NMC und LFP gegen Graphit (gleiches N/P, Zelle bei Vmax): Tanks nebeneinander
export function compareCells() {
  return COMPARE.cells.map((c) => {
    const acc = lithiumAccount({ qCathRev: Q_CATH, npRatio: COMPARE.np, bonus: c.bonus, seiRate: COMPARE.sei });
    const cathode = c.key === 'lfp' ? LFP : REAL.cathode;
    const cell = idealCell({ qCath: Q_CATH, qAnode: acc.qAnode, li: acc.li, vMin: c.vMin, vMax: c.vMax, anode: REAL.anode, cathode });
    return { ...c, acc, cell, fill: cell.fillAnode(cell.xMax) };
  });
}

// Fuellgrad der Anode bei Vmax als grosser Balken: im Tankbild ist der Unterschied mit blossem Auge kaum zu sehen
function drawFillGauge(container, fill) {
  const W = 360;
  const H = 74;
  const x0 = 16;
  const x1 = W - 16;
  const svg = svgRoot(container, W, H, `Anode filled to ${pct(fill)} at Vmax`);
  const xf = x0 + (x1 - x0) * Math.min(1, fill);
  svg.append(el('text', { x: x0, y: 16, fill: C.text, 'font-size': 12, 'font-weight': 600 }, 'Anode at Vmax'));
  svg.append(el('text', { x: x1, y: 16, fill: C.muted, 'font-size': 11, 'text-anchor': 'end' }, `room to the ceiling: ${pct(1 - fill)}`));
  svg.append(el('rect', { x: x0, y: 26, width: x1 - x0, height: 26, rx: 4, fill: 'rgb(255 255 255 / 0.10)', stroke: C.anode, 'stroke-width': 1.5 }));
  svg.append(el('rect', { x: x0, y: 26, width: xf - x0, height: 26, rx: 4, fill: C.water, opacity: 0.9 }));
  svg.append(el('text', { x: xf - 8, y: 44, fill: '#003b73', 'font-size': 15, 'font-weight': 700, 'text-anchor': 'end' }, pct(fill)));
  svg.append(el('line', { x1, x2: x1, y1: 22, y2: 58, stroke: C.metal, 'stroke-width': 2 }));
  svg.append(el('text', { x: x1, y: 70, fill: C.muted, 'font-size': 10, 'text-anchor': 'end' }, 'full = ceiling'));
}

async function initCompare(fig) {
  await loadReal();
  const holder = fig.querySelector('[data-figure-parts]');
  holder.replaceChildren();
  const legacy = Boolean(fig.closest('.og--post'));
  const gauges = document.createElement('div');
  gauges.className = 'ch-compare__gauges';
  const tanksRow = document.createElement('div');
  tanksRow.className = 'ch-compare__tanks';
  for (const c of compareCells()) {
    const part = document.createElement('div');
    part.className = 'ch-compare__cell';
    const head = document.createElement('p');
    head.className = 'ch-compare__name';
    head.textContent = c.name;
    const facts = document.createElement('p');
    facts.className = 'ch-compare__facts';
    facts.textContent = `N/P ${fmt(COMPARE.np)} · N/Li ${fmt(c.acc.nLi)}`;
    const gauge = document.createElement('div');
    gauge.className = 'ch-compare__gauge';
    drawFillGauge(gauge, c.fill);
    if (legacy) {
      // Vorlage fuer das Post-Bild (config/og/render.html): Tanks und Balken je Zelle untereinander
      const tanks = document.createElement('div');
      drawTanks(tanks, c.cell, c.cell.xMax);
      part.append(head, tanks, gauge, facts);
      holder.append(part);
      continue;
    }
    part.append(head, gauge, facts);
    gauges.append(part);
    const tank = document.createElement('figure');
    tank.className = 'ch-compare__tank';
    const label = document.createElement('figcaption');
    label.textContent = c.name;
    const tanks = document.createElement('div');
    drawTanks(tanks, c.cell, c.cell.xMax);
    tank.append(label, tanks);
    tanksRow.append(tank);
  }
  if (!legacy) holder.append(gauges, tanksRow);
}

initTabs();
initQuiz();
for (const root of document.querySelectorAll('[data-chapter-tool]')) initTool(root);
for (const fig of document.querySelectorAll('[data-chapter-figure]')) initFigure(fig).catch(() => {});
for (const fig of document.querySelectorAll('[data-chapter-compare]')) initCompare(fig).catch(() => {});

// Fuer Pruefungen ohne Browser (Zeichnen in eine Attrappe des DOM)
export { DEFAULTS, drawAccount, drawCell, drawElectrodes, drawTanks, TOOLS, REAL, loadReal };
