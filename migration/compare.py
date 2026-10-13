"""Vergleich alt (Legacy-Suite, :8501) gegen neu (statische Seite, :8000) im Browser.

Fuer jedes Tool und jeden Zustand werden beide Seiten identisch bedient (Klicks, Tastatur) und dann
verglichen:
  - Plotly je Diagramm: gd.data (alle Arrays, Toleranz 1e-12), gd.layout ohne Template, Auszug aus
    gd._fullLayout (Groesse, Raender, Achsenbereiche, Farben, Schriften), gd._context (Config)
  - angezeigte Texte (Ueberschriften, Slider-Werte, Auswahlfelder)
  - Netzwerk der neuen Seite (nur eigene Domain) und Konsolenfehler
  - Screenshots alt/neu/Differenz bei 1280 und 390 px -> migration/screenshots/compare/<tool>/
Bericht: migration/inventory/compare/<tool>.json

Aufruf: migration/.work/venv-tools/Scripts/python.exe migration/compare.py aging
"""

from __future__ import annotations

import json
import math
import os
import sys
import time
from pathlib import Path
from urllib.parse import urlparse

from PIL import Image, ImageChops

from inventory import (BASE_HEIGHT, INV, SUITE_TOOLS, Recorder, open_suite_page, slider_thumb, sync_playwright,
                       wait_suite_idle, write_json)

ROOT = Path(__file__).resolve().parent
SHOTS = ROOT / "screenshots" / "compare"
NEW = os.environ.get("NEW_URL", "http://localhost:8010")  # neue Seite: node scripts/serve.mjs 8010
RTOL = 1e-12

SNAPSHOT_JS = r"""
() => {
  const TYPES = {f8: Float64Array, f4: Float32Array, i4: Int32Array, i2: Int16Array, i1: Int8Array, u1: Uint8Array,
                 u2: Uint16Array, u4: Uint32Array};
  const decode = (v) => {  // plotly.py-Binaerarray {dtype, bdata} wie plotly.js es auswertet
    const bytes = Uint8Array.from(atob(v.bdata), c => c.charCodeAt(0));
    return new TYPES[v.dtype](bytes.buffer);
  };
  const plain = (v, depth = 0) => {
    if (depth > 12) return '[depth]';
    if (v === null || v === undefined) return v === undefined ? null : v;
    if (typeof v === 'object' && !Array.isArray(v) && v.bdata && v.dtype in TYPES) v = decode(v);
    if (ArrayBuffer.isView(v)) return Array.from(v, x => Number.isFinite(x) ? x : (Number.isNaN(x) ? 'NaN' : String(x)));
    if (Array.isArray(v)) return v.map(x => plain(x, depth + 1));
    if (typeof v === 'number') return Number.isFinite(v) ? v : (Number.isNaN(v) ? 'NaN' : String(v));
    if (typeof v === 'object') {
      const out = {};
      for (const k of Object.keys(v)) if (!k.startsWith('_') && typeof v[k] !== 'function') out[k] = plain(v[k], depth + 1);
      return out;
    }
    return v;
  };
  const AX = ['range', 'autorange', 'type', 'tickvals', 'ticktext', 'tickmode', 'title', 'tickfont', 'linecolor',
              'linewidth', 'gridcolor', 'gridwidth', 'griddash', 'showgrid', 'zeroline', 'mirror', 'showline', 'ticks',
              'domain', 'rangemode'];
  return [...document.querySelectorAll('.js-plotly-plot')].map(gd => {
    const layout = Object.assign({}, gd.layout); delete layout.template;
    const fl = gd._fullLayout;
    const axis = (a) => Object.fromEntries(AX.filter(k => a && k in a).map(k => [k, plain(a[k])]));
    return {
      data: plain(gd.data),
      layout: plain(layout),
      full: {width: fl.width, height: fl.height, margin: plain(fl.margin), font: plain(fl.font),
             paper_bgcolor: fl.paper_bgcolor, plot_bgcolor: fl.plot_bgcolor, showlegend: fl.showlegend,
             legend: plain(fl.legend && {x: fl.legend.x, y: fl.legend.y, xanchor: fl.legend.xanchor,
                   yanchor: fl.legend.yanchor, font: fl.legend.font, bgcolor: fl.legend.bgcolor}),
             xaxis: axis(fl.xaxis), yaxis: axis(fl.yaxis), hovermode: fl.hovermode, dragmode: fl.dragmode},
      context: plain({displayModeBar: gd._context.displayModeBar, displaylogo: gd._context.displaylogo,
                      modeBarButtonsToRemove: gd._context.modeBarButtonsToRemove, responsive: gd._context.responsive,
                      showLink: gd._context.showLink, scrollZoom: gd._context.scrollZoom,
                      buttonsToAdd: (gd._context.modeBarButtonsToAdd || []).map(b => ({name: b.name, icon: b.icon}))}),
      rect: (() => { const r = gd.getBoundingClientRect(); return {w: Math.round(r.width), h: Math.round(r.height)}; })(),
    };
  });
}
"""

