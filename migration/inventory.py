"""Phase 0: misst die laufenden Legacy-Seiten mit Playwright.

Voraussetzungen (siehe MIGRATION.md, Abschnitt "Legacy lokal starten"):
  - Legacy-Webseite (Build ohne Tracking) auf http://localhost:4173 (migration/serve-legacy-site.mjs)
  - Legacy-Suite (Streamlit) auf http://localhost:8501 (Tracking gestubbt)

Erfasst pro Seite/Zustand: Titel, Meta-Tags, Favicon, DOM, berechnete Stile (dedupliziert),
Widget-Zustaende, Plotly-Specs (gekuerzt) inklusive _fullLayout/_context, Netzwerk-Log und
Konsolenfehler; dazu Screenshots bei 1280 und 390 px. Anfragen an fremde Domains werden
protokolliert und blockiert, damit waehrend der Messung nichts nach aussen geht.

Aufruf: migration/.work/venv-tools/Scripts/python.exe migration/inventory.py [site|suite|probe|scheme|all]
"""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent
INV = ROOT / "inventory"
SHOTS = ROOT / "screenshots" / "legacy"
SITE = "http://localhost:4173"
SUITE = "http://localhost:8501"
WIDTHS = (1280, 390)
BASE_HEIGHT = 900
LOCAL_HOSTS = {"localhost", "127.0.0.1"}

STYLE_PROPS = [
    "display", "position", "box-sizing", "min-width", "max-width", "min-height",
    "margin-top", "margin-right", "margin-bottom", "margin-left",
    "padding-top", "padding-right", "padding-bottom", "padding-left",
    "border-top-width", "border-top-style", "border-top-color",
    "border-right-width", "border-right-color", "border-bottom-width", "border-bottom-color",
    "border-left-width", "border-left-color", "border-radius",
    "background-color", "background-image", "color", "opacity",
    "font-family", "font-size", "font-weight", "font-style", "line-height", "letter-spacing",
    "text-align", "text-transform", "text-decoration-line", "white-space",
    "box-shadow", "gap", "flex-direction", "flex-wrap", "align-items", "justify-content",
    "flex-grow", "flex-shrink", "flex-basis", "grid-template-columns",
    "overflow-x", "overflow-y", "z-index", "cursor", "list-style-type", "object-fit",
    "backdrop-filter", "transition-property", "visibility",
]

SERIALIZE_JS = """
(args) => {
  const [value, maxDepth, shortenArrays] = args;
  const stack = new Set();
  function ser(v, depth) {
    if (typeof v === 'function') return undefined;
    if (v === null || typeof v !== 'object') {
      if (typeof v === 'number' && !Number.isFinite(v)) return String(v);
      return v;
    }
    if (ArrayBuffer.isView(v)) v = Array.from(v);
    if (typeof Element !== 'undefined' && v instanceof Element) return '[element]';
    if (stack.has(v)) return '[circular]';
    if (depth > maxDepth) return '[depth]';
    stack.add(v);
    let out;
    if (Array.isArray(v)) {
      const numeric = v.every(x => typeof x === 'number' || x === null);
      if (shortenArrays && numeric && v.length > 7) {
        out = {len: v.length, head: v.slice(0, 3), tail: v.slice(-3)};
      } else {
        out = v.map(x => ser(x, depth + 1));
      }
    } else {
      out = {};
      for (const k of Object.keys(v)) {
        if (k.startsWith('_')) continue;
        const s = ser(v[k], depth + 1);
        if (s !== undefined) out[k] = s;
      }
    }
    stack.delete(v);
    return out;
  }
  return ser(value, 0);
}
"""

