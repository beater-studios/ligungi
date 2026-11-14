import type { ChallengePolicy, SessionView } from '@ligungi/protocol';
import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { api } from '../api.ts';
import { Checkbox, Field, OptionCards, SubmitButton } from '../components/ui.tsx';
import { formatDate, useT } from '../i18n/index.ts';
import { describeUserAgent } from '../userAgent.ts';
import { navigate } from '../router.ts';
import { loadSession, session } from '../session.ts';
import { socket } from '../socket.ts';
import { useStore } from '../store.ts';

/** The preferences and account pages: a menu between the two beside (on phones above) the page's cards. */
export const SettingsShell = ({ active, title, children }: { active: 'settings' | 'account'; title: string; children: ComponentChildren }) => {
  const t = useT();
  const { user } = useStore(session);
  const link = (key: typeof active, href: string, label: string) => (
    <a class={active === key ? 'active' : ''} href={href} aria-current={active === key ? 'page' : undefined}>
      {label}
    </a>
  );
  return (
    <main class="ligungi-page ligungi-settings">
      <nav class="ligungi-card ligungi-settings__menu" aria-label={t.settings.menu}>
        {link('settings', '/settings', t.settings.title)}
        {user && link('account', '/account', t.account.title)}
      </nav>
      <div class="ligungi-settings__body">
        <h1>{title}</h1>
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

const ChallengeSettings = () => {
  const t = useT();
  const [policy, setPolicy] = useState<ChallengePolicy | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => {
    api
      .get<{ challengePolicy: ChallengePolicy }>('/api/account/settings')
      .then((settings) => setPolicy(settings.challengePolicy))
      .catch((err: Error) => setMessage({ ok: false, text: err.message }));
  }, []);

  const change = async (next: ChallengePolicy) => {
    const previous = policy;
    setPolicy(next);
    setMessage(null);
    try {
      await api.post('/api/account/settings', { challengePolicy: next });
      setMessage({ ok: true, text: t.account.challengesSaved });
    } catch (err) {
      setPolicy(previous);
      setMessage({ ok: false, text: (err as Error).message });
    }
  };

  return (
    <form class="form3" onSubmit={(e) => e.preventDefault()}>
      <p>{t.account.challengesText}</p>
      {policy && (
        <OptionCards
          name="acc-challenges"
          legend={t.account.challengesTitle}
          hideLegend
          layout="segmented"
          value={policy}
          options={[
            { value: 'everyone' as const, label: t.account.policyEveryone },
            { value: 'following' as const, label: t.account.policyFollowing },
            { value: 'nobody' as const, label: t.account.policyNobody },
          ]}
          onChange={(next) => void change(next)}
        />
      )}
      {message && <p class={message.ok ? 'ligungi-success' : 'error'}>{message.text}</p>}
    </form>
  );
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

export const AccountPage = () => {
  const t = useT();
  const { user, loaded } = useStore(session);
  return (
    <SettingsShell active="account" title={t.account.title}>
      {loaded && !user ? (
        <section class="ligungi-card ligungi-settings__card">
          <p>
            {t.account.loginNeeded} <a href="/login">{t.nav.signIn}</a>
          </p>
        </section>
      ) : (
        <>
          <div class="ligungi-account__grid">
            <section class="ligungi-card ligungi-settings__card">
              <h2>{t.account.passwordTitle}</h2>
              <PasswordForm />
            </section>
            <div class="ligungi-account__column">
              <section class="ligungi-card ligungi-settings__card">
                <h2>{t.account.challengesTitle}</h2>
                <ChallengeSettings />
              </section>
              <section class="ligungi-card ligungi-settings__card">
                <h2>{t.account.dataTitle}</h2>
                <p>{t.account.dataText}</p>
                <a class="button button-empty ligungi-account__download" href="/api/account/export" download>
                  {t.account.dataDownload}
                </a>
              </section>
            </div>
          </div>
          <section class="ligungi-card ligungi-settings__card">
            <h2>{t.account.sessionsTitle}</h2>
            <Sessions />
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
