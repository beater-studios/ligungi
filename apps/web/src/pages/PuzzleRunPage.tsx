import { opposite, type Color, type Move } from '@ligungi/engine';
import { STORM_PENALTY_MS, STORM_TIME_MS, stormBonus, type PuzzleRunKind } from '@ligungi/protocol';
import { useEffect, useRef, useState } from 'preact/hooks';
import { api } from '../core/api.ts';
import { MiniBoard } from '../components/MiniBoard.tsx';
import { RoundLayout, type RoundPlayer } from '../game/RoundLayout.tsx';
import { formatClock, useT } from '../i18n/index.ts';
import { icons } from '../icons.ts';
import { runRecords, usePuzzleRuns, type RunRecords } from '../puzzles/puzzleRuns.ts';
import { usePuzzleEntries, usePuzzleSolver, type PuzzleEntry } from '../puzzles/puzzleSolver.ts';
import { session } from '../core/session.ts';
import { playSound } from '../sound.ts';
import { useStore } from '../core/store.ts';
import { useTimers } from '../core/hooks.ts';
import { Records } from '../puzzles/Records.tsx';

type Outcome = 'won' | 'lost' | 'skipped';

interface Played {
  readonly entry: PuzzleEntry;
  readonly outcome: Outcome;
}

/** Everything a run changes as it goes; kept in a ref so replies and timers always see the latest. */
interface RunState {
  played: Played[];
  combo: number;
  bestCombo: number;
  correct: number;
  wrong: number;
  /** performance.now() when Storm's clock runs out; 0 until the first move starts it. */
  endAt: number;
  /** Storm's time left when the run ended. */
  leftAtEnd: number;
  skipUsed: boolean;
  over: boolean;
}

const fresh = (): RunState => ({ played: [], combo: 0, bestCombo: 0, correct: 0, wrong: 0, endAt: 0, leftAtEnd: STORM_TIME_MS, skipUsed: false, over: false });

const ANSWER_DELAY_MS: Readonly<Record<PuzzleRunKind, number>> = { streak: 450, storm: 250 };
/** Pause after a solved puzzle, so its last move is seen, before the next one. */
const NEXT_DELAY_MS: Readonly<Record<PuzzleRunKind, number>> = { streak: 700, storm: 250 };
/** Storm moves on after a wrong move once it has been seen. */
const WRONG_DELAY_MS = 500;
const FLASH_MS = 900;

const comboSteps = (combo: number): { from: number; to: number } => {
  const steps = [0, 5, 12, 20, 30];
  for (let i = 1; i < steps.length; i++) if (combo < steps[i]!) return { from: steps[i - 1]!, to: steps[i]! };
  const from = 30 + Math.floor((combo - 30) / 10) * 10;
  return { from, to: from + 10 };
};

/**
 * Puzzle Streak and Puzzle Storm. Streak: harder and harder puzzles, no clock, until the first wrong move, with one skip.
 * Storm: as many as possible in 3 minutes from the first move; a wrong move costs 10 seconds and moves on, and combos of
 * correct moves add time. The server draws the puzzles along a difficulty curve; runs do not touch the puzzle rating.
 */
