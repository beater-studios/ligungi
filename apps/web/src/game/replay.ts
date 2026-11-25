import { Game, initialPosition, parseMove, type Color, type Mode, type Move, type Position } from '@ligungi/engine';

export interface Replay {
  readonly game: Game;
  /** `positions[i]` is the position before move `i`; the last one is the current position. */
  readonly positions: readonly Position[];
  readonly moves: readonly Move[];
}

export const replayFrom = (start: Position, moves: readonly (Move | string)[]): Replay => {
  const game = new Game(start);
  for (const entry of moves) {
    const move = typeof entry === 'string' ? parseMove(entry) : entry;
    if (!move) break;
    try {
      game.play(move);
    } catch {
      break;
    }
  }
  return { game, positions: game.positions, moves: game.moves };
};

export const replayGame = (mode: Mode, firstPlayer: Color, freeDraft: boolean, moves: readonly string[]): Replay =>
  replayFrom(initialPosition(mode, firstPlayer, { freeDraft }), moves);
