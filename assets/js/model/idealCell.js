// Ideale Tanks (konstanter Querschnitt) fuer das Kapitel "Lithium balance": jede Elektrode ist eine Gerade
// zwischen "leer" und "voll" (Spannung gegen Li/Li+). Ohne DOM, damit es sich testen laesst.
//
// Groessen in Ah:
//   qCath  reversible Kapazitaet der Kathode (Platz im Kathodentank)
//   qAnode Kapazitaet der Anode (Platz im Anodentank)
//   li     zyklisierbares Lithium (Wasser, das mitspielt)
// Laufvariable x = Lithium in der Anode. Entladen heisst x klein, geladen x gross.

// Die volle Anode reicht bis an die Decke (0 V): Wird sie voll, laeuft das Wasser ueber (Plating), ohne dass die
// Zellspannung springt. Kathode oben 4.25 V, damit bei Vmax = 4.2 V gilt: N/P 1.1 wird oben von der leeren Kathode
// begrenzt (N/P_cap = N/P_fill), ab N/P ~0.92 erreicht die Anode die Decke, und das Alterungs-Quiz verliert 2 %.
export const IDEAL_CATHODE = { empty: 4.25, full: 3.6 };
export const IDEAL_ANODE = { empty: 0.6, full: 0 };

// Spannung gegen Li/Li+ bei Fuellgrad 0..1 (Gerade: Steigung = 1/Querschnitt)
export function potential(tank, fill) {
  return tank.empty - (tank.empty - tank.full) * fill;
}

function bisect(f, lo, hi, target) {
  let a = lo;
  let b = hi;
  for (let i = 0; i < 60; i += 1) {
    const m = (a + b) / 2;
    if (f(m) < target) a = m;
    else b = m;
  }
  return (a + b) / 2;
}

// Elektrode als Funktion Fuellgrad -> Spannung: ideale Gerade (Objekt mit empty/full) oder echte Kurve ({ U })
export function electrodeU(electrode) {
  return typeof electrode.U === 'function' ? electrode.U : (fill) => potential(electrode, fill);
}

// Echte Halbzellkurve aus den Materialdaten (SoL_prac -> OCV, linear interpoliert, am Rand festgehalten)
export function realElectrode(material, direction = 'cha') {
  const pairs = Array.from(material.data.SoL_prac, (s, i) => [s, material.data[`OCV_${direction}`][i]])
    .sort((a, b) => a[0] - b[0]);
  const xs = pairs.map((p) => p[0]);
  const ys = pairs.map((p) => p[1]);
  const U = (f) => {
    if (f <= xs[0]) return ys[0];
    if (f >= xs[xs.length - 1]) return ys[ys.length - 1];
    let lo = 0;
    let hi = xs.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (xs[mid] <= f) lo = mid;
      else hi = mid;
    }
    const t = (f - xs[lo]) / (xs[hi] - xs[lo] || 1);
    return ys[lo] + t * (ys[hi] - ys[lo]);
  };
  return { name: material.name, U };
}

export function idealCell({ qCath, qAnode, li, vMin, vMax, cathode = IDEAL_CATHODE, anode = IDEAL_ANODE }) {
  const cathodeU = electrodeU(cathode);
  const anodeU = electrodeU(anode);
  // Physikalischer Bereich: Kathode kann hoechstens qCath aufnehmen, Anode kann hoechstens li bekommen
  const xLo = Math.max(0, li - qCath);
  const xHi = li;
  const fillCath = (x) => (li - x) / qCath;
  const fillAnode = (x) => x / qAnode;
  const uCath = (x) => cathodeU(fillCath(x));
  // Ueber dem Rand des Anodentanks klebt der Pegel an der Decke (0 V): Lithium-Plating
  const uAnode = (x) => (fillAnode(x) > 1 + 1e-12 ? 0 : Math.max(0, anodeU(fillAnode(x))));
  const vCell = (x) => uCath(x) - uAnode(x);
  const plated = (x) => Math.max(0, x - qAnode);

  // vCell steigt monoton mit x (Kathode leert sich, Anode fuellt sich)
  const xMin = vCell(xLo) >= vMin ? xLo : vCell(xHi) < vMin ? xHi : bisect(vCell, xLo, xHi, vMin);
  const xMax = vCell(xHi) <= vMax ? xHi : vCell(xLo) > vMax ? xLo : bisect(vCell, xLo, xHi, vMax);
  const capacity = Math.max(0, xMax - xMin);

  // Wer limitiert unten bzw. oben (fuer die Beschriftung)
  const lowLimit = xMin > xLo + 1e-9 ? 'vmin' : li > qCath ? 'cathode-full' : 'anode-empty';
  const highLimit = xMax < xHi - 1e-9 ? 'vmax' : 'cathode-empty';

  return {
    qCath, qAnode, li, vMin, vMax, xLo, xHi, xMin, xMax, capacity, lowLimit, highLimit,
    fillCath, fillAnode, uCath, uAnode, vCell, plated, cathodeU, anodeU,
    real: typeof cathode.U === 'function',
    npCap: qAnode / qCath,
    // Anode bei Vmax: wie viel Platz bleibt bis zur Decke?
    npFill: xMax > 0 ? qAnode / xMax : Infinity,
    platedAtVmax: plated(xMax),
    // Anodenpegel erreicht bis Vmax die Decke: ab hier wird Lithium als Metall abgeschieden
    ceilingAtVmax: fillAnode(xMax) >= 1 - 1e-6,
    // Platz, der in der Kathode beim Entladen leer bleibt
    cathodeGap: Math.max(0, qCath - (li - xMin)),
  };
}

// Lithiumkonto der Formierung (Tab N/Li). bonus und seiRate als Anteile (0..1), prelith in Ah.
//   Erste Ladung der Kathode = qCathRev * (1 + bonus); die SEI bucht seiRate * qAnode ab;
//   Praelithiierung zahlt prelith Ah zusaetzlich ein.
export function lithiumAccount({ qCathRev, npRatio, bonus, seiRate, prelith = 0 }) {
  const qAnode = npRatio * qCathRev;
  const bonusAh = qCathRev * bonus;
  const firstCharge = qCathRev + bonusAh;
  const sei = seiRate * qAnode;
  const li = firstCharge + prelith - sei;
  return {
    qCathRev, qAnode, bonusAh, firstCharge, prelith, sei, li, nLi: qAnode / li,
    // Lithium ist der knappste Posten, solange die SEI mehr abbucht, als Bonus und Praelithiierung einzahlen
    lithiumLimits: sei >= bonusAh + prelith,
  };
}

// Alterungsmodi (Tab 4): Verluste als Anteile (0..1). Gealterte Groessen und der knappste Posten.
export function agedBalance({ qCath, qAnode, li, lamCath = 0, lamAnode = 0, lli = 0 }) {
  const out = {
    qCath: (1 - lamCath) * qCath,
    qAnode: (1 - lamAnode) * qAnode,
    li: (1 - lli) * li,
  };
  const items = [['lithium', out.li], ['cathode', out.qCath], ['anode', out.qAnode]];
  out.scarcest = items.reduce((a, b) => (b[1] < a[1] - 1e-9 ? b : a))[0];
  out.np = out.qAnode / out.qCath;
  out.nLi = out.qAnode / out.li;
  return out;
}
