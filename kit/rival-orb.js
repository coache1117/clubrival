/* RIVAL ORB · OR002 - lives on the Club site (clubrival.netlify.app/kit/rival-orb.js). Every Rival app loads it from here,
   so a change to the Orb is ONE upload to Club - not one per app.
   - Tap the Orb: you're with the one Club coach, and it knows which app you came from.
     In the iPhone apps it opens the Club Rival APP (rivalclub://). If Club isn't on the phone, the Club website opens after a moment.
   - RivalOrb.deleteAccount(supabaseClient): the DELETE MY ACCOUNT sheet (Apple). Tap only, and you type DELETE. Voice never presses it.
   CareCircle keeps its own calm orb. */
(function () {
  var W = window, D = document; if (W.__rivalOrb) return; W.__rivalOrb = 1;
  var s = D.currentScript, app = (s && s.getAttribute('data-app')) || '', calm = !!(s && s.getAttribute('data-calm')), noOrb = !!(s && s.getAttribute('data-noorb'));
  var CLUB = 'https://clubrival.netlify.app/', VER = 'OR002';
  function inApp() { try { return !!(W.Capacitor && W.Capacitor.isNativePlatform && W.Capacitor.isNativePlatform()) } catch (e) { return false } }
  function web() { var back = location.href.split('#')[0]; location.href = CLUB + '?coach=1&from=' + encodeURIComponent(app) + '&back=' + encodeURIComponent(back) }
  function go() {
    if (!inApp()) return web();
    var left = false, gone = function () { if (D.hidden) left = true }; D.addEventListener('visibilitychange', gone);
    location.href = 'rivalclub://open?do=coach&from=' + encodeURIComponent(app);
    setTimeout(function () { D.removeEventListener('visibilitychange', gone); if (!left && !D.hidden) web() }, 1600);
  }
  /* open the Club Rival app itself (not the coach) - for "OPEN CLUB RIVAL" buttons */
  function club() {
    if (!inApp()) { location.href = CLUB; return }
    var left = false, gone = function () { if (D.hidden) left = true }; D.addEventListener('visibilitychange', gone);
    location.href = 'rivalclub://open?from=' + encodeURIComponent(app);
    setTimeout(function () { D.removeEventListener('visibilitychange', gone); if (!left && !D.hidden) location.href = CLUB }, 1600);
  }
  function put() {
    if (noOrb || D.getElementById('rvOrb') || !D.body) return;
    var st = D.createElement('style'); st.textContent = '#rvOrb{position:fixed;right:10px;bottom:calc(env(safe-area-inset-bottom) + 170px);z-index:2147481000;width:44px;height:44px;border-radius:50%;border:0;padding:0;cursor:pointer;background:radial-gradient(circle at 34% 30%,#fff 0,#bfe0ff 10%,#4aa3ff 38%,#1546c9 72%,#0a1f66 100%);box-shadow:0 0 0 2px rgba(255,255,255,.18),0 8px 24px rgba(30,100,255,.45),0 0 28px rgba(80,160,255,.35);animation:rvOrbB 3.2s ease-in-out infinite}#rvOrb:active{transform:scale(.94)}@keyframes rvOrbB{50%{box-shadow:0 0 0 2px rgba(255,255,255,.22),0 8px 28px rgba(30,100,255,.6),0 0 40px rgba(80,160,255,.5)}}@media (prefers-reduced-motion:reduce){#rvOrb{animation:none}}#rvOrb span{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}';
    if (calm) st.textContent += '#rvOrb{animation:none;opacity:.55;filter:saturate(.6)}'; /* Rest Rival: no glow pulsing at bedtime */
    D.head.appendChild(st); var b = D.createElement('button'); b.id = 'rvOrb'; b.type = 'button'; b.setAttribute('aria-label', 'Your coach'); b.innerHTML = '<span>Your coach</span>'; b.onclick = go; D.body.appendChild(b);
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
