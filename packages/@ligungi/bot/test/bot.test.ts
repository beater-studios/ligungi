import { describe, expect, it } from 'vitest';
import { Game, applyMove, initialPosition, legalMoves, moveToString, repetitionKey } from '@ligungi/engine';
import { build } from '../../engine/test/helpers.ts';
import { BOT_LEVELS, Searcher, chooseMove } from '../src/index.ts';

/** A budget that never runs out, so the searching levels play the same moves on every machine. */
const fixed = (maxDepth: number) => ({ timeMs: 60_000, maxDepth });

const seeded = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 2 ** 32;
  return seed / 2 ** 32;
};

describe('bot', () => {
  it('always returns a legal move, in draft and in play', () => {
    for (const level of BOT_LEVELS) {
      for (const position of [initialPosition('advanced'), initialPosition('beginner')]) {
        const move = chooseMove(position, level, { random: seeded(level), limits: fixed(2) });
        expect(legalMoves(position).map(moveToString)).toContain(moveToString(move));
      }
    }
  });

  it('finds a win in one from level 2 up', () => {
    const position = build({ e1: 'M', i9: 'm', a8: 'G', e5: 'L' });
    for (const level of [2, 3, 4, 5] as const) {
      const game = new Game(position);
      game.play(chooseMove(position, level, { random: seeded(7), limits: fixed(3) }));
      expect(game.outcome?.winner, `level ${level}`).toBe('white');
    }
  });

  it('takes a free piece at every search depth', () => {
    // Regression: a random bonus on root scores once made the search pick whatever move it looked at last.
    const position = build({ e1: 'M', e9: 'm', c4: 'P', c5: 'g' });
    for (const depth of [1, 2, 3]) {
      expect(moveToString(new Searcher(fixed(depth), seeded(depth)).choose(position).move), `depth ${depth}`).toBe('c4c5x');
    }
  });

  it('sees the recapture that the greedy level misses', () => {
    // Taking the defended samurai with the general loses the general to e6e5x.
    const position = build({ a1: 'M', i9: 'm', e4: 'G', e5: 's', e6: 'g' });
    expect(moveToString(chooseMove(position, 2, { random: seeded(3) }))).toBe('e4e5x');
    for (const depth of [1, 2, 3]) {
      expect(moveToString(new Searcher(fixed(depth), seeded(depth)).choose(position).move), `depth ${depth}`).not.toBe('e4e5x');
    }
  });

  it('avoids repeating a position when ahead, and seeks it when behind', () => {
    // White is a general up: the move it would pick is refused once its result already happened in the game.
    const ahead = build({ e1: 'M', i9: 'm', a1: 'G' });
    const first = new Searcher(fixed(2), seeded(5)).choose(ahead).move;
    const again = new Searcher(fixed(2), seeded(5)).choose(ahead, [repetitionKey(applyMove(ahead, first))]).move;
    expect(moveToString(again)).not.toBe(moveToString(first));

    // White is a general down: returning to an earlier position (a draw) beats every other move.
    const behind = build({ e1: 'M', i9: 'm', a9: 'g' });
    const target = legalMoves(behind).find((move) => moveToString(move) === 'e1e2')!;
    const chosen = new Searcher(fixed(2), seeded(5)).choose(behind, [repetitionKey(applyMove(behind, target))]).move;
    expect(moveToString(chosen)).toBe('e1e2');
  });

  it('sees a drop as a defense of the marshal, even far down the drop ordering', () => {
    // After ...a5a4 the white marshal is attacked along the a-file with b1 and b2 covered: only a soldier dropped on a2
    // or a3 saves it. Those squares rank low among the drops, so a search that tried only the best few saw a mate.
    const defended = build({ a1: 'M', a4: 'g', b9: 'g', i6: 'P', e9: 'm' }, { hands: { white: { soldier: 1 } } });
    expect(legalMoves(defended).map(moveToString).sort()).toEqual(['P*a2', 'P*a3']);
    const position = build({ a1: 'M', a5: 'g', b9: 'g', i6: 'P', e9: 'm' }, { turn: 'black', hands: { white: { soldier: 1 } } });
    expect(new Searcher(fixed(2), seeded(1)).choose(position).score).toBeLessThan(50_000);
  });

  it('stops at the time budget with a legal move', () => {
    let now = 0;
    const position = initialPosition('beginner');
    // Each clock reading advances 1 ms: the search runs out of time after a few hundred nodes.
    const result = new Searcher({ timeMs: 5, maxDepth: 20, now: () => now++ }, seeded(1)).choose(position);
    expect(legalMoves(position).map(moveToString)).toContain(moveToString(result.move));
    expect(result.depth).toBeLessThan(20);
  });

  it('plays complete games against itself without illegal moves', () => {
    for (const [mode, level] of [['intro', 3], ['advanced', 2], ['intermediate', 1], ['beginner', 4]] as const) {
      const random = seeded(level * 11);
      const game = new Game(initialPosition(mode));
      for (let ply = 0; ply < 120 && !game.outcome; ply++) game.play(chooseMove(game.position, level, { random, limits: fixed(1) }));
      expect(game.moves.length).toBeGreaterThan(10);
    }
  }, 60_000);
});
