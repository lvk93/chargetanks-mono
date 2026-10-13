"""Uebernimmt die Vorschaubilder der Landing-Seite bytegleich nach assets/img/suite/.

Quelle: ocv_teaching@master, apps/thumbnails/*.png. Streamlit 1.47.0 liefert ein st.image mit lokalem
Dateipfad unveraendert aus (image_utils.image_to_url liest die Bytes und setzt nur den MIME-Typ), daher
ist die bytegleiche Kopie dasselbe Bild, das der Browser im Original bekommt. demo_thumbnail.png gehoert
zur Free Demo (entfaellt, F1) und wird nicht uebernommen. Hashes: assets/img/suite/SHA256SUMS.

Aufruf: py -3 migration/copy_thumbnails.py
"""

import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "migration/.work/ocv_teaching/apps/thumbnails"
OUT = ROOT / "assets/img/suite"
FILES = ["material_thumbnail.png", "cell_thumbnail.png", "blend_thumbnail.png", "aging_thumbnail.png",
         "swelling_thumbnail.png"]


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    lines = []
    for name in FILES:
        raw = (SRC / name).read_bytes()
        (OUT / name).write_bytes(raw)
        lines.append(f"{hashlib.sha256(raw).hexdigest()}  {name}")
    (OUT / "SHA256SUMS").write_text("\n".join(lines) + "\n", encoding="utf-8", newline="\n")
    print("\n".join(lines))


if __name__ == "__main__":
    main()
