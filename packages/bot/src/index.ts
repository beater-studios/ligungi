import {
  SQUARES,
  applyMove,
  fileOf,
  handSize,
  isMarshalAttacked,
  legalMoves,
  opposite,
  relativeRank,
  topOf,
  type Color,
  type Move,
  type Position,
  type Role,
} from '@ligungi/engine';

import { Searcher, VALUE, type Random, type SearchLimits } from './search.ts';

export { Searcher, evaluate as evaluateForSideToMove, type Random, type SearchLimits, type SearchResult } from './search.ts';

export type BotLevel = 1 | 2 | 3 | 4 | 5;

export const BOT_LEVELS: readonly BotLevel[] = [1, 2, 3, 4, 5];

/** Levels 4 and 5 search with alpha-beta and iterative deepening within a time budget per move. */
export const SEARCH_LIMITS: Readonly<Record<4 | 5, SearchLimits>> = {
  4: { timeMs: 800, maxDepth: 6 },
  5: { timeMs: 2500, maxDepth: 12 },
};


const MATE = 1_000_000;
const ROOT_DROP_LIMIT = 24;

/** Static evaluation from `color`'s point of view. */
export const evaluate = (position: Position, color: Color): number => {
  let score = 0;
  for (const square of SQUARES) {
    const tower = position.board[square]!;
    tower.forEach((piece, level) => {
      const sign = piece.color === color ? 1 : -1;
      let value = VALUE[piece.role];
      if (level === tower.length - 1) {
        value += value * 0.15 * level;
        if (piece.role !== 'marshal') value += relativeRank(square, piece.color) * 4;
      }
      score += sign * value;
    });
  }
  for (const side of [color, opposite(color)] as const) {
    const sign = side === color ? 1 : -1;
    const hand = position.hands[side];
    for (const role of Object.keys(hand) as Role[]) score += sign * hand[role] * VALUE[role] * 0.9;
  }
  if (position.phase === 'play' && isMarshalAttacked(position, opposite(color))) score += 40;
  return score;
};

const pick = <T>(items: readonly T[], random: Random): T => items[Math.floor(random() * items.length)]!;

const shuffle = <T>(items: readonly T[], random: Random): T[] => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
};

const FRONT_ROLES = new Set<Role>(['soldier', 'lancer', 'samurai', 'fortress']);
const BACK_ROLES = new Set<Role>(['spy', 'rider', 'tactician']);

const draftMove = (position: Position, moves: readonly Move[], random: Random): Move => {
  const color = position.turn;
  const hand = position.hands[color];
  const drops = moves.filter((move): move is Extract<Move, { kind: 'drop' }> => move.kind === 'drop');
  if (hand.marshal > 0) {
    const central = drops.filter((m) => relativeRank(m.to, color) === 0 && Math.abs(fileOf(m.to) - 4) <= 1);
    return pick(central.length ? central : drops, random);
  }
  const placed = 25 - handSize(hand);
  const done = moves.find((move) => move.kind === 'done');
  if (done && placed >= 14 + Math.floor(random() * 6)) return done;
  const flat = drops.filter((m) => position.board[m.to]!.length === 0);
  const candidates = flat.length ? flat : drops;
  const preferredRank = (role: Role) => (FRONT_ROLES.has(role) ? 2 : BACK_ROLES.has(role) ? 0 : 1);
  const fitting = candidates.filter((m) => relativeRank(m.to, color) === preferredRank(m.role));
  return pick(fitting.length ? fitting : candidates, random) ?? done ?? moves[0]!;
};

const limitDrops = (moves: readonly Move[], random: Random, limit: number): Move[] => {
  const drops = moves.filter((m) => m.kind === 'drop');
  const others = moves.filter((m) => m.kind !== 'drop');
  return drops.length <= limit ? [...moves] : [...others, ...shuffle(drops, random).slice(0, limit)];
};

const captureFirst = (moves: readonly Move[]): Move[] =>
  [...moves].sort((a, b) => Number(b.kind === 'move' && b.action === 'capture') - Number(a.kind === 'move' && a.action === 'capture'));

const greedy = (position: Position, moves: readonly Move[], random: Random): Move => {
  const color = position.turn;
  let best = moves[0]!;
  let bestScore = -Infinity;
  for (const move of limitDrops(moves, random, ROOT_DROP_LIMIT)) {
    const after = applyMove(position, move);
    const score = legalMoves(after).length === 0 ? MATE : evaluate(after, color) + random() * 20;
    if (score > bestScore) {
      bestScore = score;
      best = move;
    }
  }
  return best;
};

const search = (position: Position, moves: readonly Move[], random: Random): Move => {
  const color = position.turn;
  let best = moves[0]!;
  let alpha = -Infinity;
  for (const move of captureFirst(limitDrops(moves, random, ROOT_DROP_LIMIT))) {
    const after = applyMove(position, move);
    const replies = legalMoves(after);
    if (replies.length === 0) return move;
    const boardReplies = replies.filter((r) => r.kind !== 'drop');
    let worst = Infinity;
    for (const reply of captureFirst(boardReplies.length ? boardReplies : replies)) {
      const leaf = applyMove(after, reply);
      let score = evaluate(leaf, color);
      if (isMarshalAttacked(leaf, color)) score -= 150;
      if (score < worst) worst = score;
      if (worst <= alpha) break;
    }
    const score = worst + random() * 10;
    if (score > alpha) {
      alpha = score;
      best = move;
    }
  }
  return best;
};

export interface ChooseOptions {
  readonly random?: Random;
  /** Overrides the search budget of levels 4 and 5 (tests). */
  readonly limits?: SearchLimits;
  /** Repetition keys (`repetitionKey`) of the earlier positions of the game, so levels 4 and 5 avoid repeating. */
  readonly history?: readonly string[];
}

/** Picks a move for the side to move. Throws when there is none. */
export const chooseMove = (position: Position, level: BotLevel, options: ChooseOptions = {}): Move => {
  const random = options.random ?? Math.random;
  const moves = legalMoves(position);
  if (moves.length === 0) throw new Error('No legal moves');
  if (position.phase === 'draft') return draftMove(position, moves, random);
  const top = moves.find((m) => m.kind === 'move' && topOf(position.board[m.to]!)?.role === 'marshal');
  if (top) return top;
  if (level === 1) return pick(moves, random);
  if (level === 2) return greedy(position, moves, random);
  if (level === 3) return search(position, moves, random);
  return new Searcher(options.limits ?? SEARCH_LIMITS[level], random).choose(position, options.history).move;
};
