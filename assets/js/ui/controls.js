// Bedienelemente einer Tool-Seite: native Regler (<input type="range">), Auswahllisten und Checkboxen in
// einem Formular. Regler zeigen ihren Wert wie im Original mit zwei Nachkommastellen (sprintf "%0.2f",
// bzw. data-decimals) und faerben die Spur bis zum Wert ein.
import { sprintfFixed } from '../core/pyformat.js';

function showSlider(input) {
  const min = Number(input.min);
  const max = Number(input.max);
  const value = Number(input.value);
  const text = sprintfFixed(value, Number(input.dataset.decimals ?? 2));
  input.style.setProperty('--fill', `${((value - min) / (max - min)) * 100}%`);
  input.setAttribute('aria-valuetext', text);
  const output = input.form.querySelector(`output[for="${input.id}"]`);
  if (output) output.value = text;
}

// Werte aller Eingaben: Regler als Zahl, Checkbox als Wahrheitswert, Auswahl als Optionswert
export function readValues(form) {
  const values = {};
  for (const input of form.querySelectorAll('input[name], select[name]')) {
    if (input.type === 'range') values[input.name] = Number(input.value);
    else if (input.type === 'checkbox') values[input.name] = input.checked;
    else values[input.name] = input.value;
  }
  return values;
}

export function initControls(form, onChange) {
  const sliders = [...form.querySelectorAll('input[type="range"]')];
  for (const input of sliders) {
    showSlider(input);
    input.addEventListener('input', () => showSlider(input));
  }
  form.addEventListener('input', onChange);
  form.addEventListener('change', onChange);
  form.addEventListener('submit', (event) => event.preventDefault());
  return {
    values: () => readValues(form),
    // Wert setzen, ohne ein Ereignis auszuloesen (z. B. Zuruecksetzen eines Reglers)
    set(name, value) {
      const input = form.elements[name];
      if (input.type === 'checkbox') input.checked = Boolean(value);
      else input.value = String(value);
      if (input.type === 'range') showSlider(input);
    },
    refresh: () => sliders.forEach(showSlider),
  };
}
