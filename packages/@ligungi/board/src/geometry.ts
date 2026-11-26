import { BOARD_SIZE, squareAt, squareName, type Color, type Square } from '@ligungi/engine';

/** `rulebook`: numbers for columns and rows, as in the official rules. `algebraic`: the machine notation's `a1` to `i9`. */
export type CoordinateStyle = 'rulebook' | 'algebraic';

/** Squares in visual order: left to right, top to bottom, for the given orientation. */
export const visualSquares = (orientation: Color): Square[] => {
  const squares: Square[] = [];
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let column = 0; column < BOARD_SIZE; column++) {
      squares.push(
        orientation === 'white'
          ? squareAt(column, BOARD_SIZE - 1 - row)
          : squareAt(BOARD_SIZE - 1 - column, row),
      );
    }
  }
  return squares;
};

/** Coordinate labels along the top (columns) and the right side (rows), left to right and top to bottom. */
export const coordinateLabels = (orientation: Color, style: CoordinateStyle = 'rulebook'): { columns: string[]; rows: string[] } => {
  if (style === 'algebraic') {
    // Read from the square names themselves, so the labels always match the moves written in that notation.
    const squares = visualSquares(orientation);
    return {
      columns: squares.slice(0, BOARD_SIZE).map((square) => squareName(square)[0]!),
      rows: Array.from({ length: BOARD_SIZE }, (_, row) => squareName(squares[row * BOARD_SIZE]!).slice(1)),
    };
  }
  const descending = Array.from({ length: BOARD_SIZE }, (_, i) => String(BOARD_SIZE - i));
  const ascending = [...descending].reverse();
  return orientation === 'white'
    ? { columns: descending, rows: ascending }
    : { columns: ascending, rows: descending };
};