PLOTLY_JS = """
(args) => {
  const [serializeSrc] = args;
  const serialize = eval(serializeSrc);
  const FULL_KEYS = ['width','height','autosize','margin','font','paper_bgcolor','plot_bgcolor','colorway',
    'legend','showlegend','hovermode','hoverlabel','dragmode','title','annotations','shapes','modebar',
    'xaxis','yaxis','bargap','barmode','separators','uniformtext'];
  const CONTEXT_KEYS = ['displayModeBar','displaylogo','modeBarButtonsToRemove','modeBarButtonsToAdd',
    'responsive','scrollZoom','staticPlot','editable','showTips','toImageButtonOptions','locale','showLink',
    'showSendToCloud','doubleClick','showAxisDragHandles','typesetMath','autosizable','fillFrame','frameMargins',
    'showEditInChartStudio','watermark','showAxisRangeEntryBoxes','queueLength'];
  return [...document.querySelectorAll('.js-plotly-plot')].map((gd, i) => {
    const full = {};
    for (const k of FULL_KEYS) if (gd._fullLayout && k in gd._fullLayout) full[k] = serialize([gd._fullLayout[k], 6, true]);
    const ctx = {};
    for (const k of CONTEXT_KEYS) if (gd._context && k in gd._context) ctx[k] = serialize([gd._context[k], 3, true]);
    const layoutNoTemplate = Object.assign({}, gd.layout); delete layoutNoTemplate.template;
    const rect = gd.getBoundingClientRect();
    return {
      index: i,
      rect: {x: rect.x, y: rect.y, width: rect.width, height: rect.height},
      data: serialize([gd.data, 6, true]),
      layout: serialize([layoutNoTemplate, 8, true]),
      template: serialize([gd.layout && gd.layout.template, 8, false]),
      fullLayout: full,
      context: ctx,
      fullDataTypes: (gd._fullData || []).map(t => ({type: t.type, mode: t.mode, name: t.name, visible: t.visible,
        showlegend: t.showlegend, fill: t.fill, line: t.line && {color: t.line.color, width: t.line.width, dash: t.line.dash},
        marker: t.marker && {color: t.marker.color, size: t.marker.size, symbol: t.marker.symbol}, opacity: t.opacity,
        fillcolor: t.fillcolor, hovertemplate: t.hovertemplate, hoverinfo: t.hoverinfo})),
    };
  });
}
"""

STYLES_JS = """
(args) => {
  const [rootSelector, props, limit] = args;
  const root = document.querySelector(rootSelector) || document.body;
  const out = new Map();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  let el = root, n = 0;
  while (el && n < limit) {
    n++;
    const inPlot = el.closest('.js-plotly-plot') && !el.classList.contains('js-plotly-plot');
    const inSvg = el.closest('svg') && el.tagName.toLowerCase() !== 'svg';
    if (!inPlot && !inSvg) {
      const cs = getComputedStyle(el);
      const style = {};
      for (const p of props) style[p] = cs.getPropertyValue(p);
      const holder = el.closest('[data-testid]');
      const testid = holder ? holder.getAttribute('data-testid') : '';
      const classes = [...el.classList].filter(c => !/^(st-emotion-cache|e[0-9a-z]{6,}|st-[a-z]{2}$)/.test(c)).join('.');
      const key = el.tagName + '|' + testid + '|' + classes + '|' + JSON.stringify(style);
      if (!out.has(key)) {
        const text = (el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 60);
        out.set(key, {tag: el.tagName.toLowerCase(), testid, classes, count: 0, example: text, style});
      }
      out.get(key).count++;
    }
    el = walker.nextNode();
  }
  return {elementsVisited: n, unique: [...out.values()]};
}
"""

DOM_JS = """
(selector) => {
  const root = document.querySelector(selector) || document.documentElement;
  const clone = root.cloneNode(true);
  clone.querySelectorAll('.js-plotly-plot').forEach(p => { p.innerHTML = '<!-- Plotly-Chart: siehe plotly.json -->'; });
  clone.querySelectorAll('svg').forEach(s => { if (s.outerHTML.length > 6000) s.innerHTML = '<!-- SVG gekuerzt -->'; });
  return clone.outerHTML;
}
"""

META_JS = """
() => ({
  url: location.href,
  title: document.title,
  lang: document.documentElement.lang,
  meta: [...document.querySelectorAll('meta')].map(m => Object.fromEntries([...m.attributes].map(a => [a.name, a.value]))),
  links: [...document.querySelectorAll('link')].map(l => ({rel: l.rel, href: l.getAttribute('href'), type: l.type, sizes: l.getAttribute('sizes')})),
  jsonld: [...document.querySelectorAll('script[type="application/ld+json"]')].map(s => s.textContent),
  bodyBackground: getComputedStyle(document.body).backgroundColor,
  scrollHeight: document.documentElement.scrollHeight,
})
"""

