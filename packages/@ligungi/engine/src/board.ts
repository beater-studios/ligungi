import type { Color, Square } from './types.ts';

export const BOARD_SIZE = 9;
export const SQUARE_COUNT = BOARD_SIZE * BOARD_SIZE;
export const SQUARES: readonly Square[] = Array.from({ length: SQUARE_COUNT }, (_, i) => i);

const FILE_NAMES = 'abcdefghi';

export const squareAt = (file: number, rank: number): Square => rank * BOARD_SIZE + file;
export const fileOf = (square: Square): number => square % BOARD_SIZE;
export const rankOf = (square: Square): number => Math.floor(square / BOARD_SIZE);
export const onBoard = (file: number, rank: number): boolean =>
  file >= 0 && file < BOARD_SIZE && rank >= 0 && rank < BOARD_SIZE;

/** +1 for White (towards higher ranks), -1 for Black. */
export const forwardOf = (color: Color): 1 | -1 => (color === 'white' ? 1 : -1);

/** Distance from the color's own back rank: 0 is the back rank, 8 is the opponent's back rank. */
export const relativeRank = (square: Square, color: Color): number =>
  color === 'white' ? rankOf(square) : BOARD_SIZE - 1 - rankOf(square);

export const squareName = (square: Square): string =>
  `${FILE_NAMES[fileOf(square)]}${rankOf(square) + 1}`;

export const parseSquare = (name: string): Square | undefined => {
  if (name.length !== 2) return undefined;
  const file = FILE_NAMES.indexOf(name[0]!);
  const rank = Number(name[1]) - 1;
  if (file < 0 || !Number.isInteger(rank) || !onBoard(file, rank)) return undefined;
  return squareAt(file, rank);
};

/**
 * Rulebook coordinates, seen from White: column 9..1 from left to right, row 1..9 from top
 * (Black's back rank) to bottom (White's back rank).
 */
export const fromRulebook = (column: number, row: number): Square =>
  squareAt(BOARD_SIZE - column, BOARD_SIZE - row);

export const toRulebook = (square: Square): { column: number; row: number } => ({
  column: BOARD_SIZE - fileOf(square),
  row: BOARD_SIZE - rankOf(square),
});
