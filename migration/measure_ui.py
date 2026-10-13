"""Phase 1: Zusatzmessungen an der laufenden Legacy-Suite (Spezifikation fuer styles.css und UI).

  rules       CSS-Regeln (inkl. :hover/:focus/..., ::before/::after, @media, @font-face), die auf
              Elemente der Suite-Seiten passen -> inventory/suite/css-rules/<seite>.json
  breakpoints Sweep 320-1400 px auf Aging -> inventory/suite/breakpoints.json
  behaviour   Sidebar ein/aus + Resize, Fullscreen-Button, Slider-Tastatur, Debounce beim Ziehen
              -> inventory/suite/behaviour-ui.json (+ Screenshots in inventory/suite/ui-shots/)

Voraussetzung: Legacy-Suite auf http://localhost:8501 (migration/run_legacy_suite.ps1).
Aufruf: migration/.work/venv-tools/Scripts/python.exe migration/measure_ui.py [rules|breakpoints|behaviour|all]
"""

from __future__ import annotations

import sys
import time

from inventory import (INV, SUITE_TOOLS, Recorder, marker_x, open_suite_page, slider_state, slider_thumb,
                       sync_playwright, wait_suite_idle, write_json)

RULES_JS = r"""
() => {
  const DYNAMIC = /::?(hover|focus-visible|focus-within|focus|active|visited|disabled|enabled|checked|before|after|placeholder|selection|marker|-webkit-[a-z-]+|-moz-[a-z-]+)(\([^)]*\))?/g;
  const rules = [];
  const fontFaces = [];
  const keyframes = [];
  function walk(list, media) {
    for (const rule of list) {
      if (rule instanceof CSSStyleRule) rules.push({rule, media});
      else if (rule instanceof CSSMediaRule) walk(rule.cssRules, (media ? media + ' and ' : '') + rule.conditionText);
      else if (rule instanceof CSSSupportsRule) walk(rule.cssRules, media);
      else if (rule instanceof CSSFontFaceRule) fontFaces.push(rule.cssText);
      else if (rule instanceof CSSKeyframesRule) keyframes.push(rule.cssText.slice(0, 2000));
    }
  }
  for (const sheet of document.styleSheets) {
    try { walk(sheet.cssRules, ''); } catch (e) { /* cross-origin */ }
  }
  const root = document.querySelector('[data-testid="stApp"]') || document.body;
  const elements = [document.documentElement, document.body, ...root.querySelectorAll('*')].filter(el =>
    !(el.closest('.js-plotly-plot') && !el.classList.contains('js-plotly-plot')) &&
    !(el.closest('svg') && el.tagName.toLowerCase() !== 'svg'));
  const describe = (el) => {
    const holder = el.closest('[data-testid]');
    return el.tagName.toLowerCase() + (holder ? '@' + holder.getAttribute('data-testid') : '');
  };
  const out = [];
  for (const {rule, media} of rules) {
    const selectors = rule.selectorText.split(',').map(s => s.trim());
    const hits = new Set();
    for (const sel of selectors) {
      const base = sel.replace(DYNAMIC, '').replace(/\s+>?\s*$/, '').trim() || '*';
      let ok = true;
      try { document.querySelector(base); } catch (e) { ok = false; }
      if (!ok) continue;
      for (const el of elements) if (el.matches(base)) hits.add(describe(el));
    }
    if (hits.size) out.push({selector: rule.selectorText, media, css: rule.style.cssText, matches: [...hits].slice(0, 12)});
  }
  return {rules: out, fontFaces, keyframes, totalRules: rules.length};
}
"""

SIDEBAR_JS = r"""
() => {
  const sb = document.querySelector('[data-testid="stSidebar"]');
  const r = sb ? sb.getBoundingClientRect() : null;
  const main = document.querySelector('[data-testid="stMainBlockContainer"]') || document.querySelector('.block-container');
  const mr = main ? main.getBoundingClientRect() : null;
  const cs = main ? getComputedStyle(main) : null;
  const cols = [...document.querySelectorAll('[data-testid="stColumn"]')].slice(0, 4).map(c => {
    const b = c.getBoundingClientRect(); return {x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width)};
  });
  const header = document.querySelector('[data-testid="stHeader"]');
  const h1 = document.querySelector('h1');
  return {
    sidebar: r && {x: r.x, width: r.width, ariaExpanded: sb.getAttribute('aria-expanded'),
                   transform: getComputedStyle(sb).transform, position: getComputedStyle(sb).position},
    main: mr && {x: mr.x, width: mr.width, paddingLeft: cs.paddingLeft, paddingRight: cs.paddingRight,
                 paddingTop: cs.paddingTop, maxWidth: cs.maxWidth},
    columns: cols,
    header: header && {height: header.getBoundingClientRect().height, bg: getComputedStyle(header).backgroundColor},
    h1: h1 && {fontSize: getComputedStyle(h1).fontSize, lineHeight: getComputedStyle(h1).lineHeight},
    plots: [...document.querySelectorAll('.js-plotly-plot')].map(p => Math.round(p.getBoundingClientRect().width)),
    expandButton: !!document.querySelector('[data-testid="stExpandSidebarButton"]'),
  };
}
"""

