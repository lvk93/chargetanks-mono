"""Einmaliger Generator fuer die Webseite (React-Ansicht von chargetanks@main -> statisches HTML + CSS).

Quelle: die gerenderte React-Ansicht (migration/capture_site_dom.py -> inventory/site-react/*.json) und das
Tailwind-CSS des Original-Builds (migration/.work/chargetanks/dist/assets/index-*.css).

- HTML: #root-Inhalt unveraendert, nur jede Tailwind-Klassenliste durch genau eine semantische Klasse
  (ct-*) ersetzt (Tabelle CLASSES). Unbekannte Klassenlisten brechen ab.
- CSS: je semantischer Klasse die Regeln ihrer Tailwind-Utilities aus dem Original-Build (Basis, Zustaende,
  group-hover, Kind-Regeln wie space-y, Breakpoints), Preflight auf .ct-page begrenzt (:where, gleiche
  Spezifitaet). Ergebnis: Teil C von assets/css/styles.css (zwischen den Markern).
- Dynamik (JS, assets/js/site/site.js): Mobilmenue, Jahr im Footer, Datumsformat zur Laufzeit,
  sanftes Scrollen zu /#about, Bild-onError, 404 vs. "Post not found".
- Notwendige Aenderung: "Launch …"-Links auf https://batterytank.onrender.com/ zeigen auf /tools/suite/.

Die erzeugten Dateien sind danach die Quelle. Aufruf: py -3 migration/build_site_pages.py
"""

import glob
import html
import json
import re
from collections import OrderedDict
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent
CAPTURE = ROOT / "inventory" / "site-react"
TAILWIND = Path(glob.glob(str(ROOT / ".work/chargetanks/dist/assets/index-*.css"))[0])
STYLES = REPO / "assets" / "css" / "styles.css"
CSS_BEGIN = "/* === Teil C - Webseite (generiert aus dem Tailwind-Build von chargetanks@main, siehe migration/build_site_pages.py) === */"
CSS_END = "/* === Ende Teil C === */"
OLD_TOOLS_URL = "https://batterytank.onrender.com/"
NEW_TOOLS_URL = "/tools/suite/"
GROUP = "ct-post-card-link"  # Traeger von "group" (group-hover:*)

