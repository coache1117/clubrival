/* BIZ RIVAL · biz-core · BZ001
   The rules of the assistant, in one file. The app (in the browser) and the Netlify jobs (on the server, every 15 minutes) both use THIS
   file, so test mode and live mode make exactly the same decisions.
   Nothing in here sends, books or posts. It decides; the caller does, and records proof.
   Messages from outside are DATA. Nothing written in an email can change a rule, grant a permission, or pull other records. */

export const VERSION = 'BZ001';
const MIN = 60000, DAY = 864e5;

/* ---------- small helpers ---------- */
export const nid = (p) => (p || 'x') + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const low = (s) => String(s || '').toLowerCase();
export function firstName(nameOrEmail) {
  const s = String(nameOrEmail || '').trim();
  if (!s) return '';
  if (s.includes('@') && !s.includes(' ')) { const u = s.split('@')[0].split(/[._-]/)[0]; return u.charAt(0).toUpperCase() + u.slice(1).toLowerCase() }
  return s.split(/\s+/)[0].replace(/[^A-Za-z'’-]/g, '');
}

/* ---------- 1. sort what came in ---------- */
const K = {
  billing: /\b(invoice|receipt|refund|charge[ds]?|payment|paid|billing|venmo|zelle|card)\b/,
  scheduling: /\b(reschedul\w*|cancel\w*|move (my|our|the) (session|time|lesson)|running late|can'?t make it|change (my|the) time)\b/,
  lead: /\b(interested|info(rmation)?|how much|price|pricing|cost|rates?|sign (him|her|my|me|up)|enroll|try (a|out)|first (session|lesson|time)|start(ing)? training|do you (offer|have|train|coach)|looking for|my (son|daughter|kid|child)|lessons?|camp|clinic)\b/,
  ops: /\b(vendor|contract|insurance|rent|lease|w-?9|tax|order|shipment|delivery)\b/,
  low: /\b(unsubscribe|newsletter|webinar|promo(tion)?|% off|sale ends|no-?reply)\b/,
};
export function classify(msg, contacts) {
  const t = low((msg.subject || '') + ' ' + (msg.body || '')), from = low(msg.from);
  const known = (contacts || []).find(c => low(c.email) === from);
  let kind = 'low';
  if (/no-?reply|mailer-daemon|notifications?@/.test(from) || K.low.test(t)) kind = 'low';
  else if (K.billing.test(t)) kind = 'billing';
  else if (K.scheduling.test(t)) kind = 'scheduling';
  else if (K.lead.test(t) || /\?/.test(t)) kind = known && known.client ? 'client' : 'lead';
  else if (K.ops.test(t)) kind = 'ops';
  else if (known) kind = known.client ? 'client' : 'lead';
  const asks = [];
  if (/\b(how much|price|pricing|cost|rates?)\b/.test(t)) asks.push('price');
  if (/\b(when|times?|available|availability|schedule|book|slot|open)\b/.test(t)) asks.push('times');
  if (/\b(where|location|address|located)\b/.test(t)) asks.push('location');
  if (/\b(age|ages|how old|years? old)\b/.test(t)) asks.push('ages');
  if (/\b(cancel\w*|refund policy|policy)\b/.test(t)) asks.push('policy');
  return { kind, asks, known: !!known };
}

/* ---------- 2. the knowledge base: only facts on file, each with where it came from and since when ---------- */
export function fact(kb, key, now) {
  const f = (kb || []).filter(x => x.key === key && (!x.effective || Date.parse(x.effective) <= (now || Date.now())) && !x.retired)
    .sort((a, b) => String(b.effective || '').localeCompare(String(a.effective || '')))[0];
  return f && String(f.value || '').trim() ? f : null;
}

/* ---------- 3. open times: working hours, length, buffer, minimum notice, never on top of anything busy or held ---------- */
/* settings.hours = {1:['15:00','20:00'], ...} (0 = Sunday). Times are this business's local clock (settings.tz is shown, the caller's
   clock must be in the same zone). busy = [{start,end}] from the calendar / the Club schedule. Reasons are never passed along. */
export function freeSlots(settings, busy, holds, from, days, max) {
  const st = settings || {}, len = (+st.slotMin || 60) * MIN, buf = (+st.bufferMin || 15) * MIN, notice = (+st.noticeHours || 12) * 3600e3;
  const B = (busy || []).concat((holds || []).filter(h => h.status !== 'released').map(h => ({ start: +new Date(h.starts_at || h.start), end: +new Date(h.ends_at || h.end) })));
  const out = [], d0 = new Date(from); d0.setHours(0, 0, 0, 0);
  for (let i = 0; i < (days || 7) && out.length < (max || 6); i++) {
    const d = new Date(d0); d.setDate(d.getDate() + i); const h = (st.hours || {})[d.getDay()]; if (!h || !h[0] || !h[1]) continue;
    const at = (hm) => { const [H, M] = hm.split(':').map(Number); const x = new Date(d); x.setHours(H, M, 0, 0); return x.getTime() };
    for (let t = at(h[0]); t + len <= at(h[1]) && out.length < (max || 6); t += len + buf) {
      if (t < from + notice) continue;
      if (B.some(b => t < b.end + buf && b.start - buf < t + len)) continue;
      out.push({ start: t, end: t + len });
    }
  }
  /* spread them out: at most 2 a day so the client gets real choices */
  const per = {}; return out.filter(s => { const k = new Date(s.start).toDateString(); per[k] = (per[k] || 0) + 1; return per[k] <= 2 }).slice(0, 3);
}
export const slotText = (s, tz) => new Date(s.start).toLocaleString('en-US', { weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', ...(tz ? { timeZone: tz } : {}) });

/* ---------- 4. which offered time did they pick? (nothing is booked from a guess: unclear = ask Coach E) ---------- */
export function parsePick(text, offered) {
  const t = low(text); if (!offered || !offered.length) return null;
  if (/\b(none|neither|no(ne)? of (those|these)|doesn'?t work|don'?t work|other times?)\b/.test(t)) return { none: true };
  const ord = [/\b(first|1st|#1|option 1|the 1)\b/, /\b(second|2nd|#2|option 2)\b/, /\b(third|3rd|#3|option 3)\b/];
  const byOrd = ord.map((r, i) => r.test(t) ? i : -1).filter(i => i >= 0 && i < offered.length);
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const hits = offered.map((s, i) => {
    const d = new Date(s.start), dn = days[d.getDay()], hr = d.getHours() % 12 || 12;
    const dayHit = t.includes(dn) || t.includes(dn.slice(0, 3) + ' ') || t.includes(dn.slice(0, 3) + '.');
    const hrHit = new RegExp('\\b' + hr + '(:' + String(d.getMinutes()).padStart(2, '0') + ')?\\s*(am|pm|a\\.m|p\\.m|o\'?clock)?\\b').test(t);
    return { i, score: (dayHit ? 2 : 0) + (hrHit ? 1 : 0) };
  }).filter(h => h.score >= 2 || (h.score === 1 && offered.length === 1));
  const cands = new Set(byOrd.concat(hits.filter(h => h.score === Math.max(...hits.map(x => x.score))).map(h => h.i)));
  if (cands.size === 1) return { slot: offered[[...cands][0]] };
  if (cands.size > 1) return { unclear: true };
  if (/\b(yes|works|perfect|sounds good|that'?s fine|great)\b/.test(t) && offered.length === 1) return { slot: offered[0] };
  return null;
}

/* ---------- 5. the reply: written ONLY from facts on file. Anything it can't answer goes to Coach E instead of being guessed. ---------- */
export function draftReply({ thread, msg, kb, slots, tz, signer }) {
  const c = classify(msg, []), name = firstName(msg.fromName || msg.from), L = [], needs = [], used = [];
  const add = (k) => { const f = fact(kb, k); if (f) used.push({ key: k, source: f.source || '', effective: f.effective || '' }); return f };
  L.push('Hi' + (name ? ' ' + name : '') + ',');
  if (thread && thread.kind === 'scheduling') {
    L.push('Thanks for the heads-up.');
    if (slots && slots.length) { L.push('Here are the next open times:'); slots.forEach((s, i) => L.push((i + 1) + ') ' + slotText(s, tz))); L.push('Reply with the one that works and I’ll lock it in.') }
    else needs.push('No open times in the next 2 weeks - pick some to offer.');
  } else {
    const svc = add('services'); L.push('Thanks for reaching out' + (svc ? '.' : ' - happy to help.'));
    if (svc) L.push(String(svc.value));
    if (c.asks.includes('price')) { const p = add('pricing'); if (p) L.push(String(p.value)); else needs.push('They asked about price and there is no current price on file.') }
    if (c.asks.includes('location')) { const p = add('location'); if (p) L.push(String(p.value)); else needs.push('They asked where - add your location.') }
    if (c.asks.includes('ages')) { const p = add('ages'); if (p) L.push(String(p.value)); else needs.push('They asked about ages - add who you train.') }
    if (c.asks.includes('policy')) { const p = add('policy'); if (p) L.push(String(p.value)); else needs.push('They asked about your policy - add it.') }
    if (slots && slots.length) { L.push('Here are a few open times for a first session:'); slots.forEach((s, i) => L.push((i + 1) + ') ' + slotText(s, tz))); L.push('Reply with the one that works and I’ll lock it in.') }
    else { const bl = add('booking_link'); if (bl) L.push('You can grab a time here: ' + bl.value); else needs.push('No open times to offer and no booking link on file.') }
  }
  L.push(''); L.push(signer || (fact(kb, 'signature') || {}).value || 'Coach E');
  return { body: L.join('\n'), needs, used, offered: slots || [] };
}

/* ---------- 6. delegation: draft / ask first / just do it - and the line nothing crosses ---------- */
export const LEVELS = { draft: 'Draft for my review', approve: 'Ask me first', auto: 'Just do it' };
export const JOBS = {
  reply_routine: 'Answer routine questions with what’s on file',
  offer_times: 'Offer open times',
  book: 'Book the time they pick',
  follow_up: 'Follow up when they go quiet',
  daily_brief: 'Morning briefing',
};
export function ruleFor(rules, job, now) {
  const r = (rules || []).find(x => x.job === job && !x.revoked && (!x.from || Date.parse(x.from) <= (now || Date.now())) && (!x.until || Date.parse(x.until) > (now || Date.now())));
  return r || { job, level: 'draft' };
}
/* returns 'send' | 'approve' | 'draft', and WHY when it has to come back to Coach E */
export function decide({ rules, job, draft, thread, live, now }) {
  const r = ruleFor(rules, job, now), why = [];
  if (draft && draft.needs && draft.needs.length) why.push(...draft.needs);
  if (thread && thread.flag) why.push(thread.flag);
  if (r.max && thread && (thread.autoSent || 0) >= r.max) why.push('Hit the limit of ' + r.max + ' automatic messages on this thread.');
  if (r.kinds && thread && !r.kinds.includes(thread.kind)) why.push('This rule only covers ' + r.kinds.join(', ') + '.');
  if (!thread || !thread.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(thread.email)) why.push('Not sure who this goes to.');
  if (why.length) return { act: 'approve', why, rule: r };
  if (r.level === 'auto') return { act: live ? 'send' : 'send-test', why: [], rule: r };
  return { act: r.level === 'approve' ? 'approve' : 'draft', why: r.level === 'approve' ? ['Your rule: ask me first.'] : [], rule: r };
}

/* ---------- 7. follow-ups ---------- */
export function followDue(thread, rules, now) {
  if (!thread || ['booked', 'closed', 'lost'].includes(thread.status)) return false;
  const r = ruleFor(rules, 'follow_up', now), days = +r.days || 3, tries = +r.tries || 2;
  if (!thread.lastOut || (thread.lastIn && thread.lastIn > thread.lastOut)) return false;
  if ((thread.follows || 0) >= tries) return false;
  return now - thread.lastOut >= days * DAY;
}
export function followText(thread, kb) {
  const n = firstName(thread.name || thread.email);
  return 'Hi' + (n ? ' ' + n : '') + ',\n\nJust checking back on this. ' + (thread.offered && thread.offered.length ? 'Those times are still open for now, or tell me what works better.' : 'Happy to answer anything or find a time that works.') + '\n\n' + ((fact(kb, 'signature') || {}).value || 'Coach E');
}

/* ---------- 8. the briefing: what got done, what needs you, who's waiting, what's coming, what's stuck, what's next ---------- */
export function brief(state, now) {
  const T = state.threads || [], d0 = new Date(now); d0.setHours(0, 0, 0, 0); const today = d0.getTime();
  const log = (state.log || []).filter(x => x.at >= today);
  const needs = T.filter(t => t.needsYou && !['closed', 'lost'].includes(t.status));
  const waiting = T.filter(t => t.kind === 'lead' && t.status === 'new');
  const books = (state.bookings || []).filter(b => b.start >= now && b.status !== 'canceled').sort((a, b) => a.start - b.start);
  const jobs = (state.jobs || []).filter(j => ['Blocked', 'Failed', 'Waiting for approval'].includes(j.status));
  const next = [];
  needs.slice(0, 2).forEach(t => next.push('Answer: ' + (t.name || t.email) + ' - ' + (t.needsWhy || 'needs you')));
  if (books[0]) next.push('Next session: ' + (books[0].name || 'client') + ' · ' + slotText(books[0], state.settings && state.settings.tz));
  waiting.slice(0, 1).forEach(t => next.push('New lead waiting: ' + (t.name || t.email)));
  return { done: log, needs, waiting, books: books.slice(0, 5), jobs, next: next.slice(0, 3) };
}

/* ---------- 9. THE LOOP: new mail in -> sorted -> answered / offered / booked / followed up -> logged.
   Pure: takes the state and what came in, returns the new state plus the ACTIONS the caller must carry out (send / book).
   A message waiting on an action is marked 'sending' with a fixed key, so it is never sent twice, even if the caller crashes. ---------- */
export function blankState(tz) {
  return { v: 1, settings: { tz: tz || 'America/New_York', hours: { 1: ['15:00', '20:00'], 2: ['15:00', '20:00'], 3: ['15:00', '20:00'], 4: ['15:00', '20:00'], 6: ['09:00', '13:00'] }, slotMin: 60, bufferMin: 15, noticeHours: 12, live: false, briefAt: '07:00', signer: 'Coach E' },
    kb: [], rules: [], contacts: [], threads: [], bookings: [], log: [], outbox: [], seen: {},
    jobs: [{ id: 'inbox', title: 'Check the inbox + follow-ups', every: '15 min', status: 'Scheduled', last: null, next: null, paused: false }, { id: 'daily_brief', title: 'Morning briefing', every: 'daily', status: 'Scheduled', last: null, next: null, paused: false }] };
}
const OPEN = (t) => !['closed', 'lost', 'booked'].includes(t.status);
export function logIt(st, txt, kind, now) { st.log = (st.log || []).concat([{ at: now, txt, kind: kind || 'did' }]).slice(-300) }
function threadFor(st, m) {
  const em = low(m.from);
  return (st.threads || []).find(t => (m.gThread && t.gThread === m.gThread)) || (st.threads || []).find(t => low(t.email) === em && OPEN(t));
}
export function process(state, incoming, ctx) {
  const st = JSON.parse(JSON.stringify(state)), now = ctx.now, A = [];
  st.seen = st.seen || {}; st.threads = st.threads || []; st.contacts = st.contacts || [];
  const holds = (ctx.holds || []).concat((st.bookings || []).filter(b => b.status === 'booked').map(b => ({ start: b.start, end: b.end, status: 'booked' })));
  const offerNow = (except) => freeSlots(st.settings, ctx.busy || [], holds.concat(st.threads.filter(t => t !== except && t.status === 'offered').flatMap(t => (t.offered || []).map(s => ({ start: s.start, end: s.end, status: 'held' })))), now, 14);
  const queue = (t, job, body, subject, why) => {
    const key = 'msg-' + t.id + '-' + (t.msgs.length + 1);
    const d = decide({ rules: st.rules, job, draft: { needs: why || [] }, thread: t, live: !!st.settings.live, now });
    const msg = { id: key, key, dir: 'out', at: now, body, subject, job, status: d.act === 'send' || d.act === 'send-test' ? 'sending' : d.act === 'approve' ? 'approval' : 'draft', test: d.act !== 'send' };
    t.msgs.push(msg);
    if (msg.status === 'sending') { A.push({ type: 'send', thread: t.id, msg: key, to: t.email, subject, body, test: msg.test, gThread: t.gThread || null }); t.autoSent = (t.autoSent || 0) + 1 }
    else { t.needsYou = true; t.needsWhy = d.why && d.why.length ? d.why.join(' ') : 'A draft is ready for you to check.' }
    return msg;
  };
  for (const m of (incoming || []).sort((a, b) => a.at - b.at)) {
    if (st.seen[m.id]) continue; st.seen[m.id] = now;
    if (ctx.self && low(m.from) === low(ctx.self)) continue;
    const c = classify(m, st.contacts);
    let t = threadFor(st, m);
    if (!t) {
      if (c.kind === 'low') { logIt(st, 'Skipped (promo/no-reply): ' + (m.subject || m.from), 'skip', now); continue }
      t = { id: 't-' + String(m.id).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40), email: m.from, name: m.fromName || '', kind: c.kind, status: 'new', subject: m.subject || '', gThread: m.gThread || null, msgs: [], offered: [], follows: 0, autoSent: 0, created: now };
      st.threads.unshift(t);
      if (!st.contacts.some(x => low(x.email) === low(m.from))) st.contacts.push({ email: m.from, name: m.fromName || '', client: false, since: now });
    }
    t.msgs.push({ id: m.id, dir: 'in', at: m.at, body: String(m.body || '').slice(0, 4000), subject: m.subject || '', status: 'received' });
    t.lastIn = m.at; if (t.status === 'closed') t.status = 'new';
    if (t.kind === 'low' && c.kind !== 'low') t.kind = c.kind;
    const subj = /^re:/i.test(t.subject) ? t.subject : 'Re: ' + (t.subject || 'Your message');
    /* they answered our times */
    if (t.status === 'offered' && t.offered && t.offered.length) {
      const p = parsePick(m.body, t.offered);
      if (p && p.slot) { t.status = 'picked'; t.pick = p.slot; const d = decide({ rules: st.rules, job: 'book', draft: { needs: [] }, thread: t, live: !!st.settings.live, now });
        if (d.act === 'send' || d.act === 'send-test') A.push({ type: 'book', thread: t.id, slot: p.slot, key: 'book-' + t.id + '-' + p.slot.start, test: d.act !== 'send' });
        else { t.needsYou = true; t.needsWhy = 'They picked ' + slotText(p.slot, st.settings.tz) + '. Book it?' }
        logIt(st, (t.name || t.email) + ' picked ' + slotText(p.slot, st.settings.tz), 'did', now); continue }
      if (p && (p.unclear || p.none)) { const sl = offerNow(t); t.offered = sl; queue(t, 'offer_times', draftReply({ thread: { kind: 'scheduling' }, msg: m, kb: st.kb, slots: sl, tz: st.settings.tz }).body, subj, sl.length ? [] : ['No other open times in the next 2 weeks.']); if (p.unclear) { t.needsYou = true; t.needsWhy = 'Their answer could mean more than one time.' } continue }
    }
    if (['billing', 'ops'].includes(c.kind)) { t.needsYou = true; t.needsWhy = c.kind === 'billing' ? 'Billing: you handle money questions.' : 'Business item for you.'; continue }
    if (c.kind === 'low') { t.status = 'closed'; continue }
    const sl = offerNow(t), dr = draftReply({ thread: t, msg: m, kb: st.kb, slots: sl, tz: st.settings.tz, signer: st.settings.signer });
    t.offered = sl; queue(t, c.kind === 'scheduling' ? 'offer_times' : 'reply_routine', dr.body, subj, dr.needs); t.used = dr.used;
    if (sl.length) t.status = t.msgs[t.msgs.length - 1].status === 'sending' ? 'offered' : t.status;
  }
  /* follow-ups */
  st.threads.filter(t => followDue(t, st.rules, now) && !t.msgs.some(x => x.dir === 'out' && ['draft', 'approval', 'sending'].includes(x.status))).forEach(t => {
    const m = queue(t, 'follow_up', followText(t, st.kb), /^re:/i.test(t.subject) ? t.subject : 'Re: ' + (t.subject || 'Checking in'), []);
    t.follows = (t.follows || 0) + 1; if (m.status === 'sending') logIt(st, 'Follow-up going to ' + (t.name || t.email), 'did', now);
  });
  return { state: st, actions: A };
}
/* what the caller reports back after doing an action */
export function settle(state, action, result, now) {
  const st = JSON.parse(JSON.stringify(state)), t = (st.threads || []).find(x => x.id === action.thread);
  if (action.type === 'send' && t) {
    const m = t.msgs.find(x => x.id === action.msg); if (!m) return st;
    if (result.ok) { m.status = action.test ? 'test' : 'sent'; m.sentAt = now; m.proof = result.proof || null; t.lastOut = now; if (t.offered && t.offered.length && /\d\) /.test(m.body)) t.status = 'offered'; else if (t.status === 'new') t.status = 'replied'; t.needsYou = false; t.needsWhy = ''; logIt(st, (action.test ? 'TEST · would send to ' : 'Sent to ') + (t.name || t.email) + ': ' + (m.subject || ''), 'did', now) }
    else if (result.check) { m.status = 'check'; t.needsYou = true; t.needsWhy = 'Not sure the message went out (the connection dropped). It will not resend until checked.' }
    else { m.status = 'failed'; m.err = result.error || 'failed'; t.needsYou = true; t.needsWhy = 'Sending failed: ' + (result.error || 'unknown') }
  }
  if (action.type === 'book' && t) {
    if (result.ok) { const b = { id: action.key, thread: t.id, name: t.name || firstName(t.email), email: t.email, start: action.slot.start, end: action.slot.end, status: 'booked', test: !!action.test, proof: result.proof || null, at: now };
      if (!(st.bookings || []).some(x => x.id === b.id)) st.bookings = (st.bookings || []).concat([b]); t.status = 'booked'; t.needsYou = false; t.needsWhy = ''; t.offered = [];
      const c = (st.contacts || []).find(x => low(x.email) === low(t.email)); if (c) c.client = true;
      logIt(st, (action.test ? 'TEST · booked ' : 'Booked ') + b.name + ' · ' + slotText(b, st.settings.tz), 'did', now) }
    else if (result.taken) { t.status = 'offered'; t.needsYou = true; t.needsWhy = 'That time was just taken. Offer new times.' }
    else if (result.check) { t.needsYou = true; t.needsWhy = 'Not sure the booking went through. Check the calendar before trying again.' }
    else { t.needsYou = true; t.needsWhy = 'Booking failed: ' + (result.error || 'unknown') }
  }
  return st;
}
export function confirmText(b, st) { const n = firstName(b.name || b.email); return 'Hi' + (n ? ' ' + n : '') + ',\n\nYou’re booked: ' + slotText(b, st.settings.tz) + '.' + ((fact(st.kb, 'location') || {}).value ? '\n' + fact(st.kb, 'location').value : '') + ((fact(st.kb, 'policy') || {}).value ? '\n\n' + fact(st.kb, 'policy').value : '') + '\n\nSee you then,\n' + ((fact(st.kb, 'signature') || {}).value || st.settings.signer || 'Coach E') }
