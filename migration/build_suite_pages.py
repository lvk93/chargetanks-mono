"""Einmaliger Generator fuer die Tool-Seiten der Suite (tools/<tool>/index.html).

Erzeugt statisches HTML mit derselben Element-Reihenfolge wie die Streamlit-Originale (inklusive der
leeren <style>-Elemente, die im Original je 1rem Abstand erzeugen). Expander-Inhalte und Ueberschriften
stammen aus dem gemessenen DOM (migration/inventory/suite/*/). Die erzeugten Dateien sind danach die
Quelle; Aenderungen am Inhalt direkt im HTML vornehmen - dieses Skript nur fuer den Umzug.

Aufruf: py -3 migration/build_suite_pages.py [tool ...]
"""

import html
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent
INV = ROOT / "inventory" / "suite"

LINK_SVG = ('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" '
            'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 7h3a5 '
            '5 0 0 1 5 5 5 5 0 0 1-5 5h-3m-6 0H6a5 5 0 0 1-5-5 5 5 0 0 1 5-5h3"></path><line x1="8" y1="12" x2="16" '
            'y2="12"></line></svg>')
SELECT_SVG = ('<svg viewBox="0 0 24 24" aria-hidden="true"><path transform="rotate(270, 12, 12)" fill-rule="evenodd" '
              'clip-rule="evenodd" d="M9 12C9 12.2652 9.10536 12.5196 9.29289 12.7071L13.2929 16.7071C13.6834 17.0976 '
              '14.3166 17.0976 14.7071 16.7071C15.0976 16.3166 15.0976 15.6834 14.7071 15.2929L11.4142 12L14.7071 '
              '8.70711C15.0976 8.31658 15.0976 7.68342 14.7071 7.29289C14.3166 6.90237 13.6834 6.90237 13.2929 7.29289L9.29289 '
              '11.2929C9.10536 11.4804 9 11.7348 9 12Z"></path></svg>')
EXPANDER_SVG = ('<svg class="st-expander-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="currentColor" '
                'xmlns="http://www.w3.org/2000/svg"><path fill="none" d="M24 24H0V0h24v24z" opacity="0.87"></path>'
                '<path d="M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6-1.41-1.41z"></path></svg>')
COPY_SVG = ('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" '
            'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" '
            'width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 '
            '2v1"></path></svg>')


def anchor(anchor_id):
    return (f'<span class="st-heading-actions"><a class="st-heading-anchor" href="#{anchor_id}">{LINK_SVG}</a></span>')


# ------------------------------------------------------------------------------------------
# Elemente (je ein st-element wie stElementContainer)
# ------------------------------------------------------------------------------------------
def el(inner=""):
    return f'<div class="st-element">{inner}</div>'


def empty():
    """st.markdown("<style>...") - leeres Element (Hoehe 0, erzeugt aber den Flex-Abstand)."""
    return el()


def title(text, anchor_id):
    return el(f'<div class="st-heading"><h1 id="{anchor_id}">{text}{anchor(anchor_id)}</h1></div>')


def subheader(text, anchor_id, attrs=""):
    return el(f'<div class="st-heading"><h3 id="{anchor_id}"{attrs}>{text}{anchor(anchor_id)}</h3></div>')


def side_header(text):
    return el(f'<div class="st-heading"><h2>{text}</h2></div>')


def side_subheader(text):
    return el(f'<div class="st-heading"><h3>{text}</h3></div>')


def md(inner):
    return el(f'<div class="st-md">{inner}</div>')


def md_heading(text, anchor_id, style=None):
    style_attr = f' style="{style}"' if style else ""
    return md(f'<div class="st-heading-hover"><h3 id="{anchor_id}"{style_attr}>{text}{anchor(anchor_id)}</h3></div>')


def hr():
    return md("<hr />")


def back_button():
    return [empty(), el('<a class="st-button st-button--nav" href="/tools/suite/"><div class="st-md"><p>⬅ Back to '
                        'Landing</p></div></a>'), hr()]


def sidebar_footer():
    return [hr(), empty(),
            md('<a class="custom-link" href="mailto:lars@chargetanks.com" target="_blank" rel="noopener noreferrer">\n'
               '💌 Send me an Email\n</a>'),
            hr(),
            md('<div class="st-sidebar-footer">\n© 2025 Lars von Kolzenberg<br />\nBuilt with Streamlit - v0.7.0<br />\n'
               'For educational use only\n</div>')]


