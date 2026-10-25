// Ideale Tanks des Kapitels "Lithium balance": Grenzfaelle, die in den Texten beschrieben sind.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { idealCell, lithiumAccount } from '../../assets/js/model/idealCell.js';

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
