import { describe, expect, it } from 'vitest';
import { Game, initialPosition, legalMoves, moveToString } from '@ligungi/engine';
import { build } from '../../engine/test/helpers.ts';
import { BOT_LEVELS, chooseMove } from '../src/index.ts';

const seeded = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 2 ** 32;
  return seed / 2 ** 32;
};

describe('bot', () => {
  it('always returns a legal move, in draft and in play', () => {
    for (const level of BOT_LEVELS) {
      for (const position of [initialPosition('advanced'), initialPosition('beginner')]) {
        const move = chooseMove(position, level, seeded(level));
        expect(legalMoves(position).map(moveToString)).toContain(moveToString(move));
      }
    }
  });

  it('finds a win in one at levels 2 and 3', () => {
    const position = build({ e1: 'M', i9: 'm', a8: 'G', e5: 'L' });
    for (const level of [2, 3] as const) {
      const game = new Game(position);
      game.play(chooseMove(position, level, seeded(7)));
      expect(game.outcome?.winner, `level ${level}`).toBe('white');
    }
  });

  it('plays complete games against itself without illegal moves', () => {
    for (const [mode, level] of [['intro', 3], ['advanced', 2], ['intermediate', 1]] as const) {
      const random = seeded(level * 11);
      const game = new Game(initialPosition(mode));
      for (let ply = 0; ply < 120 && !game.outcome; ply++) game.play(chooseMove(game.position, level, random));
      expect(game.moves.length).toBeGreaterThan(10);
    }
  }, 60_000);
});
