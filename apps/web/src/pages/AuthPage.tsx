import { useState } from 'preact/hooks';
import { useT } from '../i18n/index.ts';
import { navigate } from '../router.ts';
import { login } from '../session.ts';

export const AuthPage = ({ signup }: { signup: boolean }) => {
  const t = useT();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  return (
    <main class={`auth ${signup ? 'auth-signup' : 'auth-login'} box box-pad`}>
      <h1 class="box__top">{signup ? t.nav.signUp : t.nav.signIn}</h1>
      <form class="form3" onSubmit={submit}>
        <div class="form-group">
          <label class="form-label" for="auth-username">
            {t.auth.username}
          </label>
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
        </div>
        <div class="form-group">
          <label class="form-label" for="auth-password">
            {t.auth.password}
          </label>
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
          {signup && <small class="form-help">{t.auth.passwordHelp}</small>}
        </div>
        {error && <p class="error">{error}</p>}
        <button type="submit" class="submit button text button-fat" disabled={busy}>
          {signup ? t.nav.signUp : t.nav.signIn}
        </button>
      </form>
      <div class="alternative">
        {signup ? <a href="/login">{t.auth.haveAccount}</a> : <a href="/signup">{t.nav.signUp}</a>}
        <a href="/">{t.auth.playAnonymous}</a>
      </div>
    </main>
  );
};
