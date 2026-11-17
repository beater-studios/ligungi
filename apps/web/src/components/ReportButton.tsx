import { REPORT_DETAILS_MAX, REPORT_REASONS, type ReportReason } from '@ligungi/protocol';
import { useState } from 'preact/hooks';
import { api } from '../api.ts';
import { useT } from '../i18n/index.ts';
import { icons } from '../icons.ts';
import { Modal } from './Modal.tsx';
import { Field, OptionCards, SubmitButton } from './ui.tsx';

/** What a study can be reported for: what it shows, or anything else. */
const STUDY_REASONS: readonly ReportReason[] = ['content', 'other'];
const PLAYER_REASONS = REPORT_REASONS.filter((reason) => reason !== 'content');

/**
 * Reports a player to the moderators, from their profile or from a game against them, or one of their studies
 * (`studyId`).
 */
export const ReportButton = ({ username, gameId, studyId }: { username: string; gameId?: string; studyId?: string }) => {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>(studyId ? 'content' : 'cheating');
  const [details, setDetails] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const close = () => {
    setOpen(false);
    setSent(false);
    setError(null);
    setDetails('');
  };

  const submit = async (event: Event) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post('/api/reports', { reason, details, ...(studyId ? { studyId } : { username }), ...(gameId ? { gameId } : {}) });
      setSent(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" class="button button-empty text" data-icon={icons.FlagOutline} onClick={() => setOpen(true)}>
        {t.report.button}
      </button>
      {open && (
        <Modal title={studyId ? t.report.studyTitle : t.report.title(username)} onClose={close}>
          {sent ? (
            <p class="ligungi-success">{t.report.sent}</p>
          ) : (
            <form class="form3 ligungi-report-form" onSubmit={submit}>
              <OptionCards
                name="report-reason"
                legend={t.report.reason}
                layout="row"
                value={reason}
                options={(studyId ? STUDY_REASONS : PLAYER_REASONS).map((value) => ({ value, label: t.report.reasons[value] }))}
                onChange={setReason}
              />
              <Field label={t.report.details} htmlFor="report-details" help={studyId ? t.report.studyDetailsHelp : t.report.detailsHelp}>
                <textarea
                  id="report-details"
                  class="form-control"
                  rows={4}
                  maxLength={REPORT_DETAILS_MAX}
                  value={details}
                  onInput={(e) => setDetails((e.target as HTMLTextAreaElement).value)}
                />
              </Field>
              {error && <p class="error">{error}</p>}
              <SubmitButton disabled={busy}>{t.report.send}</SubmitButton>
            </form>
          )}
        </Modal>
      )}
    </>
  );
};
