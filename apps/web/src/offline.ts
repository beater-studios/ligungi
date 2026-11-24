/**
 * The service worker (built by scripts/prerender.ts from scripts/sw.js) only answers page loads that fail for lack of
 * a connection, with a "no connection" page. It cannot read the preferences, so the app leaves the chosen language
 * where the worker can find it.
 */
const LANG_CACHE = 'ligungi-lang';
const LANG_KEY = '/offline/lang';

export const registerServiceWorker = (): void => {
  if (!('serviceWorker' in navigator)) return;
  const register = () => void navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
};

let remembered = '';

export const rememberOfflineLang = (lang: string): void => {
  if (lang === remembered || typeof caches === 'undefined') return;
  remembered = lang;
  caches
    .open(LANG_CACHE)
    .then((cache) => cache.put(LANG_KEY, new Response(lang)))
    .catch(() => undefined);
};
