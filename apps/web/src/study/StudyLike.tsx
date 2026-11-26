import type { StudyLikes, StudyView } from '@ligungi/protocol';
import { useState } from 'preact/hooks';
import { api } from '../core/api.ts';
import { session } from '../core/session.ts';
import { useStore } from '../core/store.ts';
import { useT } from '../i18n/index.ts';
import { icons } from '../icons.ts';

/** The heart of a study and how many like it: a toggle with an account, a link to sign in without one. */
export const StudyLike = ({ study, onChange }: { study: StudyView; onChange: (likes: StudyLikes) => void }) => {
  const t = useT();
  const { user } = useStore(session);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) {
    return (
      <a class="ligungi-study__like" href="/login" title={t.study.likeSignIn} data-icon={icons.HeartOutline}>
        {t.study.likeCount(study.likes)}
      </a>
    );
  }

  const toggle = async () => {
    setBusy(true);
    setError(null);
    const path = `/api/studies/${study.id}/like`;
    try {
      onChange(study.liked ? await api.delete<StudyLikes>(path) : await api.post<StudyLikes>(path));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        class="button button-empty text ligungi-study__like"
        aria-pressed={study.liked}
        aria-label={t.study.likeAria(study.likes)}
        title={t.study.likeAria(study.likes)}
        data-icon={study.liked ? icons.Heart : icons.HeartOutline}
        disabled={busy}
        onClick={() => void toggle()}
      >
        {study.likes}
      </button>
      {error && <span class="error">{error}</span>}
    </>
  );
};
