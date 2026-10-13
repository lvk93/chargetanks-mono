// Holt plotly.js 3.0.1 (dieselbe Version, die Streamlit 1.47.0 buendelt) einmalig ins Repo.
// Quelle: offizielles npm-Paket plotly.js-dist-min@3.0.1, geprueft gegen das sha512-Integrity
// aus dem Registry. Ergebnis: assets/vendor/plotly-3.0.1.min.js, LICENSE und README.md.
// Aufruf: node migration/fetch_vendor.mjs
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

const NAME = 'plotly.js-dist-min';
const VERSION = '3.0.1';
const OUT = 'assets/vendor';

const meta = await (await fetch(`https://registry.npmjs.org/${NAME}/${VERSION}`)).json();
const tgz = Buffer.from(await (await fetch(meta.dist.tarball)).arrayBuffer());
const integrity = `sha512-${createHash('sha512').update(tgz).digest('base64')}`;
if (integrity !== meta.dist.integrity) {
  throw new Error(`Integrity stimmt nicht: ${integrity} != ${meta.dist.integrity}`);
}

// Minimaler tar-Leser (ustar): 512-Byte-Header, Inhalt auf 512 Byte aufgefuellt.
function untar(buffer) {
  const files = new Map();
  for (let offset = 0; offset + 512 <= buffer.length; ) {
    const header = buffer.subarray(offset, offset + 512);
    const name = header.toString('utf8', 0, 100).replace(/\0.*$/s, '');
    if (!name) break;
    const size = parseInt(header.toString('utf8', 124, 136).replace(/\0.*$/s, '').trim(), 8);
    files.set(name, buffer.subarray(offset + 512, offset + 512 + size));
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  return files;
}

const files = untar(gunzipSync(tgz));
const js = files.get('package/plotly.min.js');
const license = files.get('package/LICENSE');
if (!js || !license) throw new Error('plotly.min.js oder LICENSE fehlt im Paket');

mkdirSync(OUT, { recursive: true });
writeFileSync(`${OUT}/plotly-${VERSION}.min.js`, js);
writeFileSync(`${OUT}/LICENSE-plotly.js.txt`, license);
const sha256 = createHash('sha256').update(js).digest('hex');
writeFileSync(
  `${OUT}/README.md`,
  [
    '# Fremdbibliotheken',
    '',
    `| Datei | Herkunft | Version | Lizenz | sha256 |`,
    `|---|---|---|---|---|`,
    `| \`plotly-${VERSION}.min.js\` | npm \`${NAME}@${VERSION}\` (${meta.dist.integrity}) | ${VERSION} (= Streamlit 1.47.0) | MIT, siehe \`LICENSE-plotly.js.txt\` | \`${sha256}\` |`,
    '',
    'Erzeugt mit `node migration/fetch_vendor.mjs`.',
    '',
  ].join('\n'),
);
console.log(`ok: ${OUT}/plotly-${VERSION}.min.js (${js.length} Bytes, sha256 ${sha256})`);
