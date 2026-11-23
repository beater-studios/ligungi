// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const KEY = 'ligungi.prefs';

const loadPrefs = async () => {
  vi.resetModules();
  return import('../src/prefs.ts');
};

describe('opponent pieces preference', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
  });

  afterEach(() => localStorage.clear());

  it('turns the opponent pieces by default', async () => {
    const { prefs } = await loadPrefs();
    expect(prefs.get().opponentPieces).toBe('turned');
    expect(document.documentElement.classList.contains('gg-upright-opponent')).toBe(false);
  });

  it('keeps a saved choice and marks the page root', async () => {
    localStorage.setItem(KEY, JSON.stringify({ opponentPieces: 'upright' }));
    const { prefs } = await loadPrefs();
    expect(prefs.get().opponentPieces).toBe('upright');
    expect(document.documentElement.classList.contains('gg-upright-opponent')).toBe(true);
  });

  it('falls back to the default for an unknown value', async () => {
    localStorage.setItem(KEY, JSON.stringify({ opponentPieces: 'sideways' }));
    const { prefs } = await loadPrefs();
    expect(prefs.get().opponentPieces).toBe('turned');
  });

  it('updates the page root when the choice changes', async () => {
    const { updatePrefs } = await loadPrefs();
    updatePrefs({ opponentPieces: 'upright' });
    expect(document.documentElement.classList.contains('gg-upright-opponent')).toBe(true);
    updatePrefs({ opponentPieces: 'turned' });
    expect(document.documentElement.classList.contains('gg-upright-opponent')).toBe(false);
  });
});
