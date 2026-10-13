"""Erfasst die React-Ansicht der Webseite (Legacy-Build, migration/serve-legacy-site.mjs auf :4173) als Quelle
fuer build_site_pages.py: Inhalt von #root, <head> (Titel, Meta, Canonical, JSON-LD) und das geoeffnete
Mobilmenue (nur im React-State vorhanden).

Ergebnis: migration/inventory/site-react/<seite>.json
Aufruf: migration/.work/venv-tools/Scripts/python.exe migration/capture_site_dom.py
"""
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from inventory import sync_playwright  # noqa: E402

OLD = os.environ.get("OLD_SITE_URL", "http://localhost:4173")
OUT = Path(__file__).resolve().parent / "inventory" / "site-react"
PAGES = {
    "home": "/",
    "blog": "/blog/",
    "post": "/blog/two-tank-battery-model/",
    "tools": "/tools/",
    "404": "/does-not-exist/",
    "post-not-found": "/blog/does-not-exist/",
}

HEAD_JS = """
() => ({
  title: document.title,
  lang: document.documentElement.lang,
  head: [...document.head.children].filter(e => !['SCRIPT', 'STYLE'].includes(e.tagName) || e.type === 'application/ld+json')
          .filter(e => !(e.tagName === 'LINK' && ['stylesheet', 'modulepreload'].includes(e.rel)))
          .map(e => e.outerHTML),
  bodyClass: document.body.className,
})
"""


def settle(page):
    page.wait_for_load_state("networkidle")
    page.wait_for_function("() => document.querySelector('#root').children.length > 0")
    page.wait_for_timeout(500)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context(viewport={"width": 1280, "height": 900}, device_scale_factor=1)
        page = ctx.new_page()
        for name, path in PAGES.items():
            page.goto(OLD + path)
            settle(page)
            data = page.evaluate(HEAD_JS)
            data["path"] = path
            data["root"] = page.evaluate("() => document.querySelector('#root').innerHTML")
            (OUT / f"{name}.json").write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
            print(name, data["title"], len(data["root"]))
        ctx.close()
        ctx = browser.new_context(viewport={"width": 390, "height": 900}, device_scale_factor=1)
        page = ctx.new_page()
        page.goto(OLD + "/")
        settle(page)
        page.locator('header button[aria-label="Open navigation menu"]').click()
        page.wait_for_timeout(300)
        menu = {"header_open": page.evaluate("() => document.querySelector('header').outerHTML")}
        (OUT / "header-menu-open.json").write_text(json.dumps(menu, ensure_ascii=False, indent=1), encoding="utf-8")
        print("menu", len(menu["header_open"]))
        browser.close()


if __name__ == "__main__":
    main()
