import { LESSON_EXERCISES, LESSON_STARS_MAX, PRACTICE_POSITIONS } from '@ligungi/content';

/** Lesson results a player saves in one request. */
export const LESSON_PROGRESS_BATCH = 100;

/** Results a player saves in one request (positions finished without an account, sent when signing in). */
export const PRACTICE_BATCH = 100;

const LESSON_IDS: ReadonlySet<string> = new Set(LESSON_EXERCISES.map((exercise) => exercise.id));

/** Validates the lesson results a player sends: the stars of each exercise, by id, at most `LESSON_PROGRESS_BATCH`. */
export const parseLessonProgress = (input: unknown): Record<string, number> | 'invalidLessonProgress' => {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return 'invalidLessonProgress';
  const entries = Object.entries(input);
  if (entries.length > LESSON_PROGRESS_BATCH) return 'invalidLessonProgress';
  const results: Record<string, number> = {};
  for (const [id, stars] of entries) {
    if (!LESSON_IDS.has(id) || typeof stars !== 'number' || !Number.isInteger(stars) || stars < 1 || stars > LESSON_STARS_MAX) return 'invalidLessonProgress';
    results[id] = stars;
  }
  return results;
};

/** No practice position takes more moves than this to finish. */
const PRACTICE_MOVES_MAX = 1000;
const PRACTICE_IDS: ReadonlySet<string> = new Set(PRACTICE_POSITIONS.map((position) => position.id));

/** Validates the practice results a player sends: the fewest moves of each position, by id, at most `PRACTICE_BATCH`. */
export const parsePracticeProgress = (input: unknown): Record<string, number> | 'invalidPracticeProgress' => {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return 'invalidPracticeProgress';
  const entries = Object.entries(input);
  if (entries.length > PRACTICE_BATCH) return 'invalidPracticeProgress';
  const results: Record<string, number> = {};
  for (const [id, moves] of entries) {
    if (!PRACTICE_IDS.has(id) || typeof moves !== 'number' || !Number.isInteger(moves) || moves < 1 || moves > PRACTICE_MOVES_MAX) return 'invalidPracticeProgress';
    results[id] = moves;
  }
  return results;
};
