"""Browser-Vergleich der Webseite alt (React-Build, serve-legacy-site.mjs :4173) / neu (statisch, NEW_URL :8010).

Je Seite und Breite (1280, 390):
- Kopf: Titel, Meta, Canonical, JSON-LD
- alle Elemente in #root paarweise in Dokumentreihenfolge: Tag, Lage/Groesse, berechnete Stile (Auswahl)
  (neu ohne die Zusatzelemente fuer die Dynamik: verborgenes Mobilmenue, X-Icon, Jahres-<span>, <template>)
- Screenshots ganze Seite + Diff
Dazu: Mobilmenue offen (390), Hover-/Fokuszustaende, Scrollen zu /#about, Netzwerk und Konsole der neuen Seite.
Ergebnis: migration/inventory/compare/site.json, migration/screenshots/compare/site/
Aufruf: migration/.work/venv-tools/Scripts/python.exe migration/site_compare.py [seite ...]
"""
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from compare import INV, SHOTS, Diff, image_diff, write_json  # noqa: E402
from inventory import BASE_HEIGHT, Recorder, sync_playwright  # noqa: E402

OLD = os.environ.get("OLD_SITE_URL", "http://localhost:4173")
NEW = os.environ.get("NEW_URL", "http://localhost:8010")
OUT = SHOTS / "site"
PAGES = {
    "home": "/",
    "blog": "/blog/",
    "post": "/blog/two-tank-battery-model/",
    "tools": "/tools/",
    "404": "/does-not-exist/",
    "post-not-found": "/blog/does-not-exist/",
}
PROPS = ["display", "position", "font-family", "font-size", "font-weight", "font-style", "line-height", "color",
         "background-color", "background-image", "margin-top", "margin-bottom", "margin-left", "margin-right",
         "padding-top", "padding-bottom", "padding-left", "padding-right", "border-top-width", "border-bottom-width",
         "border-left-width", "border-top-color", "border-top-style", "border-radius", "box-shadow", "text-align",
         "letter-spacing", "text-transform", "text-decoration-line", "opacity", "transform", "filter",
         "backdrop-filter", "object-fit", "list-style-type", "list-style-position", "gap", "grid-template-columns",
         "order", "z-index", "overflow-x", "transition-property", "transition-duration", "cursor", "visibility",
         "scroll-margin-top", "white-space"]

EXTRA = '[data-ct-menu], [data-ct-menu] *, svg[data-ct-icon="close"], svg[data-ct-icon="close"] *, [data-ct-year], template'
ELEMENTS_JS = """
([props, extra]) => {
  const skip = new Set(extra ? document.querySelectorAll(extra) : []);
  return [...document.querySelectorAll('#root *')].filter(e => !skip.has(e)).map(e => {
    const r = e.getBoundingClientRect();
    const s = getComputedStyle(e);
    // eigener Text; das Jahres-<span> der neuen Seite zaehlt als Text seines Elternelements
    const own = [...e.childNodes].filter(n => n.nodeType === 3 || (n.dataset && 'ctYear' in n.dataset))
      .map(n => n.textContent).join('').trim();
    return {tag: e.tagName.toLowerCase(), text: own.slice(0, 60),
            rect: [r.x, r.y + window.scrollY, r.width, r.height].map(v => Math.round(v * 100) / 100),
            attrs: Object.fromEntries(['href', 'src', 'alt', 'target', 'rel', 'aria-label', 'aria-expanded', 'id',
                                       'datetime', 'loading', 'decoding', 'style', 'type']
                     .filter(a => e.hasAttribute(a)).map(a => [a, e.getAttribute(a)])),
            style: Object.fromEntries(props.map(p => [p, s.getPropertyValue(p)]))};
  });
}
"""
HEAD_JS = """
() => ({
  title: document.title,
  lang: document.documentElement.lang,
  meta: [...document.head.querySelectorAll('meta')].map(m => [m.name || m.getAttribute('property') || m.httpEquiv || 'charset',
                                                            m.content || m.getAttribute('charset')]),
  links: [...document.head.querySelectorAll('link')].filter(l => l.rel !== 'stylesheet' && l.rel !== 'modulepreload')
          .map(l => [l.rel, l.getAttribute('href'), l.type || null]),
  jsonld: [...document.head.querySelectorAll('script[type="application/ld+json"]')].map(s => JSON.parse(s.textContent)),
})
"""