# Tailwind-Klassenliste (wie im gerenderten DOM) -> semantische Klasse
CLASSES = {
    # Seite, Header, Mobilmenue
    "min-h-screen bg-white": "ct-page-wrap",
    "pt-32 pb-20": "ct-main",
    "fixed top-0 z-50 w-full bg-white/95 shadow-sm backdrop-blur-sm": "ct-header",
    "mx-auto max-w-7xl px-4 sm:px-6 lg:px-8": "ct-container",
    "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8": "ct-container",
    "flex items-center justify-between py-4": "ct-header-bar",
    "flex items-center gap-2": "ct-icon-text",
    "relative h-8 w-8": "ct-header-logo-box",
    "h-8 w-8": "ct-header-logo",
    "text-xl font-bold text-navy-blue": "ct-header-brand",
    "hidden gap-8 md:flex": "ct-nav",
    "rounded-md px-2 py-1 font-medium text-steel-blue transition-colors hover:text-bright-blue focus:outline-none "
    "focus:ring-2 focus:ring-bright-blue focus:ring-offset-2": "ct-nav-link",
    "rounded-md px-2 py-1 font-medium text-steel-blue transition-colors hover:text-bright-blue focus:outline-none "
    "focus:ring-2 focus:ring-bright-blue focus:ring-offset-2 text-left": "ct-nav-link-mobile",
    "text-steel-blue md:hidden": "ct-menu-button",
    "border-t bg-white md:hidden": "ct-mobile-menu",
    "flex flex-col gap-4 px-4 py-4": "ct-mobile-nav",
    # Footer
    "bg-dark-gray text-light-gray": "ct-footer",
    "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12": "ct-footer-inner",
    "grid md:grid-cols-2 gap-8 mb-8": "ct-footer-grid",
    "flex items-center gap-2 mb-4": "ct-footer-brand-row",
    "relative w-6 h-6": "ct-footer-logo-box",
    "w-6 h-6": "ct-footer-logo",
    "text-xl font-bold text-white": "ct-footer-brand",
    "text-light-gray leading-relaxed mb-4": "ct-footer-text",
    "flex gap-4": "ct-footer-social",
    "w-10 h-10 bg-medium-gray rounded-lg flex items-center justify-center hover:bg-bright-blue hover:scale-110 "
    "focus:outline-none focus:ring-2 focus:ring-bright-blue focus:ring-offset-2 focus:ring-offset-dark-gray "
    "transition-all": "ct-social-link",
    "text-white font-semibold mb-4": "ct-footer-heading",
    "space-y-2": "ct-footer-links",
    "rounded-md px-1 transition-colors hover:text-bright-blue focus:outline-none focus:ring-2 focus:ring-bright-blue "
    "focus:ring-offset-2 focus:ring-offset-dark-gray": "ct-footer-link",
    "border-t border-medium-gray pt-8 text-center text-light-gray": "ct-footer-bottom",
    # Icons (lucide)
    "lucide lucide-menu h-6 w-6": "ct-icon-24",
    "lucide lucide-x h-6 w-6": "ct-icon-24",
    "lucide lucide-linkedin w-5 h-5": "ct-icon-20",
    "lucide lucide-mail w-5 h-5": "ct-icon-20",
    "lucide lucide-arrow-left h-4 w-4": "ct-icon-16",
    "lucide lucide-arrow-left w-4 h-4": "ct-icon-16",
    "lucide lucide-arrow-right h-4 w-4": "ct-icon-16",
    "lucide lucide-arrow-right w-4 h-4": "ct-icon-16",
    "lucide lucide-calendar w-4 h-4": "ct-icon-16",
    "lucide lucide-clock w-4 h-4": "ct-icon-16",
    "lucide lucide-external-link h-4 w-4": "ct-icon-16",
    "lucide lucide-external-link w-4 h-4": "ct-icon-16",
    "lucide lucide-user w-4 h-4": "ct-icon-16",
    "lucide lucide-arrow-right w-4 h-4 transition-transform group-hover:translate-x-1": "ct-post-card-more-icon",
    # Buttons
    "inline-flex items-center justify-center rounded-lg bg-navy-blue px-6 py-3 font-semibold text-white "
    "transition-colors hover:bg-navy-blue/90": "ct-btn-primary-lg",
    "inline-flex items-center justify-center rounded-lg border border-light-gray/70 px-6 py-3 font-semibold "
    "text-navy-blue transition-colors hover:border-bright-blue hover:text-bright-blue": "ct-btn-secondary-lg",
    "inline-flex items-center justify-center rounded-lg bg-navy-blue px-5 py-2.5 font-semibold text-white "
    "transition-colors hover:bg-navy-blue/90": "ct-btn-primary",
    "inline-flex items-center justify-center rounded-lg border border-light-gray/70 px-5 py-2.5 font-semibold "
    "text-navy-blue transition-colors hover:border-bright-blue hover:text-bright-blue": "ct-btn-secondary",
    "inline-flex items-center justify-center gap-2 rounded-lg bg-navy-blue px-6 py-2.5 font-semibold text-white "
    "transition-all hover:bg-navy-blue/90 hover:shadow-lg": "ct-btn-primary-icon",
    "inline-flex items-center justify-center gap-2 rounded-lg border border-light-gray/70 px-6 py-2.5 font-semibold "
    "text-navy-blue transition-colors hover:border-bright-blue hover:text-bright-blue": "ct-btn-secondary-icon",
    "inline-flex items-center justify-center gap-2 rounded-lg bg-navy-blue px-6 py-3 font-semibold text-white "
    "transition-all hover:bg-navy-blue/90 hover:shadow-lg": "ct-btn-primary-icon-lg",
    "inline-flex items-center justify-center gap-2 rounded-lg border border-light-gray/70 px-6 py-3 font-semibold "
    "text-navy-blue transition-colors hover:border-bright-blue hover:text-bright-blue": "ct-btn-secondary-icon-lg",
    "inline-flex items-center gap-2 rounded-lg border border-light-gray/70 px-5 py-2.5 font-semibold text-navy-blue "
    "transition-colors hover:border-bright-blue hover:text-bright-blue": "ct-btn-browse",
    "inline-flex items-center gap-2 rounded-lg bg-navy-blue px-6 py-2.5 font-semibold text-white transition-colors "
    "hover:bg-navy-blue/90": "ct-btn-back",
    "inline-flex items-center gap-2 bg-navy-blue text-white px-6 py-2.5 rounded-lg font-semibold "
    "hover:bg-navy-blue/90 transition-colors": "ct-btn-back",
    "inline-flex items-center gap-2 rounded-lg border border-light-gray/70 px-6 py-2.5 font-semibold text-navy-blue "
    "transition-colors hover:border-bright-blue hover:text-bright-blue": "ct-btn-outline",
    "flex flex-col gap-3 sm:flex-row": "ct-actions",
    # Home: Hero
    "pt-32 pb-20 bg-gradient-to-br from-bright-blue/10 via-white to-navy-blue/5": "ct-hero",
    "grid md:grid-cols-2 gap-12 items-center": "ct-hero-grid",
    "space-y-6 order-2 md:order-1": "ct-hero-text",
    "text-5xl md:text-6xl font-bold text-navy-blue leading-tight": "ct-hero-title",
    "space-y-4 pt-4": "ct-hero-lead",
    "text-xl text-steel-blue leading-relaxed": "ct-hero-p",
    "flex flex-col gap-3 pt-2 sm:flex-row": "ct-hero-actions",
    "relative order-1 md:order-2": "ct-hero-visual",
    "bg-white rounded-2xl shadow-2xl p-8 space-y-6 border border-light-gray/50": "ct-core-card",
    "flex items-center justify-between mb-2": "ct-core-card-head",
    "text-lg font-semibold text-navy-blue": "ct-core-card-title",
    "space-y-4": "ct-stack-4",
    "flex items-start gap-3": "ct-core-item",
    "w-3 h-3 bg-theme-green rounded-full mt-2 flex-shrink-0": "ct-dot-green",
    "w-3 h-3 bg-theme-yellow rounded-full mt-2 flex-shrink-0": "ct-dot-yellow",
    "w-3 h-3 bg-bright-blue rounded-full mt-2 flex-shrink-0": "ct-dot-blue",
    "font-medium text-navy-blue": "ct-text-strong",
    "text-sm text-steel-blue": "ct-core-item-text",
    "absolute -bottom-6 -right-6 w-32 h-32 bg-gradient-to-br from-bright-blue/30 to-theme-green/30 rounded-full "
    "opacity-20 blur-2xl": "ct-hero-glow-br",
    "absolute -top-6 -left-6 w-32 h-32 bg-gradient-to-br from-navy-blue/20 to-bright-blue/20 rounded-full opacity-20 "
    "blur-2xl": "ct-hero-glow-tl",
    # Home: Tools-Teaser
    "py-20 bg-gradient-to-br from-light-gray/20 to-white scroll-mt-20": "ct-tools-teaser",
    "max-w-3xl mx-auto text-center mb-16": "ct-section-head",
    "text-4xl font-bold text-navy-blue mb-4": "ct-section-title",
    "mb-4 text-4xl font-bold text-navy-blue": "ct-section-title",
    "text-xl text-steel-blue": "ct-section-lead",
    "mb-16 bg-white rounded-2xl p-8 shadow-lg border border-light-gray/50": "ct-teaser-card",
    "grid md:grid-cols-2 gap-8 items-center": "ct-teaser-grid",
    "order-2 md:order-1": "ct-teaser-media",
    "bg-gradient-to-br from-light-gray/20 to-white rounded-lg p-4 border border-light-gray/50 overflow-hidden":
        "ct-teaser-frame",
    "w-full h-auto rounded-lg": "ct-teaser-img",
    "order-1 md:order-2": "ct-teaser-text",
    "text-steel-blue mb-4 leading-relaxed": "ct-copy",
    "text-steel-blue mb-6 leading-relaxed": "ct-copy-mb6",
    # Blog-Liste (Home, /blog/)
    "py-20 bg-white scroll-mt-20": "ct-section",
    "mt-6": "ct-section-head-action",
    "grid md:grid-cols-3 gap-8 mb-12": "ct-post-grid",
    "rounded-xl border border-light-gray/50 bg-gradient-to-br from-light-gray/20 to-white shadow-md transition-all "
    "hover:shadow-xl": "ct-post-card",
    "group block no-underline": "ct-post-card-link",
    "h-48 relative overflow-hidden rounded-t-xl": "ct-post-card-media",
    "w-full h-full object-cover": "ct-post-card-img",
    "absolute inset-0 bg-gradient-to-t from-navy-blue/35 via-navy-blue/10 to-transparent": "ct-post-card-shade",
    "absolute bottom-4 left-4": "ct-post-card-badge-pos",
    "bg-white text-navy-blue px-3 py-1 rounded-full text-sm font-medium": "ct-post-card-badge",
    "p-6": "ct-post-card-body",
    "flex items-center gap-4 text-sm text-steel-blue mb-3": "ct-post-card-meta",
    "flex items-center gap-1": "ct-meta-item",
    "text-xl font-semibold text-navy-blue mb-3 transition-colors group-hover:text-bright-blue": "ct-post-card-title",
    "flex items-center gap-2 text-bright-blue font-medium transition-all group-hover:gap-3": "ct-post-card-more",
    # Home: About
    "max-w-3xl mx-auto": "ct-narrow",
    "text-4xl font-bold text-navy-blue mb-8 text-center": "ct-about-title",
    "space-y-8": "ct-stack-8",
    "flex justify-center": "ct-center",
    "bg-gradient-to-br from-light-gray/20 to-white rounded-2xl p-6 border border-light-gray/50 max-w-sm shadow-md":
        "ct-about-frame",
    "w-full rounded-lg": "ct-about-img",
    "space-y-4 text-steel-blue leading-relaxed": "ct-about-text",
    "text-lg": "ct-about-lead",
    # /blog/
    "border-b border-light-gray/50 bg-gradient-to-br from-bright-blue/10 via-white to-white": "ct-blog-hero",
    "mx-auto max-w-5xl px-4 pb-12 sm:px-6 lg:px-8": "ct-blog-hero-inner",
    "mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-bright-blue": "ct-eyebrow",
    "text-sm font-semibold uppercase tracking-[0.2em] text-bright-blue": "ct-eyebrow-flush",
    "mb-4 text-4xl font-bold text-navy-blue md:text-5xl": "ct-page-title",
    "max-w-3xl text-lg text-steel-blue": "ct-blog-hero-lead",
    # /tools/
    "bg-gradient-to-br from-bright-blue/10 via-white to-navy-blue/5": "ct-tools-hero",
    "mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:px-8": "ct-tools-hero-grid",
    "space-y-6": "ct-stack-6",
    "text-4xl font-bold text-navy-blue md:text-5xl": "ct-tools-title",
    "text-lg leading-relaxed text-steel-blue": "ct-tools-lead",
    "overflow-hidden rounded-2xl border border-light-gray/60 bg-white p-4 shadow-xl": "ct-tools-figure",
    "w-full rounded-xl": "ct-tools-figure-img",
    "px-2 pt-4 text-sm text-steel-blue": "ct-tools-figcaption",
    "bg-white py-20": "ct-tools-section",
    "max-w-3xl": "ct-tools-intro",
    "mb-4 text-3xl font-bold text-navy-blue": "ct-h2-lg",
    "mb-10 text-lg text-steel-blue": "ct-tools-intro-lead",
    "grid gap-6 md:grid-cols-3": "ct-feature-grid",
    "rounded-2xl border border-light-gray/60 bg-gradient-to-br from-white to-light-gray/20 p-6 shadow-sm":
        "ct-feature-card",
    "mb-3 text-xl font-semibold text-navy-blue": "ct-feature-title",
    "leading-relaxed text-steel-blue": "ct-feature-text",
    "bg-gradient-to-br from-light-gray/20 to-white py-20": "ct-tools-cta-section",
    "mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[1.4fr,1fr] lg:px-8": "ct-tools-cta-grid",
    "mb-8 text-lg text-steel-blue": "ct-tools-cta-lead",
    "space-y-4 text-steel-blue": "ct-steps",
    "rounded-xl border border-light-gray/60 bg-white p-4 shadow-sm": "ct-step",
    "rounded-2xl border border-light-gray/60 bg-white p-6 shadow-lg": "ct-reading-aside",
    "mb-4 text-2xl font-bold text-navy-blue": "ct-aside-title",
    "block rounded-xl border border-light-gray/50 p-4 transition-colors hover:border-bright-blue "
    "hover:bg-bright-blue/5": "ct-reading-link",
    "mb-1 text-sm text-steel-blue": "ct-reading-date",
    "font-semibold text-navy-blue": "ct-reading-title",
    "mt-2 text-sm text-steel-blue": "ct-reading-excerpt",
    "mt-6 flex flex-col gap-3": "ct-aside-actions",
    # 404 / Post not found
    "mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8": "ct-notfound",
    "mx-auto mb-8 max-w-2xl text-lg text-steel-blue": "ct-notfound-lead",
    "flex flex-col items-center justify-center gap-4 sm:flex-row": "ct-notfound-actions",
    "max-w-4xl mx-auto px-4 sm:px-6 lg:px-8": "ct-article-container",
    "text-center": "ct-text-center",
    "text-steel-blue mb-8": "ct-notfound-text",
    # Artikel
    "mb-6 text-sm text-steel-blue": "ct-breadcrumb",
    "flex flex-wrap items-center gap-2": "ct-breadcrumb-list",
    "hover:text-bright-blue transition-colors": "ct-breadcrumb-link",
    "text-navy-blue": "ct-breadcrumb-current",
    "inline-flex items-center gap-2 text-steel-blue hover:text-bright-blue mb-8 transition-colors": "ct-back-link",
    "mb-8": "ct-article-header",
    "mb-4": "ct-article-badge-row",
    "bg-bright-blue/10 text-navy-blue px-3 py-1 rounded-full text-sm font-medium": "ct-article-badge",
    "text-4xl md:text-5xl font-bold text-navy-blue mb-6": "ct-article-title",
    "flex flex-wrap items-center gap-6 text-sm text-steel-blue mb-6": "ct-article-meta",
    "mb-10 overflow-hidden rounded-2xl border border-light-gray/60 bg-gradient-to-br from-light-gray/20 to-white "
    "shadow-lg": "ct-article-figure",
    "h-auto w-full object-cover": "ct-article-figure-img",
    "mb-10 space-y-6": "ct-article-summary",
    "rounded-2xl border border-light-gray/60 bg-gradient-to-br from-bright-blue/10 to-white p-6 shadow-sm": "ct-tldr",
    "mb-3 text-2xl font-bold text-navy-blue": "ct-summary-title",
    "text-steel-blue leading-relaxed": "ct-summary-text",
    "rounded-2xl border border-light-gray/60 bg-white p-6 shadow-sm": "ct-definition",
    "mb-3 text-lg font-medium text-navy-blue": "ct-definition-lead",
    "prose prose-lg max-w-none": "ct-prose",
    "text-3xl font-bold text-navy-blue mt-8 mb-4": "ct-prose-h2",
    "text-2xl font-bold text-navy-blue mt-6 mb-3": "ct-prose-h3",
    "text-steel-blue leading-relaxed mb-4": "ct-prose-p",
    "list-disc list-inside text-steel-blue mb-4 space-y-2": "ct-prose-ul",
    "text-steel-blue": "ct-prose-li",
    "text-bright-blue hover:text-navy-blue underline": "ct-prose-a",
    "mb-6 overflow-x-auto rounded-xl border border-light-gray/60 shadow-sm": "ct-prose-table-wrap",
    "w-full border-collapse bg-white": "ct-prose-table",
    "bg-light-gray/20": "ct-prose-thead",
    "border-b border-light-gray/50": "ct-prose-tr",
    "p-3 text-left font-semibold text-navy-blue": "ct-prose-th",
    "mb-6 w-full rounded-xl border border-light-gray/60 shadow-md": "ct-prose-img",
    "mt-16 border-t border-light-gray/60 pt-10": "ct-continue",
    "grid gap-10 lg:grid-cols-[1.4fr,1fr]": "ct-continue-grid",
    "mb-6 text-steel-blue leading-relaxed": "ct-continue-text",
    "rounded-2xl border border-light-gray/60 bg-gradient-to-br from-light-gray/20 to-white p-6 shadow-sm":
        "ct-more-aside",
    "space-y-3 text-steel-blue": "ct-more-empty",
    "inline-flex items-center gap-2 font-semibold text-bright-blue transition-colors hover:text-navy-blue":
        "ct-more-link",
}