WIDGETS_JS = """
() => {
  const txt = (e) => e ? e.textContent.trim().replace(/\\s+/g, ' ') : null;
  return {
    sliders: [...document.querySelectorAll('[data-testid="stSlider"]')].map(s => {
      const thumb = s.querySelector('[role="slider"]');
      const track = thumb && thumb.parentElement;
      const tb = thumb && thumb.getBoundingClientRect();
      const rb = s.getBoundingClientRect();
      return {
        label: txt(s.querySelector('[data-testid="stWidgetLabel"]')),
        ariaMin: thumb && thumb.getAttribute('aria-valuemin'),
        ariaMax: thumb && thumb.getAttribute('aria-valuemax'),
        ariaNow: thumb && thumb.getAttribute('aria-valuenow'),
        ariaText: thumb && thumb.getAttribute('aria-valuetext'),
        thumbValue: txt(s.querySelector('[data-testid="stSliderThumbValue"]')),
        tickMin: txt(s.querySelector('[data-testid="stSliderTickBarMin"]')),
        tickMax: txt(s.querySelector('[data-testid="stSliderTickBarMax"]')),
        thumbCenterFraction: tb ? ((tb.x + tb.width / 2) - rb.x) / rb.width : null,
      };
    }),
    selects: [...document.querySelectorAll('[data-testid="stSelectbox"]')].map(s => ({
      label: txt(s.querySelector('[data-testid="stWidgetLabel"]')),
      value: txt(s.querySelector('[data-baseweb="select"]')),
    })),
    checkboxes: [...document.querySelectorAll('[data-testid="stCheckbox"]')].map(c => ({
      label: txt(c), checked: c.querySelector('input') ? c.querySelector('input').checked : null,
    })),
    buttons: [...document.querySelectorAll('button, a[data-testid*="Button"]')].map(b => ({
      text: txt(b), testid: b.getAttribute('data-testid'), kind: b.getAttribute('kind'),
      disabled: b.disabled === true, ariaLabel: b.getAttribute('aria-label'),
    })).filter(b => b.text || b.ariaLabel),
    expanders: [...document.querySelectorAll('details')].map(d => ({summary: txt(d.querySelector('summary')), open: d.open})),
    headings: [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map(h => ({tag: h.tagName.toLowerCase(), text: txt(h), id: h.id})),
    images: [...document.querySelectorAll('img')].map(i => ({src: i.getAttribute('src'), alt: i.alt,
      naturalWidth: i.naturalWidth, naturalHeight: i.naturalHeight, renderedWidth: i.getBoundingClientRect().width})),
    links: [...document.querySelectorAll('a[href]')].map(a => ({text: txt(a), href: a.getAttribute('href'), target: a.target, rel: a.rel})),
    status: txt(document.querySelector('[data-testid="stStatusWidget"]')),
  };
}
"""

SUITE_BUSY_JS = """
() => {
  const status = document.querySelector('[data-testid="stStatusWidget"]');
  const running = status && /running|stop/i.test(status.textContent || '');
  const stale = document.querySelector('[data-stale="true"]');
  const plots = [...document.querySelectorAll('.js-plotly-plot')];
  const unplotted = plots.some(p => !p._fullLayout);
  const skeleton = document.querySelector('[data-testid="stSkeleton"], [data-testid="stAppSkeleton"]');
  const pendingImg = [...document.images].some(i => !i.complete);
  return Boolean(running || stale || unplotted || skeleton || pendingImg);
}
"""

SUITE_HEIGHT_JS = """
() => Math.max(...[document.scrollingElement,
  ...document.querySelectorAll('[data-testid="stMain"], [data-testid="stAppViewContainer"], [data-testid="stSidebarContent"], [data-testid="stSidebarUserContent"], section.main')]
  .filter(Boolean).map(e => e.scrollHeight))
"""

SITE_PAGES = [
    ("home", "/"),
    ("blog", "/blog/"),
    ("post-two-tank-battery-model", "/blog/two-tank-battery-model/"),
    ("tools", "/tools/"),
    ("404", "/this-page-does-not-exist/"),
    ("post-not-found", "/blog/does-not-exist/"),
]

SUITE_TOOLS = [
    ("materials", "Open Materials", "Understand Materials with the Tank Analogy"),
    ("cell-reconstruction", "Open Cell Reconstruction", "Understand Batteries with the Tank Analogy"),
    ("blending", "Open Blending", "Blend OCV Tool"),
    ("aging", "Open Aging", "Understand Aging Modes with the Tank Analogy"),
    ("swelling", "Open Swelling", "Understand Swelling"),
]


