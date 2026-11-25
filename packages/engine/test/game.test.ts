import { describe, expect, it } from 'vitest';
import { FenError, Game, IllegalMoveError, initialPosition, moveToString, parseFen, toFen } from '../src/index.ts';

describe('game results', () => {
  it('ends by resignation, time, abandonment or agreement, for the right side', () => {
    const ended = (end: (game: Game) => void) => {
      const game = new Game(initialPosition('intro'));
      end(game);
      return game.outcome;
    };
    expect(ended((game) => game.resign('white'))).toEqual({ winner: 'black', reason: 'resign' });
    expect(ended((game) => game.timeout('black'))).toEqual({ winner: 'white', reason: 'timeout' });
    expect(ended((game) => game.abandon('white'))).toEqual({ winner: 'black', reason: 'abandon' });
    expect(ended((game) => game.agreeDraw())).toEqual({ winner: null, reason: 'agreement' });
  });

  it('keeps the first result, and allows no move or takeback after it', () => {
    const game = new Game(initialPosition('intro'));
    const move = moveToString(game.legalMoves()[0]!);
    game.play(move);
    game.timeout('black');
    game.resign('white');
    game.agreeDraw();
    expect(game.outcome).toEqual({ winner: 'white', reason: 'timeout' });
    expect(game.legalMoves()).toEqual([]);
    expect(() => game.play(move)).toThrow(IllegalMoveError);
    expect(() => game.undo()).toThrow(IllegalMoveError);
    expect(game.moves).toHaveLength(1);
  });
});

describe('FEN', () => {
  it('refuses a record with missing or malformed fields', () => {
    const fen = toFen(initialPosition('advanced'));
    expect(parseFen(fen)).toEqual(initialPosition('advanced'));
    expect(() => parseFen('')).toThrow(FenError);
    expect(() => parseFen(fen.split(' ').slice(0, 5).join(' '))).toThrow(FenError);
    expect(() => parseFen(fen.replace(/ w$/, ' x'))).toThrow(FenError);
    expect(() => parseFen(`9/9/9 ${fen.split(' ').slice(1).join(' ')}`)).toThrow(FenError);
  });
});
