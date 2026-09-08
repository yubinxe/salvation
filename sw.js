const CACHE='salvation-v1';
const ASSETS=['./','./index.html','./manifest.webmanifest','./icons/apple-touch-icon-180.png','./icons/icon-192.png','./icons/icon-512.png','./icons/icon-maskable-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{const r=e.request;if(r.method!=='GET')return;e.respondWith(caches.match(r).then(c=>c||fetch(r).then(res=>{try{if(new URL(r.url).origin===location.origin){const cp=res.clone();caches.open(CACHE).then(ca=>ca.put(r,cp));}}catch(_){}return res;}).catch(()=>caches.match('./index.html'))));});
