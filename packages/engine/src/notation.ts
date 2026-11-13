import { parseSquare, squareName, toRulebook } from './board.ts';
import { topOf } from './position.ts';
import { ROLE_INFO, roleFromLetter } from './roles.ts';
import type { BoardAction, Move, Position, Role } from './types.ts';

const ACTION_SUFFIX: Record<BoardAction, string> = { move: '', stack: '=', capture: 'x' };

/**
 * Machine notation:
 * - board move `e3e4`, stack `e3e4=`, capture `e3e4x`;
 * - drop (or draft placement) `Y*e3`, role letter always uppercase;
 * - betrayal appended as `^` plus 1-based levels, e.g. `e3e4=^12`;
 * - `done` to finish the draft.
 */
export const moveToString = (move: Move): string => {
  if (move.kind === 'done') return 'done';
  const betray = move.betray?.length ? `^${move.betray.map((level) => level + 1).join('')}` : '';
  if (move.kind === 'drop') return `${ROLE_INFO[move.role].letter}*${squareName(move.to)}${betray}`;
  return `${squareName(move.from)}${squareName(move.to)}${ACTION_SUFFIX[move.action]}${betray}`;
};

export const parseMove = (text: string): Move | undefined => {
  if (text === 'done') return { kind: 'done' };
  const match = /^(?:([A-Z])\*([a-i][1-9])|([a-i][1-9])([a-i][1-9])([=x]?))(?:\^([1-3]+))?$/.exec(text);
  if (!match) return undefined;
  const [, letter, dropTo, from, to, suffix, levels] = match;
  const betray = levels ? { betray: [...levels].map((digit) => Number(digit) - 1) } : {};
  if (letter) {
    const role = roleFromLetter(letter);
    const square = parseSquare(dropTo!);
    if (!role || square === undefined) return undefined;
    return { kind: 'drop', role, to: square, ...betray };
  }
  const action: BoardAction = suffix === '=' ? 'stack' : suffix === 'x' ? 'capture' : 'move';
  return { kind: 'move', from: parseSquare(from!)!, to: parseSquare(to!)!, action, ...betray };
};

/** The pieces of a rulebook move, shared by the rulebook notation and its variants (piece names instead of kanji). */
export type RulebookParts =
  | { readonly done: true }
  | {
      readonly done: false;
      readonly column: number;
      readonly row: number;
      /** Tier the piece ends on (1 to 3). */
      readonly level: number;
      readonly role: Role;
      /** The piece comes from the hand (新). */
      readonly drop: boolean;
      readonly capture: boolean;
      readonly betray: boolean;
    };

/** Needs the position before the move. */
export const rulebookParts = (position: Position, move: Move): RulebookParts => {
  if (move.kind === 'done') return { done: true };
  const { column, row } = toRulebook(move.to);
  const target = position.board[move.to]!;
  const betray = Boolean(move.betray?.length);
  if (move.kind === 'drop') {
    return { done: false, column, row, level: target.length + 1, role: move.role, drop: true, capture: false, betray };
  }
  const piece = topOf(position.board[move.from]!)!;
  const level =
    move.action === 'move'
      ? 1
      : move.action === 'capture'
        ? target.filter((p) => p.color === piece.color).length + 1
        : target.length + 1;
  return { done: false, column, row, level, role: piece.role, drop: false, capture: move.action === 'capture', betray };
};

/**
 * Rulebook notation "column-row-level piece", with 新 for pieces from the hand, e.g. `4-7-2 侍`
 * or `4-7-2 忍新`. Captures add 取 and betrayals 返. Needs the position before the move.
 */
export const moveToRulebook = (position: Position, move: Move): string => {
  const parts = rulebookParts(position, move);
  if (parts.done) return '済み';
  const marks = `${parts.drop ? '新' : ''}${parts.capture ? '取' : ''}${parts.betray ? '返' : ''}`;
  return `${parts.column}-${parts.row}-${parts.level} ${ROLE_INFO[parts.role].kanji}${marks}`;
};
