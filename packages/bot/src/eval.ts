import { isMarshalAttacked, opposite, relativeRank, type Color, type Position, type Role } from '@ligungi/engine';

/** Piece values in centipawn-like units, used by the evaluation and the move ordering. */
export const VALUE: Readonly<Record<Role, number>> = {
  marshal: 0,
  general: 900,
  lieutenant: 600,
  major: 400,
  samurai: 280,
  lancer: 250,
  rider: 230,
  spy: 220,
  fortress: 210,
  soldier: 120,
  cannon: 300,
  archer: 270,
  musketeer: 260,
  tactician: 350,
};

/** Material and placement from `color`'s point of view: pieces on the board (the top one stronger with height and advance) and in hand. */
export const material = (position: Position, color: Color): number => {
  let score = 0;
  for (let square = 0; square < position.board.length; square++) {
    const tower = position.board[square]!;
    for (let level = 0; level < tower.length; level++) {
      const piece = tower[level]!;
      const sign = piece.color === color ? 1 : -1;
      let value = VALUE[piece.role];
      if (level === tower.length - 1) {
        // Only the top piece acts; height makes it stronger (more reach, harder to capture).
        value += value * 0.15 * level;
        if (piece.role !== 'marshal') value += relativeRank(square, piece.color) * 4;
      }
      score += sign * value;
    }
  }
  for (const side of ['white', 'black'] as const) {
    const sign = side === color ? 1 : -1;
    const hand = position.hands[side];
    for (const role of Object.keys(hand) as Role[]) score += sign * hand[role] * VALUE[role] * 0.9;
  }
  return score;
};

/** The search's evaluation: material from the side to move's point of view. */
export const evaluateForSideToMove = (position: Position): number => material(position, position.turn);

/** The shallow levels' evaluation: material from `color`'s point of view, plus a bonus for attacking the enemy Marshal. */
export const evaluate = (position: Position, color: Color): number =>
  material(position, color) + (position.phase === 'play' && isMarshalAttacked(position, opposite(color)) ? 40 : 0);
