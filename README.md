# chargetanks.com

Statische Seite: Startseite, Kapitel unter `/blog/<kapitel>/` (Uebersicht `/blog/`, Kapitel in `src/_data/chapters.json`), `/about/` (Lebenslauf), `/tools/` und fuenf interaktive
Tools unter `/tools/<tool>/`.
Die Seiten entstehen mit [Eleventy](https://www.11ty.dev/) aus `src/`; im Browser laeuft nur Vanilla-JavaScript
(ES-Module) ohne Framework, und alle Inhalte kommen von der eigenen Domain.

Herkunft (React-Webseite und Streamlit-Suite) und die Entscheidungen des Umzugs: [MIGRATION.md](MIGRATION.md).

## Lokal ansehen

```bash
npm install
npm run serve      # baut nach _site/ und startet einen Server mit Live-Reload (http://localhost:8080/)
npm run build      # nur bauen
npm test           # Regressionspruefung der Tools und Pruefung der gebauten Seite (_site/)
node tests/e2e/tools.mjs   # nach dem Build: alle Pruefzustaende der Tools im Browser (braucht Chrome)
node tests/e2e/pages.mjs   # nach dem Build: Startseite, Kapitel und About im Browser, Desktop und Handy
```

## Deployment (Netlify)

Einstellungen stehen in `netlify.toml`:

- Build: `npm run build && npm test`, Publish-Verzeichnis `_site/`
- `_redirects` (`/tools/suite/` → `/tools/`, unbekannte `/tools/*`-Pfade → `/tools/`) und `_headers`
  (Sicherheits-Header, Cache fuer `/assets/vendor/*`) werden mitkopiert; `404.html` liefert Netlify fuer
  unbekannte Pfade automatisch mit Status 404.

Andere Hoster: `npm run build` ausfuehren, `_site/` als statische Dateien ausliefern und Weiterleitungen und
Header aus `_redirects` und `_headers` uebertragen.

## Inhalte aendern

- Seiten: `src/` (Nunjucks-Vorlagen `.njk`, Texte als Markdown `.md`). Kopf und Fuss stehen einmal in
  `src/_includes/partials/`, das Grundgeruest mit Meta-Tags und JSON-LD in `src/_includes/layouts/base.njk`.
- Navigation (Kopf): `src/_includes/partials/header.njk`, Fuss: `footer.njk`. Eine Hierarchieebene:
  Lithium balance, Tools, About; Imprint und Privacy nur im Fuss.
- Kapitel: `src/blog/<kapitel>.njk` (Reiter, Abbildungen per Makro `fig`, Tools im Text, Mathe-Box mit
  `{% math %}`/`{% mi %}`, beim Build per KaTeX zu MathML). Zeichnungen und Kapitel-Tools: `assets/js/site/chapter.js`,
  Rechnung: `assets/js/model/idealCell.js`. Mit `draft: true` im Front Matter sind gelbe Notizen sichtbar und die Seite
  ist nicht indexiert und nicht in der Sitemap; zum Veroeffentlichen `draft`, `robots` und `sitemap` entfernen.
- Lebenslauf: `src/about.njk` (gleicher Entwurfsmechanismus). Links auf Scholar, ORCID und LinkedIn in `src/_data/site.json`.
- Vorschaubilder (Open Graph, 1200x630): `assets/img/og/` fuer Startseite, Kapitel und About, gerendert mit der
  Vorlage `config/og/render.html` aus denselben Zeichnungen wie das Kapitel. Tool-Seiten nutzen `assets/img/tools/*-og.jpg`.
- Der fruehere Blog ist entfallen; `/blog/*` leitet in `_redirects` aufs Kapitel um.
- Bild zum Launch-Post (NMC/LFP gegen Graphit): `assets/img/og/post-nmc-lfp.png`, Vorlage `config/og/render.html?v=post`.
- Materialdaten: LFP ist geglaettet (Okt. 2026). Das Plateau der Originaldaten war exakt waagerecht
  (dQ/dV unendlich); jetzt leicht geneigt mit weichen Enden, dQ/dV daraus neu berechnet. Damit weicht `lfp.json`
  bewusst vom Python-Original ab; `tests/regression/reference.json` ist fuer die vier LFP-Zustaende neu erzeugt.
- Die fuenf Tools (Name, Kurztext, Beschreibung, Vorschaubilder): `src/_data/tools.json`. Eine Tool-Seite ist
  `src/tools/<tool>.md`: Regler und Diagramme im Front Matter, darunter der Erklaertext als Markdown.
  Die Verdrahtung steht in `assets/js/tools/<tool>.js` (Material laden, Modell rechnen, Diagramme zeigen).
- „Try this“ auf den Tool-Seiten: `tryThis` (URL-Parameter, Beschriftung, Satz) und `readMore` im Front Matter.
  Zahlen in den Saetzen am Modell nachrechnen, wenn sich etwas aendert.
- Tank-Bild auf der Startseite: gleiche Abbildung wie im Kapitel (`data-chapter-figure`, `assets/js/site/chapter.js`).
- Zustand der Tools in der URL, z. B. `/tools/aging/?anode=graphite&cathode=nmc&lli=0.2`
  (Parameter = Namen der Regler, Materialien als Slug wie in `assets/data/materials/`).
- Stile: `assets/css/site.css`.
- Rechenlogik der Tools: `assets/js/model/` und `assets/js/core/` (ohne DOM). Sie ist bitgleich zum
  Python-Original geprueft; `npm test` vergleicht sie mit `tests/regression/reference.json`. Die Referenz nur
  nach einer bewussten, begruendeten Aenderung der Rechnung neu erzeugen (`node tests/regression/make-reference.js`).

## Aufbau

| Pfad | Inhalt |
|---|---|
| `src/` | Seiten, Vorlagen (`_includes/`) und Daten (`_data/`) fuer Eleventy; Tool-Seiten in `src/tools/` |
| `assets/css/site.css` | alle Stile |
| `assets/js/site/` | Verhalten der Webseite (Mobilmenue, Kapitel mit Zeichnungen und Tools, Statistik) |
| `assets/js/core/` | Nachbau von numpy/scipy/pandas und Python-Zahlenformat (ohne DOM) |
| `assets/js/model/` | Rechenlogik der Tools (ohne DOM) |
| `assets/js/ui/` | Ablauf der Tool-Seiten, Regler, URL-Zustand, Diagramm-Darstellung (plotly.js) |
| `assets/js/tools/` | Verdrahtung je Tool |
| `assets/data/`, `assets/img/tools/` | Materialdaten, Vorschau- und OG-Bilder der Tools |
| `images/`, `assets/img/og/`, `favicon.svg`, `site.webmanifest`, `robots.txt` | Bilder und Dateien der Webseite |
| `config/` | Hilfsfunktionen fuer den Build (JSON-LD, KaTeX, Vorlage der Vorschaubilder) |
| `tests/regression/` | Regressionspruefung der Rechnung (Fingerabdruecke, `reference.json`) |
| `tests/site/` | Pruefung der gebauten Seite |
| `tests/e2e/` | Browser-Pruefungen mit Chrome: Tool-Seiten (`tools.mjs`), Startseite/Kapitel/About (`pages.mjs`) |
| `tests/model/` | Rechnung der Kapitel-Tools (ideale Tanks, Lithiumkonto) |
| `eleventy.config.js`, `_redirects`, `_headers`, `netlify.toml` | Build und Netlify |
