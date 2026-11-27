// Service worker : permet l'installation et un fonctionnement hors ligne simple.
// Si vous modifiez les fichiers, changez le numéro de version ci-dessous.
const C = 'attension-v19', F = ['./', 'index.html', 'style.css', 'app.js', 'config.js', 'data.js', 'supa.js', 'sync.js', 'privacy.js', 'i18n.js', 'aide.js', 'export.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];
self.addEventListener('install', e => e.waitUntil(caches.open(C).then(c => c.addAll(F))));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return; // seulement nos fichiers : les données de santé (API Supabase) ne sont jamais mises en cache
  e.respondWith(fetch(e.request).then(r => { const x = r.clone(); caches.open(C).then(c => c.put(e.request, x)); return r; }).catch(() => caches.match(e.request)));
});