def write_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=1, ensure_ascii=False), encoding="utf-8")


class Recorder:
    """Protokolliert Anfragen einer Seite und blockiert fremde Domains."""

    def __init__(self, context):
        self.requests = []
        self.console = []
        context.route("**/*", self._route)

    def _route(self, route):
        req = route.request
        host = urlparse(req.url).hostname or ""
        foreign = req.url.startswith("http") and host not in LOCAL_HOSTS
        self.requests.append({"url": req.url, "method": req.method, "type": req.resource_type,
                              "foreign": foreign, "blocked": foreign})
        if foreign:
            route.abort()
        else:
            route.continue_()

    def attach(self, page):
        page.on("console", lambda m: self.console.append({"type": m.type, "text": m.text[:500]})
                if m.type in ("error", "warning") else None)
        page.on("pageerror", lambda e: self.console.append({"type": "pageerror", "text": str(e)[:500]}))

    def snapshot(self):
        return {"requests": list(self.requests), "console": list(self.console)}


def lazy_scroll(page):
    # Synchrone Einzelschritte: bei deaktiviertem JS laufen im Seitenkontext keine Timer/Promises.
    height = page.evaluate("() => document.documentElement.scrollHeight")
    for y in range(0, int(height), 400):
        page.evaluate(f"() => window.scrollTo(0, {y})")
        page.wait_for_timeout(50)
    page.evaluate("() => window.scrollTo(0, 0)")
    deadline = time.time() + 60
    while not page.evaluate("() => [...document.images].every(i => i.complete)"):
        if time.time() > deadline:
            raise TimeoutError("Bilder nicht geladen")
        page.wait_for_timeout(200)
    page.wait_for_timeout(300)


def wait_suite_idle(page, timeout_s=90):
    page.wait_for_selector('[data-testid="stAppViewContainer"]', timeout=timeout_s * 1000)
    deadline = time.time() + timeout_s
    stable = 0
    while time.time() < deadline:
        stable = 0 if page.evaluate(SUITE_BUSY_JS) else stable + 1
        if stable >= 6:
            return
        page.wait_for_timeout(250)
    raise TimeoutError("Streamlit-Seite wurde nicht ruhig")


def measure(page, out_dir: Path, root_selector: str, with_plotly: bool):
    out_dir.mkdir(parents=True, exist_ok=True)
    write_json(out_dir / "meta.json", page.evaluate(META_JS))
    (out_dir / "dom.html").write_text(page.evaluate(DOM_JS, root_selector), encoding="utf-8")
    write_json(out_dir / "styles.json", page.evaluate(STYLES_JS, [root_selector, STYLE_PROPS, 6000]))
    write_json(out_dir / "widgets.json", page.evaluate(WIDGETS_JS))
    if with_plotly:
        write_json(out_dir / "plotly.json", page.evaluate(PLOTLY_JS, [SERIALIZE_JS]))


def suite_screenshot(page, path: Path, width: int):
    page.mouse.move(0, 0)  # keine Hover-Modebar im Screenshot
    height = page.evaluate(SUITE_HEIGHT_JS)
    page.set_viewport_size({"width": width, "height": max(BASE_HEIGHT, min(int(height) + 40, 9000))})
    page.wait_for_timeout(600)
    wait_suite_idle(page)
    path.parent.mkdir(parents=True, exist_ok=True)
    page.screenshot(path=str(path))
    page.set_viewport_size({"width": width, "height": BASE_HEIGHT})
    page.wait_for_timeout(300)