def select(input_id, label, options, selected=0):
    opts = "".join(f"<option{' selected' if i == selected else ''}>{o}</option>" for i, o in enumerate(options))
    return el(f'<div class="st-select-widget"><label class="st-label" for="{input_id}"><p>{label}</p></label>'
              f'<div class="st-select"><select id="{input_id}" name="{input_id}" autocomplete="off" data-st-input>{opts}'
              f'</select>{SELECT_SVG}</div></div>')


def slider(input_id, label, lo, hi, step, value):
    fmt = lambda v: f"{v:.2f}"  # sprintf("%0.2f") des Streamlit-Frontends
    return el(f'<div class="st-slider" data-st-slider><label class="st-label" for="{input_id}"><p>{html.escape(label)}</p>'
              f'</label><div class="st-slider-track-area"><div class="st-slider-track"><div class="st-slider-thumb">'
              f'<div class="st-slider-value">{fmt(value)}</div></div></div><input class="st-slider-input" type="range" '
              f'id="{input_id}" name="{input_id}" min="{lo:g}" max="{hi:g}" step="{step:g}" value="{value:g}" '
              f'aria-label="{html.escape(label)}" autocomplete="off" data-st-input /></div><div class="st-slider-ticks">'
              f'<div>{fmt(lo)}</div><div>{fmt(hi)}</div></div></div>')


def checkbox(input_id, label):
    return el(f'<div class="st-checkbox"><label><input type="checkbox" id="{input_id}" name="{input_id}" '
              f'autocomplete="off" data-st-input /><span class="st-checkbox-box"></span><span class="st-checkbox-text">'
              f'<span class="st-md"><p>{label}</p></span></span></label></div>')


def expander(label, body):
    return el(f'<details class="st-expander"><summary><span class="st-expander-label"><div class="st-md"><p>{label}</p>'
              f'</div></span>{EXPANDER_SVG}</summary><div class="st-expander-details"><div class="st-vblock">'
              f'<div class="st-element"><div class="st-md">\n{body}\n</div></div></div></div></details>')


def chart(name, frame_id=None):
    return el(f'<div class="st-chart-frame"><div class="st-chart" data-st-chart="{name}"></div></div>')


def hblock(gap, columns, weights=None):
    weights = weights or [100 / len(columns)] * len(columns)
    cols = "".join(f'<div class="st-column" style="--st-col: {w:g}%"><div class="st-vblock">{"".join(c)}</div></div>'
                   for c, w in zip(columns, weights))
    return f'<div class="st-hblock st-hblock--{gap}">{cols}</div>'


# ------------------------------------------------------------------------------------------
# Expander-Inhalte aus dem gemessenen DOM
# ------------------------------------------------------------------------------------------
def measured_markdown(tool):
    dom = (INV / f"{tool}__1280" / "expander-open.dom.html").read_text(encoding="utf-8")
    start = dom.index('data-testid="stMarkdownContainer"', dom.index("stExpanderDetails"))
    body = dom[dom.index(">", start) + 1:]
    body = body[:body.rindex("</div></div></div></div></div></details>")]
    body = re.sub(r' class="[^"]*"', "", body)
    body = re.sub(
        r'<div data-testid="stHeadingWithActionElements"><h3 id="([^"]+)">(.*?)<span data-testid="stHeaderActionElements">'
        r'<a href="#[^"]+">.*?</a></span></h3></div>',
        lambda m: f'<div class="st-heading-hover"><h3 id="{m.group(1)}">{m.group(2)}{anchor(m.group(1))}</h3></div>',
        body)
    if "stMarkdownPre" in body:  # B1: eingerueckter Text als Codeblock mit Kopier-Button
        def code(m):
            text = re.sub(r"</?span>", "", re.sub(r'<div style="background-color: transparent;">', "", m.group(1)))
            clip = html.escape(html.unescape(text), quote=True)
            return (f'<div class="st-md-pre"><div class="st-code"><pre><code>{text}</code></pre><div class="st-code-actions">'
                    f'<button type="button" class="st-code-copy" title="Copy to clipboard" data-clipboard-text="{clip}">'
                    f'{COPY_SVG}</button></div></div></div>')
        body = re.sub(r'<div data-testid="stMarkdownPre"><div data-testid="stCode"><pre>(?:<div [^>]*>)?<code[^>]*>(.*?)</code>'
                      r'(?:</div>)?</pre>.*?</button></div></div></div>', code, body, flags=re.S)
    assert "data-testid" not in body, f"{tool}: unbekannte Struktur im Expander"
    return body


