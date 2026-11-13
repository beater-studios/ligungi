import {
  SQUARES,
  fileOf,
  forwardOf,
  onBoard,
  rankOf,
  relativeRank,
  squareAt,
} from './board.ts';
import { MODE_RULES } from './modes.ts';
import { findMarshal, topOf } from './position.ts';
import { MOVE_RULES, crossedCells } from './roles.ts';
import {
  ROLES,
  opposite,
  type BoardAction,
  type Color,
  type Move,
  type Piece,
  type Position,
  type Role,
  type Square,
  type Tower,
} from './types.ts';
import { applyMove } from './apply.ts';

const VOLLEY_PATHS = [1, 2, 3].flatMap((k) =>
  [-1, 1].map((side) => ({
    k,
    target: [side * k, k + 1] as const,
    path: crossedCells(side * k, k + 1),
  })),
);

const heightAt = (position: Position, square: Square): number => position.board[square]!.length;

/** Squares the top piece on `from` can reach geometrically, before checking what it may do there. */
export const reachableSquares = (position: Position, from: Square): Square[] => {
  const tower = position.board[from]!;
  const piece = topOf(tower);
  if (!piece) return [];
  const tier = tower.length;
  const sign = forwardOf(piece.color);
  const file = fileOf(from);
  const rank = rankOf(from);
  const at = (df: number, dr: number): Square | undefined => {
    const f = file + df * sign;
    const r = rank + dr * sign;
    return onBoard(f, r) ? squareAt(f, r) : undefined;
  };
  const result: Square[] = [];

  for (const rule of MOVE_RULES[piece.role]) {
    if (rule.type === 'slide') {
      const max = rule.base === Infinity ? 8 : rule.base + tier - 1;
      for (let d = 1; d <= max; d++) {
        const square = at(rule.dir[0] * d, rule.dir[1] * d);
        if (square === undefined) break;
        result.push(square);
        if (heightAt(position, square) > 0) break;
      }
    } else if (rule.type === 'jump') {
      const max = rule.base + tier - 1;
      let blocked = false;
      for (let d = 1; d <= max && !blocked; d++) {
        const square = at(rule.dir[0] * d, rule.dir[1] * d);
        if (square === undefined) break;
        if (d >= rule.min) result.push(square);
        if (heightAt(position, square) > tier) blocked = true;
      }
    } else {
      for (const volley of VOLLEY_PATHS) {
        if (volley.k > tier) continue;
        const square = at(volley.target[0], volley.target[1]);
        if (square === undefined) continue;
        const clear = volley.path.every(([dx, dy]) => heightAt(position, at(dx, dy)!) <= tier);
        if (clear) result.push(square);
      }
    }
  }
  return [...new Set(result)];
};

/** What a piece of height `tier` may do on `to`. */
export const actionsOn = (
  position: Position,
  mover: Piece,
  tier: number,
  to: Square,
): BoardAction[] => {
  const tower = position.board[to]!;
  const top = topOf(tower);
  if (!top) return ['move'];
  if (tower.length > tier) return [];
  if (top.role === 'marshal') return top.color === mover.color ? [] : ['capture'];
  const rules = MODE_RULES[position.mode];
  const canStack =
    tower.length + 1 <= rules.maxHeight && (mover.role !== 'marshal' || rules.marshalStacks);
  if (top.color === mover.color) return canStack ? ['stack'] : [];
  return canStack ? ['capture', 'stack'] : ['capture'];
};

/**
 * Betrayal swaps every enemy piece of the tower or none (docs/rules.md section 6), so there is at
 * most one option: all enemy levels, when the hand holds a matching piece for each of them.
 */
const betrayalOptions = (
  tower: Tower,
  color: Color,
  hand: Readonly<Record<Role, number>>,
): number[][] => {
  const levels = tower.flatMap((piece, level) => (piece.color !== color ? [level] : []));
  if (levels.length === 0) return [];
  const needed = new Map<Role, number>();
  for (const level of levels) {
    const role = tower[level]!.role;
    needed.set(role, (needed.get(role) ?? 0) + 1);
  }
  return [...needed].every(([role, count]) => hand[role] >= count) ? [levels] : [];
};

