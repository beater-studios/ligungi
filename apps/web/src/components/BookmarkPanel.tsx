import { BOOKMARK_NOTE_MAX, type BookmarkView } from '@ligungi/protocol';
import { useEffect, useState } from 'preact/hooks';
import { api } from '../api.ts';
import { errorText, useT } from '../i18n/index.ts';
import { Field } from './ui.tsx';

/**
 * The viewer's bookmark on a game (signed in only): a star that keeps it in their bookmarks, and once bookmarked a
 * private note, saved with its button or when the field loses focus.
 */
export const BookmarkPanel = ({ gameId }: { gameId: string }) => {
  const t = useT();
  const [view, setView] = useState<BookmarkView | null>(null);
  const [note, setNote] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setView(null);
    api
      .get<BookmarkView>(`/api/games/${gameId}/bookmark`)
      .then((answer) => {
        if (!alive) return;
        setView(answer);
        setNote(answer.note);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [gameId]);

  if (!view) return null;

  const toggle = () => {
    setError(null);
    setSaved(false);
    const request = view.bookmarked ? api.delete<BookmarkView>(`/api/games/${gameId}/bookmark`) : api.post<BookmarkView>(`/api/games/${gameId}/bookmark`, { note });
    request.then(setView).catch((err: Error) => setError(err.message));
  };

  const save = () => {
    if (!view.bookmarked || note.trim() === view.note) return;
    setError(null);
    api
      .post<BookmarkView>(`/api/games/${gameId}/bookmark`, { note })
      .then((answer) => {
        setView(answer);
        setNote(answer.note);
        setSaved(true);
      })
      .catch((err: Error) => setError(err.message));
  };

  const tooLong = note.length > BOOKMARK_NOTE_MAX;
  return (
    <div class="ligungi-bookmark">
      <button
        type="button"
        class={`button button-empty text ligungi-bookmark__star${view.bookmarked ? ' is-on' : ''}`}
        aria-pressed={view.bookmarked}
        title={view.bookmarked ? t.game.bookmarkRemove : t.game.bookmark}
        onClick={toggle}
      >
        <span aria-hidden="true">{view.bookmarked ? '★' : '☆'}</span> {view.bookmarked ? t.game.bookmarked : t.game.bookmark}
      </button>
      {view.bookmarked && (
        <form
          class="form3 ligungi-bookmark__note"
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <Field
            label={t.game.noteLabel}
            htmlFor={`note-${gameId}`}
            {...(tooLong ? { help: <span class="error">{errorText(t, 'invalidBookmarkNote')}</span> } : saved ? { help: t.game.noteSaved } : {})}
          >
            <textarea
              id={`note-${gameId}`}
              class="form-control"
              rows={3}
              placeholder={t.game.notePlaceholder}
              aria-invalid={tooLong}
              value={note}
              onInput={(event) => {
                setNote((event.target as HTMLTextAreaElement).value);
                setSaved(false);
              }}
              onBlur={() => !tooLong && save()}
            />
          </Field>
          {note.trim() !== view.note && (
            <button type="submit" class="button button-empty" disabled={tooLong}>
              {t.game.noteSave}
            </button>
          )}
        </form>
      )}
      {error && <p class="error">{error}</p>}
    </div>
  );
};
