import {
  DISCORD_LINK_RESULTS,
  DISCORD_TIERS,
  DISCORD_VERIFIED_ROLE,
  type DiscordLinkResult,
  type DiscordLinkView,
  COUNTRIES,
  PROFILE_BIO_MAX,
  PROFILE_LINKS,
  PROFILE_SITES,
  profileLinkName,
  type ChallengePolicy,
  type FollowPolicy,
  type Country,
  type ProfileDetails,
  type ProfileSite,
  type SessionView,
  type TwoFactorSetup,
  type TwoFactorView,
} from '@ligungi/protocol';
import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { api } from '../api.ts';
import { QrCode } from '../components/QrCode.tsx';
import { SiteIcon } from '../components/ProfileAbout.tsx';
import { Checkbox, Field, OptionCards, Select, SubmitButton } from '../components/ui.tsx';
import { countryName, errorText, formatDate, useT } from '../i18n/index.ts';
import { SITE_NAMES } from '../profileSites.ts';
import { describeUserAgent } from '../userAgent.ts';
import { LINKS } from '../i18n/content/shared.tsx';
import { navigate, useLocation } from '../router.ts';
import { loadSession, session } from '../session.ts';
import { socket } from '../socket.ts';
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

const PasswordForm = () => {
  const t = useT();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: Event) => {
    event.preventDefault();
    if (next !== confirm) return setMessage({ ok: false, text: t.account.mismatch });
    setBusy(true);
    setMessage(null);
    try {
      await api.post('/api/account/password', { current, next });
      setCurrent('');
      setNext('');
      setConfirm('');
      setMessage({ ok: true, text: t.account.changed });
      socket.reset();
    } catch (err) {
      setMessage({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const input = (id: string, value: string, set: (v: string) => void, autoComplete: string, min = 1) => (
    <input
      id={id}
      type="password"
      class="form-control"
      autoComplete={autoComplete}
      required
      minLength={min}
      maxLength={200}
      value={value}
      onInput={(e) => set((e.target as HTMLInputElement).value)}
    />
  );

  return (
    <form class="form3" onSubmit={submit}>
      <Field label={t.account.current} htmlFor="acc-current">
        {input('acc-current', current, setCurrent, 'current-password')}
      </Field>
      <Field label={t.account.next} htmlFor="acc-next" help={t.auth.passwordHelp}>
        {input('acc-next', next, setNext, 'new-password', 8)}
      </Field>
      <Field label={t.account.confirm} htmlFor="acc-confirm">
        {input('acc-confirm', confirm, setConfirm, 'new-password', 8)}
      </Field>
      {message && <p class={message.ok ? 'ligungi-success' : 'error'}>{message.text}</p>}
      <SubmitButton disabled={busy}>{t.account.change}</SubmitButton>
    </form>
  );
};

const Sessions = () => {
  const t = useT();
  const [list, setList] = useState<SessionView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = () =>
    api
      .get<SessionView[]>('/api/account/sessions')
      .then(setList)
      .catch((err: Error) => setError(err.message));
  useEffect(() => void load(), []);

  const revoke = async (path: string) => {
    setError(null);
    try {
      await api.delete(path);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const others = list?.filter((session) => !session.current).length ?? 0;
  return (
    <>
      <p>{t.account.sessionsText}</p>
      {list && (
        <ul class="ligungi-sessions">
          {list.map((session) => (
            <li key={session.id}>
              <div class="ligungi-sessions__device">
                <strong>{describeUserAgent(session.userAgent) ?? t.account.unknownDevice}</strong>
                {session.current && <span class="ligungi-sessions__current">{t.account.thisDevice}</span>}
                <small>{t.account.sessionDates(formatDate(t, session.createdAt), formatDate(t, session.seenAt))}</small>
              </div>
              {!session.current && (
                <button type="button" class="button button-empty" onClick={() => void revoke(`/api/account/sessions/${session.id}`)}>
                  {t.account.revoke}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {error && <p class="error">{error}</p>}
      {others > 1 && (
        <div class="ligungi-actions">
          <button type="button" class="button button-empty button-red" onClick={() => void revoke('/api/account/sessions')}>
            {t.account.revokeOthers}
          </button>
        </div>
      )}
    </>
  );
};

type PrivacyChoices = { readonly challengePolicy: ChallengePolicy; readonly followPolicy: FollowPolicy };

const PrivacySettings = () => {
  const t = useT();
  const [choices, setChoices] = useState<PrivacyChoices | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => {
    api
      .get<PrivacyChoices>('/api/account/settings')
      .then(setChoices)
      .catch((err: Error) => setMessage({ ok: false, text: err.message }));
  }, []);

  const change = async (patch: Partial<PrivacyChoices>) => {
    const previous = choices;
    setChoices((current) => current && { ...current, ...patch });
    setMessage(null);
    try {
      setChoices(await api.post<PrivacyChoices>('/api/account/settings', patch));
      setMessage({ ok: true, text: t.account.challengesSaved });
    } catch (err) {
      setChoices(previous);
      setMessage({ ok: false, text: (err as Error).message });
    }
  };

  const options = [
    { value: 'everyone' as const, label: t.account.policyEveryone },
    { value: 'following' as const, label: t.account.policyFollowing },
    { value: 'nobody' as const, label: t.account.policyNobody },
  ];
  return (
    <form class="form3" onSubmit={(e) => e.preventDefault()}>
      {choices && (
        <>
          <OptionCards
            name="acc-challenges"
            legend={t.account.challengesTitle}
            layout="segmented"
            value={choices.challengePolicy}
            options={options}
            onChange={(challengePolicy) => void change({ challengePolicy })}
            help={t.account.challengesText}
          />
          <OptionCards
            name="acc-followers"
            legend={t.account.followTitle}
            layout="segmented"
            value={choices.followPolicy}
            options={options}
            onChange={(followPolicy) => void change({ followPolicy })}
            help={t.account.followText}
          />
        </>
      )}
      {message && <p class={message.ok ? 'ligungi-success' : 'error'} role="status">{message.text}</p>}
    </form>
  );
};

type LinkDrafts = Record<ProfileSite, string>;

const drafts = (details: ProfileDetails): LinkDrafts =>
  Object.fromEntries(PROFILE_SITES.map((site) => [site, details.links[site] ?? ''])) as LinkDrafts;

/**
 * Bio, country and linked profiles. Each link is only the name on that site, typed after the fixed part of its address,
 * so a profile can only point to the listed sites.
 */
const ProfileForm = () => {
  const t = useT();
  const [bio, setBio] = useState('');
  const [country, setCountry] = useState<Country | null>(null);
  const [links, setLinks] = useState<LinkDrafts | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const countries = useMemo(() => [...COUNTRIES].sort((a, b) => countryName(t, a).localeCompare(countryName(t, b), t.locale)), [t.locale]);
  const fill = (details: ProfileDetails) => {
    setBio(details.bio);
    setCountry(details.country);
    setLinks(drafts(details));
  };
  useEffect(() => {
    api
      .get<ProfileDetails>('/api/account/profile')
      .then(fill)
      .catch((err: Error) => setMessage({ ok: false, text: err.message }));
  }, []);

  if (!links) return message ? <p class="error">{message.text}</p> : null;
  const invalid = (site: ProfileSite) => links[site].trim() !== '' && profileLinkName(site, links[site]) === null;
  const used = [...bio].length;

  const submit = async (event: Event) => {
    event.preventDefault();
    if (PROFILE_SITES.some(invalid) || used > PROFILE_BIO_MAX) return;
    setBusy(true);
    setMessage(null);
    try {
      fill(await api.post<ProfileDetails>('/api/account/profile', { bio, country, links }));
      setMessage({ ok: true, text: t.account.profileSaved });
    } catch (err) {
      setMessage({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const gameNames: Partial<Record<ProfileSite, string>> = t.account.gameNames;
  const group = (kind: 'social' | 'games', title: string) => (
    <fieldset class="ligungi-profile-form__links">
      <legend>{title}</legend>
      {PROFILE_SITES.filter((site) => PROFILE_LINKS[site].group === kind).map((site) => (
        <Field
          key={site}
          label={
            <>
              <SiteIcon site={site} /> {gameNames[site] ? `${gameNames[site]} (${SITE_NAMES[site]})` : SITE_NAMES[site]}
            </>
          }
          htmlFor={`acc-link-${site}`}
          help={invalid(site) ? <span class="error">{t.account.linkInvalid}</span> : undefined}
        >
          <div class="ligungi-prefixed">
            <span class="ligungi-prefixed__prefix" aria-hidden="true">
              {PROFILE_LINKS[site].prefix}
            </span>
            <input
              id={`acc-link-${site}`}
              class="form-control"
              autocomplete="off"
              spellcheck={false}
              maxLength={300}
              aria-invalid={invalid(site)}
              value={links[site]}
              onInput={(e) => setLinks({ ...links, [site]: (e.target as HTMLInputElement).value })}
            />
          </div>
        </Field>
      ))}
    </fieldset>
  );

  return (
    <form class="form3 ligungi-profile-form" onSubmit={submit}>
      <p>{t.account.profileText}</p>
      <Field
        label={t.account.bio}
        htmlFor="acc-bio"
        help={used > PROFILE_BIO_MAX ? <span class="error">{errorText(t, 'bioTooLong')}</span> : t.account.bioHelp(used, PROFILE_BIO_MAX)}
      >
        <textarea
          id="acc-bio"
          class="form-control"
          rows={4}
          aria-invalid={used > PROFILE_BIO_MAX}
          value={bio}
          onInput={(e) => setBio((e.target as HTMLTextAreaElement).value)}
        />
      </Field>
      <Field label={t.account.country} htmlFor="acc-country">
        <Select
          id="acc-country"
          value={country}
          options={[{ value: null, label: t.account.noCountry }, ...countries.map((code) => ({ value: code, label: countryName(t, code) }))]}
          onChange={setCountry}
        />
      </Field>
      <p class="ligungi-profile-form__help">{t.account.linksHelp}</p>
      <div class="ligungi-profile-form__groups">
        {group('social', t.account.socialTitle)}
        {group('games', t.account.otherGamesTitle)}
      </div>
      {message && <p class={message.ok ? 'ligungi-success' : 'error'}>{message.text}</p>}
      <SubmitButton disabled={busy}>{t.account.profileSave}</SubmitButton>
    </form>
  );
};

/**
 * The link to the community Discord server: the rank role the bot gives from the rating, the Linked Roles connection,
 * and what each rank asks for. The sign-in itself is a full page visit to Discord and back (`/api/discord/link`).
 */
const DiscordLink = () => {
  const t = useT();
  const d = t.account.discord;
  const { search } = useLocation();
  const [view, setView] = useState<DiscordLinkView | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api
      .get<DiscordLinkView>('/api/account/discord')
      .then(setView)
      .catch(() => setView(null));
  }, []);
  useEffect(() => {
    const result = new URLSearchParams(search).get('discord');
    if (!result) return;
    const known = DISCORD_LINK_RESULTS.find((value): value is DiscordLinkResult => value === result);
    if (known) setMessage({ ok: known === 'linked', text: d.results[known] });
    // The result is shown once; reloading the page should not show it again.
    const rest = new URLSearchParams(search);
    rest.delete('discord');
    navigate(`/account${rest.size ? `?${rest}` : ''}`, true, false);
  }, [search]);

  if (!view?.enabled) return null;
  const act = async (request: () => Promise<DiscordLinkView>, done?: (next: DiscordLinkView) => string | null) => {
    setBusy(true);
    setMessage(null);
    try {
      const next = await request();
      setView(next);
      const text = done?.(next) ?? null;
      if (text) setMessage({ ok: true, text });
    } catch (err) {
      setMessage({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };
  const link = view.link;
  const tier = link?.tier ? DISCORD_TIERS.find((entry) => entry.id === link.tier) : undefined;
  const range = (index: number) => {
    const entry = DISCORD_TIERS[index]!;
    const above = index > 0 ? DISCORD_TIERS[index - 1]!.min : null;
    if (entry.min === null) return d.rangeBelow(String(DISCORD_TIERS[index - 1]!.min ?? 0));
    return above === null ? d.rangeFrom(String(entry.min)) : d.rangeBetween(String(entry.min), String(above - 1));
  };

  return (
    <section class="ligungi-card ligungi-settings__card ligungi-discord-link" id="discord">
      <h2>{d.title}</h2>
      <p>{d.text}</p>
      {link ? (
        <>
          <p>
            <strong>{d.linked(link.discordName)}</strong>{' '}
            {tier ? d.rank(`${tier.kanji} ${tier.name}`) : d.verified(DISCORD_VERIFIED_ROLE)}
          </p>
          {link.paused && (
            <div class="ligungi-discord-link__paused">
              <p>{d.paused}</p>
              <a class="button button-empty" href={LINKS.discord} target="_blank" rel="noopener noreferrer">
                {d.join}
              </a>
            </div>
          )}
          <div class="ligungi-discord-link__actions">
            {link.paused && (
              <button
                type="button"
                class="button"
                disabled={busy}
                onClick={() => void act(() => api.post<DiscordLinkView>('/api/account/discord/check'), (next) => (next.link?.paused ? d.stillAway : d.back))}
              >
                {d.check}
              </button>
            )}
            <button type="button" class="button button-empty button-red" disabled={busy} onClick={() => void act(() => api.delete<DiscordLinkView>('/api/account/discord'), () => d.unlinked)}>
              {d.unlink}
            </button>
          </div>
        </>
      ) : (
        <a class="button" href="/api/discord/link">
          {d.link}
        </a>
      )}
      {message && <p class={message.ok ? 'ligungi-success' : 'error'}>{message.text}</p>}
      <h3>{d.ranksTitle}</h3>
      <p class="ligungi-discord-link__help">{d.ranksHelp(DISCORD_VERIFIED_ROLE)}</p>
      <table class="slist slist-pad">
        <thead>
          <tr>
            <th scope="col">{d.rankColumn}</th>
            <th scope="col">{d.ratingColumn}</th>
          </tr>
        </thead>
        <tbody>
          {DISCORD_TIERS.map((entry, index) => (
            <tr key={entry.id} class={entry.id === link?.tier ? 'ligungi-discord-link__current' : undefined}>
              <td>
                <span lang="ja">{entry.kanji}</span> {entry.name}
              </td>
              <td>{range(index)}</td>
            </tr>
          ))}
          <tr>
            <td>{DISCORD_VERIFIED_ROLE}</td>
            <td>{d.provisional}</td>
          </tr>
        </tbody>
      </table>
    </section>
  );
};

/** The recovery codes right after they are made: the only time they are shown, so they can be copied or saved. */
const RecoveryCodes = ({ codes, note, onDone }: { codes: readonly string[]; note?: string; onDone: () => void }) => {
  const t = useT();
  const { user } = useStore(session);
  const [copied, setCopied] = useState(false);
  const text = codes.join('\n');
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {}
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([`${t.account.recoveryFile(user?.name ?? '')}\n\n${text}\n`], { type: 'text/plain' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `ligungi-recovery-codes-${user?.name ?? 'account'}.txt`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <div class="ligungi-recovery">
      {note && <p class="ligungi-success">{note}</p>}
      <h3>{t.account.recoveryTitle}</h3>
      <p>{t.account.recoveryText}</p>
      <ol class="ligungi-recovery__codes">
        {codes.map((code) => (
          <li key={code}>
            <code>{code}</code>
          </li>
        ))}
      </ol>
      <div class="ligungi-recovery__actions">
        <button type="button" class="button button-empty" onClick={() => void copy()}>
          {copied ? t.account.recoveryCopied : t.account.recoveryCopy}
        </button>
        <button type="button" class="button button-empty" onClick={download}>
          {t.account.recoveryDownload}
        </button>
        <button type="button" class="button" onClick={onDone}>
          {t.account.recoveryDone}
        </button>
      </div>
    </div>
  );
};

type TwoFactorStep =
  | { readonly kind: 'idle' }
  | { readonly kind: 'password' }
  | { readonly kind: 'scan'; readonly setup: TwoFactorSetup }
  | { readonly kind: 'codes'; readonly codes: readonly string[]; readonly revoked?: number }
  | { readonly kind: 'renew' }
  | { readonly kind: 'disable' };

/** Groups of four, easier to copy into an app by hand. */
const spacedKey = (secret: string) => secret.match(/.{1,4}/g)?.join(' ') ?? secret;

/** `onSignedOutOthers` lets the page refresh its list of devices. */
const TwoFactorSettings = ({ onSignedOutOthers }: { onSignedOutOthers: () => void }) => {
  const t = useT();
  const [status, setStatus] = useState<TwoFactorView | null>(null);
  const [step, setStep] = useState<TwoFactorStep>({ kind: 'idle' });
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [signOutOthers, setSignOutOthers] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const load = () =>
    api
      .get<TwoFactorView>('/api/account/two-factor')
      .then(setStatus)
      .catch((err: Error) => setError(err.message));
  useEffect(() => void load(), []);

  // A setup left midway, by Cancel or by leaving the page, has its unconfirmed secret deleted at once.
  const scanning = useRef(false);
  scanning.current = step.kind === 'scan';
  const dropSetup = () => void api.delete('/api/account/two-factor/setup').catch(() => {});
  useEffect(
    () => () => {
      if (scanning.current) dropSetup();
    },
    [],
  );

  const go = (next: TwoFactorStep) => {
    setStep(next);
    setPassword('');
    setCode('');
    setSignOutOthers(true);
    setError(null);
  };
  const submit = (work: () => Promise<void>) => async (event: Event) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const passwordField = (
    <Field label={t.account.current} htmlFor="tf-password">
      <input
        id="tf-password"
        type="password"
        class="form-control"
        autoComplete="current-password"
        required
        value={password}
        onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
      />
    </Field>
  );
  /** `recovery` also takes a recovery code, so the field is not limited to digits. */
  const codeField = (label: string, recovery = false) => (
    <Field label={label} htmlFor="tf-code" {...(recovery ? {} : { help: t.account.twoFactorCodeHelp })}>
      <input
        id="tf-code"
        class="form-control ligungi-code-input"
        autoComplete="one-time-code"
        {...(recovery ? {} : { inputMode: 'numeric' as const, pattern: '[0-9 ]*' })}
        required
        maxLength={16}
        spellcheck={false}
        value={code}
        onInput={(e) => setCode((e.target as HTMLInputElement).value)}
      />
    </Field>
  );
  const footer = (label: string) => (
    <>
      {error && <p class="error">{error}</p>}
      <SubmitButton disabled={busy}>{label}</SubmitButton>
      <button
        type="button"
        class="button button-empty ligungi-two-factor__cancel"
        onClick={() => {
          if (step.kind === 'scan') dropSetup();
          go({ kind: 'idle' });
        }}
      >
        {t.account.twoFactorCancel}
      </button>
    </>
  );

  if (!status) return error ? <p class="error">{error}</p> : null;

  switch (step.kind) {
    case 'codes':
      return (
        <RecoveryCodes
          codes={step.codes}
          {...(step.revoked ? { note: t.account.twoFactorSignedOut(step.revoked) } : {})}
          onDone={() => {
            go({ kind: 'idle' });
            void load();
          }}
        />
      );
    case 'password':
      return (
        <form
          class="form3"
          onSubmit={submit(async () => go({ kind: 'scan', setup: await api.post<TwoFactorSetup>('/api/account/two-factor/setup', { password }) }))}
        >
          <p>{t.account.twoFactorPassword}</p>
          {passwordField}
          {footer(t.account.twoFactorContinue)}
        </form>
      );
    case 'scan':
      return (
        <div class="ligungi-two-factor__setup">
          <QrCode text={step.setup.uri} label={t.account.twoFactorQr} />
          <form
            class="form3"
            onSubmit={submit(async () => {
              const { recoveryCodes, revoked } = await api.post<{ recoveryCodes: string[]; revoked: number }>('/api/account/two-factor/enable', {
                code,
                signOutOthers,
              });
              go({ kind: 'codes', codes: recoveryCodes, revoked });
              if (revoked > 0) onSignedOutOthers();
            })}
          >
            <p>{t.account.twoFactorScan}</p>
            <p class="ligungi-two-factor__key">
              {t.account.twoFactorKey}: <code>{spacedKey(step.setup.secret)}</code>
            </p>
            {codeField(t.account.twoFactorCode)}
            <Checkbox
              id="tf-sign-out"
              checked={signOutOthers}
              onChange={setSignOutOthers}
              label={t.account.twoFactorSignOut}
              help={t.account.twoFactorSignOutHelp}
            />
            {footer(t.account.twoFactorConfirm)}
          </form>
        </div>
      );
    case 'renew':
      return (
        <form
          class="form3"
          onSubmit={submit(async () => {
            const { recoveryCodes } = await api.post<{ recoveryCodes: string[] }>('/api/account/two-factor/recovery', { code });
            go({ kind: 'codes', codes: recoveryCodes });
          })}
        >
          <p>{t.account.recoveryNewText}</p>
          {codeField(t.account.twoFactorCode)}
          {footer(t.account.recoveryNew)}
        </form>
      );
    case 'disable':
      return (
        <form
          class="form3"
          onSubmit={submit(async () => {
            await api.post('/api/account/two-factor/disable', { password, code });
            go({ kind: 'idle' });
            await load();
          })}
        >
          <p>{t.account.twoFactorDisableText}</p>
          {passwordField}
          {codeField(t.account.codeOrRecovery, true)}
          {footer(t.account.twoFactorDisable)}
        </form>
      );
    case 'idle':
      return (
        <>
          <p>{t.account.twoFactorText}</p>
          {status.enabled && <p class="ligungi-success ligungi-two-factor__status">{t.account.twoFactorOn(status.recoveryCodesLeft)}</p>}
          <div class="ligungi-two-factor__actions">
            {status.enabled ? (
              <>
                <button type="button" class="button button-empty" onClick={() => go({ kind: 'renew' })}>
                  {t.account.recoveryNew}
                </button>
                <button type="button" class="button button-empty button-red" onClick={() => go({ kind: 'disable' })}>
                  {t.account.twoFactorDisable}
                </button>
              </>
            ) : (
              <button type="button" class="button" onClick={() => go({ kind: 'password' })}>
                {t.account.twoFactorStart}
              </button>
            )}
          </div>
        </>
      );
  }
};

const DeleteForm = () => {
  const t = useT();
  const [password, setPassword] = useState('');
  const [sure, setSure] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: Event) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post('/api/account/delete', { password });
      await loadSession().catch(() => undefined);
      socket.reset();
      navigate('/');
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <form class="form3 ligungi-danger" onSubmit={submit}>
      <p>{t.account.deleteText}</p>
      <Field label={t.account.current} htmlFor="acc-delete-password">
        <input
          id="acc-delete-password"
          type="password"
          class="form-control"
          autoComplete="current-password"
          required
          value={password}
          onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
        />
      </Field>
      <Checkbox id="acc-delete-sure" checked={sure} onChange={setSure} label={t.account.deleteConfirm} />
      {error && <p class="error">{error}</p>}
      <div class="ligungi-actions">
        <button type="submit" class="button button-red ligungi-submit" disabled={busy || !sure || !password}>
          {t.account.deleteButton}
        </button>
      </div>
    </form>
  );
};

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
        <section class="ligungi-card ligungi-settings__card">
          <PrivacySettings />
        </section>
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
