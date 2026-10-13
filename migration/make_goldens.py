"""Erzeugt die Referenzwerte (Golden-Dateien) aus dem unveraenderten Original.

Laeuft in der Legacy-venv (Render-Stand, siehe setup_legacy.ps1) mit gestubbtem Tracking.

  core   Differential-Vektoren fuer die nachgebauten Grundbausteine (Python-Format, numpy, scipy,
         pandas, pow) -> <out>/core/*.json
  model  Direktimporte von ocv_teaching (Zellrekonstruktion, Swelling-Modell) -> <out>/model/*.json
  ui     Alle Seiten der Suite per streamlit.testing.v1.AppTest: Eingaben setzen, alle angezeigten
         Elemente und Plotly-Specs (so wie Streamlit sie an den Browser sendet) -> <out>/ui/<tool>/*.json

Grosse Zahlenarrays liegen bitgenau und dedupliziert unter <out>/arrays/<sha256-Praefix>.<dtype>
(rohe Little-Endian-Bytes); in den JSON-Dateien steht dafuer {"$array": id, "dtype": .., "shape": ..}.
Nicht-endliche Skalare: {"$float": "nan" | "inf" | "-inf"}. Das (in allen Specs gleiche) Plotly-Template
liegt einmal unter <out>/ui/_templates/<hash>.json; in der Spec steht {"$template": hash}.

Aufruf (Repo-Root):
  migration/.work/venv-ocv/Scripts/python.exe migration/make_goldens.py [core|model|ui|all] [--out DIR]
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import math
import os
import random
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent
APP_DIR = ROOT / ".work" / "ocv_teaching"

sys.path.insert(0, str(ROOT / "stubs"))
os.environ.setdefault("SUPABASE_URL", "http://supabase.stub.invalid")
os.environ.setdefault("SUPABASE_ANON_KEY", "stub")
os.environ["HTTPS_PROXY"] = "http://127.0.0.1:9"
os.environ["HTTP_PROXY"] = "http://127.0.0.1:9"
os.environ["STUB_TRACKING_LOG"] = str(ROOT / ".work" / "tracking-goldens.jsonl")

import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402
from scipy.interpolate import PchipInterpolator, interp1d  # noqa: E402

ARRAY_MIN_LEN = 16  # kuerzere Listen bleiben als JSON-Zahlen im Dokument
TEMPLATE_DIR = None  # <out>/ui/_templates, gesetzt in make_ui


# --------------------------------------------------------------------------------------------
# Kodierung
# --------------------------------------------------------------------------------------------
class ArrayStore:
    def __init__(self, directory: Path):
        self.dir = directory
        self.dir.mkdir(parents=True, exist_ok=True)

    def put(self, array: np.ndarray, **extra) -> dict:
        arr = np.ascontiguousarray(array)
        if arr.dtype.byteorder == ">":
            arr = arr.astype(arr.dtype.newbyteorder("<"))
        raw = arr.tobytes()
        dtype = arr.dtype.str.lstrip("<|=")
        key = hashlib.sha256(dtype.encode() + b":" + raw).hexdigest()[:20]
        path = self.dir / f"{key}.{dtype}"
        if not path.exists():
            path.write_bytes(raw)
        ref = {"$array": key, "dtype": dtype, "shape": list(arr.shape)}
        ref.update(extra)
        return ref


def scalar(x):
    if isinstance(x, (bool, np.bool_)):
        return bool(x)
    if isinstance(x, (int, np.integer)):
        return int(x)
    x = float(x)
    if math.isnan(x):
        return {"$float": "nan"}
    if math.isinf(x):
        return {"$float": "inf" if x > 0 else "-inf"}
    return x


def encode(obj, store: ArrayStore):
    """Wandelt numpy/Plotly-Strukturen verlustfrei in JSON + Array-Store um."""
    if isinstance(obj, np.ndarray):
        if obj.dtype.kind in "fiub" and obj.size >= ARRAY_MIN_LEN:
            return store.put(obj)
        return [encode(v, store) for v in obj.tolist()] if obj.ndim else scalar(obj)
    if isinstance(obj, dict):
        if set(obj) >= {"dtype", "bdata"}:  # plotly.py-Binaerarray (so wie an den Browser gesendet)
            raw = base64.b64decode(obj["bdata"])
            arr = np.frombuffer(raw, dtype=np.dtype(obj["dtype"]))
            if "shape" in obj and obj["shape"]:
                shape = [int(s) for s in str(obj["shape"]).split(",")]
                arr = arr.reshape(shape)
            return store.put(arr, plotly="bdata")
        return {str(k): encode(v, store) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        if len(obj) >= ARRAY_MIN_LEN and all(isinstance(v, (int, float)) and not isinstance(v, bool) for v in obj):
            if all(isinstance(v, int) for v in obj):
                return store.put(np.asarray(obj, dtype=np.int64), plotly="list")
            return store.put(np.asarray(obj, dtype=np.float64), plotly="list")
        return [encode(v, store) for v in obj]
    if isinstance(obj, (float, int, np.floating, np.integer, bool, np.bool_)):
        return scalar(obj)
    return obj


def write(path: Path, payload, store: ArrayStore):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(encode(payload, store), indent=1, ensure_ascii=False, allow_nan=False) + "\n",
                    encoding="utf-8")


# --------------------------------------------------------------------------------------------
# (a) Grundbausteine
# --------------------------------------------------------------------------------------------
def materials_raw():
    from ocv_teaching.utils import get_all_materials
    return get_all_materials()


def core_pyformat(rng):
    values = [0.0, -0.0, math.nan, math.inf, -math.inf, 1e16, 1e21, 1e22, 123456789012345678901234.0,
              2.0 ** 53, 5e-324, -5e-324, 2.675, 1.005, 0.125, -0.125, 0.375, 2.5, 3.5, -2.5, 0.0625,
              0.03125, 99.995, 100.0, 0.5, 1.5, -0.5, 0.045, 1e-7, -1e-7, 9.995, 9.9949999999]
    values += [k / 100 for k in range(-100, 101)]
    values += [k / 1000 + 0.0005 for k in range(-50, 50)]
    for j in range(1, 13):
        values += [rng.randint(-4000, 4000) / 2 ** j for _ in range(25)]
    for _ in range(400):
        values.append(rng.uniform(-1000, 1000))
        values.append(rng.uniform(-1, 1))
        values.append(math.copysign(10 ** rng.uniform(-12, 22), rng.choice([-1, 1])))
    cases = []
    for fmt in (".0f", ".1f", ".2f", ".3f", ".4f"):
        for v in values:
            cases.append([scalar(v), fmt, format(v, fmt)])
    return {"description": "format(x, fmt) mit Python " + sys.version.split()[0], "cases": cases}


def core_linspace(rng):
    params = [(0, 1, 400), (0, 1, 600), (0, 1, 200), (0, 1, 100), (0, 1, 500), (0, 60, 201),
              (1.0, 0.0, 11), (0.0, 0.0, 5), (2.5, 2.5, 1), (0, 1, 1), (0, 1, 2), (0, 1, 0)]
    for _ in range(40):
        a, b = rng.uniform(-3, 5), rng.uniform(-3, 5)
        params.append((a, b, rng.choice([2, 3, 7, 100, 400, 600, 3000])))
    cases = [{"start": scalar(a), "stop": scalar(b), "num": n, "out": np.linspace(a, b, n)} for a, b, n in params]
    return {"description": "np.linspace(start, stop, num) " + np.__version__, "cases": cases}


def core_interp(rng):
    cases = []
    for k in range(30):
        n = rng.choice([1, 2, 3, 5, 11, 50, 400])
        xp = np.sort(np.asarray([rng.uniform(-2, 2) for _ in range(n)]))
        if k % 7 == 3 and n > 3:
            xp[2] = xp[1]  # doppelte Stuetzstelle
        fp = np.asarray([rng.uniform(-5, 5) for _ in range(n)])
        x = [rng.uniform(-3, 3) for _ in range(60)] + list(xp) + [math.nan, float(xp[0]), float(xp[-1])]
        x = np.asarray(x)
        cases.append({"x": x, "xp": xp, "fp": fp, "out": np.interp(x, xp, fp)})
    mats = materials_raw()
    for name in ("Graphite", "NMC", "Ideal Anode"):
        d = mats[name].data
        grid = np.linspace(0, 1, 600)
        cases.append({"x": grid, "xp": d["SoL"].to_numpy(), "fp": d["dQ_dV_cha"].to_numpy(),
                      "out": np.interp(grid, d["SoL"], d["dQ_dV_cha"])})
    return {"description": "np.interp(x, xp, fp) " + np.__version__, "cases": cases}


def core_interp1d(rng):
    cases = []
    for k in range(30):
        n = rng.choice([2, 3, 5, 11, 50, 400])
        xp = np.asarray([rng.uniform(-2, 2) for _ in range(n)])
        if k % 3 == 0:
            xp = np.sort(xp)[::-1].copy()  # absteigend wie OCV
        yp = np.asarray([rng.uniform(-5, 5) for _ in range(n)])
        x = np.asarray([rng.uniform(-3, 3) for _ in range(60)] + list(xp) + [math.nan])
        fill = "extrapolate" if k % 2 == 0 else (float(yp[-1]), float(yp[0]))
        with np.errstate(all="ignore"):
            out = interp1d(xp, yp, kind="linear", fill_value=fill, bounds_error=False, assume_sorted=False)(x)
        cases.append({"xp": xp, "yp": yp, "x": x, "fill": fill if fill == "extrapolate" else list(fill), "out": out})
    mats = materials_raw()
    for name, mat in mats.items():  # Nutzung wie im Blend-Tool (OCV -> SoL mit Tupel-Fill)
        d = mat.data
        v = np.linspace(d["OCV_cha"].max(), d["OCV_cha"].min() - 0.5, 300)
        fill = (float(d["SoL"].iloc[-1]), float(d["SoL"].iloc[0]))
        out = interp1d(d["OCV_cha"], d["SoL"], kind="linear", fill_value=fill, bounds_error=False,
                       assume_sorted=False)(v)
        cases.append({"xp": d["OCV_cha"].to_numpy(), "yp": d["SoL"].to_numpy(), "x": v, "fill": list(fill),
                      "out": out, "material": name})
        xs = np.linspace(-0.2, 1.2, 333)
        out = interp1d(d["SoL_prac"], d["OCV_cha"], kind="linear", fill_value="extrapolate",
                       bounds_error=False, assume_sorted=False)(xs)
        cases.append({"xp": d["SoL_prac"].to_numpy(), "yp": d["OCV_cha"].to_numpy(), "x": xs,
                      "fill": "extrapolate", "out": out, "material": name})
    # Skalar wie in get_stoichiometries
    xp = np.linspace(1.5, 4.5, 400)
    cases.append({"xp": xp, "yp": np.linspace(0, 1, 400), "x": [2.0], "fill": "extrapolate",
                  "out": [float(interp1d(xp, np.linspace(0, 1, 400), fill_value="extrapolate",
                                         bounds_error=False, assume_sorted=False)(2.0))]})
    return {"description": "scipy interp1d(kind='linear', bounds_error=False, assume_sorted=False)", "cases": cases}


def core_pchip(rng):
    cases = []
    mats = materials_raw()
    for name, mat in mats.items():
        d = mat.data
        for col in ("OCV_cha", "OCV_dis"):
            x = d["SoL_prac"].to_numpy()
            y = d[col].to_numpy()
            q = np.concatenate([np.linspace(x.min(), x.max(), 600), x, [x[0] - 1e-9, x[-1] + 1e-9, math.nan],
                                np.asarray([rng.uniform(x.min() - 0.1, x.max() + 0.1) for _ in range(100)])])
            cases.append({"x": x, "y": y, "q": q, "out": PchipInterpolator(x, y, extrapolate=False)(q),
                          "material": name, "column": col})
    for k in range(25):
        n = rng.choice([2, 3, 4, 6, 20])
        x = np.cumsum(np.asarray([rng.uniform(0.01, 1) for _ in range(n)]))
        y = np.asarray([rng.uniform(-3, 3) for _ in range(n)])
        if k % 5 == 0 and n > 3:
            y[1] = y[2]  # flaches Segment
        q = np.concatenate([np.linspace(x[0], x[-1], 77), x, [x[0] - 0.1, x[-1] + 0.1]])
        cases.append({"x": x, "y": y, "q": q, "out": PchipInterpolator(x, y, extrapolate=False)(q)})
    return {"description": "scipy PchipInterpolator(x, y, extrapolate=False)", "cases": cases}


def core_nearest(rng):
    cases = []
    for n in (200, 100, 11):
        index = pd.Index(np.linspace(0.0, 1.0, n))
        targets = [round(k / 100, 2) for k in range(0, 101)] + [-0.1, 1.1] + [rng.uniform(0, 1) for _ in range(30)]
        targets += [float(v) for v in (index.to_numpy()[:-1] + index.to_numpy()[1:]) / 2]  # exakte Mitten
        cases.append({"index": index.to_numpy(), "targets": np.asarray(targets),
                      "out": np.asarray([index.get_indexer([t], method="nearest")[0] for t in targets], dtype=np.int64)})
    return {"description": "pandas Index.get_indexer([t], method='nearest') " + pd.__version__, "cases": cases}


def core_pow(rng):
    cases = []
    for _ in range(300):
        comp, eps0, m, s = rng.uniform(0, 60), rng.uniform(0.05, 0.6), 2, 200.0
        porosity = 1 - ((comp / s) + (1 - eps0) ** m) ** (1 / m)
        sigma = s * ((1 - porosity) ** m - (1 - eps0) ** m)
        cases.append([scalar(comp), scalar(eps0), scalar(porosity), scalar(sigma)])
    return {"description": "Gibson-Ashby wie SwellingModel (m=2, sigma_s=200)", "cases": cases}


def make_core(out: Path, store: ArrayStore):
    rng = random.Random(20261013)
    for name, fn in (("pyformat", core_pyformat), ("linspace", core_linspace), ("interp", core_interp),
                     ("interp1d", core_interp1d), ("pchip", core_pchip), ("nearest", core_nearest),
                     ("pow", core_pow)):
        write(out / "core" / f"{name}.json", fn(rng), store)
        print("core", name)


# --------------------------------------------------------------------------------------------
# (b) Modell-Direktimporte
# --------------------------------------------------------------------------------------------
def make_model(out: Path, store: ArrayStore):
    from ocv_teaching.cell_reconstruction import CellOCVReconstruction
    from ocv_teaching.SwellingModel import PorosityParams, StackParams, SwellingModel
    from ocv_teaching.utils import get_material, get_material_names

    anodes, cathodes = get_material_names("anode"), get_material_names("cathode")
    settings = [(1.0, 1.0, 2.0, 4.0), (1.1, 0.95, 2.8, 4.2), (0.8, 0.5, 2.0, 3.5), (1.5, 1.5, 3.5, 4.5),
                (1.23, 0.77, 2.37, 4.11), (0.8, 1.5, 3.5, 3.5)]
    aging = [(0.0, 0.0, 0.0), (0.1, 0.05, 0.15), (0.5, 0.5, 0.5), (0.0, 0.3, 0.0), (0.25, 0.0, 0.4)]
    cases = []
    for an in anodes:
        for ca in cathodes:
            for np_r, lip, vmin, vmax in settings:
                rec = CellOCVReconstruction(cath=get_material(ca), an=get_material(an), np_ratio=np_r,
                                            lip_ratio=lip, v_min=vmin, v_max=vmax)
                st = rec.get_stoichiometries()
                v_cell, v_cath, v_an, soc_an, soc_cath = rec.reconstruct_voltage(*st)
                cases.append({
                    "anode": an, "cathode": ca, "np_ratio": np_r, "lip_ratio": lip, "v_min": vmin, "v_max": vmax,
                    "stoichiometries": [scalar(v) for v in st],
                    "reconstruct": {"V_cell": v_cell, "V_cath": v_cath, "V_an": v_an, "soc_an": soc_an,
                                    "soc_cath": soc_cath},
                    "aging": [{"lampe": a, "lamne": b, "lli": c,
                               "stoichiometries": [scalar(v) for v in rec.simulate_aging_modes(a, b, c)]}
                              for a, b, c in aging],
                })
    write(out / "model" / "cell_reconstruction.json",
          {"description": "CellOCVReconstruction(cath, an, np_ratio, lip_ratio, v_min, v_max)", "cases": cases}, store)
    print("model cell_reconstruction", len(cases))

    # Swelling-Modell exakt wie in apps/swelling_demo.py konfiguriert
    anode, cathode = get_material("Silicon"), get_material("NMC")
    rec = CellOCVReconstruction(cath=cathode, an=anode, np_ratio=1.1, lip_ratio=0.95, v_min=2.8, v_max=4.2)
    stack = StackParams(an_cur_thickness=18, an_thickness=7, sep_thickness=20, cath_thickness=47, cath_cur_thickness=15)
    poro = PorosityParams(sep_porosity=0.4, an_porosity=0.3, cath_porosity=0.25)
    model = SwellingModel(rec=rec, an=anode, cath=cathode, stack=stack, poro=poro)
    sw = []
    for soh in (1.0, 0.99, 0.9, 0.89, 0.8, 0.79):
        for comp, cyl in ((0.0, False), (1.0, False), (30.0, False), (60.0, False), (None, True)):
            layers, classes, meta = model.compute(soh=soh, compression=comp, cylindrical=cyl)
            sw.append({"soh": soh, "compression": comp, "cylindrical": cyl,
                       "layers": {c: layers[c].to_numpy() for c in layers.columns},
                       "classes": {c: classes[c].to_numpy() for c in classes.columns},
                       "index": layers.index.to_numpy(),
                       "meta": {k: (v if isinstance(v, np.ndarray) else scalar(v)) for k, v in meta.items()}})
    write(out / "model" / "swelling.json", {"description": "SwellingModel wie swelling_demo.py", "cases": sw,
                                             "v_an_rel": model.v_an_rel, "v_cath_rel": model.v_cath_rel}, store)
    print("model swelling", len(sw))


# --------------------------------------------------------------------------------------------
# (c) UI per AppTest
# --------------------------------------------------------------------------------------------
def r2(x):
    """Slider-Wert so, wie ihn das Streamlit-Frontend sendet (react-range: parseFloat(toFixed(2)))."""
    return float(f"{x:.2f}")


def tool_cases(rng):
    anodes = ["Ideal Anode", "Graphite", "Silicon"]
    cathodes = ["Ideal Cathode", "LCO", "LFP", "NCA", "NMC"]
    materials = ["Ideal Anode", "Ideal Cathode", "Graphite", "LCO", "LFP", "NCA", "NMC", "Silicon"]
    S, X = "slider", "selectbox"
    cases = {"landing": {"default": []}}

    def edges(label, lo, hi, step=0.01, mid=None):
        vals = {"min": lo, "min_plus": r2(lo + step), "max_minus": r2(hi - step), "max": hi}
        if mid is not None:
            vals["mid"] = mid
        return {f"{label}={name}": [(S, label, v)] for name, v in vals.items()}

    # Materials
    m = {"default": []}
    for mat in materials:
        m[f"material={mat}"] = [(X, "Material", mat)]
    m.update(edges("SoL", 0.0, 1.0, mid=0.33))
    for mat in ("Graphite", "Silicon", "LFP", "Ideal Cathode"):
        for sol in (0.0, 1.0, 0.27):
            m[f"material={mat},SoL={sol}"] = [(X, "Material", mat), (S, "SoL", sol)]
    for i in range(6):
        m[f"random{i}"] = [(X, "Material", rng.choice(materials)), (S, "SoL", r2(rng.random()))]
    cases["materials"] = m

    # Cell Reconstruction
    c = {"default": []}
    for a in anodes[1:]:
        c[f"anode={a}"] = [(X, "Anode", a)]
    for k in cathodes[1:]:
        c[f"cathode={k}"] = [(X, "Cathode", k)]
    c.update(edges("SoC", 0.0, 1.0))
    c.update(edges("V min [V]", 2.0, 3.5, mid=2.73))
    c.update(edges("V max [V]", 3.5, 4.5, mid=4.2))
    c.update(edges("NP Ratio", 0.8, 1.5, mid=1.1))
    c.update(edges("LiP Ratio", 0.5, 1.5, mid=0.95))
    for a in anodes:
        for k in cathodes:
            c[f"pair={a}+{k}"] = [(X, "Anode", a), (X, "Cathode", k)]
    c["realistic=Graphite+NMC"] = [(X, "Anode", "Graphite"), (X, "Cathode", "NMC"), (S, "SoC", 0.3),
                                   (S, "V min [V]", 2.8), (S, "V max [V]", 4.2), (S, "NP Ratio", 1.1),
                                   (S, "LiP Ratio", 0.95)]
    c["realistic=Silicon+LFP"] = [(X, "Anode", "Silicon"), (X, "Cathode", "LFP"), (S, "SoC", 0.75),
                                  (S, "V min [V]", 2.5), (S, "V max [V]", 3.65), (S, "NP Ratio", 1.2),
                                  (S, "LiP Ratio", 0.9)]
    c["extreme=all-min"] = [(S, "SoC", 0.0), (S, "V min [V]", 2.0), (S, "V max [V]", 3.5), (S, "NP Ratio", 0.8),
                            (S, "LiP Ratio", 0.5)]
    c["extreme=all-max"] = [(S, "SoC", 1.0), (S, "V min [V]", 3.5), (S, "V max [V]", 4.5), (S, "NP Ratio", 1.5),
                            (S, "LiP Ratio", 1.5)]
    for i in range(10):
        c[f"random{i}"] = [(X, "Anode", rng.choice(anodes)), (X, "Cathode", rng.choice(cathodes)),
                           (S, "SoC", r2(rng.random())), (S, "V min [V]", r2(rng.uniform(2.0, 3.5))),
                           (S, "V max [V]", r2(rng.uniform(3.5, 4.5))), (S, "NP Ratio", r2(rng.uniform(0.8, 1.5))),
                           (S, "LiP Ratio", r2(rng.uniform(0.5, 1.5)))]
    cases["cell-reconstruction"] = c

    # Blending
    b = {"default": []}
    b.update(edges("SoL (Blend)", 0.0, 1.0))
    b.update(edges("q% (Material A)", 0.0, 1.0))
    for s, q in ((0.0, 0.0), (1.0, 1.0), (0.0, 1.0), (1.0, 0.0), (0.25, 0.4)):
        b[f"combo={s},{q}"] = [(S, "SoL (Blend)", s), (S, "q% (Material A)", q)]
    for i in range(6):
        b[f"random{i}"] = [(S, "SoL (Blend)", r2(rng.random())), (S, "q% (Material A)", r2(rng.random()))]
    cases["blending"] = b

    # Aging
    a = {"default": []}
    for an in anodes[1:]:
        a[f"anode={an}"] = [(X, "Anode", an)]
    for k in cathodes[1:]:
        a[f"cathode={k}"] = [(X, "Cathode", k)]
    a.update(edges("SoC", 0.0, 1.0))
    for lab in ("Cathode LAM (lampe)", "Anode LAM (lamne)", "LLI (lithium loss)"):
        for v in (0.01, 0.25, 0.49, 0.5):
            a[f"{lab}={v}"] = [(S, lab, v)]
    for an in anodes:
        for k in cathodes:
            a[f"pair={an}+{k}"] = [(X, "Anode", an), (X, "Cathode", k)]
    a["realistic=Graphite+NMC"] = [(X, "Anode", "Graphite"), (X, "Cathode", "NMC"), (S, "SoC", 0.3),
                                   (S, "Cathode LAM (lampe)", 0.1), (S, "Anode LAM (lamne)", 0.05),
                                   (S, "LLI (lithium loss)", 0.15)]
    a["realistic=Silicon+LFP"] = [(X, "Anode", "Silicon"), (X, "Cathode", "LFP"), (S, "SoC", 0.8),
                                  (S, "Cathode LAM (lampe)", 0.2), (S, "Anode LAM (lamne)", 0.3),
                                  (S, "LLI (lithium loss)", 0.05)]
    a["extreme=all-0.5"] = [(S, "Cathode LAM (lampe)", 0.5), (S, "Anode LAM (lamne)", 0.5),
                            (S, "LLI (lithium loss)", 0.5)]
    a["extreme=Graphite+LCO-all-0.5-soc1"] = [(X, "Anode", "Graphite"), (X, "Cathode", "LCO"), (S, "SoC", 1.0),
                                             (S, "Cathode LAM (lampe)", 0.5), (S, "Anode LAM (lamne)", 0.5),
                                             (S, "LLI (lithium loss)", 0.5)]
    for i in range(10):
        a[f"random{i}"] = [(X, "Anode", rng.choice(anodes)), (X, "Cathode", rng.choice(cathodes)),
                           (S, "SoC", r2(rng.random())), (S, "Cathode LAM (lampe)", r2(rng.uniform(0, 0.5))),
                           (S, "Anode LAM (lamne)", r2(rng.uniform(0, 0.5))),
                           (S, "LLI (lithium loss)", r2(rng.uniform(0, 0.5)))]
    cases["aging"] = a

    # Swelling (SoH auch mit den Werten, die der Browser wegen step=-0.01 liefert: 0.79, 0.89, ...)
    w = {"default": []}
    w.update(edges("SoC", 0.0, 1.0))
    for soh in (0.99, 0.98, 0.93, 0.89, 0.81, 0.8, 0.79):
        w[f"soh={soh}"] = [(S, "State of Health", soh)]
    w["cylindrical"] = [("checkbox", "Cylindrical?", True)]
    for v in (1.0, 5.0, 30.0, 59.0, 60.0):
        w[f"compression={v}"] = [(S, "Compression [MPa]", v)]
    w["cylindrical,soh=0.8,soc=0"] = [("checkbox", "Cylindrical?", True), (S, "State of Health", 0.8), (S, "SoC", 0.0)]
    w["compression=20,soh=0.85,soc=0.66"] = [(S, "Compression [MPa]", 20.0), (S, "State of Health", 0.85),
                                            (S, "SoC", 0.66)]
    w["soc-ties"] = [(S, "SoC", 0.5)]
    for i in range(8):
        steps = [(S, "SoC", r2(rng.random())), (S, "State of Health", r2(rng.uniform(0.79, 1.0)))]
        if rng.random() < 0.3:
            steps.append(("checkbox", "Cylindrical?", True))
        else:
            steps.append((S, "Compression [MPa]", float(rng.randint(0, 60))))
        w[f"random{i}"] = steps
    cases["swelling"] = w
    return cases


PAGE_OF_TOOL = {"landing": "Landing", "materials": "Materials", "cell-reconstruction": "Cell Reconstruction",
                "blending": "Blending", "aging": "Aging", "swelling": "Swelling"}


def find_widget(at, kind, label):
    pools = {"slider": at.sidebar.slider, "selectbox": at.sidebar.selectbox, "checkbox": at.sidebar.checkbox}
    hits = [w for w in pools[kind] if w.label == label]
    if len(hits) != 1:
        raise KeyError(f"{kind} {label!r} nicht eindeutig gefunden ({len(hits)})")
    return hits[0]


def collect(at, store_specs=True):
    from google.protobuf.json_format import MessageToDict
    from streamlit.testing.v1.element_tree import Block

    out = []

    def walk(node, where):
        if isinstance(node, Block):
            proto = MessageToDict(node.proto, preserving_proto_field_name=True) if node.proto is not None else {}
            out.append({"where": where, "block": node.type, "proto": proto})
            for idx in sorted(node.children):
                walk(node.children[idx], f"{where}/{idx}")
            return
        rec = {"where": where, "type": node.type}
        for attr in ("label", "value", "options", "min", "max", "step", "format", "help", "key", "index"):
            try:
                val = getattr(node, attr)
            except Exception:
                continue
            if callable(val):
                continue
            try:
                json.dumps(val)
            except TypeError:
                continue
            rec[attr] = val
        proto = MessageToDict(node.proto, preserving_proto_field_name=True) if getattr(node, "proto", None) else {}
        if node.type == "plotly_chart":
            proto.pop("id", None)
            proto["spec"] = json.loads(proto["spec"])
            proto["config"] = json.loads(proto.get("config", "{}"))
            template = proto["spec"].get("layout", {}).get("template")
            if template is not None:  # identisch in allen Specs -> einmal ablegen, per Hash referenzieren
                text = json.dumps(template, sort_keys=True, ensure_ascii=False)
                key = hashlib.sha256(text.encode()).hexdigest()[:16]
                path = TEMPLATE_DIR / f"{key}.json"
                if not path.exists():
                    path.parent.mkdir(parents=True, exist_ok=True)
                    path.write_text(text + "\n", encoding="utf-8")
                proto["spec"]["layout"]["template"] = {"$template": key}
        else:
            proto.pop("id", None)
        rec["proto"] = proto
        out.append(rec)

    walk(at.main, "main")
    walk(at.sidebar, "sidebar")
    return out


def make_ui(out: Path, store: ArrayStore, only=None):
    from streamlit.testing.v1 import AppTest

    global TEMPLATE_DIR
    TEMPLATE_DIR = out / "ui" / "_templates"

    os.chdir(APP_DIR)
    sys.path.insert(0, str(APP_DIR))
    rng = random.Random(4711)
    all_cases = tool_cases(rng)
    index = {}
    for tool, cases in all_cases.items():
        if only and tool not in only:
            continue
        index[tool] = []
        for case_id, steps in cases.items():
            at = AppTest.from_file("app.py", default_timeout=180)
            at.session_state["page"] = PAGE_OF_TOOL[tool]
            at.run()
            applied = []
            for kind, label, value in steps:
                widget = find_widget(at, kind, label)
                if kind == "selectbox":
                    widget.select(value)
                else:
                    widget.set_value(value)
                at.run()
                applied.append({"kind": kind, "label": label, "value": value})
            exceptions = [e.value for e in at.exception]
            fname = "".join(ch if ch.isalnum() or ch in "-=.,+" else "_" for ch in case_id) + ".json"
            write(out / "ui" / tool / fname,
                  {"tool": tool, "case": case_id, "steps": applied, "exceptions": exceptions,
                   "elements": collect(at)}, store)
            index[tool].append({"case": case_id, "file": fname, "exceptions": len(exceptions)})
            print("ui", tool, case_id, "EXC" if exceptions else "")
        (out / "ui" / tool / "_index.json").write_text(json.dumps(index[tool], indent=1, ensure_ascii=False) + "\n",
                                                       encoding="utf-8")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("what", nargs="?", default="all", choices=["core", "model", "ui", "all"])
    parser.add_argument("--out", default=str(REPO / "tests" / "golden"))
    parser.add_argument("--tools", nargs="*", help="nur diese Tools (ui)")
    args = parser.parse_args()
    out = Path(args.out).resolve()
    store = ArrayStore(out / "arrays")
    if args.what in ("core", "all"):
        make_core(out, store)
    if args.what in ("model", "all"):
        make_model(out, store)
    if args.what in ("ui", "all"):
        make_ui(out, store, args.tools)
    versions = {"python": sys.version.split()[0], "numpy": np.__version__, "pandas": pd.__version__}
    import plotly
    import scipy
    import streamlit
    versions.update(scipy=scipy.__version__, plotly=plotly.__version__, streamlit=streamlit.__version__)
    (out / "versions.json").write_text(json.dumps(versions, indent=1) + "\n", encoding="utf-8")
    print(versions)


if __name__ == "__main__":
    main()
