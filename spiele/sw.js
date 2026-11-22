/* Offline-Unterstützung: erst Netzwerk, bei Fehler Cache */
const CACHE = 'spiele-v1';
const FILES = ['./', 'index.html', 'style.css', 'manifest.json', 'icon.svg', 'icon-192.png',
  'js/core.js', 'js/solitaer.js', 'js/mahjong.js', 'js/sudoku.js', 'js/holdem.js', 'js/nonogramm.js', 'js/app.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then(r => {
    const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
