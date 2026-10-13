"""Uebernimmt die statischen Dateien der Webseite bytegleich aus chargetanks@main (migration/.work/chargetanks).

- public/: favicon.svg, site.webmanifest, robots.txt, llms.txt, _headers, images/**
- dist/sitemap.xml: vom Original-Build erzeugt (scripts/postbuild.mjs), bytegleich mit live (Phase 0)
Nicht uebernommen: public/_redirects (Ziel Render entfaellt; neue Datei _redirects im Repo, siehe MIGRATION.md).
Hashes: migration/inventory/site-assets.sha256

Aufruf: py -3 migration/copy_site_assets.py
"""

import hashlib
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent
SRC = ROOT / ".work" / "chargetanks"
FILES = {
    "public/favicon.svg": "favicon.svg",
    "public/site.webmanifest": "site.webmanifest",
    "public/robots.txt": "robots.txt",
    "public/llms.txt": "llms.txt",
    "public/_headers": "_headers",
    "dist/sitemap.xml": "sitemap.xml",
}


def main():
    files = dict(FILES)
    for img in sorted((SRC / "public" / "images").rglob("*")):
        if img.is_file():
            rel = img.relative_to(SRC / "public").as_posix()
            files[f"public/{rel}"] = rel
    lines = []
    for src, dst in files.items():
        target = REPO / dst
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(SRC / src, target)
        lines.append(f"{hashlib.sha256(target.read_bytes()).hexdigest()}  {dst}")
    (ROOT / "inventory" / "site-assets.sha256").write_text("\n".join(lines) + "\n", encoding="utf-8", newline="\n")
    print("\n".join(lines))


if __name__ == "__main__":
    main()