# ------------------------------------------------------------------------------------------
# Seiten
# ------------------------------------------------------------------------------------------
def page(title_text, icon, tool, sidebar_items, main_items):
    return f"""<!doctype html>
<html lang="en" class="st-page">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
    <title>{title_text}</title>
    <link rel="shortcut icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>{icon}</text></svg>" />
    <link rel="stylesheet" href="/assets/css/styles.css" />
    <script src="/assets/vendor/plotly-3.0.1.min.js" defer></script>
    <script type="module" src="/assets/js/tools/{tool}.js"></script>
  </head>
  <body>
    <div class="st-app">
      <div class="st-view">
        <section class="st-sidebar" aria-expanded="true" data-st-sidebar>
          <div class="st-sidebar-resize" data-st-sidebar-resize></div>
          <div class="st-sidebar-content">
            <div class="st-sidebar-header">
              <div></div>
              <div class="st-sidebar-collapse">
                <button type="button" class="st-header-button" data-st-sidebar-collapse aria-label="">
                  <span class="st-icon" translate="no">keyboard_double_arrow_left</span>
                </button>
              </div>
            </div>
            <div class="st-sidebar-user">
              <div class="st-vblock">
                {(chr(10) + '                ').join(sidebar_items)}
              </div>
            </div>
          </div>
        </section>
        <div class="st-main-wrap">
          <header class="st-header">
            <div class="st-header-left">
              <button type="button" class="st-header-button st-sidebar-expand" data-st-sidebar-expand aria-label="">
                <span class="st-icon" translate="no">keyboard_double_arrow_right</span>
              </button>
            </div>
          </header>
          <section class="st-main" tabindex="0">
            <div class="st-block">
              <div class="st-vblock">
                {(chr(10) + '                ').join(main_items)}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  </body>
</html>
"""


ANODES = ["Ideal Anode", "Graphite", "Silicon"]
CATHODES = ["Ideal Cathode", "LCO", "LFP", "NCA", "NMC"]
CENTER = "text-align: center;"


def materials():
    side = back_button() + [side_header("Choose your material"),
                            select("material", "Material", ["Ideal Anode", "Ideal Cathode", "Graphite", "LCO", "LFP",
                                                            "NCA", "NMC", "Silicon"]),
                            slider("sol", "SoL", 0, 1, 0.01, 0.5)] + sidebar_footer()
    main = [empty(), empty(), title("🪣 Understand Materials with the Tank Analogy", "understand-materials-with-the-tank-analogy"),
            expander("🧠 What does this tool show?", measured_markdown("materials")),
            hblock("medium", [[md_heading("🪣 Electrode dQ/dV Tank", "electrode-d-q-d-v-tank", CENTER), chart("dqdv")],
                              [md_heading("📈 Voltage vs. SoL", "voltage-vs-so-l", CENTER), chart("voltage")]])]
    return page("Material Tank Explorer", "🪣", "materials", side, main)


def cell():
    side = back_button() + [side_header("🔧 Adjust Cell Settings"), select("anode", "Anode", ANODES),
                            select("cathode", "Cathode", CATHODES), slider("soc", "SoC", 0, 1, 0.01, 0.5),
                            side_subheader("Cutoff Voltages"), slider("vmin", "V min [V]", 2.0, 3.5, 0.01, 2.0),
                            slider("vmax", "V max [V]", 3.5, 4.5, 0.01, 4.0), side_subheader("Capacity Ratios"),
                            slider("np", "NP Ratio", 0.8, 1.5, 0.01, 1.0),
                            slider("lip", "LiP Ratio", 0.5, 1.5, 0.01, 1.0)] + sidebar_footer()
    main = [empty(), empty(), title("🔋 Understand Batteries with the Tank Analogy", "understand-batteries-with-the-tank-analogy"),
            expander("🧠 What does this tool show?", measured_markdown("cell-reconstruction")),
            hblock("medium", [[md_heading("🔋 Electrode dQ/dV Tanks", "electrode-d-q-d-v-tanks", CENTER), chart("dqdv")],
                              [md_heading("📈 Voltage vs. SoC", "voltage-vs-so-c", CENTER), chart("voltage")]])]
    return page("Battery Tank Tool", "🔋", "cell-reconstruction", side, main)


