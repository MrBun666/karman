// Service worker: офлайн-работа, обновления и приём файлов через «Поделиться»
importScripts('./js/version.js');

const CACHE = 'kalta-' + self.APP_VERSION;
const ASSETS = [
  './', './index.html', './manifest.webmanifest', './css/style.css',
  './js/version.js', './js/build-info.js', './js/native.js', './js/util.js', './js/db.js', './js/state.js', './js/finance.js',
  './js/kaspi.js', './js/ai.js', './js/lessons.js', './js/app.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' })))));
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('kalta-') && k !== CACHE && k !== 'kalta-cdn' && k !== 'kalta-share').map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
  if (e.data === 'GET_VERSION' && e.source) e.source.postMessage({ type: 'VERSION', version: self.APP_VERSION, notes: self.APP_NOTES });
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Файл или текст, отправленный в приложение через «Поделиться» (Android)
  if (e.request.method === 'POST' && url.pathname.endsWith('/share-target')) {
    e.respondWith((async () => {
      try {
        const fd = await e.request.formData();
        const file = fd.get('file');
        const text = [fd.get('title'), fd.get('text')].filter(Boolean).join('\n');
        const c = await caches.open('kalta-share');
        if (file && file.size) {
          await c.put('./shared-file', new Response(file, { headers: { 'content-type': file.type || 'application/octet-stream', 'x-name': encodeURIComponent(file.name || 'file') } }));
        }
        if (text) await c.put('./shared-text', new Response(text));
      } catch (err) { /* ignore */ }
      return Response.redirect('./?shared=1#import', 303);
    })());
    return;
  }

  if (e.request.method !== 'GET') return;
  if (url.hostname === 'api.anthropic.com') return;

  if (url.origin === location.origin) {
    e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(r => r || fetch(e.request)));
    return;
  }

  // Модуль чтения PDF с CDN: кешируем после первой загрузки
  if (url.hostname === 'cdnjs.cloudflare.com') {
    e.respondWith(caches.open('kalta-cdn').then(async c => {
      const hit = await c.match(e.request);
      if (hit) return hit;
      const res = await fetch(e.request);
      if (res.ok) c.put(e.request, res.clone());
      return res;
    }));
  }
});