PAGES_FOR_RULES = [("landing", None), ("aging", SUITE_TOOLS[3]), ("swelling", SUITE_TOOLS[4]),
                   ("cell-reconstruction", SUITE_TOOLS[1]), ("blending", SUITE_TOOLS[2]), ("materials", SUITE_TOOLS[0])]


def run_rules(browser):
    for name, tool in PAGES_FOR_RULES:
        context, page, _ = open_suite_page(browser, 1280, tool)
        summary = page.locator('[data-testid="stExpander"] summary')
        if summary.count():
            summary.first.click()  # Expander-Inhalt (Markdown, Codeblock) mit erfassen
            page.wait_for_timeout(500)
        result = page.evaluate(RULES_JS)
        write_json(INV / "suite" / "css-rules" / f"{name}.json", result)
        print("rules", name, len(result["rules"]), "von", result["totalRules"])
        context.close()


def run_breakpoints(browser):
    widths = [320, 390, 450, 500, 575, 576, 577, 600, 639, 640, 641, 700, 767, 768, 769, 800, 900,
              991, 992, 993, 1024, 1100, 1199, 1200, 1201, 1280, 1400]
    out = {}
    for width in widths:
        context, page, _ = open_suite_page(browser, width, SUITE_TOOLS[3])
        out[width] = page.evaluate(SIDEBAR_JS)
        context.close()
        print("bp", width, out[width]["sidebar"], out[width]["main"] and out[width]["main"]["paddingLeft"])
    write_json(INV / "suite" / "breakpoints.json", out)