def run_site(browser):
    for js in (True, False):
        for width in WIDTHS:
            for name, path in SITE_PAGES:
                context = browser.new_context(viewport={"width": width, "height": BASE_HEIGHT},
                                              java_script_enabled=js, device_scale_factor=1)
                rec = Recorder(context)
                page = context.new_page()
                rec.attach(page)
                page.goto(SITE + path, wait_until="networkidle")
                if js:
                    page.wait_for_selector('a[aria-label="Go to homepage"]', timeout=30000)
                    page.wait_for_load_state("networkidle")
                lazy_scroll(page)
                state = "js" if js else "nojs"
                out = INV / "site" / f"{name}__{state}__{width}"
                if width == 1280 or not js:
                    measure(page, out, "body", with_plotly=False)
                else:
                    out.mkdir(parents=True, exist_ok=True)
                    write_json(out / "widgets.json", page.evaluate(WIDGETS_JS))
                page.screenshot(path=str(SHOTS / "site" / f"{name}__{state}__{width}.png"), full_page=True)
                if js and width == 390:
                    toggle = page.locator('button[aria-label="Open navigation menu"]')
                    if toggle.count():
                        toggle.click()
                        page.wait_for_timeout(300)
                        page.screenshot(path=str(SHOTS / "site" / f"{name}__js-menu-open__{width}.png"), full_page=False)
                write_json(out / "network.json", rec.snapshot())
                print("site", name, state, width, "ok")
                context.close()


def open_suite_page(browser, width, tool=None):
    context = browser.new_context(viewport={"width": width, "height": BASE_HEIGHT}, device_scale_factor=1)
    rec = Recorder(context)
    page = context.new_page()
    rec.attach(page)
    page.goto(SUITE + "/", wait_until="domcontentloaded")
    page.wait_for_selector('h1:has-text("Charge Tanks Suite")', timeout=90000)
    wait_suite_idle(page)
    if tool:
        _, button, heading = tool
        page.get_by_role("button", name=button).click()
        page.wait_for_selector(f'h1:has-text("{heading}")', timeout=90000)
        page.wait_for_timeout(500)
        wait_suite_idle(page)
    return context, page, rec


def open_sidebar(page):
    for selector in ('[data-testid="stExpandSidebarButton"]', '[data-testid="stSidebarCollapsedControl"] button',
                     'button[aria-label*="sidebar" i]'):
        loc = page.locator(selector)
        if loc.count() and loc.first.is_visible():
            loc.first.click()
            page.wait_for_timeout(800)
            return selector
    return None


def run_suite(browser):
    targets = [("landing", None)] + [(t[0], t) for t in SUITE_TOOLS]
    for width in WIDTHS:
        for name, tool in targets:
            context, page, rec = open_suite_page(browser, width, tool)
            out = INV / "suite" / f"{name}__{width}"
            measure(page, out, "body", with_plotly=(width == 1280))
            suite_screenshot(page, SHOTS / "suite" / f"{name}__default__{width}.png", width)
            if tool:
                summary = page.locator('[data-testid="stExpander"] summary')
                if summary.count():
                    summary.first.click()
                    page.wait_for_timeout(600)
                    if width == 1280:
                        (out / "expander-open.dom.html").write_text(
                            page.evaluate(DOM_JS, '[data-testid="stExpander"]'), encoding="utf-8")
                        write_json(out / "expander-open.styles.json",
                                   page.evaluate(STYLES_JS, ['[data-testid="stExpander"]', STYLE_PROPS, 3000]))
                    suite_screenshot(page, SHOTS / "suite" / f"{name}__expander-open__{width}.png", width)
                    summary.first.click()
                    page.wait_for_timeout(400)
            if width == 390:
                used = open_sidebar(page)
                write_json(out / "sidebar-toggle.json", {"selector": used})
                if used:
                    suite_screenshot(page, SHOTS / "suite" / f"{name}__sidebar-open__{width}.png", width)
                    write_json(out / "sidebar-open.widgets.json", page.evaluate(WIDGETS_JS))
            write_json(out / "network.json", rec.snapshot())
            print("suite", name, width, "ok")
            context.close()


def marker_x(page, plot_index):
    return page.evaluate("""(i) => {
        const gd = document.querySelectorAll('.js-plotly-plot')[i];
        if (!gd) return null;
        const t = gd.data.find(d => d.mode === 'markers');
        return t ? Array.from(t.x)[0] : null;
    }""", plot_index)


