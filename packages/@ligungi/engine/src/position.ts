import { SQUARE_COUNT, fromRulebook } from './board.ts';
import { FIXED_SETUPS, MODE_RULES } from './modes.ts';
import { ROLE_INFO } from './roles.ts';
import {
  COLORS,
  ROLES,
  type Color,
  type Hand,
  type Mode,
  type Piece,
  type Position,
  type Role,
  type Square,
  type Tower,
} from './types.ts';

export const emptyHand = (): Record<Role, number> =>
  Object.fromEntries(ROLES.map((role) => [role, 0])) as Record<Role, number>;

export const fullHand = (): Record<Role, number> =>
  Object.fromEntries(ROLES.map((role) => [role, ROLE_INFO[role].count])) as Record<Role, number>;

export const handSize = (hand: Hand): number => ROLES.reduce((sum, role) => sum + hand[role], 0);

export const emptyBoard = (): Tower[] => Array.from({ length: SQUARE_COUNT }, () => []);

const rotate = (square: Square): Square => SQUARE_COUNT - 1 - square;

export interface PositionOptions {
  readonly freeDraft?: boolean;
}

export const initialPosition = (mode: Mode, firstPlayer: Color = 'white', options: PositionOptions = {}): Position => {
  const fixed = FIXED_SETUPS[mode];
  const freeDraft = MODE_RULES[mode].draft && (options.freeDraft ?? false);
  if (MODE_RULES[mode].draft || !fixed) {
    return {
      mode,
      phase: 'draft',
      board: emptyBoard(),
      hands: { white: fullHand(), black: fullHand() },
      turn: firstPlayer,
      firstPlayer,
      freeDraft,
      draftDone: { white: false, black: false },
    };
  }
  const board = emptyBoard();
  for (const [column, row, role] of fixed.layout) {
    const square = fromRulebook(column, row);
    board[square] = [{ role, color: 'white' }];
    board[rotate(square)] = [{ role, color: 'black' }];
  }
  const hand = { ...emptyHand(), ...fixed.hand };
  return {
    mode,
    phase: 'play',
    board,
    hands: { white: { ...hand }, black: { ...hand } },
    turn: firstPlayer,
    firstPlayer,
    freeDraft,
    draftDone: { white: true, black: true },
  };
};

export const topOf = (tower: Tower): Piece | undefined => tower[tower.length - 1];

export const findMarshal = (position: Position, color: Color): Square | undefined => {
  for (let square = 0; square < SQUARE_COUNT; square++) {
    const top = topOf(position.board[square]!);
    if (top && top.role === 'marshal' && top.color === color) return square;
  }
  return undefined;
};

/** Number of pieces of each role per color, across board and hand. Useful for invariants. */
export const material = (position: Position): Record<Color, Record<Role, number>> => {
  const result = { white: emptyHand(), black: emptyHand() };
  for (const tower of position.board) for (const piece of tower) result[piece.color][piece.role]++;
  for (const color of COLORS) for (const role of ROLES) result[color][role] += position.hands[color][role];
  return result;
};