# ------------------------------------------------------------------------------------------
# Tailwind-CSS lesen
# ------------------------------------------------------------------------------------------
def parse_css(text):
    """Minifiziertes CSS -> Liste (media, selektor, deklarationen). Nur eine Ebene @media."""
    rules, i, media = [], 0, None
    while i < len(text):
        if text.startswith("@media", i):
            brace = text.index("{", i)
            media = text[i:brace].strip()
            i = brace + 1
            continue
        if text[i] == "}" and media is not None:
            media = None
            i += 1
            continue
        brace = text.find("{", i)
        if brace < 0:
            break
        end = text.index("}", brace)
        rules.append((media, text[i:brace].strip(), text[brace + 1:end].strip()))
        i = end + 1
    return rules


def unescape_class(name):
    name = re.sub(r"\\([0-9a-fA-F]{1,6}) ?", lambda m: chr(int(m.group(1), 16)), name)
    return re.sub(r"\\(.)", r"\1", name)


CLASS_RE = re.compile(r"\.((?:\\[0-9a-fA-F]{1,6} ?|\\.|[\w-])+)")


def utility_of(selector):
    """Utility-Klasse eines Selektors (bei group-hover die zweite) und ihr roher (escapter) Text."""
    names = [(m.group(0), unescape_class(m.group(1))) for m in CLASS_RE.finditer(selector)]
    names = [n for n in names if n[1] != "group"]
    return names[-1] if names else (None, None)


