/* Service worker: guarda la "cáscara" de la app para que abra rápido.
   Los datos viven en Supabase y NUNCA se guardan aquí. */
var CACHE = 'prestamos-v2';
var SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png'
];
var CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4';

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);

  // Librería de Supabase (CDN): primero caché, así la app abre sin esperar
  if (req.url.indexOf(CDN) === 0) {
    e.respondWith(
      caches.match(req).then(function (hit) {
        return hit || fetch(req).then(function (res) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
          return res;
        });
      })
    );
    return;
  }

  // Cualquier otro sitio (la API de Supabase, login, datos): no se toca
  if (url.origin !== location.origin) return;

  // Páginas: primero red (para recibir actualizaciones), si no hay internet usa lo guardado
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put('./index.html', copy); });
        return res;
      }).catch(function () {
        return caches.match('./index.html');
      })
    );
    return;
  }

  // Íconos y manifiesto: caché con actualización en segundo plano
  e.respondWith(
    caches.match(req).then(function (hit) {
      var net = fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
        return res;
      }).catch(function () { return hit; });
      return hit || net;
    })
  );
});
