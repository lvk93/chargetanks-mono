// Zahlenformatierung wie im Original.
//
// formatFixed(x, n): Python format(x, ".nf") bzw. f"{x:.nf}". Python rundet den exakten Binaerwert
// korrekt und bei exakten Gleichstaenden zur geraden Ziffer (0.125 -> "0.12"); toFixed() rundet
// dort auf (-> "0.13"). Ausserdem: "-0.00" fuer -0.0, "nan", "inf", volle Ziffern ab 1e21.
//
// sprintfFixed(x, n): sprintf-js "%0.nf", mit dem das Streamlit-Frontend Slider-Werte anzeigt
// (intern toFixed; Vorzeichen getrennt, -0 wird zu "0.00").

const VIEW = new DataView(new ArrayBuffer(8));

// Exakte Dezimaldarstellung eines endlichen, nicht-negativen Doubles: value = digits * 10^-scale.
function exactDecimal(value) {
  VIEW.setFloat64(0, value);
  const hi = VIEW.getUint32(0);
  const lo = VIEW.getUint32(4);
  const exponentBits = (hi >>> 20) & 0x7ff;
  let mantissa = (BigInt(hi & 0xfffff) << 32n) | BigInt(lo);
  let exponent;
  if (exponentBits === 0) {
    exponent = -1074; // subnormal
  } else {
    mantissa |= 1n << 52n;
    exponent = exponentBits - 1075;
  }
  if (exponent >= 0) return { digits: mantissa << BigInt(exponent), scale: 0 };
  // mantissa / 2^k = mantissa * 5^k / 10^k
  const k = -exponent;
  return { digits: mantissa * 5n ** BigInt(k), scale: k };
}

export function formatFixed(x, n) {
  if (Number.isNaN(x)) return 'nan';
  if (x === Infinity) return 'inf';
  if (x === -Infinity) return '-inf';
  const negative = x < 0 || Object.is(x, -0);
  const { digits, scale } = exactDecimal(Math.abs(x));
  let scaled;
  if (scale <= n) {
    scaled = digits * 10n ** BigInt(n - scale);
  } else {
    const divisor = 10n ** BigInt(scale - n);
    scaled = digits / divisor;
    const remainder = digits % divisor;
    const twice = remainder * 2n;
    if (twice > divisor || (twice === divisor && scaled % 2n === 1n)) scaled += 1n;
  }
  let text = scaled.toString();
  if (n > 0) {
    text = text.padStart(n + 1, '0');
    text = `${text.slice(0, -n)}.${text.slice(-n)}`;
  }
  return negative ? `-${text}` : text;
}

export function sprintfFixed(x, n) {
  const isPositive = x >= 0;
  let text = Number(x).toFixed(n);
  if (!isPositive) text = `-${text.replace(/^[+-]/, '')}`;
  return text;
}
