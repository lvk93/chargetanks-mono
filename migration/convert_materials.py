"""Uebernimmt die Materialdaten der Suite bytegleich nach assets/data/materials/.

Quelle: ocv_teaching@master, src/ocv_teaching/material_jsons_reduced/*.json (von allen Tools
genutzt). Einzige "Konvertierung": Dateinamen ohne Leerzeichen (Slug), damit die URLs auf jedem
statischen Server unproblematisch sind. Der Inhalt bleibt Byte fuer Byte gleich; index.json
listet Name (wie in der Datei), Art und Dateiname. tests/data/materials.test.js prueft die Hashes.

Aufruf: py -3 migration/convert_materials.py
"""

import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "migration/.work/ocv_teaching/src/ocv_teaching/material_jsons_reduced"
OUT = ROOT / "assets/data/materials"


def slug(stem: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", stem.lower()).strip("-")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    entries = []
    # Reihenfolge wie get_all_materials(): sorted(_MATERIAL_DIR.glob("*.json"))
    for path in sorted(SRC.glob("*.json")):
        raw = path.read_bytes()
        payload = json.loads(raw.decode("utf-8"))
        target = f"{slug(path.stem)}.json"
        (OUT / target).write_bytes(raw)
        entries.append({
            "name": payload["name"],
            "kind": payload["kind"],
            "file": target,
            "source": f"src/ocv_teaching/material_jsons_reduced/{path.name}",
            "sha256": hashlib.sha256(raw).hexdigest(),
            "rows": len(payload["data"]),
        })
    (OUT / "index.json").write_text(json.dumps(entries, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    for e in entries:
        print(e["file"], e["name"], e["kind"], e["rows"], e["sha256"][:12])


if __name__ == "__main__":
    main()
