import { describe, expect, it } from 'vitest';
import {
  Game,
  initialPosition,
  legalMoves,
  moveToRulebook,
  rulebookParts,
  moveToString,
  parseFen,
  parseMove,
  toFen,
} from '../src/index.ts';
import { build } from './helpers.ts';

describe('FEN', () => {
  it('round-trips towers, hands, mode and phase', () => {
    const position = build(
      { e5: 'PpA', d4: 'Y' },
      { turn: 'black', mode: 'intermediate', hands: { white: { major: 2 }, black: { cannon: 1 } } },
    );
    const fen = toFen(position);
    expect(fen).toContain('(PpA)');
    expect(fen).toContain(' b 2Jc intermediate p');
    expect(parseFen(fen)).toEqual(position);
    for (const mode of ['intro', 'beginner', 'advanced'] as const) {
      expect(parseFen(toFen(initialPosition(mode)))).toEqual(initialPosition(mode));
    }
    const free = initialPosition('intermediate', 'black', { freeDraft: true });
    expect(toFen(free)).toContain(' intermediate d+ b');
    expect(parseFen(toFen(free))).toEqual(free);
  });
});

describe('move notation', () => {
  it('round-trips every legal move of the starting beginner position', () => {
    for (const move of legalMoves(initialPosition('beginner'))) {
      expect(parseMove(moveToString(move))).toEqual(move);
    }
    expect(parseMove('T*d2^12')).toEqual({ kind: 'drop', role: 'tactician', to: 12, betray: [0, 1] });
    expect(parseMove('z9z9')).toBeUndefined();
  });

  it('writes the rulebook examples: "4-7-2 侍" and "4-7-2 忍新"', () => {
    const stack = build({ f2: 'S', f3: 'P' });
    expect(moveToRulebook(stack, parseMove('f2f3=')!)).toBe('4-7-2 侍');
    const drop = build({ a1: 'M', f3: 'P' }, { hands: { white: { spy: 1 } } });
    expect(moveToRulebook(drop, parseMove('Y*f3')!)).toBe('4-7-2 忍新');
  });

  it('gives the parts of a rulebook move for other notations', () => {
    const stack = build({ f2: 'S', f3: 'P' });
    expect(rulebookParts(stack, parseMove('f2f3=')!)).toEqual({
      done: false, column: 4, row: 7, level: 2, role: 'samurai', drop: false, capture: false, betray: false,
    });
    const drop = build({ a1: 'M', f3: 'P' }, { hands: { white: { spy: 1 } } });
    expect(rulebookParts(drop, parseMove('Y*f3')!)).toMatchObject({ level: 2, role: 'spy', drop: true });
    expect(rulebookParts(drop, { kind: 'done' })).toEqual({ done: true });
  });

  it('plays a few opening moves of the intro setup', () => {
    const game = new Game(initialPosition('intro'));
    game.play('e3e4');
    game.play('e7e6');
    game.play('N*e2');
    expect(game.moves).toHaveLength(3);
    expect(() => game.play('a1a2')).toThrow();
  });
});
