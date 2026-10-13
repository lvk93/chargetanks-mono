// Aging-Tool gegen die Golden-Werte aus dem unveraenderten Original (AppTest, tests/golden/ui/aging/).
// Pro Fall: angezeigte Texte exakt, alle drei Plotly-Specs (ohne Template) mit der vereinbarten Toleranz.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { buildAging } from '../../assets/js/model/aging.js';
import { toPlotlyJson } from '../../assets/js/model/figure.js';
import { GOLDEN, loadGolden } from '../helpers/golden.js';
import { material } from '../helpers/materials.js';
import { compareSpec, newStats } from '../helpers/spec.js';

const index = JSON.parse(readFileSync(`${GOLDEN}ui/aging/_index.json`, 'utf8'));
const total = newStats();

export function agingInputs(golden) {
  const value = (label) => golden.elements.find((e) => e.where.startsWith('sidebar/') && e.label === label).value;
  return {
    anodeName: value('Anode'),
    cathodeName: value('Cathode'),
    soc: value('SoC'),
    lampe: value('Cathode LAM (lampe)'),
    lamne: value('Anode LAM (lamne)'),
    lli: value('LLI (lithium loss)'),
  };
}

for (const { case: caseId, file } of index) {
  test(`aging: ${caseId}`, () => {
    const golden = loadGolden(`ui/aging/${file}`);
    assert.deepEqual(golden.exceptions, []);
    const inputs = agingInputs(golden);
    const result = buildAging({ ...inputs, anode: material(inputs.anodeName), cathode: material(inputs.cathodeName) });

    const subheaders = golden.elements.filter((e) => e.type === 'subheader').map((e) => e.value);
    assert.equal(subheaders.find((s) => s.startsWith('Capacities')), result.heading, 'SoH-Zeile');

    const charts = golden.elements.filter((e) => e.type === 'plotly_chart');
    assert.equal(charts.length, 3);
    [result.figCaps, result.figTank, result.figOcv].forEach((fig, i) => {
      const { proto } = charts[i];
      assert.equal(proto.theme, 'streamlit');
      assert.equal(proto.use_container_width, true);
      assert.deepEqual(proto.config, { showLink: false, linkText: false });
      compareSpec(toPlotlyJson(fig), proto.spec, `${caseId} chart${i}`, total);
    });
  });
}

test('aging: Statistik', (t) => {
  t.diagnostic(`Zahlen verglichen: ${total.numbers}, nicht bitgleich: ${total.inexact}, max. rel. Abweichung: ${total.maxDeviation}`);
});
