import { parseFen, type Color } from '@ligungi/engine';
import { chapterFits, type StudyChapter, type StudyRoot, type StudyView } from '@ligungi/protocol';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { api } from '../../api.ts';
import { errorText, useT } from '../../i18n/index.ts';
import { nodeAt, positionAt, type Path } from '../../studyTree.ts';

/** The editor saves on its own this long after the last change. */
const SAVE_DELAY_MS = 800;

interface Pending {
  readonly url: string;
  readonly root: StudyRoot;
}

/**
 * A study and its open chapter (`wanted`, or the first one): loading them, the point of the chapter shown, and the
 * author's edits, saved shortly after the last change and on leaving the page. `onNotice` shows why an edit was refused.
 */
export const useStudyChapter = (id: string, wanted: string | null, onNotice: (text: string) => void) => {
  const t = useT();
  const [study, setStudy] = useState<StudyView | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [chapter, setChapter] = useState<StudyChapter | null>(null);
  const [root, setRoot] = useState<StudyRoot | null>(null);
  const [path, setPath] = useState<Path>([]);
  const [orientation, setOrientation] = useState<Color>('white');
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saved');
  const pending = useRef<Pending | null>(null);
  const saving = useRef(false);
  const timer = useRef<number | undefined>(undefined);

  const chapterId = study ? (study.chapters.find((c) => c.id === wanted) ?? study.chapters[0])?.id : undefined;
  const editable = study?.mine === true;

  // One save at a time: two in flight could reach the server out of order and leave the older tree saved.
  const flush = (keepalive = false) => {
    window.clearTimeout(timer.current);
    const next = pending.current;
    if (!next) return;
    if (keepalive) {
      pending.current = null;
      void fetch(next.url, { method: 'POST', keepalive: true, credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ root: next.root }) });
      return;
    }
    if (saving.current) return;
    pending.current = null;
    saving.current = true;
    api
      .post(next.url, { root: next.root })
      .then(() => {
        saving.current = false;
        if (pending.current) flush();
        else setSaveState('saved');
      })
      .catch(() => {
        saving.current = false;
        pending.current ??= next;
        setSaveState('error');
      });
  };

  useEffect(() => {
    const leave = () => flush(true);
    window.addEventListener('pagehide', leave);
    return () => {
      window.removeEventListener('pagehide', leave);
      flush();
    };
  }, []);

  useEffect(() => {
    setStudy(null);
    setFailed(null);
    api
      .get<StudyView>(`/api/studies/${id}`)
      .then(setStudy)
      .catch((err: Error) => setFailed(err.message));
  }, [id]);

  useEffect(() => {
    if (!chapterId) return;
    flush();
    let current = true;
    api
      .get<StudyChapter>(`/api/studies/${id}/chapters/${chapterId}`)
      .then((loaded) => {
        if (!current) return;
        setChapter(loaded);
        setRoot(loaded.root);
        // A link can open the chapter at a move (`?move=0.1.0`), as a moderator's link to a report does.
        const move = (new URLSearchParams(window.location.search).get('move') ?? '').split('.').filter(Boolean).map(Number);
        setPath(move.length > 0 && move.every(Number.isInteger) && nodeAt(loaded.root, move) ? move : []);
        setOrientation(loaded.orientation);
        setSaveState('saved');
      })
      .catch((err: Error) => current && setFailed(err.message));
    return () => {
      current = false;
    };
  }, [id, chapterId]);

  const start = useMemo(() => (chapter ? parseFen(chapter.fen) : null), [chapter]);
  const tree = chapter?.id === chapterId ? root : null;
  const position = useMemo(() => (start && tree ? positionAt(start, tree, path) : null), [start, tree, path]);
  const node = tree ? (nodeAt(tree, path) ?? tree) : null;

  /** Applies an edit of the author and saves it shortly after, unless it would make the chapter too big. */
  const edit = (next: StudyRoot, nextPath: Path = path) => {
    if (!chapter || !study) return;
    if (!chapterFits(next)) return onNotice(errorText(t, 'chapterTooLarge'));
    setRoot(next);
    setPath(nextPath);
    pending.current = { url: `/api/studies/${study.id}/chapters/${chapter.id}`, root: next };
    setSaveState('saving');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => flush(), SAVE_DELAY_MS);
  };

  return {
    study,
    setStudy,
    failed,
    chapterId,
    chapter,
    setChapter,
    root,
    setRoot,
    path,
    setPath,
    orientation,
    setOrientation,
    saveState,
    editable,
    start,
    tree,
    position,
    node,
    edit,
    editTo: (next: { root: StudyRoot; path: Path }) => edit(next.root, next.path),
    /** Forgets the unsaved edit, for a chapter that no longer exists. */
    discard: () => {
      pending.current = null;
    },
  };
};
