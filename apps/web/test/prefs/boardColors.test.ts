import { describe, expect, it } from 'vitest';
import { contrast, customBoardStyle, DEFAULT_CUSTOM_BOARD, isHexColor } from '../../src/prefs/boardColors.ts';

describe('custom board colors', () => {
  it('gives the default colors the light wood marks and no warning', () => {
    const style = customBoardStyle(DEFAULT_CUSTOM_BOARD);
    expect(style.warnings).toEqual([]);
    expect(style.vars['--gg-custom-board']).toBe('#e3c389');
    expect(style.vars['--gg-custom-dest']).toBe('rgba(20, 85, 30, 0.55)');
  });

  it('gives the built-in boards no warning', () => {
    for (const [board, line] of [
      ['#9a6a44', '#2a1708'],
      ['#b8bdc3', '#3b434c'],
      ['#d6d6d6', '#000000'],
    ] as const) {
      expect(customBoardStyle({ board, line }).warnings).toEqual([]);
    }
  });

  it('switches to light marks on a dark board', () => {
    expect(customBoardStyle({ board: '#2f4f6f', line: '#c8d8e8' }).vars['--gg-custom-dest']).toBe('rgba(195, 240, 140, 0.8)');
  });

  it('warns about lines, pieces and marks that would be hard to see', () => {
    expect(customBoardStyle({ board: '#2f4f6f', line: '#1a2a3a' }).warnings).toEqual(['lines']);
    expect(customBoardStyle({ board: '#ffffff', line: '#000000' }).warnings).toEqual(['whitePieces']);
    expect(customBoardStyle({ board: '#202830', line: '#ffffff' }).warnings).toEqual(['blackPieces']);
    expect(customBoardStyle({ board: '#c8c832', line: '#000000' }).warnings).toContain('marks');
  });

  it('checks colors and contrast', () => {
    expect(isHexColor('#a1b2c3')).toBe(true);
    expect(isHexColor('red')).toBe(false);
    expect(isHexColor('#abc')).toBe(false);
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21);
    expect(contrast('#777777', '#777777')).toBe(1);
  });
});
