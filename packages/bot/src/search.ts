import {
  applyMove,
  isMarshalAttacked,
  legalMoves,
  moveToString,
  pseudoLegalMoves,
  relativeRank,
  repetitionKey,
  topOf,
  type Move,
  type Position,
  type Role,
} from '@ligungi/engine';

/** Piece values in centipawn-like units, shared with the static evaluation. */
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

export type Random = () => number;

export interface SearchLimits {
  /** Thinking time for the whole move; the deepest search finished in time is used. */
  readonly timeMs: number;
  readonly maxDepth: number;
  readonly now?: () => number;
}

export interface SearchResult {
  readonly move: Move;
  readonly score: number;
  /** Depth of the last search that finished. */
  readonly depth: number;
  readonly nodes: number;
}

const WIN = 100_000;
/** Captures and betrayals keep being searched past the nominal depth, up to this many plies. */
const QUIESCENCE_DEPTH = 3;
/** A capture is skipped in quiescence when even winning the piece outright would stay this far below alpha. */
const DELTA_MARGIN = 200;
/**
 * Drops kept at each node below the root when the marshal is safe: with many pieces in hand there can be hundreds, and
 * trying them all would leave no time to look deeper. Under attack every saving move is tried, drops included.
 */
const INNER_DROPS = 10;
const TIME_CHECK_EVERY = 256;

class OutOfTime extends Error {}

const shuffle = <T>(items: readonly T[], random: Random): T[] => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
};

/**
 * Moves after which no earlier position can come back: a capture removes a piece for good, a drop empties part of the
 * hand, a betrayal changes owners. Only after the others (moving or stacking) can the position repeat.
 */
const isReversible = (move: Move): boolean => move.kind === 'move' && move.action !== 'capture' && !move.betray?.length;

const isCapture = (move: Move): boolean => move.kind === 'move' && move.action === 'capture';
const betrayed = (move: Move): number => (move.kind === 'done' ? 0 : (move.betray?.length ?? 0));
const isBetrayal = (move: Move): boolean => betrayed(move) > 0;

const capturesMarshal = (position: Position, move: Move): boolean =>
  move.kind === 'move' && move.action === 'capture' && topOf(position.board[move.to]!)?.role === 'marshal';

