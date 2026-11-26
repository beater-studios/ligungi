import { describe, expect, it } from 'vitest';
import {
  FIXED_SETUPS,
  INITIAL_DRAFT_FEN,
  MODES,
  ROLES,
  ROLE_INFO,
  SQUARE_COUNT,
  fromRulebook,
  initialPosition,
  material,
  toFen,
  toRulebook,
} from '../src/index.ts';

describe('initial positions', () => {
  it('gives each player 25 pieces in the official counts', () => {
    expect(ROLES.reduce((sum, role) => sum + ROLE_INFO[role].count, 0)).toBe(25);
  });

  it('starts draft modes with every piece in hand', () => {
    for (const mode of ['intermediate', 'advanced'] as const) {
      const position = initialPosition(mode);
      expect(position.phase).toBe('draft');
      expect(position.turn).toBe('white');
      for (const role of ROLES) {
        expect(material(position).white[role]).toBe(ROLE_INFO[role].count);
        expect(material(position).black[role]).toBe(ROLE_INFO[role].count);
      }
    }
    expect(toFen(initialPosition('advanced'))).toBe(INITIAL_DRAFT_FEN);
  });

  it('matches the rulebook fixed setups: board + hand + unused pieces = 25', () => {
    const unused = {
      intro: { cannon: 1, musketeer: 1, archer: 2, tactician: 1 },
      beginner: { cannon: 1, musketeer: 1, tactician: 1 },
    } as const;
    for (const mode of ['intro', 'beginner'] as const) {
      const position = initialPosition(mode);
      expect(position.phase).toBe('play');
      for (const color of ['white', 'black'] as const) {
        for (const role of ROLES) {
          const excluded = (unused[mode] as Partial<Record<string, number>>)[role] ?? 0;
          expect(material(position)[color][role] + excluded).toBe(ROLE_INFO[role].count);
        }
      }
    }
  });

  it('places Black as the 180° rotation of White, as printed in the rulebook', () => {
    const position = initialPosition('beginner');
    for (let square = 0; square < SQUARE_COUNT; square++) {
      const white = position.board[square]!;
      const black = position.board[SQUARE_COUNT - 1 - square]!;
      expect(white.length).toBe(black.length);
      if (white[0]?.color === 'white') expect(black[0]).toEqual({ ...white[0], color: 'black' });
    }
    const at = (column: number, row: number) => position.board[fromRulebook(column, row)]![0];
    expect(at(5, 9)).toEqual({ role: 'marshal', color: 'white' });
    expect(at(6, 1)).toEqual({ role: 'lieutenant', color: 'black' });
    expect(at(8, 2)).toEqual({ role: 'rider', color: 'black' });
    expect(at(2, 8)).toEqual({ role: 'rider', color: 'white' });
    expect(FIXED_SETUPS.beginner!.layout).toHaveLength(15);
  });

  it('converts rulebook coordinates both ways', () => {
    for (let square = 0; square < SQUARE_COUNT; square++) {
      const { column, row } = toRulebook(square);
      expect(fromRulebook(column, row)).toBe(square);
    }
    expect(MODES).toHaveLength(4);
  });
});
