import { useEffect, useState } from 'preact/hooks';

const matches = (query: string): boolean => (typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : false);

/** Whether a CSS media query matches, kept up to date as the window changes; false where `matchMedia` is missing (prerender). */
export const useMediaQuery = (query: string): boolean => {
  const [match, setMatch] = useState(() => matches(query));
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const list = window.matchMedia(query);
    const update = () => setMatch(list.matches);
    update();
    list.addEventListener('change', update);
    return () => list.removeEventListener('change', update);
  }, [query]);
  return match;
};
