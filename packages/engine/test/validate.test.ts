import { describe, expect, it } from 'vitest';
import { initialPosition, parseSquare, phaseProblems, pieceLimits, positionProblems } from '../src/index.ts';
import { build } from './helpers.ts';

const sq = (name: string) => parseSquare(name)!;

describe('position problems (board editor)', () => {
  it('accepts the fixed starting positions and a sparse position', () => {
    expect(positionProblems(initialPosition('intro'))).toEqual([]);
    expect(positionProblems(initialPosition('beginner'))).toEqual([]);
    expect(positionProblems(build({ e5: 'P', e6: 'p' }))).toEqual([]);
  });

  it('knows how many pieces each mode has', () => {
    expect(pieceLimits('advanced')).toMatchObject({ marshal: 1, soldier: 4, lancer: 3, archer: 2 });
    // Intro: three soldiers on the board and one in hand; no archers at all.
    expect(pieceLimits('intro')).toMatchObject({ soldier: 4, lancer: 3, archer: 0, spy: 2 });
  });

  it('needs exactly one Marshal per side, on the board', () => {
    expect(positionProblems(build({ a1: 'P', b1: 'M', c1: 'M' }))).toContainEqual({ kind: 'marshalCount', color: 'white', count: 2 });
    expect(positionProblems(build({ i9: 'p' }, { hands: { black: { marshal: 1 } } }))).toEqual(
      expect.arrayContaining([{ kind: 'marshalCount', color: 'black', count: 0 }, { kind: 'marshalInHand', color: 'black' }]),
    );
  });

  it('keeps piece counts, tower heights and the Marshal on top within the rules', () => {
    expect(positionProblems(build({ a2: 'P', b2: 'P', c2: 'P', d2: 'P', e2: 'P' }))).toContainEqual({ kind: 'tooMany', color: 'white', role: 'soldier', count: 5, max: 4 });
    expect(positionProblems(build({ e5: 'PPF' }, { mode: 'intermediate' }))).toContainEqual({ kind: 'tooHigh', square: sq('e5'), height: 3, max: 2 });
    expect(positionProblems(build({ e5: 'PPF' }))).toEqual([]);
    expect(positionProblems(build({ a1: 'MP' }))).toContainEqual({ kind: 'marshalCovered', square: sq('a1') });
    expect(positionProblems(build({ a1: 'PM' }, { mode: 'intro' }))).toContainEqual({ kind: 'marshalStacked', square: sq('a1') });
    expect(positionProblems(build({ a1: 'PM' }))).toEqual([]);
  });

  it('refuses a position where the side that just moved left its Marshal attacked', () => {
    // White to move with a soldier next to the Black Marshal: Black's last move would have been illegal.
    expect(positionProblems(build({ i8: 'P' }, { turn: 'white' }))).toContainEqual({ kind: 'waitingInCheck', color: 'black' });
    expect(positionProblems(build({ i8: 'P' }, { turn: 'black' }))).toEqual([]);
  });
});

describe('position problems in each phase (study start positions)', () => {
  const draft = (towers: Record<string, string>) => ({
    ...build(towers),
    phase: 'draft' as const,
    draftDone: { white: false, black: false },
  });

  it('lets the draft have its Marshals in hand or not placed yet, and attacked', () => {
    const start = initialPosition('advanced');
    expect(positionProblems(start).map((problem) => problem.kind)).toContain('marshalInHand');
    expect(phaseProblems(start)).toEqual([]);
    // A Marshal attacked during the draft means nothing: nothing can be captured until play starts.
    const attacked = draft({ i8: 'P' });
    expect(positionProblems({ ...attacked, phase: 'play' })).toContainEqual({ kind: 'waitingInCheck', color: 'black' });
    expect(phaseProblems(attacked)).toEqual([]);
  });

  it('still refuses in the draft what no draft can reach', () => {
    expect(phaseProblems(draft({ a1: 'M', b1: 'M' }))).toContainEqual({ kind: 'marshalCount', color: 'white', count: 2 });
    expect(phaseProblems(draft({ a1: 'MP' }))).toContainEqual({ kind: 'marshalCovered', square: sq('a1') });
    expect(phaseProblems(draft({ a2: 'P', b2: 'P', c2: 'P', d2: 'P', e2: 'P' }))).toContainEqual({ kind: 'tooMany', color: 'white', role: 'soldier', count: 5, max: 4 });
  });

  it('checks a play position exactly as the board editor does', () => {
    const play = build({ i8: 'P' }, { turn: 'white' });
    expect(phaseProblems(play)).toEqual(positionProblems(play));
  });
});
