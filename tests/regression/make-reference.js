// Erzeugt tests/regression/reference.json aus dem aktuellen Rechenkern.
// Nur nach einer bewussten, begruendeten Aenderung der Rechnung neu erzeugen:
//   node tests/regression/make-reference.js
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { fingerprintState, TOOLS } from './runners.js';
import { STATES } from './states.js';

const reference = {};
for (const tool of TOOLS) {
  reference[tool] = {};
  for (const [name, state] of Object.entries(STATES[tool])) reference[tool][name] = await fingerprintState(tool, state);
}

// Eine Zeile je Zustand: kompakt und in Diffs gut lesbar
const lines = ['{'];
TOOLS.forEach((tool, i) => {
  lines.push(`  ${JSON.stringify(tool)}: {`);
  const entries = Object.entries(reference[tool]);
  entries.forEach(([name, value], j) => {
    lines.push(`    ${JSON.stringify(name)}: ${JSON.stringify(value)}${j < entries.length - 1 ? ',' : ''}`);
  });
  lines.push(`  }${i < TOOLS.length - 1 ? ',' : ''}`);
});
lines.push('}', '');
const file = fileURLToPath(new URL('./reference.json', import.meta.url));
writeFileSync(file, lines.join('\n'));
console.log(`geschrieben: ${file}`);
