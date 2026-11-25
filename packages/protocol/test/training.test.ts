import { describe, expect, it } from 'vitest';
import {
  LESSON_EXERCISES,
  LESSON_PROGRESS_BATCH,
  LESSON_STARS_MAX,
  PRACTICE_POSITIONS,
  PUZZLE_RUN_BATCH,
  discordTier,
  parseGameSearch,
  parseLessonProgress,
  parsePracticeProgress,
  parsePuzzleRuns,
  racerBonus,
  stormBonus,
} from '../src/index.ts';

describe('training progress sent by the player', () => {
  const lesson = LESSON_EXERCISES[0]!.id;
  const practice = PRACTICE_POSITIONS[0]!.id;

  it('accepts lesson stars of known exercises only', () => {
    expect(parseLessonProgress({ [lesson]: LESSON_STARS_MAX })).toEqual({ [lesson]: LESSON_STARS_MAX });
    expect(parseLessonProgress({})).toEqual({});
    for (const bad of [{ [lesson]: 0 }, { [lesson]: LESSON_STARS_MAX + 1 }, { [lesson]: 1.5 }, { [lesson]: '2' }, { nope: 1 }, [], null, 'x']) {
      expect(parseLessonProgress(bad)).toBe('invalidLessonProgress');
    }
    // Every exercise at once fits in one request, as a guest's whole progress does when signing in.
    expect(LESSON_EXERCISES.length).toBeLessThanOrEqual(LESSON_PROGRESS_BATCH);
    const all = Object.fromEntries(LESSON_EXERCISES.map((exercise) => [exercise.id, 1]));
    expect(parseLessonProgress(all)).toEqual(all);
  });

  it('accepts practice moves of known positions only', () => {
    expect(parsePracticeProgress({ [practice]: 12 })).toEqual({ [practice]: 12 });
    for (const bad of [{ [practice]: 0 }, { [practice]: 1001 }, { [practice]: 2.5 }, { nope: 3 }, [], null]) {
      expect(parsePracticeProgress(bad)).toBe('invalidPracticeProgress');
    }
  });

  it('accepts runs with a known kind, a score within the puzzles and a time not in the future', () => {
    const now = 1_000_000;
    expect(parsePuzzleRuns([{ kind: 'storm', score: 20, at: now, extra: true }], 100, now)).toEqual([{ kind: 'storm', score: 20, at: now }]);
    expect(parsePuzzleRuns([], 100, now)).toEqual([]);
    for (const bad of [
      [{ kind: 'race', score: 1, at: now }],
      [{ kind: 'streak', score: 101, at: now }],
      [{ kind: 'streak', score: -1, at: now }],
      [{ kind: 'streak', score: 1, at: now + 1 }],
      [{ kind: 'streak', score: 1 }],
      [null],
      { kind: 'streak', score: 1, at: now },
    ]) {
      expect(parsePuzzleRuns(bad, 100, now)).toBe('invalidPuzzleRun');
    }
    expect(parsePuzzleRuns(Array.from({ length: PUZZLE_RUN_BATCH + 1 }, () => ({ kind: 'streak', score: 1, at: now })), 100, now)).toBe('invalidPuzzleRun');
  });
});

describe('scores and ranks', () => {
  it('gives Storm time back at its combo marks and Racer a point at the same ones', () => {
    expect([5, 12, 20, 30, 40, 50].map(stormBonus)).toEqual([3, 5, 7, 10, 10, 10]);
    expect([1, 4, 6, 31, 45].map(stormBonus)).toEqual([0, 0, 0, 0, 0]);
    expect([5, 12, 40, 6].map(racerBonus)).toEqual([1, 1, 1, 0]);
  });

  it('gives the Discord rank of the best established rating', () => {
    expect(discordTier(null)).toBeNull();
    expect(discordTier(1200)).toBe('soldier');
    expect(discordTier(1499.6)).toBe('samurai');
    expect(discordTier(1650)).toBe('majorGeneral');
    expect(discordTier(1800)).toBe('lieutenantGeneral');
    expect(discordTier(2400)).toBe('general');
  });
});

describe('game search', () => {
  it('reads the fields it knows and refuses names that cannot exist', () => {
    expect(parseGameSearch(new URLSearchParams('player=ana_test&vs=bob'))).toMatchObject({ player: 'ana_test', vs: 'bob' });
    expect(parseGameSearch(new URLSearchParams(''))).toEqual({});
    expect(parseGameSearch(new URLSearchParams('player=a b'))).toBe('invalidSearch');
    // An opponent needs a player.
    expect(parseGameSearch(new URLSearchParams('vs=bob'))).toBe('invalidSearch');
  });
});
