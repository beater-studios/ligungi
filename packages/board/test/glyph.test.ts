import { ROLES } from '@ligungi/engine';
import { describe, expect, it } from 'vitest';
import { glyphClass, pieceGlyph, pieceLetters, PIECE_STYLES, TRACE_ICONS, type PieceNames } from '../src/index.ts';

describe('piece glyphs', () => {
  it('gives every piece its own two letters in each language', () => {
    for (const names of ['pt', 'en', 'es', 'ja'] as PieceNames[]) {
      const letters = ROLES.map((role) => pieceLetters(role, names));
      expect(new Set(letters).size).toBe(ROLES.length);
      for (const text of letters) expect(text).toMatch(/^[A-Z][A-Za-z]$/);
    }
  });

  it('draws the letters style in the language asked for', () => {
    expect(pieceGlyph('rider', 'letters', false, 'pt')).toBe('<b class="gg-letters">Cv</b>');
    expect(pieceGlyph('rider', 'letters', false, 'en')).toBe('<b class="gg-letters">Kn</b>');
    expect(pieceGlyph('rider', 'letters', true, 'es')).toContain('<b class="gg-letters">Cb</b>');
  });

  it('draws the trace style as outlines, with single-stroke versions where a solid shape would double', () => {
    const lancer = pieceGlyph('lancer', 'trace', false);
    expect(lancer).toContain('class="gg-icon gg-trace"');
    expect(lancer).toContain(TRACE_ICONS.lancer);
    expect(pieceGlyph('lancer', 'illustrated', false)).not.toContain('gg-trace');
    expect(pieceGlyph('marshal', 'trace', false)).toContain('gg-trace');
  });

  it('lays out icons and text the same way in every style', () => {
    expect(PIECE_STYLES).toEqual(['illustrated', 'trace', 'kanji', 'letters']);
    expect(glyphClass('trace', false)).toBe('gg-illustrated');
    expect(glyphClass('letters', true)).toBe('gg-guided');
    expect(glyphClass('letters', false)).toBe('');
    expect(pieceGlyph('marshal', 'kanji', false)).toBe('帥');
  });
});
