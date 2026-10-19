// Netlify Function /api/event: prueft Ereignisse und schreibt nur erlaubte Felder nach Supabase.
import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import handler, { toRow } from '../../netlify/functions/event.mjs';

let calls;
const realFetch = globalThis.fetch;

beforeEach(() => {
  calls = [];
  process.env.SUPABASE_URL = 'https://example.supabase.co/';
  process.env.SUPABASE_ANON_KEY = 'test-key';
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return new Response(null, { status: 201 });
  };
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

const post = (body, agent = 'Mozilla/5.0') => new Request('https://chargetanks.com/api/event', {
  method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body), headers: { 'user-agent': agent },
});

test('toRow: nur erlaubte Ereignisse und Felder', () => {
  assert.deepEqual(toRow(JSON.stringify({ event: 'page_view', props: { path: '/tools/', ref: 'linkedin.com', ip: '1.2.3.4' } })),
    { app_name: 'chargetanks-web', event: 'page_view', props: { path: '/tools/', ref: 'linkedin.com' } });
  assert.deepEqual(toRow(JSON.stringify({ event: 'tool_used', props: { tool: 'aging', path: '/x' } })).props, { tool: 'aging' });
  assert.equal(toRow(JSON.stringify({ event: 'delete_all' })), null);
  assert.equal(toRow('kein json'), null);
  assert.equal(toRow(JSON.stringify({ event: 'try_this', props: { tool: 'x'.repeat(500) } })).props.tool.length, 200);
});

test('POST wird an Supabase weitergereicht (nur apikey, keine Besucherdaten)', async () => {
  const response = await handler(post({ event: 'try_this', props: { tool: 'aging', query: 'lli=0.2' } }));
  assert.equal(response.status, 204);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://example.supabase.co/rest/v1/event_logs');
  assert.equal(calls[0].options.headers.apikey, 'test-key');
  assert.deepEqual(JSON.parse(calls[0].options.body),
    { app_name: 'chargetanks-web', event: 'try_this', props: { tool: 'aging', query: 'lli=0.2' } });
});

test('Bots, falsche Methode, ungueltige oder zu grosse Anfragen werden verworfen', async () => {
  assert.equal((await handler(post({ event: 'page_view', props: { path: '/' } }, 'Googlebot/2.1'))).status, 204);
  assert.equal((await handler(post({ event: 'nope' }))).status, 204);
  assert.equal((await handler(post('x'.repeat(5000)))).status, 204);
  assert.equal((await handler(new Request('https://chargetanks.com/api/event'))).status, 405);
  assert.equal(calls.length, 0);
});

test('ohne Umgebungsvariablen: nichts senden, trotzdem 204', async () => {
  delete process.env.SUPABASE_URL;
  assert.equal((await handler(post({ event: 'page_view', props: { path: '/' } }))).status, 204);
  assert.equal(calls.length, 0);
});
