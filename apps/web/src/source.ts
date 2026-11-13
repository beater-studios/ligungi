/** Repository of the running code (AGPL source offer). Forks set VITE_SOURCE_URL at build time. */
export const SOURCE_URL =
  (import.meta.env.VITE_SOURCE_URL as string | undefined) ?? 'https://github.com/beater-studios/ligungi';

/** Public address of the site, the base of canonical, Open Graph and sitemap URLs. Forks set VITE_SITE_URL. */
export const SITE_URL = ((import.meta.env.VITE_SITE_URL as string | undefined) ?? 'https://ligungi.org').replace(/\/$/, '');
