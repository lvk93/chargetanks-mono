# MIGRATION.md – chargetanks.com → statische Seite (1:1-Umzug)

Dieses Dokument ist die Arbeitsgrundlage des Umzugs. Eine neue Session kann allein damit weiterarbeiten.

- **Auftrag:** Webseite und Tools 1:1 in ein self-contained Repo umziehen, bestehend aus HTML, einer `assets/css/styles.css` und Vanilla-JS, ohne Build-Schritt und ohne fremde Domains beim Laden.
- **Prioritäten bei Konflikten:** (1) Rechenergebnisse identisch, (2) Verhalten identisch, (3) Darstellung so nah wie möglich.
- **Grundregeln:**
  - Bugs werden mitportiert, siehe Abschnitt 13.
  - Was nicht 1:1 geht, wird dokumentiert und dem Auftraggeber vorgelegt (Abschnitte 12 und 15).
  - Alte Repos werden nur gelesen. Es werden keine Secrets verwendet.

Stand: **Phase 1 (Grundgerüst, Golden-Werte, Pilot Aging) abgeschlossen am 2026-10-13. Wartet auf Freigabe für Phase 2.** Ergebnisse: §17.

---

## 1. Status-Übersicht

| # | Punkt | Status | Details |
|---|---|---|---|
| 0.1 | Referenzstände festgelegt und lokal = live nachgewiesen | ✅ erledigt | §2 |
| 0.2 | Seiten, URLs, Navigation, Meta, Redirect-Tabelle | ✅ erledigt | §3 |
| 0.3 | Inventar pro Tool (Eingaben, Ausgaben, Layout, Rerun, State) | ✅ erledigt | §4 |
| 0.4 | Darstellung: Theme, injiziertes CSS, Schriften, Hell/Dunkel (gemessen) | ✅ erledigt | §5 |
| 0.5 | Charts: Bibliothek, Streamlit-Theme-Overlay, Config | ✅ erledigt | §6 |
| 0.6 | Rechenlogik: Abhängigkeiten, Verfahren, Parameter | ✅ erledigt | §7 |
| 0.7 | Daten und Assets | ✅ erledigt | §8 |
| 0.8 | Externe Dienste und Secrets | ✅ erledigt | §9 |
| 0.9 | Doppelte Logik | ✅ erledigt | §10 |
| 0.10 | Referenz-Screenshots 1280/390 (`migration/screenshots/legacy/`) | ✅ erledigt | §16 |
| 0.11 | Vorschläge: Zielstruktur, Portierbarkeit, Toleranzen | ✅ freigegeben (2026-10-13) | §14 |
| 0.12 | Offene Fragen | ✅ beantwortet (2026-10-13) | §15 |
| 1.1 | Repo-Basis (package.json ohne Dependencies, Dev-Server, plotly.js 3.0.1, Fonts, Materialdaten) | ✅ erledigt | §17.1 |
| 1.2 | Zusatzmessungen am Original (CSS-Regeln, Breakpoints, Verhalten) | ✅ erledigt | §17.2 |
| 1.3 | Golden-Werte aller Tools (AppTest + Direktimporte), Gegenprobe, Determinismus | ✅ erledigt | §17.3 |
| 1.4 | Rechenkern JS (pyformat, numpy, scipy, pandas) – bitgenau | ✅ erledigt | §17.4 |
| 1.5 | `styles.css` (Theme-Variablen, alle Streamlit-Elemente der Suite) | ✅ erledigt (Nicht-Aging-Teile in Phase 2 am Tool prüfen) | §17.5 |
| 1.6 | Pilot Aging (`/tools/aging/`) mit Tests und Browser-Vergleich | ✅ erledigt | §17.6 |
| 2.1 | Cell Reconstruction (`/tools/cell-reconstruction/`) | ✅ erledigt | §18.1 |
| 2.2 | Materials (`/tools/materials/`) | ✅ erledigt | §18.1 |
| 2.3 | Blending (`/tools/blending/`) | ✅ erledigt | §18.1 |
| 2.4 | Swelling (`/tools/swelling/`) inkl. SoH-Slider mit negativem Schritt (B2) | ✅ erledigt | §18.2 |
| 2.5 | Landing `/tools/suite/` | ✅ erledigt | §18.3 |
| 2.6 | Webseite (Home, Blog, Artikel, `/tools/`, 404), Tailwind → `styles.css` Teil C | ⏳ offen | §17.7 |
| 2.7 | `_redirects`, `_headers`, `sitemap.xml`, `robots.txt`, `llms.txt`, Manifest, Netzwerk-Check, README | ⏳ offen | §17.7 |

---

## 2. Quellen und Referenzstände

**Die Annahme aus dem Auftrag ist korrigiert.** chargetanks.com ist **keine Streamlit-App**. Die Webseite ist eine React-SPA auf Netlify, die Tools sind eine Streamlit-App auf Render.

| | Webseite chargetanks.com | Tools batterytank.onrender.com |
|---|---|---|
| Repo (lokal) | `C:\Git\legacy\chargetanks` (GitHub `lvk93/chargetanks`) | `C:\Git\legacy\ocv_teaching` (GitHub `lvk93/ocv`) |
| Technik | React 18.3.1, Vite 5.4.8, Tailwind 3.4.17, react-router 7.12, react-markdown 10.1 + remark-gfm 4.0.1, lucide-react 0.344.0 | Streamlit 1.47.0, Plotly, numpy/scipy/pandas |
| Hosting | Netlify (`Server: Netlify`) | Render (Docker, `python:3.11-slim`, Tornado) |
| **Referenz (Entscheidung 2026-10-13)** | **`main` @ `3199678a334a3e807d6e934c3961331db752dc22`** | **`master` @ `deb0609214a70972d5a343b2f09a6414a59638f3`** |
| Ausgecheckt (nicht Referenz) | `claude_refactor` @ `52f570a` (unfertiger React-Port der Tools, nicht deployt) | `refactor_claude` @ `b3740f0` (Refactor des Plotters + Tests, nicht deployt) |

### Nachweise "lokal = live"

- **Webseite:** Ein lokaler Build von `main` ist byteidentisch mit dem, was live ausgeliefert wird. Geprüft wurden alle 4 HTML-Snapshots, `sitemap.xml`, `robots.txt`, `llms.txt`, `site.webmanifest`, `favicon.svg`, alle Bilder und alle JS-/CSS-Chunks (`index-Y7JIT3Ej.js`, `index-D016u5sb.css` …). Protokoll: `migration/env/site-build-verification.txt`.
  - Voraussetzung: LF-Zeilenenden. Markdown wird roh ins Bundle eingebettet; mit CRLF (Git-for-Windows-Standard) entsteht ein anderer Hash.
  - Gebaut wurde einmalig mit den VITE-Variablen nur als Prozess-Umgebung. Dieser Build wurde danach gelöscht und nie im Browser geöffnet.
- **Suite:**
  - Live und lokal liefern dasselbe Frontend-Bundle `static/js/index.BTGIlECR.js`, also **Streamlit 1.47.0**.
  - Die Python-Pakete sind auf Render ungepinnt. Die pip-Schicht des Live-Images entstand am **2026-03-09 22:04:49 UTC**. Belege dafür:
    - `Last-Modified` von Streamlits `index.html` live
    - live läuft Tornado **6.5.4**, Version 6.5.5 erschien erst am 2026-03-10
    - Commit `13b95c0` änderte `.streamlit/config.toml` am 09.03. um 22:03 UTC; dadurch wird im Dockerfile die pip-Schicht neu gebaut
    - der Deploy vom 16.03. (`deb0609`) traf nur die Schichten danach.
  - Lokal ist dieser Stand per `pip install --uploaded-prior-to 2026-03-09T22:04:49Z` rekonstruiert, mit Python 3.11.9 unter Windows. Wesentliche Versionen: **numpy 2.4.3, scipy 1.17.1, pandas 2.3.3, plotly 6.6.0, tornado 6.5.4, protobuf 6.33.5, pyarrow 23.0.1**. Vollständig in `migration/env/ocv_teaching.freeze.txt`.
- **Legacy-Repos unverändert:** Zustand vorher in `migration/env/legacy-state-before.txt`, nachher in `migration/env/legacy-state-after.txt`.

---

## 3. Seiten und URLs

### 3.1 Webseite (React, Netlify)

Jede URL existiert in **zwei Fassungen**:
1. **Statischer Snapshot** aus `scripts/postbuild.mjs`. Ihn sehen Crawler und Besucher ohne JS.
2. **React-Ansicht.** `createRoot().render()` ersetzt den Snapshot nach dem Laden; das ist kein Hydrate.

Texte und Layout der beiden Fassungen **unterscheiden sich deutlich**. Beispiel Startseite: Der Snapshot zeigt "Battery intuition through the two-tank analogy", die React-Ansicht "Understanding Batteries Through Two Tanks". Screenshots: `site/home__nojs__1280.png` gegen `site/home__js__1280.png`.

