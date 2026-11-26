// Only cache the public shell, never the API or user credentials.
const CACHE='nivel-static-v591';
const ASSETS=['./','./index.html','./styles.css?v=591','./app.js?v=591','./domain/exercise-search.js','./domain/local-coach.js','./domain/routine-draft.js','./domain/day-planner.js','./data.json','./manifest.webmanifest','./icons/icon.svg'];
const allowed=new Set(ASSETS.map(p=>new URL(p,self.registration.scope).href));
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('nivel-static-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||!allowed.has(e.request.url)||e.request.headers.has('Authorization'))return;e.respondWith(fetch(e.request).then(r=>{if(r.ok){const copy=r.clone();e.waitUntil(caches.open(CACHE).then(c=>c.put(e.request,copy)));}return r;}).catch(()=>caches.match(e.request).then(r=>r||Response.error())));});
