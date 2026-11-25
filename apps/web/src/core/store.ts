import { useEffect, useReducer } from 'preact/hooks';

export interface Store<T> {
  get(): T;
  set(next: T | ((current: T) => T)): void;
  subscribe(listener: () => void): () => void;
}

export const createStore = <T,>(initial: T): Store<T> => {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set(next) {
      value = typeof next === 'function' ? (next as (current: T) => T)(value) : next;
      for (const listener of listeners) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
};

export const useStore = <T,>(store: Store<T>): T => {
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const value = store.get();
  useEffect(() => {
    const unsubscribe = store.subscribe(() => rerender(undefined));
    if (store.get() !== value) rerender(undefined);
    return unsubscribe;
  }, [store]);
  return value;
};
