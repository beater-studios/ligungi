import {
  type SessionView,
  type TwoFactorSetup,
  type TwoFactorView,
} from '@ligungi/protocol';
import { useEffect, useRef, useState } from 'preact/hooks';
import { api } from '../../api.ts';
import { QrCode } from '../../components/QrCode.tsx';
import { Checkbox, Field, SubmitButton } from '../../components/ui.tsx';
import { formatDate, useT } from '../../i18n/index.ts';
import { describeUserAgent } from '../../userAgent.ts';
import { session } from '../../session.ts';
import { socket } from '../../socket.ts';
import { useStore } from '../../store.ts';
import { useCopy } from '../../hooks.ts';

export const PasswordForm = () => {
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

export const Sessions = () => {
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

/** The recovery codes right after they are made: the only time they are shown, so they can be copied or saved. */
const RecoveryCodes = ({ codes, note, onDone }: { codes: readonly string[]; note?: string; onDone: () => void }) => {
  const t = useT();
  const { user } = useStore(session);
  const { copied, copy } = useCopy();
  const text = codes.join('\n');
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
        <button type="button" class="button button-empty" onClick={() => void copy(text)}>
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
export const TwoFactorSettings = ({ onSignedOutOthers }: { onSignedOutOthers: () => void }) => {
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
