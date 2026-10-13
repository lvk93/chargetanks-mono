# chargetanks.com

Statische Seite aus HTML, einer zentralen `assets/css/styles.css` und Vanilla-JavaScript (ES-Module).
Kein Framework, kein Build-Schritt, keine Laufzeit-Abhängigkeiten, keine Anfragen an fremde Domains.

> Stand: Umzug in Arbeit (Phase 1 von 2). Fertig ist das Aging-Tool unter `/tools/aging/`.
> Details, Entscheidungen und Status: [MIGRATION.md](MIGRATION.md).

## Lokal starten

Voraussetzung: Node.js 18 oder neuer (getestet mit 24).

```bash
npm run serve        # = node scripts/serve.mjs 8000
```

Dann <http://localhost:8000/tools/aging/> öffnen. Der Server bildet das Netlify-Verhalten nach
(Verzeichnis-Index, `404.html`, Weiterleitung fehlender `/tools/*`-Pfade). Jeder andere statische
Server funktioniert ebenso, solange die Seite im Wurzelverzeichnis liegt (absolute Pfade `/assets/...`).

## Tests

```bash
npm test             # = node --test "tests/**/*.test.js"
```

Die Tests vergleichen die JavaScript-Rechnung mit Referenzwerten aus dem unveränderten Original
(`tests/golden/`, erzeugt mit `migration/make_goldens.py`): angezeigte Werte exakt, Rohwerte mit
höchstens 1e-12 relativer Abweichung (tatsächlich bitgleich).

## Deployment (Netlify)

- Publish-Verzeichnis: Repository-Wurzel
- Build-Befehl: keiner
- Weiterleitungen und Header: `_redirects`, `_headers` (folgen in Phase 2)

Andere Hoster: den Inhalt des Repositorys als statische Dateien ausliefern; `migration/`, `tests/`
und `scripts/` werden für den Betrieb nicht gebraucht.

## Aufbau

| Pfad | Inhalt |
|---|---|
| `tools/<tool>/index.html` | Seiten der Tool-Suite (Texte direkt im HTML) |
| `assets/css/styles.css` | Theme-Variablen und alle Stile |
| `assets/js/core/` | Nachbau von numpy/scipy/pandas und Python-Zahlenformat (ohne DOM) |
| `assets/js/model/` | Rechenlogik der Tools (ohne DOM, auch in den Node-Tests genutzt) |
| `assets/js/ui/`, `assets/js/tools/` | Bedienelemente und Verdrahtung je Tool |
| `assets/vendor/`, `assets/fonts/`, `assets/data/` | plotly.js 3.0.1, Schriften, Materialdaten (mit Herkunft und Lizenzen) |
| `tests/` | `node --test`-Tests und Golden-Werte |
| `migration/` | Skripte und Messdaten des Umzugs (Referenz: alte Streamlit-/React-Seite) |
