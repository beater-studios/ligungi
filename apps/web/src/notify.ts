import { prefs, updatePrefs } from './prefs.ts';
import { navigate } from './router.ts';
import { createStore } from './store.ts';

export type NotifyPermission = 'default' | 'granted' | 'denied' | 'unsupported';

export interface NotifyMessage {
  readonly title: string;
  readonly body: string;
  /** Notifications with the same tag replace each other, so several tabs or sources show one. */
  readonly tag: string;
  /** Where a click on the notification takes the player. */
  readonly path?: string;
}

// Chrome on Android has the permission but only shows notifications through a service worker, which the site does not have.
let broken = false;

const read = (): NotifyPermission => (broken || typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);

export const notifyPermission = createStore<NotifyPermission>(read());

const shown = new Set<Notification>();

const show = ({ title, body, tag, path }: NotifyMessage): boolean => {
  try {
    const notification = new Notification(title, { body, tag, icon: '/icon-192.png', lang: document.documentElement.lang });
    shown.add(notification);
    notification.onclose = () => shown.delete(notification);
    notification.onclick = () => {
      window.focus();
      if (path) navigate(path);
      notification.close();
    };
    return true;
  } catch {
    broken = true;
    notifyPermission.set('unsupported');
    return false;
  }
};

const away = (): boolean => document.hidden || !document.hasFocus();

/** Shows a browser notification when the player turned them on and is not looking at the site. */
export const notify = (message: NotifyMessage): void => {
  if (!prefs.get().notifications || read() !== 'granted' || !away()) return;
  show(message);
};

// Safari before 15 takes a callback instead of returning a promise.
const request = (): Promise<NotificationPermission> =>
  new Promise((resolve) => {
    try {
      const result = Notification.requestPermission(resolve) as Promise<NotificationPermission> | undefined;
      result?.then(resolve, () => resolve('denied'));
    } catch {
      resolve('denied');
    }
  });

/** Asks the browser for permission (it must come from a click) and shows `sample`, which also proves they work here. */
export const enableNotifications = async (sample: Pick<NotifyMessage, 'title' | 'body'>): Promise<void> => {
  if (read() === 'default') await request();
  const granted = read() === 'granted' && show({ ...sample, tag: 'sample' });
  notifyPermission.set(read());
  updatePrefs({ notifications: granted });
};

window.addEventListener('focus', () => {
  for (const notification of shown) notification.close();
  shown.clear();
  // The permission can change in the browser's own settings while the site is open.
  if (notifyPermission.get() !== read()) notifyPermission.set(read());
});
