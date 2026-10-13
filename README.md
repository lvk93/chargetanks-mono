# chargetanks.com

Statische Seite aus HTML, einer zentralen `assets/css/styles.css` und Vanilla-JavaScript (ES-Module):
Webseite (Startseite, Blog, Artikel, `/tools/`) und die Tool-Suite unter `/tools/suite/`.
Kein Framework, kein Build-Schritt, keine Abhängigkeiten, keine Anfragen an fremde Domains.

Herkunft (React-Webseite und Streamlit-Suite), Entscheidungen, Abweichungen und mitportierte Eigenheiten:
[MIGRATION.md](MIGRATION.md). Migrationsskripte, Tests und Messdaten wurden nach Abschluss entfernt; sie
liegen in der Git-Historie (letzter Stand: Commit `1a07547`).

## Lokal ansehen

Jeder statische Server im Repository-Wurzelverzeichnis, zum Beispiel:

```bash
python -m http.server 8000
```

Dann <http://localhost:8000/> öffnen; die Tools liegen unter <http://localhost:8000/tools/suite/>.
Einfache Server liefern unbekannte Pfade nicht als `404.html` aus und kennen die Weiterleitung aus
`_redirects` nicht; das genaue Netlify-Verhalten zeigt `netlify dev` (Netlify CLI).
Die Seiten nicht direkt als Datei (`file://`) öffnen – sie nutzen absolute Pfade (`/assets/...`) und ES-Module.

## Deployment (Netlify)

Einstellungen stehen in `netlify.toml`:

- Publish-Verzeichnis: Repository-Wurzel (`.`)
- kein Build-Schritt
- `_redirects` (unbekannte `/tools/*`-Pfade → `/tools/suite/`) und `_headers` (Sicherheits-Header) liegen in
  der Wurzel; `404.html` liefert Netlify für unbekannte Pfade automatisch mit Status 404.

Andere Hoster: den Inhalt des Repositorys als statische Dateien ausliefern und Weiterleitung und Header
aus `_redirects` und `_headers` übertragen.

## Inhalte ändern

- Texte stehen direkt im HTML der jeweiligen Seite (`index.html`, `blog/…`, `tools/…`).
- Neuer Blogartikel: `blog/two-tank-battery-model/index.html` in einen neuen Ordner `blog/<slug>/` kopieren,
  Kopf (Titel, Beschreibung, Canonical, Open-Graph-/Twitter-Tags, JSON-LD) und Artikeltext ersetzen, Karten
  auf Startseite, `/blog/` und `/tools/` („Continue Reading“) ergänzen, `sitemap.xml` und `llms.txt` pflegen.
  Datumsangaben als `<time datetime="JJJJ-MM-TT" data-ct-date="short|long">` – das Format setzt
  `assets/js/site/site.js` zur Laufzeit.
- Stile: `assets/css/styles.css` – Teil A Theme-Variablen, Teil B Tool-Suite (`st-*`), Teil C Webseite
  (`ct-*`, aus dem Tailwind-Build des Originals übernommen).
- Rechenlogik der Tools: `assets/js/model/` und `assets/js/core/` (ohne DOM). Sie ist bitgleich zum
  Python-Original geprüft; bei Änderungen dort die Tests aus der Git-Historie wiederherstellen
  (`git checkout 1a07547 -- tests package.json`, dann `node --test "tests/**/*.test.js"`).

## Aufbau

| Pfad | Inhalt |
|---|---|
| `index.html`, `blog/`, `tools/index.html`, `404.html` | Webseite |
| `tools/suite/`, `tools/<tool>/` | Tool-Suite: Landing und Materials, Cell Reconstruction, Blending, Aging, Swelling |
| `assets/css/styles.css` | alle Stile |
| `assets/js/site/` | Verhalten der Webseite (Menü, Datum, Scrollen, 404) |
| `assets/js/core/` | Nachbau von numpy/scipy/pandas und Python-Zahlenformat (ohne DOM) |
| `assets/js/model/` | Rechenlogik der Tools (ohne DOM) |
| `assets/js/ui/`, `assets/js/tools/` | Bedienelemente und Verdrahtung je Tool |
| `assets/vendor/`, `assets/fonts/`, `assets/data/`, `assets/img/` | plotly.js 3.0.1, Schriften, Materialdaten, Vorschaubilder (mit Herkunft und Lizenzen) |
| `images/`, `favicon.svg`, `site.webmanifest`, `robots.txt`, `sitemap.xml`, `llms.txt` | Bilder und Dateien der Webseite |
| `_redirects`, `_headers`, `netlify.toml` | Netlify |
