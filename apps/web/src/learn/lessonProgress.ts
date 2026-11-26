import { LESSON_PROGRESS_BATCH } from '@ligungi/protocol';
import { LESSON_EXERCISES, LESSON_STARS_MAX } from '@ligungi/content';
import { useCallback } from 'preact/hooks';
import { api } from '../core/api.ts';
import { localJson, sendOrKeep, useAccountSync } from '../syncedProgress.ts';

const store = localJson('ligungi.lessons');
const KNOWN: ReadonlySet<string> = new Set(LESSON_EXERCISES.map((exercise) => exercise.id));

export type LessonProgress = Readonly<Record<string, number>>;

const valid = (id: string, stars: unknown): stars is number =>
  KNOWN.has(id) && Number.isInteger(stars) && (stars as number) >= 1 && (stars as number) <= LESSON_STARS_MAX;

/** Results kept in the browser without an account. */
const readLocal = (): Record<string, number> => {
  const value = store.read();
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([id, stars]) => valid(id, stars))) as Record<string, number>;
};

const writeLocal = (progress: LessonProgress): void => store.write(Object.keys(progress).length ? progress : null);

const best = (a: LessonProgress, b: LessonProgress): Record<string, number> => {
  const merged: Record<string, number> = { ...a };
  for (const [id, stars] of Object.entries(b)) merged[id] = Math.max(merged[id] ?? 0, stars);
  return merged;
};

/**
 * The best stars of each lesson exercise: on the account when signed in, in the browser otherwise. Results earned
 * before signing in move to the account the first time a lesson page loads with it.
 */
export const useLessonProgress = () => {
  const { view: progress, setView: setProgress, signedIn } = useAccountSync<Record<string, number>, LessonProgress>({
    readLocal,
    isEmpty: (local) => Object.keys(local).length === 0,
    guestView: (local) => local,
    upload: (local) => api.post<LessonProgress>('/api/lessons/progress', { results: Object.fromEntries(Object.entries(local).slice(0, LESSON_PROGRESS_BATCH)) }),
    load: () => api.get<LessonProgress>('/api/lessons/progress'),
    clearLocal: () => writeLocal({}),
  });

  const record = useCallback(
    (id: string, stars: number) => {
      setProgress((current) => best(current ?? {}, { [id]: stars }));
      sendOrKeep(
        signedIn,
        () => api.post('/api/lessons/progress', { results: { [id]: stars } }),
        () => writeLocal(best(readLocal(), { [id]: stars })),
      );
    },
    [signedIn],
  );

  return { progress, record };
};
