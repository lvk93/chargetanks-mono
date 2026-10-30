"""Digitalisiert Lade-/Entladekurven aus Datenblatt-Bildern (Canrd) fuer das Kapitel Materials.

Aufruf:  python3 scripts/digitize-canrd.py [slug ...]
Eingabe: data-sources/curves/canrd/manifest.json (Datei, Achsticks, Kurvenfarbe) und die Bilder daneben.
Ausgabe: data-sources/curves/canrd/digitized/<slug>.json  (charge/discharge: [[mAh/g, V], ...])
         data-sources/curves/canrd/digitized/<slug>-check.png (Bild mit ausgelesenen Punkten zum Pruefen)

Ablauf je Bild:
1. Gitter finden: Spalten/Zeilen mit vielen nicht-weissen Pixeln, daraus die laengste gleichabstaendige Folge,
   die zur Zahl der Ticks im Manifest passt -> lineare Abbildung Pixel -> (mAh/g, V).
2. Kurvenpixel maskieren (schwarz oder lila), Gitter (grau) und Wasserzeichen (hellgrau) fallen raus.
3. Spaltenweise verfolgen: Entladekurve startet oben links (~Obergrenze), Ladekurve unten links;
   je Spalte der Pixelhaufen, der am naechsten an der Vorhersage (lineare Fortsetzung) liegt. Text weit weg
   von der Vorhersage wird ignoriert. Steile Stuecke (hoher Haufen) nehmen das Ende in Laufrichtung.
Nur numpy und Pillow.
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent / 'data-sources' / 'curves' / 'canrd'
OUT = ROOT / 'digitized'


def runs(idx, gap=2):
    out = []
    for i in idx:
        if out and i - out[-1][-1] <= gap:
            out[-1].append(i)
        else:
            out.append([i])
    return [sum(o) / len(o) for o in out]


def best_progression(lines, n, tol=0.03):
    """Laengste gleichabstaendige Folge aus n Linien (Toleranz relativ zum Abstand)."""
    best = None
    for i in range(len(lines)):
        for j in range(i + 1, len(lines)):
            step = lines[j] - lines[i]
            if step < 15:
                continue
            seq = [lines[i]]
            for k in range(1, n):
                est = (seq[-1] - seq[0]) / (len(seq) - 1) if len(seq) > 1 else step
                target = seq[-1] + est
                near = min(lines, key=lambda v: abs(v - target))
                if abs(near - target) > tol * step + 1.5:
                    break
                seq.append(near)
            if len(seq) == n:
                # Abstand ueber alle Punkte mitteln
                fit = np.polyfit(range(n), seq, 1)
                err = np.abs(np.polyval(fit, range(n)) - seq).max()
                if best is None or err < best[1]:
                    best = (fit, err)
    if best is None:
        raise RuntimeError(f'kein Gitter mit {n} Linien gefunden (Linien: {[round(v) for v in lines]})')
    return best[0]


def calibrate(gray, xticks, yticks):
    H, W = gray.shape
    nonwhite = gray < 235
    vlines = runs([i for i, c in enumerate(nonwhite.sum(0)) if c > 0.3 * H])
    hlines = runs([i for i, c in enumerate(nonwhite.sum(1)) if c > 0.3 * W])
    nx = round((xticks[1] - xticks[0]) / xticks[2]) + 1
    ny = round((yticks[1] - yticks[0]) / yticks[2]) + 1
    fx = best_progression(vlines, nx)
    fy = best_progression(hlines, ny)
    # Pixel -> Wert: x waechst nach rechts ab xticks[0]; y-Linien von oben = hoechster Wert
    px2x = lambda px: xticks[0] + (px - fx[1]) / fx[0] * xticks[2]
    py2v = lambda py: yticks[1] - (py - fy[1]) / fy[0] * yticks[2]
    box = (fx[1], np.polyval(fx, nx - 1), fy[1], np.polyval(fy, ny - 1))  # x0, x1, y0 (oben), y1 (unten)
    return px2x, py2v, box


def curve_mask(rgb, color):
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    gray = rgb.mean(2)
    sat = rgb.max(2) - rgb.min(2)
    if color == 'purple':
        return (sat > 70) & (b > r) & (b > g + 40)
    return (gray < 110) & (sat < 60)


def clusters(col):
    ys = np.flatnonzero(col)
    if not len(ys):
        return []
    out = []
    start = prev = ys[0]
    for y in ys[1:]:
        if y - prev > 2:
            out.append((start, prev))
            start = y
        prev = y
    out.append((start, prev))
    return out


def track(mask, x0, x1, y_start, direction, max_jump=10):
    """Verfolgt eine Kurve spaltenweise ab Spalte x0 bei Hoehe y_start.
    direction: +1 = Kurve laeuft nach unten (Entladen), -1 = nach oben (Laden)."""
    pts = []
    y_prev = y_start
    miss = 0
    for x in range(int(x0), int(x1)):
        cs = clusters(mask[:, x])
        if not cs:
            miss += 1
            if miss > 25 and pts:
                break
            continue
        if len(pts) >= 12:
            (xa, ya), (xb, yb) = pts[-12], pts[-1]
            pred = yb + (yb - ya) / max(xb - xa, 1) * (x - xb)
        else:
            pred = y_prev
        best = None
        for a, b in cs:
            # Monotonie: Entladen faellt (y waechst), Laden steigt (y sinkt); verhindert den Sprung auf die andere Kurve am Kreuzungspunkt
            mid = (a + b) / 2
            if direction > 0 and mid < y_prev - 3 and b < y_prev - 3:
                continue
            if direction < 0 and mid > y_prev + 3 and a > y_prev + 3:
                continue
            # Entfernung der Vorhersage zum Haufen (0, wenn sie drin liegt)
            d = 0 if a <= pred <= b else min(abs(pred - a), abs(pred - b))
            if best is None or d < best[0]:
                best = (d, a, b)
        if best is None:
            miss += 1
            if miss > 25 and pts:
                break
            continue
        d, a, b = best
        if d > max_jump + 0.15 * miss * max_jump:
            miss += 1
            if miss > 25 and pts:
                break
            continue
        miss = 0
        if b - a > 12:  # steiles Stueck: Ende in Laufrichtung
            y = b if direction > 0 else a
            # nur bis zum Ende des Haufens laufen lassen, der an die Vorhersage anschliesst
        else:
            y = (a + b) / 2
        pts.append((x, y))
        y_prev = y
    return pts


def track_pair(mask, x0, x1, y_dis, y_cha, max_jump=12):
    """Verfolgt Entlade- (faellt) und Ladekurve (steigt) gemeinsam, jede mit linearer Vorhersage aus den letzten
    12 Punkten. Spalten, in denen beide Vorhersagen im selben Haufen liegen (Kreuzungspunkt), werden nicht
    ausgelesen, sondern mit der Vorhersage ueberbrueckt - sonst haengt sich die falsche Kurve ein."""
    st = [{'pts': [], 'y': y_dis, 'miss': 0, 'done': False}, {'pts': [], 'y': y_cha, 'miss': 0, 'done': False}]

    def pred(s, x):
        p = s['pts']
        if len(p) >= 12:
            (xa, ya), (xb, yb) = p[-12], p[-1]
            return yb + (yb - ya) / max(xb - xa, 1) * (x - xb)
        return s['y']

    for x in range(int(x0), int(x1)):
        cs = [c for c in clusters(mask[:, x]) if c[1] - c[0] >= 3] or clusters(mask[:, x])
        preds = [pred(s, x) for s in st]
        picks = []
        for s, pr in zip(st, preds):
            best = None
            for a, b in cs:
                d = 0 if a <= pr <= b else min(abs(pr - a), abs(pr - b))
                if best is None or d < best[0]:
                    best = (d, a, b)
            picks.append(best)
        ambiguous = (all(picks) and picks[0][1:] == picks[1][1:] and abs(preds[0] - preds[1]) < 20 and picks[0][0] < max_jump)
        for k, s in enumerate(st):
            if s['done']:
                continue
            b = picks[k]
            if ambiguous and len(s['pts']) >= 12:
                s['pts'].append((x, preds[k]))
                s['y'] = preds[k]
                continue
            if b is None or b[0] > max_jump:
                s['miss'] += 1
                if s['miss'] > 25 and len(s['pts']) > 50:
                    s['done'] = True
                continue
            d, a, bb = b
            s['miss'] = 0
            y = (a + bb) / 2
            if bb - a > 12:  # steiles Stueck: Ende in Laufrichtung
                y = bb if k == 0 else a
            s['pts'].append((x, y))
            s['y'] = y
        if st[0]['done'] and st[1]['done']:
            break
    return st[0]['pts'], st[1]['pts']


def digitize(entry):
    img = Image.open(ROOT / entry['file']).convert('RGB')
    rgb = np.asarray(img).astype(int)
    gray = rgb.mean(2)
    px2x, py2v, (bx0, bx1, by0, by1) = calibrate(gray, entry['xticks'], entry['yticks'])
    mask = curve_mask(rgb, entry['color'])
    # Achsenlinien und Rand ausblenden
    m = mask.copy()
    m[:, : int(bx0) + 4] = False
    m[: int(by0) - 2, :] = False
    m[int(by1) + 1:, :] = False
    lo, hi = entry['window_V']
    v2py = lambda v: by0 + (entry['yticks'][1] - v) / (entry['yticks'][1] - entry['yticks'][0]) * (by1 - by0)
    start = int(bx0) + 5
    # Startpunkte: Entladen nahe der Obergrenze, Laden: oberster Haufen unterhalb der Kreuzung (~ unterer Startpunkt)
    cs = clusters(m[:, start + 2])
    if len(cs) < 2:
        cs = clusters(m[:, start + 8])
    # Gitterstriche (duenn) und Rahmen ausschliessen: Kurve ist >= 3 px dick und nicht am Rand
    centers = [(a + b) / 2 for a, b in cs if b - a >= 3 and by0 + 8 < (a + b) / 2 < by1 - 8]
    y_dis = min(centers, key=lambda c: abs(c - v2py(hi)))
    y_cha = max(centers) if len(centers) > 1 else v2py(lo + 0.6 * (hi - lo))
    dis, cha = track_pair(m, start, bx1, y_dis, y_cha)
    if entry['color'] == 'purple':
        # NCA: Ladekurve ist lila, Entladekurve rot/gruen -> getrennt nach Farbe
        sat = rgb.max(2) - rgb.min(2)
        mp = curve_mask(rgb, 'purple')
        mp[:, : int(bx0) + 4] = False
        mp[: int(by0) - 2, :] = False
        mp[int(by1) + 1:, :] = False
        cs0 = [c for c in clusters(mp[:, start + 4]) if c[1] - c[0] >= 3]
        left = track(mp, start, bx1, (cs0[-1][0] + cs0[-1][1]) / 2, -1)
        dy = dict(dis)
        cross = next((x for x, y in left if x in dy and abs(dy[x] - y) < 5), None)
        cha = [(x, y) for x, y in left if cross is None or x < cross]
        # nach der Kreuzung (lila Kurve ist dort teils vom Gitter/Wasserzeichen ueberdeckt): oberster lila Haufen, stetig
        for x in range(int(cha[-1][0]) + 1, int(bx1)):
            cs = clusters(mp[:, x])
            if cs and cs[0][0] <= cha[-1][1] + 8:
                cha.append((x, (cs[0][0] + cs[0][1]) / 2))
        mc = (sat > 70) & ~mp
        mc[:, : int(bx0) + 4] = False
        mc[: int(by0) - 2, :] = False
        mc[int(by1) + 1:, :] = False
        dis, _ = track_pair(mc | m, start, bx1, y_dis, y_cha)
    # Enden kappen: Entladen bei Untergrenze, Laden bei Obergrenze (danach nur noch CV-Haltephase/Rahmen)
    def cut(pts, lim, below):
        for i, (_, y) in enumerate(pts):
            v = py2v(y)
            if (below and v <= lim + 0.02) or (not below and v >= lim - 0.02):
                return pts[: i + 1]
        return pts
    dis, cha = cut(dis, lo, True), cut(cha, hi, False)
    conv = lambda pts: [[round(px2x(x), 2), round(py2v(y), 4)] for x, y in pts]
    res = {'slug': entry['slug'], 'material': entry['material'], 'source': entry['file'], 'protocol': entry['protocol'],
           'discharge': conv(dis), 'charge': conv(cha)}
    # Pruefbild
    chk = img.copy()
    dr = ImageDraw.Draw(chk)
    for x, y in dis[::3]:
        dr.ellipse((x - 2, y - 2, x + 2, y + 2), fill=(230, 40, 40))
    for x, y in cha[::3]:
        dr.ellipse((x - 2, y - 2, x + 2, y + 2), fill=(30, 160, 60))
    dr.rectangle((bx0, by0, bx1, by1), outline=(0, 120, 255))
    return res, chk


def main():
    manifest = json.loads((ROOT / 'manifest.json').read_text())
    wanted = set(sys.argv[1:])
    OUT.mkdir(exist_ok=True)
    for entry in manifest['curves']:
        if wanted and entry['slug'] not in wanted:
            continue
        res, chk = digitize(entry)
        (OUT / f"{entry['slug']}.json").write_text(json.dumps(res) + '\n')
        chk.save(OUT / f"{entry['slug']}-check.png")
        d, c = res['discharge'], res['charge']
        print(f"{entry['slug']}: discharge {len(d)} pts, end {d[-1] if d else '-'} | charge {len(c)} pts, end {c[-1] if c else '-'}")


if __name__ == '__main__':
    main()
