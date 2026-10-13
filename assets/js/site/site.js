// Webseite: Laufzeitverhalten der React-Ansicht (chargetanks@main) ohne Framework.
// - Header: Mobilmenue (Header.tsx: isMenuOpen, Icon Menu/X, aria-*), Links schliessen das Menue
// - Footer: Jahr wie new Date().getFullYear()
// - Datumsangaben wie toLocaleDateString('en-US', …) zur Laufzeit (lokale Zeitzone, wie im Original)
// - Links innerhalb derselben Seite wie react-router + ScrollToTop (App.tsx): gleiche Adresse -> nichts,
//   anderer Hash -> sanft zum Abschnitt, kein Hash -> nach oben; Zurueck/Vor ebenso
// - About-Bild: onError -> ausblenden (About.tsx)
// - 404.html: fuer /blog/<slug>/ Inhalt und Kopf von "Post not found" (PostDetail.tsx)
const SITE_URL = 'https://chargetanks.com';
const DATE_FORMATS = {
  short: { month: 'short', day: 'numeric', year: 'numeric' },
  long: { month: 'long', day: 'numeric', year: 'numeric' },
};

// --- Header-Menue ---------------------------------------------------------------------------
const menuButton = document.querySelector('[data-ct-menu-button]');
const menu = document.querySelector('[data-ct-menu]');

function setMenu(open) {
  if (!menuButton) return;
  menu.hidden = !open;
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.setAttribute('aria-label', open ? 'Close navigation menu' : 'Open navigation menu');
  menuButton.querySelector('[data-ct-icon="menu"]').toggleAttribute('hidden', open);
  menuButton.querySelector('[data-ct-icon="close"]').toggleAttribute('hidden', !open);
}

menuButton?.addEventListener('click', () => setMenu(menu.hidden));
// closeMenu an allen Header-Links (Logo, Desktop- und Mobilnavigation)
for (const link of document.querySelectorAll('.ct-header a')) link.addEventListener('click', () => setMenu(false));

// --- Jahr und Datumsangaben -------------------------------------------------------------------
for (const el of document.querySelectorAll('[data-ct-year]')) el.textContent = String(new Date().getFullYear());

for (const el of document.querySelectorAll('[data-ct-date]')) {
  const value = el.getAttribute('datetime') || el.dataset.ctDateValue;
  el.textContent = new Date(value).toLocaleDateString('en-US', DATE_FORMATS[el.dataset.ctDate]);
}

// --- Navigation innerhalb der Seite (react-router Link + ScrollToTop) ---------------------------
function scrollForLocation() {
  if (location.hash) {
    const id = location.hash.slice(1);
    requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    return;
  }
  window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
}

document.addEventListener('click', (event) => {
  const link = event.target.closest('a[href]');
  if (!link || event.defaultPrevented || event.button !== 0) return;
  if (event.metaKey || event.altKey || event.ctrlKey || event.shiftKey || link.target) return;
  const url = new URL(link.href, location.href);
  if (url.origin !== location.origin || url.pathname !== location.pathname || url.search !== location.search) return;
  event.preventDefault();
  if (url.hash === location.hash) return; // gleiche Adresse: Router ersetzt den Eintrag, kein Scrollen
  history.pushState(null, '', url.pathname + url.search + url.hash);
  scrollForLocation();
});

let lastPath = location.pathname;
let lastHash = location.hash;
window.addEventListener('popstate', () => {
  if (location.pathname === lastPath && location.hash === lastHash) return;
  lastPath = location.pathname;
  lastHash = location.hash;
  scrollForLocation();
});
window.addEventListener('hashchange', () => {
  lastPath = location.pathname;
  lastHash = location.hash;
});
const pushState = history.pushState.bind(history);
history.pushState = (...args) => {
  pushState(...args);
  lastPath = location.pathname;
  lastHash = location.hash;
};

// --- About-Bild -------------------------------------------------------------------------------
for (const img of document.querySelectorAll('.ct-about-img')) {
  img.addEventListener('error', () => {
    img.style.display = 'none';
  });
}

// --- 404: "Post not found" fuer /blog/<slug>/ --------------------------------------------------
const postNotFound = document.querySelector('template[data-ct-post-not-found]');
const postMatch = location.pathname.match(/^\/blog\/([^/]+)\/?$/i);
if (postNotFound && postMatch) {
  const head = JSON.parse(document.querySelector('script[data-ct-post-not-found-head]').dataset.ctPostNotFoundHead);
  const slug = postMatch[1];
  const url = new URL(`/blog/${slug}/`, SITE_URL).toString();
  document.querySelector('main').replaceWith(postNotFound.content.cloneNode(true));
  document.title = head.title;
  for (const [key, value] of Object.entries(head.meta)) {
    const attr = key.startsWith('og:') ? 'property' : 'name';
    document.head.querySelector(`meta[${attr}="${key}"]`)?.setAttribute('content', key === 'og:url' ? url : value);
  }
  document.head.querySelector('link[rel="canonical"]')?.setAttribute('href', url);
}
