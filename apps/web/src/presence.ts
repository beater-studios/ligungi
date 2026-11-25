import { useEffect } from 'preact/hooks';

/**
 * What the player is doing on the page, for browser integrations such as the PreMiD activity that shows it on the
 * player's Discord profile. Written as `data-activity-<key>` attributes on `<html>`, in English and machine values,
 * so an integration does not depend on the language or the layout. Pages with nothing beyond their address leave it
 * empty. See "Browser integrations" in docs/architecture.md for the keys.
 */
export type PagePresence = Readonly<Record<string, string>>;

export const PRESENCE_PREFIX = 'data-activity-';

/** Sets the attributes and returns what removes them. */
export const applyPresence = (root: HTMLElement, presence: PagePresence): (() => void) => {
  const names = Object.keys(presence).map((key) => PRESENCE_PREFIX + key);
  for (const [key, value] of Object.entries(presence)) root.setAttribute(PRESENCE_PREFIX + key, value);
  return () => {
    for (const name of names) root.removeAttribute(name);
  };
};

export const usePresence = (presence: PagePresence | null): void => {
  const key = presence ? JSON.stringify(presence) : '';
  useEffect(() => (presence ? applyPresence(document.documentElement, presence) : undefined), [key]);
};
