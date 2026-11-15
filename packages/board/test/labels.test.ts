import { ROLES } from '@ligungi/engine';
import { describe, expect, it } from 'vitest';
import { pieceName, pieceShortName, type PieceNames } from '../src/index.ts';

describe('piece names', () => {
  it('abbreviates only the long names for the move list, and never two pieces alike', () => {
    for (const names of ['pt', 'en', 'es', 'ja'] as PieceNames[]) {
      const short = ROLES.map((role) => pieceShortName(role, names));
      expect(new Set(short).size).toBe(ROLES.length);
      for (const role of ROLES) {
        const full = pieceName(role, names);
        const abbreviated = pieceShortName(role, names);
        expect(abbreviated.length).toBeLessThanOrEqual(10);
        if (full.length <= 9) expect(abbreviated).toBe(full);
      }
    }
    expect(pieceShortName('lieutenant', 'pt')).toBe('Ten.-Gen.');
    expect(pieceShortName('major', 'en')).toBe('Maj. Gen.');
  });
});
