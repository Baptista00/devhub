/* Keep each release together. Bump VERSION whenever an app-shell file changes. */
var VERSION = 'v1.0.1';
var PREFIX = 'lucas-dev-hub-';
// Separate deployments in subdirectories must not delete each other's caches.
var CACHE_PREFIX = PREFIX + encodeURIComponent(self.registration.scope) + '-';
var CACHE = CACHE_PREFIX + VERSION;
var FILES = [
  './', 'index.html', 'manifest.json',
  'css/reset.css', 'css/variables.css', 'css/base.css', 'css/layout.css', 'css/components.css', 'css/responsive.css',
  'assets/icons/logo.svg', 'assets/icons/favicon.svg', 'assets/icons/apple-touch-icon.png', 'assets/icons/icon-192.png', 'assets/icons/icon-512.png',
  'js/config.js', 'js/utils/time.js', 'js/services/storage.js', 'js/state.js', 'js/utils/dom.js',
  'js/modules/timer.js', 'js/modules/stats.js', 'js/modules/history.js', 'js/modules/tasks.js',
  'js/modules/notes.js', 'js/modules/settings.js', 'js/modules/focus.js', 'js/modules/dashboard.js', 'js/app.js'
];
self.addEventListener('install', function (event) {
  event.waitUntil(caches.open(CACHE).then(function (cache) {
    // A new release must not copy older files from the browser's HTTP cache.
    return cache.addAll(FILES.map(function (file) { return new Request(file, { cache: 'reload' }); }));
  }));
});
self.addEventListener('activate', function (event) {
  event.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (key) { return key.indexOf(CACHE_PREFIX) === 0 && key !== CACHE; })
      .map(function (key) { return caches.delete(key); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (request.method !== 'GET' || request.url.indexOf(self.registration.scope) !== 0) return;
  event.respondWith(caches.open(CACHE).then(function (cache) {
    if (request.mode === 'navigate') return cache.match('index.html').then(function (cached) { return cached || fetch(request); });
    return cache.match(request).then(function (cached) { return cached || fetch(request); });
  }));
});
