import { useState } from 'preact/hooks';
import { useT } from '../i18n/index.ts';
import { session } from '../session.ts';
import { useStore } from '../store.ts';
import { SettingsShell, type SettingsSection } from '../components/SettingsShell.tsx';
import { DeleteForm } from './account/DeleteForm.tsx';
import { DiscordLink } from './account/DiscordLink.tsx';
import { BlockedPlayers, PrivacySettings } from './account/Privacy.tsx';
import { ProfileForm } from './account/ProfileForm.tsx';
import { PasswordForm, Sessions, TwoFactorSettings } from './account/Security.tsx';

export type AccountSection = Exclude<SettingsSection, 'settings'>;

/** The account's sections, one page each: profile, privacy, security, and the data and deletion of the account. */
export const AccountPage = ({ section }: { section: AccountSection }) => {
  const t = useT();
  const m = t.account.menu;
  const { user, loaded } = useStore(session);
  // Bumped to reload the list of devices after two-step setup signs the others out.
  const [sessionsVersion, setSessionsVersion] = useState(0);
  const title = { profile: m.profile, privacy: m.privacy, security: m.security, data: m.data }[section];
  const aside =
    section === 'profile' && user ? (
      <a class="ligungi-settings__aside" href={`/@/${user.name}`}>
        {t.account.viewProfile}
      </a>
    ) : undefined;
  return (
    <SettingsShell active={section} title={title} aside={aside}>
      {loaded && !user ? (
        <section class="ligungi-card ligungi-settings__card">
          <p>
            {t.account.loginNeeded} <a href="/login">{t.nav.signIn}</a>
          </p>
        </section>
      ) : section === 'profile' ? (
        <>
          <section class="ligungi-card ligungi-settings__card" id="profile">
            <ProfileForm />
          </section>
          <DiscordLink />
        </>
      ) : section === 'privacy' ? (
        <>
          <section class="ligungi-card ligungi-settings__card">
            <PrivacySettings />
          </section>
          <section class="ligungi-card ligungi-settings__card">
            <BlockedPlayers />
          </section>
        </>
      ) : section === 'security' ? (
        <>
          <section class="ligungi-card ligungi-settings__card">
            <h2>{t.account.passwordTitle}</h2>
            <PasswordForm />
          </section>
          <section class="ligungi-card ligungi-settings__card">
            <h2>{t.account.twoFactorTitle}</h2>
            <TwoFactorSettings onSignedOutOthers={() => setSessionsVersion((n) => n + 1)} />
          </section>
          <section class="ligungi-card ligungi-settings__card">
            <h2>{t.account.sessionsTitle}</h2>
            <Sessions key={sessionsVersion} />
          </section>
        </>
      ) : (
        <>
          <section class="ligungi-card ligungi-settings__card">
            <h2>{t.account.dataTitle}</h2>
            <p>{t.account.dataText}</p>
            <a class="button button-empty ligungi-account__download" href="/api/account/export" download>
              {t.account.dataDownload}
            </a>
          </section>
          <section class="ligungi-card ligungi-settings__card ligungi-danger-zone">
            <h2>{t.account.deleteTitle}</h2>
            <DeleteForm />
          </section>
        </>
      )}
    </SettingsShell>
  );
};
