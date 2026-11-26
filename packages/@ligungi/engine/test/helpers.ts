import {
  emptyBoard,
  emptyHand,
  fileOf,
  legalMoves,
  moveToString,
  parseSquare,
  rankOf,
  roleFromLetter,
  squareAt,
  squareName,
  type Color,
  type Mode,
  type Piece,
  type Position,
  type Role,
  type Square,
} from '../src/index.ts';

export interface BuildOptions {
  turn?: Color;
  firstPlayer?: Color;
  mode?: Mode;
  hands?: Partial<Record<Color, Partial<Record<Role, number>>>>;
}

/**
 * Builds a play-phase position from `{ square: tower }`, towers written bottom to top with FEN
 * letters (uppercase White). Adds marshals on a1 and i9 when the layout has none.
 */
export const build = (towers: Record<string, string>, options: BuildOptions = {}): Position => {
  const board = emptyBoard();
  const layout = { ...towers };
  const letters = Object.values(layout).join('');
  if (!letters.includes('M')) layout.a1 = layout.a1 ?? 'M';
  if (!letters.includes('m')) layout.i9 = layout.i9 ?? 'm';
  for (const [name, text] of Object.entries(layout)) {
    const square = parseSquare(name);
    if (square === undefined) throw new Error(`Bad square ${name}`);
    board[square] = [...text].map((letter): Piece => {
      const role = roleFromLetter(letter);
      if (!role) throw new Error(`Bad letter ${letter}`);
      return { role, color: letter === letter.toUpperCase() ? 'white' : 'black' };
    });
  }
  return {
    mode: options.mode ?? 'advanced',
    phase: 'play',
    board,
    hands: {
      white: { ...emptyHand(), ...options.hands?.white },
      black: { ...emptyHand(), ...options.hands?.black },
    },
    turn: options.turn ?? 'white',
    firstPlayer: options.firstPlayer ?? 'white',
    freeDraft: false,
    draftDone: { white: true, black: true },
  };
};

export const sq = (name: string): Square => {
  const square = parseSquare(name);
  if (square === undefined) throw new Error(`Bad square ${name}`);
  return square;
};

/** Square at an offset from `origin`, offsets seen from White. */
export const rel = (origin: string, dx: number, dy: number): string => {
  const from = sq(origin);
  return squareName(squareAt(fileOf(from) + dx, rankOf(from) + dy));
};

export const moveStrings = (position: Position): string[] => legalMoves(position).map(moveToString);

/** Legal moves from `from`, as `to` + action suffix, e.g. `e5`, `e5=`, `e5x`. */
export const movesFrom = (position: Position, from: string): string[] =>
  moveStrings(position)
    .filter((move) => move.startsWith(from) && !move.includes('*'))
    .map((move) => move.slice(2));

export const targetsFrom = (position: Position, from: string): string[] => [
  ...new Set(movesFrom(position, from).map((move) => move.slice(0, 2))),
].sort();
