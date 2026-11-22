import * as C from './biz-core.js';
/* =====================================================================================================================
   BIZ RIVAL · BZ001 - Coach E's business assistant. Same coach, same Club sign-in, same schedule as every Rival app.
   The loop: inquiry -> reply -> times offered -> booked -> on the Club schedule -> follow-up -> morning briefing.
   TEST MODE (the default): nothing leaves. "Sent" mail goes to the test outbox, bookings are marked TEST.
   LIVE: only after Gmail is connected AND you switch it on. Then the server runs it every 15 minutes, even with the app closed.
   Each kind of job has its own level: draft for me / ask me first / just do it. Money, new promises, unclear answers and anything
   not on file always come back to you. Emails are data: nothing written in one can change a rule.
   ===================================================================================================================== */
const BUILD = 'BZ006', LKEY = 'biz_v1', MIN = 60000, DAY = 864e5;
const SB_URL = 'https://glmyzwxinguqcqtgodts.supabase.co', SB_KEY = 'sb_publishable_DuBWJ2pLLgaQNkoFqiuOfA_WSYzunwW';
const $ = id => document.getElementById(id), esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let SB = null; try { SB = window.supabase.createClient(SB_URL, SB_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' } }) } catch (e) { }
let CLUBBACK = ''; try { const q = new URLSearchParams(location.search), cb = q.get('club'); if (q.get('from') === 'club' && cb && /^https:\/\/[a-z0-9.-]+\.netlify\.app\//.test(cb)) sessionStorage.setItem('club_back', cb); CLUBBACK = sessionStorage.getItem('club_back') || '' } catch (e) { }
const tzHere = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone } catch (e) { return 'America/New_York' } })();
let ST = (() => { try { return JSON.parse(localStorage.getItem(LKEY)) || null } catch (e) { return null } })() || C.blankState(tzHere);
const U = { user: null, rev: 0, view: 'today', google: null, configured: false, saving: false, err: '' };
const now = () => Date.now();
function toast(t) { const o = document.querySelector('.toast'); if (o) o.remove(); const e = document.createElement('div'); e.className = 'toast'; e.textContent = t; document.body.appendChild(e); setTimeout(() => e.remove(), 2400) }
function sheet(html, after) { close(); const d = document.createElement('div'); d.className = 'sh'; d.id = 'sh'; d.innerHTML = '<div role="dialog" aria-modal="true">' + html + '</div>'; d.onclick = e => { if (e.target === d || e.target.hasAttribute('data-x')) close() }; document.body.appendChild(d); if (after) after() }
function close() { const s = $('sh'); if (s) s.remove() }
const when = t => new Date(t).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const ago = t => { const m = Math.round((now() - t) / MIN); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' d ago' };

/* ---------- saving: this phone first, then your account (with a revision number, so the server job and the app never overwrite each other) ---------- */
function local() { try { localStorage.setItem(LKEY, JSON.stringify(ST)) } catch (e) { } }
let saveT = null;
function save() { local(); if (!SB || !U.user) return; clearTimeout(saveT); saveT = setTimeout(push, 500) }
async function push() {
  if (U.saving) { saveT = setTimeout(push, 400); return } U.saving = true;
  try {
    if (!U.rev) { const { error } = await SB.from('biz_state').insert({ user_id: U.user.id, rev: 1, data: ST }); if (error) throw error; U.rev = 1 }
    else { const { data, error } = await SB.from('biz_state').update({ rev: U.rev + 1, data: ST, updated_at: new Date().toISOString() }).eq('user_id', U.user.id).eq('rev', U.rev).select('rev'); if (error) throw error;
      if (!data || !data.length) { await pull(true); toast('UPDATED FROM THE SERVER · CHECK IT AND TRY AGAIN') } else U.rev++ }
    U.err = '';
  } catch (e) { U.err = /biz_state|schema cache|does not exist/i.test(String(e.message)) ? 'Run BZ001-BIZ.sql in Supabase to save to your account.' : 'Not saved to your account yet (no connection). It’s safe on this phone.' }
  U.saving = false; draw()
}
async function pull(force) {
  if (!SB || !U.user) return;
  try { const { data, error } = await SB.from('biz_state').select('rev,data').eq('user_id', U.user.id).maybeSingle(); if (error) throw error;
    if (data) { U.rev = data.rev; ST = Object.assign(C.blankState(tzHere), data.data); local() } else if (!force) { U.rev = 0; save() } } catch (e) { U.err = /biz_state|schema cache|does not exist/i.test(String(e.message)) ? 'Run BZ001-BIZ.sql in Supabase to save to your account.' : '' }
}
async function api(action, extra) {
  if (!SB || !U.user) return { error: 'not-signed-in' };
  const ss = (await SB.auth.getSession()).data.session; if (!ss) return { error: 'not-signed-in' };
  try { const r = await fetch('/api/biz', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + ss.access_token }, body: JSON.stringify(Object.assign({ action }, extra || {})) }); return await r.json().catch(() => ({ error: 'bad reply' })) } catch (e) { return { error: 'offline' } }
}

