// App-Geruest wie Streamlit 1.47.0 (app/src/components/Sidebar/Sidebar.tsx):
// - Startzustand: eingeklappt bis 768 px Fensterbreite, sonst offen
// - Einklappen/Aufklappen per Header-Buttons; der Einklapp-Button erscheint beim Mouseover (CSS :hover)
// - Breite per Griff 200-600 px (mobil max. 90 % der Fensterbreite), gespeichert in localStorage
//   ("sidebarWidth") wie im Original; Doppelklick auf den Griff setzt 256 px zurueck
// - bis 768 px: Klick ausserhalb klappt ein; Verkleinern des Fensters auf <= 768 px klappt ein
const MIN_WIDTH = 200;
const MAX_WIDTH = 600;
const DEFAULT_WIDTH = 256;
const MEDIUM_BREAKPOINT = 768;
const STORAGE_KEY = 'sidebarWidth';

function readStoredWidth() {
  try {
    const value = Number(window.localStorage.getItem(STORAGE_KEY));
    return value > 0 ? value : null;
  } catch {
    return null;
  }
}

function storeWidth(width) {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(width));
  } catch {
    // ohne localStorage bleibt die Breite nur bis zum Neuladen erhalten
  }
}

export function initShell(doc = document) {
  // Kopier-Button der Codebloecke (stCodeCopyButton)
  doc.querySelectorAll('.st-code-copy').forEach((button) => {
    button.addEventListener('click', () => navigator.clipboard?.writeText(button.dataset.clipboardText));
  });
  const app = doc.querySelector('.st-app');
  const sidebar = doc.querySelector('[data-st-sidebar]');
  if (!sidebar) return;
  const isCollapsed = () => sidebar.getAttribute('aria-expanded') === 'false';
  const setCollapsed = (collapsed) => sidebar.setAttribute('aria-expanded', String(!collapsed));
  const setWidth = (width) => app.style.setProperty('--st-sidebar-width', `${width}px`);

  const stored = readStoredWidth();
  if (stored) setWidth(stored);
  setCollapsed(window.innerWidth <= MEDIUM_BREAKPOINT);

  doc.querySelector('[data-st-sidebar-collapse]')?.addEventListener('click', () => setCollapsed(!isCollapsed()));
  doc.querySelector('[data-st-sidebar-expand]')?.addEventListener('click', () => setCollapsed(false));

  let lastInnerWidth = window.innerWidth;
  window.addEventListener('resize', () => {
    const { innerWidth } = window;
    if (innerWidth < lastInnerWidth && innerWidth <= MEDIUM_BREAKPOINT && !isCollapsed()) setCollapsed(true);
    lastInnerWidth = innerWidth;
  });

  const content = sidebar.querySelector('.st-sidebar-content');
  doc.addEventListener('mousedown', (event) => {
    if (window.innerWidth <= MEDIUM_BREAKPOINT && !isCollapsed() && !content.contains(event.target)) {
      setCollapsed(true);
    }
  });

  const handle = doc.querySelector('[data-st-sidebar-resize]');
  if (!handle) return;
  handle.addEventListener('dblclick', () => {
    setWidth(DEFAULT_WIDTH);
    storeWidth(DEFAULT_WIDTH);
  });
  handle.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = sidebar.getBoundingClientRect().width;
    handle.setPointerCapture(event.pointerId);
    const move = (e) => {
      const max = Math.min(MAX_WIDTH, window.innerWidth * 0.9);
      setWidth(Math.min(max, Math.max(MIN_WIDTH, startWidth + (e.clientX - startX))));
    };
    const up = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      storeWidth(sidebar.clientWidth || sidebar.offsetWidth);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
  });
}
