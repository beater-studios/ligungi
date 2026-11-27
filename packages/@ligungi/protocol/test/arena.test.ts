import { describe, expect, it } from 'vitest';
import { ARENA_START_STREAK, arenaPerformance, arenaPoints, arenaPrizes, arenaSeason, arenaTopCount, isSeason, nextArenaStart, seasonCounted, seasonRange } from '../src/index.ts';

describe('arena', () => {
  it('starts every Saturday at 18:00 UTC, from the first one announced', () => {
    // Before the first Arena (5 December 2026), that one is next.
    expect(nextArenaStart(Date.UTC(2026, 10, 27, 12))).toBe(Date.UTC(2026, 11, 5, 18));
    expect(nextArenaStart(Date.UTC(2026, 10, 28, 17, 59))).toBe(Date.UTC(2026, 11, 5, 18));
    // Saturday before and at the start: the same day, then the next week.
    expect(nextArenaStart(Date.UTC(2026, 11, 12, 17, 59))).toBe(Date.UTC(2026, 11, 12, 18));
    expect(nextArenaStart(Date.UTC(2026, 11, 12, 18))).toBe(Date.UTC(2026, 11, 19, 18));
    // Wednesday.
    expect(nextArenaStart(Date.UTC(2026, 11, 16, 9))).toBe(Date.UTC(2026, 11, 19, 18));
  });

  it('names season 0 before 2027 and one season per quarter after', () => {
    expect(arenaSeason(Date.UTC(2026, 11, 5))).toBe('S0');
    expect(arenaSeason(Date.UTC(2027, 0, 2))).toBe('2027-Q1');
    expect(arenaSeason(Date.UTC(2027, 3, 1))).toBe('2027-Q2');
    expect(arenaSeason(Date.UTC(2027, 11, 31))).toBe('2027-Q4');
  });

  it('scores as lichess: double points on a streak, nothing for early or repeated draws', () => {
    let streak = ARENA_START_STREAK;
    const sheet: number[] = [];
    for (const result of ['win', 'win', 'win', 'win', 'loss', 'win'] as const) {
      const scored = arenaPoints(result, streak, 40);
      sheet.push(scored.points);
      streak = scored.streak;
    }
    expect(sheet).toEqual([2, 2, 4, 4, 0, 2]);
    expect(arenaPoints('draw', ARENA_START_STREAK, 19).points).toBe(0);
    const first = arenaPoints('draw', ARENA_START_STREAK, 20);
    expect(first.points).toBe(1);
    expect(arenaPoints('draw', first.streak, 60).points).toBe(0);
    // A draw ends a win streak.
    expect(arenaPoints('draw', { wins: 3, drew: false }, 60).streak).toEqual({ wins: 0, drew: true });
  });

  it('gives a berserk win one more point once the play phase lasted 7 moves', () => {
    expect(arenaPoints('win', ARENA_START_STREAK, 13, true)).toMatchObject({ points: 2, berserk: false });
    expect(arenaPoints('win', ARENA_START_STREAK, 14, true)).toMatchObject({ points: 3, berserk: true });
    expect(arenaPoints('win', { wins: 2, drew: false }, 30, true)).toMatchObject({ points: 5, doubled: true, berserk: true });
    expect(arenaPoints('loss', ARENA_START_STREAK, 30, true).points).toBe(0);
  });

  it('names the seasons and their ranges, and counts the best half', () => {
    expect(isSeason('S0')).toBe(true);
    expect(isSeason('2027-Q4')).toBe(true);
    expect(isSeason('2027-Q5')).toBe(false);
    expect(seasonRange('2027-Q2')).toEqual({ from: Date.UTC(2027, 3, 1), to: Date.UTC(2027, 6, 1) });
    expect(seasonRange('S0').to).toBe(Date.UTC(2027, 0, 1));
    expect([1, 4, 13].map(seasonCounted)).toEqual([1, 2, 7]);
  });

  it('scales the trophies with the players who played', () => {
    expect(arenaPrizes(3)).toEqual({ champion: false, podium: false, top: false });
    expect(arenaPrizes(4)).toEqual({ champion: true, podium: false, top: false });
    expect(arenaPrizes(8)).toEqual({ champion: true, podium: true, top: false });
    expect(arenaPrizes(16)).toEqual({ champion: true, podium: true, top: true });
    expect(arenaTopCount(16)).toBe(2);
    expect(arenaTopCount(40)).toBe(4);
  });

  it('computes a performance from the opponents and the result', () => {
    expect(arenaPerformance([], 0, 0)).toBeNull();
    expect(arenaPerformance([1500, 1700], 1, 1)).toBe(1600);
    expect(arenaPerformance([1500, 1500], 2, 0)).toBe(1900);
  });
});