def open_page(browser, base, path, width, recorder=False):
    ctx = browser.new_context(viewport={"width": width, "height": BASE_HEIGHT}, device_scale_factor=1)
    rec = Recorder(ctx) if recorder else None
    page = ctx.new_page()
    if rec:
        rec.attach(page)
    page.goto(base + path, wait_until="networkidle")
    page.wait_for_function("() => document.querySelector('#root') && document.querySelector('#root').children.length")
    page.wait_for_timeout(400)
    return ctx, page, rec


def full_shot(page, path, width):
    page.mouse.move(width - 2, BASE_HEIGHT - 2)
    # lazy-Bilder: Viewport schrittweise vergroessern, bis alle Bilder geladen sind und die Hoehe stabil ist
    height = 0
    for _ in range(10):
        new_height = page.evaluate("() => document.documentElement.scrollHeight")
        page.set_viewport_size({"width": width, "height": min(int(new_height), 12000)})
        page.wait_for_function("() => [...document.images].every(i => i.complete)", timeout=20000)
        page.evaluate("() => Promise.all([...document.images].map(i => i.decode().catch(() => null)))")
        page.wait_for_timeout(400)
        if new_height == height:
            break
        height = new_height
    path.parent.mkdir(parents=True, exist_ok=True)
    page.screenshot(path=str(path))
    page.set_viewport_size({"width": width, "height": BASE_HEIGHT})
    page.wait_for_timeout(200)


def compare_page(browser, name, path, width, report):
    ctx_o, old, _ = open_page(browser, OLD, path, width)
    ctx_n, new, rec = open_page(browser, NEW, path, width, recorder=True)
    key = f"{name}__{width}"
    head = Diff()
    head.compare(old.evaluate(HEAD_JS), new.evaluate(HEAD_JS), "head")
    els = Diff()
    full_shot(old, OUT / f"{key}__old.png", width)
    full_shot(new, OUT / f"{key}__new.png", width)
    els.compare(old.evaluate(ELEMENTS_JS, [PROPS, None]), new.evaluate(ELEMENTS_JS, [PROPS, EXTRA]), "elements")
    shot = image_diff(OUT / f"{key}__old.png", OUT / f"{key}__new.png", OUT / f"{key}__diff.png")
    snap = rec.snapshot()
    report["pages"][key] = {"head": head.items, "elements": els.items, "screenshot": shot,
                            "foreign": [r for r in snap["requests"] if r["foreign"]], "console": snap["console"],
                            "requests": len(snap["requests"])}
    print(key, "head", len(head.items), "elements", len(els.items), "pixels", shot["changed_pixels"],
          shot["bbox"], shot["size_old"], shot["size_new"], "fremd", len(report["pages"][key]["foreign"]),
          "console", snap["console"])
    ctx_o.close()
    ctx_n.close()


def menu_open(browser, report):
    for name, path in (("home", "/"), ("post", "/blog/two-tank-battery-model/")):
        res = {}
        for label, base in (("old", OLD), ("new", NEW)):
            ctx, page, _ = open_page(browser, base, path, 390)
            page.locator('header button[aria-label="Open navigation menu"]').click()
            page.wait_for_timeout(300)
            page.screenshot(path=str(OUT / f"menu-{name}__390__{label}.png"))
            res[label] = page.evaluate(ELEMENTS_JS.replace("#root *", "header, header *"),
                                       [PROPS, 'template' if label == 'new' else None])
            res[label + "_hidden"] = page.evaluate(
                "() => [...document.querySelectorAll('header *')].filter(e => getComputedStyle(e).display === 'none' "
                "|| e.closest('[hidden]')).length")
            page.locator('header button[aria-label="Close navigation menu"]').click()
            page.wait_for_timeout(300)
            res[label + "_closed_label"] = page.locator("header button").last.get_attribute("aria-label")
            ctx.close()
        d = Diff()
        new_visible = [e for e in res["new"] if e["style"]["display"] != "none" and e["rect"][2] > 0]
        old_visible = [e for e in res["old"] if e["style"]["display"] != "none" and e["rect"][2] > 0]
        d.compare(old_visible, new_visible, "menu")
        d.compare(res["old_closed_label"], res["new_closed_label"], "closed_label")
        shot = image_diff(OUT / f"menu-{name}__390__old.png", OUT / f"menu-{name}__390__new.png",
                          OUT / f"menu-{name}__390__diff.png")
        report["menu"][name] = {"differences": d.items, "screenshot": shot}
        print("menu", name, len(d.items), shot["changed_pixels"], shot["bbox"])


