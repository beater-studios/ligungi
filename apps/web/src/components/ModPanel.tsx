import { REPORT_DETAILS_MAX, SUSPENSION_DAYS, type ModUserView } from '@ligungi/protocol';
import { useEffect, useState } from 'preact/hooks';
import { api } from '../api.ts';
import { asSentence, formatDate, useT } from '../i18n/index.ts';
import { icons } from '../icons.ts';
import { navigate } from '../router.ts';
import { ModLog } from './ModLog.tsx';
import { Field, Select, SubmitButton } from './ui.tsx';

type Action = 'suspend' | 'unsuspend' | 'rename' | 'clearProfile';

/**
 * A moderator's card on a player's profile: their standing, the actions on them and their moderation history.
 * `onProfileCleared` lets the page drop the bio and links it shows.
 */
export const ModPanel = ({ name, onProfileCleared }: { name: string; onProfileCleared?: () => void }) => {
  const t = useT();
  const [view, setView] = useState<ModUserView | null>(null);
  const [action, setAction] = useState<Action | null>(null);
  const [days, setDays] = useState<number | null>(7);
  const [reason, setReason] = useState('');
  const [newName, setNewName] = useState('');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const path = `/api/mod/users/${encodeURIComponent(name)}`;
  const load = () =>
    api
      .get<ModUserView>(path)
      .then(setView)
      .catch((err: Error) => setMessage({ ok: false, text: err.message }));
  useEffect(() => void load(), [name]);

  const start = (next: Action | null) => {
    setAction(next);
    setReason('');
    setNewName('');
    setMessage(null);
  };

  const submit = async (event: Event) => {
    event.preventDefault();
    if (!action) return;
    setBusy(true);
    setMessage(null);
    try {
      if (action === 'rename') {
        const { user } = await api.post<{ user: { name: string } }>(`${path}/rename`, { username: newName, reason });
        navigate(`/@/${user.name}`);
        return;
      }
      const route = action === 'clearProfile' ? 'clear-profile' : action;
      await api.post(`${path}/${route}`, action === 'suspend' ? { days, reason } : { reason });
      if (action === 'clearProfile') onProfileCleared?.();
      start(null);
      setMessage({ ok: true, text: t.mod.done });
      await load();
    } catch (err) {
      setMessage({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  if (!view) return message ? <p class="error">{message.text}</p> : null;
  const { suspension } = view;

  return (
    <section class="ligungi-card ligungi-mod-panel">
      <h2 data-icon={icons.Agent}>{t.mod.panel}</h2>
      {view.moderator ? (
        <p>{t.mod.isModerator}</p>
      ) : (
        <>
          <p class="ligungi-mod-panel__status">
            {suspension === null ? t.mod.notSuspended : suspension.until === null ? t.mod.suspendedForever : t.mod.suspendedUntil(formatDate(t, suspension.until))}
            {suspension && ` ${t.mod.reasonLabel(asSentence(suspension.reason))}`} {t.mod.openReports(view.openReports)}
          </p>
          <div class="ligungi-mod-panel__actions">
            <button type="button" class={`button button-empty${action === 'suspend' ? ' active' : ''}`} onClick={() => start(action === 'suspend' ? null : 'suspend')}>
              {t.mod.suspend}
            </button>
            {suspension && (
              <button type="button" class={`button button-empty${action === 'unsuspend' ? ' active' : ''}`} onClick={() => start(action === 'unsuspend' ? null : 'unsuspend')}>
                {t.mod.unsuspend}
              </button>
            )}
            <button type="button" class={`button button-empty${action === 'rename' ? ' active' : ''}`} onClick={() => start(action === 'rename' ? null : 'rename')}>
              {t.mod.rename}
            </button>
            <button
              type="button"
              class={`button button-empty${action === 'clearProfile' ? ' active' : ''}`}
              onClick={() => start(action === 'clearProfile' ? null : 'clearProfile')}
            >
              {t.mod.clearProfile}
            </button>
          </div>
          {action && (
            <form class="form3 ligungi-mod-panel__form" onSubmit={submit}>
              {action === 'suspend' && (
                <>
                  <p class="ligungi-notice">{t.mod.suspendHelp}</p>
                  <Field label={t.mod.duration} htmlFor="mod-days">
                    <Select
                      id="mod-days"
                      value={days}
                      options={SUSPENSION_DAYS.map((n) => ({ value: n, label: n === null ? t.mod.permanent : t.mod.days(n) }))}
                      onChange={setDays}
                    />
                  </Field>
                </>
              )}
              {action === 'rename' && (
                <>
                  <p class="ligungi-notice">{t.mod.renameHelp}</p>
                  <Field label={t.mod.newName} htmlFor="mod-name" help={t.auth.usernameHelp}>
                    <input
                      id="mod-name"
                      class="form-control"
                      required
                      minLength={3}
                      maxLength={20}
                      value={newName}
                      onInput={(e) => setNewName((e.target as HTMLInputElement).value)}
                    />
                  </Field>
                </>
              )}
              {action === 'clearProfile' && <p class="ligungi-notice">{t.mod.clearProfileHelp}</p>}
              <Field label={t.mod.reason} htmlFor="mod-reason">
                <input
                  id="mod-reason"
                  class="form-control"
                  required
                  maxLength={REPORT_DETAILS_MAX}
                  value={reason}
                  onInput={(e) => setReason((e.target as HTMLInputElement).value)}
                />
              </Field>
              <SubmitButton disabled={busy}>{{ suspend: t.mod.suspend, unsuspend: t.mod.unsuspend, rename: t.mod.rename, clearProfile: t.mod.clearProfile }[action]}</SubmitButton>
            </form>
          )}
        </>
      )}
      {message && <p class={message.ok ? 'ligungi-success' : 'error'}>{message.text}</p>}
      <h3>{t.mod.history}</h3>
      <ModLog entries={view.log} />
    </section>
  );
};
