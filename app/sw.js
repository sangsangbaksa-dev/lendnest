var V='lendnest-v11',F=['./','index.html','style.css','core.js','i18n.js','app.js','../icon.svg','../icon-192.png','../icon-512.png','../manifest.webmanifest'];
self.addEventListener('install',function(e){e.waitUntil(caches.open(V).then(function(c){return c.addAll(F)}).then(function(){return self.skipWaiting()}))});
self.addEventListener('activate',function(e){e.waitUntil(caches.keys().then(function(k){return Promise.all(k.filter(function(x){return x.indexOf('lendnest-')===0&&x!==V}).map(function(x){return caches.delete(x)}))}).then(function(){return self.clients.claim()}))});
/* Stale-while-revalidate. Keep background work alive and handle offline failures even when a cached response wins. */
self.addEventListener('fetch',function(e){
  var u=new URL(e.request.url);
  if(e.request.method!=='GET'||u.origin!==self.location.origin||u.pathname.indexOf('/api/')===0)return;
  var cache=caches.open(V);
  var network=fetch(e.request).then(function(r){
    if(!r.ok)return r;
    return cache.then(function(c){return c.put(e.request,r.clone())}).catch(function(){}).then(function(){return r});
  });
  e.waitUntil(network.then(function(){},function(){}));
  e.respondWith(cache.then(function(c){return c.match(e.request)}).catch(function(){}).then(function(hit){return hit||network}));
});
