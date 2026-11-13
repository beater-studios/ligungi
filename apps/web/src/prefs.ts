import { createStore } from './store.ts';

export type Lang = 'pt' | 'en' | 'es';
export type Theme = Prefs['theme'];
export const THEMES: readonly Theme[] = ['auto', 'light', 'dark'];
/** Board themes, as `gg-theme-<name>` classes of the board package; `wood` is its default look. */
export const BOARD_THEMES = ['wood', 'walnut', 'slate', 'contrast'] as const;
export type BoardTheme = (typeof BOARD_THEMES)[number];
/** lila zoom values (0 to 100) offered as board sizes. */
export const BOARD_SIZES = [40, 60, 80, 100] as const;

const nearestBoardSize = (zoom: unknown): number =>
  BOARD_SIZES.reduce((best, size) => (Math.abs(size - Number(zoom)) < Math.abs(best - Number(zoom)) ? size : best), 80);
export const LANGS: readonly Lang[] = ['pt', 'en', 'es'];

export interface Prefs {
  readonly lang: 'auto' | Lang;
  /** `local` follows the interface language; `ja` uses the Japanese readings. */
  readonly pieceNames: 'local' | 'ja';
  /** Marks around each piece showing how it moves. */
  readonly moveGuides: boolean;
  /** `illustrated` draws an icon per piece; `kanji` the character, as on the physical game. */
  readonly pieceStyle: 'illustrated' | 'kanji';
  /** Move list notation: the rulebook's (kanji), the same with piece names, or the machine notation. */
  readonly notation: 'rulebook' | 'named' | 'machine';
  readonly sound: boolean;
  readonly theme: 'auto' | 'light' | 'dark';
  readonly boardTheme: BoardTheme;
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
  moveGuides: true,
  pieceStyle: 'illustrated',
  notation: 'named',
  sound: true,
  theme: 'auto',
  boardTheme: 'wood',
  coordinates: true,
  animation: true,
  zoom: 80,
  hoverReach: true,
};

const load = (): Prefs => {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Record<keyof Prefs, unknown>>;
    const merged = { ...DEFAULTS, ...stored } as Prefs;
    // The beginner aids are the defaults for new visitors only: players who saved preferences before they existed
    // keep the board they knew (kanji, no movement guides) until they choose otherwise.
    const returning = Object.keys(stored).length > 0;
    return {
      ...merged,
      pieceNames: stored.pieceNames === 'ja' ? 'ja' : 'local',
      moveGuides: typeof stored.moveGuides === 'boolean' ? stored.moveGuides : !returning && DEFAULTS.moveGuides,
      pieceStyle:
        stored.pieceStyle === 'kanji' || stored.pieceStyle === 'illustrated' ? stored.pieceStyle : returning ? 'kanji' : DEFAULTS.pieceStyle,
      notation:
        stored.notation === 'rulebook' || stored.notation === 'named' || stored.notation === 'machine'
          ? stored.notation
          : returning
            ? 'rulebook'
            : DEFAULTS.notation,
      boardTheme: BOARD_THEMES.find((name) => name === stored.boardTheme) ?? DEFAULTS.boardTheme,
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
  const { theme, zoom, lang, boardTheme } = prefs.get();
  const light = theme === 'light' || (theme === 'auto' && Boolean(systemLight?.matches));
  const root = document.documentElement;
  root.classList.toggle('light', light);
  root.classList.toggle('dark', !light);
  root.style.colorScheme = light ? 'light' : 'dark';
  for (const name of BOARD_THEMES) root.classList.toggle(`gg-theme-${name}`, name === boardTheme);
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