const boardMovesFrom = (position: Position, from: Square): Move[] => {
  const tower = position.board[from]!;
  const piece = topOf(tower);
  if (!piece) return [];
  const moves: Move[] = [];
  for (const to of reachableSquares(position, from)) {
    for (const action of actionsOn(position, piece, tower.length, to)) {
      moves.push({ kind: 'move', from, to, action });
      if (piece.role === 'tactician' && action === 'stack') {
        const hand = position.hands[piece.color];
        for (const betray of betrayalOptions(position.board[to]!, piece.color, hand)) {
          moves.push({ kind: 'move', from, to, action, betray });
        }
      }
    }
  }
  return moves;
};

const canDropOn = (position: Position, color: Color, square: Square): boolean => {
  const tower = position.board[square]!;
  const top = topOf(tower);
  if (!top) return true;
  return (
    top.color === color &&
    top.role !== 'marshal' &&
    tower.length + 1 <= MODE_RULES[position.mode].maxHeight
  );
};

/** The furthest relative rank holding one of the color's pieces on top of a tower (FAQ Q25). */
export const dropFrontier = (position: Position, color: Color): number => {
  let frontier = -1;
  for (const square of SQUARES) {
    const top = topOf(position.board[square]!);
    if (top?.color === color) frontier = Math.max(frontier, relativeRank(square, color));
  }
  return frontier;
};

const dropMoves = (position: Position): Move[] => {
  const color = position.turn;
  const hand = position.hands[color];
  const drafting = position.phase === 'draft';
  const marshalPlaced = hand.marshal === 0;
  if (drafting && !marshalPlaced) {
    return SQUARES.filter(
      (square) => relativeRank(square, color) <= 2 && canDropOn(position, color, square),
    ).map((to) => ({ kind: 'drop', role: 'marshal', to }));
  }
  const limit = drafting ? 2 : dropFrontier(position, color);
  const targets = SQUARES.filter(
    (square) => relativeRank(square, color) <= limit && canDropOn(position, color, square),
  );
  const moves: Move[] = [];
  for (const role of ROLES) {
    if (hand[role] === 0) continue;
    for (const to of targets) {
      moves.push({ kind: 'drop', role, to });
      if (role === 'tactician' && !drafting) {
        const remaining = { ...hand, tactician: hand.tactician - 1 };
        for (const betray of betrayalOptions(position.board[to]!, color, remaining)) {
          moves.push({ kind: 'drop', role, to, betray });
        }
      }
    }
  }
  return moves;
};

/** Whether `color`'s marshal could be captured if `color`'s opponent were to move now. */
export const isMarshalAttacked = (position: Position, color: Color): boolean => {
  const target = findMarshal(position, color);
  if (target === undefined) return false;
  const attacker = opposite(color);
  for (const square of SQUARES) {
    const tower = position.board[square]!;
    const piece = topOf(tower);
    if (piece?.color !== attacker) continue;
    if (!reachableSquares(position, square).includes(target)) continue;
    if (actionsOn(position, piece, tower.length, target).includes('capture')) return true;
  }
  return false;
};

/** Moves allowed by piece movement, ignoring whether they expose the mover's marshal. */
export const pseudoLegalMoves = (position: Position): Move[] => {
  const moves = dropMoves(position);
  if (position.phase === 'draft') {
    if (position.hands[position.turn].marshal === 0) moves.push({ kind: 'done' });
    return moves;
  }
  for (const square of SQUARES) {
    if (topOf(position.board[square]!)?.color === position.turn) {
      moves.push(...boardMovesFrom(position, square));
    }
  }
  return moves;
};

/**
 * Pseudo-legal moves that do not leave the mover's marshal capturable (docs/rules.md section 9). Capturing the
 * opponent's marshal is always allowed: it ends the game, so whatever still attacks the mover's marshal no longer
 * matters. After the draft, which does not check marshal safety, both marshals can start the play phase attacked.
 */
export const legalMoves = (position: Position): Move[] => {
  const moves = pseudoLegalMoves(position);
  if (position.phase === 'draft') return moves;
  const color = position.turn;
  return moves.filter((move) => {
    const next = applyMove(position, move);
    return findMarshal(next, opposite(color)) === undefined || !isMarshalAttacked(next, color);
  });
};
