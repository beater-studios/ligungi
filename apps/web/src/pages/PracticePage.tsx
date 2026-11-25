import type { BotLevel } from '@ligungi/bot';
import { legalMoves, opposite, parseFen, parseMove, repetitionKey, toFen, type Color } from '@ligungi/engine';
import { PRACTICE_LEVEL, PRACTICE_POSITIONS, PRACTICE_SECTIONS, practiceResult, type PracticeGoal, type PracticePosition } from '@ligungi/protocol';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { MiniBoard } from '../components/MiniBoard.tsx';
import { RoundLayout, type RoundPlayer } from '../game/RoundLayout.tsx';
import { useT, type Messages } from '../i18n/index.ts';
import { icons } from '../icons.ts';
import { useLocalGame } from '../game/localGame.ts';
import { usePracticeProgress, type PracticeProgress } from '../learn/practiceProgress.ts';
import { session } from '../core/session.ts';
import { playSound } from '../sound.ts';
import { moveSound } from '../blind/speech.ts';
import { useStore } from '../core/store.ts';

const MIN_THINK_MS = 450;

const goalText = (t: Messages, goal: PracticeGoal): string =>
  goal.kind === 'mate' ? t.practice.goalMate(goal.moves) : goal.kind === 'win' ? t.practice.goalWin(goal.moves) : t.practice.goalSurvive(goal.moves);

const LoginLine = () => {
  const t = useT();
  const { user, loaded } = useStore(session);
  if (!loaded || user) return null;
  return (
    <p class="ligungi-lessons__login">
      <a href="/login">{t.practice.loginToSave}</a>
    </p>
  );
};

