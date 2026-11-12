import { BOARD_SIZE, squareAt, type Color, type Square } from '@ligungi/engine';

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

/** Rulebook coordinate labels along the top (columns) and the right side (rows). */
export const coordinateLabels = (orientation: Color): { columns: string[]; rows: string[] } => {
  const descending = Array.from({ length: BOARD_SIZE }, (_, i) => String(BOARD_SIZE - i));
  const ascending = [...descending].reverse();
  return orientation === 'white'
    ? { columns: descending, rows: ascending }
    : { columns: ascending, rows: descending };
};