def split_decls(block):
    out, depth, cur = [], 0, ""
    for ch in block:
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
        if ch == ";" and depth == 0:
            out.append(cur.strip())
            cur = ""
        else:
            cur += ch
    if cur.strip():
        out.append(cur.strip())
    return [d for d in out if d]


def scope_preflight(selector):
    parts = []
    for sel in selector.split(","):
        sel = sel.strip()
        if sel in ("html", ":host"):
            parts.append(":where(html.ct-page)")
        elif sel == "*":
            parts.append(":where(.ct-page, .ct-page *)")
        elif sel in (":before", ":after", "::before", "::after", "::backdrop"):
            parts.append(f":where(.ct-page, .ct-page *){sel}")
        else:
            parts.append(f":where(.ct-page) {sel}")
    return ", ".join(dict.fromkeys(parts))


def fmt_decl(decl):
    """'prop:wert' -> 'prop: wert'; leere Custom Property bleibt als '--x: ' (Wert = ein Leerzeichen) erhalten."""
    prop, value = decl.split(":", 1)
    return f"{prop.strip()}: {value.strip()}" if value.strip() else f"{prop.strip()}: "


def fmt_block(selector, decls, indent=""):
    body = "".join(f"{indent}  {fmt_decl(d)};\n" for d in decls)
    return f"{indent}{selector} {{\n{body}{indent}}}\n"


def build_css(used):
    """used: semantische Klasse -> Menge der Tailwind-Tokens."""
    rules = parse_css(TAILWIND.read_text(encoding="utf-8"))
    first_utility = next(i for i, (m, s, _) in enumerate(rules) if CLASS_RE.search(s) and m is None
                         and not s.startswith(("*", "::")))
    pre = [r for r in rules[:first_utility]]
    util = rules[first_utility:]
    token_css = {}
    for idx, (media, sel, decls) in enumerate(util):
        raw, token = utility_of(sel)
        if token:
            token_css.setdefault(token, []).append((idx, media, sel, raw, decls))
    out = ["/* Preflight (Tailwind 3), auf Webseiten-Seiten (html.ct-page) begrenzt */\n"]
    for media, sel, decls in pre:
        assert media is None
        out.append(fmt_block(scope_preflight(sel), split_decls(decls)))
    base_blocks, media_blocks = [], OrderedDict()
    for name, tokens in used.items():
        entries = sorted((e for t in tokens for e in token_css.get(t, [])), key=lambda e: e[0])
        base, extra = [], OrderedDict()
        for idx, media, sel, raw, decls in entries:
            new_sel = sel.replace(raw, f".{name}").replace(".group:", f".{GROUP}:")
            target = media_blocks.setdefault(media, OrderedDict()) if media else extra
            if media is None and new_sel == f".{name}":
                base.extend(split_decls(decls))
            else:
                target.setdefault(new_sel, []).extend(split_decls(decls))
        base_blocks.append(fmt_block(f".{name}", base) if base else f"/* .{name}: keine eigenen Regeln */\n")
        for s, d in extra.items():
            base_blocks.append(fmt_block(s, d))
    out.append("\n/* Komponenten (je Element eine Klasse; Deklarationen aus den Tailwind-Utilities des Originals) */\n")
    out.extend(base_blocks)
    order = [m for m in dict.fromkeys(m for m, _, _ in util if m)]
    for media in order:
        if media not in media_blocks:
            continue
        out.append(f"\n{media} {{\n")
        for s, d in media_blocks[media].items():
            out.append(fmt_block(s, d, "  "))
        out.append("}\n")
    missing = sorted({t for ts in used.values() for t in ts if t not in token_css
                      and not t.startswith("lucide") and t not in ("group", "prose", "prose-lg")})
    assert not missing, f"Tokens ohne CSS: {missing}"
    return "".join(out)


