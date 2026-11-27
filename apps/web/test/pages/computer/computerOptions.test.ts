import { initialPosition, MODES, parseFen, toFen, type Position } from '@ligungi/engine';
import { describe, expect, it } from 'vitest';
import { computerForm, computerStart, type ComputerChoices } from '../../../src/pages/computer/computerOptions.ts';
import { komugiPlays } from '../../../src/komugi/bridge.ts';

const komugi = (mode: ComputerChoices['mode'], freeDraft = false): ComputerChoices => ({ opponent: 'komugi', mode, freeDraft });
const fromFen = (position: Position): Position => parseFen(toFen(position));

describe('computer form', () => {
  it('offers Komugi for Advanced with the rulebook draft, and keeps that format', () => {
    const form = computerForm(komugi('advanced'), { custom: null, model: 'installed' });
    expect(form).toEqual({ komugiShown: true, komugiUnavailable: null, opponent: 'komugi', mode: 'advanced', freeDraft: false });
    const start = computerStart(form, null);
    expect(komugiPlays(start)).toBe(true);
    expect(toFen(start)).toBe(toFen(initialPosition('advanced', 'white')));
  });

  it('greys Komugi out in every other mode, without changing the mode the player chose', () => {
    for (const mode of MODES.filter((m) => m !== 'advanced')) {
      const form = computerForm(komugi(mode), { custom: null, model: 'installed' });
      expect(form).toEqual({ komugiShown: true, komugiUnavailable: 'mode', opponent: 'builtin', mode, freeDraft: false });
      expect(computerStart(form, null).mode).toBe(mode);
    }
  });

  it('greys Komugi out for Advanced with the free draft, and keeps the free draft', () => {
    const form = computerForm(komugi('advanced', true), { custom: null, model: 'installed' });
    expect(form).toEqual({ komugiShown: true, komugiUnavailable: 'freeDraft', opponent: 'builtin', mode: 'advanced', freeDraft: true });
    expect(computerStart(form, null).freeDraft).toBe(true);
  });

  it('keeps every mode and the free draft for the built-in levels', () => {
    const form = computerForm({ opponent: 'builtin', mode: 'intermediate', freeDraft: true }, { custom: null, model: 'installed' });
    expect(form).toMatchObject({ opponent: 'builtin', mode: 'intermediate', freeDraft: true });
    expect(computerStart(form, null)).toEqual(initialPosition('intermediate', 'white', { freeDraft: true }));
  });

  it('greys Komugi out while its model is missing or still being looked up', () => {
    for (const model of ['missing', 'loading'] as const) {
      const form = computerForm(komugi('advanced'), { custom: null, model });
      expect(form).toEqual({ komugiShown: true, komugiUnavailable: model, opponent: 'builtin', mode: 'advanced', freeDraft: false });
    }
  });

  it('hides Komugi for a ?fen= position it cannot play, and offers it for one it can', () => {
    for (const custom of [
      fromFen(initialPosition('beginner')),
      fromFen(initialPosition('advanced', 'black')),
      fromFen(initialPosition('advanced', 'white', { freeDraft: true })),
    ]) {
      expect(komugiPlays(custom)).toBe(false);
      const form = computerForm(komugi('beginner'), { custom, model: 'installed' });
      expect(form).toMatchObject({ komugiShown: false, opponent: 'builtin' });
      expect(computerStart(form, custom)).toBe(custom);
    }
    const advanced = parseFen('4m4/9/9/9/9/9/9/9/4M4 w 2P advanced p w');
    // The ?fen= position sets the format, whatever the mode buttons (hidden then) last held.
    expect(computerForm(komugi('beginner'), { custom: advanced, model: 'installed' })).toMatchObject({ komugiShown: true, komugiUnavailable: null, opponent: 'komugi' });
  });
});
