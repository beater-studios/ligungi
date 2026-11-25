import { LESSON_EXERCISES, LESSON_PROGRESS_BATCH, LESSON_STARS_MAX } from '@ligungi/protocol';
import { useCallback, useEffect, useState } from 'preact/hooks';
import { api } from './api.ts';
import { session } from './session.ts';
import { useStore } from './store.ts';

const KEY = 'ligungi.lessons';
const KNOWN: ReadonlySet<string> = new Set(LESSON_EXERCISES.map((exercise) => exercise.id));

export type LessonProgress = Readonly<Record<string, number>>;

const valid = (id: string, stars: unknown): stars is number =>
  KNOWN.has(id) && Number.isInteger(stars) && (stars as number) >= 1 && (stars as number) <= LESSON_STARS_MAX;

/** Results kept in the browser without an account; storage may be missing (prerender) or blocked. */
const readLocal = (): Record<string, number> => {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter(([id, stars]) => valid(id, stars))) as Record<string, number>;
  } catch {
    return {};
  }
};

const writeLocal = (progress: LessonProgress): void => {
  try {
    if (Object.keys(progress).length) localStorage.setItem(KEY, JSON.stringify(progress));
    else localStorage.removeItem(KEY);
  } catch {}
};

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
  const { user, loaded } = useStore(session);
  const [progress, setProgress] = useState<LessonProgress | null>(null);

  useEffect(() => {
    if (!loaded) return;
    const local = readLocal();
    if (!user) {
      setProgress(local);
      return;
    }
    let alive = true;
    const pending = Object.entries(local).slice(0, LESSON_PROGRESS_BATCH);
    const request = pending.length
      ? api.post<LessonProgress>('/api/lessons/progress', { results: Object.fromEntries(pending) }).then((saved) => {
          writeLocal({});
          return saved;
        })
      : api.get<LessonProgress>('/api/lessons/progress');
    request.then((saved) => alive && setProgress(saved)).catch(() => alive && setProgress(local));
    return () => {
      alive = false;
    };
  }, [loaded, user?.id]);

  const record = useCallback(
    (id: string, stars: number) => {
      setProgress((current) => best(current ?? {}, { [id]: stars }));
      const keep = () => writeLocal(best(readLocal(), { [id]: stars }));
      // A result that does not reach the account (no connection) waits in the browser and moves there on the next load.
      if (user) api.post('/api/lessons/progress', { results: { [id]: stars } }).catch(keep);
      else keep();
    },
    [user?.id],
  );

  return { progress, record };
};
