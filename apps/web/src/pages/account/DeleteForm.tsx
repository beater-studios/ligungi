import { useState } from 'preact/hooks';
import { api } from '../../api.ts';
import { Checkbox, Field } from '../../components/ui.tsx';
import { useT } from '../../i18n/index.ts';
import { navigate } from '../../router.ts';
import { loadSession } from '../../session.ts';
import { socket } from '../../socket.ts';

export const DeleteForm = () => {
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
