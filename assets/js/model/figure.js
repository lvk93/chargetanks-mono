// Minimales Figure-Modell mit der Semantik von plotly.py (go.Figure), wie sie die Originale nutzen.
// Ergebnis ist dieselbe Struktur, die Streamlit als Spec an den Browser sendet (ohne Template;
// das Streamlit-Template ergaenzt die UI-Schicht, siehe assets/js/ui/plotly.js).

export function newFigure() {
  return { data: [], layout: {} };
}

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v) && !ArrayBuffer.isView(v);

// fig.update_layout(...): Dicts werden rekursiv zusammengefuehrt, alles andere ersetzt.
export function deepUpdate(target, patch) {
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    if (isPlainObject(value) && isPlainObject(target[key])) deepUpdate(target[key], value);
    else target[key] = isPlainObject(value) ? deepUpdate({}, value) : value;
  }
  return target;
}

export function updateLayout(fig, patch) {
  deepUpdate(fig.layout, patch);
  return fig;
}

// go.Scatter(...)/go.Bar(...): Argumente mit None (undefined/null) entfallen wie bei plotly.py.
export function addTrace(fig, type, props) {
  const trace = {};
  for (const [key, value] of Object.entries(props)) if (value !== undefined && value !== null) trace[key] = value;
  trace.type = type;
  fig.data.push(trace);
  return fig;
}

export function addAnnotation(fig, annotation) {
  (fig.layout.annotations ||= []).push(annotation);
  return fig;
}

export function addShape(fig, shape) {
  (fig.layout.shapes ||= []).push(shape);
  return fig;
}

// Wie plotly.io.to_json: numpy-Arrays (hier Float64Array) gehen binaer und behalten NaN;
// in Listen und Skalaren werden nicht-endliche Zahlen zu null (PlotlyJSONEncoder).
export function toPlotlyJson(value) {
  if (ArrayBuffer.isView(value)) return value;
  if (Array.isArray(value)) return value.map(toPlotlyJson);
  if (isPlainObject(value)) {
    const out = {};
    for (const [key, v] of Object.entries(value)) if (v !== undefined) out[key] = toPlotlyJson(v);
    return out;
  }
  if (typeof value === 'number' && !Number.isFinite(value)) return null;
  return value;
}

export function negate(values) {
  return Float64Array.from(values, (v) => -v);
}

export function concatenate(...arrays) {
  const out = new Float64Array(arrays.reduce((n, a) => n + a.length, 0));
  let offset = 0;
  for (const a of arrays) {
    out.set(a, offset);
    offset += a.length;
  }
  return out;
}

export function reversed(values) {
  return Float64Array.from(values).reverse();
}
