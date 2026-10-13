// Nachbildungen der genutzten numpy-Funktionen mit identischer Gleitkomma-Reihenfolge.
// Referenz: numpy 2.4.3 (Render-Stand), numpy/_core/function_base.py (linspace) und
// numpy/_core/src/multiarray/compiled_base.c (arr_interp, binary_search_with_guess).

// np.linspace(start, stop, num): y[i] = i*step + start, letzter Wert exakt stop.
export function linspace(start, stop, num) {
  const out = new Float64Array(Math.max(0, num));
  if (num <= 0) return out;
  const div = num - 1;
  const delta = stop - start;
  if (div > 0) {
    const step = delta / div;
    if (step === 0) {
      for (let i = 0; i < num; i += 1) out[i] = (i / div) * delta + start; // numpy: y /= div; y *= delta
    } else {
      for (let i = 0; i < num; i += 1) out[i] = i * step + start;
    }
    out[num - 1] = stop;
  } else {
    out[0] = 0 * delta + start;
  }
  return out;
}

// Letzter Index j mit xp[j] <= key (xp aufsteigend); -1 links ausserhalb, n rechts ausserhalb.
function searchLastLE(key, xp) {
  const n = xp.length;
  if (key > xp[n - 1]) return n;
  if (key < xp[0]) return -1;
  let lo = 0;
  let hi = n;
  while (lo < hi) {
    const mid = lo + ((hi - lo) >> 1);
    if (key >= xp[mid]) lo = mid + 1;
    else hi = mid;
  }
  return lo - 1;
}

function interpOne(xv, xp, fp, left, right) {
  const n = xp.length;
  // numpy prueft bei genau einer Stuetzstelle kein NaN: NaN faellt dort auf fp[0]
  if (n === 1) return xv < xp[0] ? left : xv > xp[0] ? right : fp[0];
  if (Number.isNaN(xv)) return xv;
  const j = searchLastLE(xv, xp);
  if (j === -1) return left;
  if (j === n) return right;
  if (j === n - 1) return fp[j];
  if (xp[j] === xv) return fp[j];
  const slope = (fp[j + 1] - fp[j]) / (xp[j + 1] - xp[j]);
  let result = slope * (xv - xp[j]) + fp[j];
  if (Number.isNaN(result)) {
    result = slope * (xv - xp[j + 1]) + fp[j + 1];
    if (Number.isNaN(result) && fp[j] === fp[j + 1]) result = fp[j];
  }
  return result;
}

// np.interp(x, xp, fp, left, right); x Skalar oder Array (Ergebnis entsprechend).
export function interp(x, xp, fp, left = fp[0], right = fp[fp.length - 1]) {
  if (typeof x === 'number') return interpOne(x, xp, fp, left, right);
  const out = new Float64Array(x.length);
  for (let i = 0; i < x.length; i += 1) out[i] = interpOne(x[i], xp, fp, left, right);
  return out;
}

// np.clip(a, lo, hi) == np.minimum(np.maximum(a, lo), hi) (NaN bleibt NaN).
export function clip(value, lo, hi) {
  const max = Number.isNaN(value) || value >= lo ? value : lo;
  return Number.isNaN(max) || max <= hi ? max : hi;
}

export function nanmin(values) {
  let out = NaN;
  for (const v of values) if (!Number.isNaN(v) && (Number.isNaN(out) || v < out)) out = v;
  return out;
}

export function nanmax(values) {
  let out = NaN;
  for (const v of values) if (!Number.isNaN(v) && (Number.isNaN(out) || v > out)) out = v;
  return out;
}

// np.argsort(x, kind="mergesort"): stabil, NaN ans Ende.
export function argsortStable(x) {
  const order = Array.from({ length: x.length }, (_, i) => i);
  order.sort((a, b) => {
    const va = x[a];
    const vb = x[b];
    const na = Number.isNaN(va);
    const nb = Number.isNaN(vb);
    if (na || nb) return na === nb ? a - b : na ? 1 : -1;
    if (va < vb) return -1;
    if (va > vb) return 1;
    return a - b;
  });
  return order;
}
