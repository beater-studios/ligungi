import { useEffect, useState } from 'preact/hooks';
import { Field, SubmitButton } from '../components/ui.tsx';
import { useT } from '../i18n/index.ts';
import { navigate } from '../router.ts';
import { login } from '../session.ts';

export const AuthPage = ({ signup }: { signup: boolean }) => {
  const t = useT();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Switching between signing in and signing up keeps what was typed but not the other form's error.
  useEffect(() => setError(null), [signup]);

  const submit = async (event: Event) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(username.trim(), password, signup);
      navigate('/');
    } catch (err) {
      setError((err as Error).message);
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
              onInput={(e) => setUsername((e.target as HTMLInputElement).value)}
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
          {error && <p class="error">{error}</p>}
          <SubmitButton disabled={busy}>{signup ? t.nav.signUp : t.nav.signIn}</SubmitButton>
        </form>
        <p class="ligungi-auth__warning">{t.auth.noRecovery}</p>
      </section>
    </main>
  );
};
