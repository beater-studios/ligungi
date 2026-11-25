import { REPORT_DETAILS_MAX } from '@ligungi/protocol';
import { useState } from 'preact/hooks';
import { api } from '../core/api.ts';
import { useT } from '../i18n/index.ts';
import { icons } from '../icons.ts';
import { Modal } from '../components/Modal.tsx';
import { Field, SubmitButton } from '../components/ui.tsx';

/** A moderator voids a finished rated game won by cheating; the page updates through the game socket. */
export const VoidGame = ({ gameId }: { gameId: string }) => {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: Event) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post(`/api/mod/games/${gameId}/void`, { reason });
      setOpen(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" class="button button-empty button-red text" data-icon={icons.Agent} onClick={() => setOpen(true)}>
        {t.mod.voidGame}
      </button>
      {open && (
        <Modal title={t.mod.voidGame} onClose={() => setOpen(false)}>
          <form class="form3" onSubmit={submit}>
            <p class="ligungi-notice">{t.mod.voidHelp}</p>
            <Field label={t.mod.reason} htmlFor="void-reason">
              <input
                id="void-reason"
                class="form-control"
                required
                maxLength={REPORT_DETAILS_MAX}
                value={reason}
                onInput={(e) => setReason((e.target as HTMLInputElement).value)}
              />
            </Field>
            {error && <p class="error">{error}</p>}
            <SubmitButton disabled={busy}>{t.mod.voidGame}</SubmitButton>
          </form>
        </Modal>
      )}
    </>
  );
};
