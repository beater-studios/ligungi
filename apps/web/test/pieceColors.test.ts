import { describe, expect, it } from 'vitest';
import { mixColors } from '../src/boardColors.ts';
import { customPieceStyle, DEFAULT_CUSTOM_PIECES } from '../src/pieceColors.ts';

describe('custom piece colors', () => {
  it('gives the default colors no warning and a shine and rim around each face', () => {
    const style = customPieceStyle(DEFAULT_CUSTOM_PIECES);
    expect(style.warnings).toEqual([]);
    expect(style.vars['--gg-custom-white-face']).toBe('#f6f1e7');
    expect(style.vars['--gg-custom-black-ink']).toBe('#f4f1ea');
    expect(style.vars['--gg-custom-black-rim']).toBe(mixColors('#232323', '#000000', 0.25));
  });

  it('warns about faint ink and sides that look alike', () => {
    expect(customPieceStyle({ ...DEFAULT_CUSTOM_PIECES, whiteInk: '#e0dccf' }).warnings).toEqual(['whiteInk']);
    expect(customPieceStyle({ ...DEFAULT_CUSTOM_PIECES, blackInk: '#3a3a3a' }).warnings).toEqual(['blackInk']);
    expect(customPieceStyle({ whiteFace: '#808080', whiteInk: '#000000', blackFace: '#707070', blackInk: '#000000' }).warnings).toEqual(['sidesAlike']);
  });

  it('mixes colors channel by channel', () => {
    expect(mixColors('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(mixColors('#ff0000', '#0000ff', 0)).toBe('#ff0000');
  });
});
