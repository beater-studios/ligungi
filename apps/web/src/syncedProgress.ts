import { useEffect, useState } from 'preact/hooks';
import { session } from './core/session.ts';
import { useStore } from './core/store.ts';

/**
 * A JSON value kept in the browser under `key`. Storage may be missing (the prerender) or blocked: then nothing reads
 * back and nothing is written, and the page works without it.
 */
export const localJson = (key: string) => ({
  read: (): unknown => {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? undefined : JSON.parse(raw);
    } catch {
      return undefined;
    }
  },
  /** `null` removes the value. */
  write: (value: unknown): void => {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Blocked storage: the progress lasts until the page is closed.
    }
  },
});

/** How a kind of progress lives in the browser without an account and moves to the account once signed in. */
export interface AccountSync<L, V> {
  /** False while something the progress depends on is still loading. */
  readonly ready?: boolean;
  readonly readLocal: () => L;
  readonly isEmpty: (local: L) => boolean;
  /** What a player without an account sees, from what the browser kept; also the fallback when the account cannot answer. */
  readonly guestView: (local: L) => V;
  /** Sends what the browser kept to the account and answers with the account's progress. */
  readonly upload: (local: L) => Promise<V>;
  readonly load: () => Promise<V>;
  readonly clearLocal: () => void;
}

/**
 * Progress on the account when signed in, in the browser otherwise. What was kept before signing in moves to the account
 * the first time a page using it loads signed in, and is then cleared from the browser.
 */
export const useAccountSync = <L, V>(sync: AccountSync<L, V>, deps: readonly unknown[] = []) => {
  const { user, loaded } = useStore(session);
  const [view, setView] = useState<V | null>(null);

  useEffect(() => {
    if (!loaded || sync.ready === false) return;
    const local = sync.readLocal();
    if (!user) {
      setView(sync.guestView(local));
      return;
    }
    let alive = true;
    const request = sync.isEmpty(local)
      ? sync.load()
      : sync.upload(local).then((saved) => {
          sync.clearLocal();
          return saved;
        });
    request.then((saved) => alive && setView(saved)).catch(() => alive && setView(sync.guestView(local)));
    return () => {
      alive = false;
    };
  }, [loaded, user?.id, sync.ready, ...deps]);

  return { view, setView, signedIn: user !== null };
};

/**
 * A new result: sent to the account when signed in, kept in the browser otherwise. One that does not reach the account
 * (no connection) is kept in the browser too, and moves to the account on the next load.
 */
export const sendOrKeep = (signedIn: boolean, send: () => Promise<unknown>, keep: () => void): void => {
  if (signedIn) send().catch(keep);
  else keep();
};
