import { createStore } from './store.ts';

/** Whether the browser has a network connection. The prerender has no `navigator.onLine`, so a missing value counts as online. */
export const online = createStore<boolean>(typeof navigator === 'undefined' || navigator.onLine !== false);

/** Follows the browser's online and offline events; `onBack` runs when the connection returns. */
export const watchConnection = (target: Pick<Window, 'addEventListener' | 'removeEventListener'>, onBack: () => void): (() => void) => {
  const lost = () => online.set(false);
  const back = () => {
    online.set(true);
    onBack();
  };
  target.addEventListener('offline', lost);
  target.addEventListener('online', back);
  return () => {
    target.removeEventListener('offline', lost);
    target.removeEventListener('online', back);
  };
};
