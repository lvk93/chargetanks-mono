"""Verhaltens-Paare alt/neu fuer ein Tool: Vollbild eines Diagramms (Modebar-Button, Escape) und
eingeklappte Sidebar bei 1280 px. Ergebnis: migration/screenshots/compare/<tool>/{fullscreen,sidebar-collapsed}__*.
Aufruf: migration/.work/venv-tools/Scripts/python.exe migration/behaviour_compare.py aging
"""
import sys

from compare import NEW, SHOTS, TOOLS, NewUI, image_diff, open_new, open_suite_page, sync_playwright, write_json, INV


def run(tool):
    spec, out, report = TOOLS[tool], SHOTS / tool, {}
    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx_old, old, _ = open_suite_page(browser, 1280, spec["legacy"])
        ctx_new, new, _ = open_new(browser, 1280, spec["path"])
        NewUI(new, spec["ids"]).settle()
        for label, page in (("old", old), ("new", new)):
            plot = page.locator(".js-plotly-plot").nth(1)
            plot.hover()
            page.wait_for_timeout(400)
            plot.locator('.modebar-btn[data-title="Fullscreen"]').first.click()
            page.wait_for_timeout(1200)
            page.mouse.move(640, 450)
            page.wait_for_timeout(400)
            page.screenshot(path=str(out / f"fullscreen__1280__{label}.png"))
            report[f"fullscreen_{label}"] = page.evaluate("""() => { const gd = document.querySelectorAll('.js-plotly-plot')[1];
                return {w: gd.layout.width, h: gd.layout.height,
                        buttons: [...gd.querySelectorAll('.modebar-btn')].map(b => b.getAttribute('data-title'))}; }""")
            page.keyboard.press("Escape")
            page.wait_for_timeout(1000)
            report[f"after_escape_{label}"] = page.evaluate(
                "() => { const gd = document.querySelectorAll('.js-plotly-plot')[1]; return [gd.layout.width, gd.layout.height]; }")
        report["fullscreen_pixels"] = image_diff(out / "fullscreen__1280__old.png", out / "fullscreen__1280__new.png",
                                                 out / "fullscreen__1280__diff.png")
        old.mouse.move(100, 30)
        old.locator('[data-testid="stSidebarCollapseButton"] button').click()
        new.mouse.move(100, 30)
        new.locator("[data-st-sidebar-collapse]").click()
        for label, page in (("old", old), ("new", new)):
            page.wait_for_timeout(1200)
            page.mouse.move(1277, 3)
            page.wait_for_timeout(300)
            page.screenshot(path=str(out / f"sidebar-collapsed__1280__{label}.png"))
        report["sidebar_collapsed_pixels"] = image_diff(out / "sidebar-collapsed__1280__old.png",
                                                        out / "sidebar-collapsed__1280__new.png",
                                                        out / "sidebar-collapsed__1280__diff.png")
        browser.close()
    write_json(INV / "compare" / f"{tool}-behaviour.json", report)
    for k, v in report.items():
        print(k, v if not isinstance(v, dict) or "changed_percent" not in v else (v["changed_percent"], v["bbox"]))


if __name__ == "__main__":
    run(sys.argv[1] if len(sys.argv) > 1 else "aging")
