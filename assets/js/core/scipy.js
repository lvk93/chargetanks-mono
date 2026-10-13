// Nachbildungen der genutzten scipy.interpolate-Bausteine (Referenz: scipy 1.17.1, Render-Stand).
//
// interp1d(kind="linear", bounds_error=False, assume_sorted=False):
//   _interpolate.py: argsort(kind="mergesort"); fill_value="extrapolate" -> _call_linear
//   (searchsorted links, clip(1, n-1), slope*(x - x_lo) + y_lo); Tupel-Fill -> _call_linear_np
//   (np.interp) und danach x < x[0] -> unten, x > x[-1] -> oben (_evaluate/_check_bounds).
// PchipInterpolator(x, y, extrapolate=False):
//   _cubic.py: _find_derivatives/_edge_case, Koeffizienten wie CubicHermiteSpline;
//   Auswertung wie _ppoly.pyx evaluate/evaluate_poly1 (Potenzsumme, nicht Horner),
//   Intervalle [x_i, x_i+1), letztes rechts geschlossen, ausserhalb und NaN -> NaN.
import { argsortStable, interp } from './numpy.js';

function searchsortedLeft(sorted, key) {
  // erster Index i mit sorted[i] >= key; NaN gilt als groesser als alles (wie numpy)
  if (Number.isNaN(key)) {
    let i = sorted.length;
    while (i > 0 && Number.isNaN(sorted[i - 1])) i -= 1;
    return i;
  }
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] < key) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export function interp1d(x, y, { fillValue = 'extrapolate' } = {}) {
  const order = argsortStable(x);
  const xs = Float64Array.from(order, (i) => x[i]);
  const ys = Float64Array.from(order, (i) => y[i]);
  const n = xs.length;

  const linear = (q) => {
    const idx = Math.min(Math.max(searchsortedLeft(xs, q), 1), n - 1);
    const xLo = xs[idx - 1];
    const yLo = ys[idx - 1];
    const slope = (ys[idx] - yLo) / (xs[idx] - xLo);
    return slope * (q - xLo) + yLo;
  };
  const filled = (q) => {
    if (q < xs[0]) return fillValue[0];
    if (q > xs[n - 1]) return fillValue[1];
    return interp(q, xs, ys);
  };
  const one = fillValue === 'extrapolate' ? linear : filled;

  return (q) => {
    if (typeof q === 'number') return one(q);
    const out = new Float64Array(q.length);
    for (let i = 0; i < q.length; i += 1) out[i] = one(q[i]);
    return out;
  };
}

function edgeCase(h0, h1, m0, m1) {
  let d = ((2 * h0 + h1) * m0 - h0 * m1) / (h0 + h1);
  // np.sign(NaN) = NaN und NaN != NaN ist wahr - in JS identisch (NaN !== NaN)
  const mask = Math.sign(d) !== Math.sign(m0);
  const mask2 = Math.sign(m0) !== Math.sign(m1) && Math.abs(d) > 3 * Math.abs(m0);
  if (mask) d = 0;
  else if (mask2) d = 3 * m0;
  return d;
}

function signOf(v) {
  return Number.isNaN(v) ? NaN : Math.sign(v);
}

export function pchip(x, y) {
  const n = x.length;
  const h = new Float64Array(n - 1);
  const m = new Float64Array(n - 1);
  for (let k = 0; k < n - 1; k += 1) {
    h[k] = x[k + 1] - x[k];
    m[k] = (y[k + 1] - y[k]) / h[k];
  }
  const d = new Float64Array(n);
  if (n === 2) {
    d[0] = m[0];
    d[1] = m[0];
  } else {
    for (let k = 1; k < n - 1; k += 1) {
      const s0 = signOf(m[k - 1]);
      const s1 = signOf(m[k]);
      const differs = !(s0 === s1); // NaN != NaN wie numpy
      if (differs || m[k] === 0 || m[k - 1] === 0) {
        d[k] = 0;
      } else {
        const w1 = 2 * h[k] + h[k - 1];
        const w2 = h[k] + 2 * h[k - 1];
        const whmean = (w1 / m[k - 1] + w2 / m[k]) / (w1 + w2);
        d[k] = 1.0 / whmean;
      }
    }
    d[0] = edgeCase(h[0], h[1], m[0], m[1]);
    d[n - 1] = edgeCase(h[n - 2], h[n - 3], m[n - 2], m[n - 3]);
  }
  // CubicHermiteSpline: c0 = t/dx, c1 = (slope - d_i)/dx - t, c2 = d_i, c3 = y_i
  const c0 = new Float64Array(n - 1);
  const c1 = new Float64Array(n - 1);
  for (let i = 0; i < n - 1; i += 1) {
    const dx = x[i + 1] - x[i];
    const slope = (y[i + 1] - y[i]) / dx;
    const t = (d[i] + d[i + 1] - 2 * slope) / dx;
    c0[i] = t / dx;
    c1[i] = (slope - d[i]) / dx - t;
  }
  const a = x[0];
  const b = x[n - 1];

  const one = (q) => {
    if (!(a <= q && q <= b)) return NaN; // ausserhalb (extrapolate=False) oder NaN
    let i;
    if (q === b) {
      i = n - 2;
    } else {
      let lo = 0;
      let hi = n - 2;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (x[mid] <= q) lo = mid;
        else hi = mid - 1;
      }
      i = lo;
    }
    const s = q - x[i];
    let res = 0.0;
    let z = 1.0;
    res = res + y[i] * z * 1.0;
    z *= s;
    res = res + d[i] * z * 1.0;
    z *= s;
    res = res + c1[i] * z * 1.0;
    z *= s;
    res = res + c0[i] * z * 1.0;
    return res;
  };

  return (q) => {
    if (typeof q === 'number') return one(q);
    const out = new Float64Array(q.length);
    for (let i = 0; i < q.length; i += 1) out[i] = one(q[i]);
    return out;
  };
}
