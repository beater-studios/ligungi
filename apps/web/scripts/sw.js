// Template of /sw.js: scripts/prerender.ts replaces the BUILD line and writes the result to dist/sw.js.
// The worker only steps in when a page load fails for lack of a connection, answering with the "no connection" page
// in the visitor's language. Everything else goes to the network untouched: nothing else is cached.
const BUILD = { cache: 'ligungi-offline-dev', langs: ['en'] };

const LANG_CACHE = 'ligungi-lang';
const LANG_KEY = '/offline/lang';
const pageOf = (lang) => `/offline/${lang}.html`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(BUILD.cache)
      .then((cache) => cache.addAll(BUILD.langs.map(pageOf)))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) {
        if (name.startsWith('ligungi-offline-') && name !== BUILD.cache) await caches.delete(name);
      }
      if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
      await self.clients.claim();
    })(),
  );
});

const offered = (lang) => (lang && BUILD.langs.includes(lang) ? lang : undefined);

/** The language the app left in the cache, else `?lang=`, else the browser's languages, else English. */
const langFor = async (url) => {
  const chosen = await caches.match(LANG_KEY, { cacheName: LANG_CACHE });
  const browser = (self.navigator.languages ?? []).map((tag) => tag.toLowerCase().split('-')[0]);
  return (
    offered(chosen && (await chosen.text())) ??
    offered(url.searchParams.get('lang')) ??
    browser.map(offered).find(Boolean) ??
    'en'
  );
};

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.mode !== 'navigate' || request.method !== 'GET') return;
  const url = new URL(request.url);
  event.respondWith(
    (async () => {
      try {
        return (await event.preloadResponse) ?? (await fetch(request));
      } catch {
        const page = await caches.match(pageOf(await langFor(url)), { cacheName: BUILD.cache });
        return page ?? Response.error();
      }
    })(),
  );
});
