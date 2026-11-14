import type { ChallengePolicy, SessionView, TwoFactorSetup, TwoFactorView } from '@ligungi/protocol';
import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { api } from '../api.ts';
import { QrCode } from '../components/QrCode.tsx';
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

export const AccountPage = () => {
  const t = useT();
  const { user, loaded } = useStore(session);
  // Bumped to reload the list of devices after two-step setup signs the others out.
  const [sessionsVersion, setSessionsVersion] = useState(0);
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
            <h2>{t.account.twoFactorTitle}</h2>
            <TwoFactorSettings onSignedOutOthers={() => setSessionsVersion((n) => n + 1)} />
          </section>
          <section class="ligungi-card ligungi-settings__card">
            <h2>{t.account.sessionsTitle}</h2>
            <Sessions key={sessionsVersion} />
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