def blending():
    side = back_button() + [side_header("Blend Setup"), slider("sol", "SoL (Blend)", 0, 1, 0.01, 0.5),
                            slider("gamma", "q% (Material A)", 0, 1, 0.01, 0.7)] + sidebar_footer()
    main = [empty(), empty(), title("🧪 Blend OCV Tool", "blend-ocv-tool"),
            expander("🧠 What does this tool show?", measured_markdown("blending")),
            hblock("medium", [[md_heading("🪣 Tanks of Each Material", "tanks-of-each-material"), chart("tanks1"),
                               md_heading("🪣 Blend Tank (Sum of Both)", "blend-tank-sum-of-both"), chart("tanks2")],
                              [md_heading("🔋 Voltage from Water Level", "voltage-from-water-level"), chart("ocv"),
                               md_heading("🔀 Mapping SoLs to Blend SoL", "mapping-so-ls-to-blend-so-l"), chart("solmap")]])]
    return page("Blend OCV Tool", "🧪", "blending", side, main)


def aging():
    side = back_button() + [side_header("🔧 Adjust Cell Settings"), select("anode", "Anode", ANODES),
                            select("cathode", "Cathode", CATHODES), slider("soc", "SoC", 0, 1, 0.01, 0.5), hr(),
                            side_subheader("🧓 Aging Modes"), slider("lampe", "Cathode LAM (lampe)", 0, 0.5, 0.01, 0),
                            slider("lamne", "Anode LAM (lamne)", 0, 0.5, 0.01, 0),
                            slider("lli", "LLI (lithium loss)", 0, 0.5, 0.01, 0)] + sidebar_footer()
    caps = el('<div class="st-heading"><h3 id="capacities-relative-to-cathode-so-h-100-00" data-st-capacities>Capacities '
              '(relative to cathode). SoH: 100.00%' + anchor("capacities-relative-to-cathode-so-h-100-00") + '</h3></div>')
    main = [empty(), empty(), title("🧓 Understand Aging Modes with the Tank Analogy", "understand-aging-modes-with-the-tank-analogy"),
            expander("🧠 What does this tool show?", measured_markdown("aging")), caps, chart("caps"),
            hblock("large", [[subheader("🔋 Electrode dQ/dV Tanks", "electrode-d-q-d-v-tanks"), chart("tank")],
                             [subheader("📈 Voltage vs. SoC", "voltage-vs-so-c"), chart("ocv")]])]
    return page("Aging Modes Tank Tool", "🧓", "aging", side, main)


def swelling():
    side = back_button() + [side_header("🔧 Swelling conditions"), slider("soc", "SoC", 0, 1, 0.01, 0.5),
                            slider("soh", "State of Health", 0.8, 1.0, 0.01, 1.0), checkbox("cylindrical", "Cylindrical?"),
                            slider("compression", "Compression [MPa]", 0, 60, 1, 0)] + sidebar_footer()
    main = [empty(), empty(), title("🫁 Understand Swelling", "understand-swelling"),
            expander("🧠 What does this tool show?", measured_markdown("swelling")),
            hblock("large", [[subheader("Electrode Stack Geometry", "electrode-stack-geometry"), chart("layers")],
                             [subheader("Stack by categories", "stack-by-categories"), chart("classes")]]),
            subheader("Compression vs. porosity", "compression-vs-porosity"), chart("compression")]
    return page("Swelling Tool", "🫁", "swelling", side, main)


FULLSCREEN_SVG = ('<svg class="st-toolbar-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="currentColor" '
                  'xmlns="http://www.w3.org/2000/svg"><path fill="none" d="M0 0h24v24H0V0z"></path><path d="M7 14H5v5h5v-2H7v'
                  '-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"></path></svg>')


def image(src):
    """st.image(..., use_container_width=True) mit Element-Werkzeugleiste (Vollbild)."""
    return el(f'<div class="st-image-frame" data-st-image><div class="st-toolbar"><div class="st-toolbar-buttons">'
              f'<button type="button" class="st-toolbar-button" aria-label="Fullscreen">{FULLSCREEN_SVG}</button></div>'
              f'</div><div class="st-image"><div class="st-image-container"><img src="{src}" alt="0" /></div></div></div>')


