import { useEffect, useState } from 'preact/hooks';
import { ApiError } from '../api.ts';
import { Field, SubmitButton } from '../components/ui.tsx';
import { asSentence, formatDate, useT } from '../i18n/index.ts';
import { prefs, updatePrefs } from '../prefs.ts';
import { navigate } from '../router.ts';
import { login } from '../session.ts';
import { useStore } from '../store.ts';

export const AuthPage = ({ signup }: { signup: boolean }) => {
  const t = useT();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  // Asked only after the password, for accounts with two-step verification on.
  const [needCode, setNeedCode] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { screenReader } = useStore(prefs);

  // Switching between signing in and signing up keeps what was typed but not the other form's error.
  useEffect(() => setError(null), [signup]);

  const submit = async (event: Event) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(username.trim(), password, signup, needCode && !signup ? code.trim() : undefined);
      navigate('/');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'twoFactorRequired') setNeedCode(true);
      else if (err instanceof ApiError && err.code === 'accountSuspended') {
        // The server says until when and why, so the player knows what happened and that it can be contested.
        const until = typeof err.data.until === 'number' ? formatDate(t, err.data.until) : null;
        const reason = asSentence(typeof err.data.reason === 'string' ? err.data.reason : '');
        setError(`${until ? t.auth.suspended(until, reason) : t.auth.suspendedForever(reason)} ${t.auth.contest}`);
      } else setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const pitch = (
    <section class="ligungi-auth__pitch">
      <h1>{t.auth.pitchTitle}</h1>
      <p>{t.auth.pitchIntro}</p>
      <ul>
        {t.auth.pitchItems.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <p class="ligungi-auth__note">{t.auth.pitchNote}</p>
      <a href="/">{t.auth.playAnonymous}</a>
    </section>
  );

  return (
    <main class={`ligungi-page ligungi-auth${signup ? ' ligungi-auth--signup' : ''}`}>
      {/* First on the page, where a screen reader meets it before anything else, as on lichess. */}
      <p class="ligungi-auth__a11y">
        {screenReader ? t.blind.isOn : t.blind.authPrompt}{' '}
        <button type="button" class="ligungi-link-button" onClick={() => updatePrefs({ screenReader: !screenReader })}>
          {screenReader ? t.blind.turnOff : t.blind.turnOn}
        </button>
      </p>
      {pitch}
      <section class="ligungi-card ligungi-auth__card">
        <nav class="ligungi-segmented ligungi-auth__tabs" aria-label={t.auth.tabs}>
          <a href="/login" class={signup ? '' : 'active'} aria-current={signup ? undefined : 'page'}>
            {t.nav.signIn}
          </a>
          <a href="/signup" class={signup ? 'active' : ''} aria-current={signup ? 'page' : undefined}>
            {t.nav.signUp}
          </a>
        </nav>
        <form class="form3" onSubmit={submit}>
          <Field label={t.auth.username} htmlFor="auth-username" {...(signup ? { help: t.auth.usernameHelp } : {})}>
            <input
              id="auth-username"
              class="form-control"
              autoComplete="username"
              required
              minLength={3}
              maxLength={20}
              value={username}
              onInput={(e) => {
                setUsername((e.target as HTMLInputElement).value);
                setNeedCode(false);
                setCode('');
              }}
            />
          </Field>
          <Field label={t.auth.password} htmlFor="auth-password" {...(signup ? { help: t.auth.passwordHelp } : {})}>
            <input
              id="auth-password"
              type="password"
              class="form-control"
              autoComplete={signup ? 'new-password' : 'current-password'}
              required
              minLength={signup ? 8 : 1}
              value={password}
              onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
            />
          </Field>
          {needCode && !signup && (
            <Field label={t.auth.code} htmlFor="auth-code" help={t.auth.codeHelp}>
              <input
                id="auth-code"
                class="form-control ligungi-code-input"
                autoComplete="one-time-code"
                autoFocus
                required
                maxLength={16}
                spellcheck={false}
                value={code}
                onInput={(e) => setCode((e.target as HTMLInputElement).value)}
              />
            </Field>
          )}
          {error && <p class="error">{error}</p>}
          <SubmitButton disabled={busy}>{signup ? t.nav.signUp : t.nav.signIn}</SubmitButton>
        </form>
        <p class="ligungi-auth__warning">{t.auth.noRecovery}</p>
      </section>
    </main>
  );
};