def slider_state(page, label):
    return page.evaluate("""(label) => {
        const s = [...document.querySelectorAll('[data-testid="stSlider"]')]
          .find(e => (e.querySelector('[data-testid="stWidgetLabel"]')?.textContent || '').trim() === label);
        if (!s) return null;
        const t = s.querySelector('[role="slider"]');
        const tb = t.getBoundingClientRect(), rb = s.getBoundingClientRect();
        return {ariaNow: t.getAttribute('aria-valuenow'), ariaMin: t.getAttribute('aria-valuemin'),
                ariaMax: t.getAttribute('aria-valuemax'),
                thumbValue: s.querySelector('[data-testid="stSliderThumbValue"]')?.textContent,
                tickMin: s.querySelector('[data-testid="stSliderTickBarMin"]')?.textContent,
                tickMax: s.querySelector('[data-testid="stSliderTickBarMax"]')?.textContent,
                thumbCenterFraction: ((tb.x + tb.width / 2) - rb.x) / rb.width};
    }""", label)


def slider_thumb(page, label):
    return page.locator('[data-testid="stSlider"]').filter(
        has=page.locator('[data-testid="stWidgetLabel"]', has_text=label)).locator('[role="slider"]').first


def status_text(page):
    return page.evaluate("() => document.querySelector('[data-testid=\"stStatusWidget\"]')?.textContent || ''")


def run_probes(browser):
    results = {}
    # 1) Materials: Neuberechnung beim Ziehen oder erst beim Loslassen? Tastatur-Schritt?
    context, page, _ = open_suite_page(browser, 1280, SUITE_TOOLS[0])
    thumb = slider_thumb(page, "SoL")
    box = thumb.bounding_box()
    probe = {"initial": {"slider": slider_state(page, "SoL"), "marker_x": marker_x(page, 1)}}
    page.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
    page.mouse.down()
    for i in range(1, 11):
        page.mouse.move(box["x"] + box["width"] / 2 + 6 * i, box["y"] + box["height"] / 2)
        page.wait_for_timeout(30)
    page.wait_for_timeout(2500)
    probe["during_drag"] = {"slider": slider_state(page, "SoL"), "marker_x": marker_x(page, 1),
                            "status": status_text(page)}
    page.mouse.up()
    page.wait_for_timeout(1500)
    wait_suite_idle(page)
    probe["after_release"] = {"slider": slider_state(page, "SoL"), "marker_x": marker_x(page, 1)}
    thumb.focus()
    page.keyboard.press("ArrowRight")
    page.wait_for_timeout(1500)
    wait_suite_idle(page)
    probe["after_arrow_right"] = {"slider": slider_state(page, "SoL"), "marker_x": marker_x(page, 1)}
    page.keyboard.press("PageUp")
    page.wait_for_timeout(1500)
    wait_suite_idle(page)
    probe["after_page_up"] = {"slider": slider_state(page, "SoL"), "marker_x": marker_x(page, 1)}
    page.keyboard.press("Home")
    page.wait_for_timeout(1500)
    wait_suite_idle(page)
    probe["after_home"] = {"slider": slider_state(page, "SoL"), "marker_x": marker_x(page, 1)}
    sel = page.locator('[data-testid="stSelectbox"]').first
    sel.click()
    page.wait_for_timeout(500)
    probe["material_options"] = page.evaluate(
        "() => [...document.querySelectorAll('[role=\"option\"]')].map(o => o.textContent.trim())")
    page.keyboard.press("Escape")
    results["materials_slider_and_select"] = probe
    context.close()

    # 2) Swelling: SoH-Slider (min>max, negativer Schritt) und Reset des Kompressions-Sliders
    context, page, _ = open_suite_page(browser, 1280, SUITE_TOOLS[4])
    probe = {"soh_initial": slider_state(page, "State of Health"),
             "compression_initial": slider_state(page, "Compression [MPa]")}
    t = slider_thumb(page, "State of Health")
    t.focus()
    page.keyboard.press("ArrowRight")
    page.wait_for_timeout(1500)
    wait_suite_idle(page)
    probe["soh_after_arrow_right"] = slider_state(page, "State of Health")
    t = slider_thumb(page, "State of Health")
    t.focus()
    page.keyboard.press("ArrowLeft")
    page.wait_for_timeout(1500)
    wait_suite_idle(page)
    t = slider_thumb(page, "State of Health")
    t.focus()
    page.keyboard.press("ArrowLeft")
    page.wait_for_timeout(1500)
    wait_suite_idle(page)
    probe["soh_after_arrow_left_twice"] = slider_state(page, "State of Health")
    for _ in range(5):
        c = slider_thumb(page, "Compression [MPa]")
        c.focus()
        page.keyboard.press("ArrowRight")
        page.wait_for_timeout(1200)
        wait_suite_idle(page)
    probe["compression_after_5_right"] = slider_state(page, "Compression [MPa]")
    page.locator('[data-testid="stCheckbox"]').filter(has_text="Cylindrical?").locator("label").first.click()
    page.wait_for_timeout(1500)
    wait_suite_idle(page)
    probe["after_cylindrical_on"] = {"compression": slider_state(page, "Compression [MPa]"),
                                     "checkbox": page.evaluate(WIDGETS_JS)["checkboxes"]}
    page.locator('[data-testid="stCheckbox"]').filter(has_text="Cylindrical?").locator("label").first.click()
    page.wait_for_timeout(1500)
    wait_suite_idle(page)
    probe["after_cylindrical_off"] = {"compression": slider_state(page, "Compression [MPa]")}
    results["swelling_sliders"] = probe
    context.close()

    # 3) Aging: Materialwechsel aendert die Zelleinstellungen (SoH-Zeile)
    context, page, _ = open_suite_page(browser, 1280, SUITE_TOOLS[3])
    subheads = lambda: page.evaluate("() => [...document.querySelectorAll('h3')].map(h => h.textContent.trim())")
    probe = {"initial_h3": subheads()}
    selects = page.locator('[data-testid="stSelectbox"]')
    options = {}
    for i, label in enumerate(("Anode", "Cathode")):
        selects.nth(i).click()
        page.wait_for_timeout(500)
        options[label] = page.evaluate(
            "() => [...document.querySelectorAll('[role=\"option\"]')].map(o => o.textContent.trim())")
        page.keyboard.press("Escape")
        page.wait_for_timeout(300)
    probe["options"] = options
    selects.nth(0).click()
    page.wait_for_timeout(500)
    page.get_by_role("option", name="Graphite").click()
    page.wait_for_timeout(2000)
    wait_suite_idle(page)
    probe["after_anode_graphite_h3"] = subheads()
    probe["after_anode_graphite_widgets"] = page.evaluate(WIDGETS_JS)["selects"]
    results["aging_selects"] = probe
    context.close()
    write_json(INV / "suite" / "behaviour.json", results)
    print("probes ok")


