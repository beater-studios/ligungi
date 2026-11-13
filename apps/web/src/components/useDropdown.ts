import { useEffect, useRef, useState } from 'preact/hooks';

/** Closes a header dropdown when clicking anywhere else, like lila's top bar. */
export const useDropdown = () => {
  const [shown, setShown] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!shown) return;
    // composedPath is fixed at dispatch time, so clicks on elements that the click itself removed (switching a
    // dropdown panel) still count as inside.
    const close = (event: MouseEvent) => {
      if (ref.current && !event.composedPath().includes(ref.current)) setShown(false);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [shown]);
  return { shown, setShown, ref };
};