def run_behaviour(browser):
    shots = INV / "suite" / "ui-shots"
    shots.mkdir(parents=True, exist_ok=True)
    res = {}

    # Sidebar ein-/ausklappen und Resize-Grenzen (Desktop)
    context, page, _ = open_suite_page(browser, 1280, SUITE_TOOLS[3])
    res["sidebar_initial"] = page.evaluate(SIDEBAR_JS)
    handle = page.evaluate("""() => {
        const el = [...document.querySelectorAll('[data-testid="stSidebar"] *')]
          .find(e => getComputedStyle(e).cursor === 'col-resize');
        if (!el) return null;
        const b = el.getBoundingClientRect();
        return {x: b.x + b.width / 2, y: b.y + b.height / 2, w: b.width, h: b.height};
    }""")
    res["resize_handle"] = handle
    if handle:
        for target in (450, 1000, 50, 256):
            page.mouse.move(handle["x"], handle["y"])
            page.mouse.down()
            page.mouse.move(target, handle["y"], steps=12)
            page.mouse.up()
            page.wait_for_timeout(500)
            state = page.evaluate(SIDEBAR_JS)
            res[f"resize_to_{target}"] = state["sidebar"]
            handle = page.evaluate("""() => {
                const el = [...document.querySelectorAll('[data-testid="stSidebar"] *')]
                  .find(e => getComputedStyle(e).cursor === 'col-resize');
                const b = el.getBoundingClientRect();
                return {x: b.x + b.width / 2, y: b.y + b.height / 2};
            }""")
    page.mouse.move(100, 30)
    page.wait_for_timeout(300)
    page.screenshot(path=str(shots / "sidebar-hover-collapse.png"), clip={"x": 0, "y": 0, "width": 400, "height": 160})
    collapse = page.locator('[data-testid="stSidebarCollapseButton"] button')
    res["collapse_button_visible_on_hover"] = collapse.is_visible()
    collapse.click()
    page.wait_for_timeout(800)
    res["after_collapse"] = page.evaluate(SIDEBAR_JS)
    page.screenshot(path=str(shots / "sidebar-collapsed-1280.png"), clip={"x": 0, "y": 0, "width": 1280, "height": 300})
    page.locator('[data-testid="stExpandSidebarButton"]').click()
    page.wait_for_timeout(800)
    res["after_expand"] = page.evaluate(SIDEBAR_JS)

    # Fullscreen-Button der Plotly-Modebar
    plot = page.locator('.js-plotly-plot').nth(1)
    plot.hover()
    page.wait_for_timeout(400)
    res["modebar_buttons"] = page.evaluate("""() => [...document.querySelectorAll('.js-plotly-plot')[1]
        .querySelectorAll('.modebar-btn')].map(b => b.getAttribute('data-title'))""")
    page.screenshot(path=str(shots / "modebar-hover.png"))
    btn = page.locator('.js-plotly-plot').nth(1).locator('.modebar-btn[data-title="Fullscreen"]')
    if btn.count():
        btn.first.click()
        page.wait_for_timeout(1000)
        res["fullscreen_state"] = page.evaluate("""() => {
            const gd = document.querySelectorAll('.js-plotly-plot')[1];
            const b = gd.getBoundingClientRect();
            let el = gd, chain = [];
            while (el && el !== document.body) {
              const cs = getComputedStyle(el);
              if (cs.position === 'fixed' || el.getAttribute('data-testid')) chain.push({
                testid: el.getAttribute('data-testid'), position: cs.position, zIndex: cs.zIndex,
                bg: cs.backgroundColor, inset: [cs.top, cs.left, cs.right, cs.bottom], w: el.getBoundingClientRect().width});
              el = el.parentElement;
            }
            return {documentFullscreen: !!document.fullscreenElement, plot: {x: b.x, y: b.y, w: b.width, h: b.height},
                    layoutWH: [gd.layout.width, gd.layout.height], chain,
                    buttons: [...document.querySelectorAll('button')].map(x => x.getAttribute('aria-label') || x.textContent.trim()).filter(Boolean).slice(0, 20)};
        }""")
        page.screenshot(path=str(shots / "fullscreen-1280.png"))
        page.keyboard.press("Escape")
        page.wait_for_timeout(800)
        res["after_escape"] = page.evaluate("""() => { const gd = document.querySelectorAll('.js-plotly-plot')[1];
            const b = gd.getBoundingClientRect(); return {x: b.x, y: b.y, w: b.width, h: b.height}; }""")
    context.close()

    # Slider-Tastatur: jede Taste neu fokussiert, auf Aging (SoC)
    context, page, _ = open_suite_page(browser, 1280, SUITE_TOOLS[3])
    keys = {}
    for key in ("ArrowRight", "ArrowUp", "ArrowLeft", "ArrowDown", "PageUp", "PageDown", "End", "Home"):
        slider_thumb(page, "SoC").focus()
        page.keyboard.press(key)
        page.wait_for_timeout(1500)
        wait_suite_idle(page)
        keys[key] = slider_state(page, "SoC")["thumbValue"]
    res["soc_keys_sequence"] = keys

    # Debounce beim Ziehen: Zeitpunkt der ersten Chart-Aktualisierung waehrend gehaltener Maus
    thumb = slider_thumb(page, "SoC")
    box = thumb.bounding_box()
    before = marker_x(page, 2)
    page.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
    page.mouse.down()
    page.mouse.move(box["x"] + box["width"] / 2 + 40, box["y"] + box["height"] / 2, steps=4)
    t0 = time.time()
    timeline = []
    while time.time() - t0 < 2.0:
        timeline.append((round(time.time() - t0, 3), marker_x(page, 2)))
        page.wait_for_timeout(25)
    page.mouse.up()
    first_change = next((t for t, v in timeline if v != before), None)
    res["drag_update"] = {"marker_before": before, "first_change_s": first_change, "final": timeline[-1]}
    context.close()

    write_json(INV / "suite" / "behaviour-ui.json", res)
    print("behaviour ok")


def main():
    what = sys.argv[1] if len(sys.argv) > 1 else "all"
    with sync_playwright() as p:
        browser = p.chromium.launch()
        if what in ("rules", "all"):
            run_rules(browser)
        if what in ("breakpoints", "all"):
            run_breakpoints(browser)
        if what in ("behaviour", "all"):
            run_behaviour(browser)
        browser.close()


if __name__ == "__main__":
    main()
