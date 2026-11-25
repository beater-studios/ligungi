import { legalMoves, moveToString, opposite, parseFen, parseMove, toFen, type Color, type Move } from '@ligungi/engine';
import type { Shape } from '@ligungi/board';
import {
  REPORT_DETAILS_MAX,
  SHAPE_COLORS,
  STUDY_ARROWS_MAX,
  STUDY_COMMENT_MAX,
  STUDY_SQUARES_MAX,
  chapterFits,
  shapeCounts,
  toggleShape,
  type ShapeColor,
  type StudyChapter,
  type StudyNode,
  type StudyRoot,
  type StudyShape,
  type StudyView,
} from '@ligungi/protocol';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { api } from '../api.ts';
import { sayMove } from '../speech.ts';
import { BlindPanel } from '../components/BlindPanel.tsx';
import { BoardView } from '../components/BoardView.tsx';
import { DraftPanel, TowerPanel, TowerStrip } from '../components/Panels.tsx';
import { ReportButton } from '../components/ReportButton.tsx';
import { ChapterSettingsModal, NewChapterModal, StudySettingsModal } from '../components/StudyForms.tsx';
import { StudyMoves } from '../components/StudyMoves.tsx';
import { Field, Toggle } from '../components/ui.tsx';
import { describeMove, describeShapes, isWord, normalize, parseDrawing, type Speaker } from '../blind.ts';
import { errorText, listText, timeAgo, usePieceNames, useT } from '../i18n/index.ts';
import { icons } from '../icons.ts';
import { prefs } from '../prefs.ts';
import { navigate, useLocation } from '../router.ts';
import { session } from '../session.ts';
import { useStore } from '../store.ts';
import { useTowerTap } from '../towerTap.ts';
import { addMove, deleteAt, lineEnd, nodeAt, positionAt, promote, updateAt, type Path } from '../studyTree.ts';

/** The editor saves on its own this long after the last change. */
const SAVE_DELAY_MS = 800;
const NOTICE_MS = 4000;

/** The study reads each move through `where`, so the screen reader mode gets no move list to announce. */
const NO_MOVES: readonly never[] = [];

const toStudyShape = (shape: Shape, color: ShapeColor): StudyShape =>
  shape.kind === 'arrow' ? { kind: 'arrow', from: shape.from, to: shape.to, color } : { kind: 'square', square: shape.square, color };

interface Pending {
  readonly url: string;
  readonly root: StudyRoot;
}

/** The chapter's tree with every drawing removed, as the moderators' clear-drawings leaves it. */
const withoutShapes = <T extends StudyRoot>(node: T): T => ({ ...node, shapes: [], children: node.children.map(withoutShapes) });

