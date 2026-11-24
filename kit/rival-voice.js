/* RIVAL VOICE · RV010 (CR065: work and Anchor changes asked in any app also finish in Club) · RV009 (CR064: a schedule change asked for inside an app is finished in Club - it opens Club's coach with what you said, which does it and gives you UNDO) · RV008 (finds RankUp/Rep's Club sign-in, refreshes an expired one) · RV007 (the coach opens INSIDE this app, in its color - advises, opens apps) · RV006 (one coach: hand-off from Club with the mic on, keeps the screen awake, “Coach, …” questions go to the coach) · RV005 (runs the Club coach's ?say= commands) · RV004 · lives on the Club site (clubrival.netlify.app/kit/rival-voice.js) - every app loads it from here, so a change is ONE upload to Club. — say it, it presses the button, and it answers in Coach E's voice (Club's ElevenLabs voice; phone voice if that can't load). One small file, dropped into each Rival app (same idea as rival-orb.js).
   TAP THE MIC ONCE: it stays on. Say what you want right away ("start", "the moment", "progress").
   After that it waits for its name: "Coach, pause" · "Coach, resume" · "Coach, skip rest" · "Coach, set done" · "Coach, next" ·
   "Coach, restart" · "Coach, stop round" · "Coach, end". Right after a command you get a few seconds to say the next one without "Coach".
   Tap the mic again to turn it off (it also turns itself off after 2 quiet minutes).
   In the Club Rival iPhone app it uses the phone's own ears (CoachSpeech), so it keeps listening through a whole workout.
   SAFETY: it never ticks a box or fills a box, never buys, pays, sends, shares, deletes, signs out or agrees to anything, and never
   touches anything marked data-novoice (age, parent permission, sign-in). An app can add its own words with
   window.RV_COMMANDS = function(said, helpers){ return 'what to say back' | true | false }. Hidden when body has .drilling or .rv-off. */