/** Every practice position by section, with its goal and whether (and in how many moves) the player did it. */
const PracticeList = ({ progress }: { progress: PracticeProgress | null }) => {
  const t = useT();
  return (
    <main class="ligungi-page ligungi-practice">
      <header class="ligungi-lessons__head">
        <h1>{t.practice.title}</h1>
        <p>{t.practice.intro}</p>
        <LoginLine />
      </header>
      {PRACTICE_SECTIONS.map((section) => (
        <section key={section.id} class="ligungi-practice__section">
          <h2>{t.practice.sections[section.id].title}</h2>
          <p>{t.practice.sections[section.id].intro}</p>
          <ul class="ligungi-practice__positions">
            {section.positions.map((position) => {
              const done = progress?.[position.id];
              const start = parseFen(position.fen);
              return (
                <li key={position.id}>
                  <a class="ligungi-card ligungi-practice__position" href={`/practice/${position.id}`}>
                    <MiniBoard position={start} orientation={start.turn} />
                    <strong>{t.practice.positions[position.id as keyof typeof t.practice.positions]}</strong>
                    <span>{goalText(t, position.goal)}</span>
                    {done !== undefined && (
                      <span class="ligungi-tag ligungi-practice__done" data-icon={icons.Checkmark}>
                        {t.practice.doneIn(done)}
                      </span>
                    )}
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </main>
  );
};

/** One position against the computer at its strongest, with the goal and the moves left. */
const PracticeGame = ({ practice, record }: { practice: PracticePosition; record: (id: string, moves: number) => void }) => {
  const t = useT();
  const start = useMemo(() => parseFen(practice.fen), [practice.fen]);
  const player: Color = start.turn;
  const bot = opposite(player);
  const local = useLocalGame(start);
  const [flipped, setFlipped] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [recorded, setRecorded] = useState(false);
  const worker = useRef<Worker | null>(null);
  const request = useRef(0);

  useEffect(() => {
    worker.current = new Worker(new URL('../game/bot.worker.ts', import.meta.url), { type: 'module' });
    return () => worker.current?.terminate();
  }, []);

  const { replay } = local;
  const position = replay.game.position;
  const playerMoves = replay.positions.slice(0, -1).filter((p) => p.turn === player).length;
  const result = practiceResult(practice.goal, replay.game.outcome ?? null, playerMoves, player);
  const over = result !== 'playing';
  const botTurn = !over && local.ply === null && position.turn === bot;

  useEffect(() => {
    if (!botTurn || !worker.current) return;
    const id = ++request.current;
    const started = performance.now();
    setThinking(true);
    const onMessage = (event: MessageEvent<{ id: number; move: string }>) => {
      if (event.data.id !== id) return;
      const wait = Math.max(0, MIN_THINK_MS - (performance.now() - started));
      setTimeout(() => {
        if (request.current !== id) return;
        const move = parseMove(event.data.move);
        if (move) {
          moveSound('training', local.position, move, 'opponent');
          local.play(move);
        }
        setThinking(false);
      }, wait);
    };
    worker.current.addEventListener('message', onMessage);
    const history = replay.positions.slice(0, -1).filter((p) => p.phase === 'play').map(repetitionKey);
    worker.current.postMessage({ id, fen: toFen(position), level: PRACTICE_LEVEL as BotLevel, history });
    return () => {
      worker.current?.removeEventListener('message', onMessage);
      request.current++;
      setThinking(false);
    };
  }, [botTurn, replay]);

  useEffect(() => {
    if (result === 'won' && !recorded) {
      setRecorded(true);
      record(practice.id, playerMoves);
      playSound('victory');
    } else if (result === 'failed') playSound('defeat');
  }, [result]);

  const restart = () => {
    request.current++;
    setThinking(false);
    setRecorded(false);
    local.reset(start);
  };

  const myTurn = !over && local.ply === null && position.turn === player;
  const moves = useMemo(() => (myTurn ? legalMoves(position) : []), [myTurn, replay]);
  const index = PRACTICE_POSITIONS.indexOf(practice);
  const next = PRACTICE_POSITIONS[index + 1];
  const status =
    result === 'won' ? t.practice.won(playerMoves) : result === 'failed' ? t.practice.failed : thinking ? t.practice.thinking : t.practice.yourMove;
  const players = {
    [player]: { name: t.common.you },
    [bot]: { name: t.computer.bot(PRACTICE_LEVEL) },
  } as Record<Color, RoundPlayer>;

  return (
    <RoundLayout
      training
      board={{
        position: local.position,
        movableColor: myTurn ? player : null,
        moves,
        lastMove: local.lastMove,
        onMove: (move) => {
          moveSound('training', local.position, move, 'self');
          local.play(move);
        },
      }}
      orientation={flipped ? bot : player}
      players={players}
      turn={over ? null : position.turn}
      positions={replay.positions}
      moves={replay.moves}
      ply={local.ply}
      onPly={local.setPly}
      onFlip={() => setFlipped((f) => !f)}
      analysisHref={`/analysis?fen=${encodeURIComponent(toFen(position))}`}
      myTurn={myTurn}
      status={status}
      gameKey={practice.id}
      goal={`${t.practice.positions[practice.id as keyof typeof t.practice.positions]}. ${goalText(t, practice.goal)}`}
      result={result === 'won' || result === 'failed' ? status : null}
      timeInfo={`${t.practice.movesUsed(playerMoves, practice.goal.moves)}.`}
      controls={
        <div class="follow-up">
          {result === 'won' && next && (
            <a class="fbt strong glowing" href={`/practice/${next.id}`}>
              {t.practice.next}
            </a>
          )}
          <button type="button" class="fbt" onClick={restart}>
            {t.practice.retry}
          </button>
        </div>
      }
      side={
        <section class="ligungi-card ligungi-game-info ligungi-drill">
          <a class="text" href="/practice" data-icon={icons.Back}>
            {t.practice.all}
          </a>
          <h1 class="ligungi-drill__title">{t.practice.positions[practice.id as keyof typeof t.practice.positions]}</h1>
          <p class="ligungi-drill__task">
            <strong>{goalText(t, practice.goal)}</strong>
          </p>
          <p class="ligungi-game-info__setup">
            {t.practice.movesUsed(playerMoves, practice.goal.moves)} · {t.modes[start.mode]}
          </p>
          <p class={`ligungi-drill__feedback${result === 'failed' ? ' error' : result === 'won' ? ' ligungi-success' : ''}`} role="status">
            {status}
          </p>
          <LoginLine />
        </section>
      }
    />
  );
};

/** `/practice`: the positions by section. `/practice/<id>`: one position against the computer. */
export const PracticePage = ({ id }: { id?: string }) => {
  const t = useT();
  const { progress, record } = usePracticeProgress();
  if (id === undefined) return <PracticeList progress={progress} />;
  const practice = PRACTICE_POSITIONS.find((position) => position.id === id);
  if (!practice) {
    return (
      <main class="ligungi-page">
        <p class="ligungi-notice">{t.practice.notFound}</p>
      </main>
    );
  }
  return <PracticeGame key={practice.id} practice={practice} record={record} />;
};
