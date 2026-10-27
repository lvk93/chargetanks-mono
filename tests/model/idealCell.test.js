// Ideale Tanks des Kapitels "Lithium balance": Grenzfaelle, die in den Texten beschrieben sind.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { agedBalance, idealCell, lithiumAccount } from '../../assets/js/model/idealCell.js';

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

test('Zellspannung = Abstand der beiden Geraden, Vmin/Vmax schneiden die Kapazitaet', () => {
  const c = idealCell({ qCath: 10, qAnode: 12, li: 10, vMin: 3.2, vMax: 4.0 });
  near(c.vCell(c.xMin), 3.2);
  near(c.vCell(c.xMax), 4.0);
  near(c.capacity, c.xMax - c.xMin);
  near(c.vCell(5), c.uCath(5) - c.uAnode(5));
});

test('N/P zu klein: Anode erreicht vor Vmax die Decke, darueber wird Lithium abgeschieden', () => {
  const small = idealCell({ qCath: 10, qAnode: 8, li: 10, vMin: 3.0, vMax: 4.2 });
  assert.ok(small.ceilingAtVmax);
  assert.ok(small.platedAtVmax > 0);
  assert.equal(small.uAnode(9), 0);
  const ok = idealCell({ qCath: 10, qAnode: 11, li: 10, vMin: 3.0, vMax: 4.2 });
  assert.ok(!ok.ceilingAtVmax);
  near(ok.platedAtVmax, 0);
});

test('N/P zu gross: Anode bleibt bei Vmax teilweise leer', () => {
  const c = idealCell({ qCath: 10, qAnode: 15, li: 10, vMin: 3.0, vMax: 4.2 });
  assert.ok(c.fillAnode(c.xMax) < 0.7);
  assert.ok(c.npFill > c.npCap - 1e-9);
});

test('Lithiumkonto: SEI groesser als Bonus -> Lithium limitiert, Luecke in der Kathode', () => {
  const acc = lithiumAccount({ qCathRev: 10, npRatio: 1.2, bonus: 0.06, seiRate: 0.1 });
  near(acc.firstCharge, 10.6);
  near(acc.sei, 1.2);
  near(acc.li, 9.4);
  assert.ok(acc.lithiumLimits);
  const c = idealCell({ qCath: 10, qAnode: acc.qAnode, li: acc.li, vMin: 3.0, vMax: 4.2 });
  assert.equal(c.lowLimit, 'anode-empty');
  near(c.cathodeGap, 0.6);
  // groessere Anode frisst mehr SEI
  assert.ok(lithiumAccount({ qCathRev: 10, npRatio: 1.5, bonus: 0.06, seiRate: 0.1 }).li < acc.li);
});

test('Praelithiierung: Rechenbeispiel aus dem Text (N/P 1.1, N/Li 1.16 -> 1.04)', () => {
  const plain = lithiumAccount({ qCathRev: 10, npRatio: 1.1, bonus: 0.06, seiRate: 0.1 });
  near(plain.li, 9.5);
  assert.equal(plain.nLi.toFixed(2), '1.16');
  const pre = lithiumAccount({ qCathRev: 10, npRatio: 1.1, bonus: 0.06, seiRate: 0.1, prelith: 1.1 });
  near(pre.li, 10.6);
  assert.equal(pre.nLi.toFixed(2), '1.04');
  assert.ok(!pre.lithiumLimits, 'mit Praelithiierung ist Lithium nicht mehr knapp');
  // Puffer zur Decke (bezogen aufs Lithium): 16 % -> 4 %
  assert.equal(Math.round((plain.nLi - 1) * 100), 16);
  assert.equal(Math.round((pre.nLi - 1) * 100), 4);
});

test('Alterung: Quiz (N/P 1.1, N/Li 1.2, 5/3/2 %) verliert 2 % Kapazitaet, Verluste addieren sich nicht', () => {
  const base = { qCath: 10, qAnode: 11, li: 11 / 1.2 };
  const fresh = idealCell({ ...base, vMin: 3.0, vMax: 4.2 });
  const aged = agedBalance({ ...base, lamAnode: 0.05, lamCath: 0.03, lli: 0.02 });
  assert.equal(aged.scarcest, 'lithium');
  const cell = idealCell({ qCath: aged.qCath, qAnode: aged.qAnode, li: aged.li, vMin: 3.0, vMax: 4.2 });
  near(1 - cell.capacity / fresh.capacity, 0.02, 1e-9);
  // gleiche Verluste: Verhaeltnisse bleiben gleich
  const same = agedBalance({ ...base, lamAnode: 0.2, lamCath: 0.2, lli: 0.2 });
  near(same.np, 1.1);
  near(same.nLi, 1.2);
});

test('Blend: Silizium fuellt sich zuerst, Knick am Boden des Graphittanks, danach flachere Steigung', async () => {
  const { blendElectrode, dqdv, IDEAL_GRAPHITE, IDEAL_SILICON, lineU } = await import('../../assets/js/model/blendTanks.js');
  const si = 0.25;
  const b = blendElectrode([{ share: si, U: lineU(IDEAL_SILICON) }, { share: 1 - si, U: lineU(IDEAL_GRAPHITE) }]);
  // Knick: Silizium allein bis 0.25 V, das sind si * (0.6 - 0.25) / (0.6 - 0.05) der Gesamtkapazitaet
  const qKink = (si * (0.6 - 0.25)) / (0.6 - 0.05);
  near(b.U(qKink), 0.25, 2e-3);
  assert.ok(b.split(qKink * 0.5)[1] < 1e-9, 'vor dem Knick bekommt Graphit nichts');
  // Steigungen (Betrag) vor und nach dem Knick: 1/b vs. 1/(1/b1 + 1/b2)
  const b1 = (0.6 - 0.05) / si;
  const b2 = (0.25 - 0.08) / (1 - si);
  const slope = (q0, q1) => (b.U(q0) - b.U(q1)) / (q1 - q0);
  near(slope(0.02, qKink - 0.02), b1, 2e-2);
  near(slope(qKink + 0.05, qKink + 0.25), 1 / (1 / b1 + 1 / b2), 1e-2);
  // dQ/dV einer Geraden: Kapazitaet / Spannungsbereich
  const grid = Array.from({ length: 701 }, (_, i) => i * 0.001);
  const d = dqdv(lineU(IDEAL_SILICON), 2.5, grid);
  near(d[300], 2.5 / 0.55, 0.05);
});