/* ---------- what's busy: your Club schedule (and, when live, your Google Calendar). Only times are used - never the reasons. ---------- */
async function clubBusy(from, days) {
  if (!SB || !U.user) return [];
  try { const { data } = await SB.from('club_schedule').select('id,type,data').eq('user_id', U.user.id).limit(500); const out = [];
    for (let i = 0; i < days; i++) { const d = new Date(from); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + i); const ds = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'), wd = d.getDay();
      (data || []).filter(r => r.type === 'activity' && r.data && r.data.time).forEach(r => { const x = r.data, rep = Array.isArray(x.days) && x.days.length; if (rep ? !(x.days.includes(wd) && ds >= (x.from || '2000-01-01') && !(x.until && ds > x.until)) : x.date !== ds) return; if (x.skip && x.skip[ds]) return;
        const tm = (x.move && x.move[ds]) || (x.times && x.times[wd]) || x.time, [H, M] = tm.split(':').map(Number), s = new Date(d); s.setHours(H, M, 0, 0); out.push({ start: s.getTime(), end: s.getTime() + (+x.durMin || 30) * MIN }) }) }
    return out } catch (e) { return [] }
}
async function busyNow() { const t = now(), b = await clubBusy(t, 15); if (ST.settings.live && U.google) { const g = await api('busy', { from: t, to: t + 15 * DAY }); if (g.busy) b.push(...g.busy) } return b }

