import type { Color, Move, Position, Role, Square } from '@ligungi/engine';
import type { CoordinateStyle } from './geometry.ts';
import type { PieceStyle } from './glyph.ts';
import type { Labels, PieceNames } from './labels.ts';

export type Selection =
  | { readonly kind: 'square'; readonly square: Square }
  | { readonly kind: 'hand'; readonly color: Color; readonly role: Role };

/** A drawing over the board. `color` names a brush of the stylesheet (`green`, `red`, `blue` or `orange`). */
export type Shape =
  | { readonly kind: 'arrow'; readonly from: Square; readonly to: Square; readonly color: string }
  | { readonly kind: 'square'; readonly square: Square; readonly color: string };

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
  /** What each piece shows: kanji, an icon, the icon as outlines or letters (see `PieceStyle`). */
  pieceStyle: PieceStyle;
  /**
   * The pieces under the top one as a small stack in a corner of the square, the base below and the next tier in front
   * of it, in place of the tower's height.
   */
  towerContents: boolean;
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
   * The floating panel also shows the tower of the selected piece, not only of a tower that cannot be moved: on a
   * touch screen, where nothing is hovered, tapping an own tower selects it.
   */
  inspectSelection: boolean;
  /**
   * Called with the square whose tower the user is looking at (hovered, tapped or selected), or
   * null. Lets the page show the tower in a fixed panel instead of the floating one.
   */
  onInspect: ((square: Square | null) => void) | null;
  /** Marks the squares a hovered piece (of either side) could reach. */
  hoverReach: boolean;
  /** Squares marked with a star, such as the goals of a lesson. */
  targets: readonly Square[];
  /** Arrows and painted squares to show. */
  shapes: readonly Shape[];
  /**
   * Lets the user draw: dragging with the right button from one square to another makes an arrow, a right click
   * paints the square. The board only reports the gesture; the page decides what it adds or erases.
   */
  onDraw: ((shape: Shape) => void) | null;
  /** Brush of the shapes the user draws. */
  drawColor: string;
  /**
   * Taps draw instead of moving pieces, for touch screens: a tap picks the start square, a tap on another square
   * makes an arrow and a second tap on the same square paints it.
   */
  drawMode: boolean;
}

export interface Api {
  set(config: Partial<Config>): void;
  toggleOrientation(): void;
  /** Clears the selection and closes any open chooser. */
  cancel(): void;
  readonly selection: Selection | null;
  destroy(): void;
}