# ------------------------------------------------------------------------------------------
# HTML umschreiben
# ------------------------------------------------------------------------------------------
def check_mapping():
    by_name = {}
    rules = parse_css(TAILWIND.read_text(encoding="utf-8"))
    with_css = {utility_of(s)[1] for _, s, _ in rules}
    for cls, name in CLASSES.items():
        effective = frozenset(t for t in cls.split() if t in with_css)
        if name in by_name:
            assert by_name[name] == effective, f"{name}: unterschiedliche Utilities fuer gleiche Klasse"
        by_name[name] = effective
    return {name: set(tokens) for name, tokens in by_name.items()}


def replace_classes(markup):
    def sub(m):
        cls = html.unescape(m.group(1))
        assert cls in CLASSES, f"Klassenliste ohne Zuordnung: {cls!r}"
        return f'class="{CLASSES[cls]}"'
    markup = re.sub(r'class="([^"]*)"', sub, markup)
    return markup.replace(' data-discover="true"', "")


def dates(markup):
    """Datumsangaben: React formatiert zur Laufzeit (toLocaleDateString en-US, lokale Zeitzone)."""
    markup = re.sub(r'<time datetime="(\d{4}-\d{2}-\d{2})">([A-Z][a-z]{2} \d{1,2}, \d{4})</time>',
                    r'<time datetime="\1" data-ct-date="short">\2</time>', markup)
    markup = re.sub(r'<time datetime="(\d{4}-\d{2}-\d{2})">([A-Z][a-z]+ \d{1,2}, \d{4})</time>',
                    r'<time datetime="\1" data-ct-date="long">\2</time>', markup)
    return markup


