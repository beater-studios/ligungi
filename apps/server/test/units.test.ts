import { describe, expect, it } from 'vitest';
import { Clock } from '../src/clock.ts';
import { DEFAULT_RATING, updateRating } from '../src/glicko.ts';

describe('clock', () => {
  it('charges the mover, adds the increment and keeps running for consecutive draft moves', () => {
    const clock = new Clock({ initial: 60, increment: 2 });
    clock.start('white', 0);
    clock.press('white', 'black', 10_000);
    expect(clock.view(10_000)).toEqual({ white: 52_000, black: 60_000, running: 'black' });
    clock.press('black', 'black', 15_000);
    expect(clock.view(20_000)).toEqual({ white: 52_000, black: 52_000, running: 'black' });
    clock.stop(20_000);
    expect(clock.view(99_000).running).toBeNull();
    expect(clock.timeLeft('black', 99_000)).toBe(52_000);
  });

  it('never reports negative time', () => {
    const clock = new Clock({ initial: 60, increment: 0 });
    clock.start('white', 0);
    expect(clock.timeLeft('white', 120_000)).toBe(0);
  });
});

describe('glicko-2', () => {
  it('moves ratings in the expected direction and shrinks the deviation', () => {
    const win = updateRating(DEFAULT_RATING, DEFAULT_RATING, 1);
    const loss = updateRating(DEFAULT_RATING, DEFAULT_RATING, 0);
    const draw = updateRating(DEFAULT_RATING, DEFAULT_RATING, 0.5);
    expect(win.rating).toBeGreaterThan(1500);
    expect(loss.rating).toBeLessThan(1500);
    expect(Math.round(draw.rating)).toBe(1500);
    expect(win.deviation).toBeLessThan(350);
    expect(Math.round(win.rating - 1500)).toBe(Math.round(1500 - loss.rating));
  });

  it('matches the reference example of the Glicko-2 paper for one game', () => {
    const player = { rating: 1500, deviation: 200, volatility: 0.06 };
    const updated = updateRating(player, { rating: 1400, deviation: 30, volatility: 0.06 }, 1);
    expect(updated.rating).toBeGreaterThan(1500);
    expect(updated.deviation).toBeLessThan(200);
    expect(updated.volatility).toBeCloseTo(0.06, 3);
  });
});
