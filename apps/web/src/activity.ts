import { useEffect } from 'preact/hooks';

/**
 * What the player is doing on the page, for browser integrations such as the PreMiD activity that shows it on the
 * player's Discord profile. Written as `data-activity-<key>` attributes on `<html>`, in English and machine values,
 * so an integration does not depend on the language or the layout. Pages with nothing beyond their address leave it
 * empty. See "Browser integrations" in docs/architecture.md for the keys.
 */
export type PageActivity = Readonly<Record<string, string>>;

export const ACTIVITY_PREFIX = 'data-activity-';

/** Sets the attributes and returns what removes them. */
export const applyActivity = (root: HTMLElement, activity: PageActivity): (() => void) => {
  const names = Object.keys(activity).map((key) => ACTIVITY_PREFIX + key);
  for (const [key, value] of Object.entries(activity)) root.setAttribute(ACTIVITY_PREFIX + key, value);
  return () => {
    for (const name of names) root.removeAttribute(name);
  };
};

export const useActivity = (activity: PageActivity | null): void => {
  const key = activity ? JSON.stringify(activity) : '';
  useEffect(() => (activity ? applyActivity(document.documentElement, activity) : undefined), [key]);
};
