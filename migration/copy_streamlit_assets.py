"""Kopiert die von der Suite genutzten Schriften unveraendert aus dem Streamlit-1.47.0-Paket.

Gemessen (Phase 0): die Suite laedt nur SourceCodeVF-Upright (Slider-Werte, Codebloecke) und
MaterialSymbols-Rounded (Icons). Text nutzt "open sans" ohne Fallback (B6), dafuer gibt es keine
Datei. Lizenztexte kommen aus den offiziellen Quell-Repositories.

Aufruf: py -3 migration/copy_streamlit_assets.py
"""

import hashlib
import shutil
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MEDIA = ROOT / "migration/.work/venv-ocv/Lib/site-packages/streamlit/static/static/media"
OUT = ROOT / "assets/fonts"

FONTS = {
    "SourceCodeVF-Upright.ttf.BjWn63N-.woff2": "SourceCodeVF-Upright.woff2",
    "MaterialSymbols-Rounded.DsbC8sYI.woff2": "MaterialSymbols-Rounded.woff2",
}
LICENSES = {
    "LICENSE-SourceCodePro-OFL.txt": "https://raw.githubusercontent.com/adobe-fonts/source-code-pro/release/LICENSE.md",
    "LICENSE-MaterialSymbols-Apache-2.0.txt": "https://raw.githubusercontent.com/google/material-design-icons/master/LICENSE",
}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    rows = []
    for src, dst in FONTS.items():
        shutil.copyfile(MEDIA / src, OUT / dst)
        digest = hashlib.sha256((OUT / dst).read_bytes()).hexdigest()
        rows.append(f"| `{dst}` | Streamlit 1.47.0 `static/media/{src}` | `{digest}` |")
    for name, url in LICENSES.items():
        with urllib.request.urlopen(url, timeout=30) as response:
            (OUT / name).write_bytes(response.read())
    readme = [
        "# Schriften",
        "",
        "Unveraendert aus dem Streamlit-1.47.0-Paket (Referenz der Suite). Lizenzen: Source Code Pro "
        "unter SIL Open Font License 1.1, Material Symbols unter Apache License 2.0 (Dateien hier).",
        "",
        "| Datei | Herkunft | sha256 |",
        "|---|---|---|",
        *rows,
        "",
        "Erzeugt mit `py -3 migration/copy_streamlit_assets.py`.",
        "",
    ]
    (OUT / "README.md").write_text("\n".join(readme), encoding="utf-8")
    print("\n".join(rows))


if __name__ == "__main__":
    main()
