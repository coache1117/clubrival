/* RIVAL TODAY · RT007 (26 Nov: list rows - past ones shaded, done ones tappable to see/undo) · RT006 (26 Nov: d.list - today's planned items with times, one tap each) · RT004 (23 Nov: clearer names - TODAY · PROGRESS · ALL, and an app can name its own, e.g. Biz: INBOX) · RT003 (23 Nov: the way back to Club, on every app - a CLUB button first in the bottom bar) · RT002 - lives on the Club site (clubrival.netlify.app/kit/rival-today.js).
   THE STEVE JOBS SCREEN. Every Rival app opens on the same Today screen:
     top    - the name plate (icon, WORD RIVAL in the app's color, one-line job + version, account)
     middle - ONE big card: today's number vs your last time
     under  - ONE big button: the main job
     bottom - three tabs: TODAY · HISTORY · MORE. History and More are the full app you already know, one tap back.
   Each app hands it a small recipe (RivalToday.mount({...})) that reads its OWN real data and runs its OWN main action.
   Nothing in the app underneath is removed. */
(function () {
  var W = window, D = document; if (W.RivalToday) return;
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] }) }
  function rgb(h) { h = String(h || '#888888').replace('#', ''); return [0, 2, 4].map(function (i) { return parseInt(h.substr(i, 2), 16) }).join(',') }
  var C = null, mode = 'today', lay = null, bar = null, last = '', timer = null;

  function css(c) {
    var A = rgb(c.accent), z = c.z || 30;
    return ':root{--rtA:' + c.accent + ';--rtAr:' + A + ';--rtInk:' + (c.ink || '#0a0a0c') + '}'
      + 'html.rt-on,html.rt-on body{overflow:hidden!important}'
      + '#rtLay{position:fixed;inset:0;z-index:' + z + ';overflow-y:auto;-webkit-overflow-scrolling:touch;background:' + (c.bg || '#060607') + ';color:#f4f5f7;font:500 15px/1.4 -apple-system,BlinkMacSystemFont,"SF Pro Text",Inter,system-ui,sans-serif;padding:calc(env(safe-area-inset-top,0px) + 14px) 0 calc(env(safe-area-inset-bottom,0px) + 190px)}'
      + '#rtLay[hidden]{display:none}#rtLay *{box-sizing:border-box}'
      + '.rt-in{max-width:560px;margin:0 auto;padding:0 18px}'
      + '.rt-top{display:flex;align-items:center;justify-content:space-between;gap:10px}'
      + '.rt-brand{display:flex;align-items:center;gap:11px;min-width:0}.rt-brand img{width:44px;height:44px;border-radius:12px;flex:0 0 auto;box-shadow:0 0 22px rgba(' + A + ',.38),0 0 0 1px rgba(255,255,255,.08)}'
      + '.rt-logo{white-space:nowrap;font:900 italic 25px/1 -apple-system,sans-serif;letter-spacing:-.01em}.rt-logo b{color:var(--rtA)}'
      + '.rt-ver{margin-top:6px;font:800 8.5px/1 -apple-system,sans-serif;letter-spacing:.2em;color:#8e939c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
      + '.rt-acct{flex:0 0 auto;width:40px;height:40px;border-radius:50%;border:1.5px solid rgba(255,255,255,.14);background:transparent;color:var(--rtA);font:900 14px/1 -apple-system,sans-serif;cursor:pointer}'
      + '.rt-hero{color:#f4f5f7;margin-top:22px;border-radius:28px;padding:24px 20px 20px;border:1px solid rgba(' + A + ',.28);background:radial-gradient(130% 90% at 100% 0%,rgba(' + A + ',.22),transparent 55%),linear-gradient(160deg,#121316,#070708)}'
      + '.rt-ey{font:900 10px/1.3 -apple-system,sans-serif;letter-spacing:.22em;color:#9aa0a8;text-transform:uppercase}'
      + '.rt-num{margin-top:14px;font:900 italic clamp(52px,17vw,74px)/0.95 -apple-system,sans-serif;letter-spacing:-.03em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
      + '.rt-num.rt-l{font-size:clamp(44px,13vw,58px)}.rt-num.rt-xl{font-size:clamp(34px,10vw,46px);white-space:normal;line-height:1}'
      + '.rt-small{margin-top:9px;font:900 12px/1 -apple-system,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:#9aa0a8}'
      + '.rt-sub{margin-top:12px;font:600 15px/1.42 -apple-system,sans-serif;color:#cdd2d8}'
      + '.rt-bar{margin-top:18px;height:10px;border-radius:10px;background:rgba(255,255,255,.08);overflow:hidden}.rt-bar i{display:block;height:100%;border-radius:10px;background:var(--rtA)}'
      + '.rt-meter{display:block;width:100%;margin-top:18px;padding:0;border:0;background:none;cursor:pointer}.rt-meter svg{display:block;width:100%;height:44px;border-radius:10px;background:rgba(255,255,255,.06)}'
      + '.rt-barl{display:flex;justify-content:space-between;gap:10px;margin-top:8px;font:800 10.5px/1.2 -apple-system,sans-serif;letter-spacing:.12em;color:#9aa0a8;text-transform:uppercase}'
      + '.rt-vs{margin-top:16px;display:flex;gap:10px}.rt-vs>div{flex:1;min-width:0;border-radius:16px;border:1px solid rgba(255,255,255,.08);padding:12px;background:rgba(0,0,0,.35)}'
      + '.rt-vs .rt-k{font:900 9px/1.2 -apple-system,sans-serif;letter-spacing:.2em;color:#9aa0a8;text-transform:uppercase}.rt-vs .rt-v{margin-top:7px;font:900 italic 21px/1.05 -apple-system,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.rt-vs .rt-v.up{color:var(--rtA)}'
      + '.rt-go{display:block;width:100%;margin-top:18px;min-height:64px;border:0;border-radius:20px;background:var(--rtA);color:var(--rtInk);font:900 16px/1.1 -apple-system,sans-serif;letter-spacing:.14em;text-transform:uppercase;cursor:pointer;box-shadow:0 10px 30px rgba(' + A + ',.32);padding:10px 14px}'
      + '.rt-go:active{transform:scale(.985)}.rt-go:disabled{opacity:.45}'
      + '.rt-inline{padding:0;margin:4px 0 22px}.rt-inline .rt-hero{margin-top:6px}'
      + '.rt-list{margin-top:18px}.rt-ll{font:900 11px/1 -apple-system,sans-serif;letter-spacing:.2em;color:#8e939c;margin:0 4px 8px}'
      + '.rt-li{display:flex;align-items:center;gap:12px;width:100%;min-height:58px;margin-top:8px;padding:10px 14px;border-radius:16px;border:1px solid rgba(255,255,255,.09);background:rgba(255,255,255,.035);color:inherit;text-align:left;cursor:pointer;font:inherit}'
      + '.rt-li.now{border-color:' + (c.accent || '#ff8a1f') + '}.rt-li.done{opacity:.5}.rt-li.past{opacity:.55;filter:saturate(.5)}.rt-li.now{background:rgba(255,255,255,.07)}'
      + '.rt-lt{flex:none;width:72px;font:900 12px/1.2 -apple-system,sans-serif;letter-spacing:.06em;color:' + (c.accent || '#ff8a1f') + '}.rt-li.done .rt-lt{color:#8e939c}'
      + '.rt-lm{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}.rt-lm b{font:800 15px/1.2 -apple-system,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.rt-lm em{font:500 12px/1.3 -apple-system,sans-serif;font-style:normal;color:#8e939c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
      + '.rt-lk{flex:none;font:900 11px/1 -apple-system,sans-serif;letter-spacing:.14em;padding:8px 10px;border-radius:999px;border:1px solid rgba(255,255,255,.16)}.rt-li.done .rt-lk{border:0;font-size:16px;color:#3ddc84}'
      + '.rt-hint{margin-top:12px;text-align:center;font:600 12.5px/1.4 -apple-system,sans-serif;color:#8e939c}'
      + '#rtBar{position:fixed;left:0;right:0;bottom:0;z-index:' + z + ';display:flex;justify-content:space-around;padding:10px 0 calc(env(safe-area-inset-bottom,0px) + 10px);background:rgba(6,6,7,.94);border-top:1px solid rgba(255,255,255,.07);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px)}'
      + '#rtBar[hidden]{display:none}'
      + '#rtBar button{flex:1;max-width:140px;display:flex;flex-direction:column;align-items:center;gap:6px;border:0;background:none;color:#7f858e;font:900 9.5px/1 -apple-system,sans-serif;letter-spacing:.18em;cursor:pointer;padding:4px 0}'
      + '#rtBar button svg{width:24px;height:24px}#rtBar button.on{color:var(--rtA)}'
      + (typeof c.ownNav === 'string' ? 'html.rt-on ' + c.ownNav + '{display:none!important}' : '')
      + 'html.rt-app body{padding-bottom:calc(env(safe-area-inset-bottom,0px) + 170px)!important}';
  }
  var ICON = {
    club: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 6l-6 6 6 6"/><path d="M4 12h9a7 7 0 0 1 7 7"/></svg>',
    today: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.2" fill="currentColor"/></svg>',
    history: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 20V12M10 20V8M15 20v-6M20 20V5"/></svg>',
    more: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/></svg>'
  };

  function card() { var d = null; try { d = C.card() } catch (e) { d = null } return d || { ey: 'TODAY', big: '—', sub: 'Open ALL to get set up.', btn: 'GET SET UP', hint: '' } }
  function html(d) {
    var h = '<div class="rt-in"><div class="rt-top"><div class="rt-brand"><img src="' + esc(C.icon) + '" alt=""><div style="min-width:0"><div class="rt-logo">' + esc(C.word) + ' <b>' + esc(C.word2 || 'RIVAL') + '</b></div><div class="rt-ver">' + esc(C.tag) + '</div></div></div>'
      + (C.acct ? '<button class="rt-acct" id="rtAcct" aria-label="Account">' + esc(C.initial ? C.initial() : '') + '</button>' : '') + '</div>'
      + '<div class="rt-hero" id="rtHero"><div class="rt-ey">' + esc(d.ey) + '</div><div class="rt-num' + (String(d.big).length > 9 ? ' rt-xl' : String(d.big).length > 6 ? ' rt-l' : '') + '">' + esc(d.big) + '</div>' + (d.small ? '<div class="rt-small">' + esc(d.small) + '</div>' : '')
      + (d.sub ? '<div class="rt-sub">' + esc(d.sub) + '</div>' : '');
    if (d.bar) h += '<div class="rt-bar"><i style="width:' + Math.max(2, Math.min(100, +d.bar.pct || 0)) + '%"></i></div><div class="rt-barl"><span>' + esc(d.bar.label) + '</span><span>' + esc(d.bar.right) + '</span></div>';
    /* CR071 · a spike meter on the card (Rest's night, Rise's morning). d.meter = {bars:[{v:0-100 or null, c:colour}], label, right} */
    if (d.meter && d.meter.bars && d.meter.bars.length) { var mb = d.meter.bars, mw = 1000 / mb.length; h += '<button type="button" class="rt-meter" id="rtMeter" aria-label="' + esc(d.meter.label || 'Meter') + '"><svg viewBox="0 0 1000 44" preserveAspectRatio="none" aria-hidden="true">' + mb.map(function (b, i) { var v = b.v == null ? 0 : Math.max(0, Math.min(100, +b.v)), hh = b.v == null ? 0 : Math.max(3, 42 * v / 100); return hh ? '<rect x="' + (i * mw).toFixed(1) + '" width="' + Math.max(1, mw - .8).toFixed(1) + '" y="' + (44 - hh).toFixed(1) + '" height="' + hh.toFixed(1) + '" fill="' + esc(b.c || 'var(--rtA)') + '"/>' : '' }).join('') + '</svg></button><div class="rt-barl"><span>' + esc(d.meter.label || '') + '</span><span>' + esc(d.meter.right || '') + '</span></div>' }
    if (d.vs && d.vs.length) h += '<div class="rt-vs">' + d.vs.map(function (x) { return '<div><div class="rt-k">' + esc(x[0]) + '</div><div class="rt-v' + (x[2] ? ' up' : '') + '">' + esc(x[1]) + (x[2] ? ' ▲' : '') + '</div></div>' }).join('') + '</div>';
    h += '</div><button class="rt-go" id="rtGo"' + (d.off ? ' disabled' : '') + '>' + esc(d.btn) + '</button>' + (d.hint ? '<div class="rt-hint">' + esc(d.hint) + '</div>' : '');
    /* RT006 · a short list under the button: today's pre-planned items with their times (Fuel's meals). One tap logs that one.
       d.list = {label, rows:[{id, t:'8:00 AM', name, sub, done, now}]} · the app's C.pick(id) does the logging */
    if (d.list && d.list.rows && d.list.rows.length) h += '<div class="rt-list"><div class="rt-ll">' + esc(d.list.label || 'TODAY') + '</div>' + d.list.rows.map(function (r) { return '<button type="button" class="rt-li' + (r.done ? ' done' : '') + (r.now ? ' now' : '') + (r.past ? ' past' : '') + '" data-pick="' + esc(r.id) + '"><span class="rt-lt">' + esc(r.t) + '</span><span class="rt-lm"><b>' + esc(r.name) + '</b>' + (r.sub ? '<em>' + esc(r.sub) + '</em>' : '') + '</span><span class="rt-lk">' + (r.done ? '✓' : 'LOG') + '</span></button>' }).join('') + '</div>';
    h += '</div>';
    return h;
  }
  function paint(force) {
    if (!lay || mode !== 'today') return; var d = card(), h = html(d); if (!force && h === last) return; last = h; lay.innerHTML = h;
    var g = D.getElementById('rtGo'); if (g) g.onclick = function () { var r; try { r = C.go(d) } catch (e) { } if (r === 'app') show('app'); else setTimeout(function () { paint(true) }, 400) };  /* 'app' = the main job runs in the full app (a workout, a drill) */
    [].forEach.call(lay.querySelectorAll('[data-pick]'), function (b) { b.onclick = function () { try { C.pick && C.pick(b.dataset.pick, b.classList.contains('done')) } catch (e) { } setTimeout(function () { paint(true) }, 400) } });
    var mt = D.getElementById('rtMeter'); if (mt) mt.onclick = function () { try { (C.meter || C.history)() } catch (e) { } };
    var a = D.getElementById('rtAcct'); if (a) a.onclick = function () { try { C.acct() } catch (e) { } };
  }
  function tabs() { if (!bar) return; [].forEach.call(bar.querySelectorAll('button'), function (b) { b.classList.toggle('on', b.dataset.t === mode); b.setAttribute('aria-selected', b.dataset.t === mode ? 'true' : 'false') }) }
  function show(t) {
    mode = t; var R = D.documentElement;
    if (t === 'today') { lay.hidden = false; R.classList.add('rt-on'); R.classList.remove('rt-app'); lay.scrollTop = 0; paint(true) }
    else { lay.hidden = true; R.classList.remove('rt-on'); R.classList.add('rt-app'); if (t !== 'app') try { (t === 'history' ? C.history : C.more || C.history)() } catch (e) { } }
    if (bar) bar.hidden = !!(C.ownNav && t !== 'today');  /* an app with its own bottom bar keeps it inside; its TODAY button comes back here */
    tabs(); try { sessionStorage.setItem('rt_' + C.app, t) } catch (e) { }
  }
  /* back to Club: the Club APP when this is the iPhone app (the orb kit knows how, with a website fallback), else the Club website */
  function goClub() { try { if (W.RivalOrb && W.RivalOrb.club) { W.RivalOrb.club(); return } } catch (e) { } location.href = 'https://clubrival.netlify.app/?from=' + encodeURIComponent(C.app || '') }
  function ready() { try { return !C.ready || !!C.ready() } catch (e) { return false } }
  function start() {
    if (lay) return;
    var st = D.createElement('style'); st.id = 'rtCss'; st.textContent = css(C); D.head.appendChild(st);
    lay = D.createElement('div'); lay.id = 'rtLay'; lay.setAttribute('role', 'main'); lay.setAttribute('aria-label', C.word + ' Rival · Today');
    bar = D.createElement('nav'); bar.id = 'rtBar'; bar.setAttribute('role', 'tablist');
    bar.innerHTML = (C.app === 'club' ? [] : [['club', 'CLUB']]).concat([['today', 'TODAY'], ['history', (C.tabs && C.tabs.history) || 'PROGRESS'], ['more', (C.tabs && C.tabs.more) || 'ALL']]).map(function (x) { return '<button role="tab" data-t="' + x[0] + '">' + ICON[x[0]] + x[1] + '</button>' }).join('');
    D.body.appendChild(lay); D.body.appendChild(bar);
    bar.addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; if (b.dataset.t === 'club') { goClub(); return } show(b.dataset.t) });
    var q = ''; try { q = location.search } catch (e) { }
    show(/[?&]do=/.test(q) && !/[?&]do=coach/.test(q) ? 'more' : 'today');   /* a deep link (voice, Siri, Club) goes straight to that spot */
    var wasReady = true; timer = setInterval(function () { if (!ready()) { wasReady = false; lay.hidden = true; bar.hidden = true; pillOn(true); D.documentElement.classList.remove('rt-on', 'rt-app'); return } if (!wasReady) { wasReady = true; pillOn(false); show('today') } paint(false) }, 1200);
    D.addEventListener('visibilitychange', function () { if (!D.hidden) paint(true) });
  }
  /* before the Today screen can run (signing in, first setup) there is still a way back: a small ‹ CLUB pill, bottom left */
  var pill = null;
  function pillOn(on) {
    if (!C || C.app === 'club') return;
    if (on && !pill && D.body) { pill = D.createElement('button'); pill.id = 'rtBack'; pill.type = 'button'; pill.textContent = '‹ CLUB'; pill.setAttribute('aria-label', 'Back to Club Rival');
      pill.style.cssText = 'position:fixed;left:14px;bottom:calc(env(safe-area-inset-bottom,0px) + 14px);z-index:2147483600;min-height:40px;padding:0 14px;border-radius:999px;border:1px solid rgba(255,255,255,.16);background:rgba(10,10,14,.86);color:#fff;font:900 11px/1 -apple-system,sans-serif;letter-spacing:.16em;-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);cursor:pointer';
      var ps = D.createElement('style'); ps.textContent = 'html body>#rtBack:not([hidden]){display:block!important;visibility:visible!important;opacity:1!important}'; D.head.appendChild(ps);  /* an app's own intro screen can hide everything else; never this */
      pill.onclick = goClub; D.body.appendChild(pill) }
    if (pill) pill.hidden = !on;
  }
  function mount(cfg) {
    C = cfg; var go = function () { if (!D.body) return setTimeout(go, 50); if (ready()) { pillOn(false); start() } else { pillOn(true); var w = setInterval(function () { if (ready()) { clearInterval(w); pillOn(false); start() } }, 700) } };
    if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', go); else go();
  }
  /* For an app that already has its own screens and bottom bar (Club): just the family card + big button, dropped into its home. */
  function inline(cfg, d, id) {
    if (!D.getElementById('rtCss')) { var st = D.createElement('style'); st.id = 'rtCss'; st.textContent = css(cfg); D.head.appendChild(st) }
    var keep = C; C = cfg; var h = html(d); C = keep;
    h = h.replace(/^<div class="rt-in"><div class="rt-top">[\s\S]*?<div class="rt-hero"/, '<div class="rt-in rt-inline"><div class="rt-hero"').replace('id="rtGo"', 'id="' + (id || 'rtGo') + '"');
    return h;
  }
  W.RivalToday = { mount: mount, inline: inline, show: function (t) { if (lay) show(t || 'today') }, mode: function () { return mode }, refresh: function () { paint(true) }, version: 'RT004' };
})();