TEXTS_JS = r"""
() => {
  const txt = (e) => (e.innerText || e.textContent || '').trim().replace(/\s+/g, ' ');
  const vis = (e) => !!(e.offsetWidth || e.offsetHeight || e.getClientRects().length);
  return {
    headings: [...document.querySelectorAll('h1, h2, h3')].filter(vis).map(h => ({tag: h.tagName.toLowerCase(), text: txt(h), id: h.id || null})),
    sliders: [...document.querySelectorAll('[data-testid="stSlider"], [data-st-slider]')].map(s => ({
      label: txt(s.querySelector('[data-testid="stWidgetLabel"], .st-label')),
      value: txt(s.querySelector('[data-testid="stSliderThumbValue"], .st-slider-value')),
      ticks: [...s.querySelectorAll('[data-testid="stSliderTickBarMin"], [data-testid="stSliderTickBarMax"], .st-slider-ticks > div')].map(txt)})),
    selects: [...document.querySelectorAll('[data-testid="stSelectbox"], .st-select-widget')].map(s => ({
      label: txt(s.querySelector('[data-testid="stWidgetLabel"], .st-label')),
      value: s.querySelector('select') ? s.querySelector('select').value : txt(s.querySelector('[data-baseweb="select"] [value]'))})),
  };
}
"""

NEW_HEIGHT_JS = """
() => {
  const open = document.querySelector('[data-st-sidebar]').getAttribute('aria-expanded') === 'true';
  return Math.max(document.querySelector('.st-main').scrollHeight,
                  open ? document.querySelector('.st-sidebar-content').scrollHeight : 0);
}
"""


# ------------------------------------------------------------------------------------------
# Vergleichslogik
# ------------------------------------------------------------------------------------------
class Diff:
    def __init__(self):
        self.items = []
        self.numbers = 0
        self.inexact = 0
        self.max_rel = 0.0

    def add(self, path, old, new):
        if len(self.items) < 200:
            self.items.append({"path": path, "old": old, "new": new})

    def compare(self, old, new, path=""):
        if isinstance(old, (int, float)) and not isinstance(old, bool) and isinstance(new, (int, float)) \
                and not isinstance(new, bool):
            self.numbers += 1
            if old != new:
                self.inexact += 1
                rel = abs(old - new) / max(1.0, abs(old))
                self.max_rel = max(self.max_rel, rel)
                if rel > RTOL:
                    self.add(path, old, new)
            return
        if type(old) is not type(new):
            self.add(path, old, new)
            return
        if isinstance(old, dict):
            for key in sorted(set(old) | set(new)):
                if key not in old or key not in new:
                    self.add(f"{path}.{key}", old.get(key, "<fehlt>"), new.get(key, "<fehlt>"))
                else:
                    self.compare(old[key], new[key], f"{path}.{key}")
            return
        if isinstance(old, list):
            if len(old) != len(new):
                self.add(f"{path}.length", len(old), len(new))
                return
            for i, (a, b) in enumerate(zip(old, new)):
                self.compare(a, b, f"{path}[{i}]")
            return
        if old != new:
            self.add(path, old, new)


