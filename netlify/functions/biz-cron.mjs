// BIZ RIVAL · BZ001 · the jobs that run on their own, every 15 minutes, on Netlify's server (the app does NOT have to be open).
// Only for people who connected Gmail AND switched Biz Rival to LIVE. In TEST mode the server never sends anything.
// Each run: read new mail -> the same rules the app uses (biz-core.js) -> send / book ONLY what a rule allows -> save -> log.
// Every send and booking has a fixed key (biz_run), so a run that times out and runs again can never send or book twice.
import * as C from '../../biz-core.js';
import { gmail, cal, token, sbx } from '../lib/biz-google.mjs';
import { once } from './biz.mjs';

export default async () => {
  const SB = process.env.SUPABASE_URL, SK = process.env.SUPABASE_SERVICE_ROLE_KEY, GID = process.env.GOOGLE_CLIENT_ID, GSEC = process.env.GOOGLE_CLIENT_SECRET;
  if (!SB || !SK || !GID || !GSEC) return new Response('not configured', { status: 200 });
  const sb = sbx(SB, SK), out = [];
  const people = (await sb('/rest/v1/biz_secret?select=user_id,google_email,refresh_token')) || [];
  for (const p of people) { try { out.push(await runFor(sb, p, GID, GSEC)) } catch (e) { out.push({ user: p.user_id.slice(0, 8), error: String(e.message || e).slice(0, 120) }) } }
  return new Response(JSON.stringify(out), { status: 200, headers: { 'content-type': 'application/json' } });
};