/* CR071 · Coach E: "make sure we have swipe down screens ... a close button at the bottom and a swipe at the top, just like iPhone."
   Every pop-up sheet in every Rival app (#sh) gets: a grab bar at the top you can pull down to close, and a CLOSE button at the
   bottom if the sheet doesn't already end with one (DONE, CANCEL, BACK...). Closing goes through the app's own close, same as tapping outside. */
(function () {
  var W = window, D = document; if (W.__rtSwipe) return; W.__rtSwipe = 1;
  var CLOSEY = /^\s*(close|done|cancel|back|not now|no thanks|leave|keep|skip|got it|later|ok|okay|×|✕)\b/i;
  function sh() { var s = D.getElementById('sh'); if (!s) return null; var vis = s.classList.contains('on') || s.classList.contains('sh'); if (!vis) return null; return s }
  function panel(s) { return D.getElementById('shC') && s.contains(D.getElementById('shC')) ? D.getElementById('shC') : s.firstElementChild }
  function close(s) { s.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })) }
  function css() { if (D.getElementById('rtSwCss')) return; var st = D.createElement('style'); st.id = 'rtSwCss';
    st.textContent = '.rt-grab{display:flex;justify-content:center;align-items:center;height:26px;margin:-18px 0 6px;touch-action:none;cursor:grab}.rt-grab::before{content:"";width:42px;height:5px;border-radius:3px;background:rgba(140,140,150,.55)}'
      + '.rt-shx{display:block;width:100%;margin:14px 0 0;padding:16px;border-radius:16px;border:1px solid rgba(140,140,150,.35);background:transparent;color:inherit;font:900 12px/1 -apple-system,BlinkMacSystemFont,sans-serif;letter-spacing:.16em;cursor:pointer}';
    D.head.appendChild(st) }
  function decorate() { var s = sh(); if (!s) return; var p = panel(s); if (!p) return; css();
    if (!p.firstElementChild || !p.firstElementChild.classList.contains('rt-grab')) { var g = D.createElement('div'); g.className = 'rt-grab'; g.setAttribute('aria-hidden', 'true'); p.insertBefore(g, p.firstChild) }
    var bs = [].slice.call(p.querySelectorAll('button')).filter(function (b) { return !b.closest('.rt-grab') }), tail = bs.slice(-3), has = p.querySelector('.rt-shx') || p.querySelector('[data-x]') || tail.some(function (b) { return CLOSEY.test(b.textContent || '') });
    if (!has) { var x = D.createElement('button'); x.type = 'button'; x.className = 'rt-shx'; x.textContent = 'CLOSE'; x.onclick = function (e) { e.stopPropagation(); close(s) }; p.appendChild(x) }
    if (!s.__rtSw) wire(s) }
  function wire(s) { s.__rtSw = 1; var y0 = null, t0 = 0, dy = 0, p = null;
    s.addEventListener('touchstart', function (e) { p = panel(s); if (!p || !p.contains(e.target)) { y0 = null; return } var onGrab = e.target.closest && e.target.closest('.rt-grab');
      if (!onGrab && p.scrollTop > 0) { y0 = null; return } if (e.target.closest && e.target.closest('input,textarea,select,[contenteditable]')) { y0 = null; return }
      y0 = e.touches[0].clientY; t0 = Date.now(); dy = 0 }, { passive: true });
    s.addEventListener('touchmove', function (e) { if (y0 == null || !p) return; dy = e.touches[0].clientY - y0; if (dy <= 0) { p.style.transform = ''; if (dy < -6) y0 = null; return }
      if (p.scrollTop > 0) { y0 = null; p.style.transform = ''; return } e.preventDefault(); p.style.transition = 'none'; p.style.transform = 'translateY(' + dy + 'px)' }, { passive: false });
    s.addEventListener('touchend', function () { if (y0 == null || !p) return; var v = dy / Math.max(1, Date.now() - t0), q = p; y0 = null;
      if (dy > 120 || (dy > 50 && v > .6)) { q.style.transition = 'transform .22s ease-in'; q.style.transform = 'translateY(110%)'; setTimeout(function () { close(s); setTimeout(function () { q.style.transition = ''; q.style.transform = '' }, 60) }, 210) }
      else { q.style.transition = 'transform .2s ease-out'; q.style.transform = ''; setTimeout(function () { q.style.transition = '' }, 220) } }) }
  W.__rtSheetDecorate = decorate;
  var queued = 0; function q() { if (queued) return; queued = 1; (W.requestAnimationFrame || setTimeout)(function () { queued = 0; decorate() }) }
  function start() { try { new MutationObserver(q).observe(D.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] }) } catch (e) { } decorate() }
  if (D.body) start(); else D.addEventListener('DOMContentLoaded', start);
})();