/* ---------- run the loop, then carry out what it asks: test = outbox, live = Gmail / Calendar through the server ---------- */
async function run(incoming) {
  const busy = await busyNow(); let holds = [];
  if (SB && U.user && ST.settings.live) { try { const { data } = await SB.from('biz_hold').select('starts_at,ends_at,status').eq('user_id', U.user.id).neq('status', 'released'); holds = data || [] } catch (e) { } }
  const r = C.process(ST, incoming, { now: now(), busy, holds, self: U.google && U.google.email }); ST = r.state;
  for (const a of r.actions) await act(a);
  save(); draw()
}
async function act(a) {
  if (a.type === 'send') {
    if (a.test || !ST.settings.live) { ST.outbox = (ST.outbox || []).concat([{ at: now(), to: a.to, subject: a.subject, body: a.body, key: a.msg }]).slice(-100); ST = C.settle(ST, a, { ok: true }, now()); return }
    const r = await api('send', { key: a.msg, to: a.to, subject: a.subject, body: a.body, gThread: a.gThread }); ST = C.settle(ST, a, r.ok ? { ok: true, proof: r.proof } : r.check ? { check: true } : { error: r.error || 'failed' }, now()); return
  }
  if (a.type === 'book') {
    const t = ST.threads.find(x => x.id === a.thread);
    if (a.test || !ST.settings.live) {
      const clash = (ST.bookings || []).some(b => b.status === 'booked' && b.start < a.slot.end && a.slot.start < b.end) || (await busyNow()).some(b => b.start < a.slot.end && a.slot.start < b.end);
      ST = C.settle(ST, a, clash ? { taken: true } : { ok: true }, now());
      if (!clash) { const bk = ST.bookings.find(x => x.id === a.key); ST.outbox = (ST.outbox || []).concat([{ at: now(), to: t.email, subject: 'You’re booked', body: C.confirmText(bk, ST), key: 'conf-' + a.key }]); t.msgs.push({ id: 'conf-' + a.key, dir: 'out', at: now(), body: C.confirmText(bk, ST), status: 'test' }) }
      return }
    /* live: hold the slot first (the database refuses a second hold on the same time), then book through the server */
    const { error } = await SB.from('biz_hold').insert({ user_id: U.user.id, starts_at: new Date(a.slot.start).toISOString(), ends_at: new Date(a.slot.end).toISOString(), thread_id: a.thread });
    if (error && !/duplicate|23505/.test(error.message + error.code)) { ST = C.settle(ST, a, { error: 'could not hold the time' }, now()); return }
    if (error) { const { data } = await SB.from('biz_hold').select('thread_id').eq('user_id', U.user.id).eq('starts_at', new Date(a.slot.start).toISOString()).maybeSingle(); if (!data || data.thread_id !== a.thread) { ST = C.settle(ST, a, { taken: true }, now()); return } }
    const r = await api('book', { key: a.key, start: a.slot.start, end: a.slot.end, title: 'Session · ' + (t.name || t.email), email: t.email, tz: ST.settings.tz });
    ST = C.settle(ST, a, r.ok ? { ok: true, proof: r.proof } : r.taken ? { taken: true } : r.check ? { check: true } : { error: r.error }, now());
    if (r.ok) { await SB.from('biz_hold').update({ status: 'booked' }).eq('user_id', U.user.id).eq('starts_at', new Date(a.slot.start).toISOString()); const bk = ST.bookings.find(x => x.id === a.key); await clubRow(bk); const ck = 'conf-' + a.key, cr = await api('send', { key: ck, to: t.email, subject: 'You’re booked', body: C.confirmText(bk, ST), gThread: t.gThread }); if (cr.ok) t.msgs.push({ id: ck, dir: 'out', at: now(), body: C.confirmText(bk, ST), status: 'sent' }) }
    else if (r.taken) await SB.from('biz_hold').update({ status: 'released' }).eq('user_id', U.user.id).eq('starts_at', new Date(a.slot.start).toISOString());
  }
}
async function clubRow(b) {
  if (!SB || !U.user || !b || b.test) return; const d = new Date(b.start), day = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  try { await SB.from('club_schedule').upsert({ user_id: U.user.id, id: ('biz-' + b.id).slice(0, 80), app: 'biz', type: 'activity', rev: 1, origin: 'biz', data: { title: 'Session · ' + (b.name || 'client'), time: String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'), durMin: Math.round((b.end - b.start) / MIN), days: null, date: day, from: day, plan: 'Booked by Biz Rival.' } }, { onConflict: 'user_id,id', ignoreDuplicates: true }) } catch (e) { }
}
async function checkInbox() {
  if (!(ST.settings.live && U.google)) { toast('TEST MODE · USE “TRY A SAMPLE INQUIRY”'); return }
  const r = await api('sync', { days: 3 }); if (r.error) { toast(r.error === 'google-not-connected' ? 'CONNECT GMAIL FIRST' : 'COULDN’T REACH GMAIL'); return }
  await run(r.messages || []); toast('INBOX CHECKED')
}
let XPDAY = ''; async function xp() { const d = new Date().toISOString().slice(0, 10); if (!SB || !U.user || XPDAY === d) return; XPDAY = d; try { await SB.rpc('club_award', { p_rows: [{ id: 'biz-' + d, app: 'biz', kind: 'session', at: new Date().toISOString() }] }) } catch (e) { } }

/* ---------- the screens ---------- */
const TABS = [['today', 'TODAY'], ['inbox', 'INBOX'], ['jobs', 'JOBS'], ['know', 'KNOW'], ['setup', 'SETUP']];
function draw() {
  const live = ST.settings.live, B = C.brief(ST, now());
  let h = (CLUBBACK ? '<a class="clubback" href="' + CLUBBACK.replace(/"/g, '') + '">‹ CLUB RIVAL</a>' : '') + '<div class="top"><div class="brand"><img src="icon-192.png" alt=""><div><div class="logo">BIZ <b>RIVAL</b></div><div class="ver">LET’S WORK · ' + BUILD + '</div></div></div><button class="pill" id="acct">' + (U.user ? '✓ ACCOUNT' : 'SIGN IN') + '</button></div>';
  h += '<div class="mode ' + (live ? 'live' : '') + '" id="modeChip">' + (live ? '● LIVE · Gmail ' + esc(U.google ? U.google.email : '') : 'TEST MODE · nothing leaves this app') + '</div>';
  if (U.err) h += '<div class="small warn">' + esc(U.err) + '</div>';
  h += '<nav class="tabs">' + TABS.map(t => '<button data-tab="' + t[0] + '" class="' + (U.view === t[0] ? 'on' : '') + '">' + t[1] + (t[0] === 'inbox' && B.needs.length ? ' <i>' + B.needs.length + '</i>' : '') + '</button>').join('') + '</nav>';
  h += ({ today: todayHTML, inbox: inboxHTML, jobs: jobsHTML, know: knowHTML, setup: setupHTML })[U.view](B);
  $('m').innerHTML = h; wire()
}
function todayHTML(B) {
  const sec = (title, n, body) => '<div class="card"><div class="ey">' + title + (n != null ? ' · ' + n : '') + '</div>' + body + '</div>';
  const row = (t) => '<button class="li tl" data-th="' + t.id + '"><div><b>' + esc(t.name || t.email) + '</b><span>' + esc(t.needsWhy || t.subject || '') + '</span></div><em class="k ' + t.kind + '">' + t.kind.toUpperCase() + '</em></button>';
  let h = '';
  h += sec('NEXT', null, B.next.length ? B.next.map(x => '<div class="li"><div><b>' + esc(x) + '</b></div></div>').join('') : '<div class="small">Nothing waiting on you.' + (ST.settings.live ? '' : ' Tap TRY A SAMPLE INQUIRY to watch it work.') + '</div>');
  h += sec('NEEDS YOU', B.needs.length, B.needs.length ? B.needs.slice(0, 6).map(row).join('') : '<div class="small">All clear.</div>');
  h += sec('NEW LEADS WAITING', B.waiting.length, B.waiting.length ? B.waiting.slice(0, 6).map(row).join('') : '<div class="small">No one waiting on a first answer.</div>');
  h += sec('COMING UP', B.books.length, B.books.length ? B.books.map(b => '<div class="li"><div><b>' + esc(b.name) + '</b><span>' + esc(C.slotText(b, ST.settings.tz)) + (b.test ? ' · TEST' : '') + '</span></div></div>').join('') : '<div class="small">No sessions booked yet.</div>');
  h += sec('JOBS STUCK', B.jobs.length, B.jobs.length ? B.jobs.map(j => '<div class="li"><div><b>' + esc(j.title) + '</b><span>' + esc(j.status) + '</span></div></div>').join('') : '<div class="small">Every job is running.</div>');
  h += sec('DONE TODAY', B.done.length, B.done.length ? B.done.slice(-8).reverse().map(x => '<div class="li"><div><b>' + esc(x.txt) + '</b><span>' + ago(x.at) + '</span></div></div>').join('') : '<div class="small">Nothing yet today.</div>');
  h += '<div class="row2">' + (ST.settings.live ? '<button class="btn" id="chk">CHECK INBOX NOW</button>' : '<button class="btn" id="sample">TRY A SAMPLE INQUIRY</button>') + '<button class="btn ghost" id="say">▶ HEAR IT</button></div>';
  return h
}
function inboxHTML(B) {
  const T = ST.threads || [], grp = [['NEEDS YOU', T.filter(t => t.needsYou && !['closed', 'lost'].includes(t.status))], ['WAITING ON THEM', T.filter(t => !t.needsYou && ['offered', 'replied'].includes(t.status))], ['BOOKED', T.filter(t => t.status === 'booked')], ['NEW', T.filter(t => !t.needsYou && t.status === 'new')], ['DONE', T.filter(t => ['closed', 'lost'].includes(t.status))]];
  return grp.filter(g => g[1].length).map(g => '<div class="card"><div class="ey">' + g[0] + ' · ' + g[1].length + '</div>' + g[1].slice(0, 40).map(t => '<button class="li tl" data-th="' + t.id + '"><div><b>' + esc(t.name || t.email) + '</b><span>' + esc((t.needsYou ? t.needsWhy : t.subject) || '') + ' · ' + ago(t.lastIn || t.created) + '</span></div><em class="k ' + t.kind + '">' + t.kind.toUpperCase() + '</em></button>').join('') + '</div>').join('') || '<div class="card"><div class="small">Nothing here yet.' + (ST.settings.live ? ' Tap CHECK INBOX NOW on TODAY.' : ' Tap TRY A SAMPLE INQUIRY on TODAY.') + '</div></div>'
}
function threadSheet(id) {
  const t = ST.threads.find(x => x.id === id); if (!t) return; const pend = t.msgs.slice().reverse().find(m => m.dir === 'out' && ['draft', 'approval', 'failed', 'check'].includes(m.status));
  sheet('<div class="ey">' + t.kind.toUpperCase() + ' · ' + esc(t.status.toUpperCase()) + '</div><h2>' + esc(t.name || t.email) + '</h2><div class="small">' + esc(t.email) + '</div>'
    + (t.needsYou ? '<div class="why">' + esc(t.needsWhy) + '</div>' : '')
    + '<div class="msgs">' + t.msgs.map(m => '<div class="msg ' + m.dir + '"><span>' + (m.dir === 'in' ? 'THEM' : 'YOU') + ' · ' + when(m.at) + (m.dir === 'out' ? ' · ' + ({ draft: 'DRAFT', approval: 'WAITING FOR YOU', sending: 'SENDING', sent: 'SENT', test: 'TEST · NOT SENT', failed: 'FAILED', check: 'CHECK GMAIL' })[m.status] : '') + '</span><p>' + esc(m.body) + '</p></div>').join('') + '</div>'
    + (pend ? '<label for="dr">' + (pend.status === 'check' ? 'NOT SURE THIS WENT OUT · LOOK IN GMAIL SENT FIRST' : 'THE DRAFT · EDIT ANYTHING') + '</label><textarea id="dr" rows="9">' + esc(pend.body) + '</textarea><div class="row2"><button class="btn" id="dSend">' + (pend.status === 'check' ? 'IT DIDN’T GO · SEND' : ST.settings.live ? 'SEND IT' : 'SEND (TEST)') + '</button><button class="btn ghost" id="dDrop">' + (pend.status === 'check' ? 'IT WENT · MARK SENT' : 'DISCARD') + '</button></div>' : '')
    + (t.status === 'picked' && t.pick ? '<button class="btn" id="dBook">BOOK ' + esc(C.slotText(t.pick, ST.settings.tz).toUpperCase()) + '</button>' : '')
    + (!ST.settings.live ? '<label for="sim">TEST: REPLY AS ' + esc((t.name || t.email).toUpperCase()) + '</label><textarea id="sim" rows="2" placeholder="The second one works"></textarea><button class="btn ghost" id="simGo">SEND AS THEM (TEST)</button>' : '')
    + '<div class="row2"><button class="btn ghost" id="tClose">' + (['closed', 'lost'].includes(t.status) ? 'REOPEN' : 'CLOSE IT') + '</button><button class="btn ghost" data-x>BACK</button></div>', () => {
      if ($('dSend')) $('dSend').onclick = async () => { const body = $('dr').value.trim(); if (!body) return; pend.body = body; pend.status = 'sending'; const a = { type: 'send', thread: t.id, msg: pend.id, to: t.email, subject: pend.subject || ('Re: ' + (t.subject || '')), body, test: !ST.settings.live, gThread: t.gThread }; $('dSend').disabled = true; await act(a); C.logIt(ST, 'You approved a reply to ' + (t.name || t.email), 'you', now()); save(); xp(); close(); draw(); toast(ST.settings.live ? 'SENT' : 'TEST · IN THE OUTBOX') };
      if ($('dDrop')) $('dDrop').onclick = () => { if (pend.status === 'check') { pend.status = 'sent'; t.lastOut = now() } else t.msgs = t.msgs.filter(m => m !== pend); t.needsYou = false; t.needsWhy = ''; save(); close(); draw() };
      if ($('dBook')) $('dBook').onclick = async () => { await act({ type: 'book', thread: t.id, slot: t.pick, key: 'book-' + t.id + '-' + t.pick.start, test: !ST.settings.live }); save(); xp(); close(); draw(); toast(t.status === 'booked' ? 'BOOKED' : 'THAT TIME IS TAKEN') };
      if ($('simGo')) $('simGo').onclick = async () => { const b = $('sim').value.trim(); if (!b) return; close(); await run([{ id: 'sim-' + now(), from: t.email, fromName: t.name, subject: 'Re: ' + (t.subject || ''), body: b, at: now() }]); threadSheet(id) };
      $('tClose').onclick = () => { t.status = ['closed', 'lost'].includes(t.status) ? 'new' : 'closed'; t.needsYou = false; save(); close(); draw() }
    })
}
function jobsHTML() {
  const lv = (job) => C.ruleFor(ST.rules, job, now()).level;
  let h = '<div class="card"><div class="ey">HOW MUCH BIZ DOES ON ITS OWN</div><div class="small">Pick a level for each job. Money questions, new promises, unclear answers and anything not in KNOW always come back to you.</div>'
    + Object.keys(C.JOBS).map(j => '<div class="job"><b>' + esc(C.JOBS[j]) + '</b><div class="lv3">' + Object.keys(C.LEVELS).map(l => '<button data-rule="' + j + '|' + l + '" class="' + (lv(j) === l ? 'on' : '') + '">' + ({ draft: 'DRAFT', approve: 'ASK ME', auto: 'JUST DO IT' })[l] + '</button>').join('') + '</div>' + (j === 'follow_up' ? '<div class="small">After <select id="fuD">' + [2, 3, 4, 5, 7].map(d => '<option' + ((C.ruleFor(ST.rules, 'follow_up').days || 3) === d ? ' selected' : '') + '>' + d + '</option>').join('') + '</select> quiet days · up to 2 times</div>' : '') + '</div>').join('') + '</div>';
  h += '<div class="card"><div class="ey">RECURRING JOBS</div>' + (ST.jobs || []).map(j => '<div class="li"><div><b>' + esc(j.title) + '</b><span>' + esc(j.every) + ' · ' + (j.paused ? 'PAUSED' : esc(j.status)) + (j.last ? ' · last ' + ago(j.last) : '') + (ST.settings.live ? '' : ' · runs on the server once you go LIVE') + '</span></div><button class="pill" data-pause="' + j.id + '">' + (j.paused ? 'RESUME' : 'PAUSE') + '</button></div>').join('') + '</div>';
  h += '<div class="card"><div class="ey">ACTIVITY</div>' + ((ST.log || []).slice(-25).reverse().map(x => '<div class="li"><div><b>' + esc(x.txt) + '</b><span>' + when(x.at) + '</span></div></div>').join('') || '<div class="small">Nothing yet.</div>') + '</div>';
  if (!ST.settings.live && (ST.outbox || []).length) h += '<div class="card"><div class="ey">TEST OUTBOX · NEVER SENT</div>' + ST.outbox.slice(-10).reverse().map(o => '<details class="ob"><summary><b>To ' + esc(o.to) + '</b> · ' + esc(o.subject || '') + '</summary><p>' + esc(o.body) + '</p></details>').join('') + '</div>';
  return h
}
const KEYS = [['services', 'What you offer'], ['pricing', 'Current prices'], ['location', 'Where'], ['ages', 'Who you train'], ['policy', 'Cancel policy'], ['booking_link', 'Booking link'], ['signature', 'How you sign off']];
function knowHTML() {
  return '<div class="card"><div class="ey">WHAT BIZ KNOWS</div><div class="small">Replies use only what’s here. Each fact keeps where it came from and the date it starts, so an old price never goes out.</div>'
    + KEYS.map(k => { const f = C.fact(ST.kb, k[0]), later = (ST.kb || []).filter(x => x.key === k[0] && x.effective && Date.parse(x.effective) > now()); return '<button class="li tl" data-kb="' + k[0] + '"><div><b>' + k[1] + '</b><span>' + (f ? esc(String(f.value).slice(0, 90)) + (f.source ? ' · from ' + esc(f.source) : '') + (f.effective ? ' · since ' + esc(f.effective) : '') : '<i>Not on file - Biz will ask you</i>') + (later.length ? ' · changes ' + esc(later[0].effective) : '') + '</span></div><em class="k">' + (f ? 'EDIT' : 'ADD') + '</em></button>' }).join('') + '</div>'
}
function kbSheet(key) {
  const k = KEYS.find(x => x[0] === key), f = C.fact(ST.kb, key), today = new Date().toISOString().slice(0, 10);
  sheet('<h2>' + k[1] + '</h2><label for="kV">WHAT TO SAY</label><textarea id="kV" rows="4">' + esc(f ? f.value : '') + '</textarea><div class="two"><div><label for="kS">WHERE IT CAME FROM</label><input id="kS" type="text" maxlength="40" value="' + esc(f ? f.source || 'Coach E' : 'Coach E') + '"></div><div><label for="kE">STARTS</label><input id="kE" type="date" value="' + today + '"></div></div><div class="small">A new price that starts later is kept until that day. Today’s stays in use until then.</div><p class="err" id="kErr"></p><button class="btn" id="kGo">SAVE</button>' + (f ? '<button class="btn ghost" id="kOff">STOP USING THIS</button>' : '') + '<button class="btn ghost" data-x>CANCEL</button>', () => {
    $('kGo').onclick = () => { const v = $('kV').value.trim(); if (!v) return $('kErr').textContent = 'Type what Biz should say.'; ST.kb = (ST.kb || []).concat([{ key, value: v.slice(0, 800), source: $('kS').value.trim().slice(0, 40), effective: $('kE').value || today, at: now() }]); save(); close(); draw(); toast('SAVED') };
    if ($('kOff')) $('kOff').onclick = () => { ST.kb.forEach(x => { if (x.key === key) x.retired = now() }); save(); close(); draw() } })
}
function setupHTML() {
  const S2 = ST.settings, D = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  return '<div class="card"><div class="ey">WHEN YOU TAKE SESSIONS · ' + esc(S2.tz) + '</div>' + D.map((d, i) => { const h = (S2.hours || {})[i]; return '<div class="hr"><button class="day ' + (h ? 'on' : '') + '" data-day="' + i + '">' + d + '</button>' + (h ? '<input type="time" data-h0="' + i + '" value="' + h[0] + '"><span>to</span><input type="time" data-h1="' + i + '" value="' + h[1] + '">' : '<span class="small">off</span>') + '</div>' }).join('')
    + '<div class="three"><div><label for="sL">SESSION (MIN)</label><input id="sL" type="number" value="' + S2.slotMin + '"></div><div><label for="sB">BUFFER</label><input id="sB" type="number" value="' + S2.bufferMin + '"></div><div><label for="sN">NOTICE (H)</label><input id="sN" type="number" value="' + S2.noticeHours + '"></div></div><div class="small">Open times also skip anything on your Club schedule' + (U.google ? ' and Google Calendar' : '') + '. Clients only see the open times, never why a time is taken.</div></div>'
    + '<div class="card"><div class="ey">GMAIL + CALENDAR</div>' + (U.google ? '<div class="li"><div><b>' + esc(U.google.email) + '</b><span>Connected</span></div><span class="tag g">CONNECTED</span></div><button class="btn ghost" id="gOff">DISCONNECT</button>' : '<div class="small">Use the business Gmail (like your Club Rival Gmail). Biz reads new mail, drafts and sends replies, checks your calendar and books sessions. You can disconnect any time.</div><button class="btn" id="gOn">' + (U.user ? 'CONNECT GMAIL' : 'SIGN IN FIRST') + '</button>') + '</div>'
    + '<div class="card"><div class="ey">TEST MODE / LIVE</div><div class="small">' + (S2.live ? '<b>LIVE.</b> Rules set to JUST DO IT really send and book, every 15 minutes, even with the app closed.' : '<b>TEST MODE.</b> Nothing leaves. Sends go to the test outbox; bookings are marked TEST.') + '</div><button class="btn ' + (S2.live ? 'ghost' : '') + '" id="live">' + (S2.live ? 'BACK TO TEST MODE' : 'GO LIVE') + '</button></div>'
    + '<div class="card"><div class="ey">MORNING BRIEFING</div><div class="small">Sent to your own inbox at</div><input type="time" id="bAt" value="' + (S2.briefAt || '07:00') + '"><div class="small">Turn it on in JOBS › Morning briefing › JUST DO IT.</div></div>'
}
function wire() {
  const on = (id, f) => { const e = $(id); if (e) e.onclick = f };
  on('acct', acctSheet); document.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { U.view = b.dataset.tab; draw(); scrollTo(0, 0) });
  document.querySelectorAll('[data-th]').forEach(b => b.onclick = () => threadSheet(b.dataset.th));
  on('sample', sample); on('chk', checkInbox); on('say', speakBrief);
  document.querySelectorAll('[data-rule]').forEach(b => b.onclick = () => { const [job, level] = b.dataset.rule.split('|'); const old = C.ruleFor(ST.rules, job, now()); ST.rules = (ST.rules || []).map(r => r.job === job && !r.revoked ? Object.assign({}, r, { revoked: now() }) : r).concat([{ job, level, from: new Date().toISOString(), days: old.days, set: now() }]); C.logIt(ST, 'Rule: ' + C.JOBS[job] + ' → ' + C.LEVELS[level], 'you', now()); save(); draw() });
  if ($('fuD')) $('fuD').onchange = () => { const r = (ST.rules || []).find(x => x.job === 'follow_up' && !x.revoked); if (r) r.days = +$('fuD').value; else ST.rules.push({ job: 'follow_up', level: 'draft', days: +$('fuD').value, from: new Date().toISOString() }); save() };
  document.querySelectorAll('[data-pause]').forEach(b => b.onclick = () => { const j = ST.jobs.find(x => x.id === b.dataset.pause); j.paused = !j.paused; C.logIt(ST, (j.paused ? 'Paused: ' : 'Resumed: ') + j.title, 'you', now()); save(); draw() });
  document.querySelectorAll('[data-kb]').forEach(b => b.onclick = () => kbSheet(b.dataset.kb));
  document.querySelectorAll('[data-day]').forEach(b => b.onclick = () => { const i = b.dataset.day; ST.settings.hours = ST.settings.hours || {}; if (ST.settings.hours[i]) delete ST.settings.hours[i]; else ST.settings.hours[i] = ['15:00', '20:00']; save(); draw() });
  document.querySelectorAll('[data-h0],[data-h1]').forEach(e => e.onchange = () => { const i = e.dataset.h0 || e.dataset.h1, k = e.dataset.h0 ? 0 : 1; ST.settings.hours[i][k] = e.value; save() });
  [['sL', 'slotMin'], ['sB', 'bufferMin'], ['sN', 'noticeHours']].forEach(([id, k]) => { const e = $(id); if (e) e.onchange = () => { ST.settings[k] = Math.max(0, +e.value || 0); save() } });
  if ($('bAt')) $('bAt').onchange = () => { ST.settings.briefAt = $('bAt').value; save() };
  on('gOn', async () => { if (!U.user) return signIn(); if (window.Capacitor) return sheet('<h2>Connect Gmail in Safari</h2><div class="small">Google doesn’t allow its sign-in inside apps. Open <b>mybizrival.netlify.app</b> in Safari, sign in with the same email, and tap CONNECT GMAIL there. This app uses it right after.</div><button class="btn ghost" data-x>OK</button>'); const r = await api('google-start'); if (r.url) location.href = r.url; else toast(gWhy(r)) });
  /* BZ004 · say exactly what's missing */
  function gWhy(r) { return r.error === 'google-not-configured' ? 'ADD GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET IN NETLIFY, THEN TRIGGER DEPLOY' : r.error === 'not-configured' ? 'ADD SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY IN NETLIFY (mybizrival), THEN TRIGGER DEPLOY' : r.error === 'bad reply' ? 'THE BIZ SERVER ISN’T RUNNING · BIZ HAS TO GO UP THROUGH GITHUB, NOT DRAG-AND-DROP' : r.error === 'not-signed-in' ? 'SIGN IN AGAIN' : 'COULDN’T START · ' + String(r.error || '').toUpperCase() }
  on('gOff', async () => { await api('google-off'); U.google = null; ST.settings.live = false; save(); draw(); toast('GMAIL DISCONNECTED · BACK IN TEST MODE') });
  on('live', () => { if (ST.settings.live) { ST.settings.live = false; C.logIt(ST, 'Switched to TEST MODE', 'you', now()); save(); draw(); return }
    if (!U.google) { toast('CONNECT GMAIL FIRST'); return }
    const auto = Object.keys(C.JOBS).filter(j => C.ruleFor(ST.rules, j, now()).level === 'auto').map(j => C.JOBS[j]);
    sheet('<h2>Go live?</h2><div class="small">Biz will use <b>' + esc(U.google.email) + '</b>.<br><br>' + (auto.length ? 'These will happen on their own:<br>• ' + auto.map(esc).join('<br>• ') : 'Nothing is set to JUST DO IT, so Biz will only draft. You send.') + '<br><br>Money, new promises and anything not in KNOW still come to you.</div><button class="btn" id="lvY">YES, GO LIVE</button><button class="btn ghost" data-x>NOT YET</button>', () => { $('lvY').onclick = () => { ST.settings.live = true; C.logIt(ST, 'Switched to LIVE', 'you', now()); save(); close(); draw(); toast('LIVE') } }) });
}
/* ---------- test mode: real-looking inquiries, so the whole loop can be watched without touching real clients ---------- */
const SAMPLES = [
  { from: 'jen.sample@example.com', fromName: 'Jen (sample)', subject: 'Speed training for my son', body: 'Hi! My son is 12 and plays football. How much are sessions and when do you have openings?' },
  { from: 'marcus.sample@example.com', fromName: 'Marcus (sample)', subject: 'Lessons?', body: 'Do you train adults? Looking to get faster for flag football. Where are you located?' },
  { from: 'deals@example-shop.com', fromName: 'Shop', subject: 'Sale ends tonight', body: 'Unsubscribe anytime. 40% off everything.' },
  { from: 'pat.sample@example.com', fromName: 'Pat (sample)', subject: 'Charge question', body: 'I think I was charged twice last month, can you check?' },
];
async function sample() { const i = (ST.sampleN || 0) % SAMPLES.length; ST.sampleN = (ST.sampleN || 0) + 1; await run([Object.assign({ id: 'sample-' + now(), at: now() }, SAMPLES[i])]); toast('SAMPLE INQUIRY IN · ' + SAMPLES[i].fromName.toUpperCase()) }
function speakBrief() { const B = C.brief(ST, now()); const t = ['Here is the business.', B.needs.length ? B.needs.length + ' need you.' : 'Nothing needs you.', B.waiting.length ? B.waiting.length + ' new leads waiting.' : '', B.books.length ? 'Next session, ' + B.books[0].name + ', ' + C.slotText(B.books[0], ST.settings.tz) + '.' : '', B.done.length ? B.done.length + ' things done today.' : ''].filter(Boolean).join(' '); try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(t); speechSynthesis.speak(u) } catch (e) { toast(t) } }
/* ---------- account ---------- */
function signIn() {
  sheet('<h2>Sign in</h2><div class="small">Same sign-in as Club Rival and every Rival app. We email you a 6-digit code.</div><label for="em">EMAIL</label><input id="em" type="email" autocomplete="email"><p class="err" id="sErr"></p><button class="btn" id="sGo">EMAIL ME A CODE</button><button class="btn ghost" data-x>CANCEL</button>', () => {
    $('sGo').onclick = async () => { const em = $('em').value.trim(); if (!/^\S+@\S+\.\S+$/.test(em)) return $('sErr').textContent = 'Put in your email.'; try { const { error } = await SB.auth.signInWithOtp({ email: em, options: { shouldCreateUser: true } }); if (error) throw error } catch (e) { return $('sErr').textContent = 'Couldn’t send: ' + (e.message || e) }
      sheet('<h2>Check your email</h2><label for="cd">CODE</label><input id="cd" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="8"><p class="err" id="cErr"></p><button class="btn" id="cGo">SIGN IN</button>', () => { $('cGo').onclick = async () => { try { const { data, error } = await SB.auth.verifyOtp({ email: em, token: $('cd').value.replace(/\D/g, ''), type: 'email' }); if (error) throw error; U.user = data.user || data.session.user; close(); await afterSignIn(); toast('SIGNED IN') } catch (e) { $('cErr').textContent = 'That code didn’t work.' } } }) } })
}
async function afterSignIn() { const mine = ST; await pull(); if (!U.rev && mine.threads.length) { ST = mine; save() } const s = await api('status'); U.google = s.google || null; U.configured = !!s.configured; if (!U.google && ST.settings.live) { ST.settings.live = false; save() } draw() }
function acctSheet() {
  if (!U.user) return signIn(); let p = 'auto'; try { p = localStorage.getItem('bz_theme') || 'auto' } catch (e) { }
  sheet('<h2>Account</h2><div class="small">Signed in as <b>' + esc(U.user.email || '') + '</b></div><label>LOOK</label><div class="thm">' + [['auto', 'AUTO'], ['light', 'LIGHT'], ['dark', 'DARK']].map(x => '<button data-thm="' + x[0] + '" class="' + (p === x[0] ? 'on' : '') + '">' + x[1] + '</button>').join('') + '</div><button class="btn ghost" id="out">SIGN OUT</button><button class="btn ghost" data-x>CLOSE</button><button class="btn ghost" id="rvDelAcct" style="color:#e0703a">DELETE MY ACCOUNT</button>', () => {if(document.getElementById('rvDelAcct'))document.getElementById('rvDelAcct').onclick=function(){if(window.RivalOrb&&RivalOrb.deleteAccount)RivalOrb.deleteAccount(SB);else alert('One second, then try again.')};
    document.querySelectorAll('[data-thm]').forEach(b => b.onclick = () => { window.bzTheme(b.dataset.thm); document.querySelectorAll('[data-thm]').forEach(x => x.classList.toggle('on', x === b)) });
    $('out').onclick = async () => { try { await SB.auth.signOut() } catch (e) { } U.user = null; U.rev = 0; U.google = null; close(); draw() } })
}
async function boot() {
  draw(); if (!SB) return;
  try { const { data } = await SB.auth.getSession(); U.user = data && data.session && data.session.user || null } catch (e) { }
  if (U.user) await afterSignIn();
  const g = new URLSearchParams(location.search).get('google'); if (g) { history.replaceState(null, '', location.pathname); toast(g === 'ok' ? 'GMAIL CONNECTED · STILL IN TEST MODE UNTIL YOU GO LIVE' : g === 'no-refresh' ? 'GOOGLE DIDN’T GIVE LASTING ACCESS · DISCONNECT BIZ IN GOOGLE AND TRY AGAIN' : 'GMAIL DIDN’T CONNECT · ' + g.toUpperCase()) }
  draw()
}
window.BZ = { get ST() { return ST }, set ST(v) { ST = v }, U, run, act, draw, sample, C, save };
boot();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => { });
