// Webseite: Mobilmenue im Seitenkopf (oeffnen/schliessen, Escape und Klick auf einen Link schliessen).
const button = document.querySelector('[data-menu-button]');
const menu = document.querySelector('[data-menu]');

function setMenu(open) {
  menu.hidden = !open;
  button.setAttribute('aria-expanded', String(open));
  button.setAttribute('aria-label', open ? 'Close navigation menu' : 'Open navigation menu');
  button.querySelector('[data-icon="menu"]').toggleAttribute('hidden', open);
  button.querySelector('[data-icon="close"]').toggleAttribute('hidden', !open);
}

if (button && menu) {
  button.addEventListener('click', () => setMenu(menu.hidden));
  menu.addEventListener('click', (event) => {
    if (event.target.closest('a')) setMenu(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !menu.hidden) {
      setMenu(false);
      button.focus();
    }
  });
}
