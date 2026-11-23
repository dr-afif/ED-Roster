/* RESQ Workforce & Roster Service Worker */
const CACHE_VERSION = 'resq-ed-pwa-v3';
const IS_DEV_TUNNEL =
  self.location.hostname === 'localhost' ||
  self.location.hostname === '127.0.0.1' ||
  self.location.hostname.endsWith('.ngrok-free.dev') ||
  self.location.hostname.endsWith('.ngrok.io') ||
  self.location.hostname.endsWith('.trycloudflare.com');

const APP_SHELL_URLS = [
  './manifest.webmanifest',
  './ed-crest.png',
  './pwa-192x192.png',
  './pwa-512x512.png',
  './apple-touch-icon.png',
  './favicon.svg',
];

self.addEventListener('install', (event) => {
  if (IS_DEV_TUNNEL) {
    event.waitUntil(self.skipWaiting());
    return;
  }
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL_URLS))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => IS_DEV_TUNNEL || k !== CACHE_VERSION).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function isBypassRequest(request) {
  if (IS_DEV_TUNNEL) return true;
  if (request.method !== 'GET') return true;
  let url;
  try {
    url = new URL(request.url);
  } catch {
    return true;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return true;
  if (url.origin !== self.location.origin) return true;

  const p = url.pathname;
  if (
    p.startsWith('/@') ||
    p.startsWith('/src/') ||
    p.startsWith('/node_modules/') ||
    p.includes('/auth/v1/') ||
    p.includes('/rest/v1/') ||
    p.includes('/rpc/')
  ) {
    return true;
  }
  if (url.searchParams.has('t') || url.searchParams.has('v')) {
    return true;
  }
  return false;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (isBypassRequest(request)) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches
              .open(CACHE_VERSION)
              .then((cache) => cache.put('./', copy))
              .catch(() => {});
          }
          return response;
        })
        .catch(() => caches.match('./').then((cached) => cached || Response.error())),
    );
    return;
  }

  const url = new URL(request.url);
  const isCacheableStatic =
    url.pathname.includes('/assets/') ||
    /\.(?:png|svg|ico|webmanifest|woff2?)$/i.test(url.pathname);

  if (isCacheableStatic) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) {
          fetch(request)
            .then((response) => {
              if (response && response.ok && response.type === 'basic') {
                caches
                  .open(CACHE_VERSION)
                  .then((cache) => cache.put(request, response))
                  .catch(() => {});
              }
            })
            .catch(() => {});
          return cached;
        }
        return fetch(request).then((response) => {
          if (response && response.ok && response.type === 'basic') {
            const copy = response.clone();
            caches
              .open(CACHE_VERSION)
              .then((cache) => cache.put(request, copy))
              .catch(() => {});
          }
          return response;
        });
      }),
    );
  }
});