(function () {
  var W = window, D = document;
  if (W.__rv) return; W.__rv = 3;
  function getSR() { return W.__RV_SR || W.SpeechRecognition || W.webkitSpeechRecognition }
  function native() { try { return W.Capacitor && W.Capacitor.Plugins && W.Capacitor.Plugins.CoachSpeech || null } catch (e) { return null } }
  /* an iPhone app that doesn't have the coach's ears yet must never touch the browser mic: iOS closes the app (the Stride STR010 crash) */
  function inOldApp() { try { var C = W.Capacitor; return !!(C && C.isNativePlatform && C.isNativePlatform()) && !native() } catch (e) { return false } }
  var css = '#rvMic{position:fixed;left:10px;bottom:calc(env(safe-area-inset-bottom,0px) + 170px);z-index:2147483600;width:44px;height:44px;border-radius:50%;border:1.5px solid rgba(139,108,255,.6);background:rgba(20,16,40,.82);color:#fff;display:grid;place-items:center;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,.35);-webkit-tap-highlight-color:transparent}'
    + '#rvMic svg{width:20px;height:20px}#rvMic.on{background:#8b6cff;animation:rvP 1.4s ease-in-out infinite}#rvMic.hear{background:#2fbf71;border-color:#2fbf71}@keyframes rvP{50%{box-shadow:0 0 0 8px rgba(139,108,255,.25)}}'
    + 'body.drilling #rvMic,body.rv-off #rvMic{display:none}'
    + '#rvCap{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(env(safe-area-inset-bottom,0px) + 226px);z-index:2147483601;max-width:86vw;padding:9px 14px;border-radius:14px;background:rgba(20,16,40,.92);color:#fff;font:700 14px/1.3 -apple-system,system-ui,sans-serif;text-align:center;pointer-events:none;opacity:0;transition:opacity .2s}#rvCap.on{opacity:1}'
    + '@media (prefers-reduced-motion:reduce){#rvMic.on{animation:none}}';
  var st = D.createElement('style'); st.textContent = css; D.head.appendChild(st);
  var cap, capT, on = false, open = 0, idleT = null, eng = null, talkUntil = 0, lastSaid = '', perm = false, woke0 = false;
  /* RV006 · STAY AWAKE while the mic is on or the coach is talking - the phone locking was cutting him off. Keep-awake first, plus a silent 1-pixel video. */
  var AWK = { wl: null, v: null, on: false, t: null };
  function awake(want) { AWK.on = !!want; try { if (want) { if (navigator.wakeLock && !AWK.wl && !D.hidden) navigator.wakeLock.request('screen').then(function (l) { AWK.wl = l; l.addEventListener('release', function () { AWK.wl = null }) }).catch(function () { }); vid(true) } else { var l = AWK.wl; AWK.wl = null; if (l) l.release().catch(function () { }); vid(false) } } catch (e) { } }
  function vid(want) { try { if (want) { if (!AWK.v) { var v = D.createElement('video'); v.setAttribute('playsinline', ''); v.setAttribute('muted', ''); v.setAttribute('aria-hidden', 'true'); v.muted = true; v.loop = true; v.src = 'data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAMvbW9vdgAAAGxtdmhkAAAAAAAAAAAAAAAAAAAD6AAAB9AAAQAAAQAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAll0cmFrAAAAXHRraGQAAAADAAAAAAAAAAAAAAABAAAAAAAAB9AAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAABAAAAAQAAAAAAAkZWR0cwAAABxlbHN0AAAAAAAAAAEAAAfQAAAAAAABAAAAAAHRbWRpYQAAACBtZGhkAAAAAAAAAAAAAAAAAABAAAAAgABVxAAAAAAALWhkbHIAAAAAAAAAAHZpZGUAAAAAAAAAAAAAAABWaWRlb0hhbmRsZXIAAAABfG1pbmYAAAAUdm1oZAAAAAEAAAAAAAAAAAAAACRkaW5mAAAAHGRyZWYAAAAAAAAAAQAAAAx1cmwgAAAAAQAAATxzdGJsAAAAvHN0c2QAAAAAAAAAAQAAAKxhdmMxAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAABAAEABIAAAASAAAAAAAAAABFUxhdmM2MC4zMS4xMDIgbGlieDI2NAAAAAAAAAAAAAAAGP//AAAAMmF2Y0MBZAAK/+EAF2dkAAqs2V7ARAAAAwAEAAADAAg8SJZYAQAEaO+Py/34+AAAAAAQcGFzcAAAAAEAAAABAAAAFGJ0cnQAAAAAAAALWAAAC1gAAAAYc3R0cwAAAAAAAAABAAAAAgAAQAAAAAAUc3RzcwAAAAAAAAABAAAAAQAAABxzdHNjAAAAAAAAAAEAAAABAAAAAgAAAAEAAAAcc3RzegAAAAAAAAAAAAAAAgAAAskAAAANAAAAFHN0Y28AAAAAAAAAAQAAA18AAABidWR0YQAAAFptZXRhAAAAAAAAACFoZGxyAAAAAAAAAABtZGlyYXBwbAAAAAAAAAAAAAAAAC1pbHN0AAAAJal0b28AAAAdZGF0YQAAAAEAAAAATGF2ZjYwLjE2LjEwMAAAAAhmcmVlAAAC3m1kYXQAAAKuBgX//6rcRem95tlIt5Ys2CDZI+7veDI2NCAtIGNvcmUgMTY0IHIzMTA4IDMxZTE5ZjkgLSBILjI2NC9NUEVHLTQgQVZDIGNvZGVjIC0gQ29weWxlZnQgMjAwMy0yMDIzIC0gaHR0cDovL3d3dy52aWRlb2xhbi5vcmcveDI2NC5odG1sIC0gb3B0aW9uczogY2FiYWM9MSByZWY9MSBkZWJsb2NrPTE6LTM6LTMgYW5hbHlzZT0weDM6MHgxMTMgbWU9aGV4IHN1Ym1lPTIgcHN5PTEgcHN5X3JkPTIuMDA6MC43MCBtaXhlZF9yZWY9MCBtZV9yYW5nZT0xNiBjaHJvbWFfbWU9MSB0cmVsbGlzPTAgOHg4ZGN0PTEgY3FtPTAgZGVhZHpvbmU9MjEsMTEgZmFzdF9wc2tpcD0xIGNocm9tYV9xcF9vZmZzZXQ9MCB0aHJlYWRzPTEgbG9va2FoZWFkX3RocmVhZHM9MSBzbGljZWRfdGhyZWFkcz0wIG5yPTAgZGVjaW1hdGU9MSBpbnRlcmxhY2VkPTAgYmx1cmF5X2NvbXBhdD0wIGNvbnN0cmFpbmVkX2ludHJhPTAgYmZyYW1lcz0zIGJfcHlyYW1pZD0yIGJfYWRhcHQ9MSBiX2JpYXM9MCBkaXJlY3Q9MSB3ZWlnaHRiPTEgb3Blbl9nb3A9MCB3ZWlnaHRwPTEga2V5aW50PTI1MCBrZXlpbnRfbWluPTEgc2NlbmVjdXQ9NDAgaW50cmFfcmVmcmVzaD0wIHJjX2xvb2thaGVhZD0xMCByYz1jcmYgbWJ0cmVlPTEgY3JmPTIzLjAgcWNvbXA9MC42MCBxcG1pbj0wIHFwbWF4PTY5IHFwc3RlcD00IGlwX3JhdGlvPTEuNDAgYXE9MToxLjIwAIAAAAATZYiEABfOf+z/wlX/2PZEor//8QAAAAlBmiEYgvnP/vA='; v.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;opacity:.01;pointer-events:none'; D.body.appendChild(v); AWK.v = v } var pr = AWK.v.play(); if (pr && pr.catch) pr.catch(function () { }) } else if (AWK.v) AWK.v.pause() } catch (e) { } }
  function awakeTalk() { awake(true); clearTimeout(AWK.t); (function chk() { AWK.t = setTimeout(function () { if (on) return; if (Date.now() < talkUntil) return chk(); awake(false) }, 1500) })() }
  D.addEventListener('visibilitychange', function () { if (!D.hidden && AWK.on) awake(true) });
  function caption(t, ms) { if (!cap) { cap = D.createElement('div'); cap.id = 'rvCap'; cap.setAttribute('role', 'status'); cap.setAttribute('aria-live', 'polite'); D.body.appendChild(cap) } cap.textContent = t; cap.classList.add('on'); clearTimeout(capT); capT = setTimeout(function () { cap.classList.remove('on') }, ms || 2600) }
  function synth(t) { talkUntil = Date.now() + 700 + String(t).length * 65; try { speechSynthesis.cancel(); var u = new SpeechSynthesisUtterance(t); u.rate = 1.05; u.onend = u.onerror = function () { talkUntil = Date.now() + 350 }; speechSynthesis.speak(u) } catch (e) { } }
  /* Coach E's voice: the same /api/voice the Club coach uses (it checks you're signed in to the Rival club - same account in every app). */
  var CLUBV = W.RV_CLUB_URL || 'https://clubrival.netlify.app/';
  /* RV007 · NO SPLASH WHEN CLUB OR THE COACH SENDS YOU IN. Coach E: "it can't go to splash screens. It has to go into the app."
     Arriving by a link (from=club or from another app) drops the iPhone launch splash at once and passes the app's own tap-to-enter screen
     (Stride's ENTER, RankUp's splash). Opening the app yourself from the home screen still shows its splash. */
  (function skipSplash() {
    var q; try { q = new URLSearchParams(location.search) } catch (e) { return } var f = q.get('from') || ''; if (!/^[a-z]{2,12}$/.test(f)) return;
    try { var SS = W.Capacitor && W.Capacitor.Plugins && W.Capacitor.Plugins.SplashScreen; if (SS && SS.hide) SS.hide({ fadeOutDuration: 0 }) } catch (e) { }
    var n = 0, t = setInterval(function () {
      try {
        var sp = D.getElementById('splash'); if (sp && !sp.classList.contains('hide') && typeof W.enter === 'function') { W.enter(); clearInterval(t); return }
        var mb = D.getElementById('mbSp'), go = D.getElementById('rfEnter'); if (mb && go && !mb.classList.contains('off') && mb.getBoundingClientRect().height > 50 && go.getBoundingClientRect().height > 0 && !D.documentElement.getAttribute('data-rfhold')) { go.click(); clearInterval(t); return }
      } catch (e) { } if (++n > 40) clearInterval(t)
    }, 150);
  })();
  var VOICE = W.RV_VOICE_URL || 'https://clubrival.netlify.app/api/voice', voiceOff = false, ACX = null, src = null, said0 = 0;
  function acx() { try { if (!ACX) { var C = W.AudioContext || W.webkitAudioContext; if (C) ACX = new C() } return ACX } catch (e) { return null } }
  /* RV008 · where an app keeps its Club sign-in: the normal Supabase key (Mind, Rest, Rise, Money, Biz, Stride) or Club Link's own key (RankUp, Rep).
     Coach E's screenshot: the coach opened in RankUp red, but said "connect this app" - RankUp WAS connected, under club_link_auth. */
  function sessKeys() { var out = []; try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (/^sb-glmyzwxinguqcqtgodts-auth-token$/.test(k) || k === 'club_link_auth') out.push(k) } } catch (e) { } return out }
  function sessOf(k) { try { var v = JSON.parse(localStorage.getItem(k)); return v && (v.access_token ? v : v.currentSession || v.session || null) } catch (e) { return null } }
  function token() { var ks = sessKeys(), best = ''; for (var i = 0; i < ks.length; i++) { var v = sessOf(ks[i]); if (v && v.access_token) { if (!v.expires_at || v.expires_at * 1000 > Date.now() + 30000) return v.access_token; best = best || v.access_token } } return best }
  /* a sign-in older than an hour has an expired pass: trade the refresh token for a fresh one (and store it where the app keeps it, so the app gets it too) */
  async function freshToken() {
    var ks = sessKeys();
    for (var i = 0; i < ks.length; i++) { var v = sessOf(ks[i]); if (v && v.access_token && (!v.expires_at || v.expires_at * 1000 > Date.now() + 30000)) return v.access_token }
    for (var j = 0; j < ks.length; j++) { var o = sessOf(ks[j]); if (!o || !o.refresh_token) continue;
      try { var r = await fetch('https://glmyzwxinguqcqtgodts.supabase.co/auth/v1/token?grant_type=refresh_token', { method: 'POST', headers: { apikey: 'sb_publishable_DuBWJ2pLLgaQNkoFqiuOfA_WSYzunwW', 'content-type': 'application/json' }, body: JSON.stringify({ refresh_token: o.refresh_token }) });
        if (!r.ok) continue; var n = await r.json(); if (!n || !n.access_token) continue; if (!n.expires_at && n.expires_in) n.expires_at = Math.floor(Date.now() / 1000) + n.expires_in;
        try { var raw = JSON.parse(localStorage.getItem(ks[j])); if (raw && raw.access_token) localStorage.setItem(ks[j], JSON.stringify(Object.assign(raw, n))); else if (raw && raw.currentSession) { raw.currentSession = Object.assign(raw.currentSession, n); localStorage.setItem(ks[j], JSON.stringify(raw)) } } catch (e) { }
        return n.access_token } catch (e) { } }
    return token();
  }
  function connectBtn() { return W.ClubLink && W.ClubLink.sheet ? '<button data-coconn="1">CONNECT TO CLUB</button>' : '<button data-coclub="1">TALK IN CLUB</button>' }
  function say(t) {
    awakeTalk(); caption(t); lastSaid = norm(t); var me = ++said0, tk = token(), c = acx();
    if (voiceOff || !tk || !c || !W.fetch) return synth(t);
    talkUntil = Date.now() + 9000;
    var gave = false, fall = setTimeout(function () { if (me === said0 && !gave) { gave = true; synth(t) } }, 2500);
    fetch(VOICE, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tk }, body: JSON.stringify({ text: t }) })
      .then(function (r) { if (r.status === 503) voiceOff = true; if (!r.ok) throw new Error('voice ' + r.status); return r.arrayBuffer() })
      .then(function (b) { return c.resume().then(function () { return c.decodeAudioData(b) }) })
      .then(function (buf) { if (gave || me !== said0) return; gave = true; clearTimeout(fall); try { src && src.stop() } catch (e) { } try { speechSynthesis.cancel() } catch (e) { } var n = c.createBufferSource(); n.buffer = buf; n.connect(c.destination); src = n; n.onended = function () { talkUntil = Date.now() + 350 }; n.start(0); talkUntil = Date.now() + buf.duration * 1000 + 400 })
      .catch(function () { if (!gave && me === said0) { gave = true; clearTimeout(fall); synth(t) } });
  }
  var NUM = { zero: 0, one: 1, won: 1, two: 2, to: 2, too: 2, three: 3, four: 4, for: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
  function norm(t) { return String(t || '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim() }
  function num(t) { var m = norm(t).match(/\b(\d+|zero|one|won|two|to|too|three|four|for|five|six|seven|eight|nine|ten)\b/g); if (!m) return null; for (var i = m.length - 1; i >= 0; i--) { var v = /^\d+$/.test(m[i]) ? +m[i] : NUM[m[i]]; if (v != null) return v } return null }
  var FILL = /\b(please|can you|could you|i want to|i wanna|lets|let me|go to|take me to|open|tap|press|click|hit|the|a|my|on|button|now|up)\b/g;
  var NOISE = /^(\d+|sec|secs|min|mins|minutes|seconds)$/;
  var NEVER = /\b(buy|purchase|purchases|restore purchases|subscribe|subscription|pay|payment|checkout|delete|remove|erase|sign out|log out|signout|send|share|decline|accept|agree|consent|unlink|upgrade|unlock pro|transfer|deposit|withdraw|savings|link (my )?bank|connect (my )?bank|stop using)\b/;
  function visible(el) { if (!el || el.disabled || el.closest('[data-novoice]') || el.closest('#rvMic')) return false; if (el.type === 'checkbox' || el.type === 'radio' || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return false; var r = el.getBoundingClientRect(); if (!r.width || !r.height) return false; var cs = getComputedStyle(el); return cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0.05 }
  function labelOf(el) { var t = el.getAttribute('aria-label') || (el.innerText || el.textContent || '').split('\n').filter(function (x) { return x.trim() })[0] || ''; return norm(t) }
  function buttons() { var out = []; D.querySelectorAll('button,a[href],[role="button"],[data-v],[data-nav]').forEach(function (el) { if (!visible(el)) return; var L = labelOf(el); if (!L || NEVER.test(L)) return; out.push({ el: el, L: L }) }); return out }
  /* workout words → the buttons they mean, most specific first */
  var SYN = [
    [/^(skip|end|stop|cut|no) (the )?rest\b/, [/^skip rest/, /^end rest/, /^start next round/, /^skip\b/]],
    [/^(add|plus) (30|thirty) (seconds|sec)\b/, [/^\+ ?30/, /^add 30/, /^30 sec/]],
    [/^(pause|hold on|hold up|wait|timeout|time out)\b/, [/^pause/]],
    [/^(resume|continue|keep going|unpause|back to work)\b/, [/^resume/, /^continue/, /^go$/]],
    [/^(restart|reset|start over|redo|again|one more|try again)\b/, [/^restart/, /^start over/, /^reset/, /^try again/, /\bagain\b/]],
    [/^(set done|log (the |my |that )?set|done with (the |this |that )?set|done|finished (the |that )?set)\b/, [/^set done/, /^log (the )?set/, /^warm up done/, /^done$/]],
    [/^(next|skip|next one|next exercise|next round)\b/, [/^start next round/, /^next/, /^skip\b/]],
    [/^(stop|end|finish|quit|wrap)( (the |this |my )?(round|set|session|workout|walk|run|ride|class|it|up))?$/, [/^stop round/, /^stop\b/, /^end session/, /^end class/, /^end\b/, /^finish/, /^save finish/]],
    [/^(start|go|begin|lets go|let s go|fight)( (the |a |my |next )?(round|set|session|workout|walk|run|ride|class|timer|test|training|program|it))?$/, [/^start next round/, /^start$/, /^go$/, /^arm sensor/, /^start (round|walk|run|ride|session|class|training|the test|program|open gym)/, /^begin/, /^go when/, /^start\b/, /^lets lift/]]
  ];
  function bySyn(said) {
    var s = norm(said).replace(/^(please |now |ok |okay )/, '');
    for (var i = 0; i < SYN.length; i++) if (SYN[i][0].test(s)) {
      var bs = buttons(); for (var j = 0; j < SYN[i][1].length; j++) for (var k = 0; k < bs.length; k++) if (SYN[i][1][j].test(bs[k].L)) return bs[k].el;
      return null;
    }
    return null;
  }
  function press(said) {
    var s = norm(said), core = s.replace(FILL, ' ').replace(/\s+/g, ' ').trim(); if (!core) return null;
    var words = core.split(' '), best = null, bestS = 0, tie = false;
    buttons().forEach(function (b) {
      var lw = b.L.replace(FILL, ' ').trim().split(/\s+/).filter(function (w) { return w && !NOISE.test(w) }); if (!lw.length) return;
      var hit = 0; lw.forEach(function (w) { if (words.indexOf(w) >= 0 || words.some(function (x) { return x.length > 3 && (x.indexOf(w) === 0 || w.indexOf(x) === 0) })) hit++ });
      var sc = (hit / lw.length) * 0.7 + (hit / words.length) * 0.3; if (b.L === core) sc = 2;
      if (sc > bestS + 1e-6) { best = b.el; bestS = sc; tie = false } else if (Math.abs(sc - bestS) < 1e-6 && sc > 0) tie = true;
    });
    if (!best || bestS < 0.6 || (tie && bestS < 2)) return null;
    return best;
  }
  function click(el) { var L = (el.getAttribute('aria-label') || el.innerText || '').split('\n')[0].trim(); say(L ? L.charAt(0) + L.slice(1).toLowerCase() + '.' : 'Done.'); try { navigator.vibrate && navigator.vibrate(30) } catch (e) { } setTimeout(function () { el.click() }, 120) }
  function run(said) {
    var s = norm(said); caption('“' + said + '”', 1400);
    if (D.body.classList.contains('drilling')) {                           /* reaction tests stay fair: only "stop" works */
      if (/^(stop|end|exit|quit)\b/.test(s)) { var x = buttons().filter(function (b) { return /^(exit|stop|end)\b/.test(b.L) })[0]; if (x) { x.el.click(); return } }
      return;
    }
    try { if (typeof W.RV_COMMANDS === 'function') { var r = W.RV_COMMANDS(said, { norm: norm, num: num, say: say }); if (r) { if (typeof r === 'string') say(r); return } } } catch (e) { }
    if (/^(mic off|stop listening|turn off|go to sleep)\b/.test(s)) { off(); return say('Mic off.') }
    if (/\b(talk to coach|orb)\b/.test(s) || s === 'coach') { var o = D.getElementById('rvOrb'); if (o) { off(); o.click(); return } }
    if (/^(go )?back\b|^back to\b|club rival/.test(s)) { var b = D.querySelector('.clubback,[data-v="today"],#back,.back'); if (b && visible(b)) { say('Going back.'); b.click(); return } }
    if (/scroll down|go down/.test(s)) { W.scrollBy({ top: innerHeight * 0.7, behavior: 'smooth' }); return }
    if (/scroll up|go up|^top$/.test(s)) { W.scrollTo({ top: 0, behavior: 'smooth' }); return }
    var el = bySyn(said) || press(said);
    if (el) return click(el);
    /* RV006 · not a button: a real question goes to the coach (Club), who answers it right away */
    if (woke0 || s.split(' ').length >= 3) { woke0 = false; off(); coOpen(said); return }
    say('I didn’t find that button. Say the words on it, or say Coach.');
  }
  /* one utterance from whichever ears this phone has; cb(text) ('' = nothing heard) */
  function once(cb) {
    var cs = native(), done = false; function fin(t) { if (done) return; done = true; eng = null; cb(t || '') }
    if (cs) {
      (async function () {
        try {
          if (!perm) { var p = await cs.askPermission(); perm = !!(p && p.speech === 'granted' && p.mic === 'granted'); if (!perm) { off(); return caption('Allow Speech + Microphone in Settings to use voice.', 4000) } }
          var said = '', t = null, cap2 = null, h1 = null, h2 = null;
          var end = function () { clearTimeout(t); clearTimeout(cap2); try { h1 && h1.remove(); h2 && h2.remove() } catch (e) { } cs.stop().catch(function () { }); fin(said) };
          eng = { stop: end };
          h1 = await cs.addListener('partial', function (d) { said = String(d && d.text || ''); mic.classList.add('hear'); clearTimeout(t); t = setTimeout(end, d && d.final ? 50 : 1000) });
          h2 = await cs.addListener('state', function (d) { if (d && d.status === 'stopped') setTimeout(end, 80) });
          cap2 = setTimeout(function () { if (!said) end() }, 12000);
          await cs.start({});
        } catch (e) { off(); caption('Couldn’t listen: ' + String(e && e.message || e).slice(0, 50), 3500) }
      })();
      return;
    }
    if (inOldApp()) { off(); var N = W.RIVAL_NATIVE; return say(N ? 'This iPhone build (' + N.build + ') could not attach the ears. Send Claude a screenshot.' : 'Voice comes with the next iPhone update of this app.') }
    var SR = getSR(); if (!SR) { off(); return say('This browser can’t listen. Try Safari or Chrome.') }
    var r = new SR(), got = ''; r.lang = 'en-US'; r.interimResults = false; r.continuous = false;
    eng = { stop: function () { try { r.stop() } catch (e) { } } };
    r.onresult = function (ev) { got = Array.prototype.map.call(ev.results, function (x) { return x[0].transcript }).join(' ') };
    r.onerror = function (ev) { if (ev && /not-allowed|service-not-allowed/.test(ev.error || '')) { off(); caption('Allow the mic to use voice.', 3500) } };
    r.onend = function () { fin(got) };
    try { r.start() } catch (e) { done = true; eng = null; off(); caption('Tap the mic to talk.', 2500) }
  }
  function handle(text) {
    var t = String(text || '').trim(); if (!t) return;
    if (Date.now() < talkUntil || norm(t) === lastSaid) return;           /* that was us talking */
    var n = norm(t), woke = /^(hey |ok |okay )?coach\b/.test(n);
    woke0 = woke; if (woke) t = t.replace(/^\s*(hey |ok |okay )?coach[\s,.!:]*/i, '');
    if (!woke && Date.now() > open) return;                                /* not for us */
    if (!t.trim()) { open = Date.now() + 6000; return caption('Yes?', 1500) }
    open = Date.now() + 6000 + 700 + t.length * 65; bump(); run(t);
  }
  function loop() { if (!on) return; once(function (t) { mic.classList.remove('hear'); if (!on) return; handle(t); setTimeout(loop, 120) }) }
  function bump() { clearTimeout(idleT); idleT = setTimeout(function () { off(); caption('Mic off. Tap it to talk.', 2500) }, 120000) }
  function unlock() { try { var c = acx(); if (c) { c.resume(); var b = c.createBuffer(1, 1, 22050), n = c.createBufferSource(); n.buffer = b; n.connect(c.destination); n.start(0) } } catch (e) { } try { speechSynthesis.cancel(); var u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u) } catch (e) { } }
  function onn() { awake(true); on = true; open = Date.now() + 8000; mic.classList.add('on'); mic.setAttribute('aria-pressed', 'true'); unlock(); caption('Listening. Say it now — later start with “Coach, …”', 3000); bump(); loop() }
  function off() { awake(false); on = false; clearTimeout(idleT); mic.classList.remove('on', 'hear'); mic.setAttribute('aria-pressed', 'false'); var e = eng; eng = null; if (e) try { e.stop() } catch (x) { } }
  var mic = D.createElement('button'); mic.id = 'rvMic'; mic.type = 'button'; mic.setAttribute('aria-label', 'Voice: tap, then say a button or “Coach, …”'); mic.setAttribute('aria-pressed', 'false');
  mic.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>';
  mic.onclick = function () { on ? (off(), caption('Mic off.', 1200)) : onn() };
  function put() { if (!D.getElementById('rvMic')) D.body.appendChild(mic) }
  if (D.body) put(); else D.addEventListener('DOMContentLoaded', put);
  /* RV005 · CLUB IS THE PARENT. When the Club coach sends you here with ?say=..., this app runs those words as if you said them here.
     The never-press list still holds: nothing that pays, sends, deletes or signs out ever runs this way. */
  (function fromClub() {
    var q = '', talk = false; try { var P = new URLSearchParams(location.search); q = P.get('say') || ''; talk = P.get('go') === 'talk' } catch (e) { } q = String(q).slice(0, 160); if (!q) return;
    try { var u = new URL(location.href); u.searchParams.delete('say'); if (talk) u.searchParams.delete('go'); history.replaceState(history.state, '', u.toString()) } catch (e) { }
    /* RV006 · ONE COACH: he hands you off still talking - says it in his voice, then the mic comes on by itself (no tap). */
    var micOn = function () { if (!talk || on || inOldApp()) return; var w = Math.max(0, talkUntil - Date.now()) + 300; setTimeout(function () { onn(); open = Date.now() + 20000; caption('Coach is with you. Say the button, or say Coach.', 3500) }, w) };
    if (q === '__talk') { var hi = function () { say('I’m right here. Say the button, or say Coach.'); setTimeout(micOn, 400) }; if (D.readyState === 'complete') setTimeout(hi, 1800); else W.addEventListener('load', function () { setTimeout(hi, 1800) }); return }
    if (NEVER.test(norm(q)) && !/^i saved\b/.test(norm(q))) { setTimeout(function () { caption('That one is yours to tap.', 3500) }, 1500); return }
    var go = function () { caption('Coach: “' + q + '”', 2200); run(q); setTimeout(micOn, 600) };
    if (D.readyState === 'complete') setTimeout(go, 2600); else W.addEventListener('load', function () { setTimeout(go, 2600) });
  })();

  /* ===== RV007 · THE COACH, RIGHT HERE. Coach E: "if I hit that orb, it opens back up at Club Rival. It should remain on the app that I'm on ...
     the coach should be the color of the app ... but you have the all-knowing coach."
     Tap the Orb in any app: the same coach opens on top of THIS app, in this app's color. Same brain (Club's /api/coach, which reads your whole day
     from your account), same voice. He advises - answers, insight, recommendations - and can open another app. He never changes your schedule.
     Not connected to a Club account in this app yet? He says so and offers Club. ===== */
  var APP = (function () { var e = D.querySelector('script[data-app]'); return e ? e.getAttribute('data-app') : '' })();
  var NAMES = { stride: 'Stride Rival', rep: 'Rep Rival', rankup: 'RankUp', mind: 'Cube Rival', mindrival: 'Mind Rival', rest: 'Rest Rival', rise: 'Rise Rival', money: 'Money Rival', biz: 'Biz Rival', bmx: 'BMX Rival', trail: 'Trail Rival', club: 'Club Rival' };
  var URLS = { stride: 'https://striderival.netlify.app', rep: 'https://myreprival.netlify.app', rankup: 'https://rankuprival.netlify.app', mind: 'https://reflexrival.netlify.app', rest: 'https://restrival.netlify.app', money: 'https://moneyrival.netlify.app', rise: 'https://riserival.netlify.app', mindrival: 'https://mindrival2.netlify.app', biz: 'https://mybizrival.netlify.app', bmx: 'https://rideflowbmx.com', trail: 'https://rideflowmtb.com' };
  var NAT = { stride: 'rivalstride', rep: 'rivalrep', rankup: 'rivalrankup', mind: 'rivalmind', rest: 'rivalrest', money: 'rivalmoney', rise: 'rivalrise', mindrival: 'rivalmindrival', biz: 'rivalbiz' };
  var CO = { open: false, msgs: [], busy: false, hands: true, quiet: 0 };
  function coEsc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] }) }
  function coCss() {
    if (D.getElementById('rvCoCss')) return; var st = D.createElement('style'); st.id = 'rvCoCss';
    st.textContent = '#rvCo{position:fixed;inset:0;z-index:2147483000;background:rgba(4,5,7,.86);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);display:flex;flex-direction:column;color:#f2f4f7;font:500 16px/1.45 -apple-system,BlinkMacSystemFont,system-ui,sans-serif;padding:calc(env(safe-area-inset-top,0px) + 14px) 18px calc(env(safe-area-inset-bottom,0px) + 18px)}'
      + '#rvCo .ch{display:flex;align-items:center;justify-content:space-between}#rvCo .ey{font:900 10.5px/1 -apple-system,sans-serif;letter-spacing:.22em;color:var(--rvA,#5aa2ff)}#rvCo .x{width:44px;height:44px;border-radius:50%;border:1px solid rgba(255,255,255,.16);background:none;color:#fff;font:600 18px/1 -apple-system,sans-serif;cursor:pointer}'
      + '#rvCo .ob{margin:18px auto 6px;width:132px;height:132px;border-radius:50%;border:0;cursor:pointer;display:block;background:radial-gradient(circle at 34% 30%,#fff 0,rgba(255,255,255,.85) 7%,rgba(var(--rvAr,90,162,255),1) 42%,rgba(var(--rvAr,90,162,255),.7) 70%,rgba(0,0,0,.6) 100%);box-shadow:0 0 0 2px rgba(255,255,255,.14),0 0 60px rgba(var(--rvAr,90,162,255),.55);transition:transform .2s}'
      + '#rvCo .ob.hear{animation:rvCoP 1s ease-in-out infinite}#rvCo .ob.think{animation:rvCoP 1.8s ease-in-out infinite;opacity:.8}#rvCo .ob.talk{animation:rvCoP .6s ease-in-out infinite}@keyframes rvCoP{50%{transform:scale(1.07);box-shadow:0 0 0 2px rgba(255,255,255,.2),0 0 90px rgba(var(--rvAr,90,162,255),.85)}}'
      + '#rvCo .st{text-align:center;font:900 10.5px/1 -apple-system,sans-serif;letter-spacing:.2em;color:#9aa1ad;margin:6px 0 12px}'
      + '#rvCo .lg{flex:1;overflow:auto;display:flex;flex-direction:column;gap:10px;padding:4px 2px}#rvCo .m{max-width:86%;padding:11px 14px;border-radius:18px;background:rgba(255,255,255,.07)}#rvCo .m.u{align-self:flex-end;background:rgba(var(--rvAr,90,162,255),.22);border:1px solid rgba(var(--rvAr,90,162,255),.4)}'
      + '#rvCo .ac{display:flex;gap:8px;flex-wrap:wrap;margin-top:6px}#rvCo .ac button,#rvCo .gc{border-radius:999px;border:1px solid rgba(var(--rvAr,90,162,255),.6);background:none;color:#fff;font:800 11px/1 -apple-system,sans-serif;letter-spacing:.14em;padding:12px 14px;cursor:pointer}'
      + '#rvCo form{display:flex;gap:8px;margin-top:10px}#rvCo input{flex:1;min-width:0;height:48px;border-radius:999px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.06);color:#fff;padding:0 16px;font:500 16px -apple-system,sans-serif}#rvCo form button{height:48px;padding:0 18px;border-radius:999px;border:0;background:var(--rvA,#5aa2ff);color:#08090b;font:900 12px/1 -apple-system,sans-serif;letter-spacing:.14em}'
      + 'html.rv-co #rvOrb,html.rv-co #rvDock,html.rv-co body #rvMic,html.rv-co #rvCap{display:none!important}';
    D.head.appendChild(st);
  }
  function coSt(t, k) { var o = D.getElementById('rvCoOb'), x = D.getElementById('rvCoSt'); if (x) x.textContent = t; if (o) { o.className = 'ob' + (k ? ' ' + k : '') } }
  function coLog() { var lg = D.getElementById('rvCoLg'); if (!lg) return; lg.innerHTML = CO.msgs.map(function (m) { return '<div class="m' + (m.role === 'user' ? ' u' : '') + '">' + coEsc(m.content) + (m.btns ? '<div class="ac">' + m.btns + '</div>' : '') + '</div>' }).join(''); lg.scrollTop = lg.scrollHeight; lg.querySelectorAll('[data-coapp]').forEach(function (b) { b.onclick = function () { coGoApp(b.getAttribute('data-coapp')) } }); lg.querySelectorAll('[data-coclub]').forEach(function (b) { b.onclick = function () { coClose(); W.RivalOrb && W.RivalOrb.open() } }); lg.querySelectorAll('[data-coclubq]').forEach(function (b) { b.onclick = function () { coClose(); W.RivalOrb && W.RivalOrb.open(b.getAttribute('data-coclubq')) } }); lg.querySelectorAll('[data-coconn]').forEach(function (b) { b.onclick = function () { coClose(); try { W.ClubLink.sheet() } catch (e) { } } }) }
  function screenText() { try { var el = D.getElementById('rtLay') || D.querySelector('main') || D.body; var t = (el.innerText || '').replace(/\s+\n/g, '\n').replace(/\n{2,}/g, '\n'); return t.slice(0, 1500) } catch (e) { return '' } }
  function coOpen(q) {
    if (CO.open) { if (q) coAsk(q); return } CO.open = true; off(); coCss(); D.documentElement.classList.add('rv-co'); awake(true);
    var o = D.createElement('div'); o.id = 'rvCo'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true'); o.setAttribute('aria-label', 'Coach');
    o.innerHTML = '<div class="ch"><div class="ey">COACH · ' + coEsc((NAMES[APP] || 'THIS APP').toUpperCase()) + '</div><button class="x" id="rvCoX" aria-label="Close the coach">✕</button></div>'
      + '<button class="ob" id="rvCoOb" aria-label="Tap and talk to the coach"></button><div class="st" id="rvCoSt" role="status">TAP AND TALK</div>'
      + '<div class="lg" id="rvCoLg" aria-live="polite"></div><form id="rvCoF"><input id="rvCoIn" placeholder="Or type it" autocomplete="off" aria-label="Ask the coach"><button>ASK</button></form>';
    D.body.appendChild(o);
    D.getElementById('rvCoX').onclick = coClose; D.getElementById('rvCoOb').onclick = function () { unlock(); CO.hands = true; coListen() };
    D.getElementById('rvCoF').onsubmit = function (e) { e.preventDefault(); var i = D.getElementById('rvCoIn'), v = i.value.trim(); if (!v) return; i.value = ''; coAsk(v) };
    if (!CO.msgs.length) CO.msgs.push({ role: 'assistant', content: sessKeys().length ? 'I’m with you in ' + (NAMES[APP] || 'here') + '. Ask me anything.' : 'Connect ' + (NAMES[APP] || 'this app') + ' to your Club Rival account once, and I can see your whole day right here.', btns: sessKeys().length ? '' : connectBtn() });
    coLog(); if (q) coAsk(q); else if (sessKeys().length) { unlock(); setTimeout(coListen, 250) }
  }
  function coClose() { CO.open = false; CO.hands = false; var e = eng; eng = null; if (e) try { e.stop() } catch (x) { } try { speechSynthesis.cancel() } catch (x) { } var o = D.getElementById('rvCo'); if (o) o.remove(); D.documentElement.classList.remove('rv-co'); awake(false) }
  function coListen() {
    if (!CO.open || CO.busy || inOldApp()) return; if (eng) return; coSt('LISTENING', 'hear');
    once(function (t) { if (!CO.open) return; t = String(t || '').trim(); if (!t) { CO.quiet++; coSt(CO.quiet >= 2 ? 'TAP AND TALK' : 'LISTENING', ''); if (CO.quiet < 2 && CO.hands) setTimeout(coListen, 200); return } CO.quiet = 0; coAsk(t) });
  }
  function coAfterTalk() { if (!CO.open) return; var w = Math.max(0, talkUntil - Date.now()) + 350; setTimeout(function () { if (!CO.open) return; if (CO.hands && Date.now() >= talkUntil) coListen(); else if (CO.hands) coAfterTalk(); else coSt('TAP AND TALK', '') }, w) }
  async function coAsk(q) {
    if (CO.busy) return; q = String(q).slice(0, 600); CO.msgs.push({ role: 'user', content: q }); coLog();
    CO.busy = true; coSt('THINKING', 'think'); var tk = await freshToken(); if (!tk) { CO.busy = false; CO.msgs.push({ role: 'assistant', content: 'Connect ' + (NAMES[APP] || 'this app') + ' to your Club Rival account once, and I’ll answer right here.', btns: connectBtn() }); coLog(); coSt('TAP AND TALK', ''); return }
    var j = {};
    try { var r = await fetch(CLUBV + 'api/coach', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tk }, body: JSON.stringify({ from: APP || 'app', screen: screenText(), messages: CO.msgs.filter(function (m) { return m.role === 'user' || m.role === 'assistant' }).map(function (m) { return { role: m.role, content: m.content } }) }) }); j = await r.json().catch(function () { return {} }); if (r.status === 401) j = { say: 'Your Club sign-in in ' + (NAMES[APP] || 'this app') + ' ran out. Connect it again and I’m back.', conn: true } } catch (e) { j = { say: 'I can’t reach the club right now. Try again in a second.' } }
    CO.busy = false; if (!CO.open) return;
    var acts = (j.actions || []).filter(function (a) { return a && (a.type === 'open_app' || a.type === 'show_screen') }), btns = '';
    acts.forEach(function (a) { var i = a.input || {}; if (a.type === 'open_app' && i.app && i.app !== APP && (URLS[i.app] || NAT[i.app])) btns += '<button data-coapp="' + coEsc(i.app) + '">OPEN ' + coEsc((NAMES[i.app] || i.app).toUpperCase()) + '</button>'; if (a.type === 'show_screen') btns += '<button data-coclub="1">OPEN CLUB</button>' }); if (j.conn) btns += connectBtn();
    var sch = (j.actions || []).some(function (a) { return a && /^(move_item|skip_item|add_item|add_anchor|remove_anchor|set_work|build_week|set_sleep)$/.test(a.type) }); if (sch) btns += '<button data-coclubq="' + coEsc(q) + '">FINISH IN CLUB</button>';
    var t = String(j.say || 'Say that again?'); CO.msgs.push({ role: 'assistant', content: t, btns: btns }); coLog(); coSt('', 'talk'); say(t);
    var oa = acts.filter(function (a) { return a.type === 'open_app' && a.input && a.input.app && a.input.app !== APP })[0];
    if (oa) { setTimeout(function () { coGoApp(oa.input.app) }, Math.max(1200, talkUntil - Date.now() + 300)); return }
    if (sch) { setTimeout(function () { if (CO.open) { coClose(); W.RivalOrb && W.RivalOrb.open(q) } }, Math.max(1400, talkUntil - Date.now() + 300)); return }   /* RV009: Club does it, reads it back, offers UNDO */
    coAfterTalk();
  }
  function coGoApp(id) {
    coClose(); var nat = NAT[id], ok = false;
    try { ok = !!(W.Capacitor && W.Capacitor.isNativePlatform && W.Capacitor.isNativePlatform()) } catch (e) { }
    if (ok && nat) { location.href = nat + '://open?from=' + encodeURIComponent(APP) + '&go=talk&say=__talk'; return }
    if (URLS[id]) location.href = URLS[id] + '/?from=' + encodeURIComponent(APP) + '&go=talk&say=__talk';
  }
  W.RV = { coach: coOpen, coachClose: coClose, awake: awake, run: run, press: press, bySyn: bySyn, say: say, num: num, norm: norm, hear: handle, on: onn, off: off, isOn: function () { return on } };
})();
