// Erzeugt assets/data/chapter-materials.json fuer das Kapitel Materials (/blog/materials/).
// Aufruf: node scripts/build-chapter-materials.mjs
//
// Format je Material: { name, kind, q (mAh/g im Fenster), qTheo, source, placeholder, variants: [{ label, q, x, uIn, uOut }] }
// x = Fuellgrad 0..1 (Lithium im Material, bezogen auf q), uIn = Spannung beim Lithiieren, uOut = beim Delithiieren,
// beide gegen Li/Li+. Die Spannung faellt mit x (leer = tief im Tank, voll = nah an der Decke).
//
// PLATZHALTER: Kurven mit placeholder: true sind schematisch oder kalibriert, bis echte Daten digitalisiert sind
// (Rohbilder in data-sources/curves/canrd/). Die Tool-Kurven unter assets/data/materials/ bleiben unveraendert.
import { readFileSync, writeFileSync } from 'node:fs';

const N = 161;
const grid = Array.from({ length: N }, (_, i) => i / (N - 1));
const r4 = (v) => Math.round(v * 1e4) / 1e4;

function interp(xs, ys, x) {
  if (x <= xs[0]) return ys[0];
  for (let i = 1; i < xs.length; i += 1) {
    if (xs[i] >= x) {
      const t = (x - xs[i - 1]) / (xs[i] - xs[i - 1] || 1);
      return ys[i - 1] + t * (ys[i] - ys[i - 1]);
    }
  }
  return ys[ys.length - 1];
}

// Kurve aus den Materialdaten der Webseite (SoL_prac = Fuellgrad im praktischen Fenster)
function fromSite(file) {
  const d = JSON.parse(readFileSync(new URL(`../assets/data/materials/${file}`, import.meta.url), 'utf8'));
  const xs = d.data.map((r) => r.SoL_prac);
  const sol = d.data.map((r) => r.SoL);
  const anode = d.kind === 'Anode';
  // Lithiieren: Anode beim Laden der Zelle (OCV_cha), Kathode beim Entladen (OCV_dis)
  const inKey = anode ? 'OCV_cha' : 'OCV_dis';
  const outKey = anode ? 'OCV_dis' : 'OCV_cha';
  const q = d.q_theo_mAhg * (interp(xs, sol, 1) - interp(xs, sol, 0));
  return {
    kind: d.kind.toLowerCase(), qTheo: d.q_theo_mAhg, q,
    uIn: (x) => interp(xs, d.data.map((r) => r[inKey]), x),
    uOut: (x) => interp(xs, d.data.map((r) => r[outKey]), x),
  };
}

function variant(label, q, uIn, uOut = uIn) {
  return { label, q: Math.round(q), x: grid.map(r4), uIn: grid.map((x) => r4(uIn(x))), uOut: grid.map((x) => r4(uOut(x))) };
}

const sig = (z) => 1 / (1 + Math.exp(-z));
const out = {};

// Lithiummetall: keine Kurve, die Decke selbst
out.lithium = { name: 'Lithium metal', kind: 'anode', q: 3860, qTheo: 3860, source: 'theoretical capacity', placeholder: false, variants: [] };

for (const [slug, name, file] of [['graphite', 'Graphite', 'graphite.json'], ['silicon', 'Silicon', 'silicon.json'], ['lfp', 'LFP', 'lfp.json']]) {
  const s = fromSite(file);
  out[slug] = { name, kind: s.kind, q: Math.round(s.q), qTheo: s.qTheo, source: 'chargetanks material data (assets/data/materials)', placeholder: false, variants: [variant(name, s.q, s.uIn, s.uOut)] };
}

// LTO: schematisch, Plateau 1,55 V, Zwei-Phasen, winzige Hysterese
{
  const u = (x) => 1.55 - 0.02 * (x - 0.5) + 0.45 * Math.exp(-x / 0.025) - 0.45 * Math.exp(-(1 - x) / 0.025);
  out.lto = { name: 'LTO', kind: 'anode', q: 175, qTheo: 175, source: 'schematic: plateau 1.55 V, 175 mAh/g', placeholder: true,
    variants: [variant('LTO', 175, (x) => u(x) - 0.005, (x) => u(x) + 0.005)] };
}

// LMFP: schematisch, Mn-Plateau ca. 4,1 V (zuerst beim Lithiieren), Fe-Plateau ca. 3,45 V. Canrd-Probe: Mn 19,74 wt%,
// Fe 13,4 wt% -> Mn/(Mn+Fe) = 0,60; Kapazitaet 156 mAh/g (0,1C, 2,5-4,5 V).
{
  const lmfp = (m) => (x) => 3.45 - 0.05 * (x - 1) + 0.62 * sig((m - x) / 0.02) - 0.03 * (m - x) * (x < m)
    + 0.35 * Math.exp(-x / 0.02) - 0.6 * Math.exp(-(1 - x) / 0.02);
  out.lmfp = { name: 'LMFP', kind: 'cathode', q: 156, qTheo: 170, source: 'schematic, Mn share 0.6 from Canrd composition, 156 mAh/g (Canrd 0.1C)', placeholder: true,
    defaultVariant: 2,
    variants: [0.4, 0.5, 0.6, 0.7, 0.8].map((m) => variant(`Mn ${Math.round(m * 100)} %`, 156, (x) => lmfp(m)(x) - 0.02, (x) => lmfp(m)(x) + 0.02)) };
}

// NMC-Reihe: Platzhalter. Form von nmc.json (entspricht NCM811, 207 mAh/g), fuer jede Stufe so gestreckt, dass
// das Fenster 3,0-4,3 V die Canrd-Kapazitaet ergibt. Theoretisch fassen alle Stufen ca. 275 mAh/g.
{
  const base = fromSite('nmc.json');
  const nca = fromSite('nca.json');
  const QT = 274;
  const stages = [['NMC111', 155], ['NMC523', 162], ['NMC622', 173], ['NMC811', base.q], ['Ni90', 221]];
  const variants = stages.map(([label, cap]) => variant(label, cap, base.uIn));
  variants.push(variant('NCA', nca.q, nca.uIn));
  out.nmc = { name: 'NMC/NCA', kind: 'cathode', q: Math.round(base.q), qTheo: QT,
    source: 'placeholder: shape of chargetanks NMC curve, stretched to Canrd capacities at 3.0-4.3 V, 0.1C (NCA: chargetanks NCA curve)',
    placeholder: true, defaultVariant: 3, variants };
}

// LCO: PyBaMM Ai2020 (Rieger 2016), Stoechiometrie 0,4-1 -> Fenster bis 4,39 V
{
  const rows = readFileSync(new URL('../data-sources/pybamm/lico2_ocp_Ai2020.csv', import.meta.url), 'utf8')
    .split('\n').filter((l) => l && !l.startsWith('#')).map((l) => l.split(',').map(Number)).sort((a, b) => a[0] - b[0]);
  const sto = rows.map((r) => r[0]);
  const U = rows.map((r) => r[1]);
  const lo = sto[0];
  const u = (x) => interp(sto, U, lo + x * (1 - lo));
  out.lco = { name: 'LCO', kind: 'cathode', q: Math.round(274 * (1 - lo)), qTheo: 274, source: 'PyBaMM Ai2020 (Rieger 2016), x 0.4-1', placeholder: true,
    variants: [variant('LCO', 274 * (1 - lo), u)] };
}

writeFileSync(new URL('../assets/data/chapter-materials.json', import.meta.url), `${JSON.stringify(out)}\n`);
console.log(Object.entries(out).map(([k, v]) => `${k}: ${v.q} mAh/g, ${v.variants.length} variant(s)${v.placeholder ? ' [placeholder]' : ''}`).join('\n'));
