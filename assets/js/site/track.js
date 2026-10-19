// Anonyme Nutzungsereignisse an /api/event (Netlify Function -> Supabase). Ohne Cookies, ohne Speicher im
// Browser, ohne Kennungen. Nur auf chargetanks.com (nicht lokal, nicht in Deploy-Vorschauen) und nicht bei
// "Do Not Track" oder "Global Privacy Control".
const enabled = location.hostname === 'chargetanks.com'
  && navigator.doNotTrack !== '1' && !navigator.globalPrivacyControl && !navigator.webdriver;

export function track(event, props = {}) {
  if (!enabled) return;
  const body = JSON.stringify({ event, props });
  try {
    if (navigator.sendBeacon?.('/api/event', new Blob([body], { type: 'application/json' }))) return;
    fetch('/api/event', { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'application/json' } })
      .catch(() => {});
  } catch {
    // Statistik darf die Seite nie stoeren
  }
}

// Herkunft: fremde Seite nur als Domain, eigene Seite als Pfad (z. B. welcher Artikel zu einem Tool fuehrt)
export function referrer() {
  if (!document.referrer) return '';
  try {
    const url = new URL(document.referrer);
    return url.origin === location.origin ? url.pathname : url.hostname;
  } catch {
    return '';
  }
}