| URL | Titel (React) | Inhalt / Reihenfolge (React) | Snapshot ohne JS |
|---|---|---|---|
| `/` | Charge Tanks \| Battery intuition through the two-tank analogy | Header, Hero, Tools-Teaser, Latest Articles (max. 3), About Me (`lars.jpg`), Footer | eigener Text (Hero, "What you will find here", "Latest articles") |
| `/blog/` | Battery Blog \| Charge Tanks | Intro, Kartenraster aller Posts | ähnlich, Karten ohne Bild |
| `/blog/two-tank-battery-model/` | Two-tank battery model: … \| Charge Tanks | Breadcrumb, Back, Kategorie, H1, Meta (Datum, Lesezeit, Autor, Updated), Titelbild, TL;DR, Definition, Artikel (Markdown/GFM), "Continue exploring", "More Articles" | gleiche Struktur, Artikel via `marked` |
| `/tools/` | Battery Tools \| Charge Tanks | Hero mit "Launch Tool Suite" (→ batterytank.onrender.com, neuer Tab), 3 Karten, "Use the tools with the blog", "Continue Reading" | eigener Text, Liste statt Karten |
| unbekannter Pfad | Page not found \| Charge Tanks (noindex) | 404-Komponente | **Startseiten-Snapshot**, Status **200** |
| `/blog/<unbekannt>/` | Post not found \| Charge Tanks (noindex) | "Post Not Found" | Startseiten-Snapshot, Status 200 |

- **Navigation:**
  - Header mit Logo (SVG), Tools, Blog und About (`/#about`, sanftes Scrollen). Unter 768 px gibt es ein Hamburger-Menü (lucide `Menu`/`X`).
  - Footer mit LinkedIn, Mail und Quick Links. Das Jahr kommt per JS aus `new Date().getFullYear()`, aktuell "© 2026".
  - Nach jedem Routenwechsel wird nach oben gescrollt.
- **Meta:**
  - Jede Seite hat `description`, `author`, `robots`, `canonical`, OG- und Twitter-Tags sowie JSON-LD (WebSite/Person, CollectionPage, BreadcrumbList, BlogPosting/Article).
  - `theme-color` ist `#003B73`.
  - Favicon `/favicon.svg`, Manifest `/site.webmanifest`.
  - Abgelegt in `migration/inventory/site/*/meta.json`.
- **Query-Parameter:** keine.
- **Impressum und Datenschutz:** **nicht vorhanden**, in keinem der beiden Repos.
- **Glossar:** Route deaktiviert (`GlossaryPage.tsx`, `src/data/glossary.json`), nicht erreichbar, wird nicht portiert.
- **Netlify-Verhalten** (live gemessen):
  - `/tools`, `/blog`, `/blog/<slug>` → **301** auf die Version mit `/`.
  - `/tools/` → 200.
  - `/tools/*` → **302** auf `https://batterytank.onrender.com/:splat` (erzwungen, auch für `/tools/index.html`).
  - alles Unbekannte → `index.html` mit Status 200 (SPA-Fallback).
  - `/TOOLS/` → 301 auf `/tools/`.
- **Headers** (`public/_headers`): `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), geolocation=(), microphone=()`.
- **Sonstige Dateien:**
  - `sitemap.xml` mit 4 URLs, lastmod 2026-03-16
  - `robots.txt`, das AI-Crawler explizit erlaubt
  - `llms.txt`.

### 3.2 Suite (Streamlit, Render)

- **Es gibt nur eine URL.** Der Router läuft über `st.session_state.page` (`app.py`).
  - Navigation erfolgt per Button-Callback.
  - Ein Reload oder eine neue Sitzung landet immer auf der Landing-Page.
  - Die Browser-Zurück-Taste verlässt die App, weil es keine History-Einträge gibt.
  - Jeder Pfad liefert die App (`/foo` → 200).
- **Ausgeliefertes HTML:** `<title>Streamlit</title>`, keine Meta-Description. Titel und Favicon setzt erst JS über `st.set_page_config`.

| Seite (session_state) | Titel (`page_title`) | Favicon (Emoji als SVG-Data-URL) | erreichbar |
|---|---|---|---|
| Landing | Battery Tool Suite | 🔋 | ja (Start) |
| Materials | Material Tank Explorer | 🪣 | Button "Open Materials" |
| Cell Reconstruction | Battery Tank Tool | 🔋 | "Open Cell Reconstruction" |
| Blending | Blend OCV Tool | 🧪 | "Open Blending" |
| Aging | Aging Modes Tank Tool | 🧓 | "Open Aging" |
| Swelling | Swelling Tool | 🫁 | "Open Swelling" |
| Free Demo (`batterytank_demo.py`) | Battery Tank Tool | 🔋 | **nein**, beide Einstiege in `landing.py` sind auskommentiert |

- **Favicon:** Streamlit 1.47 erzeugt `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>EMOJI</text></svg>`. Das ist ohne externe Anfrage und wird mit dem System-Emoji gerendert.
- **Landing-Page:**
  - H1 "🪣 Charge Tanks Suite" mit Untertitel.
  - Darunter 5 Karten in 2 Zeilen (3 + 2 Spalten). Jede Karte besteht aus HTML-Karte, Button und Thumbnail-PNG.
  - Danach Divider, "💌  Email"-Linkbutton (`mailto:lars@chargetanks.com`), Footer "© 2025 Lars von Kolzenberg / Built with Streamlit - v0.7.0 / For educational use only".
  - `cta_and_disclaimer` legt leere Spalten an (`left_pad`, `col1`, `col2`, `right_pad`); sie haben keine sichtbare Wirkung, belegen aber Platz.
- **Jedes Tool hat eine Sidebar** mit "⬅ Back to Landing", Divider, Eingaben, Divider, "💌 Send me an Email" (mailto, `target=_blank`), Divider und Footer (grau).

### 3.3 Redirect-Tabelle alt → neu (Vorschlag, Freigabe offen, siehe §15)

| Alt | Neu | Art |
|---|---|---|
| `chargetanks.com/` | `/` | gleich |
| `/blog/`, `/blog/two-tank-battery-model/` | gleich | gleich |
| `/tools/` | `/tools/` | gleich (Webseiten-Toolseite) |
| `/tools`, `/blog`, `/blog/<slug>` (ohne `/`) | → mit `/` | 301 (Netlify-Standard, bleibt) |
| `/tools/*` (bisher 302 → Render) | existierende Tool-Seiten direkt, sonst → `/tools/suite/` | 302, Netlify-Regel ohne Force |
| `batterytank.onrender.com/*` | – | entfällt: Render wird nach dem Umzug geschlossen (Entscheidung 2026-10-13); alte Links auf batterytank.onrender.com laufen dann ins Leere |
| Suite-Seite "Materials" usw. (bisher ohne URL) | `/tools/materials/`, `/tools/cell-reconstruction/`, `/tools/blending/`, `/tools/aging/`, `/tools/swelling/` | neu |
| unbekannte Pfade | `404.html` mit Status 404 | **Abweichung**: bisher 200 + React-404 |
| `/.netlify/functions/visitor-country` | entfällt | Tracking entfällt |

---

## 4. Tools – Inventar

Quellen: Code (`legacy/ocv_teaching@master/apps/*.py`), AppTest-Inventar `migration/inventory/suite/apptest/*.json` und Browser-Messung `migration/inventory/suite/*/`.

### 4.1 Allgemein (gilt für alle Tools)

- **Layout:**
  - `layout="wide"`
  - Sidebar mit 256 px bei 1280 px Viewport, mobil eingeklappt (Overlay mit «-Button)
  - Inhalt mit max. ca. 864 px Breite
  - `st.columns`: auf 390 px untereinander.
- **Rerun sofort bei jeder Eingabeänderung.** Es gibt keine Formulare.
  - Slider übernehmen den Wert **schon während des Ziehens**, verzögert. Gemessen: Der Chart-Marker sprang bei gedrückter Maus auf 0.82.
  - Tastatur: ← → ändern um einen Schritt, PageUp um 10 Schritte. Bei "Home" wurde keine Änderung gemessen (Probe uneindeutig, in Phase 1 nachmessen).
- **Widget-State:**
  - Beim Verlassen eines Tools über die Landing-Page werden die Widget-Werte verworfen. Zurück im Tool gelten wieder die Defaults.
  - Gleiche Keys in mehreren Tools (`slider_soc`, `select_anode`, `select_cathode`) übertragen keine Werte, weil die Landing dazwischen liegt.
- **Slider-Anzeige:**
  - Wert über dem Thumb und Min/Max darunter, alle in Source Code Pro.
  - Format `%0.2f` (Streamlit-Default für float).
- **Caching:** `@st.cache_data` und `@st.cache_resource` beschleunigen nur. Sie sind ohne sichtbaren Effekt und ohne Spinner.
- **Meldungen:** Es gibt keine Fehler-, Warn- oder Info-Meldungen. Das AppTest-Inventar meldet 0 Exceptions auf allen Seiten.
- **Expander** "🧠 What does this tool show?" ist standardmäßig zu.

### 4.2 Materials (`apps/material_tanks.py`)

| Widget | Typ | Default | Min/Max/Step | Key | Help |
|---|---|---|---|---|---|
| Material | selectbox | Ideal Anode | Optionen: Ideal Anode, Ideal Cathode, Graphite, LCO, LFP, NCA, NMC, Silicon | `slider_material` | – |
| SoL | slider float | 0.50 | 0.00 / 1.00 / 0.01 | `slider_sol` | – |