def year(markup):
    out, n = re.subn(r"© (\d{4}) Charge Tanks\. All rights reserved\.",
                     r'© <span data-ct-year="">\1</span> Charge Tanks. All rights reserved.', markup)
    assert n == 1, "Footer-Jahr nicht gefunden"
    return out


def tools_link(markup):
    return markup.replace(f'href="{OLD_TOOLS_URL}"', f'href="{NEW_TOOLS_URL}"')


def head_lines(data):
    lines = []
    for item in data["head"]:
        if item.startswith("<title>"):
            continue
        lines.append(item)
    return lines


def page(data, body, script_attrs=""):
    head = "\n    ".join(head_lines(data))
    return f"""<!doctype html>
<html lang="{data['lang']}" class="ct-page">
  <head>
    {head.replace('<meta name="viewport"', f'<title>{html.escape(data["title"])}</title>{chr(10)}    <meta name="viewport"', 1)}
    <link rel="stylesheet" href="/assets/css/styles.css" />
    <script type="module" src="/assets/js/site/site.js"{script_attrs}></script>
  </head>
  <body>
    <div id="root">{body}</div>
  </body>
</html>
"""


def load(name):
    return json.loads((CAPTURE / f"{name}.json").read_text(encoding="utf-8"))


def transform(markup):
    return year(dates(tools_link(replace_classes(markup))))