STATE_JS = """
(sel) => { const e = document.querySelectorAll(sel.css)[sel.i]; const s = getComputedStyle(e);
  return ['color', 'background-color', 'border-top-color', 'box-shadow', 'transform', 'gap', 'outline-style']
         .map(p => s.getPropertyValue(p)); }
"""
STATES = [  # (seite, alt-Selektor, neu-Selektor, index)
    ("home", "header nav a", "header nav a", 0),
    ("home", "#hero a", "#hero a", 0),
    ("home", "#hero a", "#hero a", 1),
    ("home", "#tools a", "#tools a", 1),
    ("home", "#blog article", "#blog article", 0),
    ("home", "#blog article a h3", "#blog article a h3", 0),
    ("home", "footer a", "footer a", 0),
    ("home", "footer a", "footer a", 2),
    ("tools", "main aside a", "main aside a", 0),
    ("post", "main section a", "main section a", 0),
    ("post", "nav[aria-label=Breadcrumb] a", "nav[aria-label=Breadcrumb] a", 0),
]


def states(browser, report):
    for name, sel_old, sel_new, i in STATES:
        res = {}
        for label, base, css in (("old", OLD, sel_old), ("new", NEW, sel_new)):
            ctx, page, _ = open_page(browser, base, PAGES[name], 1280)
            loc = page.locator(css).nth(i)
            loc.scroll_into_view_if_needed()
            target = {"css": css, "i": i}
            if css.endswith("h3"):  # group-hover: Hover auf den Link (Elternelement)
                page.locator("#blog article a").nth(i).hover()
            else:
                loc.hover()
            page.wait_for_timeout(400)
            res[label + "_hover"] = page.evaluate(STATE_JS, target)
            page.mouse.move(2, BASE_HEIGHT - 2)
            page.wait_for_timeout(300)
            if css.endswith("a"):
                loc.focus()
                page.keyboard.press("Shift+Tab")
                page.keyboard.press("Tab")
                page.wait_for_timeout(300)
                res[label + "_focus"] = page.evaluate(STATE_JS, target)
            ctx.close()
        d = Diff()
        d.compare({k[4:]: v for k, v in res.items() if k.startswith("old_")},
                  {k[4:]: v for k, v in res.items() if k.startswith("new_")}, f"{name}:{sel_old}[{i}]")
        report["states"].append(d.items)
        print("state", name, sel_old, i, len(d.items), d.items[:2])


def about_scroll(browser, report):
    res = {}
    for label, base in (("old", OLD), ("new", NEW)):
        ctx, page, _ = open_page(browser, base, "/", 1280)
        page.locator('header nav[aria-label=Primary] a[href="/#about"]').click()
        page.wait_for_timeout(100)
        early = page.evaluate("() => window.scrollY")
        page.wait_for_timeout(1500)
        res[label] = {"early_y": early, "final_y": page.evaluate("() => window.scrollY"),
                      "url": page.evaluate("() => location.pathname + location.hash")}
        page.locator('header nav[aria-label=Primary] a[href="/#about"]').click()  # gleiche Adresse: nichts
        page.wait_for_timeout(800)
        res[label]["again_y"] = page.evaluate("() => window.scrollY")
        page.go_back()
        page.wait_for_timeout(1500)
        res[label]["back_y"] = page.evaluate("() => window.scrollY")
        res[label]["back_url"] = page.evaluate("() => location.pathname + location.hash")
        ctx.close()
    report["about_scroll"] = res
    print("about", res)


def run(names):
    report = {"pages": {}, "menu": {}, "states": [], "about_scroll": None}
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for name in names:
            for width in (1280, 390):
                compare_page(browser, name, PAGES[name], width, report)
        if len(names) == len(PAGES):
            menu_open(browser, report)
            states(browser, report)
            about_scroll(browser, report)
        browser.close()
    write_json(INV / "compare" / ("site.json" if len(names) == len(PAGES) else f"site-{'-'.join(names)}.json"), report)


if __name__ == "__main__":
    run(sys.argv[1:] or list(PAGES))
