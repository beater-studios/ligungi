import { createStore } from './store.ts';

export type Lang = 'pt' | 'en' | 'es';
export type Theme = Prefs['theme'];
export const THEMES: readonly Theme[] = ['auto', 'light', 'dark'];
/** lila zoom values (0 to 100) offered as board sizes. */
export const BOARD_SIZES = [40, 60, 80, 100] as const;

const nearestBoardSize = (zoom: unknown): number =>
  BOARD_SIZES.reduce((best, size) => (Math.abs(size - Number(zoom)) < Math.abs(best - Number(zoom)) ? size : best), 80);
export const LANGS: readonly Lang[] = ['pt', 'en', 'es'];

export interface Prefs {
  readonly lang: 'auto' | Lang;
  /** `local` follows the interface language; `ja` uses the Japanese readings. */
  readonly pieceNames: 'local' | 'ja';
  readonly sound: boolean;
  readonly theme: 'auto' | 'light' | 'dark';
  readonly coordinates: boolean;
  readonly animation: boolean;
  /** Board size, 0 to 100, as lila's zoom preference. */
  readonly zoom: number;
  /** Mark the squares a hovered piece could reach. */
  readonly hoverReach: boolean;
}

const KEY = 'ligungi.prefs';
const DEFAULTS: Prefs = {
  lang: 'auto',
  pieceNames: 'local',
  sound: true,
  theme: 'auto',
  coordinates: true,
  animation: true,
  zoom: 80,
  hoverReach: false,
};

const load = (): Prefs => {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Record<keyof Prefs, unknown>>;
    const merged = { ...DEFAULTS, ...stored } as Prefs;
    return {
      ...merged,
      pieceNames: stored.pieceNames === 'ja' ? 'ja' : 'local',
      // Older versions had a free 0-100 slider; snap those values to the sizes offered today.
      zoom: Number.isFinite(Number(stored.zoom)) ? nearestBoardSize(stored.zoom) : DEFAULTS.zoom,
      lang: merged.lang === 'auto' || LANGS.includes(merged.lang) ? merged.lang : 'auto',
    };
  } catch {
    return DEFAULTS;
  }
};

export const prefs = createStore<Prefs>(load());

const URL_LANG_KEY = 'ligungi.urlLang';

/**
 * `?lang=` in the address fixes the language for the tab (search results link to each language this way), so a
 * reload or a link without it keeps the language the visitor arrived in.
 */
const urlLang = (): Lang | undefined => {
  const value = new URLSearchParams(window.location.search).get('lang');
  const fromUrl = LANGS.find((lang) => lang === value);
  try {
    if (fromUrl) sessionStorage.setItem(URL_LANG_KEY, fromUrl);
    const stored = sessionStorage.getItem(URL_LANG_KEY);
    return fromUrl ?? LANGS.find((lang) => lang === stored);
  } catch {
    return fromUrl;
  }
};
const URL_LANG = urlLang();

const detectLang = (): Lang => {
  if (URL_LANG) return URL_LANG;
  const tags = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const tag of tags) {
    const base = tag?.toLowerCase().slice(0, 2) as Lang;
    if (LANGS.includes(base)) return base;
  }
  return 'en';
};

export const resolveLang = (lang: Prefs['lang']): Lang => (lang === 'auto' ? detectLang() : lang);

const systemLight = window.matchMedia?.('(prefers-color-scheme: light)');

/** lila themes: the default (dark) theme lives on :root, `html.light` switches to the light one. */
const apply = () => {
  const { theme, zoom, lang } = prefs.get();
  const light = theme === 'light' || (theme === 'auto' && Boolean(systemLight?.matches));
  const root = document.documentElement;
  root.classList.toggle('light', light);
  root.classList.toggle('dark', !light);
  root.style.colorScheme = light ? 'light' : 'dark';
  root.lang = { pt: 'pt-BR', en: 'en', es: 'es' }[resolveLang(lang)];
  document.body.style.setProperty('---zoom', String(zoom));
};
systemLight?.addEventListener('change', apply);
window.addEventListener('languagechange', apply);

prefs.subscribe(() => {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs.get()));
  } catch {}
  apply();
});
apply();

export const updatePrefs = (patch: Partial<Prefs>) => prefs.set((current) => ({ ...current, ...patch }));
