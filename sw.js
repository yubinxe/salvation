const CACHE='salvation-v5';
const ASSETS=['./','./index.html','./manifest.webmanifest','./icons/apple-touch-icon-180.png','./icons/icon-192.png','./icons/icon-512.png','./icons/icon-maskable-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
  const r=e.request;
  if(r.method!=='GET')return;
  let u;try{u=new URL(r.url);}catch(_){return;}

  // CRM API는 캐시하지 않는다. 오프라인 캐시가 접수 응답을 대신하면 안 된다.
  if(u.origin===location.origin&&u.pathname.indexOf('/api/')===0)return;

  // 문서는 네트워크 우선. 배포한 index.html이 캐시에 막혀 안 내려가는 일을 막는다.
  const isDoc = r.mode==='navigate' || (r.headers.get('accept')||'').indexOf('text/html')>=0;
  if(isDoc){
    e.respondWith(
      fetch(r).then(res=>{
        try{ const cp=res.clone(); caches.open(CACHE).then(c=>c.put(r,cp)); }catch(_){}
        return res;
      }).catch(()=>caches.match(r).then(c=>c||caches.match('./index.html')))
    );
    return;
  }

  // 그 밖의 정적 자원은 캐시 우선.
  e.respondWith(caches.match(r).then(c=>c||fetch(r).then(res=>{try{if(u.origin===location.origin){const cp=res.clone();caches.open(CACHE).then(ca=>ca.put(r,cp));}}catch(_){}return res;}).catch(()=>caches.match('./index.html'))));
});
