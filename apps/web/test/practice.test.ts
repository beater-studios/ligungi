import { PRACTICE_POSITIONS } from '@ligungi/content';
import { describe, expect, it } from 'vitest';
import { ENGLISH } from '../src/i18n/messages.ts';

describe('practice', () => {
  it('names every position', () => {
    for (const position of PRACTICE_POSITIONS) {
      expect(ENGLISH.practice.positions[position.id as keyof typeof ENGLISH.practice.positions], position.id).toBeTruthy();
    }
  });
});