def with_mobile_menu(markup):
    """Mobilmenue (React-State) als verborgenes Element, Icons Menue/X beide vorhanden."""
    menu = json.loads((CAPTURE / "header-menu-open.json").read_text(encoding="utf-8"))["header_open"]
    menu = replace_classes(menu)
    x_icon = re.search(r'<svg[^>]*class="ct-icon-24"[\s\S]*?</svg>', menu).group(0)
    mobile = re.search(r'<div class="ct-mobile-menu">[\s\S]*</div></header>', menu).group(0)[:-len("</header>")]
    mobile = mobile.replace('<div class="ct-mobile-menu">', '<div class="ct-mobile-menu" hidden="" data-ct-menu="">', 1)
    m = re.search(r'(<button type="button" class="ct-menu-button"[^>]*>)(<svg[\s\S]*?</svg>)(</button>)', markup)
    assert m, "Menue-Button fehlt"
    button = (m.group(1).replace('class="ct-menu-button"', 'class="ct-menu-button" data-ct-menu-button=""')
              + m.group(2).replace("<svg ", '<svg data-ct-icon="menu" ', 1)
              + x_icon.replace("<svg ", '<svg data-ct-icon="close" hidden="" ', 1) + m.group(3))
    markup = markup[:m.start()] + button + markup[m.end():]
    assert markup.find('<header class="ct-header">') < markup.find("</header>")  # erstes </header> = Seitenkopf
    return markup.replace("</header>", mobile + "</header>", 1)


def reading_dates(markup, posts):
    """/tools/ "Continue Reading": Datum als Text in <p> - fuer die Laufzeitformatierung markieren."""
    for date in posts:
        short = f'<p class="ct-reading-date">'
        markup = markup.replace(short, f'<p class="ct-reading-date" data-ct-date="short" data-ct-date-value="{date}">')
    return markup


def build():
    used = check_mapping()
    out = {}
    for name, target in (("home", "index.html"), ("blog", "blog/index.html"),
                         ("post", "blog/two-tank-battery-model/index.html"), ("tools", "tools/index.html")):
        data = load(name)
        body = with_mobile_menu(transform(data["root"]))
        if name == "tools":
            body = reading_dates(body, ["2026-03-03"])
        out[target] = page(data, body)
    # 404.html: allgemeine Seite; fuer /blog/<slug>/ ersetzt JS Inhalt und Kopf durch "Post not found"
    nf, pnf = load("404"), load("post-not-found")
    body = with_mobile_menu(transform(nf["root"]))
    alt = with_mobile_menu(transform(pnf["root"]))
    main_nf = re.search(r"<main[\s\S]*?</main>", body).group(0)
    main_pnf = re.search(r"<main[\s\S]*?</main>", alt).group(0)
    assert body.replace(main_nf, "") == alt.replace(main_pnf, ""), "404-Varianten unterscheiden sich ausserhalb von <main>"
    template = f'<template data-ct-post-not-found="">{main_pnf}</template>'
    head_pnf = {"title": pnf["title"],
                "meta": {k: v for k, v in re.findall(r'<meta (?:name|property)="([^"]+)" content="([^"]*)"',
                                                     "\n".join(pnf["head"]))}}
    head_nf = dict(re.findall(r'<meta (?:name|property)="([^"]+)" content="([^"]*)"', "\n".join(nf["head"])))
    changed = {k: v for k, v in head_pnf["meta"].items() if head_nf.get(k) != v}
    data_attr = html.escape(json.dumps({"title": pnf["title"], "meta": changed}, ensure_ascii=False), quote=True)
    out["404.html"] = page(nf, body.replace(main_nf, main_nf + template), f' data-ct-post-not-found-head="{data_attr}"')
    for target, text in out.items():
        path = REPO / target
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8", newline="\n")
        print("ok", target)
    css = build_css(used)
    styles = STYLES.read_text(encoding="utf-8")
    block = f"{CSS_BEGIN}\n{css}{CSS_END}\n"
    if CSS_BEGIN in styles:
        styles = styles[:styles.index(CSS_BEGIN)] + block + styles[styles.index(CSS_END) + len(CSS_END) + 1:]
    else:
        styles = styles.rstrip("\n") + "\n\n" + block
    STYLES.write_text(styles, encoding="utf-8", newline="\n")
    print("ok styles.css Teil C", len(css))


if __name__ == "__main__":
    build()
