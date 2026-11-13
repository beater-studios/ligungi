import type { SessionView } from '@ligungi/protocol';
import { useEffect, useState } from 'preact/hooks';
import { api } from '../api.ts';
import { Checkbox, Field, SubmitButton } from '../components/ui.tsx';
import { formatDate, useT } from '../i18n/index.ts';
import { describeUserAgent } from '../userAgent.ts';
import { navigate } from '../router.ts';
import { loadSession, session } from '../session.ts';
import { socket } from '../socket.ts';
import { useStore } from '../store.ts';

export const SettingsMenu = ({ active }: { active: 'settings' | 'account' }) => {
  const t = useT();
  const { user } = useStore(session);
  return (
    <nav class="page-menu__menu subnav">
      <a class={active === 'settings' ? 'active' : ''} href="/settings">
        {t.settings.title}
      </a>
      {user && (
        <a class={active === 'account' ? 'active' : ''} href="/account">
          {t.account.title}
        </a>
      )}
    </nav>
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
    <main class="account page-menu">
      <SettingsMenu active="account" />
      <div class="page-menu__content box box-pad">
        <h1 class="box__top">{t.account.title}</h1>
        {loaded && !user ? (
          <p>
            {t.account.loginNeeded} <a href="/login">{t.nav.signIn}</a>
          </p>
        ) : (
          <>
            <section>
              <h2>{t.account.passwordTitle}</h2>
              <PasswordForm />
            </section>
            <section>
              <h2>{t.account.sessionsTitle}</h2>
              <Sessions />
            </section>
            <section>
              <h2>{t.account.dataTitle}</h2>
              <p>{t.account.dataText}</p>
              <a class="button button-empty" href="/api/account/export" download>
                {t.account.dataDownload}
              </a>
            </section>
            <section class="ligungi-danger-zone">
              <h2>{t.account.deleteTitle}</h2>
              <DeleteForm />
            </section>
          </>
        )}
      </div>
    </main>
  );
};
