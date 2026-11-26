import { PIECE_STYLES, type PieceStyle } from '@ligungi/board';
import { customBoardStyle, DEFAULT_CUSTOM_BOARD, isHexColor, type CustomBoard } from './boardColors.ts';
import { customPieceStyle, DEFAULT_CUSTOM_PIECES, type CustomPieces } from './pieceColors.ts';
import { isLang, LANGS, localeOf, matchLang, type Lang } from '../i18n/languages.ts';
import { createStore } from '../core/store.ts';

export { LANGS, type Lang };
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
/** The board seen from above, or in the 3D view of the board package (`gg-3d`), where towers show their height. */
export const BOARD_VIEWS = ['2d', '3d'] as const;
export type BoardView = (typeof BOARD_VIEWS)[number];
/** lila zoom values (0 to 100) offered as board sizes. */
export const BOARD_SIZES = [40, 60, 80, 100] as const;

const nearestBoardSize = (zoom: unknown): number =>
  BOARD_SIZES.reduce((best, size) => (Math.abs(size - Number(zoom)) < Math.abs(best - Number(zoom)) ? size : best), 80);

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
  readonly opponentPieces: OpponentPieces;
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
  readonly soundSet: SoundSet;
  /** Byo-yomi: how the last seconds of each period are counted. */
  readonly byoyomiCount: ByoyomiCount;
  readonly theme: 'auto' | 'light' | 'dark';
  readonly boardTheme: BoardTheme;
  readonly boardView: BoardView;
  /** Colors of the `custom` board theme, kept when another theme is picked. */
  readonly customBoard: CustomBoard;
  readonly coordinates: boolean;
  readonly animation: boolean;
  /** Board size, 0 to 100, as lila's zoom preference. */
  readonly zoom: number;
  /** Mark the squares a hovered piece could reach. */
  readonly hoverReach: boolean;
  /** Show the pieces under the top of each tower as a small stack in the corner of its square, instead of its height. */
  readonly towerContents: boolean;
  /** Game pages add a text version of the board: announced moves and a field for typed moves and questions. */
  readonly screenReader: boolean;
  /** Game pages add a field under the board for typed moves. */
  readonly keyboardMove: boolean;
  /** Game pages hide everything but the board, the hands, the players and the clocks. */
  readonly zen: boolean;
  /** On a phone, what tapping a tower shows: a balloon next to it, a strip under the board, or only the side panel. */
  readonly towerTap: TowerTap;
  readonly confirmMove: ConfirmMove;
  readonly spokenMoves: SpokenMoves;
  readonly spokenStyle: SpeechStyle;
  readonly spokenPlaces: readonly SpeechPlace[];
  /** Browser notifications while the site is in the background; the browser's own permission is asked when turned on. */
  readonly notifications: boolean;
}

/** When a move made on the board waits for a click on Confirm before it is sent: never, in correspondence games, always. */
export const CONFIRM_MOVES = ['never', 'correspondence', 'always'] as const;
export type ConfirmMove = (typeof CONFIRM_MOVES)[number];

/** The sound sets, folders of src/assets/sound: lila's free sets by Enigmahack. */
export const SOUND_SETS = ['sfx', 'piano', 'futuristic', 'nes'] as const;
export type SoundSet = (typeof SOUND_SETS)[number];
/** The last seconds of a byo-yomi period: a beep, the browser's voice, or the countdown of the sound set. */
export const BYOYOMI_COUNTS = ['beep', 'voice', 'sounds'] as const;
export type ByoyomiCount = (typeof BYOYOMI_COUNTS)[number];
/** Spoken moves: never, only the opponent's, or every move. */
export const SPOKEN_MOVES = ['off', 'opponent', 'all'] as const;
export type SpokenMoves = (typeof SPOKEN_MOVES)[number];
/** The short form ("Samurai, 6-6.") or the full sentences of the screen reader mode. */
export const SPEECH_STYLES = ['short', 'full'] as const;
export type SpeechStyle = (typeof SPEECH_STYLES)[number];
/**
 * Where moves are said: games against people, against the computer, games watched (TV, other people's games), training
 * (puzzles, lessons, practice) and review (stepping through the analysis board and studies).
 */
export const SPEECH_PLACES = ['online', 'computer', 'watching', 'training', 'review'] as const;
export type SpeechPlace = (typeof SPEECH_PLACES)[number];

/** The opponent's kanji and letters: turned toward them, as at a real board, or upright like the player's own. */
export const OPPONENT_PIECES = ['turned', 'upright'] as const;
export type OpponentPieces = (typeof OPPONENT_PIECES)[number];

export const TOWER_TAPS = ['balloon', 'strip', 'panel'] as const;
export type TowerTap = (typeof TOWER_TAPS)[number];

