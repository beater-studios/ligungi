import { describe, expect, it } from 'vitest';
import { formatTimeControl, gameFiltersQuery, parseClientMessage, parseGameFilters, parseSettings, type GameFilters } from '../src/index.ts';

describe('protocol', () => {
  it('validates game settings', () => {
    const valid = { mode: 'advanced', rated: true, timeControl: { initial: 600, increment: 5 }, daysPerMove: null, color: 'random', firstPlayer: 'white', freeDraft: false };
    expect(parseSettings(valid)).toEqual(valid);
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
    const correspondence = { mode: 'intro', rated: true, timeControl: null, daysPerMove: 3, color: 'white', firstPlayer: 'white' };
    expect(parseSettings(correspondence)).toMatchObject({ rated: true, timeControl: null, daysPerMove: 3 });
    for (const days of [1, 7]) expect(parseSettings({ ...correspondence, daysPerMove: days })).toMatchObject({ daysPerMove: days });
    expect(parseSettings({ ...correspondence, daysPerMove: 2 })).toBe('invalidDaysPerMove');
    expect(parseSettings({ ...correspondence, daysPerMove: '3' })).toBe('invalidDaysPerMove');
    expect(parseSettings({ ...correspondence, timeControl: { initial: 600, increment: 5 } })).toBe('invalidDaysPerMove');
  });

  it('formats time controls', () => {
    expect(formatTimeControl({ initial: 600, increment: 5 })).toBe('10+5');
    expect(formatTimeControl({ initial: 90, increment: 0 })).toBe('1.5+0');
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
