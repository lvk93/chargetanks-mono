"""Browser-Vergleich der Landing-Seite alt (Streamlit, :8501) / neu (/tools/suite/, NEW_URL).

- Screenshots 1280/390 (ganze Seite) + Diff
- Lage und berechnete Stile einander entsprechender Elemente (Ueberschriften, Karten, Buttons, Bilder, Linkbutton,
  Fusszeile)
- Texte und Linkziele, Bild-Werkzeugleiste (Hover, Vollbild, Escape), Netzwerk/Konsole der neuen Seite
Ergebnis: migration/inventory/compare/suite.json, migration/screenshots/compare/suite/
Aufruf: migration/.work/venv-tools/Scripts/python.exe migration/landing_compare.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from compare import (INV, SHOTS, Diff, image_diff, open_new, open_suite_page, stretch_and_shoot,  # noqa: E402
                     sync_playwright, write_json)

OUT = SHOTS / "suite"
OLD_H = "() => document.querySelector('[data-testid=\"stMain\"]').scrollHeight"
NEW_H = "() => document.querySelector('.st-main').scrollHeight"

# Paare (alt, neu): jeweils alle Treffer in Dokumentreihenfolge
PAIRS = {
    "h1": ('[data-testid="stMarkdownContainer"] h1', ".st-md h1"),
    "h2": ('[data-testid="stMarkdownContainer"] h2', ".st-md h2"),
    "h2-anchor": ('[data-testid="stMarkdownContainer"] h2 [data-testid="stHeaderActionElements"]',
                  ".st-md h2 .st-heading-actions"),
    "card": (".card", ".card"),
    "card-p": (".card p", ".card p"),
    "button": ('[data-testid="stBaseButton-secondary"]', ".st-button--landing"),
    "button-p": ('[data-testid="stBaseButton-secondary"] p', ".st-button--landing p"),
    "image": ('[data-testid="stImageContainer"] img', ".st-image-container img"),
    "toolbar": ('[data-testid="stElementToolbar"]', ".st-toolbar"),
    "toolbar-buttons": ('[data-testid="stElementToolbarButtonContainer"]', ".st-toolbar-buttons"),
    "toolbar-button": ('[data-testid="stBaseButton-elementToolbar"]', ".st-toolbar-button"),
    "toolbar-icon": ('[data-testid="stElementToolbarButtonIcon"]', ".st-toolbar-icon"),
    "hr": ('[data-testid="stMarkdownContainer"] hr', ".st-md hr"),
    "columns": ('[data-testid="stColumn"]', ".st-column"),
    "linkbutton": ('[data-testid="stBaseLinkButton-secondary"]', ".st-link-button"),
    "linkbutton-p": ('[data-testid="stBaseLinkButton-secondary"] p', ".st-link-button p"),
    "footer": (".footer", ".footer"),
    "header": ('[data-testid="stHeader"]', ".st-header"),
    "app": ('[data-testid="stApp"]', ".st-app"),
}
PROPS = ["display", "font-family", "font-size", "font-weight", "line-height", "color", "background-color", "margin-top",
         "margin-bottom", "margin-left", "margin-right", "padding-top", "padding-bottom", "padding-left", "padding-right",
         "border-top-width", "border-top-style", "border-top-color", "border-radius", "box-shadow", "text-align",
         "letter-spacing", "opacity", "text-decoration-line", "cursor", "max-width", "object-fit"]

MEASURE_JS = """
([pairs, props, side]) => {
  const main = document.querySelector(side ? '.st-main' : '[data-testid="stMain"]');
  return Object.fromEntries(Object.entries(pairs).map(([k, sels]) => [k,
    [...document.querySelectorAll(sels[side])].map(e => {
      const r = e.getBoundingClientRect();
      const s = getComputedStyle(e);
      return {rect: [r.x, r.y + main.scrollTop, r.width, r.height].map(v => Math.round(v * 100) / 100),
              style: Object.fromEntries(props.map(p => [p, s.getPropertyValue(p)]))};
    })]));
}
"""
TEXT_JS = """
(side) => ({
  title: document.title,
  headings: [...document.querySelectorAll('h1, h2')].map(h => ({text: h.innerText.trim(), id: h.id})),
  paragraphs: [...document.querySelectorAll('.card p, .footer')].map(p => p.innerText.trim()),
  buttons: [...document.querySelectorAll(side ? '.st-button--landing, .st-link-button' :
             '[data-testid="stBaseButton-secondary"], [data-testid="stBaseLinkButton-secondary"]')]
           .map(b => b.innerText.trim()),
  links: [...document.querySelectorAll(side ? '.st-link-button' : '[data-testid="stBaseLinkButton-secondary"]')]
           .map(a => [a.getAttribute('href'), a.getAttribute('target')]),
})
"""
SHOT_NAMES = ("hover0", "hover-button0", "fullscreen0", "escape0", "hover4", "hover-button4", "fullscreen4", "escape4")


def open_old(browser, width):
    ctx, page, _ = open_suite_page(browser, width)
    page.wait_for_timeout(1000)
    return ctx, page


def open_newp(browser, width):
    ctx, page, rec = open_new(browser, width, "/tools/suite/")
    page.wait_for_function("() => [...document.images].every(i => i.complete)")
    page.wait_for_timeout(500)
    return ctx, page, rec


def toolbar_shots(page, label, width, img_sel, btn_sel, report):
    for idx in (0, 4):
        img = page.locator(img_sel).nth(idx)
        img.scroll_into_view_if_needed()
        page.wait_for_timeout(300)
        img.hover()
        page.wait_for_timeout(700)
        page.screenshot(path=str(OUT / f"hover{idx}__{width}__{label}.png"))
        page.locator(btn_sel).nth(idx).hover()
        page.wait_for_timeout(500)
        page.screenshot(path=str(OUT / f"hover-button{idx}__{width}__{label}.png"))
        page.locator(btn_sel).nth(idx).click()
        page.wait_for_timeout(1000)
        page.mouse.move(5, 300)
        page.wait_for_timeout(500)
        page.screenshot(path=str(OUT / f"fullscreen{idx}__{width}__{label}.png"))
        report["toolbar"][f"{label}_{width}_{idx}"] = {
            "label": page.locator(btn_sel).nth(idx).get_attribute("aria-label"),
            "body_overflow": page.evaluate("() => getComputedStyle(document.body).overflow")}
        page.keyboard.press("Escape")
        page.wait_for_timeout(800)
        page.mouse.move(5, 300)
        page.wait_for_timeout(500)
        page.screenshot(path=str(OUT / f"escape{idx}__{width}__{label}.png"))


def run():
    report = {"screenshots": {}, "layout": {}, "texts": None, "toolbar": {}}
    OUT.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for width in (1280, 390):
            ctx_o, old = open_old(browser, width)
            ctx_n, new, rec = open_newp(browser, width)
            for label, page, height_js in (("old", old, OLD_H), ("new", new, NEW_H)):
                stretch_and_shoot(page, OUT / f"default__{width}__{label}.png", width, height_js)
            key = f"default__{width}"
            report["screenshots"][key] = image_diff(OUT / f"{key}__old.png", OUT / f"{key}__new.png",
                                                    OUT / f"{key}__diff.png")
            diff = Diff()
            diff.compare(old.evaluate(MEASURE_JS, [PAIRS, PROPS, 0]), new.evaluate(MEASURE_JS, [PAIRS, PROPS, 1]),
                         "layout")
            report["layout"][str(width)] = diff.items
            if width == 1280:
                tdiff = Diff()
                tdiff.compare(old.evaluate(TEXT_JS, 0), new.evaluate(TEXT_JS, 1), "texts")
                report["texts"] = tdiff.items
                report["network"] = rec.snapshot()["requests"]
                report["console"] = rec.snapshot()["console"]
            toolbar_shots(old, "old", width, '[data-testid="stImage"]', '[data-testid="stBaseButton-elementToolbar"]',
                          report)
            toolbar_shots(new, "new", width, ".st-image", ".st-toolbar-button", report)
            for name in SHOT_NAMES:
                key = f"{name}__{width}"
                report["screenshots"][key] = image_diff(OUT / f"{key}__old.png", OUT / f"{key}__new.png",
                                                        OUT / f"{key}__diff.png")
            ctx_o.close()
            ctx_n.close()
        browser.close()
    report["foreign_requests"] = [r for r in report.get("network", []) if r["foreign"]]
    write_json(INV / "compare" / "suite.json", report)
    for k, v in report["screenshots"].items():
        print(k, v["changed_pixels"], v["changed_percent"], "%", v["bbox"], v["size_old"], v["size_new"])
    for w, items in report["layout"].items():
        print("layout", w, len(items))
        for it in items[:40]:
            print("  ", it)
    print("texts", report["texts"])
    print("toolbar", report["toolbar"])
    print("fremde Domains:", len(report["foreign_requests"]), "Konsole:", report["console"])


if __name__ == "__main__":
    run()
