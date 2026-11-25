import { REPORT_DETAILS_MAX, type StudyView } from '@ligungi/protocol';
import { useState } from 'preact/hooks';
import { api } from '../../core/api.ts';
import { Field } from '../../components/ui.tsx';
import { useT } from '../../i18n/index.ts';
import { icons } from '../../icons.ts';

/** Hide, show again or delete a study, or clear the drawings of the chapter open, with the reason the log keeps. */
export const StudyModTools = ({
  study,
  chapterId,
  onChange,
  onCleared,
}: {
  study: StudyView;
  chapterId: string | null;
  onChange: (hidden: boolean | null) => void;
  onCleared: () => void;
}) => {
  const t = useT();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const clear = async () => {
    if (!chapterId) return;
    setError(null);
    try {
      await api.post(`/api/mod/studies/${study.id}/chapters/${chapterId}/clear-drawings`, { reason });
      setReason('');
      onCleared();
    } catch (err) {
      setError((err as Error).message);
    }
  };
  const act = async (route: 'hide' | 'delete', hidden?: boolean) => {
    setError(null);
    try {
      await api.post(`/api/mod/studies/${study.id}/${route}`, { reason, ...(hidden === undefined ? {} : { hidden }) });
      setReason('');
      onChange(route === 'delete' ? null : hidden ?? true);
    } catch (err) {
      setError((err as Error).message);
    }
  };
  return (
    <section class="ligungi-study__mod box box-pad">
      <h2>{t.mod.panel}</h2>
      <Field label={t.mod.reason} htmlFor="study-mod-reason">
        <textarea
          id="study-mod-reason"
          class="form-control"
          rows={2}
          maxLength={REPORT_DETAILS_MAX}
          value={reason}
          onInput={(e) => setReason((e.target as HTMLTextAreaElement).value)}
        />
      </Field>
      {error && <p class="error">{error}</p>}
      <div class="ligungi-study__actions">
        <button type="button" class="button button-empty" disabled={!reason.trim()} onClick={() => void act('hide', !study.hidden)}>
          {study.hidden ? t.study.unhide : t.study.hide}
        </button>
        {chapterId && (
          <button type="button" class="button button-empty" disabled={!reason.trim()} onClick={() => void clear()}>
            {t.study.clearDrawings}
          </button>
        )}
        <button type="button" class="button button-empty button-red" data-icon={icons.Trash} disabled={!reason.trim()} onClick={() => void act('delete')}>
          {t.study.deleteStudy}
        </button>
      </div>
    </section>
  );
};
