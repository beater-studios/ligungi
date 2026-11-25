// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { bestScores } from '../src/puzzles/puzzleRuns.ts';
import { localJson, sendOrKeep } from '../src/syncedProgress.ts';

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('progress kept in the browser and on the account', () => {
  it('keeps a result in the browser when it cannot reach the account, and only then', async () => {
    const keep = vi.fn();
    sendOrKeep(true, () => Promise.reject(new Error('offline')), keep);
    await Promise.resolve();
    await Promise.resolve();
    expect(keep).toHaveBeenCalledTimes(1);

    const kept = vi.fn();
    sendOrKeep(true, () => Promise.resolve({ ok: true }), kept);
    await Promise.resolve();
    expect(kept).not.toHaveBeenCalled();

    const guest = vi.fn();
    sendOrKeep(false, () => Promise.resolve(), guest);
    expect(guest).toHaveBeenCalledTimes(1);
  });

  it('reads and writes JSON, and works as empty when storage is blocked', () => {
    const store = localJson('test.key');
    expect(store.read()).toBeUndefined();
    store.write({ a: 1 });
    expect(store.read()).toEqual({ a: 1 });
    store.write(null);
    expect(localStorage.getItem('test.key')).toBeNull();

    localStorage.setItem('test.key', '{not json');
    expect(store.read()).toBeUndefined();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => store.write({ a: 2 })).not.toThrow();
  });

  it('takes the best score of today, of the last 7 days and the best ever', () => {
    const now = new Date(2026, 10, 25, 12).getTime();
    const day = 86_400_000;
    const recent = [
      { score: 5, at: now - 2 * 60_000 },
      { score: 9, at: now - 3 * day },
      { score: 12, at: now - 8 * day },
    ];
    expect(bestScores(recent, 20, now)).toEqual({ today: 5, week: 9, ever: 20 });
    expect(bestScores([], 0, now)).toEqual({ today: 0, week: 0, ever: 0 });
  });
});