- **Sidebar-Header:** "Choose your material".
- **Ausgaben:**
  - Titel "🪣 Understand Materials with the Tank Analogy" und Expander.
  - Zwei Spalten (gap medium):
    - links "🪣 Electrode dQ/dV Tank" (h3, zentriert), Tank-Chart 500×500 (±dQ/dV über −V, Füllung "Lithium" bis SoL)
    - rechts "📈 Voltage vs. SoL", OCV-Chart 500×500 mit Marker.
- **Achsbereiche** werden aus den Daten berechnet: `xlim = max(1.5, ceil(1.25·max|dQ/dV|))`, Spannungsbereich mit Padding.
- **Quirk:** Die Füll-Spur hat keinen `mode`. Plotly nutzt bei weniger als 20 Punkten `lines+markers`, deshalb sieht man bei Ideal-Materialien (11 Punkte) Punkte an den Rändern.

### 4.3 Cell Reconstruction (`apps/cell_tanks.py`)

| Widget | Typ | Default | Min/Max/Step | Key |
|---|---|---|---|---|
| Anode | selectbox | Ideal Anode | Ideal Anode, Graphite, Silicon | `select_anode` |
| Cathode | selectbox | Ideal Cathode | Ideal Cathode, LCO, LFP, NCA, NMC | `select_cathode` |
| SoC | slider | 0.50 | 0.00/1.00/0.01 | `slider_soc` |
| V min [V] | slider | 2.00 | 2.00/3.50/0.01 | `slider_vmin` |
| V max [V] | slider | 4.00 | 3.50/4.50/0.01 | `slider_vmax` |
| NP Ratio | slider | 1.00 | 0.80/1.50/0.01 | `slider_np` |
| LiP Ratio | slider | 1.00 | 0.50/1.50/0.01 | `slider_lip` |

- **Sidebar-Überschriften:** Header "🔧 Adjust Cell Settings", Subheader "Cutoff Voltages" (vor V min) und "Capacity Ratios" (vor NP).
- **Ausgaben:**
  - Titel "🔋 Understand Batteries with the Tank Analogy" und Expander (**Quirk: als Codeblock gerendert**, §13).
  - Zwei Spalten:
    - "🔋 Electrode dQ/dV Tanks" (Tank-Chart 650 hoch): BOL-Kurven gestrichelt, Füllungen, ΔV-Doppelpfeil mit "ΔV = x.xx V", "Q<sub>an</sub> = x.xx Ah", "Q<sub>cath</sub> = x.xx Ah", gepunktete Referenzlinien
    - "📈 Voltage vs. SoC" (650 hoch): OCV BOL gestrichelt, "Battery OCV" und Marker (SoC, ΔV).
- **Auflösung** 400.

### 4.4 Blending (`apps/blending_tanks.py`)

| Widget | Typ | Default | Min/Max/Step | Key |
|---|---|---|---|---|
| SoL (Blend) | slider | 0.50 | 0.00/1.00/0.01 | – (auto) |
| q% (Material A) | slider | 0.70 | 0.00/1.00/0.01 | – (auto) |

- **Sidebar-Header:** "Blend Setup". Die Materialien sind fest: A = Graphite, B = Silicon.
- **Ausgaben:**
  - Titel "🧪 Blend OCV Tool" und Expander.
  - Zwei Spalten mit je zwei Charts (450 hoch), jeweils mit h3-Markdown:
    - "🪣 Tanks of Each Material"
    - "🪣 Blend Tank (Sum of Both)"
    - "🔋 Voltage from Water Level"
    - "🔀 Mapping SoLs to Blend SoL".
- **Auflösung** 3000.

### 4.5 Aging (`apps/aging_demo.py`)

| Widget | Typ | Default | Min/Max/Step | Key |
|---|---|---|---|---|
| Anode | selectbox | Ideal Anode | wie oben | `select_anode` |
| Cathode | selectbox | Ideal Cathode | wie oben | `select_cathode` |
| SoC | slider | 0.50 | 0.00/1.00/0.01 | `slider_soc` |
| Cathode LAM (lampe) | slider | 0.00 | 0.00/0.50/0.01 | `slider_lampe` |
| Anode LAM (lamne) | slider | 0.00 | 0.00/0.50/0.01 | `slider_lamne` |
| LLI (lithium loss) | slider | 0.00 | 0.00/0.50/0.01 | `slider_lli` |

- **Sidebar-Überschriften:** Header "🔧 Adjust Cell Settings", Markdown-Trenner "---", Subheader "🧓 Aging Modes".
- **Zelleinstellungen** hängen von der Materialwahl ab:
  - Ideal Anode + Ideal Cathode: np 1.0, lip 1.0, 2.0–4.0 V
  - alle anderen Kombinationen: np 1.1, lip 0.95, 2.8–4.2 V.
- **Ausgaben:**
  - Titel "🧓 Understand Aging Modes with the Tank Analogy" und Expander.
  - Subheader **"Capacities (relative to cathode). SoH: {100·soh:.2f}%"**.
  - Balken-Chart über volle Breite (420 hoch): Lithium/Anode/Cathode horizontal, BoL gestrichelt, weiße Limit-Linie, Werte-Labels `:.2f`.
  - Zwei Spalten (gap large): "🔋 Electrode dQ/dV Tanks" und "📈 Voltage vs. SoC" (je 650).
- **Auflösung** 600.

### 4.6 Swelling (`apps/swelling_demo.py`)

| Widget | Typ | Default | Min/Max/Step | Key |
|---|---|---|---|---|
| SoC | slider | 0.50 | 0.00/1.00/0.01 | `slider_soc` |
| State of Health | slider | 1.00 | Code: 1.0/0.8/**−0.01** → Streamlit: min 0.80, max 1.00, step −0.01 | `slider_soh` |
| Cylindrical? | checkbox | aus | – | – (auto) |
| Compression [MPa] | slider (nur wenn nicht Cylindrical) | 0.00 | 0.00/60.00/1.0 | – (auto) |

- **Sidebar-Header:** "🔧 Swelling conditions".
- **Materialien fest:** Silicon und NMC mit np 1.1, lip 0.95, 2.8–4.2 V.
- **Stapel:** an_cc 18, an 7, sep 20, cath 47, cath_cc 15 µm; Porositäten sep 0.4, an 0.3, cath 0.25; v_sei 39.56; 200 SoC-Punkte.
- **Ausgaben:**
  - Titel "🫁 Understand Swelling" und Expander.
  - Zwei Spalten (gap large):
    - "Electrode Stack Geometry": Rechtecke mit "Name — x.xxx" und "Total: x.xxx"
    - "Stack by categories": gestapelte Flächen, Marker, Hover `%{customdata[0]:.4f}` und "SoC: %{x:.3f}<br>Total: %{y:.4f}".
  - Darunter "Compression vs. porosity" (volle Breite, 500 hoch, Hover "Porosity: %{x:.4f}<br>Compression: %{y:.2f} MPa").
- **Verhalten:** Wird "Cylindrical?" ein- und wieder ausgeschaltet, steht Compression wieder auf **0.00** (gemessen 5.00 → 0.00).

### 4.7 Free Demo (`apps/batterytank_demo.py`, nicht erreichbar)

- **Widgets:** SoC (`slider_soc`), V_min [V] 2.0–3.5 (`slider_vmin`), V_max [V] 3.5–4.5 (`slider_vmax`), nur Ideal-Materialien.
- **Technik:** `go.FigureWidget` in `session_state`, braucht anywidget/ipywidgets.
- **Empfehlung:** nicht portieren (§15).

---

## 5. Darstellung (gemessen)

- **Theme** (`.streamlit/config.toml`): `base="dark"`, `primaryColor="#5DADE2"`, `backgroundColor="#003B73"`, `secondaryBackgroundColor="#333333"`, `textColor="#FFFFFF"`, `font="open sans"`, `server.headless=true`.
- **Schrift der Suite:**
  - Berechnet ist `font-family: "open sans"` **ohne Fallback**. Open Sans wird nicht geladen. Auf Systemen ohne installiertes Open Sans erscheint deshalb die **Browser-Standard-Serifenschrift** (Windows/Chrome: Times New Roman). Das gilt für UI und Charts (Plotly `family="Open Sans"`).
  - Geladene Fonts: `SourceCodeVF` (Slider-Werte, Codeblöcke: `"Source Code Pro", monospace`) und `MaterialSymbols-Rounded` (Icons: Expander-Chevron, Select-Pfeil, Sidebar-«). `SourceSansVF` wird nur vorgeladen.
  - Alle stammen aus dem Streamlit-Paket (OFL/Apache) und dürfen lokal eingebunden werden.
- **Schrift der Webseite:** Tailwind-Systemstack `ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"`. Es gibt keine Webfonts.
- **Hell/Dunkel nach Systemeinstellung:** **Keine** der Seiten schaltet um. Die Screenshots mit `prefers-color-scheme` light und dark sind pixelgleich (`migration/inventory/scheme/result.json`).
- **Eingeschleustes CSS in der Suite:**
  - `frontend/style.py` (jede Seite): `.block-container { padding-top: 0rem !important; padding-bottom: 0.5rem !important; }`, `.block-container h1 { margin-top: 1.5rem !important; margin-bottom: 0.5rem !important; }`.
  - `frontend/navigation.py` (Tools): `div.stButton > button:first-child` mit Breite 100 %, bg `#5DADE2`, weiß, Radius 8 px, Höhe 3em, fett; Hover bg `#0059b3`. Die Angabe **`font-size:18` ist ungültig** und wird ignoriert.
  - `frontend/sidebar.py`: `.custom-link` (Mail-Link) zentriert, weiß, Hover bg `#003B73`, dazu der graue Footer (`color:gray; font-size:.85rem`).
  - `apps/landing.py` (nur Landing):
    - `.stApp { background-color:#333333 }`. Der Hintergrund ist dort grau statt Navy, die Header-Leiste bleibt Navy.
    - `.card` bg `#333333`, Padding 24, Radius 12, Schatten.
    - `.card h2` 1.5rem.
    - `.footer`.
    - `div.stButton > button` bg `#003B73`, Radius 8, fett.
- **Berechnete Stile** aller genutzten Elementtypen liegen dedupliziert in `migration/inventory/{site,suite}/*/styles.json`. Der DOM ist in `dom.html` gesichert, inklusive Expander-Inhalt (`expander-open.dom.html`).
- **Responsiv:**
  - Suite: Spalten stapeln bei 390 px. Die Sidebar ist eingeklappt (Button `stExpandSidebarButton`) und legt sich geöffnet über den Inhalt.
  - Webseite: Tailwind-Breakpoints `sm` 640, `md` 768, `lg` 1024. Unter `md` gibt es das Hamburger-Menü.
- **Streamlit-Chrome, die nicht nachgebaut wird** (laut Auftrag): Header-Toolbar mit "Deploy" (nur lokal sichtbar) und ⋮-Menü, Running-Statusanzeige, Stale-Dimmen während Reruns. Die **Header-Leiste als Fläche** bleibt aber erhalten (Höhe und Farbe), sonst verschiebt sich das Layout.

---

## 6. Charts

| Tool | Charts | Bibliothek |
|---|---|---|
| Landing | – (Thumbnails sind PNG-Bilder) | – |
| Materials | 2 (500 hoch) | Plotly (`st.plotly_chart`, `use_container_width=True`) |
| Cell Reconstruction | 2 (650) | Plotly |
| Blending | 4 (450) | Plotly |
| Aging | 3 (420 Balken + 2 × 650) | Plotly |
| Swelling | 3 (500) | Plotly |

- Es gibt kein Altair, kein `st.line_chart` und kein angezeigtes Matplotlib. Matplotlib wird nur importiert (`common.py`, `utils.py`).
- **plotly.js 3.0.1** ist im Streamlit-1.47.0-Frontend gebündelt (`src/version.js` im Bundle). Plotly.py 6.6.0 liefert nur die Figure-Spec.
- **Streamlit-Overlay:**
  - Streamlit ersetzt das Template durch ein eigenes, unter anderem mit Font `open sans` 12 und Farbe `#e6eaf1`. Es ist in `migration/inventory/suite/*__1280/plotly.json` (Feld `template`) gesichert.
  - Explizit gesetzte Layout-Werte der Figure haben Vorrang.