/** Static evaluation from the side to move's point of view. */
export const evaluate = (position: Position): number => {
  const color = position.turn;
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

/** Material a tactical move wins at once: the captured top piece, and the betrayed ones counted roughly. */
const gain = (position: Position, move: Move): number => {
  let value = 0;
  if (move.kind === 'move' && move.action === 'capture') value += VALUE[topOf(position.board[move.to]!)!.role];
  if (isBetrayal(move) && move.kind !== 'done') {
    const tower = position.board[move.to]!;
    for (const level of move.betray!) value += 2 * VALUE[tower[level]!.role];
  }
  return value;
};

/** Higher first: captures of valuable pieces by cheap ones, then betrayals. */
const tacticalScore = (position: Position, move: Move): number => {
  let score = 0;
  if (isCapture(move) && move.kind === 'move') {
    score += 10 * VALUE[topOf(position.board[move.to]!)!.role] - VALUE[topOf(position.board[move.from]!)!.role] + 100_000;
  }
  if (isBetrayal(move)) score += 50_000 + 200 * betrayed(move);
  return score;
};

/** Drops that reach further and build higher towers first; cheap pieces before valuable ones. */
const dropScore = (position: Position, move: Extract<Move, { kind: 'drop' }>): number =>
  relativeRank(move.to, position.turn) * 10 + position.board[move.to]!.length * 15 - VALUE[move.role] / 100;

export class Searcher {
  readonly #limits: SearchLimits;
  readonly #random: Random;
  readonly #now: () => number;
  #deadline = 0;
  #nodes = 0;
  readonly #killers: string[][] = [];
  /** Positions of the game so far and of the current search line, by repetition key. */
  #seen = new Set<string>();

  constructor(limits: SearchLimits, random: Random) {
    this.#limits = limits;
    this.#random = random;
    this.#now = limits.now ?? (() => performance.now());
  }

  /**
   * Best move for the side to move, by iterative deepening. `history` holds the repetition keys of the earlier
   * positions of the game, so that returning to one counts as a draw. Throws when there is no legal move.
   */
  choose(position: Position, history: readonly string[] = []): SearchResult {
    const rootMoves = legalMoves(position);
    if (rootMoves.length === 0) throw new Error('No legal moves');
    this.#deadline = this.#now() + this.#limits.timeMs;
    this.#nodes = 0;
    this.#seen = new Set([...history, repetitionKey(position)]);
    // Shuffled before the (stable) ordering so that equal moves vary from game to game. A random bonus on the scores
    // would not do: alpha-beta returns bounds, not exact scores, for moves that are not the best.
    let ordered = this.#order(position, shuffle(rootMoves, this.#random), 0, Infinity);
    let best: SearchResult = { move: ordered[0]!, score: 0, depth: 0, nodes: 0 };
    for (let depth = 1; depth <= this.#limits.maxDepth; depth++) {
      const scores = new Map<Move, number>();
      let alpha = -Infinity;
      let bestMove: Move | null = null;
      try {
        for (const move of ordered) {
          const score = -this.#visit(position, move, (child) => this.#negamax(child, depth - 1, -Infinity, -alpha, 1));
          scores.set(move, score);
          if (score > alpha) {
            alpha = score;
            bestMove = move;
          }
        }
      } catch (error) {
        if (!(error instanceof OutOfTime)) throw error;
        // Scores of an unfinished depth are not comparable with the last finished one; they only help if none finished.
        if (best.depth === 0 && bestMove) best = { move: bestMove, score: alpha, depth: 0, nodes: this.#nodes };
        best = { ...best, nodes: this.#nodes };
        break;
      }
      best = { move: bestMove!, score: alpha, depth, nodes: this.#nodes };
      if (Math.abs(alpha) >= WIN - 100) break;
      ordered = [...ordered].sort((a, b) => scores.get(b)! - scores.get(a)!);
    }
    return best;
  }

  #tick(): void {
    if (++this.#nodes % TIME_CHECK_EVERY === 0 && this.#now() > this.#deadline) throw new OutOfTime();
  }

  #negamax(position: Position, depth: number, alpha: number, beta: number, ply: number): number {
    this.#tick();
    if (depth <= 0) return this.#quiesce(position, alpha, beta, ply, 0);
    const moves = pseudoLegalMoves(position);
    // Moves that expose one's own marshal are not filtered here: the reply that captures it ends the line, which is the
    // rule's outcome without the cost of checking every move.
    if (moves.some((move) => capturesMarshal(position, move))) return WIN - ply;
    const candidates = isMarshalAttacked(position, position.turn)
      ? this.#evasions(position, moves, ply)
      : this.#order(position, moves, ply, INNER_DROPS);
    if (candidates.length === 0) return -(WIN - ply);
    let best = -Infinity;
    for (const move of candidates) {
      const score = -this.#visit(position, move, (child) => this.#negamax(child, depth - 1, -beta, -alpha, ply + 1));
      if (score > best) best = score;
      if (score > alpha) alpha = score;
      if (alpha >= beta) {
        if (!isCapture(move)) this.#addKiller(ply, move);
        break;
      }
    }
    return best;
  }

  #quiesce(position: Position, alpha: number, beta: number, ply: number, qdepth: number): number {
    this.#tick();
    const moves = pseudoLegalMoves(position);
    if (moves.some((move) => capturesMarshal(position, move))) return WIN - ply;
    // With the marshal under attack, standing still is not an option: every reply has to be tried.
    const inDanger = isMarshalAttacked(position, position.turn);
    const stand = inDanger ? -Infinity : evaluate(position);
    if (inDanger && qdepth >= QUIESCENCE_DEPTH) return evaluate(position) - 300;
    if (!inDanger) {
      if (stand >= beta || qdepth >= QUIESCENCE_DEPTH) return stand;
      if (stand > alpha) alpha = stand;
    }
    const candidates = inDanger ? this.#evasions(position, moves, ply) : moves.filter((m) => isCapture(m) || isBetrayal(m));
    if (!inDanger) candidates.sort((a, b) => tacticalScore(position, b) - tacticalScore(position, a));
    let best = inDanger ? -(WIN - ply) : alpha;
    for (const move of candidates) {
      if (!inDanger && stand + gain(position, move) + DELTA_MARGIN <= alpha) continue;
      const floor = Math.max(alpha, best);
      const score = -this.#visit(position, move, (child) => this.#quiesce(child, -beta, -floor, ply + 1, qdepth + 1));
      if (score > best) best = score;
      if (best >= beta) return best;
    }
    return best;
  }

  /**
   * Searches the position after `move`, scored from the side that moves next. Coming back to a position of the game or
   * of this line scores as a draw, as engines usually do: repeating makes no progress, so the side ahead avoids it.
   */
  #visit(position: Position, move: Move, search: (child: Position) => number): number {
    const child = applyMove(position, move);
    if (!isReversible(move)) return search(child);
    const key = repetitionKey(child);
    if (this.#seen.has(key)) return 0;
    this.#seen.add(key);
    try {
      return search(child);
    } finally {
      this.#seen.delete(key);
    }
  }

  /**
   * Every move that leaves the marshal safe, drops included (a drop between attacker and marshal can be the only
   * defense), best first. Empty means there is no safe move, which loses.
   */
  #evasions(position: Position, moves: readonly Move[], ply: number): Move[] {
    const color = position.turn;
    return this.#order(position, moves, ply, Infinity).filter((move) => !isMarshalAttacked(applyMove(position, move), color));
  }

  #addKiller(ply: number, move: Move): void {
    const key = moveToString(move);
    const list = (this.#killers[ply] ??= []);
    if (list[0] === key) return;
    list.unshift(key);
    list.length = Math.min(list.length, 2);
  }

  /** Tactical moves, then killers, then other board moves, then the most promising drops (all of them at the root). */
  #order(position: Position, moves: readonly Move[], ply: number, dropLimit: number): Move[] {
    const killers = this.#killers[ply] ?? [];
    const board: Array<{ move: Move; score: number }> = [];
    const drops: Array<{ move: Extract<Move, { kind: 'drop' }>; score: number }> = [];
    for (const move of moves) {
      const tactical = tacticalScore(position, move);
      if (move.kind === 'drop' && tactical === 0) {
        drops.push({ move, score: dropScore(position, move) });
        continue;
      }
      const killer = tactical || killers.length === 0 ? -1 : killers.indexOf(moveToString(move));
      board.push({ move, score: tactical || (killer >= 0 ? 10_000 - killer : 0) });
    }
    board.sort((a, b) => b.score - a.score);
    drops.sort((a, b) => b.score - a.score);
    return [...board.map((entry) => entry.move), ...drops.slice(0, dropLimit).map((entry) => entry.move)];
  }
}
