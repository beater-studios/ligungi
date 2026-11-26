import { SQUARES } from './board.ts';
import { FIXED_SETUPS, MODE_RULES } from './modes.ts';
import { isMarshalAttacked } from './movegen.ts';
import { ROLE_INFO } from './roles.ts';
import { COLORS, ROLES, type Color, type Mode, type Position, type Role, type Square } from './types.ts';

/**
 * Why a position set up by hand (the board editor, a study's start) cannot come from a game. `positionProblems` checks
 * it as a play position; `phaseProblems` as a position of its own phase, draft or play.
 */
export type PositionProblem =
  | { readonly kind: 'marshalCount'; readonly color: Color; readonly count: number }
  | { readonly kind: 'marshalInHand'; readonly color: Color }
  | { readonly kind: 'tooMany'; readonly color: Color; readonly role: Role; readonly count: number; readonly max: number }
  | { readonly kind: 'tooHigh'; readonly square: Square; readonly height: number; readonly max: number }
  | { readonly kind: 'marshalCovered'; readonly square: Square }
  | { readonly kind: 'marshalStacked'; readonly square: Square }
  | { readonly kind: 'waitingInCheck'; readonly color: Color };

/** How many pieces of each role a player has in a mode: the fixed setup and its hand, or the full set of the draft modes. */
export const pieceLimits = (mode: Mode): Readonly<Record<Role, number>> => {
  const fixed = FIXED_SETUPS[mode];
  const limits = Object.fromEntries(ROLES.map((role) => [role, fixed ? (fixed.hand[role] ?? 0) : ROLE_INFO[role].count])) as Record<Role, number>;
  if (fixed) for (const [, , role] of fixed.layout) limits[role]++;
  return limits;
};

export const positionProblems = (position: Position): PositionProblem[] => {
  const problems: PositionProblem[] = [];
  const rules = MODE_RULES[position.mode];
  const limits = pieceLimits(position.mode);
  const counts = { white: { ...position.hands.white }, black: { ...position.hands.black } };
  const marshals = { white: 0, black: 0 };
  for (const square of SQUARES) {
    const tower = position.board[square]!;
    if (tower.length > rules.maxHeight) problems.push({ kind: 'tooHigh', square, height: tower.length, max: rules.maxHeight });
    tower.forEach((piece, level) => {
      counts[piece.color][piece.role]++;
      if (piece.role !== 'marshal') return;
      marshals[piece.color]++;
      // Nothing may stand on a Marshal, and in the simpler modes it never stands on another piece either.
      if (level < tower.length - 1) problems.push({ kind: 'marshalCovered', square });
      if (level > 0 && !rules.marshalStacks) problems.push({ kind: 'marshalStacked', square });
    });
  }
  for (const color of COLORS) {
    if (marshals[color] !== 1) problems.push({ kind: 'marshalCount', color, count: marshals[color] });
    if (position.hands[color].marshal > 0) problems.push({ kind: 'marshalInHand', color });
    for (const role of ROLES) {
      if (counts[color][role] > limits[role]) problems.push({ kind: 'tooMany', color, role, count: counts[color][role], max: limits[role] });
    }
  }
  // The side that just moved cannot have left its Marshal attacked: the move that led here would have been illegal.
  const waiting: Color = position.turn === 'white' ? 'black' : 'white';
  if (marshals.white === 1 && marshals.black === 1 && isMarshalAttacked(position, waiting)) problems.push({ kind: 'waitingInCheck', color: waiting });
  return problems;
};

/** Problems the draft allows: the Marshals may still be in hand or not placed yet, and nothing can be captured. */
const allowedInDraft = (problem: PositionProblem): boolean =>
  problem.kind === 'marshalInHand' || problem.kind === 'waitingInCheck' || (problem.kind === 'marshalCount' && problem.count === 0);

/**
 * The problems that make a position impossible in its own phase: all of `positionProblems` in play, and during the draft
 * only those the draft cannot reach either (too many pieces, towers too high, a covered Marshal, two Marshals).
 */
export const phaseProblems = (position: Position): PositionProblem[] =>
  position.phase === 'play' ? positionProblems(position) : positionProblems(position).filter((problem) => !allowedInDraft(problem));
