/**
 * sw.js: keeps a copy of the app's screens on the device, so it opens fast and still opens
 * when GitHub Pages is briefly down. Data is never cached: every request to the Apps Script
 * backend goes to the network.
 *
 * AFTER CHANGING ANY APP FILE, raise CACHE_VERSION (e.g. v1.0.1) so devices pick up the change.
 */
const CACHE_VERSION = 'doctrack-v1.0.4';
const FILES = [
  './', 'index.html', 'config.js', 'manifest.webmanifest', 'css/app.css',
  'js/api.js', 'js/ui.js', 'js/signature.js', 'js/qr.js', 'js/print.js', 'js/views.js', 'js/app.js',
  'vendor/qrcode.js', 'vendor/jsQR.js',
  'assets/logos/trc-dulag.png', 'assets/logos/header-white.png', 'assets/logos/header-black.png',
  'assets/wallpaper/login.jpg', 'assets/icons/icon-192.png', 'assets/icons/apple-touch-icon.png',
  'assets/fonts/Barlow-Regular.ttf', 'assets/fonts/Barlow-Medium.ttf', 'assets/fonts/Barlow-SemiBold.ttf', 'assets/fonts/Barlow-Bold.ttf'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// App files: network first (so updates show at once), cached copy when offline.
// Requests to other sites (the Apps Script backend) are not touched.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then(res => { const copy = res.clone(); caches.open(CACHE_VERSION).then(c => c.put(e.request, copy)); return res; })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('index.html')))
  );
});
