import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { useT } from '../i18n/index.ts';
import { session } from '../session.ts';
import { useStore } from '../store.ts';

export type SettingsSection = 'profile' | 'settings' | 'privacy' | 'security' | 'data';

/**
 * The settings pages: a menu of the five sections beside (on phones above) the page's cards. Visitors have only the
 * preferences, kept in the browser; the other sections belong to an account.
 */
export const SettingsShell = ({
  active,
  title,
  aside,
  children,
}: {
  active: SettingsSection;
  title: string;
  aside?: ComponentChildren;
  children: ComponentChildren;
}) => {
  const t = useT();
  const m = t.account.menu;
  const { user } = useStore(session);
  const menu = useRef<HTMLElement>(null);
  // On phones the menu is a row that scrolls sideways: bring the current section into view.
  useEffect(() => {
    menu.current?.querySelector('.active')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [active, user]);
  const link = (key: SettingsSection, href: string, label: string, hint: string) => (
    <a class={active === key ? 'active' : ''} href={href} aria-current={active === key ? 'page' : undefined}>
      <span class="ligungi-settings__label">{label}</span>
      <small class="ligungi-settings__hint">{hint}</small>
    </a>
  );
  return (
    <main class="ligungi-page ligungi-settings">
      <nav class="ligungi-card ligungi-settings__menu" aria-label={t.settings.menu} ref={menu}>
        {user && link('profile', '/account', m.profile, m.profileHint)}
        {link('settings', '/settings', t.settings.title, m.settingsHint)}
        {user && link('privacy', '/account/privacy', m.privacy, m.privacyHint)}
        {user && link('security', '/account/security', m.security, m.securityHint)}
        {user && link('data', '/account/data', m.data, m.dataHint)}
      </nav>
      <div class="ligungi-settings__body">
        <div class="ligungi-settings__head">
          <h1>{title}</h1>
          {aside}
        </div>
        {children}
      </div>
    </main>
  );
};
