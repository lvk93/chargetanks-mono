// Netlify Function /api/event: nimmt anonyme Nutzungsereignisse der Webseite an und schreibt sie in die
// Supabase-Tabelle event_logs. Supabase-URL und Schluessel kennt nur Netlify (Umgebungsvariablen
// SUPABASE_URL, SUPABASE_ANON_KEY); der Browser spricht nur mit der eigenen Domain, Supabase sieht keine
// Besucher-IP. Gespeichert werden nur Ereignisname und wenige, gepruefte Felder - keine IDs, keine IP.
const MAX_BODY = 2048;
const MAX_TEXT = 200;
const FIELDS = {
  page_view: ['path', 'ref'],
  tool_used: ['tool'],
  try_this: ['tool', 'query'],
};

const clean = (value) => (typeof value === 'string' ? value.slice(0, MAX_TEXT) : undefined);

// Prueft eine Anfrage und liefert die zu speichernde Zeile oder null
export function toRow(raw) {
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return null;
  }
  const fields = FIELDS[body?.event];
  if (!fields) return null;
  const props = {};
  for (const field of fields) {
    const value = clean(body.props?.[field]);
    if (value !== undefined && value !== '') props[field] = value;
  }
  return { app_name: 'chargetanks-web', event: body.event, props };
}

export default async function handler(request) {
  if (request.method !== 'POST') return new Response(null, { status: 405 });
  const raw = await request.text();
  const agent = request.headers.get('user-agent') ?? '';
  const row = raw.length <= MAX_BODY && !/bot|crawl|spider|headless/i.test(agent) ? toRow(raw) : null;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (row && url && key) {
    try {
      const response = await fetch(`${url.replace(/\/$/, '')}/rest/v1/event_logs`, {
        method: 'POST',
        headers: { apikey: key, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify(row),
      });
      if (!response.ok) console.error('event_logs insert failed', response.status, await response.text());
    } catch (error) {
      console.error('event_logs insert failed', error);
    }
  }
  // immer ohne Inhalt antworten: der Browser braucht keine Rueckmeldung
  return new Response(null, { status: 204 });
}

export const config = { path: '/api/event' };
