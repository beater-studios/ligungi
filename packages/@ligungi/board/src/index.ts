import { Board } from './board.ts';
import type { Api, Config } from './types.ts';

export type { Api, Config, Selection, Shape } from './types.ts';
export { TOWER_CONTENTS, type TowerContents } from './types.ts';
export { guidesSvg } from './guides.ts';
export { glyphClass, pieceGlyph, PIECE_STYLES, type PieceStyle } from './glyph.ts';
export { PIECE_ICONS, TRACE_ICONS } from './icons.ts';
export { DEFAULT_LABELS, ENGLISH_PIECE_NAMES, JAPANESE_PIECE_NAMES, pieceLetters, pieceName, pieceShortName, type Labels, type PieceNames } from './labels.ts';

/** Mounts an interactive Gungi board inside `element`. Styles live in `@ligungi/board/gungiground.css`. */
export const Gungiground = (element: HTMLElement, config: Partial<Config> = {}): Api =>
  new Board(element, config);
export { coordinateLabels, visualSquares, type CoordinateStyle } from './geometry.ts';
