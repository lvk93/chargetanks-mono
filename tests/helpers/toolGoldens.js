// Gemeinsamer Ablauf der Tool-Tests gegen tests/golden/ui/<tool>/ (AppTest-Faelle aus dem Original):
// Eingaben aus den Widget-Werten des Falls lesen, portierte Rechnung ausfuehren, alle Plotly-Specs
// (ohne Template) mit Toleranz 1e-12 und alle uebergebenen Texte exakt vergleichen.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { toPlotlyJson } from '../../assets/js/model/figure.js';
import { GOLDEN, loadGolden } from './golden.js';
import { compareSpec, newStats } from './spec.js';

export function widgetValue(golden, label) {
  const widget = golden.elements.find((e) => e.where.startsWith('sidebar/') && e.label === label);
  return widget ? widget.value : undefined;
}

export function runToolGoldens(tool, { build, texts = () => [] }) {
  const index = JSON.parse(readFileSync(`${GOLDEN}ui/${tool}/_index.json`, 'utf8'));
  const total = newStats();
  for (const { case: caseId, file } of index) {
    test(`${tool}: ${caseId}`, () => {
      const golden = loadGolden(`ui/${tool}/${file}`);
      assert.deepEqual(golden.exceptions, []);
      const result = build(golden);
      const charts = golden.elements.filter((e) => e.type === 'plotly_chart');
      assert.equal(charts.length, result.figures.length, 'Anzahl Diagramme');
      result.figures.forEach((fig, i) => {
        const { proto } = charts[i];
        assert.equal(proto.theme, 'streamlit');
        assert.deepEqual(proto.config, { showLink: false, linkText: false });
        if (result.useContainerWidth) assert.equal(proto.use_container_width, result.useContainerWidth[i]);
        compareSpec(toPlotlyJson(fig), proto.spec, `${caseId} chart${i}`, total);
      });
      for (const [type, expected] of texts(result, golden)) {
        const values = golden.elements.filter((e) => e.type === type).map((e) => e.value);
        assert.ok(values.includes(expected), `${type} "${expected}" nicht in ${JSON.stringify(values)}`);
      }
    });
  }
  test(`${tool}: Statistik`, (t) => {
    t.diagnostic(`Zahlen verglichen: ${total.numbers}, nicht bitgleich: ${total.inexact}, max. rel. Abweichung: ${total.maxDeviation}`);
  });
}
