import { MATES_SOLVED_BATCH } from '@ligungi/protocol';
import { useCallback, useEffect, useState } from 'preact/hooks';
import { api } from './api.ts';
import { session } from './session.ts';
import { useStore } from './store.ts';

const KEY = 'ligungi.matesSolved';

/** Problems solved without an account, kept in the browser; storage may be missing (prerender) or blocked. */
const readLocal = (): string[] => {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
};

const writeLocal = (ids: readonly string[]): void => {
  try {
    if (ids.length) localStorage.setItem(KEY, JSON.stringify(ids));
    else localStorage.removeItem(KEY);
  } catch {}
};

/**
 * The mate problems the player solved: on the account when signed in, in the browser otherwise. Problems solved
 * before signing in move to the account the first time the page loads with it. `known` drops ids that no longer exist.
 */
export const useSolvedMates = (known: ReadonlySet<string> | null) => {
  const { user, loaded } = useStore(session);
  const [solved, setSolved] = useState<ReadonlySet<string> | null>(null);

  useEffect(() => {
    if (!loaded || !known) return;
    const local = readLocal().filter((id) => known.has(id));
    if (!user) {
      setSolved(new Set(local));
      return;
    }
    let alive = true;
    const request = local.length
      ? api.post<string[]>('/api/mates/solved', { ids: local.slice(0, MATES_SOLVED_BATCH) }).then((ids) => {
          writeLocal([]);
          return ids;
        })
      : api.get<string[]>('/api/mates/solved');
    request.then((ids) => alive && setSolved(new Set(ids))).catch(() => alive && setSolved(new Set(local)));
    return () => {
      alive = false;
    };
  }, [loaded, user?.id, known]);

  const markSolved = useCallback(
    (id: string) => {
      setSolved((current) => new Set(current).add(id));
      if (user) api.post('/api/mates/solved', { ids: [id] }).catch(() => {});
      else writeLocal([...new Set([...readLocal(), id])]);
    },
    [user?.id],
  );

  return { solved, markSolved };
};
