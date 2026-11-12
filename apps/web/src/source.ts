/** Repository of the running code (AGPL source offer). Forks set VITE_SOURCE_URL at build time. */
export const SOURCE_URL =
  (import.meta.env.VITE_SOURCE_URL as string | undefined) ?? 'https://github.com/beater-studios/ligungi';