def run_scheme(browser):
    """Vergleicht prefers-color-scheme hell/dunkel (Screenshots + Hintergrundfarben)."""
    from PIL import Image, ImageChops

    result = {}
    for name, url, ready in (("site-home", SITE + "/", 'a[aria-label="Go to homepage"]'),
                             ("suite-landing", SUITE + "/", 'h1:has-text("Charge Tanks Suite")')):
        shots = {}
        for scheme in ("light", "dark"):
            context = browser.new_context(viewport={"width": 1280, "height": BASE_HEIGHT}, color_scheme=scheme)
            Recorder(context)
            page = context.new_page()
            page.goto(url, wait_until="domcontentloaded")
            page.wait_for_selector(ready, timeout=90000)
            if name.startswith("suite"):
                wait_suite_idle(page)
            else:
                page.wait_for_load_state("networkidle")
            path = INV / "scheme" / f"{name}__{scheme}.png"
            path.parent.mkdir(parents=True, exist_ok=True)
            page.screenshot(path=str(path))
            shots[scheme] = {"path": str(path.relative_to(ROOT)), "body_bg": page.evaluate(
                "() => getComputedStyle(document.body).backgroundColor")}
            context.close()
        diff = ImageChops.difference(Image.open(ROOT / shots["light"]["path"]).convert("RGB"),
                                     Image.open(ROOT / shots["dark"]["path"]).convert("RGB")).getbbox()
        result[name] = {"shots": shots, "pixel_difference_bbox": diff, "identical": diff is None}
    write_json(INV / "scheme" / "result.json", result)
    print("scheme", {k: v["identical"] for k, v in result.items()})


def main():
    what = sys.argv[1] if len(sys.argv) > 1 else "all"
    with sync_playwright() as p:
        browser = p.chromium.launch()
        if what in ("site", "all"):
            run_site(browser)
        if what in ("suite", "all"):
            run_suite(browser)
        if what in ("probe", "all"):
            run_probes(browser)
        if what in ("scheme", "all"):
            run_scheme(browser)
        browser.close()


if __name__ == "__main__":
    main()
