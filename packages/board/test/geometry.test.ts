import { BOARD_SIZE, squareAt, squareName } from '@ligungi/engine';
import { describe, expect, it } from 'vitest';
import { coordinateLabels, visualSquares } from '../src/index.ts';

describe('board geometry', () => {
  it('lays out every square once, White at the bottom or Black at the bottom', () => {
    for (const orientation of ['white', 'black'] as const) {
      const squares = visualSquares(orientation);
      expect(squares).toHaveLength(BOARD_SIZE * BOARD_SIZE);
      expect(new Set(squares).size).toBe(BOARD_SIZE * BOARD_SIZE);
    }
    const white = visualSquares('white');
    // The bottom left corner is White's first square and the top right Black's.
    expect(white[BOARD_SIZE * (BOARD_SIZE - 1)]).toBe(squareAt(0, 0));
    expect(white[BOARD_SIZE - 1]).toBe(squareAt(BOARD_SIZE - 1, BOARD_SIZE - 1));
    // Turning the board around is a half turn: the same squares, in reverse.
    expect(visualSquares('black')).toEqual([...white].reverse());
  });

  it('labels the columns and rows as the rulebook does, or with the squares of the machine notation', () => {
    const rulebook = coordinateLabels('white');
    expect(rulebook.columns).toEqual(['9', '8', '7', '6', '5', '4', '3', '2', '1']);
    expect(rulebook.rows).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9']);
    expect(coordinateLabels('black')).toEqual({ columns: rulebook.rows, rows: rulebook.columns });
    for (const orientation of ['white', 'black'] as const) {
      const { columns, rows } = coordinateLabels(orientation, 'algebraic');
      const squares = visualSquares(orientation);
      // Each label matches the name of the squares beside it.
      columns.forEach((column, i) => expect(squareName(squares[i]!)[0]).toBe(column));
      rows.forEach((row, i) => expect(squareName(squares[i * BOARD_SIZE]!).slice(1)).toBe(row));
    }
    expect(coordinateLabels('white', 'algebraic').columns[0]).toBe('a');
  });
});