export async function runFor(sb, p, GID, GSEC, nowIn) {
  const now = nowIn || Date.now(), row = ((await sb('/rest/v1/biz_state?user_id=eq.' + p.user_id + '&select=rev,data')) || [])[0];
  if (!row || !row.data || !row.data.settings || !row.data.settings.live) return { user: p.user_id.slice(0, 8), skipped: 'test mode' };
  let st = row.data; const job = (id) => (st.jobs || []).find(j => j.id === id) || {};
  if (job('inbox').paused) return { user: p.user_id.slice(0, 8), skipped: 'paused' };
  const at = await token(GID, GSEC, p.refresh_token), done = [];
  const setJob = (id, patch) => { st.jobs = (st.jobs || []).map(j => j.id === id ? Object.assign({}, j, patch) : j) };
  setJob('inbox', { status: 'Running', last: now });
  const mail = await gmail.recent(at, 2), busy = await cal.busy(at, now, now + 15 * 864e5);
  const holds = ((await sb('/rest/v1/biz_hold?user_id=eq.' + p.user_id + '&status=neq.released&starts_at=gte.' + new Date(now).toISOString() + '&select=starts_at,ends_at,status')) || []);
  const r = C.process(st, mail, { now, busy, holds, self: p.google_email }); st = r.state;
  for (const a of r.actions) {
    if (a.test) continue; /* never on the server */
    if (a.type === 'send') { const res = await once(sb, p.user_id, a.msg, 'send', () => gmail.send(at, { to: a.to, subject: a.subject, body: a.body, key: a.msg, gThread: a.gThread, from: p.google_email }), () => gmail.findSent(at, a.msg)); st = C.settle(st, a, res, now); done.push('send ' + (res.ok ? 'ok' : res.check ? 'check' : 'fail')) }
    if (a.type === 'book') {
      const t = st.threads.find(x => x.id === a.thread);
      /* the hold first: the database refuses a second hold on the same start time */
      let held = true; try { await sb('/rest/v1/biz_hold', { method: 'POST', headers: { prefer: 'return=minimal' }, body: JSON.stringify({ user_id: p.user_id, starts_at: new Date(a.slot.start).toISOString(), ends_at: new Date(a.slot.end).toISOString(), thread_id: a.thread }) }) } catch (e) { held = /409|23505|duplicate/.test(String(e.message)) ? 'mine?' : false }
      if (held === 'mine?') { const h = ((await sb('/rest/v1/biz_hold?user_id=eq.' + p.user_id + '&starts_at=eq.' + encodeURIComponent(new Date(a.slot.start).toISOString()) + '&select=thread_id')) || [])[0]; held = !!(h && h.thread_id === a.thread) }
      const res = !held ? { taken: true } : await once(sb, p.user_id, a.key, 'book', async () => { const b = await cal.busy(at, a.slot.start, a.slot.end); if (b.length) return { taken: true }; return cal.book(at, { key: a.key, start: a.slot.start, end: a.slot.end, title: 'Session · ' + (t.name || t.email), email: t.email, tz: st.settings.tz }) }, () => cal.find(at, a.key));
      if (res.taken && held === true) await sb('/rest/v1/biz_hold?user_id=eq.' + p.user_id + '&starts_at=eq.' + encodeURIComponent(new Date(a.slot.start).toISOString()), { method: 'PATCH', body: JSON.stringify({ status: 'released' }) });
      st = C.settle(st, a, res, now); done.push('book ' + (res.ok ? 'ok' : res.taken ? 'taken' : 'check'));
      if (res.ok) {
        const bk = st.bookings.find(x => x.id === a.key);
        await sb('/rest/v1/biz_hold?user_id=eq.' + p.user_id + '&starts_at=eq.' + encodeURIComponent(new Date(a.slot.start).toISOString()), { method: 'PATCH', body: JSON.stringify({ status: 'booked' }) });
        await clubRow(sb, p.user_id, bk, st);
        const ck = 'conf-' + a.key; const cr = await once(sb, p.user_id, ck, 'send', () => gmail.send(at, { to: t.email, subject: 'You’re booked', body: C.confirmText(bk, st), key: ck, gThread: t.gThread, from: p.google_email }), () => gmail.findSent(at, ck));
        if (cr.ok) { t.msgs.push({ id: ck, dir: 'out', at: now, body: C.confirmText(bk, st), status: 'sent', key: ck }); t.lastOut = now }
      }
    }
  }
  /* morning briefing, once a day, to your own inbox - only if you set that rule to "just do it" */
  const lt = new Date(new Date(now).toLocaleString('en-US', { timeZone: st.settings.tz })), hm = String(lt.getHours()).padStart(2, '0') + ':' + String(lt.getMinutes()).padStart(2, '0'), day = lt.toISOString().slice(0, 10);
  if (C.ruleFor(st.rules, 'daily_brief', now).level === 'auto' && hm >= (st.settings.briefAt || '07:00') && !job('daily_brief').paused && job('daily_brief').day !== day) {
    const B = C.brief(st, now), txt = ['Good morning. Here is the business today.', '', 'NEEDS YOU (' + B.needs.length + ')', ...B.needs.slice(0, 8).map(t => '- ' + (t.name || t.email) + ': ' + t.needsWhy), '', 'NEW LEADS WAITING (' + B.waiting.length + ')', ...B.waiting.slice(0, 8).map(t => '- ' + (t.name || t.email)), '', 'COMING UP', ...B.books.map(b => '- ' + C.slotText(b, st.settings.tz) + ' · ' + b.name), '', 'DONE SINCE MIDNIGHT (' + B.done.length + ')', ...B.done.slice(-10).map(x => '- ' + x.txt), '', '- Biz Rival'].join('\n');
    const k = 'brief-' + day, res = await once(sb, p.user_id, k, 'send', () => gmail.send(at, { to: p.google_email, subject: 'Biz Rival · your morning briefing', body: txt, key: k, from: p.google_email }), () => gmail.findSent(at, k));
    setJob('daily_brief', { status: res.ok ? 'Completed' : 'Failed', last: now, day: res.ok ? day : job('daily_brief').day }); if (res.ok) C.logIt(st, 'Morning briefing sent to your inbox', 'did', now);
  }
  setJob('inbox', { status: 'Scheduled', last: now, next: now + 15 * 60e3, ran: done.length });
  /* save, only if nobody else saved in between (the app's own edits win; the next run picks up from there - nothing is lost because every send/book is in biz_run) */
  const w = await sb('/rest/v1/biz_state?user_id=eq.' + p.user_id + '&rev=eq.' + row.rev, { method: 'PATCH', body: JSON.stringify({ rev: row.rev + 1, data: st, updated_at: new Date().toISOString() }) });
  return { user: p.user_id.slice(0, 8), mail: mail.length, did: done, saved: !!(w && w.length) };
}
async function clubRow(sb, uid, b, st) {
  const d = new Date(new Date(b.start).toLocaleString('en-US', { timeZone: st.settings.tz })), day = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'), time = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  try { await sb('/rest/v1/club_schedule?on_conflict=user_id,id', { method: 'POST', headers: { prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify({ user_id: uid, id: ('biz-' + b.id).slice(0, 80), app: 'biz', type: 'activity', rev: 1, origin: 'biz', data: { title: 'Session · ' + (b.name || 'client'), time, durMin: Math.round((b.end - b.start) / 60000), days: null, date: day, from: day, plan: 'Booked by Biz Rival.' } }) }) } catch (e) { }
}
export const config = { schedule: '*/15 * * * *' };