/** Hide, show again or delete a study, or clear the drawings of the chapter open, with the reason the log keeps. */
const StudyModTools = ({
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

export const StudyPage = ({ id }: { id: string }) => {
  const t = useT();
  const { search } = useLocation();
  const { user, moderator } = useStore(session);
  const [study, setStudy] = useState<StudyView | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [chapter, setChapter] = useState<StudyChapter | null>(null);
  const [root, setRoot] = useState<StudyRoot | null>(null);
  const [path, setPath] = useState<Path>([]);
  const [orientation, setOrientation] = useState<Color>('white');
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saved');
  const [notice, setNotice] = useState<string | null>(null);
  const [color, setColor] = useState<ShapeColor>('green');
  const [drawMode, setDrawMode] = useState(false);
  const [modal, setModal] = useState<'settings' | 'chapter' | 'newChapter' | null>(null);
  const [inspected, setInspected] = useState<number | null>(null);
  const [hands, setHands] = useState<{ top: HTMLElement; bottom: HTMLElement } | null>(null);
  const topHand = useRef<HTMLDivElement>(null);
  const bottomHand = useRef<HTMLDivElement>(null);
  const pending = useRef<Pending | null>(null);
  const { screenReader } = useStore(prefs);
  const tap = useTowerTap(true);
  const speaker: Speaker = { t, names: usePieceNames() };
  const saving = useRef(false);
  const timer = useRef<number | undefined>(undefined);

  const wanted = new URLSearchParams(search).get('chapter');
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
    if (topHand.current && bottomHand.current) setHands({ top: topHand.current, bottom: bottomHand.current });
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

  useEffect(() => {
    if (!notice) return;
    const clear = window.setTimeout(() => setNotice(null), NOTICE_MS);
    return () => window.clearTimeout(clear);
  }, [notice]);

  const start = useMemo(() => (chapter ? parseFen(chapter.fen) : null), [chapter]);
  const tree = chapter?.id === chapterId ? root : null;
  const position = useMemo(() => (start && tree ? positionAt(start, tree, path) : null), [start, tree, path]);
  const node = tree ? (nodeAt(tree, path) ?? tree) : null;
  const legal = useMemo(() => (editable && position ? legalMoves(position) : []), [editable, position]);
  const lastMove = path.length && node ? (parseMove((node as StudyNode).move) ?? null) : null;
  // Spoken moves: the move of the node reached, each time it changes; opening a chapter says nothing.
  const pathKey = path.join('.');
  const spokenChapter = useRef<string | null>(null);
  useEffect(() => {
    const opened = spokenChapter.current !== (chapter?.id ?? null);
    spokenChapter.current = chapter?.id ?? null;
    if (opened || !lastMove || !start || !tree) return;
    sayMove('review', positionAt(start, tree, path.slice(0, -1)), lastMove, 'other');
  }, [pathKey, chapter?.id]);

  /** Applies an edit of the author and saves it shortly after, unless it would make the chapter too big. */
  const edit = (next: StudyRoot, nextPath: Path = path) => {
    if (!chapter || !study) return;
    if (!chapterFits(next)) return setNotice(errorText(t, 'chapterTooLarge'));
    setRoot(next);
    setPath(nextPath);
    pending.current = { url: `/api/studies/${study.id}/chapters/${chapter.id}`, root: next };
    setSaveState('saving');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => flush(), SAVE_DELAY_MS);
  };

  const editTo = (next: { root: StudyRoot; path: Path }) => edit(next.root, next.path);

  const onMove = (move: Move) => {
    if (!tree) return;
    const next = addMove(tree, path, moveToString(move));
    if (next.root === tree) setPath(next.path);
    else edit(next.root, next.path);
  };

  const onDraw = (shape: Shape) => {
    if (!tree || !node) return;
    const shapes = toggleShape(node.shapes, toStudyShape(shape, color));
    if (shapes === 'limit') return setNotice(t.study.limit(STUDY_ARROWS_MAX, STUDY_SQUARES_MAX));
    edit(updateAt(tree, path, (n) => ({ ...n, shapes })));
  };

  // Read when the player moves to another point of the chapter, not on every key of a comment being written.
  const where = useMemo(() => {
    if (!start || !tree || !node || !position) return null;
    const parts: string[] = [];
    const move = path.length ? parseMove((node as StudyNode).move) : undefined;
    parts.push(move ? t.blind.atMove(path.length, describeMove(speaker, positionAt(start, tree, path.slice(0, -1)), move)) : t.blind.atStart);
    if (node.comment) parts.push(t.blind.comment(node.comment));
    if (node.shapes.length) parts.push(t.blind.drawings(describeShapes(speaker, node.shapes)));
    if (node.children.length > 1) {
      const options = node.children.map((child, index) => t.blind.option(index + 1, describeMove(speaker, position, parseMove(child.move)!)));
      parts.push(t.blind.variations(listText(t, options)));
    }
    return parts.join(' ');
  }, [path.join('.'), chapter?.id, tree !== null]);

  /** The study's own typed commands: reading and drawing the shapes, entering a variation. */
  const studyCommand = (text: string): string | null => {
    if (!tree || !node) return null;
    const words = normalize(text).split(' ');
    const [first = '', second = ''] = words;
    if (words.length === 1 && isWord(speaker, 'drawings', first)) return node.shapes.length ? t.blind.drawings(describeShapes(speaker, node.shapes)) : t.blind.noDrawings;
    if (words.length === 2 && isWord(speaker, 'variation', first) && /^\d+$/.test(second)) {
      const index = Number(second) - 1;
      if (!node.children[index]) return t.blind.noVariation;
      setPath([...path, index]);
      return '';
    }
    if (words.length === 1 && isWord(speaker, 'clear', first)) {
      if (!editable) return t.blind.notAuthor;
      edit(updateAt(tree, path, (n) => ({ ...n, shapes: [] })));
      return t.blind.cleared;
    }
    const shape = parseDrawing(speaker, text, color);
    if (!shape) return null;
    if (!editable) return t.blind.notAuthor;
    const shapes = toggleShape(node.shapes, shape);
    if (shapes === 'limit') return t.study.limit(STUDY_ARROWS_MAX, STUDY_SQUARES_MAX);
    edit(updateAt(tree, path, (n) => ({ ...n, shapes })));
    return (shapes.length < node.shapes.length ? t.blind.erased : t.blind.drawn)(describeShapes(speaker, [shape]));
  };

  useEffect(() => {
    if (!tree) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      const here = nodeAt(tree, path);
      const keys: Record<string, Path> = {
        ArrowLeft: path.slice(0, -1),
        ArrowRight: here?.children.length ? [...path, 0] : path,
        ArrowUp: [],
        Home: [],
        ArrowDown: lineEnd(tree, path),
        End: lineEnd(tree, path),
      };
      const next = keys[event.key];
      if (!next) return;
      event.preventDefault();
      setPath(next);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tree, path]);

  if (failed && !study) {
    return (
      <main class="page-small box box-pad page">
        <h1 class="box__top">{t.study.title}</h1>
        <p class="ligungi-error">{failed}</p>
        <p>
          <a href="/study">{t.study.backToList}</a>
        </p>
      </main>
    );
  }

  const chapterIndex = study && chapter ? study.chapters.findIndex((c) => c.id === chapter.id) : -1;
  const counts = node ? shapeCounts(node.shapes) : { arrows: 0, squares: 0 };
  const previousChapter = study && chapterIndex > 0 ? study.chapters[chapterIndex - 1] : undefined;
  const nextChapter = study && chapterIndex >= 0 ? study.chapters[chapterIndex + 1] : undefined;
  const chapterStep = (target: { id: string } | undefined, label: string, name: string, icon: string) =>
    study && target ? (
      <a class="button button-empty text" data-icon={icon} title={name} aria-label={name} href={`/study/${study.id}?chapter=${target.id}`}>
        {label}
      </a>
    ) : (
      <button type="button" class="button button-empty text" data-icon={icon} title={name} aria-label={name} disabled>
        {label}
      </button>
    );

  return (
    <main class={`analyse variant-crazyhouse ligungi-study${tap.strip ? ' ligungi-has-strip' : ''}`}>
      <div class="analyse__side">
        {study && (
          <div class="game__meta ligungi-study__meta">
            <section>
              <div class="game__meta__infos" data-icon={icons.StudyBoard}>
                <div>
                  <h1 class="ligungi-study__title">{study.title}</h1>
                  <div class="ligungi-study__by">
                    {t.study.by(<a href={`/@/${study.owner.name}`}>{study.owner.name}</a>)} · {t.study.visibilities[study.visibility]}
                  </div>
                </div>
              </div>
            </section>
            {study.hidden && <section class="ligungi-error">{t.study.hiddenNotice}</section>}
            {study.description && <section class="ligungi-study__description">{study.description}</section>}
            {editable && (
              <section>
                <button type="button" class="button button-empty text" data-icon={icons.Gear} onClick={() => setModal('settings')}>
                  {t.study.settings}
                </button>
              </section>
            )}
          </div>
        )}
        {study && (
          <nav class="ligungi-study__chapters box" aria-label={t.study.chapters}>
            <h2>{t.study.chapters}</h2>
            <ol>
              {study.chapters.map((c, i) => (
                <li key={c.id}>
                  <a href={`/study/${study.id}?chapter=${c.id}`} aria-current={c.id === chapterId ? 'page' : undefined} class={c.id === chapterId ? 'active' : ''}>
                    <span class="ligungi-study__chapter-number">{i + 1}</span>
                    {c.name}
                  </a>
                </li>
              ))}
            </ol>
            {study.chapters.length > 1 && chapter && (
              <div class="ligungi-study__step">
                {chapterStep(previousChapter, t.study.previous, t.study.previousChapter, icons.JumpPrev)}
                {chapterStep(nextChapter, t.study.next, t.study.nextChapter, icons.JumpNext)}
              </div>
            )}
            {editable && chapter && (
              <div class="ligungi-study__step">
                <button
                  type="button"
                  class="button button-empty text"
                  data-icon={icons.PlusButton}
                  title={t.study.newChapter}
                  aria-label={t.study.newChapter}
                  onClick={() => setModal('newChapter')}
                >
                  {t.study.new}
                </button>
                <button
                  type="button"
                  class="button button-empty text"
                  data-icon={icons.Pencil}
                  title={t.study.editChapter}
                  aria-label={t.study.editChapter}
                  onClick={() => setModal('chapter')}
                >
                  {t.study.edit}
                </button>
              </div>
            )}
          </nav>
        )}
        {position && (
          <div class="ligungi-panels box">
            <DraftPanel position={position} names={t.colors} />
            <TowerPanel position={position} square={inspected} training />
          </div>
        )}
      </div>
      <div class="analyse__board main-board" aria-hidden={screenReader ? 'true' : undefined}>
        {notice && (
          <p class="ligungi-study__toast" role="status">
            {notice}
          </p>
        )}
        {hands && position && (
          <BoardView
            training
            position={position}
            orientation={orientation}
            movableColor={editable && !drawMode ? 'both' : null}
            moves={legal}
            lastMove={lastMove}
            onMove={onMove}
            handElements={hands}
            inspector={tap.balloon}
            inspectSelection={tap.balloon}
            onInspect={setInspected}
            shapes={node?.shapes ?? []}
            onDraw={editable ? onDraw : null}
            drawColor={color}
            drawMode={editable && drawMode}
          />
        )}
      </div>
      {tap.strip && position && <TowerStrip position={position} square={inspected} />}
      <div class="pocket is2d pocket-top" ref={topHand} aria-hidden={screenReader ? 'true' : undefined} />
      <div class="pocket is2d pocket-bottom" ref={bottomHand} aria-hidden={screenReader ? 'true' : undefined} />
      <div class="analyse__tools">
        <div class="analyse__moves areplay">
          {start && tree && <StudyMoves start={start} root={tree} current={path} onSelect={setPath} empty={editable ? t.study.emptyAuthor : t.study.empty} />}
        </div>
        {node && tree && editable && (
          <div class="ligungi-study__editor">
            <Field label={path.length ? t.study.moveComment : t.study.chapterIntro} htmlFor="study-comment">
              <textarea
                id="study-comment"
                class="form-control"
                rows={2}
                maxLength={STUDY_COMMENT_MAX}
                value={node.comment}
                onInput={(e) => edit(updateAt(tree, path, (n) => ({ ...n, comment: (e.target as HTMLTextAreaElement).value })))}
              />
            </Field>
            <div class="ligungi-study__draw" role="group" aria-label={t.study.draw}>
              <span class="ligungi-study__draw-label">{t.study.draw}</span>
              {SHAPE_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  class={`ligungi-study__swatch gg-brush-${c}`}
                  aria-pressed={c === color}
                  aria-label={t.study.colors[c]}
                  title={t.study.colors[c]}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
            <div class="ligungi-study__actions">
              <span class="ligungi-study__count">{t.study.counts(counts.arrows, STUDY_ARROWS_MAX, counts.squares, STUDY_SQUARES_MAX)}</span>
              <button
                type="button"
                class="button button-empty ligungi-study__clear"
                data-icon={icons.Trash}
                title={t.study.clearShapes}
                aria-label={t.study.clearShapes}
                disabled={node.shapes.length === 0}
                onClick={() => edit(updateAt(tree, path, (n) => ({ ...n, shapes: [] })))}
              />
            </div>
            <div class="ligungi-study__mode">
              <Toggle id="study-draw-mode" checked={drawMode} onChange={setDrawMode} label={t.study.drawMode} />
              <label for="study-draw-mode">{t.study.drawMode}</label>
            </div>
            <p class="ligungi-study__hint">{drawMode ? t.study.drawModeHelp : t.study.drawHelp}</p>
            <div class="ligungi-study__actions">
              {path.some((step) => step > 0) && (
                <button type="button" class="button button-empty text" onClick={() => editTo(promote(tree, path))}>
                  {t.study.promote}
                </button>
              )}
              {path.length > 0 && (
                <button type="button" class="button button-empty text" data-icon={icons.Trash} onClick={() => editTo(deleteAt(tree, path))}>
                  {t.study.deleteFromHere}
                </button>
              )}
              <span class={`ligungi-study__save${saveState === 'error' ? ' error' : ''}`} role="status">
                {t.study.saveStates[saveState]}
              </span>
            </div>
          </div>
        )}
        {node && !editable && node.comment && (
          <div class="ligungi-study__editor">
            <p class="ligungi-study__comment">{node.comment}</p>
          </div>
        )}
      </div>
      <div class="analyse__controls analyse-controls">
        <div class="features">
          <button type="button" class="fbt" title={t.common.flip} data-icon={icons.ChasingArrows} onClick={() => setOrientation((o) => opposite(o))} />
        </div>
        <div class="jumps">
          <button type="button" class="fbt" title={t.common.first} data-icon={icons.JumpFirst} onClick={() => setPath([])} />
          <button type="button" class="fbt" title={t.common.prev} data-icon={icons.JumpPrev} onClick={() => setPath(path.slice(0, -1))} />
          <button type="button" class="fbt" title={t.common.next} data-icon={icons.JumpNext} onClick={() => node?.children.length && setPath([...path, 0])} />
          <button type="button" class="fbt" title={t.common.last} data-icon={icons.JumpLast} onClick={() => tree && setPath(lineEnd(tree, path))} />
        </div>
      </div>
      <div class="analyse__underboard">
        {screenReader && position && tree && (
          <BlindPanel
            key={chapter?.id}
            title={t.blind.boardTitle}
            position={position}
            legal={legal}
            onMove={editable ? onMove : undefined}
            positions={NO_MOVES}
            moves={NO_MOVES}
            where={where}
            navigation={{
              prev: () => setPath(path.slice(0, -1)),
              next: () => node?.children.length && setPath([...path, 0]),
              first: () => setPath([]),
              end: () => setPath(lineEnd(tree, path)),
            }}
            orientation={orientation}
            notice={notice}
            onCommand={studyCommand}
            help={t.blind.studyHelp}
          />
        )}
        {study && position && (
          <div class="ligungi-study__under box">
            <div class="ligungi-study__actions">
              <a class="button button-empty text" data-icon={icons.Microscope} href={`/analysis?fen=${encodeURIComponent(toFen(position))}`}>
                {t.study.openInAnalysis}
              </a>
              {user && !editable && (
                <ReportButton
                  username={study.owner.name}
                  studyId={study.id}
                  {...(chapter ? { chapter: { id: chapter.id, name: chapter.name, path: path.join('.') } } : {})}
                />
              )}
              <span class="ligungi-study__updated">{t.study.updated(timeAgo(t, study.updatedAt))}</span>
            </div>
          </div>
        )}
        {study && moderator && !editable && (
          <StudyModTools
            study={study}
            chapterId={chapter?.id ?? null}
            onChange={(hidden) => (hidden === null ? navigate('/study') : setStudy({ ...study, hidden }))}
            onCleared={() => root && setRoot(withoutShapes(root))}
          />
        )}
      </div>
      {study && modal === 'settings' && (
        <StudySettingsModal
          study={study}
          onClose={() => setModal(null)}
          onSaved={(saved) => {
            setStudy(saved);
            setModal(null);
          }}
        />
      )}
      {study && modal === 'newChapter' && (
        <NewChapterModal
          study={study}
          onClose={() => setModal(null)}
          onCreated={(created) => {
            setStudy({ ...study, chapters: [...study.chapters, { id: created.id, name: created.name }] });
            setModal(null);
            navigate(`/study/${study.id}?chapter=${created.id}`);
          }}
        />
      )}
      {study && chapter && modal === 'chapter' && (
        <ChapterSettingsModal
          study={study}
          chapter={chapter}
          onClose={() => setModal(null)}
          onMoved={setStudy}
          onSaved={(name, side) => {
            setStudy({ ...study, chapters: study.chapters.map((c) => (c.id === chapter.id ? { ...c, name } : c)) });
            setChapter({ ...chapter, name, orientation: side });
            setOrientation(side);
            setModal(null);
          }}
          onDeleted={(next) => {
            pending.current = null;
            setStudy(next);
            setModal(null);
            navigate(`/study/${study.id}`, true);
          }}
        />
      )}
    </main>
  );
};
