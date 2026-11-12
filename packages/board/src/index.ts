import { Board } from './board.ts';
import type { Api, Config } from './types.ts';

export type { Api, Config, Selection } from './types.ts';
export { DEFAULT_LABELS, pieceName, type Labels, type PieceNames } from './labels.ts';

/** Mounts an interactive Gungi board inside `element`. Styles live in `@ligungi/board/gungiground.css`. */
export const Gungiground = (element: HTMLElement, config: Partial<Config> = {}): Api =>
  new Board(element, config);
export { coordinateLabels, visualSquares } from './geometry.ts';