- **Plotly-Config von Streamlit:**
  - `displayModeBar: "hover"`, `displaylogo: false`
  - `modeBarButtonsToRemove: ["sendDataToCloud","lasso2d","select2d"]`
  - **`modeBarButtonsToAdd`: ein eigener "Fullscreen"-Button**
  - `responsive: false`, `autosizable: false`
- **Breite:** `use_container_width` überschreibt die Figure-Breite mit der Spaltenbreite (gemessen 416/400/864 px bei 1280). Die Höhe kommt aus der Figure.

---

## 7. Rechenlogik

Kern (`src/ocv_teaching/`):
- `cell_reconstruction.py` (`CellOCVReconstruction`: `get_stoichiometries`, `reconstruct_voltage`, `simulate_aging_modes`)
- `battery_tank_plotter.py` (Version **master**: `plot_tanks`, `fill_tanks`, `add_reference_voltage_lines`, `plot_voltage_vs_soc`, `plot_voltage_point`)
- `blend_ocv_reconstructor.py`
- `SwellingModel.py`
- `utils.py` (`interpolate`, `get_material`, `get_all_materials`, `get_material_names` mit Priorität Ideal-Materialien)
- `activematerial_reduced.py` (`ocv_pchip`)
- dazu Rechnungen in den Apps selbst: Achsbereiche in `material_tanks.py`, `compute_caps_simplified` in `aging_demo.py`, Labelpositionen und Nearest-Lookup in `swelling_demo.py`.

| Verfahren | Wo | Parameter / Semantik, die exakt nachzubauen ist |
|---|---|---|
| `scipy.interpolate.interp1d(kind="linear", fill_value="extrapolate", bounds_error=False, assume_sorted=False)` | `utils.interpolate` (Zellrekonstruktion, Füllung, Blend) | sortiert stabil (`argsort`, mergesort); `searchsorted(side="left")`, `clip(1, n-1)`; `y = slope*(x-x_lo)+y_lo` mit `slope=(y_hi-y_lo)/(x_hi-x_lo)`; Extrapolation über Rand-Segmente |
| dto. mit `fill_value=(below, above)` | Blend (V → SoL) | Weg über `np.interp` im Bereich, außerhalb Tupelwerte |
| `PchipInterpolator(x, y, extrapolate=False)` | `ocv_pchip` (Füllkurven, Referenzlinien, ΔV) | scipy-Ableitungen (harmonisches Mittel innen, 3-Punkt-Randformel mit Formerhaltung), PPoly-Auswertung; außerhalb → NaN |
| `np.interp` | Plotter (`plot_tanks`), Swelling, Materials, `evaluate_sol` | Klemmen an den Rändern; Sonderfall `x == xp[j]` → `yp[j]`; NaN-Nachkorrektur |
| `np.linspace` | überall | `i*step+start`, **letzter Wert exakt = stop** |
| `np.clip`, `np.nanmin/nanmax`, `np.ceil`, `cumsum`, `Series.between` (inklusiv) | diverse | – |
| `Index.get_indexer([soc], method="nearest")` | Swelling | bei Gleichstand gewinnt der **rechte** Index (monoton steigend). SoC 0.50 liegt auf dem 200er-Gitter genau zwischen 99 und 100, entscheidend ist die float64-Rundung |
| `**`, `**(1/m)` | Swelling (Gibson-Ashby) | libm-`pow` (±1 ulp zwischen Plattformen) |

- **Kein ODE-Löser** (`solve_ivp`), keine Optimierung, keine Zufallszahlen. Alles ist deterministisch.
- **Formatierung:** Python-f-Strings `:.2f` (ΔV, Q, Balken, SoH ×100) und `:.3f` (Layer, Total). Hover-Formate formatiert plotly.js (d3-format) aus den Rohwerten.
- **Python→JS-Fallstricke, die hier konkret auftreten:**
  - `f"{x:.2f}"` gegen `toFixed`: exakte Ties (etwa 0.125) und `-0.0` (Python `-0.00`, JS `0.00`)
  - `np.linspace`-Endpunkt
  - `interp1d`-Segmentwahl genau auf Stützstellen
  - PCHIP-Ränder
  - nearest-Gleichstand
  - NaN aus PCHIP außerhalb des Bereichs, das Plotly als Lücke zeigt.

---

## 8. Daten und Assets

| Datei | Format | Größe | Verwendung |
|---|---|---|---|
| `src/ocv_teaching/material_jsons_reduced/*.json` (8) | JSON (records); Spalten `SoL, dQ_dV_cha, dQ_dV_dis, Molar Volume Li cm3/mol, Molar Volume cm3/mol, OCV_cha, OCV_dis, SoL_prac` | 134–140 KB (400 Zeilen), 1,9 KB (Ideal, 11 Zeilen) | alle Tools |
| `material_jsons/*.json` (Repo-Wurzel) | JSON | 88–94 KB | **nicht genutzt**, nicht im Docker-Image |
| `apps/thumbnails/*.png` (6) | PNG | 35–63 KB | Landing (5 genutzt; `demo_thumbnail.png` nur in der auskommentierten Free Demo) |
| `public/images/lars.jpg` | JPEG | **13,7 MB** | About Me (1:1 übernehmen, für den Verbesserungsschritt vormerken) |
| `public/images/cell_thumbnail.png` | PNG | 63 KB | Tools-Teaser, `/tools/` |
| `public/images/introduction_post/*.png` (7) | PNG | 24–98 KB | Blogartikel, OG-Bild |
| `public/favicon.svg`, `site.webmanifest`, `robots.txt`, `llms.txt` | Text | < 1 KB | Webseite |
| `posts/two-tank-battery-model.md` | Markdown + Frontmatter | 8 KB | einziger Artikel |

- **Eigenschaften der Materialdaten:** `SoL` und `SoL_prac` steigen streng, OCV fällt streng, es gibt keine NaN. **dQ/dV ist negativ gespeichert.** `kind` ist "Anode"/"Cathode".
- **Fonts aus dem Streamlit-Paket** (für die Suite nötig): `SourceCodeVF-Upright.ttf.woff2`, `MaterialSymbols-Rounded.woff2`.
- **Für das Repo nicht nötig:** `texts/`, `notebooks/`, `output/`, `.template/`, `images/` (Webseiten-Wurzel, Duplikate).

