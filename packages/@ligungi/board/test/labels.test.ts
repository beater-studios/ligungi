import { ROLES } from '@ligungi/engine';
import { describe, expect, it } from 'vitest';
import { ENGLISH_PIECE_NAMES, JAPANESE_PIECE_NAMES, pieceName, pieceShortName } from '../src/index.ts';

describe('piece names', () => {
  it('abbreviates only the long names for the move list, and never two pieces alike', () => {
    for (const names of [ENGLISH_PIECE_NAMES, JAPANESE_PIECE_NAMES]) {
      const short = ROLES.map((role) => pieceShortName(role, names));
      expect(new Set(short).size).toBe(ROLES.length);
      for (const role of ROLES) {
        const full = pieceName(role, names);
        const abbreviated = pieceShortName(role, names);
        expect(abbreviated.length).toBeLessThanOrEqual(10);
        if (full.length <= 9) expect(abbreviated).toBe(full);
      }
    }
    expect(pieceShortName('major', ENGLISH_PIECE_NAMES)).toBe('Maj. Gen.');
  });
});
