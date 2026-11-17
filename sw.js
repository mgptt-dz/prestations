/* Service worker – Prestations MGPTT. Page : réseau d'abord (contenu toujours à jour), cache en secours hors connexion. */
const VERSION = '20261116190000';
const PREFIX = 'mgptt-prestations-';
const CACHE = PREFIX + VERSION;
const CORE = ['./', './index.html', './manifest.json', './icons/icon-192.png', './icons/icon-512.png',
  './forms/Bulletin_adhesion_MGPTT_actif.pdf', './forms/Bulletin_adhesion_MGPTT_retraite.pdf',
  './forms/fond_actif.jpg', './forms/fond_retraite_1.jpg', './forms/fond_retraite_2.jpg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith(PREFIX) && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || req.headers.has('range')) return;
  const url = new URL(req.url);
  // 1) La page : réseau d'abord, puis copie en cache si hors connexion
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req, { cache: 'no-cache' }).then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put('./index.html', copy)); }
        return res;
      }).catch(() => caches.match('./index.html', { ignoreSearch: true }))
    );
    return;
  }
  // 2) Fichiers du site (icônes, bulletins PDF…) : cache d'abord
  if (url.origin === self.location.origin) {
    e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(res => {
      if (res.status === 200) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    })));
    return;
  }
  // 3) Polices Google : copie locale après la première visite
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(CACHE).then(c => c.match(req).then(hit => {
      const net = fetch(req).then(res => { if (res.ok) c.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    })));
  }
});
