// BIZ RIVAL · BZ001 · Google helpers (Gmail + Calendar) and the Supabase service client. Server only.
import crypto from 'node:crypto';
export const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
export const hmac = (k, s) => crypto.createHmac('sha256', k).update(s).digest('base64url').slice(0, 32);
export const sbx = (SB, SK) => async (path, opt = {}) => {
  const r = await fetch(SB + path, { ...opt, headers: { apikey: SK, authorization: 'Bearer ' + SK, 'content-type': 'application/json', prefer: 'return=representation', ...(opt.headers || {}) } });
  const t = await r.text(); let j = null; try { j = t ? JSON.parse(t) : null } catch (e) { }
  if (!r.ok) throw new Error('db ' + r.status + ' ' + t.slice(0, 160)); return j;
};
export async function token(id, secret, refresh) {
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: id, client_secret: secret, refresh_token: refresh, grant_type: 'refresh_token' }) });
  const j = await r.json().catch(() => ({})); if (!r.ok || !j.access_token) throw new Error('google sign-in expired - reconnect Gmail'); return j.access_token;
}
const G = async (at, url, opt = {}) => { const r = await fetch(url, { ...opt, headers: { authorization: 'Bearer ' + at, 'content-type': 'application/json', ...(opt.headers || {}) } }); const j = await r.json().catch(() => ({})); if (!r.ok) { const e = new Error('google ' + r.status + ' ' + ((j.error && j.error.message) || '')); e.status = r.status; throw e } return j };
const b64u = (s) => Buffer.from(s, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64 = (s) => Buffer.from(String(s || '').replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
const hdr = (p, n) => ((p.headers || []).find(h => h.name.toLowerCase() === n) || {}).value || '';
function textOf(p) { if (!p) return ''; if (p.mimeType === 'text/plain' && p.body && p.body.data) return unb64(p.body.data); for (const x of p.parts || []) { const t = textOf(x); if (t) return t } if (p.mimeType === 'text/html' && p.body && p.body.data) return unb64(p.body.data).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '); return '' }
/* drop the quoted earlier mail so only the new words are read */
const fresh = (t) => String(t).split(/\n(On .+wrote:|-----Original Message-----|From: .+\nSent: )/)[0].trim().slice(0, 4000);
export const gmail = {
  async recent(at, days) {
    const L = await G(at, 'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=50&q=' + encodeURIComponent('in:inbox newer_than:' + days + 'd -category:promotions -category:social'));
    const out = [];
    for (const m of (L.messages || []).slice(0, 50)) {
      const x = await G(at, 'https://gmail.googleapis.com/gmail/v1/users/me/messages/' + m.id + '?format=full');
      const from = hdr(x.payload, 'from'), em = (from.match(/<([^>]+)>/) || [, from])[1].trim(), nm = from.replace(/<[^>]+>/, '').replace(/"/g, '').trim();
      out.push({ id: x.id, gThread: x.threadId, from: em, fromName: nm && nm !== em ? nm : '', subject: hdr(x.payload, 'subject'), body: fresh(textOf(x.payload)), at: +x.internalDate, msgId: hdr(x.payload, 'message-id') });
    }
    return out;
  },
  async send(at, { to, subject, body, key, gThread, from }) {
    const raw = ['To: ' + to, from ? 'From: ' + from : '', 'Subject: ' + String(subject || '').replace(/[\r\n]+/g, ' '), 'X-Biz-Key: ' + key, 'MIME-Version: 1.0', 'Content-Type: text/plain; charset=UTF-8', '', body].filter((l, i) => l !== '' || i > 3).join('\r\n');
    const j = await G(at, 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send', { method: 'POST', body: JSON.stringify(Object.assign({ raw: b64u(raw) }, gThread ? { threadId: gThread } : {})) });
    return { proof: { gmailId: j.id, thread: j.threadId } };
  },
  async findSent(at, key) {
    const L = await G(at, 'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=5&q=' + encodeURIComponent('in:sent newer_than:3d'));
    for (const m of L.messages || []) { const x = await G(at, 'https://gmail.googleapis.com/gmail/v1/users/me/messages/' + m.id + '?format=metadata&metadataHeaders=X-Biz-Key'); if (hdr(x.payload, 'x-biz-key') === key) return { gmailId: x.id, thread: x.threadId } }
    return null;
  },
};
/* Google event ids: 5-1024 chars of a-v and 0-9 - made from our key, so the same booking always has the same id */
const evId = (key) => 'bz' + crypto.createHash('sha256').update(key).digest('hex').replace(/[^0-9a-v]/g, '').slice(0, 40);
export const cal = {
  async busy(at, from, to) { const j = await G(at, 'https://www.googleapis.com/calendar/v3/freeBusy', { method: 'POST', body: JSON.stringify({ timeMin: new Date(from).toISOString(), timeMax: new Date(to).toISOString(), items: [{ id: 'primary' }] }) }); return ((j.calendars && j.calendars.primary && j.calendars.primary.busy) || []).map(b => ({ start: Date.parse(b.start), end: Date.parse(b.end) })) },
  async book(at, { key, start, end, title, email, tz }) {
    try { const j = await G(at, 'https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all', { method: 'POST', body: JSON.stringify({ id: evId(key), summary: title || 'Session', start: { dateTime: new Date(start).toISOString(), timeZone: tz }, end: { dateTime: new Date(end).toISOString(), timeZone: tz }, attendees: email ? [{ email }] : [] }) }); return { proof: { eventId: j.id, link: j.htmlLink } } }
    catch (e) { if (e.status === 409) return { proof: { eventId: evId(key), already: true } }; throw e }
  },
  async find(at, key) { try { const j = await G(at, 'https://www.googleapis.com/calendar/v3/calendars/primary/events/' + evId(key)); return j && j.status !== 'cancelled' ? { eventId: j.id, link: j.htmlLink } : null } catch (e) { return null } },
};
