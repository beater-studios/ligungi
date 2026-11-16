import type { PieceStyle } from '@ligungi/board';
import type { Messages } from './i18n/index.ts';
import type { BoardTheme, PieceShape, Prefs } from './prefs.ts';

type PiecePalette = Prefs['discPalette'] | Prefs['komaPalette'];

/** Face colors of the two sides in each palette, for its swatch. */
const PALETTE_FACES: Readonly<Record<Exclude<PiecePalette, 'custom'>, readonly [string, string]>> = {
  ivory: ['#f6f1e7', '#232323'],
  lacquer: ['#b3261e', '#191919'],
  indigo: ['#eef1f6', '#1f3a68'],
  jade: ['#cfe6d6', '#6b4528'],
  wood: ['#e0c088', '#563720'],
  cherry: ['#d9a27c', '#2b211c'],
  bamboo: ['#e6d49a', '#6b4a33'],
};

/** Board and line colors of each board theme (`gungiground.css`), for its swatch. */
const BOARD_FACES: Readonly<Record<Exclude<BoardTheme, 'custom'>, readonly [string, string]>> = {
  wood: ['#e3c389', '#7d6440'],
  walnut: ['#9a6a44', '#3c2412'],
  slate: ['#b8bdc3', '#5d646d'],
  contrast: ['#d6d6d6', '#000000'],
};

export const paletteFaces = (palette: PiecePalette, custom: Prefs['customPieces']): readonly [string, string] =>
  palette === 'custom' ? [custom.whiteFace, custom.blackFace] : PALETTE_FACES[palette];

export const boardFaces = (theme: BoardTheme, custom: Prefs['customBoard']): readonly [string, string] =>
  theme === 'custom' ? [custom.board, custom.line] : BOARD_FACES[theme];

/** Two overlapping dots: the sides of a piece palette, or a board and its lines. */
export const Swatch = ({ faces }: { faces: readonly [string, string] }) => (
  <span class="ligungi-swatch" aria-hidden="true">
    <i style={{ background: faces[0] }} />
    <i style={{ background: faces[1] }} />
  </span>
);

type Settings = Messages['settings'];

export const boardThemeLabel = (s: Settings, theme: BoardTheme): string =>
  ({ wood: s.boardThemeWood, walnut: s.boardThemeWalnut, slate: s.boardThemeSlate, contrast: s.boardThemeContrast, custom: s.boardThemeCustom })[theme];

export const shapeLabel = (s: Settings, shape: PieceShape): string => ({ disc: s.shapeDisc, koma: s.shapeKoma })[shape];

export const styleLabel = (s: Settings, style: PieceStyle): string =>
  ({ illustrated: s.pieceStyleIllustrated, trace: s.pieceStyleTrace, kanji: s.pieceStyleKanji, letters: s.pieceStyleLetters })[style];

export const paletteLabel = (s: Settings, palette: PiecePalette): string =>
  ({
    ivory: s.paletteIvory,
    lacquer: s.paletteLacquer,
    indigo: s.paletteIndigo,
    jade: s.paletteJade,
    wood: s.paletteWood,
    cherry: s.paletteCherry,
    bamboo: s.paletteBamboo,
    custom: s.paletteCustom,
  })[palette];
