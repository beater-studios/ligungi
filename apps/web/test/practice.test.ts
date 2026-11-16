import { legalMoves, parseFen, positionProblems } from '@ligungi/engine';
import { PRACTICE_POSITIONS, PRACTICE_SECTIONS, practiceResult } from '@ligungi/protocol';
import { describe, expect, it } from 'vitest';
import { en } from '../src/i18n/en.tsx';
import { es } from '../src/i18n/es.tsx';
import { pt } from '../src/i18n/pt.tsx';

describe('practice', () => {
  it('has valid positions, each named in every language', () => {
    expect(new Set(PRACTICE_POSITIONS.map((position) => position.id)).size).toBe(PRACTICE_POSITIONS.length);
    for (const section of PRACTICE_SECTIONS) expect(section.positions.length).toBeGreaterThan(0);
    for (const position of PRACTICE_POSITIONS) {
      const start = parseFen(position.fen);
      expect(positionProblems(start), position.id).toEqual([]);
      expect(start.phase).toBe('play');
      expect(legalMoves(start).length, position.id).toBeGreaterThan(0);
      for (const t of [pt, en, es]) expect(t.practice.positions[position.id as keyof typeof t.practice.positions], position.id).toBeTruthy();
    }
  });

  it('judges each goal', () => {
    const mate = { kind: 'mate', moves: 10 } as const;
    const survive = { kind: 'survive', moves: 5 } as const;
    expect(practiceResult(mate, null, 3, 'white')).toBe('playing');
    expect(practiceResult(mate, { winner: 'white', reason: 'mate' }, 4, 'white')).toBe('won');
    expect(practiceResult(mate, null, 10, 'white')).toBe('failed');
    expect(practiceResult({ kind: 'win', moves: 10 }, { winner: 'white', reason: 'resign' }, 4, 'white')).toBe('won');
    expect(practiceResult(mate, { winner: null, reason: 'repetition' }, 4, 'white')).toBe('failed');
    expect(practiceResult(survive, null, 5, 'white')).toBe('won');
    expect(practiceResult(survive, { winner: null, reason: 'repetition' }, 3, 'white')).toBe('won');
    expect(practiceResult(survive, { winner: 'black', reason: 'mate' }, 3, 'white')).toBe('failed');
  });
});
