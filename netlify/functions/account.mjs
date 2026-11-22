// CLUB RIVAL · CR043 · DELETE MY ACCOUNT - one door for every Rival app that uses the Club sign-in
// (Club, Mind Training, Rest, Rise, Money, Biz). Apple: an app with sign-in must let you delete the account inside the app.
// Netlify > clubrival > Environment variables: SUPABASE_SERVICE_ROLE_KEY (secret). It never leaves this function.
// What happens, in order:
//   1. Money: every linked bank is unlinked at Plaid (Money's own /api/plaid unlink, with the member's own sign-in).
//   2. Biz: the Gmail + Calendar link is revoked at Google (Biz's own /api/biz google-off).
//   3. Stride / RideFlow rows (rf_delete_me, if it is installed).
//   4. The sign-in itself is deleted. Every Rival table is "on delete cascade", so the rest goes with it.
const SB = process.env.SUPABASE_URL || 'https://glmyzwxinguqcqtgodts.supabase.co', ANON = 'sb_publishable_DuBWJ2pLLgaQNkoFqiuOfA_WSYzunwW';
const MONEY = process.env.MONEY_URL || 'https://moneyrival.netlify.app', BIZ = process.env.BIZ_URL || 'https://mybizrival.netlify.app';
const okOrigin = o => /^https:\/\/([a-z0-9-]+\.)*(netlify\.app|[a-z0-9-]*rival\.(com|app))$/i.test(o || '') || /^capacitor:\/\/localhost$/i.test(o || '');

export default async (req) => {
  const origin = req.headers.get('origin') || '';
  const CORS = okOrigin(origin) ? { 'access-control-allow-origin': origin, vary: 'Origin' } : {};
  const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...CORS } });
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...CORS, 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type, authorization', 'access-control-max-age': '86400' } });
  if (req.method === 'GET') return json({ ok: !!process.env.SUPABASE_SERVICE_ROLE_KEY, why: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'delete is ready' : 'SUPABASE_SERVICE_ROLE_KEY is not set on clubrival' });
  if (req.method !== 'POST') return json({ error: 'post only' }, 405);
  const SK = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SK) return json({ error: 'not-configured', say: 'Delete isn’t switched on yet. Coach E: add SUPABASE_SERVICE_ROLE_KEY to the clubrival site in Netlify.' }, 503);
  let b = {}; try { b = await req.json() } catch (e) { }
  if (b.confirm !== 'DELETE') return json({ error: 'confirm', say: 'Type DELETE to confirm.' }, 400);
  const jwt = String(req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!jwt || jwt === 'undefined' || jwt === 'null') return json({ error: 'not-signed-in', say: 'Sign in first.' }, 401);
  const ur = await fetch(SB + '/auth/v1/user', { headers: { apikey: ANON, authorization: 'Bearer ' + jwt } });
  if (!ur.ok) return json({ error: 'not-signed-in', say: 'Sign in again, then delete.' }, 401);
  const user = await ur.json(); const uid = user && user.id;
  if (!uid) return json({ error: 'not-signed-in', say: 'Sign in again, then delete.' }, 401);

  const steps = {};
  const call = async (name, url, body) => {
    try { const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + jwt }, body: JSON.stringify(body) }); steps[name] = r.status } catch (e) { steps[name] = 'unreachable' }
  };
  await call('money', MONEY + '/api/plaid', { action: 'unlink' });
  await call('biz', BIZ + '/api/biz', { action: 'google-off' });
  try { const r = await fetch(SB + '/rest/v1/rpc/rf_delete_me', { method: 'POST', headers: { apikey: SK, authorization: 'Bearer ' + SK, 'content-type': 'application/json' }, body: JSON.stringify({ p_uid: uid }) }); steps.stride = r.status } catch (e) { steps.stride = 'unreachable' }

  const d = await fetch(SB + '/auth/v1/admin/users/' + encodeURIComponent(uid), { method: 'DELETE', headers: { apikey: SK, authorization: 'Bearer ' + SK } });
  if (!d.ok && d.status !== 404) { let t = ''; try { t = (await d.text()).slice(0, 160) } catch (e) { } return json({ error: 'delete-failed', status: d.status, detail: t, steps, say: 'That didn’t delete. Try again in a minute.' }, 502) }
  return json({ deleted: true, steps });
};
export const config = { path: '/api/account' };
