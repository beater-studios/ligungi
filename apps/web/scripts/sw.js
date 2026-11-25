// Template of /sw.js: scripts/prerender.ts replaces the BUILD line and writes the result to dist/sw.js.
// Online, every page load goes to the network as before. Without a connection, a page shows the "no connection" page
// in the visitor's language. In the installed app (the page says so with a `keep-offline` message), the pages that
// need no server (the computer, the lessons, the analysis board and the rules) are kept with the app's code, styles
// and fonts, and open offline; there the "no connection" page also links to them. A browser tab keeps nothing else.
const BUILD = { cache: 'ligungi-offline-dev', langs: ['en'], assets: [], pages: [] };

const LANG_CACHE = 'ligungi-lang';
const LANG_KEY = '/offline/lang';
/** Present in a cache once the offline pages are kept in it. */
const KEPT_KEY = '/offline/app/kept';
const pageOf = (lang) => `/offline/${lang}.html`;
const appPageOf = (lang) => `/offline/${lang}.app.html`;
/** Where an offline page is kept: by language and slug, `shell` standing for the routes below a page (a lesson). */
const appKey = (lang, slug) => `/offline/app/${lang}/${slug}`;
const STATIC = ['/favicon.svg', '/manifest.webmanifest', '/icon-192.png'];

/** The kept page for a path, or null when the path needs the server. */
const offlineSlug = (pathname) => {
  const [, first, rest] = pathname.match(/^\/([a-z]+)(\/.*)?$/) ?? [];
  if (!first || !BUILD.pages.includes(first)) return null;
  return rest && rest !== '/' ? 'shell' : first;
};

const isKept = async (cache) => Boolean(await cache.match(KEPT_KEY));

/** Keeps the app's files and the offline pages in this version's cache, once. */
const keepApp = async () => {
  const cache = await caches.open(BUILD.cache);
  if (await isKept(cache)) return;
  await cache.addAll([...BUILD.langs.map(appPageOf), ...STATIC, ...BUILD.assets]);
  // The pages are fetched by their address, as the server only serves them that way; a deeper path gets the shell.
  const pages = BUILD.langs.flatMap((lang) => [
    ...BUILD.pages.map((slug) => [appKey(lang, slug), `/${slug}?lang=${lang}`]),
    [appKey(lang, 'shell'), `/${BUILD.pages[0]}/offline?lang=${lang}`],
  ]);
  await Promise.all(
    pages.map(async ([key, url]) => {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error(`${url}: ${response.status}`);
      await cache.put(key, response);
    }),
  );
  await cache.put(KEPT_KEY, new Response('1'));
};

/** Whether an earlier version kept the offline pages: the app is installed, so the new version keeps them too. */
const keptBefore = async () => {
  for (const name of await caches.keys()) {
    if (name.startsWith('ligungi-offline-') && name !== BUILD.cache && (await isKept(await caches.open(name)))) return true;
  }
  return false;
};

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(BUILD.cache);
      await cache.addAll(BUILD.langs.map(pageOf));
      if (await keptBefore()) await keepApp();
      await self.skipWaiting();
    })(),
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

self.addEventListener('message', (event) => {
  if (event.data?.t === 'keep-offline') event.waitUntil(keepApp().catch(() => undefined));
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

/**
 * Hashed build files never change under the same name: the kept copy first, else the network. In the installed app,
 * files loaded later (sounds, flags) are kept too, so they also work offline.
 */
const fromAssets = async (request) => {
  const cache = await caches.open(BUILD.cache);
  const kept = await cache.match(request);
  if (kept) return kept;
  const response = await fetch(request);
  if (response.ok && response.type === 'basic' && (await isKept(cache))) await cache.put(request, response.clone());
  return response;
};

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(fromAssets(request));
    return;
  }
  if (request.mode !== 'navigate') return;
  event.respondWith(
    (async () => {
      try {
        return (await event.preloadResponse) ?? (await fetch(request));
      } catch {
        const lang = await langFor(url);
        const cache = await caches.open(BUILD.cache);
        if (await isKept(cache)) {
          const slug = offlineSlug(url.pathname);
          const page = (slug && (await cache.match(appKey(lang, slug)))) || (await cache.match(appPageOf(lang)));
          if (page) return page;
        }
        return (await cache.match(pageOf(lang))) ?? Response.error();
      }
    })(),
  );
});
