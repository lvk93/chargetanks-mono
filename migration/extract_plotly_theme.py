"""Liest Streamlits Plotly-Theme aus dem laufenden Original und schreibt assets/js/ui/plotlyTheme.js.

Streamlit 1.47.0 setzt in Python pio.templates.default = "streamlit" (Platzhalterfarben) und ersetzt im
Browser die Platzhalter durch die Theme-Farben. Massgeblich ist das Ergebnis im Browser: das Template,
das Plotly tatsaechlich erhaelt (gd.layout.template), und die Config (gd._context), inklusive des
Fullscreen-Buttons, den Streamlit in die Modebar einhaengt (Icon im Normal- und im Vollbildzustand).

Voraussetzung: Legacy-Suite auf http://localhost:8501. Aufruf:
  migration/.work/venv-tools/Scripts/python.exe migration/extract_plotly_theme.py
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from inventory import SUITE_TOOLS, open_suite_page, sync_playwright  # noqa: E402

OUT = Path(__file__).resolve().parent.parent / "assets" / "js" / "ui" / "plotlyTheme.js"

CONFIG_KEYS = ["displayModeBar", "displaylogo", "modeBarButtonsToRemove", "responsive", "showLink", "linkText",
               "scrollZoom", "doubleClick", "showTips", "editable", "staticPlot", "locale", "autosizable"]

JS = """(keys) => {
  const gd = document.querySelectorAll('.js-plotly-plot')[1];
  const config = {};
  for (const k of keys) if (k in gd._context) config[k] = gd._context[k];
  const button = (gd._context.modeBarButtonsToAdd || [])[0];
  return {template: JSON.parse(JSON.stringify(gd.layout.template)), config,
          fullscreen: button ? {name: button.name, title: button.title, icon: button.icon} : null,
          layoutKeys: Object.keys(gd.layout)};
}"""


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        context, page, _ = open_suite_page(browser, 1280, SUITE_TOOLS[3])
        normal = page.evaluate(JS, CONFIG_KEYS)
        plot = page.locator(".js-plotly-plot").nth(1)
        plot.hover()
        page.wait_for_timeout(300)
        plot.locator('.modebar-btn[data-title="Fullscreen"]').first.click()
        page.wait_for_timeout(800)
        full = page.evaluate(JS, CONFIG_KEYS)
        exit_titles = page.evaluate("""() => [...document.querySelectorAll('.js-plotly-plot')[1]
            .querySelectorAll('.modebar-btn')].map(b => b.getAttribute('data-title'))""")
        context.close()
        browser.close()
    assert json.dumps(normal["template"], sort_keys=True) == json.dumps(full["template"], sort_keys=True)
    lines = [
        "// Erzeugt von migration/extract_plotly_theme.py aus dem laufenden Original (Streamlit 1.47.0).",
        "// Nicht von Hand aendern: Template und Config so, wie Streamlit sie an plotly.js 3.0.1 uebergibt.",
        "",
        f"export const STREAMLIT_TEMPLATE = {json.dumps(normal['template'], ensure_ascii=False, indent=1)};",
        "",
        f"export const STREAMLIT_CONFIG = {json.dumps(normal['config'], ensure_ascii=False, indent=1)};",
        "",
        "// Modebar-Button 'Fullscreen' (Streamlit): Icon im Normalzustand und im Vollbild",
        f"export const FULLSCREEN_BUTTON = {json.dumps(normal['fullscreen'], ensure_ascii=False, indent=1)};",
        f"export const FULLSCREEN_EXIT_BUTTON = {json.dumps(full['fullscreen'], ensure_ascii=False, indent=1)};",
        "",
        f"// Modebar im Vollbild (gemessen): {json.dumps(exit_titles)}",
        "",
    ]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text("\n".join(lines), encoding="utf-8")
    print("ok", OUT, normal["layoutKeys"], normal["fullscreen"] and normal["fullscreen"]["icon"]["name"],
          full["fullscreen"] and full["fullscreen"]["icon"]["name"])


if __name__ == "__main__":
    main()
