import { createStore } from './store.ts';

/**
 * Consent for the only optional processing on the site: Cloudflare Web Analytics. The session cookie is essential
 * and needs no consent. The beacon is loaded by the site only after acceptance, so a refusal is honored for real.
 */
export type Consent = 'accepted' | 'rejected' | null;

const KEY = 'ligungi.consent';
const TOKEN = import.meta.env.VITE_CF_ANALYTICS_TOKEN as string | undefined;

/** Without an analytics token there is nothing optional to consent to, so no banner is shown. */
export const ANALYTICS_AVAILABLE = Boolean(TOKEN);

const read = (): Consent => {
  try {
    const value = localStorage.getItem(KEY);
    return value === 'accepted' || value === 'rejected' ? value : null;
  } catch {
    return null;
  }
};

export const consent = createStore<Consent>(read());

let loaded = false;

const loadAnalytics = () => {
  if (loaded || !TOKEN) return;
  loaded = true;
  const script = document.createElement('script');
  script.defer = true;
  script.src = 'https://static.cloudflareinsights.com/beacon.min.js';
  script.dataset.cfBeacon = JSON.stringify({ token: TOKEN, spa: true });
  document.head.appendChild(script);
};

export const setConsent = (value: 'accepted' | 'rejected'): void => {
  const wasLoaded = loaded;
  try {
    localStorage.setItem(KEY, value);
  } catch {}
  consent.set(value);
  if (value === 'accepted') loadAnalytics();
  // A running beacon cannot be stopped; reloading starts the page again without it.
  else if (wasLoaded) window.location.reload();
};

if (consent.get() === 'accepted') loadAnalytics();