export const PuzzleRunPage = ({ kind }: { kind: PuzzleRunKind }) => {
  const t = useT();
  const { user, loaded } = useStore(session);
  const { view, record } = usePuzzleRuns();
  const entries = usePuzzleEntries()?.byId ?? null;
  const [sequence, setSequence] = useState<readonly PuzzleEntry[] | null>(null);
  const [index, setIndex] = useState(0);
  const [clockOn, setClockOn] = useState(false);
  const [flash, setFlash] = useState<{ text: string; good: boolean } | null>(null);
  const [before, setBefore] = useState<RunRecords | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [error, setError] = useState(false);
  const [, setTick] = useState(0);
  const run = useRef<RunState>(fresh());
  const { later, clear: clearTimers } = useTimers();
  const refresh = () => setTick((n) => n + 1);

  const showFlash = (text: string, good: boolean) => {
    setFlash({ text, good });
    later(() => setFlash(null), FLASH_MS);
  };

  const finish = () => {
    const state = run.current;
    if (state.over) return;
    state.over = true;
    state.leftAtEnd = kind === 'storm' && state.endAt > 0 ? Math.max(0, state.endAt - performance.now()) : state.leftAtEnd;
    clearTimers();
    setClockOn(false);
    solver.stop();
    const score = state.played.filter((played) => played.outcome === 'won').length;
    if (view) setBefore(runRecords(view, kind));
    record({ kind, score, at: Date.now() });
    playSound('notify');
    refresh();
  };

  /** Records how the current puzzle went as soon as it is decided, so it counts even if time runs out before the next. */
  const settle = (outcome: Outcome) => {
    const entry = sequence?.[index];
    if (entry && !run.current.over) run.current.played = [...run.current.played, { entry, outcome }];
  };

  const next = () => {
    if (run.current.over) return;
    if (!sequence || index + 1 >= sequence.length) return finish();
    setIndex(index + 1);
  };

  const solver = usePuzzleSolver(
    {
      onCorrect: (finished) => {
        const state = run.current;
        state.correct++;
        state.combo++;
        state.bestCombo = Math.max(state.bestCombo, state.combo);
        if (kind === 'storm') {
          const bonus = stormBonus(state.combo);
          if (bonus > 0) {
            state.endAt += bonus * 1000;
            showFlash(t.puzzleRuns.bonus(bonus), true);
          }
        }
        if (finished) {
          settle('won');
          later(next, NEXT_DELAY_MS[kind]);
        }
        refresh();
      },
      onWrong: () => {
        const state = run.current;
        state.wrong++;
        state.combo = 0;
        playSound('error');
        settle('lost');
        if (kind === 'streak') return finish();
        state.endAt -= STORM_PENALTY_MS;
        showFlash(t.puzzleRuns.penalty(STORM_PENALTY_MS / 1000), false);
        later(next, WRONG_DELAY_MS);
        refresh();
      },
    },
    ANSWER_DELAY_MS[kind],
  );

  // The clock's interval outlives renders: it ends the run with the latest render's view of it.
  const latestFinish = useRef(finish);
  latestFinish.current = finish;

  const start = () => {
    clearTimers();
    run.current = fresh();
    setClockOn(false);
    setFlash(null);
    setBefore(null);
    setSequence(null);
    setIndex(0);
    setError(false);
  };

  // A new run asks the server for its puzzles.
  useEffect(() => {
    if (!entries || sequence) return;
    let alive = true;
    api
      .get<{ ids: string[] }>(`/api/puzzles/sequence?kind=${kind}`)
      .then(({ ids }) => alive && setSequence(ids.map((id) => entries.get(id)).filter((entry): entry is PuzzleEntry => Boolean(entry))))
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, [entries, sequence === null]);

  useEffect(() => {
    const entry = sequence?.[index];
    if (entry && !run.current.over) solver.begin(entry);
  }, [sequence, index]);

  useEffect(() => {
    if (!clockOn) return;
    const id = setInterval(() => {
      if (run.current.endAt - performance.now() <= 0) latestFinish.current();
      else refresh();
    }, 100);
    return () => clearInterval(id);
  }, [clockOn]);

  const onMove = (move: Move) => {
    if (kind === 'storm' && run.current.endAt === 0) {
      run.current.endAt = performance.now() + STORM_TIME_MS;
      setClockOn(true);
    }
    solver.onMove(move);
  };

  // A solved puzzle is already settled and waiting for the next one: skipping then would drop it.
  const canSkip = !run.current.skipUsed && !run.current.over && solver.stage !== 'done';
  const skip = () => {
    if (!canSkip) return;
    run.current.skipUsed = true;
    settle('skipped');
    next();
  };

  const title = kind === 'streak' ? t.puzzleRuns.streak : t.puzzleRuns.storm;
  const entry = solver.entry;
  if (error || !sequence || !entry) {
    return (
      <main class="ligungi-page ligungi-drill-loading">
        <h1>{title}</h1>
        <p>{kind === 'streak' ? t.puzzleRuns.streakIntro : t.puzzleRuns.stormIntro}</p>
        <p class={error ? 'error' : 'ligungi-notice'}>{error ? t.genericError : t.common.loading}</p>
      </main>
    );
  }

  const state = run.current;
  const over = state.over;
  const score = state.played.filter((played) => played.outcome === 'won').length;
  const left = kind !== 'storm' ? 0 : over ? state.leftAtEnd : state.endAt > 0 ? Math.max(0, state.endAt - performance.now()) : STORM_TIME_MS;
  const records = view ? runRecords(view, kind) : null;
  const { info } = entry;
  const solverColor: Color = info.color;
  const { local } = solver;
  const task = info.kind === 'mate' ? t.puzzles.taskMate(solverColor, info.moves) : t.puzzles.taskMaterial(solverColor);
  const last = state.played[state.played.length - 1];
  const lastLost = kind === 'streak' && over && last?.outcome === 'lost' ? last : undefined;
  const allDone = over && state.played.length === sequence.length && (kind === 'storm' ? state.leftAtEnd > 0 : !lastLost);
  const steps = comboSteps(state.combo);
  const players = {
    [solverColor]: { name: t.common.you },
    [opposite(solverColor)]: { name: t.puzzles.opponent },
  } as Record<Color, RoundPlayer>;
  const status = over ? (allDone ? t.puzzleRuns.allDone : kind === 'streak' ? t.puzzleRuns.streakOver : t.puzzleRuns.stormOver) : task;
  const accuracy = state.correct + state.wrong === 0 ? 0 : Math.round((state.correct / (state.correct + state.wrong)) * 100);
  const praise = !over || !before || score === 0 ? null : score > before.ever ? t.puzzleRuns.newRecord : score > before.today ? t.puzzleRuns.bestToday : null;

  return (
    <RoundLayout
      training
      board={{ position: local.position, movableColor: solver.yourTurn && !over ? solverColor : null, moves: over ? [] : solver.moves, lastMove: local.lastMove, onMove }}
      orientation={flipped ? opposite(solverColor) : solverColor}
      players={players}
      turn={over || local.replay.game.outcome ? null : local.position.turn}
      positions={local.replay.positions}
      moves={local.replay.moves}
      ply={local.ply}
      onPly={local.setPly}
      onFlip={() => setFlipped((f) => !f)}
      myTurn={solver.yourTurn && !over}
      status={status}
      gameKey={entry.puzzle.id}
      goal={over ? null : task}
      notice={flash?.text ?? null}
      result={over ? [status, praise, `${t.puzzleRuns.solved}: ${score}.`].filter(Boolean).join(' ') : null}
      timeInfo={[
        kind === 'storm' ? `${t.puzzleRuns.timeLeft}: ${formatClock(left)}.` : '',
        `${t.puzzleRuns.solved}: ${score}.`,
        kind === 'storm' ? `${t.puzzleRuns.combo}: ${state.combo}.` : '',
      ]
        .filter(Boolean)
        .join(' ')}
      controls={
        <>
          {!over && (
            // On phones the card is under the board: the clock, score and combo also sit right below it.
            <div class="ligungi-run__compact" aria-hidden="true">
              {kind === 'storm' && <span class={`ligungi-run__compact-time${left < 20_000 ? ' is-low' : ''}`}>{formatClock(left)}</span>}
              {kind === 'storm' && flash && <span class={`ligungi-run__flash${flash.good ? ' is-good' : ' is-bad'}`}>{flash.text}</span>}
              <span>
                <strong>{score}</strong> {t.puzzleRuns.solved}
              </span>
              {kind === 'storm' && (
                <span>
                  {t.puzzleRuns.combo} <strong>{state.combo}</strong>
                </span>
              )}
            </div>
          )}
          <div class="follow-up">
            {over ? (
              <>
                <button type="button" class="fbt strong glowing" onClick={start}>
                  {t.puzzleRuns.again}
                </button>
                {lastLost && (
                  <a class="fbt" href={`/puzzles/${lastLost.entry.puzzle.id}`}>
                    {t.puzzleRuns.seeSolution}
                  </a>
                )}
              </>
            ) : (
              kind === 'streak' && (
                <button type="button" class="fbt" disabled={!canSkip} title={state.skipUsed ? t.puzzleRuns.skipUsed : undefined} onClick={skip}>
                  {t.puzzleRuns.skip}
                </button>
              )
            )}
          </div>
        </>
      }
      side={
        <section class="ligungi-card ligungi-game-info ligungi-run">
          <h1 class="ligungi-drill__title">{title}</h1>
          {!over && state.played.length === 0 && state.correct + state.wrong === 0 && (
            <p class="ligungi-drill__intro">
              {kind === 'streak' ? t.puzzleRuns.streakIntro : t.puzzleRuns.stormIntro}
              {kind === 'storm' && ` ${t.puzzleRuns.clockHint}`}
            </p>
          )}
          {kind === 'storm' && (
            <div class="ligungi-run__clock">
              <span class={`ligungi-run__time${left < 20_000 && !over ? ' is-low' : ''}`} role="timer" aria-label={t.puzzleRuns.timeLeft}>
                {formatClock(left)}
              </span>
              {flash && <span class={`ligungi-run__flash${flash.good ? ' is-good' : ' is-bad'}`}>{flash.text}</span>}
              <span class="ligungi-run__bar" aria-hidden="true">
                <span style={{ width: `${Math.min(100, (left / STORM_TIME_MS) * 100)}%` }} />
              </span>
            </div>
          )}
          <p class="ligungi-run__score">
            <strong>{score}</strong>
            <span>{t.puzzleRuns.solved}</span>
          </p>
          {kind === 'storm' && !over && (
            <div class="ligungi-run__combo">
              <span>
                {t.puzzleRuns.combo} <strong>{state.combo}</strong>
              </span>
              <span class="ligungi-run__bar is-combo" aria-hidden="true">
                <span style={{ width: `${((state.combo - steps.from) / (steps.to - steps.from)) * 100}%` }} />
              </span>
            </div>
          )}
          {over && (
            <div class="ligungi-run__summary" role="status">
              <p class="ligungi-run__over">{status}</p>
              {praise && <p class="ligungi-success">{praise}</p>}
              {kind === 'storm' && (
                <dl class="ligungi-run__stats">
                  <div>
                    <dt>{t.puzzleRuns.moves}</dt>
                    <dd>{state.correct + state.wrong}</dd>
                  </div>
                  <div>
                    <dt>{t.puzzleRuns.accuracy}</dt>
                    <dd>{accuracy}%</dd>
                  </div>
                  <div>
                    <dt>{t.puzzleRuns.bestCombo}</dt>
                    <dd>{state.bestCombo}</dd>
                  </div>
                </dl>
              )}
            </div>
          )}
          {records && (
            <>
              <h2 class="ligungi-run__heading">{t.puzzleRuns.records}</h2>
              <Records records={records} />
            </>
          )}
          <p class="ligungi-puzzle__links">
            <a href="/puzzles">{t.puzzles.title}</a>
            <a href={kind === 'streak' ? '/storm' : '/streak'}>{kind === 'streak' ? t.puzzleRuns.storm : t.puzzleRuns.streak}</a>
            <a href="/racer">{t.racer.title}</a>
          </p>
          {loaded && !user && (
            <p class="ligungi-drill__login">
              <a href="/login">{t.puzzleRuns.loginToSave}</a>
            </p>
          )}
        </section>
      }
      under={
        over && state.played.length > 0 ? (
          <section class="ligungi-card ligungi-run__played">
            <h2>{t.puzzleRuns.played}</h2>
            <ul>
              {state.played.map(({ entry: played, outcome }, i) => (
                <li key={i}>
                  <a href={`/puzzles/${played.puzzle.id}`} class={`is-${outcome}`} aria-label={`${t.puzzleRuns.result[outcome]}: ${played.puzzle.id}`}>
                    <MiniBoard position={played.start} orientation={played.info.color} />
                    <span data-icon={outcome === 'won' ? icons.Checkmark : outcome === 'lost' ? icons.X : icons.JumpNext}>{t.puzzleRuns.result[outcome]}</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ) : null
      }
    />
  );
};
