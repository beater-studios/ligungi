import { applyMove, legalMoves, moveToString, parseMove, parseSquare, toFen, type Move, type Position } from '@ligungi/engine';
import {
  LESSON_STAGES,
  LESSON_STARS_MAX,
  lessonDone,
  lessonStars,
  playLesson,
  startLesson,
  type LessonExercise,
  type LessonStage,
  type LessonState,
} from '@ligungi/protocol';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { BlindPanel } from '../components/BlindPanel.tsx';
import { BoardView } from '../components/BoardView.tsx';
import { Stars } from '../components/Stars.tsx';
import { useT } from '../i18n/index.ts';
import { squareText } from '../blind.ts';
import { icons } from '../icons.ts';
import { useLessonProgress, type LessonProgress } from '../lessonProgress.ts';
import { prefs } from '../prefs.ts';
import { navigate } from '../router.ts';
import { session } from '../session.ts';
import { playSound } from '../sound.ts';
import { useStore } from '../store.ts';

const DEFENSE_DELAY_MS = 450;
const WRONG_DELAY_MS = 900;

const earned = (stage: LessonStage, progress: LessonProgress | null): number =>
  stage.exercises.reduce((sum, exercise) => sum + (progress?.[exercise.id] ?? 0), 0);

/** The first exercise of a stage without three stars, so returning to a stage picks up where it was left. */
const resumeIndex = (stage: LessonStage, progress: LessonProgress | null): number => {
  const index = stage.exercises.findIndex((exercise) => (progress?.[exercise.id] ?? 0) < LESSON_STARS_MAX);
  return index === -1 ? 0 : index;
};

const LoginLine = () => {
  const t = useT();
  const { user, loaded } = useStore(session);
  if (!loaded || user) return null;
  return (
    <p class="ligungi-lessons__login">
      <a href="/login">{t.lessons.loginToSave}</a>
    </p>
  );
};

/** The stages with the stars earned in each, as a path to follow. */
const LessonMap = ({ progress }: { progress: LessonProgress | null }) => {
  const t = useT();
  return (
    <main class="ligungi-page ligungi-lessons">
      <header class="ligungi-lessons__head">
        <h1>{t.lessons.title}</h1>
        <p>{t.lessons.intro}</p>
        <LoginLine />
      </header>
      <ol class="ligungi-lessons__stages">
        {LESSON_STAGES.map((stage, i) => {
          const total = stage.exercises.length * LESSON_STARS_MAX;
          const stars = earned(stage, progress);
          return (
            <li key={stage.id}>
              <a class="ligungi-card ligungi-lesson-stage" href={`/lessons/${stage.id}`}>
                <span class="ligungi-lesson-stage__number">{t.lessons.stage(i + 1)}</span>
                <strong class="ligungi-lesson-stage__title">{t.lessons.stages[stage.id].title}</strong>
                <span class="ligungi-lesson-stage__intro">{t.lessons.stages[stage.id].intro}</span>
                <span class="ligungi-lesson-stage__dots" aria-hidden="true">
                  {stage.exercises.map((exercise) => (
                    <i key={exercise.id} class={`is-${progress?.[exercise.id] ?? 0}`} />
                  ))}
                </span>
                <span class="ligungi-lesson-stage__footer">
                  <Stars filled={stars === 0 ? 0 : stars === total ? 3 : stars * 3 >= total * 2 ? 2 : 1} label={t.lessons.stars(stars, total)} />
                  <span>{t.lessons.stars(stars, total)}</span>
                  <span class="button button-empty">{stars === 0 ? t.lessons.start : stars === total ? t.lessons.review : t.lessons.continue}</span>
                </span>
              </a>
            </li>
          );
        })}
      </ol>
    </main>
  );
};

/**
 * One exercise: the goal, a hint, the moves made against the par, and the board. Outside mates the opponent stays
 * still; in mates the computer answers with the longest defense, checked in the mate worker like the mate puzzles.
 */
