import { createStore, useStore } from './store.ts';

const location = createStore({ path: window.location.pathname, search: window.location.search });

const sync = () => location.set({ path: window.location.pathname, search: window.location.search });
window.addEventListener('popstate', sync);

export const navigate = (to: string, replace = false, scroll = true): void => {
  if (to === window.location.pathname + window.location.search) return;
  if (replace) history.replaceState(null, '', to);
  else history.pushState(null, '', to);
  const samePage = new URL(to, window.location.href).pathname === location.get().path;
  sync();
  if (scroll && !samePage) window.scrollTo(0, 0);
};

export const useLocation = () => useStore(location);

/** Intercepts clicks on same-origin links so the app navigates without reloading. */
document.addEventListener('click', (event) => {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const anchor = (event.target as HTMLElement | null)?.closest('a');
  if (!anchor || anchor.target || anchor.hasAttribute('download')) return;
  const url = new URL(anchor.href, window.location.href);
  if (url.origin !== window.location.origin || url.pathname.startsWith('/api/')) return;
  event.preventDefault();
  navigate(url.pathname + url.search);
});

export interface Route<P> {
  readonly pattern: RegExp;
  readonly render: (params: string[]) => P;
}

export const matchRoute = <P,>(routes: readonly Route<P>[], path: string): P | undefined => {
  for (const route of routes) {
    const match = route.pattern.exec(path);
    if (match) return route.render(match.slice(1).map(decodeURIComponent));
  }
  return undefined;
};
