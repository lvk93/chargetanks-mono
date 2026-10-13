// Ueberschriften mit Anker wie Streamlit (Anker-ID = lodash kebabCase des Textes, ohne Emojis).
export function anchorId(text) {
  return text
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((word) => word.toLowerCase())
    .join('-');
}

// Ersetzt den Text einer Ueberschrift (erster Textknoten). ID und Anker-Link bleiben wie im Original
// beim Wert des ersten Renderns (gemessen: "SoH: 70.85%" behaelt die ID ...-so-h-100-00, B11).
export function setHeadingText(heading, text) {
  const textNode = [...heading.childNodes].find((n) => n.nodeType === Node.TEXT_NODE);
  if (textNode) textNode.nodeValue = text;
}
