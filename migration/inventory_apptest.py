"""Inventar der Streamlit-Suite (ocv_teaching@master) per streamlit.testing.v1.AppTest.

Waehlt jede Seite direkt ueber st.session_state["page"] (der Router in app.py kennt keine URLs)
und schreibt alle Elemente mit ihren Proto-Feldern nach migration/inventory/suite/apptest/<seite>.json.
Plotly-Specs werden gekuerzt (Arrays: Laenge + erste/letzte Werte); vollstaendige Specs erzeugt
in Phase 1 das Golden-Skript.

Aufruf (aus dem Repo-Root, mit der Legacy-venv):
    migration/.work/venv-ocv/Scripts/python.exe migration/inventory_apptest.py
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
APP_DIR = ROOT / ".work" / "ocv_teaching"
OUT = ROOT / "inventory" / "suite" / "apptest"

# Tracking neutralisieren, ohne den App-Code zu aendern (siehe migration/stubs/supabase).
sys.path.insert(0, str(ROOT / "stubs"))
os.environ.setdefault("SUPABASE_URL", "http://supabase.stub.invalid")
os.environ.setdefault("SUPABASE_ANON_KEY", "stub")
os.environ["HTTPS_PROXY"] = "http://127.0.0.1:9"  # ipapi.co -> except-Zweig ("unknown")
os.environ["HTTP_PROXY"] = "http://127.0.0.1:9"
os.environ["STUB_TRACKING_LOG"] = str(ROOT / ".work" / "tracking-apptest.jsonl")

from google.protobuf.json_format import MessageToDict  # noqa: E402
from streamlit.testing.v1 import AppTest  # noqa: E402

PAGES = ["Landing", "Materials", "Cell Reconstruction", "Blending", "Aging", "Swelling", "Free Demo"]


def shorten(value, keep=3):
    """Kuerzt lange Listen in verschachtelten Strukturen fuer ein lesbares Inventar."""
    if isinstance(value, list):
        if len(value) > 2 * keep + 1 and all(isinstance(v, (int, float)) or v is None for v in value):
            return {"len": len(value), "head": value[:keep], "tail": value[-keep:]}
        return [shorten(v, keep) for v in value]
    if isinstance(value, dict):
        if set(value) >= {"dtype", "bdata"}:
            return {"dtype": value["dtype"], "bdata_chars": len(value["bdata"]), "shape": value.get("shape")}
        return {k: shorten(v, keep) for k, v in value.items()}
    return value


def element_record(node, where):
    proto = getattr(node, "proto", None)
    record = {"where": where, "type": type(node).__name__}
    for attr in ("label", "value", "key", "help", "min", "max", "step", "format", "options", "index",
                 "placeholder", "disabled", "weight", "icon"):
        try:
            val = getattr(node, attr)
        except Exception:  # Attribut existiert fuer diesen Typ nicht
            continue
        if callable(val):
            continue
        try:
            json.dumps(val)
        except TypeError:
            val = repr(val)
        record[attr] = val
    if proto is not None:
        data = MessageToDict(proto, preserving_proto_field_name=True)
        for field in ("spec", "config"):
            if field in data and isinstance(data[field], str):
                try:
                    data[field] = shorten(json.loads(data[field]))
                except json.JSONDecodeError:
                    pass
        record["proto"] = data
    return record


def walk(node, where, out):
    children = getattr(node, "children", None)
    if isinstance(children, dict) and children:
        out.append({"where": where, "type": type(node).__name__, "container": True,
                    "proto": MessageToDict(node.proto, preserving_proto_field_name=True)
                    if getattr(node, "proto", None) is not None else None})
        for idx in sorted(children):
            walk(children[idx], f"{where}/{idx}", out)
    else:
        out.append(element_record(node, where))


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    os.chdir(APP_DIR)
    sys.path.insert(0, str(APP_DIR))
    summary = {}
    for page in PAGES:
        at = AppTest.from_file("app.py", default_timeout=120)
        at.session_state["page"] = page
        at.run()
        records = []
        walk(at.main, "main", records)
        walk(at.sidebar, "sidebar", records)
        exceptions = [MessageToDict(e.proto) for e in at.exception]
        result = {"page": page, "exceptions": exceptions, "elements": records}
        name = page.lower().replace(" ", "_")
        (OUT / f"{name}.json").write_text(json.dumps(result, indent=1, ensure_ascii=False), encoding="utf-8")
        summary[page] = {"elements": len(records), "exceptions": len(exceptions)}
        print(page, summary[page])
    (OUT / "_summary.json").write_text(json.dumps(summary, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
