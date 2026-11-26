import { legalMoves, moveToString, opposite, parseMove, toFen, type Move } from '@ligungi/engine';
import type { Shape } from '@ligungi/board';
import {
  SHAPE_COLORS,
  STUDY_ARROWS_MAX,
  STUDY_COMMENT_MAX,
  STUDY_SQUARES_MAX,
  shapeCounts,
  toggleShape,
  type ShapeColor,
  type StudyNode,
  type StudyShape,
} from '@ligungi/protocol';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { sayMove } from '../blind/speech.ts';
import { BlindPanel } from '../blind/BlindPanel.tsx';
import { BoardView } from '../components/BoardView.tsx';
import { DraftPanel, TowerPanel, TowerStrip } from '../components/Panels.tsx';
import { ReportButton } from '../mod/ReportButton.tsx';
import { ChapterSettingsModal, NewChapterModal, StudySettingsModal } from '../study/StudyForms.tsx';
import { StudyLike } from '../study/StudyLike.tsx';
import { StudyMoves } from '../study/StudyMoves.tsx';
import { Field, Toggle } from '../components/ui.tsx';
import { describeMove, describeShapes, isWord, normalize, parseDrawing, type Speaker } from '../blind/blind.ts';
import { listText, timeAgo, usePieceNames, useT } from '../i18n/index.ts';
import { icons } from '../icons.ts';
import { prefs } from '../prefs/prefs.ts';
import { navigate, useLocation } from '../core/router.ts';
import { session } from '../core/session.ts';
import { useStore } from '../core/store.ts';
import { useTowerTap } from '../prefs/towerTap.ts';
import { StudyModTools } from './study/StudyModTools.tsx';
import { useStudyChapter } from './study/useStudyChapter.ts';
import { addMove, deleteAt, lineEnd, nodeAt, positionAt, promote, updateAt, withoutShapes, type Path } from '../study/studyTree.ts';

const NOTICE_MS = 4000;

/** The study reads each move through `where`, so the screen reader mode gets no move list to announce. */
const NO_MOVES: readonly never[] = [];

const toStudyShape = (shape: Shape, color: ShapeColor): StudyShape =>
  shape.kind === 'arrow' ? { kind: 'arrow', from: shape.from, to: shape.to, color } : { kind: 'square', square: shape.square, color };

export const StudyPage = ({ id }: { id: string }) => {
  const t = useT();
  const { search } = useLocation();
  const { user, moderator } = useStore(session);
  const [notice, setNotice] = useState<string | null>(null);
  const {
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
    editTo,
    discard,
  } = useStudyChapter(id, new URLSearchParams(search).get('chapter'), setNotice);
  const [color, setColor] = useState<ShapeColor>('green');
  const [drawMode, setDrawMode] = useState(false);
  const [modal, setModal] = useState<'settings' | 'chapter' | 'newChapter' | null>(null);
  const [inspected, setInspected] = useState<number | null>(null);
  const [hands, setHands] = useState<{ top: HTMLElement; bottom: HTMLElement } | null>(null);
  const topHand = useRef<HTMLDivElement>(null);
  const bottomHand = useRef<HTMLDivElement>(null);
  const { screenReader } = useStore(prefs);
  const tap = useTowerTap(true);
  const speaker: Speaker = { t, names: usePieceNames() };

  useEffect(() => {
    if (topHand.current && bottomHand.current) setHands({ top: topHand.current, bottom: bottomHand.current });
  }, []);

  useEffect(() => {
    if (!notice) return;
    const clear = window.setTimeout(() => setNotice(null), NOTICE_MS);
    return () => window.clearTimeout(clear);
  }, [notice]);

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
            <section class="ligungi-study__likes">
              <StudyLike study={study} onChange={(likes) => setStudy({ ...study, ...likes })} />
            </section>
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
            discard();
            setStudy(next);
            setModal(null);
            navigate(`/study/${study.id}`, true);
          }}
        />
      )}
    </main>
  );
};
