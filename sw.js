/**
 * sw.js: keeps a copy of the app's screens on the device, so it opens fast and still opens
 * when GitHub Pages is briefly down. Data is never cached: every request to the Apps Script
 * backend goes to the network.
 *
 * AFTER CHANGING ANY APP FILE, raise CACHE_VERSION (e.g. v1.1.3) so devices pick up the change,
 * and set the same number in VERSION at the top of js/app.js (it shows on the login box).
 */
const CACHE_VERSION = 'doctrack-v1.5.9';
const FILES = [
  './', 'index.html', 'readme.html', 'config.js', 'manifest.webmanifest', 'css/app.css',
  'js/api.js', 'js/ui.js', 'js/signature.js', 'js/qr.js', 'js/print.js', 'js/views.js', 'js/app.js', 'js/help.js', 'js/changelog.js', 'js/readme.js',
  'vendor/qrcode.js', 'vendor/jsQR.js',
  'assets/logos/trc-dulag.png', 'assets/logos/header-white.png', 'assets/logos/header-black.png',
  'assets/wallpaper/login.jpg', 'assets/icons/icon-192.png', 'assets/icons/apple-touch-icon.png',
  'assets/fonts/Barlow-Regular.ttf', 'assets/fonts/Barlow-Medium.ttf', 'assets/fonts/Barlow-SemiBold.ttf', 'assets/fonts/Barlow-Bold.ttf'
];

self.addEventListener('install', e => {
  // cache: 'reload' skips the browser's own cache, so a new version never installs old copies of files.
  e.waitUntil(caches.open(CACHE_VERSION).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// 1.5.9: app files open from the copy on the device (fast, even on slow mobile data). A new version arrives
// when CACHE_VERSION above changes: the browser checks this file on each open, downloads the new set in the
// background, and the app switches to it (see start() in js/app.js).
// config.js is always asked from the network first, so a new apiUrl works without a new version.
// Requests to other sites (the Apps Script backend) are not touched.
const fromNet = req => fetch(req, { cache: 'no-cache' })
  .then(res => { if (res.ok) { const copy = res.clone(); caches.open(CACHE_VERSION).then(c => c.put(req, copy)); } return res; });
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (/\/config\.js$/.test(url.pathname)) {
    e.respondWith(fromNet(e.request).catch(() => caches.match(e.request, { ignoreSearch: true })));
    return;
  }
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true })
      .then(hit => hit || fromNet(e.request))
      .catch(() => caches.match(e.request.mode === 'navigate' ? 'index.html' : e.request, { ignoreSearch: true }))
  );
});
