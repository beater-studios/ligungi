import { describe, expect, it } from 'vitest';
import {
  COLORS,
  Game,
  MODES,
  MODE_RULES,
  ROLES,
  ROLE_INFO,
  initialPosition,
  isMarshalAttacked,
  material,
  opposite,
  parseFen,
  toFen,
  type Position,
} from '../src/index.ts';

const seeded = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 2 ** 32;
  return seed / 2 ** 32;
};

const checkInvariants = (position: Position) => {
  const counts = material(position);
  for (const color of COLORS) {
    for (const role of ROLES) expect(counts[color][role]).toBeLessThanOrEqual(ROLE_INFO[role].count);
  }
  for (const tower of position.board) {
    expect(tower.length).toBeLessThanOrEqual(MODE_RULES[position.mode].maxHeight);
    tower.slice(0, -1).forEach((piece) => expect(piece.role).not.toBe('marshal'));
  }
  if (position.phase === 'play') {
    expect(isMarshalAttacked(position, opposite(position.turn))).toBe(false);
    for (const color of COLORS) expect(counts[color].marshal).toBe(1);
  }
  expect(parseFen(toFen(position))).toEqual(position);
};

describe('random games', () => {
  for (const mode of MODES) {
    it(`keeps every invariant in ${mode} games`, () => {
      const random = seeded(MODES.indexOf(mode) + 1);
      for (let g = 0; g < 4; g++) {
        const game = new Game(initialPosition(mode));
        for (let ply = 0; ply < 160 && !game.outcome; ply++) {
          const moves = game.legalMoves();
          const done = moves.find((m) => m.kind === 'done');
          const pick = done && random() < 0.08 ? done : moves[Math.floor(random() * moves.length)]!;
          game.play(pick);
          checkInvariants(game.position);
        }
      }
    }, 30_000); // dozens of full random games: slow by nature on a busy machine
  }
});
