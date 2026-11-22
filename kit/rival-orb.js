/* RIVAL ORB · OR004 - lives on the Club site (clubrival.netlify.app/kit/rival-orb.js). Every Rival app loads it from here,
   so a change to the Orb is ONE upload to Club - not one per app.
   - Tap the Orb: you're with the one Club coach, and it knows which app you came from.
     In the iPhone apps it opens the Club Rival APP (rivalclub://). If Club isn't on the phone, the Club website opens after a moment.
   - RivalOrb.deleteAccount(supabaseClient): the DELETE MY ACCOUNT sheet (Apple). Tap only, and you type DELETE. Voice never presses it.
   CareCircle keeps its own calm orb. */
(function () {
  var W = window, D = document; if (W.__rivalOrb) return; W.__rivalOrb = 1;
  var s = D.currentScript, app = (s && s.getAttribute('data-app')) || '', calm = !!(s && s.getAttribute('data-calm')), noOrb = !!(s && s.getAttribute('data-noorb'));
  var CLUB = 'https://clubrival.netlify.app/', VER = 'OR004';
  function inApp() { try { return !!(W.Capacitor && W.Capacitor.isNativePlatform && W.Capacitor.isNativePlatform()) } catch (e) { return false } }
  function web(q) { var back = location.href.split('#')[0]; location.href = CLUB + '?coach=1&from=' + encodeURIComponent(app) + (q ? '&say=' + encodeURIComponent(q) : '') + '&back=' + encodeURIComponent(back) }
  /* OR004 · go(q): a question said inside this app rides along, and the coach answers it as soon as Club opens */
  function go(q) {
    q = typeof q === 'string' ? q.slice(0, 300) : '';
    if (!inApp()) return web(q);
    var left = false, gone = function () { if (D.hidden) left = true }; D.addEventListener('visibilitychange', gone);
    location.href = 'rivalclub://open?do=coach&from=' + encodeURIComponent(app) + (q ? '&say=' + encodeURIComponent(q) : '');
    setTimeout(function () { D.removeEventListener('visibilitychange', gone); if (!left && !D.hidden) web(q) }, 1600);
  }
  /* open the Club Rival app itself (not the coach) - for "OPEN CLUB RIVAL" buttons */
  function club() {
    if (!inApp()) { location.href = CLUB; return }
    var left = false, gone = function () { if (D.hidden) left = true }; D.addEventListener('visibilitychange', gone);
    location.href = 'rivalclub://open?from=' + encodeURIComponent(app);
    setTimeout(function () { D.removeEventListener('visibilitychange', gone); if (!left && !D.hidden) location.href = CLUB }, 1600);
  }
  /* OR003 · ONE FAMILY. The Orb and the mic sit together as one Coach dock, bottom right, in THIS app's color -
     the same spot in every Rival app. It climbs above anything pinned to the bottom (a tab bar, a big button)
     and the page gets room at the end so nothing ever hides under it. */
  var ACC = { rise: '#ff9a3d', rest: '#5aa2ff', money: '#2fd27a', biz: '#3d8bff', mindrival: '#8b6cff', mind: '#8b6cff', stride: '#f0143f', rankup: '#e3262f', rep: '#e0b44a', fuel: '#ff7a59', club: '#ff9a3d' };
  var acc = (s && s.getAttribute('data-accent')) || ACC[app] || '#5aa2ff';
  function rgb(h) { h = h.replace('#', ''); return [0, 2, 4].map(function (i) { return parseInt(h.substr(i, 2), 16) }).join(',') }
  var A = rgb(acc);
  function put() {
    if (noOrb || D.getElementById('rvOrb') || !D.body) return;
    var st = D.createElement('style'); st.id = 'rvDockCss';
    st.textContent = ':root{--rvB:calc(env(safe-area-inset-bottom,0px) + 18px);--rvA:' + acc + ';--rvAr:' + A + '}'
      + 'body{padding-bottom:calc(env(safe-area-inset-bottom,0px) + 96px)!important}'
      + '#rvDock{position:fixed;right:10px;bottom:var(--rvB);z-index:2147480999;width:110px;height:56px;border-radius:30px;background:rgba(10,11,14,.78);border:1px solid rgba(255,255,255,.09);box-shadow:0 10px 30px rgba(0,0,0,.45);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);pointer-events:none;transition:bottom .25s ease}'
      + '#rvOrb{position:fixed;right:16px;bottom:calc(var(--rvB) + 6px);z-index:2147481000;width:44px;height:44px;border-radius:50%;border:0;padding:0;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:bottom .25s ease;'
      + 'background:radial-gradient(circle at 34% 30%,#fff 0,rgba(255,255,255,.85) 7%,rgba(' + A + ',1) 42%,rgba(' + A + ',.75) 70%,rgba(0,0,0,.55) 100%);box-shadow:0 0 0 1.5px rgba(255,255,255,.16),0 0 22px rgba(' + A + ',.55);animation:rvOrbB 3.2s ease-in-out infinite}'
      + '#rvOrb:active{transform:scale(.94)}@keyframes rvOrbB{50%{box-shadow:0 0 0 1.5px rgba(255,255,255,.22),0 0 34px rgba(' + A + ',.8)}}'
      + '#rvOrb span{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}'
      /* the mic (made by rival-voice.js) joins the dock, left of the Orb */
      + 'html body #rvMic{left:auto!important;right:66px!important;bottom:calc(var(--rvB) + 6px)!important;width:44px!important;height:44px!important;border:0!important;background:transparent!important;color:#fff!important;box-shadow:none!important;transition:bottom .25s ease}'
      + 'html body #rvMic.on{background:rgba(' + A + ',.9)!important;color:#0a0a0c!important}html body #rvMic.hear{background:#2fbf71!important}'
      + 'html body #rvCap{bottom:calc(var(--rvB) + 66px)!important;background:rgba(10,11,14,.92)!important;border:1px solid rgba(' + A + ',.45)}'
      + 'body.rv-off #rvDock{width:56px}body.drilling #rvDock{width:56px}'
      + 'html.rv-dock-away #rvDock,html.rv-dock-away #rvOrb,html.rv-dock-away body #rvMic{opacity:0!important;pointer-events:none!important}'
      + '@media (prefers-reduced-motion:reduce){#rvOrb{animation:none}}';
    if (calm) st.textContent += '#rvOrb{animation:none;opacity:.8}'; /* Rest Rival: no glow pulsing at bedtime */
    D.head.appendChild(st);
    var dk = D.createElement('div'); dk.id = 'rvDock'; dk.setAttribute('aria-hidden', 'true'); D.body.appendChild(dk);
    var b = D.createElement('button'); b.id = 'rvOrb'; b.type = 'button'; b.setAttribute('aria-label', 'Your coach'); b.innerHTML = '<span>Your coach</span>'; b.onclick = go; D.body.appendChild(b);
    place(); setInterval(place, 900); W.addEventListener('resize', place); W.addEventListener('scroll', place, { passive: true });
  }
  /* climb above anything that is pinned (fixed) at the bottom: a tab bar, or a button on a full-screen page */
  var lastB = -1;
  function mine(e) { return e && (e.id === 'rvOrb' || e.id === 'rvDock' || e.id === 'rvMic' || e.id === 'rvCap' || (e.closest && e.closest('#rvMic,#rvOrb,#rvDel'))) }
  function pinned(e) { for (var n = e; n && n !== D.body && n.nodeType === 1; n = n.parentElement) { var p = getComputedStyle(n).position; if (p === 'fixed' || p === 'sticky') return n } return null }
  function sheetish(n) { var c = ((n.className && n.className.baseVal != null ? n.className.baseVal : n.className) || '') + ' ' + (n.id || ''); return n.getAttribute('role') === 'dialog' || n.getAttribute('aria-modal') === 'true' || /(^|[\s_-])(sh|sheet|modal|dialog|scrim|overlay)([\s_-]|$)|^sh$|^rvDel$/i.test(c) }
  function place() {
    try {
      var H = W.innerHeight, Wd = W.innerWidth, safe = 18, y = H - safe, tries = 0;
      while (tries++ < 6) {
        var top = y - 56, hit = null;
        [[Wd - 30, y - 8], [Wd - 64, y - 28], [Wd - 104, y - 8], [Wd - 30, top + 6], [Wd - 104, top + 6]].forEach(function (pt) {
          if (hit || pt[1] < 0) return; var els = D.elementsFromPoint(pt[0], pt[1]);
          for (var k = 0; k < els.length; k++) {
            var e = els[k]; if (mine(e) || e === D.body || e === D.documentElement) continue;
            var pin = pinned(e); if (!pin) break;
            var r = pin.getBoundingClientRect();
            if (r.height < H * 0.45) { hit = r.top; break }  /* a bar */
            if (sheetish(pin)) { hit = -1; break }  /* a sheet or pop-up is open: the dock steps aside */
            var ctl = e.closest && e.closest('button,a,input,select,textarea,[role=button]');
            if (ctl && !mine(ctl)) { hit = ctl.getBoundingClientRect().top; break }  /* a button on a full-screen page */
            break;
          }
        });
        if (hit === -1) { y = -1; break }
        if (hit == null || hit >= y) break; y = hit - 10;
      }
      var hide = y === -1; D.documentElement.classList.toggle('rv-dock-away', hide); if (hide) return;
      var B = Math.max(safe, Math.round(H - y));
      if (B !== lastB) { lastB = B; D.documentElement.style.setProperty('--rvB', B === safe ? 'calc(env(safe-area-inset-bottom,0px) + 18px)' : B + 'px') }
    } catch (e) { }
  }

  /* ---------- DELETE MY ACCOUNT ---------- */
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] }) }
  function deleteAccount(sb) {
    if (D.getElementById('rvDel')) return;
    var st = D.getElementById('rvDelCss'); if (!st) { st = D.createElement('style'); st.id = 'rvDelCss'; st.textContent = '#rvDel{position:fixed;inset:0;z-index:2147483640;background:rgba(0,0,0,.72);display:flex;align-items:flex-end;justify-content:center;font:15px/1.45 -apple-system,system-ui,sans-serif}#rvDel .bx{background:#14161c;color:#eef1f6;width:100%;max-width:480px;border-radius:18px 18px 0 0;padding:22px 18px calc(18px + env(safe-area-inset-bottom));box-shadow:0 -10px 40px rgba(0,0,0,.5)}#rvDel h3{margin:0 0 8px;font-size:19px;letter-spacing:.02em}#rvDel p{margin:0 0 10px;color:#b9c0cc}#rvDel input{width:100%;box-sizing:border-box;font-size:18px;padding:12px;border-radius:10px;border:1px solid #3a404c;background:#0c0e12;color:#fff;letter-spacing:.12em;text-transform:uppercase;margin:6px 0 12px}#rvDel button{width:100%;padding:14px;border-radius:12px;border:0;font-weight:800;font-size:15px;letter-spacing:.06em;margin-top:8px;cursor:pointer}#rvDel .del{background:#d8383f;color:#fff}#rvDel .del:disabled{opacity:.4}#rvDel .no{background:#262a33;color:#eef1f6}#rvDel .msg{min-height:20px;color:#ffb3a8;font-weight:700}'; D.head.appendChild(st) }
    var o = D.createElement('div'); o.id = 'rvDel'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true');
    o.innerHTML = '<div class="bx"><h3>Delete my account</h3><p>This deletes your Rival account for good: Club Rival and every Rival app that uses it. Your history, XP, schedule, check-ins and plans go with it. A linked bank (Money) and a linked Gmail (Biz) are disconnected.</p><p>This can’t be undone. Type <b>DELETE</b> to confirm.</p><input id="rvDelT" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="Type DELETE"><div class="msg" id="rvDelM" role="status"></div><button class="del" id="rvDelGo" disabled>DELETE MY ACCOUNT</button><button class="no" id="rvDelNo">KEEP MY ACCOUNT</button></div>';
    D.body.appendChild(o);
    var t = D.getElementById('rvDelT'), go2 = D.getElementById('rvDelGo'), m = D.getElementById('rvDelM'), busy = false;
    function shut() { if (!busy) o.remove() }
    o.addEventListener('click', function (e) { if (e.target === o) shut() });
    D.getElementById('rvDelNo').onclick = shut;
    t.oninput = function () { go2.disabled = t.value.trim().toUpperCase() !== 'DELETE' };
    go2.onclick = async function () {
      if (busy || t.value.trim().toUpperCase() !== 'DELETE') return; busy = true; go2.disabled = true; m.textContent = 'Deleting…';
      try {
        var ss = sb && sb.auth ? (await sb.auth.getSession()).data.session : null;
        if (!ss) throw new Error('Sign in first, then delete.');
        var r = await fetch(CLUB + 'api/account', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + ss.access_token }, body: JSON.stringify({ confirm: 'DELETE', from: app }) });
        var j = {}; try { j = await r.json() } catch (e) { }
        if (!r.ok || !j.deleted) throw new Error(j.say || ('That didn’t delete (' + r.status + '). Try again.'));
        try { await sb.auth.signOut() } catch (e) { }
        try { localStorage.clear() } catch (e) { } try { sessionStorage.clear() } catch (e) { }
        o.querySelector('.bx').innerHTML = '<h3>Your account is deleted.</h3><p>Everything is gone. Thanks for training with us.</p><button class="no" id="rvDelOk">OK</button>';
        busy = false; D.getElementById('rvDelOk').onclick = function () { location.replace(location.pathname) };
      } catch (e) { busy = false; m.textContent = esc(e && e.message || e); go2.disabled = false }
    };
    setTimeout(function () { try { t.focus() } catch (e) { } }, 50);
  }

  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', put); else put(); setTimeout(put, 1500);
  W.RivalOrb = { open: go, club: club, deleteAccount: deleteAccount, version: VER };
})();
