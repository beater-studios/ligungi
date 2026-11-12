import { applyMove } from './apply.ts';
import { repetitionKey } from './fen.ts';
import { legalMoves } from './movegen.ts';
import { handSize, initialPosition } from './position.ts';
import { moveToString, parseMove } from './notation.ts';
import { opposite, type Color, type Move, type Outcome, type Position } from './types.ts';

export const REPETITION_LIMIT = 4;

/** Only both marshals remain on the board and nothing is left in hand (docs/rules.md section 9). */
export const isInsufficientMaterial = (position: Position): boolean =>
  position.phase === 'play' &&
  handSize(position.hands.white) === 0 &&
  handSize(position.hands.black) === 0 &&
  position.board.every((tower) => tower.every((piece) => piece.role === 'marshal'));

const hasMarshal = (position: Position, color: Color): boolean =>
  position.board.some((tower) => tower.some((piece) => piece.role === 'marshal' && piece.color === color));

export class IllegalMoveError extends Error {}

export class Game {
  readonly #positions: Position[];
  readonly #moves: Move[] = [];
  readonly #seen = new Map<string, number>();
  #outcome: Outcome | undefined;
  #legal: Move[] | undefined;

  constructor(start: Position = initialPosition('advanced')) {
    this.#positions = [start];
    this.#record(start);
    this.#evaluate();
  }

  get position(): Position {
    return this.#positions[this.#positions.length - 1]!;
  }

  get moves(): readonly Move[] {
    return this.#moves;
  }

  get positions(): readonly Position[] {
    return this.#positions;
  }

  get outcome(): Outcome | undefined {
    return this.#outcome;
  }

  legalMoves(): readonly Move[] {
    if (this.#outcome) return [];
    this.#legal ??= legalMoves(this.position);
    return this.#legal;
  }

  play(input: Move | string): Position {
    if (this.#outcome) throw new IllegalMoveError('Game is over');
    const move = typeof input === 'string' ? parseMove(input) : input;
    const key = move && moveToString(move);
    const legal = key !== undefined && this.legalMoves().find((m) => moveToString(m) === key);
    if (!legal) throw new IllegalMoveError(`Illegal move ${typeof input === 'string' ? input : key}`);
    const next = applyMove(this.position, legal);
    this.#moves.push(legal);
    this.#positions.push(next);
    this.#legal = undefined;
    this.#record(next);
    this.#evaluate();
    return next;
  }

  resign(color: Color): void {
    if (!this.#outcome) this.#outcome = { winner: opposite(color), reason: 'resign' };
  }

  timeout(color: Color): void {
    if (!this.#outcome) this.#outcome = { winner: opposite(color), reason: 'timeout' };
  }

  abandon(color: Color): void {
    if (!this.#outcome) this.#outcome = { winner: opposite(color), reason: 'abandon' };
  }

  agreeDraw(): void {
    if (!this.#outcome) this.#outcome = { winner: null, reason: 'agreement' };
  }

  #record(position: Position): void {
    if (position.phase !== 'play') return;
    const key = repetitionKey(position);
    this.#seen.set(key, (this.#seen.get(key) ?? 0) + 1);
  }

  #evaluate(): void {
    const position = this.position;
    if (position.phase !== 'play') return;
    // The draft does not check marshal safety, so the first player may be able to capture right away.
    if (!hasMarshal(position, position.turn)) {
      this.#outcome = { winner: opposite(position.turn), reason: 'capture' };
    } else if ((this.#seen.get(repetitionKey(position)) ?? 0) >= REPETITION_LIMIT) {
      this.#outcome = { winner: null, reason: 'repetition' };
    } else if (isInsufficientMaterial(position)) {
      this.#outcome = { winner: null, reason: 'insufficient' };
    } else if (this.legalMoves().length === 0) {
      this.#outcome = { winner: opposite(position.turn), reason: 'mate' };
    }
  }
}
