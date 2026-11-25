import { MODES, type Mode } from '@ligungi/engine';
import { useState } from 'preact/hooks';
import { activity, playWithCall, type ActivityState } from '../discordActivity.ts';
import { useT } from '../i18n/index.ts';
import { navigate } from '../router.ts';
import { useStore } from '../store.ts';
import { Field, Select, SubmitButton } from './ui.tsx';

interface ActivityCallViewProps {
  readonly state: ActivityState;
  readonly onPlay: (mode: Mode) => Promise<void>;
}

/** The "play with this call" card, given the Activity's state: shown at the top of the home page inside Discord. */
export const ActivityCallView = ({ state, onPlay }: ActivityCallViewProps) => {
  const t = useT();
  const a = t.discordActivity;
  const [mode, setMode] = useState<Mode>('beginner');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (state.status === 'off') return null;

  const submit = async (event: Event) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onPlay(mode);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section class="ligungi-card ligungi-call">
      <h2>{a.title}</h2>
      <p class="ligungi-call__hint">{a.hint}</p>
      {state.status === 'starting' && (
        <p class="ligungi-notice" role="status">
          {a.connecting}
        </p>
      )}
      {state.status === 'failed' && (
        <p class="error" role="alert">
          {a.failed}
        </p>
      )}
      {state.status === 'ready' && (
        <form onSubmit={submit}>
          <Field label={t.common.mode} htmlFor="activity-mode">
            <Select id="activity-mode" value={mode} options={MODES.map((m) => ({ value: m, label: t.modes[m] }))} onChange={setMode} />
          </Field>
          {state.reason && (
            <p class="ligungi-notice">
              {a.guest[state.reason]}{' '}
              {state.reason === 'unlinked' && (
                <a href="/account" target="_blank" rel="noopener">
                  {a.linkAccount}
                </a>
              )}
            </p>
          )}
          {error && (
            <p class="error" role="alert">
              {error}
            </p>
          )}
          <SubmitButton disabled={busy}>{a.play}</SubmitButton>
        </form>
      )}
    </section>
  );
};

export const ActivityCall = () => {
  const state = useStore(activity);
  return <ActivityCallView state={state} onPlay={async (mode) => navigate(await playWithCall(mode))} />;
};
