// BIZ RIVAL · BZ004 · the Google connection (Gmail + Calendar). Runs on Netlify, never in the page.
// BZ004: Google comes back to /api/google/callback (the address registered in Google Cloud). Set GOOGLE_REDIRECT_URI to change it.
// The Google key (refresh token) lives ONLY in Supabase biz_secret (the app can't read it) and here.
// Netlify > Site settings > Environment variables:
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET   (Google Cloud > APIs & Services > Credentials > OAuth client, type "Web application",
//                                             redirect URI = https://mybizrival.netlify.app/api/google/callback)
//   SUPABASE_URL = https://glmyzwxinguqcqtgodts.supabase.co   SUPABASE_SERVICE_ROLE_KEY = (Supabase > Settings > API > service_role)
// Actions (POST JSON with the signed-in user's token in Authorization: Bearer):
//   status · google-start · google-off · sync · send · busy · book      GET ?action=google-callback is Google coming back.
// Every send and booking goes through biz_run with a fixed key: a retry after a time-out can never send or book twice.
import { gmail, cal, token, sbx, hmac, json } from '../lib/biz-google.mjs';

export default async (req) => {
  const SB = process.env.SUPABASE_URL, SK = process.env.SUPABASE_SERVICE_ROLE_KEY, GID = process.env.GOOGLE_CLIENT_ID, GSEC = process.env.GOOGLE_CLIENT_SECRET;
  const url = new URL(req.url), site = url.origin, redirect = process.env.GOOGLE_REDIRECT_URI || 'https://mybizrival.netlify.app/api/google/callback', home = new URL(redirect).origin;
  if (!SB || !SK) return json({ error: 'not-configured', why: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing in Netlify' }, 503);
  const sb = sbx(SB, SK);

  /* Google sends the person back here after they say yes */
  if (req.method === 'GET' && (url.pathname === '/api/google/callback' || url.searchParams.get('action') === 'google-callback')) {
    const code = url.searchParams.get('code'), state = url.searchParams.get('state') || '', [uid, ts, sig] = state.split('.');
    if (!GID || !GSEC) return Response.redirect(home + '/?google=not-configured', 302);
    if (!code || !uid || !sig || hmac(GSEC, uid + '.' + ts) !== sig || Date.now() - +ts > 15 * 60e3) return Response.redirect(home + '/?google=bad-link', 302);
    const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code, client_id: GID, client_secret: GSEC, redirect_uri: redirect, grant_type: 'authorization_code' }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.refresh_token) return Response.redirect(home + '/?google=' + (j.refresh_token ? 'failed' : 'no-refresh'), 302);
    let email = null; try { const p = await (await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', { headers: { authorization: 'Bearer ' + j.access_token } })).json(); email = p.emailAddress || null } catch (e) { }
    await sb('/rest/v1/biz_secret?on_conflict=user_id', { method: 'POST', headers: { prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ user_id: uid, google_email: email, refresh_token: j.refresh_token, scopes: j.scope || '', connected_at: new Date().toISOString() }) });
    return Response.redirect(home + '/?google=ok', 302);
  }
  if (req.method !== 'POST') return json({ error: 'post only' }, 405);
  let b = {}; try { b = await req.json() } catch (e) { }
  const action = String(b.action || '');
  const jwt = String(req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!jwt) return json({ error: 'not-signed-in' }, 401);
  const ur = await fetch(SB + '/auth/v1/user', { headers: { apikey: SK, authorization: 'Bearer ' + jwt } });
  if (!ur.ok) return json({ error: 'not-signed-in' }, 401);
  const uid = (await ur.json()).id; if (!uid) return json({ error: 'not-signed-in' }, 401);
  const sec = ((await sb('/rest/v1/biz_secret?user_id=eq.' + uid + '&select=google_email,refresh_token,connected_at')) || [])[0] || null;

  try {
    if (action === 'status') return json({ configured: !!(GID && GSEC), google: sec ? { email: sec.google_email, since: sec.connected_at } : null });
    if (action === 'google-start') {
      if (!GID || !GSEC) return json({ error: 'google-not-configured' }, 503);
      const ts = String(Date.now()), state = uid + '.' + ts + '.' + hmac(GSEC, uid + '.' + ts);
      const scope = ['openid', 'email', 'https://www.googleapis.com/auth/gmail.modify', 'https://www.googleapis.com/auth/calendar.events', 'https://www.googleapis.com/auth/calendar.freebusy'].join(' ');
      return json({ url: 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({ client_id: GID, redirect_uri: redirect, response_type: 'code', scope, access_type: 'offline', prompt: 'consent', state }) });
    }
    if (action === 'google-off') {
      if (sec) { try { await fetch('https://oauth2.googleapis.com/revoke?token=' + encodeURIComponent(sec.refresh_token), { method: 'POST' }) } catch (e) { } await sb('/rest/v1/biz_secret?user_id=eq.' + uid, { method: 'DELETE' }) }
      return json({ ok: true });
    }
    if (!sec) return json({ error: 'google-not-connected' }, 409);
    const at = await token(GID, GSEC, sec.refresh_token);
    if (action === 'sync') return json({ messages: await gmail.recent(at, +b.days || 7), self: sec.google_email });
    if (action === 'busy') return json({ busy: await cal.busy(at, +b.from, +b.to) });
    if (action === 'send') return json(await once(sb, uid, b.key, 'send', () => gmail.send(at, { to: b.to, subject: b.subject, body: b.body, key: b.key, gThread: b.gThread, from: sec.google_email }), () => gmail.findSent(at, b.key), !!b.force));
    if (action === 'book') return json(await once(sb, uid, b.key, 'book', async () => {
      const busy = await cal.busy(at, +b.start, +b.end); if (busy.length) return { taken: true };
      return cal.book(at, { key: b.key, start: +b.start, end: +b.end, title: b.title, email: b.email, tz: b.tz });
    }, () => cal.find(at, b.key), !!b.force));
    return json({ error: 'unknown action' }, 400);
  } catch (e) { return json({ error: String(e && e.message || e).slice(0, 200) }, 500) }
};

/* do it once. The key row is inserted first; a second call with the same key returns the first result, or checks Google for proof
   (the X-Biz-Key header on the sent mail / the event id) before ever trying again. */
export async function once(sb, uid, key, kind, doIt, findIt, force) {
  if (!key || String(key).length < 6) return { error: 'missing key' };
  const ins = await sb('/rest/v1/biz_run?on_conflict=user_id,key', { method: 'POST', headers: { prefer: 'resolution=ignore-duplicates,return=representation' }, body: JSON.stringify({ user_id: uid, key, kind, status: 'running' }) });
  if (!ins || !ins.length) {
    const prev = ((await sb('/rest/v1/biz_run?user_id=eq.' + uid + '&key=eq.' + encodeURIComponent(key) + '&select=status,detail')) || [])[0];
    if (prev && prev.status === 'done') return Object.assign({ ok: true, again: true }, prev.detail || {});
    const found = await findIt().catch(() => null);
    if (found) { await mark(sb, uid, key, 'done', { proof: found }); return { ok: true, proof: found, again: true } }
    if (prev && (prev.status === 'running' || (prev.status === 'check' && !force))) return { check: true };
  }
  let res; try { res = await doIt() } catch (e) {
    const found = await findIt().catch(() => null);
    if (found) { await mark(sb, uid, key, 'done', { proof: found }); return { ok: true, proof: found } }
    await mark(sb, uid, key, 'check', { error: String(e && e.message || e).slice(0, 160) }); return { check: true };
  }
  if (res && res.taken) { await mark(sb, uid, key, 'failed', { taken: true }); return { taken: true } }
  await mark(sb, uid, key, 'done', { proof: res && res.proof || null }); return { ok: true, proof: res && res.proof || null };
}
async function mark(sb, uid, key, status, detail) { await sb('/rest/v1/biz_run?user_id=eq.' + uid + '&key=eq.' + encodeURIComponent(key), { method: 'PATCH', headers: { prefer: 'return=minimal' }, body: JSON.stringify({ status, detail, updated_at: new Date().toISOString() }) }) }

export const config = { path: ['/api/biz', '/api/google/callback'] };
