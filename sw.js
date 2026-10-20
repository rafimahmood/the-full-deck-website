// Offline support for The Full Deck.
// Pages, scripts and the manifest go network-first, so a new deploy shows up straight away and the
// saved copy is only used offline (or when the network is very slow). Fonts and icons never change
// under the same name, so they come from the cache first.
const CACHE = 'fd-v1';
const NETWORK_TIMEOUT_MS = 4000;

// Everything the deck needs to open offline. Keep in step with the files the pages load.
const PRECACHE = [
  '/', '/index.html', '/deck-app.html', '/privacy.html', '/manifest.json',
  '/js/site.js', '/js/banner.js', '/js/consent.js', '/js/deck.js', '/js/games.js',
  '/fonts/alfa-slab-one.woff2', '/fonts/karla.woff2', '/fonts/space-mono-400.woff2', '/fonts/space-mono-700.woff2',
  '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png', '/favicon.svg', '/favicon-32.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('fd-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  // Only our own files. Never the sign-up API, Google, or anything that isn't a plain GET.
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  event.respondWith(/\.(woff2|png|svg)$/.test(url.pathname) ? cacheFirst(request) : networkFirst(request));
});

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  const saved = () => cache.match(request, { ignoreSearch: true });
  const network = fetch(request).then((response) => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  });
  network.catch(() => {}); // if the saved copy wins the race below, a later network failure isn't an error
  // On a very slow connection, show the saved copy if there is one rather than wait.
  const slow = new Promise((resolve) => setTimeout(resolve, NETWORK_TIMEOUT_MS)).then(() => saved()).then((hit) => hit || network);
  try {
    return await Promise.race([network, slow]);
  } catch {
    const hit = await saved();
    if (hit) return hit;
    if (request.mode === 'navigate') return (await cache.match('/deck-app.html')) || Response.error();
    return Response.error();
  }
}
