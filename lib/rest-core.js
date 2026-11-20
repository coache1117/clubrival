/* REST RIVAL · rest-core.js · the scoring, rivals, streaks and XP rules. No screens in here, so every rule can be tested on its own.
   Everything that is a judgement call lives in CONFIG and is stamped with a version. These are first-build defaults from the
   Rest Rival spec (14 Nov 2026) - product rules for comparing you with yourself, NOT clinically validated sleep science. */
(function (root, make) { if (typeof module === 'object' && module.exports) module.exports = make(); else root.REST = make(); })(typeof self !== 'undefined' ? self : this, function () {
  var CONFIG = {
    scoringVersion: 'rest-v1',
    weights: { dur: 0.40, bed: 0.20, wake: 0.20, rested: 0.20 },   // the primary comparable outcome
    adherenceTolMin: 120,          // 0 points at 2 hours off plan, sliding
    streakTolMin: 30,              // "on schedule" for the streak: within 30 min for bed AND wake
    coverage: 0.70,                // need this share of comparable night pairs before an aggregate % is shown
    twoWeekAnchor: '2026-11-08',   // a Sunday. 14-day blocks are counted from here
    xp: { session: 10, rival: 100, perLevel: 500, maxLevel: 100 },
    clipKeepDays: 7,
    audio: { riseDb: 12, minMs: 400, mergeMs: 3000, floorWindow: 240 },   // a sound event = this far above the room's own floor
    motion: { rise: 0.9, minMs: 200, mergeMs: 5000 }                      // m/s^2 change on a phone lying on the mattress
  };
  var MIN = 60000, DAY = 86400000;
  function pad(n) { return (n < 10 ? '0' : '') + n }
  /* ---- local dates. A "sleep day" is a local calendar date, never a UTC one. ---- */
  function dayStr(ms) { var d = new Date(ms); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) }
  function dayDate(s) { var p = String(s).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]) }
  function addDays(s, n) { var d = dayDate(s); d.setDate(d.getDate() + n); return dayStr(d.getTime()) }
  function diffDays(a, b) { return Math.round((dayDate(b).getTime() - dayDate(a).getTime()) / DAY) }
  function daysBetween(a, b) { var out = [], d = a; while (d <= b) { out.push(d); d = addDays(d, 1) } return out }
  function hm(s) { var p = String(s || '0:0').split(':'); return (+p[0]) * 60 + (+p[1] || 0) }
  function at(day, clock) { var d = dayDate(day), m = hm(clock); d.setHours(Math.floor(m / 60), m % 60, 0, 0); return d.getTime() }   // a real instant, so DST is handled by the clock itself
  function sleepDayOf(wakeAt) { return dayStr(wakeAt) }   // default: the local date you finally woke up

  /* ---- plans. Versions never rewrite history: a night is scored with the plan that was in force for its day. ---- */
  function planFor(P, day) {
    var vs = (P && P.versions || []).filter(function (v) { return v.from <= day }).sort(function (a, b) { return a.from < b.from ? -1 : a.from > b.from ? 1 : a.v - b.v });
    var v = vs[vs.length - 1] || (P && P.versions && P.versions[0]); if (!v) return null;
    var wd = dayDate(day).getDay(), s = (v.sched && v.sched[wd]) || { bed: v.bed, wake: v.wake, on: true }, o = P.overrides && P.overrides[day];
    return { v: v.v, L: v.L, U: v.U, bed: (o && o.bed) || s.bed, wake: (o && o.wake) || s.wake, on: o && o.on != null ? !!o.on : s.on !== false, items: v.items || [], windMin: v.windMin || 30, override: !!o };
  }
  function planned(plan, day) {   // the planned instants for the sleep day `day` (the day you wake up)
    var wake = at(day, plan.wake), bedSame = at(day, plan.bed), bed = bedSame < wake ? bedSame : at(addDays(day, -1), plan.bed);
    return { bed: bed, wake: wake, wind: bed - (plan.windMin || 30) * MIN };
  }

  /* ---- the four utilities, 0-100. Progress against YOUR plan; not a sleep-quality diagnosis. ---- */
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)) }
  function durUtil(S, L, U) { if (!(L > 0) || !(U >= L) || S == null || !isFinite(S)) return null; if (S < L) return clamp(100 * S / L, 0, 100); if (S <= U) return 100; return clamp(100 * Math.max(0, 1 - (S - U) / L), 0, 100) }
  function adhUtil(devMin) { if (devMin == null || !isFinite(devMin)) return null; return 100 * clamp(1 - Math.abs(devMin) / CONFIG.adherenceTolMin, 0, 1) }
  function restedUtil(r) { r = +r; if (!(r >= 1 && r <= 5)) return null; return 25 * (r - 1) }
  function windUtil(done, plannedN) { if (!(plannedN > 0)) return null; return 100 * clamp(done / plannedN, 0, 1) }

  /* ---- one night. Observation time NEVER becomes sleep: no reported/estimated onset + final awakening = duration unknown. ---- */
  function sleepMin(n) {
    if (!n || n.onsetAt == null || n.wakeAt == null || !(n.wakeAt > n.onsetAt)) return { min: null, approx: false };
    var raw = (n.wakeAt - n.onsetAt) / MIN;   // real elapsed minutes between two instants: a clock change overnight cannot fool it
    if (n.awakeMin == null) return { min: raw, approx: true };
    return { min: Math.max(0, raw - (+n.awakeMin || 0)), approx: false };
  }
  function nightCalc(n, plan, dayForPlan) {
    var day = dayForPlan || n.day, p = planned(plan, day), s = sleepMin(n), bedRef = n.bedAt != null ? n.bedAt : n.onsetAt;
    var bedDev = bedRef != null ? (bedRef - p.bed) / MIN : null, wakeDev = n.wakeAt != null ? (n.wakeAt - p.wake) / MIN : null;
    var u = { dur: durUtil(s.min, plan.L, plan.U), bed: adhUtil(bedDev), wake: adhUtil(wakeDev), rested: restedUtil(n.rested) };
    return { sleepMin: s.min, approx: s.approx, bedDev: bedDev, wakeDev: wakeDev, u: u, inRange: s.min != null && s.min >= plan.L && s.min <= plan.U,
      onSched: bedDev != null && wakeDev != null && Math.abs(bedDev) <= CONFIG.streakTolMin && Math.abs(wakeDev) <= CONFIG.streakTolMin,
      wind: n.wind ? windUtil(n.wind.done, n.wind.planned) : null, qualifies: u.dur != null && u.bed != null && u.wake != null };
  }
  function isReal(n) { return !!n && n.state === 'confirmed' && n.kind !== 'nap' && !n.demo && !n.deleted }
  /* the target score of one night on its own plan (0-100). The rested part is left out when there is no rating. */
  function nightScore(n, plan) { var c = nightCalc(n, plan); if (!c.qualifies) return null; var W = CONFIG.weights, num = W.dur * c.u.dur + W.bed * c.u.bed + W.wake * c.u.wake, den = W.dur + W.bed + W.wake; if (c.u.rested != null) { num += W.rested * c.u.rested; den += W.rested } return num / den }

  /* ---- a matched pair. Both sides are scored with the CURRENT night's plan, so loosening a target cannot manufacture a win. ---- */
  function pairScore(cur, riv, P) {
    var plan = planFor(P, cur.day); if (!plan) return null;
    var c = nightCalc(cur, plan), r = nightCalc(riv, plan, riv.day); if (!c.qualifies || !r.qualifies) return null;
    var W = CONFIG.weights, keys = ['dur', 'bed', 'wake']; if (c.u.rested != null && r.u.rested != null) keys.push('rested');
    var cu = 0, ru = 0, w = 0; keys.forEach(function (k) { cu += W[k] * c.u[k]; ru += W[k] * r.u[k]; w += W[k] });
    var rivPlan = planFor(P, riv.day);
    return { cur: c, riv: r, curU: cu, rivU: ru, w: w, keys: keys, recalculated: !!rivPlan && (rivPlan.v !== plan.v || rivPlan.L !== plan.L || rivPlan.U !== plan.U || rivPlan.bed !== plan.bed || rivPlan.wake !== plan.wake) };
  }

  /* ---- periods ---- */
  function periodOf(kind, ref) {
    var d = dayDate(ref), s, e, ps, pe;
    if (kind === 'day') { s = e = ref; ps = pe = addDays(ref, -1) }
    else if (kind === 'week') { s = addDays(ref, -d.getDay()); e = addDays(s, 6); ps = addDays(s, -7); pe = addDays(s, -1) }
    else if (kind === '2w') { var k = Math.floor(diffDays(CONFIG.twoWeekAnchor, ref) / 14); s = addDays(CONFIG.twoWeekAnchor, k * 14); e = addDays(s, 13); ps = addDays(s, -14); pe = addDays(s, -1) }
    else if (kind === 'month') { s = dayStr(new Date(d.getFullYear(), d.getMonth(), 1).getTime()); e = dayStr(new Date(d.getFullYear(), d.getMonth() + 1, 0).getTime()); ps = dayStr(new Date(d.getFullYear(), d.getMonth() - 1, 1).getTime()); pe = dayStr(new Date(d.getFullYear(), d.getMonth(), 0).getTime()) }
    else { var q = Math.floor(d.getMonth() / 3); s = dayStr(new Date(d.getFullYear(), q * 3, 1).getTime()); e = dayStr(new Date(d.getFullYear(), q * 3 + 3, 0).getTime()); ps = dayStr(new Date(d.getFullYear(), q * 3 - 3, 1).getTime()); pe = dayStr(new Date(d.getFullYear(), q * 3, 0).getTime()) }
    return { kind: kind, start: s, end: e, rivStart: ps, rivEnd: pe };
  }
  /* compare a period with the one before it.
     - only sleep days that have happened count (a period still running is "in progress")
     - current day #1 is paired with rival day #1, #2 with #2 ... and BOTH sides are cut to the same number of days
     - a pair only counts when both nights are real, confirmed and comparable; a missing night is missing, never a zero */
  function compare(kind, ref, nights, P, today) {
    var pr = periodOf(kind, ref), curDays = daysBetween(pr.start, pr.end), rivDays = daysBetween(pr.rivStart, pr.rivEnd);
    var elapsed = curDays.filter(function (d) { return d <= today }), n = Math.min(elapsed.length, rivDays.length), pairs = [], cu = 0, ru = 0;
    var sum = { curMin: 0, rivMin: 0, curBed: 0, rivBed: 0, curWake: 0, rivWake: 0, curRest: 0, rivRest: 0, nRest: 0 };
    for (var i = 0; i < n; i++) {
      var c = nights[curDays[i]], r = nights[rivDays[i]], ps = isReal(c) && isReal(r) ? pairScore(c, r, P) : null;
      pairs.push({ i: i, curDay: curDays[i], rivDay: rivDays[i], cur: isReal(c) ? c : null, riv: isReal(r) ? r : null, score: ps });
      if (ps) { cu += ps.curU; ru += ps.rivU; sum.curMin += ps.cur.sleepMin; sum.rivMin += ps.riv.sleepMin; sum.curBed += Math.abs(ps.cur.bedDev); sum.rivBed += Math.abs(ps.riv.bedDev); sum.curWake += Math.abs(ps.cur.wakeDev); sum.rivWake += Math.abs(ps.riv.wakeDev);
        if (ps.keys.indexOf('rested') >= 0) { sum.curRest += c.rested; sum.rivRest += r.rested; sum.nRest++ } }
    }
    var paired = pairs.filter(function (p) { return p.score }).length, need = Math.max(1, Math.ceil(CONFIG.coverage * n));
    var anyReal = Object.keys(nights).some(function (k) { return isReal(nights[k]) }), rivAny = pairs.some(function (p) { return p.riv });
    var out = { kind: kind, period: pr, eligibleDays: n, pairedDays: paired, needed: need, inProgress: elapsed.length < curDays.length, pairs: pairs, primaryRivalPct: null, relativeDeltaPct: null, pointsDelta: null, raw: null, scoringVersion: CONFIG.scoringVersion,
      recalculated: pairs.some(function (p) { return p.score && p.score.recalculated }) };
    if (!anyReal || n === 0) { out.status = 'baseline_needed'; out.why = 'Log your first night to set your baseline.'; return out }
    if (!rivAny) { out.status = 'baseline_needed'; out.why = kind === 'day' ? 'No log for the night before, so there is no rival for this night.' : 'Nothing logged in the period before this one yet.'; return out }
    if (paired < need) { out.status = 'sparse'; out.why = paired + ' of ' + n + ' comparable nights. ' + need + ' are needed for a score.'; return out }
    var w = pairs.reduce(function (a, p) { return a + (p.score ? p.score.w : 0) }, 0);
    out.raw = { sleepMin: [sum.curMin / paired, sum.rivMin / paired], bedDev: [sum.curBed / paired, sum.rivBed / paired], wakeDev: [sum.curWake / paired, sum.rivWake / paired], rested: sum.nRest ? [sum.curRest / sum.nRest, sum.rivRest / sum.nRest] : null };
    out.curScore = cu / w; out.rivScore = ru / w; out.pointsDelta = out.curScore - out.rivScore;
    if (!(ru > 0)) { out.status = cu > 0 ? 'from_zero' : 'both_zero'; out.why = cu > 0 ? 'Improved from zero.' : 'No relative score; both at zero.'; return out }
    out.primaryRivalPct = 100 * cu / ru; out.relativeDeltaPct = out.primaryRivalPct - 100; out.status = out.inProgress ? 'in_progress' : 'ok'; return out;
  }
  /* one metric against its rival. Never divides by zero, never returns Infinity or NaN. */
  function metricPct(cur, riv, higherBetter) {
    if (cur == null || riv == null || !isFinite(cur) || !isFinite(riv)) return { pct: null, label: 'No data' };
    if (higherBetter) { if (riv === 0) return cur > 0 ? { pct: null, label: 'Improved from zero' } : { pct: null, label: 'Both at zero' }; return { pct: 100 * cur / riv, label: '' } }
    if (cur === 0 && riv === 0) return { pct: 100, label: 'Matched' }; if (cur === 0) return { pct: null, label: 'Improved to zero' }; if (riv === 0) return { pct: 0, label: '' };
    return { pct: 100 * riv / cur, label: '' };
  }
  function fmtPct(p) { return p == null ? '—' : (Math.round(p * 10) / 10).toFixed(1) + '%' }

  /* ---- streaks: four separate ones. A scheduled night with no log interrupts the streak (unverified) - it is not "bad sleep". ---- */
  function streaks(nights, P, today) {
    var first = Object.keys(nights).filter(function (k) { return isReal(nights[k]) }).sort()[0], T = { logged: [], durMet: [], sched: [], wind: [] };
    if (!first) return { logged: { cur: 0, best: 0 }, durMet: { cur: 0, best: 0 }, sched: { cur: 0, best: 0 }, wind: { cur: 0, best: 0 } };
    daysBetween(first, today).forEach(function (d) {
      var plan = planFor(P, d); if (!plan || !plan.on) return; var n = nights[d], real = isReal(n), c = real ? nightCalc(n, plan) : null;
      if (!real && d === today) return;   // today's night may simply not be confirmed yet
      T.logged.push(real && c.qualifies); T.durMet.push(real && c.inRange); T.sched.push(real && c.onSched); T.wind.push(real && c.wind === 100);
    });
    var run = function (a) { var best = 0, cur = 0; a.forEach(function (x) { cur = x ? cur + 1 : 0; if (cur > best) best = cur }); return { cur: cur, best: best } };
    return { logged: run(T.logged), durMet: run(T.durMet), sched: run(T.sched), wind: run(T.wind) };
  }

  /* ---- XP. An append-only ledger: every credit and every reversal stays on the record; the net per key can only be 0 or the award. ---- */
  function rewardKey(day, type) { return 'rest-' + day + '-' + type }
  function ledgerNet(ledger, key) { return (ledger || []).reduce(function (a, e) { return a + (e.key === key ? e.xp : 0) }, 0) }
  function ledgerTotal(ledger) { return (ledger || []).reduce(function (a, e) { return a + e.xp }, 0) }
  function expected(day, nights, P) {
    var n = nights[day], plan = planFor(P, day), ok = isReal(n) && !!plan && nightCalc(n, plan).qualifies, cmp = ok ? compare('day', day, nights, P, day) : null;
    return { session: ok, rival: !!(cmp && cmp.primaryRivalPct != null && cmp.primaryRivalPct > 100), snapshot: cmp ? { pct: cmp.primaryRivalPct, rivDay: cmp.period.rivStart, cur: cmp.curScore, riv: cmp.rivScore } : null };
  }
  /* bring the ledger in line with what the evidence supports for one sleep day. Returns the NEW entries (maybe none). */
  function reconcile(ledger, day, nights, P, now) {
    var ex = expected(day, nights, P), add = [];
    [['session', CONFIG.xp.session, ex.session, 'Confirmed night'], ['rival', CONFIG.xp.rival, ex.rival, 'Beat your rival']].forEach(function (t) {
      var key = rewardKey(day, t[0]), net = ledgerNet(ledger.concat(add), key), want = t[2] ? t[1] : 0;
      if (net < want) add.push({ key: key, day: day, type: 'credit', xp: want - net, at: now, reason: t[3], rule: CONFIG.scoringVersion, snapshot: t[0] === 'rival' ? ex.snapshot : null });
      else if (net > want) add.push({ key: key, day: day, type: 'reversal', xp: want - net, at: now, reason: t[3] + ' no longer supported by the record', rule: CONFIG.scoringVersion, snapshot: null });
    });
    return add;
  }
  function levelOf(xp) { xp = Math.max(0, xp || 0); var lv = Math.min(CONFIG.xp.maxLevel, 1 + Math.floor(xp / CONFIG.xp.perLevel)), max = lv >= CONFIG.xp.maxLevel; return { level: lv, max: max, into: max ? CONFIG.xp.perLevel : xp - (lv - 1) * CONFIG.xp.perLevel, per: CONFIG.xp.perLevel } }

  /* ---- detectors. Fed with real captured levels. A sound/motion event is "this much above the room's own floor, for this long". ---- */
  function median(a) { var b = a.slice().sort(function (x, y) { return x - y }); return b.length ? b[Math.floor(b.length / 2)] : 0 }
  function detect(samples, cfg, absolute) {   // samples: [{t, v}] in time order. absolute=true: v is already "change", compare with cfg.rise directly
    var ev = [], win = [], open = null, i, s, floor;
    for (i = 0; i < samples.length; i++) {
      s = samples[i]; floor = absolute ? 0 : (win.length >= 8 ? median(win) : null);
      var hot = absolute ? s.v >= cfg.rise : (floor != null && s.v >= floor + cfg.riseDb);
      if (hot) { if (!open) open = { t0: s.t, t1: s.t, peak: s.v, floor: floor }; open.t1 = s.t; if (s.v > open.peak) open.peak = s.v }
      else { if (open) { ev.push(open); open = null } if (!absolute) { win.push(s.v); if (win.length > cfg.floorWindow) win.shift() } }
    }
    if (open) ev.push(open);
    var merged = []; ev.forEach(function (e) { var l = merged[merged.length - 1]; if (l && e.t0 - l.t1 <= cfg.mergeMs) { l.t1 = e.t1; l.peak = Math.max(l.peak, e.peak) } else merged.push(e) });
    return merged.filter(function (e) { return e.t1 - e.t0 >= cfg.minMs }).map(function (e) { return { t0: e.t0, t1: e.t1, ms: e.t1 - e.t0, peak: e.peak, over: absolute ? e.peak : e.peak - e.floor } });
  }
  function ratePerHour(events, capturedMs) { return capturedMs > 0 ? events.length / (capturedMs / 3600000) : null }
  function mine(ev) { return !ev.who || ev.who === 'me' || ev.who === 'unknown' }   // partner / room noise / other are not counted as yours

  return { CONFIG: CONFIG, dayStr: dayStr, dayDate: dayDate, addDays: addDays, diffDays: diffDays, daysBetween: daysBetween, at: at, hm: hm, sleepDayOf: sleepDayOf, planFor: planFor, planned: planned,
    durUtil: durUtil, adhUtil: adhUtil, restedUtil: restedUtil, windUtil: windUtil, sleepMin: sleepMin, nightCalc: nightCalc, nightScore: nightScore, isReal: isReal, pairScore: pairScore, periodOf: periodOf, compare: compare,
    metricPct: metricPct, fmtPct: fmtPct, streaks: streaks, rewardKey: rewardKey, ledgerNet: ledgerNet, ledgerTotal: ledgerTotal, expected: expected, reconcile: reconcile, levelOf: levelOf, detect: detect, ratePerHour: ratePerHour, mine: mine };
});