---

## 9. Externe Dienste und Secrets

| Dienst | Wo | Was | Ohne Server möglich? | Entscheidung |
|---|---|---|---|---|
| Supabase `event_logs` (Webseite) | `src/lib/tracking.ts` | `page_view`, `scroll_50`, `scroll_90`, `session_duration`; Props page, referrer, Land; anon-Key im Bundle (`VITE_SUPABASE_*`) | nur mit anon-Key + RLS, aber Fremd-Domain | **entfällt** (2026-10-13) |
| Netlify Function `visitor-country` | `netlify/functions/visitor-country.mjs` | Land aus `context.geo` | nein (Server-Funktion) | entfällt |
| Supabase `event_logs` (Suite, serverseitig) | `frontend/event_tracker.py` | `SessionStart` (Props url, referrer, location, device_type, user_agent), jede Widget-Änderung (`soc`, `v_min`, …, `{from,to}`), `UpdateLatency` (ms); `app_name` "BatteryTank". Mitschnitt: `migration/.work/tracking-*.jsonl` (lokal) | wie oben | entfällt |
| ipapi.co | `event_tracker.init_session` | Geo-Abfrage **vom Server**, liefert also den Render-Standort (Bug) | – | entfällt |
| Streamlit-Telemetrie | Streamlit-Frontend | `https://data.streamlit.io/metrics.json` beim Laden (einzige gemessene Fremd-Domain der Suite) | – | entfällt (Streamlit-intern) |
| streamlit-authenticator, `secrets/config.yaml`, `CONFIG_PATH`, Render Secret File `/etc/secrets/config.yaml` | `apps/landing.py` | Login, **auskommentiert** (`logged_in = True`) | – | nicht portiert, ohne Funktion |

- **Secrets:** Es gibt nur anon-Keys (`SUPABASE_URL`/`SUPABASE_ANON_KEY` auf Render, `VITE_SUPABASE_*` auf Netlify). Ohne Tracking braucht **keine Funktion ein Secret**. Die Env-Variablen auf Render und Netlify sind nicht eingesehen (offene Frage §15).
- **Lokale Messungen:** Tracking war gestubbt (`migration/stubs/supabase`), ausgehender Server-Traffic lief ins Leere (Proxy), fremde Browser-Anfragen wurden blockiert. Es ist **nichts an Supabase oder Render gegangen**.

---

## 10. Doppelte Logik

| Was | Webseite (main) | Suite (master) | Ergebnis |
|---|---|---|---|
| Farbpalette | `tailwind.config.js` | `viz/theme.py` | **identische Werte**, wird in `styles.css` zu einer Variablenliste zusammengeführt |
| E-Mail/Footer | Footer (Mail, LinkedIn) | Sidebar und Landing (Mail) | unterschiedliche Texte, bleiben getrennt |
| Physik in TS | – (nur `claude_refactor`, nicht live) | Python | **abweichend**: PCHIP-Ränder `d[0]=delta[0]` statt scipy-3-Punkt-Formel, `linspace` ohne exakten Endpunkt, andere Operationsreihenfolge → **wird nicht übernommen** |
| Material-JSONs | – (nur `claude_refactor`) | `material_jsons_reduced` | Ausgangsdaten sind die Python-Dateien |

---

## 11. Entscheidungen

| Datum | Entscheidung | Von |
|---|---|---|
| 2026-10-13 | Referenz ist der Live-Stand: `chargetanks@main` und `ocv_teaching@master` (keine Feature-Branches) | Auftraggeber |
| 2026-10-13 | Tracking (Webseite und Suite) entfällt; Original-Events sind in §9 dokumentiert | Auftraggeber |
| 2026-10-13 | Referenz-Umgebung der Suite per `--uploaded-prior-to 2026-03-09T22:04:49Z` (Render-Stand) | Bestandsaufnahme (belegt §2) |
| 2026-10-13 | Messungen mit Playwright 1.50 (Chromium), dsf 1, `color_scheme` light, `is_mobile` aus, Viewport-Höhe für Suite-Screenshots auf Inhaltshöhe gestreckt | Bestandsaufnahme |
| 2026-10-13 | F1 keine Free Demo · F2 URLs `/tools/suite/` und `/tools/<tool>/` · F3 Webseite mit den Texten der React-Ansicht · F4 Tailwind → semantische Klassen in `styles.css` · F5 Fullscreen-Button mitnehmen · F6 `404.html` mit 404 · F7 Supabase-Variablen nur fürs Tracking (entfällt) · F8 Impressum/Datenschutz für den Folgeschritt vormerken · F9 Netlify bleibt | Auftraggeber |
| 2026-10-13 | Render wird nach dem Umzug geschlossen; keine Weiterleitung von batterytank.onrender.com | Auftraggeber |
| 2026-10-13 | Selectbox als natives `<select>` (Abweichung D7) | Auftraggeber |
| 2026-10-13 | Pilot: Aging; Zahlen-Toleranz 1e-12 relativ, angezeigte Texte exakt (§14.3) | Plan Phase 1, freigegeben |
| 2026-10-13 | Materialdateien bytegleich mit Slug-Namen (`ideal-anode.json` …) + `index.json` | Umsetzung (Hash-Test) |

## 12. Abweichungen (vorgeschlagen = Freigabe offen)

| # | Abweichung | Grund | Status |
|---|---|---|---|
| A1 | Kein Tracking, keine Visitor-Country-Function, keine Streamlit-Telemetrie | Regel "keine fremden Domains", Entscheidung 2026-10-13 | ✅ freigegeben |
| A2 | Jedes Tool bekommt eine eigene URL. Reload bleibt im Tool, Browser-Zurück führt zur Landing. Original: eine URL, Reload → Landing | statische Seiten | ✅ freigegeben (F2) |
| A3 | Unbekannte Pfade bekommen `404.html` mit Status 404 statt 200 + SPA-404 | statisch, kein SPA-Router | ✅ freigegeben (F6) |
| A4 | Pro Webseiten-URL nur die React-Fassung (Crawler-Snapshot-Texte entfallen) | ein HTML je Seite | ✅ freigegeben (F3) |
| A5 | Streamlit-Chrome entfällt (Deploy, ⋮-Menü, Running-Anzeige, Stale-Dimmen); Header-Fläche bleibt | Auftrag | ✅ laut Auftrag |
| A6 | Login/Authenticator wird nicht portiert (im Original ohne Funktion) | toter Code | 🟡 vorgeschlagen |
| D7 | Selectbox als natives `<select>`: geschlossen 1:1 (gemessen: Pfeil, Rahmen, Fokusrahmen nach Auswahl); aufgeklappt die Liste des Browsers/Betriebssystems, kein Tipp-Filter (Anfangsbuchstabe springt) | Grundsatz "native Elemente" | ✅ freigegeben (2026-10-13) |
| D8 | Kein Header-Inhalt rechts ("Deploy", ⋮). In jedem Suite-Screenshot ≈ 250 Pixel Unterschied genau dort | Teil von A5 | ✅ laut Auftrag |
| D9 | Sidebar-Breite wird wie im Original in `localStorage` (`sidebarWidth`) gespeichert – jetzt unter der Domain chargetanks.com statt batterytank.onrender.com (früher gespeicherte Breiten gehen verloren) | anderer Ursprung | ℹ️ Hinweis |
| D10 | Landing-Buttons "Open …" und "⬅ Back to Landing" sind Links (`<a href="/tools/…/">`) statt `<button>` mit Seitenwechsel im Session-State. Aussehen und Zustände (Hover, Active, Fokusring) gemessen gleich; Unterschiede: Leertaste löst einen Link nicht aus (Enter schon), Mittelklick/„In neuem Tab öffnen“ funktioniert jetzt | Folge von A2/F2 | ℹ️ Folge von F2 |

## 13. Mitportierte Bugs und Quirks (am laufenden Original gemessen)

| # | Was | Beleg |
|---|---|---|
| B1 | Expander Cell Reconstruction: Markdown beginnt ohne Zeilenumbruch, `dedent` greift nicht. Nur der erste Satz ist Text, alles andere ein **Codeblock** mit rohen `**` | `suite/cell-reconstruction__expander-open__1280.png` |
| B2 | SoH-Slider `st.slider(…, 1.0, 0.8, 1.0, -0.01)`: Streamlit macht daraus min 0.8, max 1.0, step −0.01. Rastung um −0.01 versetzt: Maus auf Mitte → **0.89**, ganz links → **0.79 (unter Minimum)**; Pfeil rechts von 1.00 → **0.98**; Pfeil links danach ohne Wirkung | `inventory/suite/behaviour*.json` |
| B3 | Compression-Slider ohne Key: nach Cylindrical an/aus wieder 0.00 | `behaviour.json` |
| B4 | Ungültiges CSS `font-size:18` am Back-Button (ohne Wirkung) | `frontend/navigation.py` |
| B5 | Kompressions-Chart wird in der Label-Schleife 5× gebaut (unsichtbar, nur Rechenzeit) | `swelling_demo.py:384` |
| B6 | Schrift "open sans" ohne Fallback → Serifenschrift | §5 |
| B7 | Swelling: Label "SEI" überlagert "Anode Particles" bei SoH 1.0 (SEI-Dicke 0) | `suite/swelling__default__1280.png` |
| B8 | Materials: Punkte an der Füllfläche bei Materialien mit < 20 Stützstellen (Plotly-Default-Mode) | §4.2 |
| B9 | Webseite: `posts/README.md` wird mit ins Bundle geladen (vom Parser verworfen, unsichtbar) | Bundle-Diff |
| B10 | Tracking-Geo vom Server statt vom Besucher | entfällt mit A1 |
| B11 | Aging: Die Anker-ID der Zeile "Capacities … SoH: …" bleibt beim ersten Wert (`…-so-h-100-00`), auch wenn der Text z. B. 70.85 % zeigt | Browser-Vergleich (`inventory/compare/aging.json`), portiert in `assets/js/ui/heading.js` |
| B12 | Aging: Die gepunkteten Referenzlinien im Tank-Chart zeigen immer den BOL-Zustand (`add_reference_voltage_lines` ohne Aging-Parameter aufgerufen) | `aging_demo.py:290`, portiert in `assets/js/model/aging.js` |
| B13 | Landing: Der Vollbild-Button der Vorschaubilder ist per Tab erreichbar, die Werkzeugleiste bleibt dabei aber unsichtbar (opacity 0); der Fokus zeigt sich nur als hellerer Button-Hintergrund. Nach Vollbild an/aus geht der Fokus verloren (Leiste wird neu aufgebaut) | `migration/landing_compare.py` + Fokus-Probe (§18.3), portiert in `styles.css`/`assets/js/ui/image.js` |

---

## 14. Vorschläge (Freigabe offen)

### 14.1 Zielstruktur

```
index.html  404.html
blog/index.html  blog/two-tank-battery-model/index.html
tools/index.html                          # Webseiten-Toolseite (wie heute)
tools/suite/index.html                    # Streamlit-Landing "Charge Tanks Suite"
tools/{materials,cell-reconstruction,blending,aging,swelling}/index.html
assets/css/styles.css                     # Theme als CSS-Variablen; Webseite + Suite
assets/js/core/      # numpy/scipy/pandas/Python-Format-Nachbildungen (ohne DOM)
assets/js/model/     # Port von ocv_teaching (ohne DOM)
assets/js/ui/        # Widgets (Slider, Select, Checkbox, Expander, Sidebar), Plotly-Helfer
assets/js/tools/     # ein Einstiegsmodul je Tool
assets/vendor/plotly-3.0.1.min.js (+ Lizenz)
assets/fonts/        # SourceCodeVF, MaterialSymbols-Rounded (aus Streamlit 1.47.0)
assets/data/materials/*.json   assets/img/…
favicon.svg site.webmanifest robots.txt sitemap.xml llms.txt _redirects _headers
tests/  tests/golden/  migration/  MIGRATION.md  README.md
package.json         # nur {"type":"module", "scripts":{"test":"node --test"}}, keine Dependencies
```

### 14.2 Portierbarkeit pro Tool

Ergebnis: **Alle fünf Tools lassen sich sauber als reiner JS-Port umsetzen (Variante a).** Pyodide (b) oder eine API (c) sind nicht nötig. Es kommen nur deterministische Grundverfahren vor (§7), die sich Operation für Operation nachbilden lassen. Die Rechenzeit liegt bei Gittern bis 3000 Punkten im Millisekundenbereich, ein Web Worker ist voraussichtlich nicht nötig. Das wird im Pilot gemessen.

| Tool | Rechnung | Port | Risiko |
|---|---|---|---|
| Materials | interp, linspace, Achsbereiche | JS | gering |
| Cell Reconstruction | interp1d (extrapolate), PCHIP, linspace | JS | mittel (PCHIP-Ränder, Segmentwahl) |
| Blending | interp1d mit Tupel-Fill, np.interp (3000 Punkte) | JS | gering–mittel |
| Aging | wie Cell + Kapazitäten/SoH | JS | mittel |
| Swelling | Zellrekonstruktion, np.interp, pow, nearest | JS | mittel (nearest-Gleichstand, pow) |

**Pilot (Phase 1):** Aging. Es nutzt den gemeinsamen Kern (Rekonstruktion und Tank-Plotter) und hat die meisten Eingaben und Ausgabetypen (Balken, Subheader-Wert, materialabhängige Einstellungen).

### 14.3 Toleranzen für den Zahlenvergleich

| Größe | Toleranz | Begründung |
|---|---|---|
| Angezeigte Texte (ΔV, Q, SoH, Balkenwerte, Layer/Total, Slider-Werte, Achsen- und Hover-Texte) | **exakt gleich** | sichtbar; eigene `pyformat()` nach Python-Semantik (Half-even bei exakten Ties, `-0.00`, `nan`, `inf`) |
| Rohwerte (Chart-Daten, Zwischenergebnisse) | `|a−b| ≤ 1e-12·max(1,|b|)` | float64 deterministisch; Unterschiede nur durch libm-`pow` und Summationsreihenfolge (wenige ulp); die Schranke ist weit darüber und deckt trotzdem jeden Algorithmusfehler auf |
| Indizes, Masken, Längen (nearest, Füllmaske, Arraylängen) | exakt | diskrete Größen |
| NaN-Positionen (PCHIP außerhalb) | exakt | sichtbare Lücken |
| Materialdaten | bitgleich (Hash) | reine Übernahme |
| Plotly-Layout (`_fullLayout`: Farben, Fonts, feste Achsbereiche, Margins) | exakt; Auto-Ranges `1e-9` relativ | Bild im Browser |

Die Golden-Werte entstehen in Phase 1 mit der Render-Umgebung (§2). Zusätzlich werden sie mit den älteren Versionen gegengeprüft (numpy 1.26.4, scipy 1.16.0, pandas 2.3.0, plotly 6.2.0), um Versionsabhängigkeit auszuschließen.

---

## 15. Offene Fragen an den Auftraggeber

| # | Frage | Empfehlung |
|---|---|---|
| F1 | Free Demo (nicht erreichbar) portieren? | **Nein**, als toter Code dokumentiert |
| F2 | URL-Schema der Suite: `/tools/suite/` und `/tools/<tool>/` (A2)? | **Ja** |
| F3 | Welche Webseiten-Fassung kommt ins HTML: React-Ansicht (was Besucher sehen) oder Crawler-Snapshot? | **React-Ansicht**; Snapshot-Texte entfallen |
| F4 | Webseiten-CSS: Tailwind-Klassen in semantische Klassen und Variablen in `styles.css` umschreiben, oder das kompilierte Tailwind-CSS (20 KB) mit Utility-Klassen übernehmen? | **Umschreiben** (wartbar ohne Build); 1:1 geprüft über berechnete Stile |
| F5 | Fullscreen-Button: Streamlit hängt ihn in die Plotly-Modebar. Mitnehmen? | **Ja**, er ist Teil der Chart-Bedienung |
| F6 | 404-Verhalten nach A3? | **Ja** |
| F7 | Gibt es auf Render oder Netlify weitere Umgebungsvariablen oder Einstellungen (z. B. Node-Version, Domains)? | bitte kurz bestätigen |
| F8 | Impressum und Datenschutz fehlen. Im Umzug nichts ergänzen (Auftrag), aber für den Folgeschritt vormerken? | vormerken |
| F9 | Auf welchem Hoster soll die statische Seite laufen (weiter Netlify)? Davon hängen `_redirects`/`_headers` ab | Netlify beibehalten |

---

## 16. Artefakte und reproduzierbare Abläufe

| Pfad | Inhalt |
|---|---|
| `migration/setup_legacy.ps1` | klont die Referenz-Commits (LF) nach `migration/.work/`, baut die Legacy-venv (Render-Stand), die Tools-venv (Playwright) und `npm ci` |
| `migration/build-legacy-site.mjs` | `verify`: Byte-Nachweis gegen live; `plain`: Build ohne Tracking |
| `migration/serve-legacy-site.mjs` | statischer Server mit nachgebildeten Netlify-Regeln (Port 4173, `/tools/*` → lokales Streamlit) |
| `migration/run_legacy_suite.ps1` | startet die Suite (Port 8501) mit Tracking-Stub, totem Proxy und isoliertem Home |
| `migration/stubs/supabase/` | Ersatz-Client, schreibt Events nach `migration/.work/tracking-*.jsonl` |
| `migration/inventory_apptest.py` | AppTest-Inventar aller Seiten → `migration/inventory/suite/apptest/` |
| `migration/inventory.py` | Playwright-Messung (`site`, `suite`, `probe`, `scheme`) → `migration/inventory/`, Screenshots → `migration/screenshots/legacy/` |
| `migration/env/` | Freeze-Dateien, Node-Version, Build-Nachweis, Legacy-Zustand vorher/nachher |
| `migration/screenshots/legacy/site/` | 6 Seiten × {js, nojs} × {1280, 390} + Hamburger-Menü offen (390) |
| `migration/screenshots/legacy/suite/` | Landing + 5 Tools × {1280, 390}; Tools zusätzlich mit offenem Expander und bei 390 mit offener Sidebar |
| `migration/fetch_vendor.mjs` | holt plotly.js-dist-min@3.0.1 vom npm-Registry (sha512 geprüft) → `assets/vendor/` |
| `migration/copy_streamlit_assets.py` | Schriften unverändert aus Streamlit 1.47.0 + Lizenztexte → `assets/fonts/` |
| `migration/convert_materials.py` | Materialdaten bytegleich mit Slug-Namen + `index.json` → `assets/data/materials/` |
| `migration/measure_ui.py` | CSS-Regel-Dump, Breakpoint-Sweep, Verhalten (Sidebar, Fullscreen, Tastatur, Debounce) → `migration/inventory/suite/` |
| `migration/make_goldens.py` | Golden-Werte (core/model/ui) aus dem Original → `tests/golden/` |
| `migration/setup_crosscheck_env.ps1` | zweite Legacy-venv mit älteren Rechenbibliotheken für die Gegenprobe |
| `migration/extract_plotly_theme.py` | Streamlits Plotly-Template/Config/Fullscreen-Icons aus dem Browser → `assets/js/ui/plotlyTheme.js` |
| `migration/compare.py`, `migration/behaviour_compare.py` | Browser-Vergleich alt/neu (Plotly-Zustand, Texte, Netzwerk, Screenshots, Vollbild, Sidebar) → `migration/inventory/compare/`, `migration/screenshots/compare/` |

### Legacy lokal starten

```powershell
powershell -ExecutionPolicy Bypass -File migration\setup_legacy.ps1      # einmalig, ca. 5–10 min
node migration\build-legacy-site.mjs plain                                # Webseite ohne Tracking bauen
node migration\serve-legacy-site.mjs 4173                                 # → http://localhost:4173/
powershell -ExecutionPolicy Bypass -File migration\run_legacy_suite.ps1   # → http://localhost:8501/
migration\.work\venv-tools\Scripts\python.exe migration\inventory.py all  # Messung + Screenshots
```

Hinweise:
- Die Suite-Screenshots sind Viewport-Aufnahmen. Die Viewport-Höhe wird dafür auf die Inhaltshöhe gestreckt, weil Streamlit in einem eigenen Container scrollt.
- Die Webseiten-Screenshots sind Full-Page-Aufnahmen nach Durchscrollen (Lazy-Bilder).


---

## 17. Phase 1 – Ergebnisse (2026-10-13)

### 17.1 Repo-Basis
- `package.json` ohne Dependencies (`"type": "module"`, `npm test` = `node --test "tests/**/*.test.js"`; ein bloßes `node --test` findet dieselben 64 Tests).
- `scripts/serve.mjs`: lokaler Server (Verzeichnis-Index, 301 auf `/`, `/tools/*` → `/tools/suite/` nur für fehlende Pfade, sonst `404.html` mit 404).
- `assets/vendor/plotly-3.0.1.min.js` (MIT, 4,65 MB): dieselbe plotly.js-Version wie im Streamlit-1.47.0-Bundle.
- `assets/fonts/`: `SourceCodeVF-Upright.woff2` (90 KB, OFL), `MaterialSymbols-Rounded.woff2` (415 KB, Apache-2.0), unverändert aus Streamlit 1.47.0.
- `assets/data/materials/`: 8 Dateien bytegleich (sha256 im `index.json`, Test `tests/data/materials.test.js`).
- `.gitattributes`: LF für Text.

### 17.2 Zusatzmessungen am Original (Spezifikation der UI)
- CSS-Regeln aller Suite-Elemente inkl. Zuständen und Media-Queries: `migration/inventory/suite/css-rules/` (inkl. `sidebar-states.json`).
- Breakpoints (`inventory/suite/breakpoints.json`): Sidebar bis 768 px eingeklappt; Block-Container 1rem → 5rem Seitenabstand ab `736px + 8rem` (864 px); Spalten stapeln ≤ 640 px; Gaps small/medium/large = 1/2/4 rem.
- Verhalten (`inventory/suite/behaviour-ui.json`, Streamlit-Quelle 1.47.0):
  - Slider: Debounce 200 ms (auch beim Ziehen), Anzeige `sprintf("%0.2f")`, Pfeile ±1 Schritt, Bild auf/ab ±10, Pos1/Ende ohne Wirkung; Wert-Label mittig über dem Thumb, am Rand bündig (`fixLabelOverflow`).
  - Sidebar: 256 px Standard, Griff 200–600 px (mobil ≤ 90 % der Fensterbreite), Breite in `localStorage` (`sidebarWidth`), Doppelklick → 256; Einklapp-Button beim Mouseover; ≤ 768 px: Klick außerhalb klappt ein, Verkleinern auf ≤ 768 px klappt ein.
  - Fullscreen (Modebar): Rahmen `position: fixed` über den Viewport, Navy, Innenabstand 46/12/12 px → Chart 1256×842 bei 1280×900; Button wird "Close fullscreen"; Escape beendet.
  - Selectbox: nach Mausauswahl bleibt sie fokussiert (Primary-Rahmen).
  - `<style>`-Markdown-Elemente sind leere Flex-Elemente und erzeugen je 1rem Abstand (übernommen).

### 17.3 Golden-Werte (`tests/golden/`, 19 MB)
- **ui** (AppTest, Plotly-Spec wie an den Browser gesendet): Landing 1, Materials 32, Cell Reconstruction 60, Blending 20, Aging 52, Swelling 29 Fälle = 194; keine Exceptions. Swelling enthält die vom Browser gelieferten SoH-Werte (0.79, 0.89 …).
- **model**: `CellOCVReconstruction` für 15 Materialpaare × 6 Einstellungen inkl. Aging-Modi (90 Fälle); `SwellingModel` (30 Fälle).
- **core**: Differential-Vektoren für Python-Format (9.165 Fälle), linspace, np.interp, interp1d, PCHIP (alle Materialkurven), nearest, pow.
- Arrays bitgenau und dedupliziert (`arrays/`, 1.775 Dateien), Plotly-Template einmal (`ui/_templates/`).
- **Determinismus:** zweiter Lauf byteidentisch.
- **Gegenprobe** mit numpy 1.26.4 / scipy 1.16.0 / pandas 2.3.0 / plotly 6.2.0: alle Arrays und alle UI-Dateien byteidentisch; Unterschied nur in drei Beschreibungstexten (Versionsnummer). Die Ergebnisse hängen also nicht von den auf Render ungepinnten Versionen ab.

### 17.4 Rechenkern (`assets/js/core/`) – bitgenau
| Baustein | Ergebnis gegen Original |
|---|---|
| `formatFixed` (Python `format(x, ".Nf")`) | 9.165/9.165 Strings identisch (inkl. Ties, `-0.00`, `nan`, `inf`, ≥1e21) |
| `linspace`, `interp` | bitgleich (inkl. Sonderfall 1 Stützstelle: NaN → `fp[0]`) |
| `interp1d` (extrapolate, Tupel-Fill) | bitgleich |
| `pchip` (scipy, Potenzsummen-Auswertung) | bitgleich auf allen Materialkurven und Zufallsdaten |
| `getIndexerNearest` | identisch |
| `CellOCVReconstruction` | bitgleich (90 Fälle, alle Arrays und Aging-Modi) |

### 17.5 `assets/css/styles.css`
- Teil A: Theme-Variablen (Palette aus `viz/theme.py` + Streamlit-Theme und gemessene abgeleitete Farben), `@font-face`.
- Teil B: alle Streamlit-Elemente der Suite (Gerüst, Sidebar, Header-Fläche, Spalten, Überschriften mit Anker, Markdown inkl. Codeblock, Slider, Select, Checkbox, Buttons inkl. eingeschleuster Stile, Linkbutton, Expander, Chart/Vollbild, Bild, Sidebar-Fußzeile, Landing-Karten).
- **Offen für Phase 2:** Checkbox (aktivierter Zustand), Linkbutton, Bild und Landing-Stile sind aus den Regeln übernommen, aber erst am jeweiligen Tool im Browser-Vergleich bestätigt.

### 17.6 Pilot Aging (`/tools/aging/`)
- Dateien: `tools/aging/index.html` (alle Texte im HTML, Default-Werte vorbefüllt), `assets/js/tools/aging.js`, `assets/js/model/{materials,cellReconstruction,figure,tankPlotter,aging}.js`, `assets/js/ui/{shell,slider,data,heading,plotly,plotlyTheme}.js`.
- **Tests (`npm test`):** 64/64 grün; Aging 52 Golden-Fälle mit 882.044 verglichenen Zahlen, **0 nicht bitgleich**, alle Texte (SoH-Zeile, ΔV, Q, Balkenwerte) identisch.
- **Browser-Vergleich** (`inventory/compare/aging.json`): 6 Zustände (Default, Graphite+NMC, Silicon+LFP gealtert, alle Aging-Regler 0.5, SoC 0, SoC 1), bedient per Klick/Pfeiltasten/Bild auf-ab: je 17.087 Zahlen aus `gd.data`, `gd.layout`, `_fullLayout`, Config sowie alle Texte – **0 Abweichungen, alles bitgleich**. Diagramm-Positionen pixelgenau gleich.
- **Screenshot-Paare** (`migration/screenshots/compare/aging/`, je `__old`/`__new`/`__diff`), alle gesichtet:

| Ansicht | Pixel-Unterschied | Benannter Unterschied |
|---|---|---|
| 6 Zustände bei 1280 px | 0,013 % (≈ 254 px) | "Deploy ⋮" im Header (D8) + 1–2 Einzelpixel Kantenglättung |
| Expander offen 1280 / 390 | 0,009 % / 0,019 % | nur D8 |
| Default 390 | 0,027 % | nur D8 |
| Sidebar offen 390 | 0,027 % | nur D8 |
| Vollbild 1280 | 0,000 % | keiner |
| Sidebar eingeklappt 1280 | 0,022 % | nur D8 |

- **Netzwerk:** nur eigene Domain, keine Konsolenmeldungen.
- **Leistung:** Rechnung 4–6 ms, Plotly je Diagramm ≈ 8 ms → kein Web Worker nötig (wie im Original kein Spinner).

### 17.7 Nächste Schritte (Phase 2)
1. Materials, Cell Reconstruction, Blending, Swelling (SoH-Slider mit negativem Schritt: react-range-Normalisierung nachbauen, B2), Landing `/tools/suite/` – je ein Commit mit Tests und Screenshot-Vergleich.
2. Webseite (Home, Blog, Artikel, `/tools/`, 404): React-Ansicht als statisches HTML, Tailwind → `styles.css` (Teil C), Vergleich über berechnete Stile und Screenshots.
3. `_redirects`/`_headers`, `sitemap.xml`, `robots.txt`, `llms.txt`, `site.webmanifest`; Netzwerk-Check aller Seiten; README final.

---

## 18. Phase 2 – Ergebnisse

Ablauf je Tool: Modell-Port → `tests/tools/<tool>.test.js` gegen `tests/golden/ui/<tool>/` → Seite (`tools/<tool>/index.html`, einmalig mit `migration/build_suite_pages.py` erzeugt, danach Quelle) + `assets/js/tools/<tool>.js` → `migration/compare.py <tool>` und `migration/behaviour_compare.py <tool>` (Legacy :8501, neu `node scripts/serve.mjs 8010`, `NEW_URL`) → Screenshots angesehen → Commit.

### 18.1 Cell Reconstruction, Materials, Blending

| Tool | Golden-Fälle / verglichene Zahlen | nicht bitgleich | Browser-Vergleich (Zustände) | Screenshot-Unterschiede |
|---|---|---|---|---|
| Cell Reconstruction | 60 / ≈ 678 k | 0 | 5, 0 Abweichungen | nur D8 („Deploy ⋮“, 252 px) + Einzelpixel |
| Materials | 32 / ≈ 64 k | 0 | 5, 0 Abweichungen | nur D8 + Einzelpixel |
| Blending | 20 / ≈ 1,93 Mio. | 0 | 5, 0 Abweichungen | nur D8 + Einzelpixel |

- Blending setzt `template="plotly"`: eigenes, im Browser gemessenes Template `PLOTLY_TEMPLATE` (`assets/js/ui/plotlyTheme.js`), Auswahl in `assets/js/ui/plotly.js`.
- Vollbild jeweils pixelgleich; keine fremden Domains, keine Konsolenmeldungen.

### 18.2 Swelling

- **Modell:** `assets/js/model/swelling.js` (SwellingModel + Figures aus `swelling_demo.py`). `x**2` auf Arrays und Python-Skalaren als `x*x`, `**0.5` als `Math.sqrt` (numpy-Fastpath) – bitgleich. B5 (Kompressions-Chart 5× gebaut) ist ohne sichtbare Wirkung und wird nur einmal gebaut.
- **Tests:** 29 Golden-Fälle, 102.834 Zahlen, **0 nicht bitgleich**. `customdata` (`np.c_`, shape 200×1) wird als Zeilen-Array gesendet wie plotly.js es dekodiert; `tests/helpers/golden.js` und der Snapshot in `compare.py` dekodieren `shape` entsprechend.
- **SoH-Slider (B2):** `assets/js/ui/slider.js` enthält `normalizeValue` aus react-range 1.x Zeichen für Zeichen (BIG_NUM 1e11, `%`, `toFixed(getStepDecimals)`). Bei negativem Schritt (`data-st-step="-0.01"`) kommen Tastatur und Zeiger ausschließlich über `normalizeValue`; der Wert darf unter min liegen (0.79), der Thumb wird wie Streamlits `getValueAsArray` auf [min, max] geklemmt. Ergebnis wie im Original: Mitte → 0.89, links → 0.79, Pfeil rechts 1.00 → 0.98 → 0.96 …, Pfeil links ohne Wirkung. Test: `tests/ui/slider.test.js`.
- **Alle Slider:** Tastatur jetzt ebenfalls über `normalizeValue` mit den react-range-Tasten (Pfeile, **k/j**, Bild auf/ab ×10; Pos1/Ende ohne Wirkung). `k`/`j` fehlten vorher; Ergebnis bei positiven Schritten sonst unverändert: Regressionslauf `compare.py` der vier anderen Tools danach mit 0 Abweichungen, 0 nicht bitgleich, Screenshots wie vorher (nur D8 + ≤ 2 Einzelpixel).
- **Cylindrical?:** blendet den Compression-Slider aus (`st-element--hidden`); da er im Original keinen `key` hat, kommt er beim Abwählen mit 0.0 zurück (`slider.reset(0)`). Aktivierte Checkbox pixelgleich.
- **Browser-Vergleich** (12 Zustände: Default, SoH per Pfeilen/k/j/Bild/Pos1/Ende, Klick Mitte/links/links+Taste, SoC per Klick+k/j, Compression 25, Cylindrical, Cylindrical+gealtert+SoC 0, Compression-Reset, gemischt): **0 Abweichungen** in Plotly-Zustand (3.651 Zahlen je Zustand, bitgleich) und Texten (Slider-Werte, Checkbox). Screenshots 1280/390 (Default, Expander, Sidebar offen) angesehen: nur D8. Vollbild pixelgleich, Sidebar eingeklappt nur D8. Netzwerk: nur eigene Domain, keine Konsolenmeldungen.
- **Gefunden und behoben:** Nach Mausklick zeigte der SoH-Thumb einen Fokusring (programmatisches `focus()` nach `preventDefault`); jetzt bleibt der native Fokus des Klicks erhalten, native Wertänderungen werden bei negativem Schritt verworfen.

### 18.3 Landing `/tools/suite/`

- **Seite:** `tools/suite/index.html` (erzeugt mit `build_suite_pages.py suite`, danach Quelle). Inhalt wie `apps/landing.py` im Live-Stand: Kopf (h1/h2 als HTML-Markdown samt Ankern), 5 Karten in Zeilen à 3 Spalten (dritte Spalte der zweiten Zeile leer), Buttons, Vorschaubilder, Trenner, leere 4er-Spaltenzeile `[1,2,2,1]` (erzeugt nur Abstand), Linkbutton „💌  Email“, Fusszeile. Free Demo und Login entfallen (F1, A6). Titel „Battery Tool Suite“, Favicon 🔋.
- **Bilder:** `assets/img/suite/*.png` bytegleich (`migration/copy_thumbnails.py`, `SHA256SUMS`). Streamlit 1.47.0 liefert `st.image(<Pfad>)` unverändert aus (`image_utils.image_to_url` liest nur die Bytes), daher identisch mit dem, was der Browser im Original bekommt.
- **Bild-Werkzeugleiste (st.image):** gemessen mit `migration/measure_landing.py` (`inventory/suite/landing-image/`): Leiste bei `top:-1rem`, unsichtbar; bei Hover nach `-2.65rem`, sichtbar (Übergang 150/100 ms); Vollbild: fester Rahmen, Padding 46/12/12, Bild in natürlicher Breite (höchstens Rahmenbreite) mit `object-fit: contain`, Body ohne Scrollen, Escape/„Close fullscreen“ beendet. Umsetzung: `assets/js/ui/image.js`, `assets/js/tools/suite.js`, CSS `.st-image-frame`/`.st-toolbar*`. Kein Tooltip (im Original nicht erschienen).
- **Tests:** `tests/tools/suite.test.js` gegen den Golden-Fall (Karten, Button-Reihenfolge und Ziele, Linkbutton, Fusszeile) und Bild-Hashes.
- **Browser-Vergleich** (`migration/landing_compare.py` → `inventory/compare/suite.json`, `screenshots/compare/suite/`): Lage und berechnete Stile von 19 Elementgruppen (Überschriften, Karten, Buttons, Bilder, Werkzeugleiste, Trenner, Spalten, Linkbutton, Fusszeile, Header, App) bei 1280 und 390 px: **0 Abweichungen**; Texte, Anker-IDs und Linkziele gleich. Screenshots ganze Seite 1280/390, Hover, Button-Hover, Vollbild und nach Escape (erstes und fünftes Bild) angesehen: nur D8; **Vollbild pixelgleich**. Hover/Active von Button und Linkbutton gleich. Netzwerk: nur eigene Domain, keine Konsolenmeldungen.
- **Gefunden und behoben (gilt für alle Suite-Seiten):** `stMain` hat im Original `tabindex="0"` (Tab-Stopp, Tastatur-Scrollen); die Seiten hatten `-1` → korrigiert in allen `tools/*/index.html`. Tab-Reihenfolge der Landing jetzt wie im Original (ohne die Header-Buttons, D8). `<a class="st-button">` zentriert Text wie ein `<button>` (`text-align: center`).

