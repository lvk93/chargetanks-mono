// Fingerabdruck der Diagramme eines Tool-Laufs. Laeuft in Node und im Browser (crypto.subtle).
// Je Diagramm:
// - traces: SHA-256 ueber type, name, x, y, customdata und text aller Traces in Reihenfolge
// - marks:  SHA-256 ueber Shapes (type, x0, x1, y0, y1), Annotationen (text, x, y, ax, ay) und die
//           Achsbereiche (range aller x-/y-Achsen; in Materials und Swelling aus den Daten berechnet)
// - texts:  alle Annotationstexte im Klartext
// Eingabe ist die Figure, wie sie an Plotly geht (toPlotlyJson bzw. gd.data/gd.layout im Browser).
// Zahlen gehen als float64 ein, NaN in einheitlicher Bitfolge; Float64Array und Liste sind gleichwertig.
const encoder = new TextEncoder();

class Writer {
  constructor() {
    this.parts = [];
    this.length = 0;
  }

  push(bytes) {
    this.parts.push(bytes);
    this.length += bytes.length;
  }

  u32(n) {
    const bytes = new Uint8Array(4);
    new DataView(bytes.buffer).setUint32(0, n);
    this.push(bytes);
  }

  tag(t) {
    this.push(encoder.encode(t));
  }

  string(s) {
    const bytes = encoder.encode(s);
    this.u32(bytes.length);
    this.push(bytes);
  }

  number(v) {
    const bytes = new Uint8Array(8);
    const view = new DataView(bytes.buffer);
    if (Number.isNaN(v)) view.setUint32(0, 0x7ff80000);
    else view.setFloat64(0, v);
    this.push(bytes);
  }

  value(v) {
    if (v === undefined) this.tag('u');
    else if (v === null) this.tag('z');
    else if (typeof v === 'number') {
      this.tag('n');
      this.number(v);
    } else if (typeof v === 'string') {
      this.tag('s');
      this.string(v);
    } else if (typeof v === 'boolean') this.tag(v ? 't' : 'f');
    else if (Array.isArray(v) || ArrayBuffer.isView(v)) {
      this.tag('a');
      this.u32(v.length);
      for (const item of v) this.value(item);
    } else throw new Error(`Fingerabdruck: unerwarteter Wert (${typeof v})`);
  }

  bytes() {
    const out = new Uint8Array(this.length);
    let offset = 0;
    for (const part of this.parts) {
      out.set(part, offset);
      offset += part.length;
    }
    return out;
  }
}

async function sha256(writer) {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', writer.bytes());
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

const TRACE_KEYS = ['type', 'name', 'x', 'y', 'customdata', 'text'];
const SHAPE_KEYS = ['type', 'x0', 'x1', 'y0', 'y1'];
const ANNOTATION_KEYS = ['text', 'x', 'y', 'ax', 'ay'];

function writeObjects(writer, objects, keys) {
  writer.u32(objects.length);
  for (const object of objects) for (const key of keys) writer.value(object[key]);
}

// Nur die Trace-Daten (fuer den Abgleich im Browser, wo die Darstellungsschicht das Layout anpasst).
export async function fingerprintTraces(data) {
  const writer = new Writer();
  writeObjects(writer, data, TRACE_KEYS);
  return sha256(writer);
}

export async function fingerprintFigure({ data, layout }) {
  const marks = new Writer();
  writeObjects(marks, layout.shapes ?? [], SHAPE_KEYS);
  writeObjects(marks, layout.annotations ?? [], ANNOTATION_KEYS);
  const axes = Object.keys(layout).filter((key) => /^[xy]axis\d*$/.test(key)).sort();
  marks.u32(axes.length);
  for (const key of axes) {
    marks.string(key);
    marks.value(layout[key].range);
  }
  return {
    traces: await fingerprintTraces(data),
    marks: await sha256(marks),
    texts: (layout.annotations ?? []).map((a) => a.text).filter((t) => t !== undefined),
  };
}