def card(text, anchor_id, desc):
    """landing.card_block (dark=False): HTML-Markdown mit Ueberschrift samt Anker."""
    return md(f'<div class="card">\n    <div class="st-heading-hover"><h2 id="{anchor_id}">{text}{anchor(anchor_id)}</h2></div>\n'
              f'    <p>{desc}</p>\n</div>')


def landing():
    hero = md('<div style="text-align: center; padding: 2rem 1rem;">\n    <div class="st-heading-hover"><h1 id="charge-tanks-suite" '
              'style="font-size: 3rem; margin-bottom: 1rem;">\n        🪣 Charge Tanks Suite\n    '
              f'{anchor("charge-tanks-suite")}</h1></div>\n    <div class="st-heading-hover"><h2 id="interactive-tools-to-build-'
              'intuition-for-battery-design-ocv-blending-and-aging" style="font-size: 1.5rem; font-weight: 400; '
              'line-height: 1.5; max-width: 800px; margin: 0px auto; color: rgb(221, 221, 221);">\n        Interactive tools '
              'to build intuition for <b>battery design, OCV, blending &amp; aging</b>.<br />\n    '
              f'{anchor("interactive-tools-to-build-intuition-for-battery-design-ocv-blending-and-aging")}</h2></div>\n</div>')
    tools = [("🪣 Materials", "materials", "Explore half-cell curves and metadata.", "Materials", "material"),
             ("🪫 Cell Reconstruction", "cell-reconstruction", "Rebuild full-cell OCV from half-cells.", "Cell Reconstruction",
              "cell"),
             ("⚖️ Blending", "blending", "Blend anode/cathode; inspect OCV &amp; dQ/dV.", "Blending", "blend"),
             ("👴 Aging", "aging", "Overlay BOL vs aged; inspect shifts &amp; losses.", "Aging", "aging"),
             ("🫁 Swelling", "swelling", "Relate porosity/compression to thickness breathing.", "Swelling", "swelling")]

    def column(tool):
        label, slug, desc, route, thumb = tool
        return [card(label, slug, desc),
                el(f'<a class="st-button st-button--landing st-button--block" href="/tools/{slug}/"><div class="st-md">'
                   f'<p>Open {route}</p></div></a>'),
                image(f"/assets/img/suite/{thumb}_thumbnail.png")]

    rows = [hblock("small", [column(t) for t in tools[i:i + 3]] + [[]] * (3 - len(tools[i:i + 3])), [100 / 3] * 3)
            for i in range(0, len(tools), 3)]
    main = [empty(), empty(), hero] + rows + [
        hr(), hblock("small", [[], [], [], []], [100 / 6, 100 / 3, 100 / 3, 100 / 6]),
        el('<a class="st-link-button" href="mailto:lars@chargetanks.com" target="_blank" rel="noreferrer"><div class="st-md">'
           '<p>💌  Email</p></div></a>'),
        hr(),
        md('<div class="footer">\n© 2025 Lars von Kolzenberg<br />\nBuilt with Streamlit - v0.7.0<br />\nFor educational use '
           'only\n</div>')]
    items = (chr(10) + "                ").join(main)
    return f"""<!doctype html>
<html lang="en" class="st-page st-page--landing">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
    <title>Battery Tool Suite</title>
    <link rel="shortcut icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🔋</text></svg>" />
    <link rel="stylesheet" href="/assets/css/styles.css" />
    <script type="module" src="/assets/js/tools/suite.js"></script>
  </head>
  <body>
    <div class="st-app">
      <div class="st-view">
        <div class="st-main-wrap">
          <header class="st-header"></header>
          <section class="st-main" tabindex="0">
            <div class="st-block">
              <div class="st-vblock">
                {{items}}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  </body>
</html>
""".replace("{items}", items)


PAGES = {"suite": landing, "materials": materials, "cell-reconstruction": cell, "blending": blending, "aging": aging, "swelling": swelling}

if __name__ == "__main__":
    for name in sys.argv[1:] or PAGES:
        out = REPO / "tools" / name / "index.html"
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(PAGES[name](), encoding="utf-8", newline="\n")
        print("ok", out)
