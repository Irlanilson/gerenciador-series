const CACHE_NAME='gerenciador_series_v2';
const FILES=['./','index.html','style.css','app.js','sync.js','config.js','manifest.json','icon-192.png','icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(FILES)));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))));self.clients.claim()});
self.addEventListener('fetch',e=>{
 // Não cachear chamadas à API do TMDB
 if(e.request.url.includes('api.themoviedb.org')){e.respondWith(fetch(e.request));return}
 e.respondWith(caches.match(e.request).then(c=>c||fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE_NAME).then(cache=>cache.put(e.request,copy));return r}).catch(()=>caches.match('index.html'))));
});
