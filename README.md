# chargetanks.com

Statische Seite aus HTML, einer zentralen `assets/css/styles.css` und Vanilla-JavaScript (ES-Module):
Webseite (Startseite, Blog, Artikel, `/tools/`) und die Tool-Suite unter `/tools/suite/`.
Kein Framework, kein Build-Schritt, keine Laufzeit-Abhängigkeiten, keine Anfragen an fremde Domains.

Herkunft (React-Webseite und Streamlit-Suite), Entscheidungen, Abweichungen und mitportierte Eigenheiten:
[MIGRATION.md](MIGRATION.md).

## Lokal starten

Voraussetzung: Node.js 18 oder neuer (getestet mit 24).

```bash
npm run serve              # = node scripts/serve.mjs, Port 8000
node scripts/serve.mjs 8010   # anderer Port
```

Dann <http://localhost:8000/> öffnen. Die Tools liegen unter <http://localhost:8000/tools/suite/>.
Der Server bildet Netlify nach: Verzeichnis-Index mit 301 auf den Schrägstrich, `404.html` mit Status 404,
fehlende `/tools/*`-Pfade → 302 `/tools/suite/`, `migration/`, `tests/` und `scripts/` werden nicht
ausgeliefert. Jeder andere statische Server funktioniert ebenso, solange die Seite im Wurzelverzeichnis
liegt (absolute Pfade `/assets/...`).

## Tests

```bash
npm test                   # = node --test "tests/**/*.test.js"
```

- Rechenlogik der Tools gegen Referenzwerte aus dem unveränderten Original (`tests/golden/`, erzeugt mit
  `migration/make_goldens.py`): angezeigte Werte exakt, Rohwerte bitgleich (Toleranz 1e-12).
- Alle Seiten: interne Links und Ressourcen vorhanden, keine Ressourcen fremder Domains, Klassen der
  Webseite in `styles.css` definiert; Bilder und Daten bytegleich zur Quelle.

Die Browser-Vergleiche mit dem Original (Screenshots, berechnete Stile, Verhalten) liegen unter
`migration/` und brauchen die alte Umgebung; siehe MIGRATION.md §16–18.

## Deployment (Netlify)

- Publish-Verzeichnis: Repository-Wurzel (`.`)
- Build-Befehl: keiner
- `_redirects` und `_headers` liegen in der Wurzel und werden von Netlify gelesen; `404.html` liefert
  Netlify für unbekannte Pfade automatisch mit Status 404.

Andere Hoster: den Inhalt des Repositorys als statische Dateien ausliefern, Weiterleitungen aus
`_redirects` und Header aus `_headers` übertragen; `migration/`, `tests/` und `scripts/` werden für den
Betrieb nicht gebraucht.

## Inhalte ändern

- Texte stehen direkt im HTML der jeweiligen Seite (`index.html`, `blog/…`, `tools/…`).
- Neuer Blogartikel: `blog/two-tank-battery-model/index.html` in einen neuen Ordner `blog/<slug>/` kopieren,
  Kopf (Titel, Beschreibung, Canonical, Open-Graph-/Twitter-Tags, JSON-LD) und Artikeltext ersetzen, Karten
  auf Startseite, `/blog/` und `/tools/` („Continue Reading“) ergänzen, `sitemap.xml` und `llms.txt` pflegen.
  Datumsangaben als `<time datetime="JJJJ-MM-TT" data-ct-date="short|long">` – das Format setzt
  `assets/js/site/site.js` zur Laufzeit.
- Stile: `assets/css/styles.css` – Teil A Theme-Variablen, Teil B Tool-Suite (`st-*`), Teil C Webseite
  (`ct-*`, aus dem Tailwind-Build des Originals übernommen).

## Aufbau

| Pfad | Inhalt |
|---|---|
| `index.html`, `blog/`, `tools/index.html`, `404.html` | Webseite |
| `tools/suite/`, `tools/<tool>/` | Tool-Suite: Landing und Materials, Cell Reconstruction, Blending, Aging, Swelling |
| `assets/css/styles.css` | alle Stile |
| `assets/js/site/` | Verhalten der Webseite (Menü, Datum, Scrollen, 404) |
| `assets/js/core/` | Nachbau von numpy/scipy/pandas und Python-Zahlenformat (ohne DOM) |
| `assets/js/model/` | Rechenlogik der Tools (ohne DOM, auch in den Node-Tests genutzt) |
| `assets/js/ui/`, `assets/js/tools/` | Bedienelemente und Verdrahtung je Tool |
| `assets/vendor/`, `assets/fonts/`, `assets/data/`, `assets/img/` | plotly.js 3.0.1, Schriften, Materialdaten, Vorschaubilder (mit Herkunft und Lizenzen) |
| `images/`, `favicon.svg`, `site.webmanifest`, `robots.txt`, `sitemap.xml`, `llms.txt` | Bilder und Dateien der Webseite |
| `_redirects`, `_headers` | Netlify |
| `tests/` | `node --test`-Tests und Golden-Werte |
| `scripts/serve.mjs` | lokaler Server |
| `migration/` | Skripte und Messdaten des Umzugs (Referenz: alte Streamlit-/React-Seite) |