def image_diff(old_path: Path, new_path: Path, out_path: Path):
    a = Image.open(old_path).convert("RGB")
    b = Image.open(new_path).convert("RGB")
    width, height = max(a.width, b.width), max(a.height, b.height)
    canvas_a = Image.new("RGB", (width, height), (255, 0, 255))
    canvas_b = Image.new("RGB", (width, height), (255, 0, 255))
    canvas_a.paste(a, (0, 0))
    canvas_b.paste(b, (0, 0))
    diff = ImageChops.difference(canvas_a, canvas_b)
    mask = diff.convert("L").point(lambda v: 255 if v > 24 else 0)
    changed = mask.histogram()[255]
    highlight = Image.blend(canvas_b.convert("L").convert("RGB"), Image.new("RGB", (width, height), (0, 0, 0)), 0.6)
    highlight.paste((255, 40, 40), mask=mask)
    highlight.save(out_path)
    return {"size_old": [a.width, a.height], "size_new": [b.width, b.height],
            "changed_pixels": changed, "changed_percent": round(100 * changed / (width * height), 3),
            "bbox": mask.getbbox()}


def stretch_and_shoot(page, path: Path, width: int, height_js: str):
    page.mouse.move(width - 3, 3)  # neutrale Position (Header rechts oben), keine Hover-Effekte
    height = page.evaluate(height_js)
    page.set_viewport_size({"width": width, "height": max(BASE_HEIGHT, min(int(height) + 40, 9000))})
    page.wait_for_timeout(900)
    page.mouse.move(width - 3, 3)
    page.wait_for_timeout(200)
    path.parent.mkdir(parents=True, exist_ok=True)
    page.screenshot(path=str(path))
    page.set_viewport_size({"width": width, "height": BASE_HEIGHT})
    page.wait_for_timeout(400)


OLD_HEIGHT_JS = """
() => {
  const sb = document.querySelector('[data-testid="stSidebar"]');
  const open = sb && sb.getAttribute('aria-expanded') === 'true';
  return Math.max(document.querySelector('[data-testid="stMain"]').scrollHeight,
                  open ? document.querySelector('[data-testid="stSidebarContent"]').scrollHeight : 0);
}
"""


# ------------------------------------------------------------------------------------------
# Bedienung beider Seiten
# ------------------------------------------------------------------------------------------
class OldUI:
    def __init__(self, page):
        self.page = page

    def select(self, index, option):
        self.page.locator('[data-testid="stSelectbox"]').nth(index).click()
        self.page.wait_for_timeout(400)
        self.page.get_by_role("option", name=option, exact=True).click()
        self.settle()

    def keys(self, label, keys):
        for key in keys:
            slider_thumb(self.page, label).focus()
            self.page.keyboard.press(key)
            self.page.wait_for_timeout(60)
        self.settle()

    def settle(self):
        self.page.wait_for_timeout(1200)
        wait_suite_idle(self.page)

    def open_expander(self):
        self.page.locator('[data-testid="stExpander"] summary').first.click()
        self.page.wait_for_timeout(600)

    def open_sidebar(self):
        self.page.locator('[data-testid="stExpandSidebarButton"]').click()
        self.page.wait_for_timeout(800)


class NewUI:
    def __init__(self, page, ids):
        self.page = page
        self.ids = ids  # Label -> id des Eingabeelements

    def select(self, index, option):
        # wie eine Mausauswahl: das Feld behaelt danach den Fokus (select_option allein fokussiert nicht)
        self.page.locator("select").nth(index).focus()
        self.page.locator("select").nth(index).select_option(option)
        self.settle()

    def keys(self, label, keys):
        for key in keys:
            self.page.locator(f"#{self.ids[label]}").focus()
            self.page.keyboard.press(key)
            self.page.wait_for_timeout(60)
        self.settle()

    def settle(self):
        self.page.wait_for_timeout(700)
        deadline = time.time() + 30
        while time.time() < deadline:
            ready = self.page.evaluate("""() => {
                const plots = [...document.querySelectorAll('[data-st-chart]')];
                return plots.length > 0 && plots.every(p => p._fullLayout);
            }""")
            if ready:
                break
            self.page.wait_for_timeout(200)
        self.page.wait_for_timeout(300)

    def open_expander(self):
        self.page.locator("details.st-expander summary").first.click()
        self.page.wait_for_timeout(600)

    def open_sidebar(self):
        self.page.locator("[data-st-sidebar-expand]").click()
        self.page.wait_for_timeout(800)


