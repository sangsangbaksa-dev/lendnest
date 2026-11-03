var V='lendnest-v5',F=['./','index.html','style.css','core.js','i18n.js','app.js','../icon.svg','../icon-192.png','../icon-512.png','../manifest.webmanifest'];
self.addEventListener('install',function(e){e.waitUntil(caches.open(V).then(function(c){return c.addAll(F)}).then(function(){return self.skipWaiting()}))});
self.addEventListener('activate',function(e){e.waitUntil(caches.keys().then(function(k){return Promise.all(k.filter(function(x){return x!==V}).map(function(x){return caches.delete(x)}))}).then(function(){return self.clients.claim()}))});
/* stale-while-revalidate: instant from cache, refreshed in the background (new version applies on the next open) */
self.addEventListener('fetch',function(e){if(e.request.method!=='GET')return;e.respondWith(caches.open(V).then(function(c){return c.match(e.request).then(function(hit){var net=fetch(e.request).then(function(r){if(r.ok)c.put(e.request,r.clone());return r});return hit||net.catch(function(){return hit})})}))});
