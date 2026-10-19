# Fremdbibliotheken

| Datei im Build | Herkunft | Version | Lizenz |
|---|---|---|---|
| `plotly-basic-3.0.1.min.js` | npm `plotly.js-basic-dist-min` (devDependency, Version in `package.json` fest) | 3.0.1 (wie Streamlit 1.47.0 im Original) | MIT, siehe `LICENSE-plotly.js.txt` |

Eleventy kopiert die Datei beim Build aus `node_modules/` nach `/assets/vendor/plotly-basic-<version>.min.js`
(`eleventy.config.js`). Die Version steht im Dateinamen, damit `_headers` sie unbegrenzt cachen lassen kann.
Das Basis-Bundle enthaelt die Trace-Typen `scatter`, `bar` und `pie`; die Tools nutzen nur `scatter` und `bar`.
