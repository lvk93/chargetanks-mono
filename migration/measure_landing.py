"""Misst am Original die Bild-Werkzeugleiste der Landing-Seite (st.image): Hover, Vollbild, Escape.

Ergebnis: migration/inventory/suite/landing-image/ (Screenshots, DOM und berechnete Stile).
Aufruf: migration/.work/venv-tools/Scripts/python.exe migration/measure_landing.py
"""
import sys

sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parent))
from inventory import INV, open_suite_page, sync_playwright, write_json  # noqa: E402

OUT = INV / "suite" / "landing-image"

STYLE_JS = r"""
(sel) => [...document.querySelectorAll(sel)].map(e => { const s = getComputedStyle(e); const r = e.getBoundingClientRect();
  return {tag: e.tagName, testid: e.dataset.testid || '', cls: e.className && e.className.baseVal === undefined ? e.className : '',
          rect: [r.x, r.y, r.width, r.height],
          style: Object.fromEntries(['display','position','top','right','left','bottom','z-index','opacity','visibility',
            'transition','padding','margin','background-color','border-radius','box-shadow','width','height','max-width',
            'max-height','object-fit','inset','color','gap','align-items','justify-content','overflow','transform',
            'cursor','font-size'].map(k => [k, s.getPropertyValue(k)]))}; })
"""


def snap(page, name, selectors):
    page.screenshot(path=str(OUT / f"{name}.png"))
    return {sel: page.evaluate(STYLE_JS, sel) for sel in selectors}


def main():
    report = {}
    sels = ['[data-testid="stFullScreenFrame"]', '[data-testid="stElementToolbar"]',
            '[data-testid="stElementToolbarButtonContainer"]', '[data-testid="stBaseButton-elementToolbar"]',
            '[data-testid="stImage"]', '[data-testid="stImageContainer"]', '[data-testid="stImageContainer"] img']
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for width in (1280, 390):
            ctx, page, _ = open_suite_page(browser, width)
            page.wait_for_timeout(800)
            img = page.locator('[data-testid="stImage"]').first
            img.scroll_into_view_if_needed()
            report[f"{width}_idle"] = snap(page, f"{width}_idle", sels[:4])
            img.hover()
            page.wait_for_timeout(600)
            report[f"{width}_hover"] = snap(page, f"{width}_hover", sels)
            page.locator('[data-testid="stBaseButton-elementToolbar"]').first.hover()
            page.wait_for_timeout(600)
            report[f"{width}_hover_button"] = snap(page, f"{width}_hover_button", sels[2:4])
            report[f"{width}_tooltip"] = page.evaluate(
                "() => [...document.querySelectorAll('[role=tooltip], [data-testid=stTooltipContent]')].map(e => e.outerHTML)")
            page.locator('[data-testid="stBaseButton-elementToolbar"]').first.click()
            page.wait_for_timeout(1000)
            page.mouse.move(5, 5)
            page.wait_for_timeout(600)
            report[f"{width}_fullscreen"] = snap(page, f"{width}_fullscreen", sels)
            report[f"{width}_fullscreen_dom"] = page.evaluate(
                "() => document.querySelector('[data-testid=stFullScreenFrame] > div').outerHTML.slice(0, 4000)")
            report[f"{width}_fullscreen_body_overflow"] = page.evaluate("() => getComputedStyle(document.body).overflow")
            page.keyboard.press("Escape")
            page.wait_for_timeout(800)
            report[f"{width}_after_escape"] = snap(page, f"{width}_after_escape", sels[:1] + sels[-1:])
            ctx.close()
        browser.close()
    write_json(OUT / "report.json", report)


if __name__ == "__main__":
    main()
