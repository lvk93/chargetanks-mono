// Ideale Tanks (konstanter Querschnitt) fuer das Kapitel "Lithium balance": jede Elektrode ist eine Gerade
// zwischen "leer" und "voll" (Spannung gegen Li/Li+). Ohne DOM, damit es sich testen laesst.
//
// Groessen in Ah:
//   qCath  reversible Kapazitaet der Kathode (Platz im Kathodentank)
//   qAnode Kapazitaet der Anode (Platz im Anodentank)
//   li     zyklisierbares Lithium (Wasser, das mitspielt)
// Laufvariable x = Lithium in der Anode. Entladen heisst x klein, geladen x gross.

// Gewaehlt so, dass N/P knapp unter 1 vor Vmax = 4.2 V platet und die Anode voll knapp unter der Decke steht
export const IDEAL_CATHODE = { empty: 4.3, full: 3.6 };
export const IDEAL_ANODE = { empty: 0.6, full: 0.08 };

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

export function idealCell({ qCath, qAnode, li, vMin, vMax, cathode = IDEAL_CATHODE, anode = IDEAL_ANODE }) {
  // Physikalischer Bereich: Kathode kann hoechstens qCath aufnehmen, Anode kann hoechstens li bekommen
  const xLo = Math.max(0, li - qCath);
  const xHi = li;
  const fillCath = (x) => (li - x) / qCath;
  const fillAnode = (x) => x / qAnode;
  const uCath = (x) => potential(cathode, fillCath(x));
  // Ueber dem Rand des Anodentanks klebt der Pegel an der Decke (0 V): Lithium-Plating
  const uAnode = (x) => (fillAnode(x) > 1 + 1e-12 ? 0 : potential(anode, fillAnode(x)));
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
    fillCath, fillAnode, uCath, uAnode, vCell, plated,
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

// Lithiumkonto der Formierung (Tab N/Li). bonus und seiRate als Anteile (0..1).
//   Erste Ladung der Kathode = qCathRev * (1 + bonus); die SEI bucht seiRate * qAnode ab.
export function lithiumAccount({ qCathRev, npRatio, bonus, seiRate }) {
  const qAnode = npRatio * qCathRev;
  const bonusAh = qCathRev * bonus;
  const firstCharge = qCathRev + bonusAh;
  const sei = seiRate * qAnode;
  const li = firstCharge - sei;
  return { qCathRev, qAnode, bonusAh, firstCharge, sei, li, nLi: qAnode / li, lithiumLimits: sei >= bonusAh };
}