def steps_to(value, default, step=0.01):
    """Tastenfolge von default nach value: Bild auf/ab fuer 10er-Schritte, Pfeile fuer den Rest."""
    n = round((value - default) / step)
    up = n >= 0
    n = abs(n)
    return ["PageUp" if up else "PageDown"] * (n // 10) + ["ArrowRight" if up else "ArrowLeft"] * (n % 10)


TOOLS = {
    "materials": {
        "legacy": SUITE_TOOLS[0],
        "path": "/tools/materials/",
        "ids": {"SoL": "sol"},
        "defaults": {"SoL": 0.5},
        "states": {
            "default": [],
            "graphite-0.27": [("select", 0, "Graphite"), ("slider", "SoL", 0.27)],
            "lfp-0": [("select", 0, "LFP"), ("slider", "SoL", 0.0)],
            "silicon-1": [("select", 0, "Silicon"), ("slider", "SoL", 1.0)],
            "nmc-0.5": [("select", 0, "NMC")],
        },
    },
    "cell-reconstruction": {
        "legacy": SUITE_TOOLS[1],
        "path": "/tools/cell-reconstruction/",
        "ids": {"SoC": "soc", "V min [V]": "vmin", "V max [V]": "vmax", "NP Ratio": "np", "LiP Ratio": "lip"},
        "defaults": {"SoC": 0.5, "V min [V]": 2.0, "V max [V]": 4.0, "NP Ratio": 1.0, "LiP Ratio": 1.0},
        "states": {
            "default": [],
            "graphite-nmc": [("select", 0, "Graphite"), ("select", 1, "NMC")],
            "silicon-lfp-custom": [("select", 0, "Silicon"), ("select", 1, "LFP"), ("slider", "SoC", 0.75),
                                   ("slider", "V min [V]", 2.5), ("slider", "V max [V]", 3.65),
                                   ("slider", "NP Ratio", 1.2), ("slider", "LiP Ratio", 0.9)],
            "all-min": [("slider", "SoC", 0.0), ("slider", "V max [V]", 3.5), ("slider", "NP Ratio", 0.8),
                        ("slider", "LiP Ratio", 0.5)],
            "all-max": [("slider", "SoC", 1.0), ("slider", "V min [V]", 3.5), ("slider", "V max [V]", 4.5),
                        ("slider", "NP Ratio", 1.5), ("slider", "LiP Ratio", 1.5)],
        },
    },
    "aging": {
        "legacy": SUITE_TOOLS[3],
        "path": "/tools/aging/",
        "ids": {"SoC": "soc", "Cathode LAM (lampe)": "lampe", "Anode LAM (lamne)": "lamne", "LLI (lithium loss)": "lli"},
        "defaults": {"SoC": 0.5, "Cathode LAM (lampe)": 0.0, "Anode LAM (lamne)": 0.0, "LLI (lithium loss)": 0.0},
        "states": {
            "default": [],
            "graphite-nmc": [("select", 0, "Graphite"), ("select", 1, "NMC")],
            "silicon-lfp-aged": [("select", 0, "Silicon"), ("select", 1, "LFP"), ("slider", "SoC", 0.8),
                                 ("slider", "Cathode LAM (lampe)", 0.2), ("slider", "Anode LAM (lamne)", 0.3),
                                 ("slider", "LLI (lithium loss)", 0.05)],
            "all-aging-0.5": [("slider", "Cathode LAM (lampe)", 0.5), ("slider", "Anode LAM (lamne)", 0.5),
                              ("slider", "LLI (lithium loss)", 0.5)],
            "soc-0": [("slider", "SoC", 0.0)],
            "soc-1": [("slider", "SoC", 1.0)],
        },
    },
}


def apply(ui, spec, steps):
    for step in steps:
        if step[0] == "select":
            ui.select(step[1], step[2])
        else:
            _, label, value = step
            ui.keys(label, steps_to(value, spec["defaults"][label]))


def open_new(browser, width, path):
    context = browser.new_context(viewport={"width": width, "height": BASE_HEIGHT}, device_scale_factor=1)
    rec = Recorder(context)
    page = context.new_page()
    rec.attach(page)
    page.goto(NEW + path, wait_until="networkidle")
    return context, page, rec


def run(tool):
    spec = TOOLS[tool]
    report = {"tool": tool, "states": {}, "screenshots": {}, "network": None, "console": None}
    out = SHOTS / tool
    with sync_playwright() as p:
        browser = p.chromium.launch()
        # 1) Zustaende bei 1280 px: Plotly-Paritaet, Texte, Screenshot-Paare
        for name, steps in spec["states"].items():
            ctx_old, page_old, _ = open_suite_page(browser, 1280, spec["legacy"])
            ctx_new, page_new, rec_new = open_new(browser, 1280, spec["path"])
            old_ui, new_ui = OldUI(page_old), NewUI(page_new, spec["ids"])
            new_ui.settle()
            apply(old_ui, spec, steps)
            apply(new_ui, spec, steps)
            old_snap, new_snap = page_old.evaluate(SNAPSHOT_JS), page_new.evaluate(SNAPSHOT_JS)
            diff = Diff()
            diff.compare(old_snap, new_snap, "charts")
            texts_old, texts_new = page_old.evaluate(TEXTS_JS), page_new.evaluate(TEXTS_JS)
            diff.compare(texts_old, texts_new, "texts")
            report["states"][name] = {"numbers": diff.numbers, "not_bitidentical": diff.inexact,
                                      "max_rel_deviation": diff.max_rel, "differences": diff.items}
            for label, (page, height_js) in {"old": (page_old, OLD_HEIGHT_JS), "new": (page_new, NEW_HEIGHT_JS)}.items():
                stretch_and_shoot(page, out / f"{name}__1280__{label}.png", 1280, height_js)
            report["screenshots"][f"{name}__1280"] = image_diff(out / f"{name}__1280__old.png",
                                                                out / f"{name}__1280__new.png",
                                                                out / f"{name}__1280__diff.png")
            if name == "default":
                report["network"] = rec_new.snapshot()["requests"]
                report["console"] = rec_new.snapshot()["console"]
            print(tool, name, "Abweichungen:", len(diff.items), "Zahlen:", diff.numbers, "nicht bitgleich:",
                  diff.inexact, "Pixel:", report["screenshots"][f"{name}__1280"]["changed_percent"], "%")
            ctx_old.close()
            ctx_new.close()

        # 2) Ansichten bei 1280/390: Default, Expander offen, (390) Sidebar offen
        for width in (1280, 390):
            views = ["expander-open"] + (["sidebar-open", "default"] if width == 390 else [])
            for view in views:
                ctx_old, page_old, _ = open_suite_page(browser, width, spec["legacy"])
                ctx_new, page_new, _ = open_new(browser, width, spec["path"])
                old_ui, new_ui = OldUI(page_old), NewUI(page_new, spec["ids"])
                new_ui.settle()
                if view == "expander-open":
                    old_ui.open_expander()
                    new_ui.open_expander()
                if view == "sidebar-open":
                    old_ui.open_sidebar()
                    new_ui.open_sidebar()
                for label, (page, height_js) in {"old": (page_old, OLD_HEIGHT_JS),
                                                 "new": (page_new, NEW_HEIGHT_JS)}.items():
                    stretch_and_shoot(page, out / f"{view}__{width}__{label}.png", width, height_js)
                key = f"{view}__{width}"
                report["screenshots"][key] = image_diff(out / f"{key}__old.png", out / f"{key}__new.png",
                                                        out / f"{key}__diff.png")
                print(tool, key, "Pixel:", report["screenshots"][key]["changed_percent"], "%")
                ctx_old.close()
                ctx_new.close()
        browser.close()

    foreign = [r for r in (report["network"] or []) if r["foreign"]]
    report["foreign_requests"] = foreign
    write_json(INV / "compare" / f"{tool}.json", report)
    print("fremde Domains:", len(foreign), "Konsolenmeldungen:", report["console"])


if __name__ == "__main__":
    run(sys.argv[1] if len(sys.argv) > 1 else "aging")
