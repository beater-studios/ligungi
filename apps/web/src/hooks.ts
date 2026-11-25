import { useEffect, useRef, useState } from 'preact/hooks';

/**
 * Runs `load` now and every `ms` while the page is visible, and again when it becomes visible: nothing is asked while
 * the tab is hidden. `load` gets `alive`, false once the page moved on, so a late answer is dropped. `enabled: false`
 * stops it (for example until the player signs in).
 */
export const usePolling = (load: (alive: () => boolean) => unknown, ms: number, deps: readonly unknown[], enabled = true): void => {
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    const alive = () => live;
    const run = () => {
      if (!document.hidden) load(alive);
    };
    run();
    const timer = setInterval(run, ms);
    document.addEventListener('visibilitychange', run);
    return () => {
      live = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', run);
    };
  }, [enabled, ...deps]);
};

/** Copies text to the clipboard; `copied` says the last copy worked, and `copy` answers whether it did. */
export const useCopy = () => {
  const [copied, setCopied] = useState(false);
  const copy = async (text: string): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      return true;
    } catch {
      setCopied(false);
      return false;
    }
  };
  return { copied, copy, reset: () => setCopied(false) };
};

/** Timeouts that are all cleared when the page goes away, or on `clear`. */
export const useTimers = () => {
  const timers = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const clear = () => {
    for (const timer of timers.current) clearTimeout(timer);
    timers.current = [];
  };
  useEffect(() => clear, []);
  return { later: (fn: () => void, ms: number) => void timers.current.push(setTimeout(fn, ms)), clear };
};
