import { isMarshalAttacked, legalMoves, opposite } from '@ligungi/engine';
import { describe, expect, it } from 'vitest';
import { PUZZLES } from '../src/puzzle-data.ts';
import { puzzleInfo, puzzlePositions } from '../src/puzzles.ts';

describe('puzzles', () => {
  it('has unique puzzles of both kinds', () => {
    expect(new Set(PUZZLES.map((puzzle) => puzzle.id)).size).toBe(PUZZLES.length);
    expect(new Set(PUZZLES.map((puzzle) => puzzle.fen)).size).toBe(PUZZLES.length);
    const kinds = new Set(PUZZLES.map((puzzle) => puzzleInfo(puzzle).kind));
    expect(kinds).toEqual(new Set(['mate', 'material']));
  });

  it('stores lines that are legal, end with the solver to have moved and keep to their kind', () => {
    for (const puzzle of PUZZLES) {
      expect(puzzle.id).toMatch(/^[0-9a-f]{8}$/);
      expect(puzzle.line.length % 2, puzzle.id).toBe(1);
      const positions = puzzlePositions(puzzle);
      const info = puzzleInfo(puzzle);
      // The stored kind matches the line: a mate leaves the defender with no move.
      expect(legalMoves(positions[positions.length - 1]!).length === 0 ? 'mate' : 'material', puzzle.id).toBe(puzzle.kind);
      expect(positions[0]!.phase, puzzle.id).toBe('play');
      expect(info.moves).toBeLessThanOrEqual(3);
      if (info.kind === 'mate') {
        // Tsume: every solver move attacks the Marshal.
        for (let index = 1; index < positions.length; index += 2) {
          expect(isMarshalAttacked(positions[index]!, opposite(info.color)), `${puzzle.id} move ${index}`).toBe(true);
        }
        expect(info.themes).toContain(`mateIn${info.moves}`);
      } else {
        // The material is won by the solver's last move.
        expect(info.themes.some((theme) => theme === 'capture' || theme === 'betrayal'), puzzle.id).toBe(true);
        expect(info.themes).toContain('material');
      }
    }
    // Replays every stored line with full move generation, which takes a while with hundreds of puzzles.
  }, 120_000);

  it('reads the start rating from the kind and length', () => {
    const mateInOne = PUZZLES.map(puzzleInfo).find((info) => info.kind === 'mate' && info.moves === 1)!;
    expect(mateInOne.startRating).toBe(1000);
  });
});
