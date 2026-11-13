import type { Color, Move, Position, Role, Square } from '@ligungi/engine';
import type { CoordinateStyle } from './geometry.ts';
import type { PieceStyle } from './glyph.ts';
import type { Labels, PieceNames } from './labels.ts';

export type Selection =
  | { readonly kind: 'square'; readonly square: Square }
  | { readonly kind: 'hand'; readonly color: Color; readonly role: Role };

export interface Config {
  /** Position to display. */
  position: Position;
  /** Color shown at the bottom. */
  orientation: Color;
  /** Which side the user may move, only on its turn. */
  movableColor: Color | 'both' | null;
  /** Legal moves for the side to move, usually `legalMoves(position)` or `game.legalMoves()`. */
  moves: readonly Move[];
  lastMove: Move | null;
  coordinates: boolean;
  /** Numbers as in the rulebook, or the letters and numbers of the machine notation. */
  coordinateStyle: CoordinateStyle;
  pieceNames: PieceNames;
  /** Marks around each piece showing how it moves at tier 1 (the beginner aid). */
  moveGuides: boolean;
  /** `kanji` as on the physical game, `illustrated` with an icon per piece. */
  pieceStyle: PieceStyle;
  labels: Partial<Labels>;
  /** Called after the user picks a move. The board already shows the resulting position. */
  onMove: ((move: Move) => void) | null;
  /**
   * Moves the user may queue while waiting for the opponent, usually the legal moves of the
   * position with the turn handed to the user. Only used when `movableColor` is a single color.
   */
  premoveMoves: readonly Move[];
  /** Queued premove to highlight. */
  premove: Move | null;
  /** Called when the user queues (move) or cancels (null) a premove. */
  onPremove: ((move: Move | null) => void) | null;
  /** Animates moves that arrive through `set` and moves made by clicking. */
  animation: boolean;
  /**
   * Render the hands into these elements instead of above and below the board, e.g. the pocket
   * areas of a page layout. Only read when the board is created.
   */
  handElements: { readonly top: HTMLElement; readonly bottom: HTMLElement } | null;
  /** Shows the floating tower panel next to hovered towers. */
  inspector: boolean;
  /**
   * Called with the square whose tower the user is looking at (hovered, tapped or selected), or
   * null. Lets the page show the tower in a fixed panel instead of the floating one.
   */
  onInspect: ((square: Square | null) => void) | null;
  /** Marks the squares a hovered piece (of either side) could reach. */
  hoverReach: boolean;
}

export interface Api {
  set(config: Partial<Config>): void;
  toggleOrientation(): void;
  /** Clears the selection and closes any open chooser. */
  cancel(): void;
  readonly selection: Selection | null;
  destroy(): void;
}