const KEY = 'ligungi.prefs';
const DEFAULTS: Prefs = {
  lang: 'auto',
  pieceNames: 'local',
  moveGuides: true,
  pieceStyle: 'illustrated',
  pieceShape: 'disc',
  kanjiFont: 'system',
  opponentPieces: 'turned',
  discPalette: 'ivory',
  komaPalette: 'wood',
  customPieces: DEFAULT_CUSTOM_PIECES,
  hidePieces: false,
  peekPieces: false,
  notation: 'named',
  sound: true,
  theme: 'auto',
  boardTheme: 'wood',
  boardView: '2d',
  customBoard: DEFAULT_CUSTOM_BOARD,
  coordinates: true,
  animation: true,
  zoom: 80,
  hoverReach: true,
  towerContents: false,
  soundSet: 'sfx',
  byoyomiCount: 'beep',
  screenReader: false,
  keyboardMove: false,
  zen: false,
  towerTap: 'balloon',
  confirmMove: 'correspondence',
  spokenMoves: 'off',
  spokenStyle: 'short',
  spokenPlaces: ['online', 'computer', 'watching', 'training'],
  notifications: false,
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
      opponentPieces: oneOf(OPPONENT_PIECES, stored.opponentPieces, DEFAULTS.opponentPieces),
      discPalette: oneOf(PIECE_PALETTES.disc, stored.discPalette, DEFAULTS.discPalette),
      komaPalette: oneOf(PIECE_PALETTES.koma, stored.komaPalette, DEFAULTS.komaPalette),
      customPieces: validCustomPieces(stored.customPieces),
      hidePieces: stored.hidePieces === true,
      peekPieces: stored.peekPieces === true,
      soundSet: oneOf(SOUND_SETS, stored.soundSet, DEFAULTS.soundSet),
      // The spoken countdown used to be a switch of its own.
      byoyomiCount: oneOf(BYOYOMI_COUNTS, stored.byoyomiCount, (stored as Record<string, unknown>).byoyomiVoice === true ? 'voice' : DEFAULTS.byoyomiCount),
      screenReader: stored.screenReader === true,
      keyboardMove: stored.keyboardMove === true,
      zen: stored.zen === true,
      towerContents: stored.towerContents === true,
      notifications: stored.notifications === true,
      towerTap: oneOf(TOWER_TAPS, stored.towerTap, DEFAULTS.towerTap),
      confirmMove: oneOf(CONFIRM_MOVES, stored.confirmMove, DEFAULTS.confirmMove),
      spokenMoves: oneOf(SPOKEN_MOVES, stored.spokenMoves, DEFAULTS.spokenMoves),
      spokenStyle: oneOf(SPEECH_STYLES, stored.spokenStyle, DEFAULTS.spokenStyle),
      spokenPlaces: Array.isArray(stored.spokenPlaces)
        ? SPEECH_PLACES.filter((place) => (stored.spokenPlaces as unknown[]).includes(place))
        : DEFAULTS.spokenPlaces,
      notation:
        stored.notation === 'rulebook' || stored.notation === 'named' || stored.notation === 'machine'
          ? stored.notation
          : returning
            ? 'rulebook'
            : DEFAULTS.notation,
      boardTheme: BOARD_THEMES.find((name) => name === stored.boardTheme) ?? DEFAULTS.boardTheme,
      customBoard: validCustomBoard(stored.customBoard),
      boardView: oneOf(BOARD_VIEWS, stored.boardView, DEFAULTS.boardView),
      // Older versions had a free 0-100 slider; snap those values to the sizes offered today.
      zoom: Number.isFinite(Number(stored.zoom)) ? nearestBoardSize(stored.zoom) : DEFAULTS.zoom,
      lang: isLang(merged.lang) ? merged.lang : 'auto',
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
  const fromUrl = isLang(value) ? value : undefined;
  try {
    if (fromUrl) sessionStorage.setItem(URL_LANG_KEY, fromUrl);
    const stored = sessionStorage.getItem(URL_LANG_KEY);
    return fromUrl ?? (isLang(stored) ? stored : undefined);
  } catch {
    return fromUrl;
  }
};
const URL_LANG = urlLang();

const detectLang = (): Lang => {
  if (URL_LANG) return URL_LANG;
  const tags = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const tag of tags) {
    const lang = tag ? matchLang(tag) : undefined;
    if (lang) return lang;
  }
  return 'en';
};

export const resolveLang = (lang: Prefs['lang']): Lang => (lang === 'auto' ? detectLang() : lang);

const systemLight = window.matchMedia?.('(prefers-color-scheme: light)');

/** lila themes: the default (dark) theme lives on :root, `html.light` switches to the light one. */
const apply = () => {
  const { theme, zoom, lang, boardTheme, boardView, customBoard, pieceShape, kanjiFont, opponentPieces, discPalette, komaPalette, customPieces } = prefs.get();
  const light = theme === 'light' || (theme === 'auto' && Boolean(systemLight?.matches));
  const root = document.documentElement;
  root.classList.toggle('light', light);
  root.classList.toggle('dark', !light);
  root.style.colorScheme = light ? 'light' : 'dark';
  for (const name of BOARD_THEMES) root.classList.toggle(`gg-theme-${name}`, name === boardTheme);
  // Always set: they are read only under gg-theme-custom, and the preview of that theme needs them too.
  for (const [property, value] of Object.entries(customBoardStyle(customBoard).vars)) root.style.setProperty(property, value);
  root.classList.toggle('gg-3d', boardView === '3d');
  root.classList.toggle('gg-shape-koma', pieceShape === 'koma');
  root.classList.toggle('gg-upright-opponent', opponentPieces === 'upright');
  const palette = pieceShape === 'koma' ? komaPalette : discPalette;
  for (const name of ALL_PALETTES) root.classList.toggle(`gg-pieces-${name}`, name === palette);
  for (const property of Object.entries(customPieceStyle(customPieces).vars)) root.style.setProperty(...property);
  for (const font of KANJI_FONTS) root.classList.toggle(`ligungi-kanji-${font}`, font === kanjiFont);
  root.lang = localeOf(resolveLang(lang));
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
