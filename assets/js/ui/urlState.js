// Zustand einer Tool-Seite in der URL (?soc=0.8&anode=graphite ...): Links lassen sich teilen und
// Artikel koennen auf vorbereitete Zustaende verweisen. Parameter = Namen der Eingaben; Materialien als
// Slug (data-slug der Option). In der URL steht nur, was vom Default (HTML-Wert) abweicht.

// Parameter aus der URL in die Eingaben uebernehmen; ungueltige Werte bleiben beim Default.
export function applyUrlState(form, search = location.search) {
  const params = new URLSearchParams(search);
  for (const [name, raw] of params) {
    const input = form.elements[name];
    if (!input || input instanceof RadioNodeList) continue;
    if (input.type === 'range') {
      if (raw.trim() === '' || !Number.isFinite(Number(raw))) continue;
      input.value = raw; // der Browser klemmt auf [min, max] und rastet auf das Raster ein
    } else if (input.type === 'checkbox') {
      if (['1', 'true'].includes(raw)) input.checked = true;
      else if (['0', 'false'].includes(raw)) input.checked = false;
    } else if (input.tagName === 'SELECT') {
      const option = [...input.options].find((o) => o.dataset.slug === raw || o.value === raw);
      if (option) input.value = option.value;
    }
  }
}

// Abweichungen vom Default als Query-String (ohne "?")
export function urlQuery(form) {
  const params = new URLSearchParams();
  for (const input of form.querySelectorAll('input[name], select[name]')) {
    if (input.type === 'range') {
      if (Number(input.value) !== Number(input.defaultValue)) params.set(input.name, input.value);
    } else if (input.type === 'checkbox') {
      if (input.checked !== input.defaultChecked) params.set(input.name, input.checked ? '1' : '0');
    } else if (input.tagName === 'SELECT') {
      const selected = input.selectedOptions[0];
      const fallback = [...input.options].find((o) => o.defaultSelected) ?? input.options[0];
      if (selected !== fallback) params.set(input.name, selected.dataset.slug ?? selected.value);
    }
  }
  return params.toString();
}

export function writeUrlState(form) {
  const query = urlQuery(form);
  const url = `${location.pathname}${query ? `?${query}` : ''}${location.hash}`;
  if (url !== `${location.pathname}${location.search}${location.hash}`) history.replaceState(history.state, '', url);
}