const Exercise = ({ stage, index, progress, record }: { stage: LessonStage; index: number; progress: LessonProgress | null; record: (id: string, stars: number) => void }) => {
  const t = useT();
  const exercise: LessonExercise = stage.exercises[index]!;
  const stageNumber = LESSON_STAGES.indexOf(stage) + 1;
  const [state, setState] = useState<LessonState>(() => startLesson(exercise));
  const [lastMove, setLastMove] = useState<Move | null>(null);
  const [stars, setStars] = useState<number | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const [waiting, setWaiting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [hint, setHint] = useState(false);
  const [hands, setHands] = useState<{ top: HTMLElement; bottom: HTMLElement } | null>(null);
  const top = useRef<HTMLDivElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const worker = useRef<Worker | null>(null);
  const request = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const player = startLesson(exercise).position.turn;
  const goal = exercise.goal;
  const { screenReader } = useStore(prefs);
  // The moves of this try, for the screen reader mode's announcements; a restart starts a new try.
  const [history, setHistory] = useState<{ positions: Position[]; moves: Move[] }>(() => ({ positions: [startLesson(exercise).position], moves: [] }));
  const [round, setRound] = useState(0);
  const played = (move: Move, after: Position) => setHistory((h) => ({ positions: [...h.positions, after], moves: [...h.moves, move] }));

  useEffect(() => {
    if (top.current && bottom.current) setHands({ top: top.current, bottom: bottom.current });
    worker.current = new Worker(new URL('../mate.worker.ts', import.meta.url), { type: 'module' });
    return () => {
      worker.current?.terminate();
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const restart = () => {
    if (timer.current) clearTimeout(timer.current);
    request.current++;
    setState(startLesson(exercise));
    setHistory({ positions: [startLesson(exercise).position], moves: [] });
    setRound((n) => n + 1);
    setLastMove(null);
    setStars(null);
    setMistakes(0);
    setWaiting(false);
    setMessage(null);
    setHint(false);
  };
  const finish = (moves: number, wrong: number) => {
    const result = lessonStars(exercise, moves, wrong);
    setStars(result);
    setMessage(t.lessons.done);
    record(exercise.id, result);
    playSound('victory');
  };

  const mateMove = (before: LessonState, after: LessonState, move: Move) => {
    if (goal.kind !== 'mate') return;
    const left = goal.moves - before.moves;
    setWaiting(true);
    const ticket = ++request.current;
    const listener = (event: MessageEvent<{ id: number; check: boolean; ok: boolean; defense: string | null }>) => {
      if (event.data.id !== ticket) return;
      worker.current?.removeEventListener('message', listener);
      if (request.current !== ticket) return;
      if (!event.data.ok) {
        setMistakes((n) => n + 1);
        setMessage(event.data.check ? t.lessons.mateWrong : t.lessons.mateNotCheck);
        playSound('error');
        timer.current = setTimeout(() => {
          setState(before);
          setHistory((h) => ({ positions: h.positions.slice(0, -1), moves: h.moves.slice(0, -1) }));
          setLastMove(null);
          setWaiting(false);
        }, WRONG_DELAY_MS);
        return;
      }
      const defense = event.data.defense ? parseMove(event.data.defense) : null;
      if (!defense) {
        setWaiting(false);
        finish(after.moves, mistakes);
        return;
      }
      setMessage(t.lessons.mateDefends);
      timer.current = setTimeout(() => {
        playSound(defense.kind === 'move' && defense.action === 'capture' ? 'capture' : 'move');
        const defended = applyMove(after.position, defense);
        setState({ ...after, position: defended });
        played(defense, defended);
        setLastMove(defense);
        setMessage(null);
        setWaiting(false);
      }, DEFENSE_DELAY_MS);
    };
    worker.current?.addEventListener('message', listener);
    worker.current?.postMessage({ id: ticket, fen: toFen(before.position), move: moveToString(move), moves: left });
  };

  const onMove = (move: Move) => {
    const after = playLesson(exercise, state, move);
    playSound(move.kind === 'move' && move.action === 'capture' ? 'capture' : 'move');
    setState(after);
    played(move, after.position);
    setLastMove(move);
    if (goal.kind === 'mate') return mateMove(state, after, move);
    if (lessonDone(exercise, after, player)) finish(after.moves, mistakes);
  };

  const finished = stars !== null;
  // Kept per position: the board takes a new list as a change, which would drop the piece the player has selected.
  const allMoves = useMemo(() => (finished || waiting ? [] : legalMoves(state.position)), [state, finished, waiting]);
  const boardMoves = useMemo(() => allMoves.filter((move) => move.kind !== 'done'), [allMoves]);
  const targets = useMemo(
    () => (goal.kind === 'targets' ? goal.squares.filter((square) => !state.collected.includes(square)).map((square) => parseSquare(square)!) : []),
    [state.collected],
  );
  // Only the exercise about ending the draft offers "done": declared early in another, it would leave no move.
  const doneAvailable = goal.kind === 'finishDraft' && allMoves.some((move) => move.kind === 'done');
  const nextStage = LESSON_STAGES[stageNumber];
  const next =
    index + 1 < stage.exercises.length ? `/lessons/${stage.id}/${index + 2}` : nextStage ? `/lessons/${nextStage.id}/1` : null;
  const text = t.lessons.exercises[exercise.id as keyof typeof t.lessons.exercises];

  return (
    <main class="ligungi-page ligungi-lesson">
      <nav class="ligungi-lesson__crumbs">
        <a href="/lessons" data-icon={icons.Back} class="text">
          {t.lessons.map}
        </a>
      </nav>
      <div class="ligungi-lesson__layout">
        <section class="ligungi-card ligungi-lesson__panel">
          <p class="ligungi-lesson__stage">
            {t.lessons.stage(stageNumber)} · {t.lessons.exerciseOf(index + 1, stage.exercises.length)}
          </p>
          <h1>{t.lessons.stages[stage.id].title}</h1>
          <ol class="ligungi-lesson__steps">
            {stage.exercises.map((other, i) => (
              <li key={other.id}>
                <a href={`/lessons/${stage.id}/${i + 1}`} class={`${i === index ? 'is-current ' : ''}is-${progress?.[other.id] ?? 0}`} aria-current={i === index ? 'step' : undefined}>
                  {i + 1}
                </a>
              </li>
            ))}
          </ol>
          <p class="ligungi-lesson__instruction">{text?.instruction}</p>
          {hint ? (
            <p class="ligungi-lesson__hint">{text?.hint}</p>
          ) : (
            !finished && (
              <button type="button" class="button button-empty text" data-icon={icons.InfoCircle} onClick={() => setHint(true)}>
                {t.lessons.hint}
              </button>
            )
          )}
          <p class="ligungi-lesson__goal">
            {goal.kind === 'mate' ? t.lessons.mateStars : t.lessons.par(exercise.par)} · {t.lessons.moves(state.moves)}
          </p>
          {message && (
            <p class={`ligungi-lesson__message${finished ? ' is-done' : ''}`} role="status">
              {message}
            </p>
          )}
          {stars !== null && <Stars filled={stars} label={t.lessons.stars(stars, LESSON_STARS_MAX)} />}
          <div class="ligungi-lesson__actions">
            {doneAvailable && (
              <button type="button" class="button" onClick={() => onMove({ kind: 'done' })}>
                {t.lessons.declareDone}
              </button>
            )}
            {finished &&
              (next ? (
                <a class="button" href={next}>
                  {index + 1 < stage.exercises.length ? t.lessons.next : t.lessons.nextStage}
                </a>
              ) : (
                <p class="ligungi-lesson__all-done">
                  <a href="/puzzles">{t.lessons.allDone}</a>
                </p>
              ))}
            <button type="button" class="button button-empty" onClick={restart}>
              {t.lessons.restart}
            </button>
          </div>
          <LoginLine />
        </section>
        <div class="ligungi-lesson__board" aria-hidden={screenReader ? 'true' : undefined}>
          <div class="ligungi-lesson__hand" ref={top} />
          {hands && (
            <BoardView
              position={state.position}
              orientation={player}
              movableColor={finished || waiting ? null : player}
              moves={boardMoves}
              lastMove={lastMove}
              handElements={hands}
              targets={targets}
              onMove={onMove}
            />
          )}
          <div class="ligungi-lesson__hand" ref={bottom} />
        </div>
      </div>
      {screenReader && (
        <BlindPanel
          key={round}
          position={state.position}
          legal={doneAvailable ? allMoves : boardMoves}
          onMove={onMove}
          positions={history.positions}
          moves={history.moves}
          orientation={player}
          goal={[text?.instruction, targets.length ? t.blind.targets(t.blind.list(targets.map(squareText))) : ''].filter(Boolean).join(' ')}
          notice={message}
          result={finished ? `${message ?? ''} ${t.lessons.stars(stars, LESSON_STARS_MAX)}`.trim() : null}
          timeInfo={`${goal.kind === 'mate' ? t.lessons.mateStars : t.lessons.par(exercise.par)}. ${t.lessons.moves(state.moves)}.`}
        />
      )}
    </main>
  );
};

/** `/lessons`: the map of stages. `/lessons/<stage>/<n>`: one exercise; without `n`, the first not yet mastered. */
export const LessonsPage = ({ stage: stageId, exercise }: { stage?: string; exercise?: number }) => {
  const t = useT();
  const { progress, record } = useLessonProgress();
  const stage = LESSON_STAGES.find((candidate) => candidate.id === stageId);

  useEffect(() => {
    if (stage && exercise === undefined && progress) navigate(`/lessons/${stage.id}/${resumeIndex(stage, progress) + 1}`, true);
  }, [stage?.id, exercise, progress !== null]);

  if (stageId === undefined) return <LessonMap progress={progress} />;
  if (!stage || (exercise !== undefined && !stage.exercises[exercise - 1])) {
    return (
      <main class="ligungi-page">
        <p class="ligungi-notice">{t.lessons.notFound}</p>
      </main>
    );
  }
  if (exercise === undefined) return <main class="ligungi-page" />;
  return <Exercise key={`${stage.id}-${exercise}`} stage={stage} index={exercise - 1} progress={progress} record={record} />;
};
