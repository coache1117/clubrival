/* CLUB RIVAL service worker · CR036 - opens with no signal once it has been opened once. */
var CACHE='club-rival-cr031';
var CORE=['./','index.html','lib/supabase.js','lib/rest-core.js','icon-192.png','site.webmanifest','art/stride.jpg','art/rep.jpg','art/rankup.jpg','art/mind.jpg','art/bmx.jpg','art/trail.jpg','art/rest.jpg','art/club.jpg'];
self.addEventListener('install',function(e){e.waitUntil(caches.open(CACHE).then(function(c){return c.addAll(CORE)}).then(function(){return self.skipWaiting()}))});
self.addEventListener('activate',function(e){e.waitUntil(caches.keys().then(function(k){return Promise.all(k.filter(function(x){return x!==CACHE}).map(function(x){return caches.delete(x)}))}).then(function(){return self.clients.claim()}))});
self.addEventListener('fetch',function(e){var r=e.request;if(r.method!=='GET')return;
  if(r.mode==='navigate'){e.respondWith(fetch(r).then(function(res){var c=res.clone();caches.open(CACHE).then(function(x){x.put('index.html',c)});return res}).catch(function(){return caches.match('index.html')}));return}
  if(new URL(r.url).origin!==location.origin)return;
  e.respondWith(fetch(r).then(function(res){if(res.ok){var c=res.clone();caches.open(CACHE).then(function(x){x.put(r,c)})}return res}).catch(function(){return caches.match(r)}))});
