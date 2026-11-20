import { describe, expect, it } from 'vitest';
import { byoyomiState, formatTimeControl, gameFiltersQuery, parseClientMessage, parseGameFilters, parseSettings, type GameFilters } from '../src/index.ts';

describe('protocol', () => {
  it('validates game settings', () => {
    const valid = { mode: 'advanced', rated: true, timeControl: { initial: 600, increment: 5 }, daysPerMove: null, color: 'random', freeDraft: false };
    expect(parseSettings(valid)).toEqual(valid);
    // Older pages still send who moves first; White always does now, so the field is dropped.
    expect(parseSettings({ ...valid, firstPlayer: 'black' })).toEqual(valid);
    expect(parseSettings({ ...valid, freeDraft: undefined })).toEqual(valid);
    expect(parseSettings({ ...valid, freeDraft: true })).toBe('ratedNeedsOfficialDraft');
    expect(parseSettings({ ...valid, rated: false, freeDraft: true })).toMatchObject({ freeDraft: true });
    expect(parseSettings({ ...valid, rated: false, mode: 'intro', freeDraft: true })).toMatchObject({ freeDraft: false });
    expect(parseSettings({ ...valid, mode: 'chess' })).toBe('invalidMode');
    expect(parseSettings({ ...valid, timeControl: null })).toBe('unlimitedNotRated');
    expect(parseSettings({ ...valid, rated: false, timeControl: null })).toMatchObject({ timeControl: null });
    expect(typeof parseSettings({ ...valid, timeControl: { initial: 10, increment: 0 } })).toBe('string');
    expect(parseSettings({ ...valid, daysPerMove: undefined })).toEqual(valid);
  });

  it('validates correspondence settings', () => {
    const correspondence = { mode: 'intro', rated: true, timeControl: null, daysPerMove: 3, color: 'white' };
    expect(parseSettings(correspondence)).toMatchObject({ rated: true, timeControl: null, daysPerMove: 3 });
    for (const days of [1, 7, 14]) expect(parseSettings({ ...correspondence, daysPerMove: days })).toMatchObject({ daysPerMove: days });
    expect(parseSettings({ ...correspondence, daysPerMove: 2 })).toBe('invalidDaysPerMove');
    expect(parseSettings({ ...correspondence, daysPerMove: '3' })).toBe('invalidDaysPerMove');
    expect(parseSettings({ ...correspondence, timeControl: { initial: 600, increment: 5 } })).toBe('invalidDaysPerMove');
  });

  it('validates byo-yomi settings', () => {
    const base = { mode: 'advanced', rated: true, daysPerMove: null, color: 'random', freeDraft: false };
    const byoyomi = { initial: 600, increment: 0, byoyomi: 30, periods: 3 };
    expect(parseSettings({ ...base, timeControl: byoyomi })).toMatchObject({ rated: true, timeControl: byoyomi });
    // Byo-yomi alone, from the first move.
    expect(parseSettings({ ...base, timeControl: { ...byoyomi, initial: 0, periods: 1 } })).toMatchObject({ timeControl: { initial: 0, byoyomi: 30, periods: 1 } });
    for (const timeControl of [
      { ...byoyomi, byoyomi: 25 },
      { ...byoyomi, periods: 0 },
      { ...byoyomi, periods: 4 },
      { ...byoyomi, periods: 1.5 },
      { ...byoyomi, increment: 5 },
    ]) {
      expect(parseSettings({ ...base, timeControl })).toBe('invalidByoyomi');
    }
    expect(parseSettings({ ...base, timeControl: { ...byoyomi, initial: -60 } })).toBe('invalidInitialTime');
    // Without byo-yomi the main time still needs a minute.
    expect(parseSettings({ ...base, timeControl: { initial: 0, increment: 5 } })).toBe('invalidInitialTime');
    expect(parseSettings({ ...base, timeControl: { initial: 600, increment: 5, byoyomi: 0 } })).toMatchObject({ timeControl: { initial: 600, increment: 5 } });
  });

  it('splits a byo-yomi clock into main time, current period and periods left', () => {
    const tc = { initial: 600, increment: 0, byoyomi: 30, periods: 3 };
    expect(byoyomiState(600_000 + 90_000, tc)).toEqual({ main: 600_000, period: 30_000, periods: 3 });
    expect(byoyomiState(1000 + 90_000, tc)).toEqual({ main: 1000, period: 30_000, periods: 3 });
    expect(byoyomiState(90_000, tc)).toEqual({ main: 0, period: 30_000, periods: 3 });
    expect(byoyomiState(72_000, tc)).toEqual({ main: 0, period: 12_000, periods: 3 });
    expect(byoyomiState(60_000, tc)).toEqual({ main: 0, period: 30_000, periods: 2 });
    expect(byoyomiState(5_000, tc)).toEqual({ main: 0, period: 5_000, periods: 1 });
    expect(byoyomiState(0, tc)).toEqual({ main: 0, period: 0, periods: 0 });
  });

  it('formats time controls', () => {
    expect(formatTimeControl({ initial: 600, increment: 5 })).toBe('10+5');
    expect(formatTimeControl({ initial: 90, increment: 0 })).toBe('1.5+0');
    expect(formatTimeControl({ initial: 600, increment: 0, byoyomi: 30, periods: 1 })).toBe('10|30s');
    expect(formatTimeControl({ initial: 0, increment: 0, byoyomi: 10, periods: 3 })).toBe('0|3×10s');
    expect(formatTimeControl(null)).toBe('∞');
  });

  it('parses client messages defensively', () => {
    expect(parseClientMessage('{"t":"ping"}')).toEqual({ t: 'ping' });
    expect(parseClientMessage('nope')).toBeUndefined();
    expect(parseClientMessage('42')).toBeUndefined();
  });
});

describe('parseGameFilters', () => {
  it('reads known filters, ignores empty ones and round-trips through the query string', () => {
    const params = new URLSearchParams('mode=advanced&result=win&rated=0&color=black&vs=%20Komugi%20&extra=1&before=');
    const filters = parseGameFilters(params);
    expect(filters).toEqual({ mode: 'advanced', result: 'win', rated: false, color: 'black', vs: 'Komugi' });
    expect(parseGameFilters(gameFiltersQuery(filters as GameFilters))).toEqual(filters);
    expect(parseGameFilters(new URLSearchParams('mode=&result='))).toEqual({});
  });

  it('rejects unknown values', () => {
    for (const query of ['mode=blitz', 'result=maybe', 'rated=yes', 'color=red', `vs=${'x'.repeat(21)}`]) {
      expect(parseGameFilters(new URLSearchParams(query))).toBe('invalidFilter');
    }
  });
});
