import { PIECE_STYLES, type PieceStyle } from '@ligungi/board';
import { customBoardStyle, DEFAULT_CUSTOM_BOARD, isHexColor, type CustomBoard } from './boardColors.ts';
import { customPieceStyle, DEFAULT_CUSTOM_PIECES, type CustomPieces } from './pieceColors.ts';
import { createStore } from './store.ts';

export type Lang = 'pt' | 'en' | 'es';
export type Theme = Prefs['theme'];
export const THEMES: readonly Theme[] = ['auto', 'light', 'dark'];
/** Board themes, as `gg-theme-<name>` classes of the board package; `wood` is its default look, `custom` the player's colors. */
export const BOARD_THEMES = ['wood', 'walnut', 'slate', 'contrast', 'custom'] as const;
export type BoardTheme = (typeof BOARD_THEMES)[number];
/** Disc as on the physical game, or a wooden koma pointing at the opponent (`gg-shape-koma` of the board package). */
export const PIECE_SHAPES = ['disc', 'koma'] as const;
export type PieceShape = (typeof PIECE_SHAPES)[number];
/** Kanji typefaces: the device's own, or one shipped with the site (subsets of the 14 kanji, see `styles/fonts.css`). */
export const KANJI_FONTS = ['system', 'brush', 'serif', 'gothic', 'pop'] as const;
export type KanjiFont = (typeof KANJI_FONTS)[number];
/** Piece colors per shape, as `gg-pieces-<name>` classes of the board package; the first is each shape's default. */
export const PIECE_PALETTES = {
  disc: ['ivory', 'lacquer', 'indigo', 'jade', 'custom'],
  koma: ['wood', 'cherry', 'bamboo', 'lacquer', 'custom'],
} as const;
export type DiscPalette = (typeof PIECE_PALETTES.disc)[number];
export type KomaPalette = (typeof PIECE_PALETTES.koma)[number];
const ALL_PALETTES: readonly string[] = [...new Set([...PIECE_PALETTES.disc, ...PIECE_PALETTES.koma])];
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
  /** What each piece shows: an icon, the icon as outlines, the kanji (as on the physical game) or letters. */
  readonly pieceStyle: PieceStyle;
  readonly pieceShape: PieceShape;
  readonly kanjiFont: KanjiFont;
  /** Piece colors, one choice per shape so switching shapes keeps each. */
  readonly discPalette: DiscPalette;
  readonly komaPalette: KomaPalette;
  /** Colors of the `custom` piece palette, shared by both shapes. */
  readonly customPieces: CustomPieces;
  /** Training: the board shows only the color of each piece (casual games, the computer and analysis). */
  readonly hidePieces: boolean;
  /** With hidden pieces, hovering a square shows its top piece. */
  readonly peekPieces: boolean;
  /** Move list notation: the rulebook's (kanji), the same with piece names, or the machine notation. */
  readonly notation: 'rulebook' | 'named' | 'machine';
  readonly sound: boolean;
  readonly theme: 'auto' | 'light' | 'dark';
  readonly boardTheme: BoardTheme;
  /** Colors of the `custom` board theme, kept when another theme is picked. */
  readonly customBoard: CustomBoard;
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
  pieceShape: 'disc',
  kanjiFont: 'system',
  discPalette: 'ivory',
  komaPalette: 'wood',
  customPieces: DEFAULT_CUSTOM_PIECES,
  hidePieces: false,
  peekPieces: false,
  notation: 'named',
  sound: true,
  theme: 'auto',
  boardTheme: 'wood',
  customBoard: DEFAULT_CUSTOM_BOARD,
  coordinates: true,
  animation: true,
  zoom: 80,
  hoverReach: true,
};

const validCustomBoard = (value: unknown): CustomBoard => {
  const { board, line } = (value ?? {}) as Partial<Record<keyof CustomBoard, unknown>>;
  return {
    board: isHexColor(board) ? board.toLowerCase() : DEFAULT_CUSTOM_BOARD.board,
    line: isHexColor(line) ? line.toLowerCase() : DEFAULT_CUSTOM_BOARD.line,
  };
};

const validCustomPieces = (value: unknown): CustomPieces => {
  const stored = (value ?? {}) as Partial<Record<keyof CustomPieces, unknown>>;
  const pick = (key: keyof CustomPieces) => {
    const color = stored[key];
    return isHexColor(color) ? color.toLowerCase() : DEFAULT_CUSTOM_PIECES[key];
  };
  return { whiteFace: pick('whiteFace'), whiteInk: pick('whiteInk'), blackFace: pick('blackFace'), blackInk: pick('blackInk') };
};

const oneOf = <T extends string>(options: readonly T[], value: unknown, fallback: T): T => options.find((option) => option === value) ?? fallback;

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
      pieceStyle: oneOf(PIECE_STYLES, stored.pieceStyle, returning ? 'kanji' : DEFAULTS.pieceStyle),
      pieceShape: oneOf(PIECE_SHAPES, stored.pieceShape, DEFAULTS.pieceShape),
      kanjiFont: oneOf(KANJI_FONTS, stored.kanjiFont, DEFAULTS.kanjiFont),
      discPalette: oneOf(PIECE_PALETTES.disc, stored.discPalette, DEFAULTS.discPalette),
      komaPalette: oneOf(PIECE_PALETTES.koma, stored.komaPalette, DEFAULTS.komaPalette),
      customPieces: validCustomPieces(stored.customPieces),
      hidePieces: stored.hidePieces === true,
      peekPieces: stored.peekPieces === true,
      notation:
        stored.notation === 'rulebook' || stored.notation === 'named' || stored.notation === 'machine'
          ? stored.notation
          : returning
            ? 'rulebook'
            : DEFAULTS.notation,
      boardTheme: BOARD_THEMES.find((name) => name === stored.boardTheme) ?? DEFAULTS.boardTheme,
      customBoard: validCustomBoard(stored.customBoard),
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
  const { theme, zoom, lang, boardTheme, customBoard, pieceShape, kanjiFont, discPalette, komaPalette, customPieces } = prefs.get();
  const light = theme === 'light' || (theme === 'auto' && Boolean(systemLight?.matches));
  const root = document.documentElement;
  root.classList.toggle('light', light);
  root.classList.toggle('dark', !light);
  root.style.colorScheme = light ? 'light' : 'dark';
  for (const name of BOARD_THEMES) root.classList.toggle(`gg-theme-${name}`, name === boardTheme);
  // Always set: they are read only under gg-theme-custom, and the preview of that theme needs them too.
  for (const [property, value] of Object.entries(customBoardStyle(customBoard).vars)) root.style.setProperty(property, value);
  root.classList.toggle('gg-shape-koma', pieceShape === 'koma');
  const palette = pieceShape === 'koma' ? komaPalette : discPalette;
  for (const name of ALL_PALETTES) root.classList.toggle(`gg-pieces-${name}`, name === palette);
  for (const property of Object.entries(customPieceStyle(customPieces).vars)) root.style.setProperty(...property);
  for (const font of KANJI_FONTS) root.classList.toggle(`ligungi-kanji-${font}`, font === kanjiFont);
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

/** The movement guides are laid out around a disc, so the koma shape goes without them. */
export const guidesShown = (p: Pick<Prefs, 'moveGuides' | 'pieceShape'>): boolean => p.moveGuides && p.pieceShape === 'disc';

export const updatePrefs = (patch: Partial<Prefs>) => prefs.set((current) => ({ ...current, ...patch }));
