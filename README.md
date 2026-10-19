# chargetanks.com

Statische Seite: Webseite (Startseite, Blog, Artikel, `/tools/`) und die Tools unter `/tools/<tool>/`.
Die Seiten entstehen mit [Eleventy](https://www.11ty.dev/) aus `src/`; im Browser laeuft nur Vanilla-JavaScript
(ES-Module) ohne Framework, und alle Inhalte kommen von der eigenen Domain.

Herkunft (React-Webseite und Streamlit-Suite) und die Entscheidungen des Umzugs: [MIGRATION.md](MIGRATION.md).

## Lokal ansehen

```bash
npm install
npm run serve      # baut nach _site/ und startet einen Server mit Live-Reload (http://localhost:8080/)
npm run build      # nur bauen
npm test           # Regressionspruefung der Tools und Pruefung der gebauten Seite (_site/)
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
- Neuer Blogartikel: eine Markdown-Datei in `src/blog/posts/<slug>.md` mit Front Matter wie im vorhandenen
  Artikel (Titel, Datum, Beschreibung, Vorschaubild, Kategorie, Lesezeit, TL;DR, Definition). Startseite,
  `/blog/`, Sitemap und `llms.txt` uebernehmen ihn automatisch.
- Die fuenf Tools (Name, Kurztext, Beschreibung, Vorschaubild): `src/_data/tools.json`.
- Stile: `assets/css/site.css` (Webseite) und `assets/css/styles.css` (Tool-Seiten).
- Rechenlogik der Tools: `assets/js/model/` und `assets/js/core/` (ohne DOM). Sie ist bitgleich zum
  Python-Original geprueft; `npm test` vergleicht sie mit `tests/regression/reference.json`. Die Referenz nur
  nach einer bewussten, begruendeten Aenderung der Rechnung neu erzeugen (`node tests/regression/make-reference.js`).

## Aufbau

| Pfad | Inhalt |
|---|---|
| `src/` | Seiten, Vorlagen (`_includes/`) und Daten (`_data/`) fuer Eleventy |
| `tools/<tool>/index.html` | Tool-Seiten (werden unveraendert mitkopiert) |
| `assets/css/` | `site.css` (Webseite), `styles.css` (Tool-Seiten) |
| `assets/js/site/` | Verhalten der Webseite (Mobilmenue) |
| `assets/js/core/` | Nachbau von numpy/scipy/pandas und Python-Zahlenformat (ohne DOM) |
| `assets/js/model/` | Rechenlogik der Tools (ohne DOM) |
| `assets/js/ui/`, `assets/js/tools/` | Bedienelemente und Verdrahtung je Tool |
| `assets/fonts/`, `assets/data/`, `assets/img/` | Schriften der Tools, Materialdaten, Vorschaubilder |
| `images/`, `favicon.svg`, `site.webmanifest`, `robots.txt` | Bilder und Dateien der Webseite |
| `config/` | Hilfsfunktionen fuer den Build (JSON-LD) |
| `tests/` | Regressionspruefung der Tools, Pruefung der gebauten Seite |
| `eleventy.config.js`, `_redirects`, `_headers`, `netlify.toml` | Build und Netlify |
