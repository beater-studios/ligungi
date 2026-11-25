/**
 * The service worker (built by scripts/prerender.ts from scripts/sw.js) answers page loads that fail for lack of a
 * connection. In the installed app it also keeps the pages that need no server, so they open offline; in a browser
 * tab it only shows the "no connection" page. It cannot read the preferences nor tell how the site was opened, so the
 * app leaves the chosen language where the worker can find it and asks it to keep the offline pages when installed.
 */
const LANG_CACHE = 'ligungi-lang';
const LANG_KEY = '/offline/lang';

/** The site runs as an installed app (its own window), not in a browser tab. */
export const isInstalledApp = (): boolean =>
  ['standalone', 'window-controls-overlay', 'minimal-ui', 'fullscreen'].some((mode) => window.matchMedia?.(`(display-mode: ${mode})`).matches) ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

const keepOffline = (): void => {
  void navigator.serviceWorker.ready.then((registration) => registration.active?.postMessage({ t: 'keep-offline' })).catch(() => undefined);
};

export const registerServiceWorker = (): void => {
  if (!('serviceWorker' in navigator)) return;
  const register = () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then(() => {
        if (isInstalledApp()) keepOffline();
      })
      .catch(() => undefined);
  };
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
  // Installed from this tab: keep the offline pages now, so the app works offline from its first launch.
  window.addEventListener('appinstalled', keepOffline);
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
