import { applyMove, isMarshalAttacked, legalMoves, moveToString, opposite, parseFen } from '@ligungi/engine';
import { describe, expect, it } from 'vitest';
import { MATE_PROBLEMS } from '../src/mates.ts';

describe('mate problems', () => {
  it('has unique problems', () => {
    expect(MATE_PROBLEMS.length).toBeGreaterThan(0);
    expect(new Set(MATE_PROBLEMS.map((problem) => problem.id)).size).toBe(MATE_PROBLEMS.length);
    expect(new Set(MATE_PROBLEMS.map((problem) => problem.fen)).size).toBe(MATE_PROBLEMS.length);
  });

  it('stores solutions that are legal, attack the Marshal on every move and end in mate', () => {
    for (const problem of MATE_PROBLEMS) {
      expect(problem.id).toMatch(/^[0-9a-f]{8}$/);
      expect(problem.moves).toBeGreaterThanOrEqual(1);
      expect(problem.moves).toBeLessThanOrEqual(3);
      expect(problem.line).toHaveLength(problem.moves * 2 - 1);
      let position = parseFen(problem.fen);
      expect(position.phase).toBe('play');
      const attacker = position.turn;
      problem.line.forEach((text, index) => {
        const move = legalMoves(position).find((candidate) => moveToString(candidate) === text);
        expect(move, `${problem.id}: ${text}`).toBeDefined();
        position = applyMove(position, move!);
        if (index % 2 === 0) expect(isMarshalAttacked(position, opposite(attacker)), `${problem.id}: ${text} checks`).toBe(true);
      });
      expect(legalMoves(position), `${problem.id} ends in mate`).toEqual([]);
    }
  });
});
