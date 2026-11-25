import { moveToString, opposite, type Color, type Move } from '@ligungi/engine';
import { RACE_TIME_MS, type RaceView } from '@ligungi/protocol';
import { useEffect, useRef, useState } from 'preact/hooks';
import { api } from '../core/api.ts';
import { RaceTrack } from '../puzzles/RaceTrack.tsx';
import { RoundLayout, type RoundPlayer } from '../game/RoundLayout.tsx';
import { SettingRow, Toggle } from '../components/ui.tsx';
import { discordActivity, inActivity } from '../discord/activity.ts';
import { formatClock, useT } from '../i18n/index.ts';
import { racerName, setShowGhosts, showGhosts } from '../puzzles/racer.ts';
import { navigate } from '../core/router.ts';
import { usePuzzleEntries, usePuzzleSolver } from '../puzzles/puzzleSolver.ts';
import { socket } from '../core/socket.ts';
import { playSound } from '../sound.ts';
import { useStore } from '../core/store.ts';
import { useCopy, useTimers } from '../core/hooks.ts';

/** The opponent's reply and the next puzzle come quickly: the clock is running for everyone. */
const ANSWER_DELAY_MS = 250;
const NEXT_DELAY_MS = 250;
const WRONG_DELAY_MS = 500;

type Phase = 'waiting' | 'countdown' | 'racing' | 'over';

/** Start and end of the race on this page's clock (performance.now()), from the server's "in so many ms". */
interface Clock {
  readonly start: number | null;
  readonly end: number | null;
}

/**
 * A Puzzle Racer race: waiting for players, the countdown, then 90 seconds of puzzles with every racer's score on the
 * track, and the results. The page solves the puzzles locally for a quick answer and sends each move to the server,
 * which checks it and keeps the score.
 */
export const RacePage = ({ id }: { id: string }) => {
  const t = useT();
  const r = t.racer;
  const state = useStore(discordActivity);
  const ghostsOn = useStore(showGhosts);
  const [race, setRace] = useState<RaceView | null>(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { copied, copy } = useCopy();
  const entries = usePuzzleEntries()?.byId ?? null;
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [, setTick] = useState(0);
  const clock = useRef<Clock>({ start: null, end: null });
  const { later } = useTimers();

  const instanceId = state.status === 'ready' ? state.instanceId : null;

  const receive = (view: RaceView) => {
    const now = performance.now();
    clock.current = { start: view.startsIn === null ? null : now + view.startsIn, end: view.endsIn === null ? null : now + view.endsIn };
    setRace(view);
  };

  // Follows the race, and joins it on arrival while it can still be joined.
  useEffect(() => {
    let live = true;
    setRace(null);
    setIndex(0);
    const unsubscribe = socket.subscribe(`race:${id}`);
    const off = socket.on((message) => {
      if (message.t === 'race' && message.race.id === id) receive(message.race);
    });
    api
      .get<RaceView>(`/api/racer/${id}`)
      .then((view) => {
        if (!live) return;
        receive(view);
        if (view.you || view.status === 'racing' || view.status === 'finished') return;
        api.post(`/api/racer/${id}/join`, view.kind === 'call' && instanceId ? { instanceId } : {}).catch((err: Error) => live && setError(err.message));
      })
      .catch(() => live && setMissing(true));
    return () => {
      live = false;
      unsubscribe();
      off();
    };
  }, [id]);

  const now = performance.now();
  const { start, end } = clock.current;
  const phase: Phase =
    !race || race.status === 'waiting'
      ? 'waiting'
      : race.status === 'finished' || (end !== null && now >= end)
        ? 'over'
        : start !== null && now < start
          ? 'countdown'
          : 'racing';

  // The countdown, the clock and the ghosts move on their own.
  useEffect(() => {
    if (phase !== 'countdown' && phase !== 'racing') return;
    const timer = setInterval(() => setTick((n) => n + 1), 100);
    return () => clearInterval(timer);
  }, [phase]);

  // Moves on from the puzzle `from` only if the page is still on it: the server may have moved the page on already.
  const indexRef = useRef(0);
  indexRef.current = index;
  const next = (from: number) => setIndex((i) => (i === from ? from + 1 : i));
  const solver = usePuzzleSolver(
    {
      onCorrect: (finished) => {
        const from = indexRef.current;
        if (finished) later(() => next(from), NEXT_DELAY_MS);
      },
      onWrong: () => {
        const from = indexRef.current;
        playSound('error');
        later(() => next(from), WRONG_DELAY_MS);
      },
    },
    ANSWER_DELAY_MS,
  );

  // The server moves on as soon as a puzzle is decided, while the page first shows its last move. Catching up is left
  // until that pause is over, so it only matters when the page fell behind (after a reload).
  const serverIndex = race?.you?.index ?? 0;
  useEffect(() => {
    if (serverIndex <= index) return;
    const timer = setTimeout(() => setIndex((i) => Math.max(i, serverIndex)), WRONG_DELAY_MS + 100);
    return () => clearTimeout(timer);
  }, [serverIndex, index]);

  const puzzles = race?.puzzles ?? null;
  const entry = puzzles && entries ? entries.get(puzzles[index] ?? '') : undefined;
  useEffect(() => {
    if (entry && phase !== 'over') solver.begin(entry);
  }, [entry?.puzzle.id, index]);
  useEffect(() => {
    if (phase === 'over') {
      solver.stop();
      playSound('notify');
    }
  }, [phase === 'over']);

  const go = async (path: string, body?: unknown) => {
    setBusy(true);
    setError(null);
    try {
      const { id: next } = await api.post<{ id: string }>(path, body);
      navigate(`/racer/${next}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const again = () => {
    if (!race) return;
    if (race.kind === 'call' && instanceId) return void go('/api/activity/race', { instanceId });
    void go(race.kind === 'public' ? '/api/racer/public' : '/api/racer');
  };
  const startRace = async () => {
    setError(null);
    try {
      await api.post(`/api/racer/${id}/start`);
    } catch (err) {
      setError((err as Error).message);
    }
  };
  const link = typeof window === 'undefined' ? '' : `${window.location.origin}/racer/${id}`;

  if (missing) {
    return (
      <main class="ligungi-page ligungi-racer">
        <section class="ligungi-card ligungi-racer__card">
          <h1>{r.title}</h1>
          <p class="error">{r.notFound}</p>
          <p>
            <a href="/racer">{r.newRace}</a>
          </p>
        </section>
      </main>
    );
  }

  const ghosts = race && ghostsOn ? race.ghosts : [];
  const elapsed = start === null ? 0 : Math.min(RACE_TIME_MS, Math.max(0, now - start));
  const track = race && <RaceTrack players={race.players} ghosts={ghosts} elapsed={phase === 'over' ? RACE_TIME_MS : elapsed} over={phase === 'over'} />;
  const ghostSwitch = race && race.ghosts.length > 0 && (
    <SettingRow title={r.ghosts} help={r.ghostsHelp} htmlFor="race-ghosts">
      <Toggle id="race-ghosts" checked={ghostsOn} onChange={setShowGhosts} label={r.ghosts} />
    </SettingRow>
  );
  const errorLine = error && (
    <p class="error" role="alert">
      {error}
    </p>
  );

  // Before the start, and for whoever only watches: no board, just the players.
  if (!race || phase === 'waiting' || !race.you || !entry) {
    const watching = race && !race.you && (race.status === 'racing' || race.status === 'finished');
    return (
      <main class="ligungi-page ligungi-racer">
        <section class="ligungi-card ligungi-racer__card">
          <h1>{r.title}</h1>
          {!race && <p class="ligungi-notice">{t.common.loading}</p>}
          {race && phase === 'waiting' && <p class="ligungi-racer__intro">{race.owner ? r.waitingOwner : r.waitingOthers}</p>}
          {race && phase === 'countdown' && start !== null && (
            <p class="ligungi-race__countdown" role="timer">
              {r.startsIn(Math.ceil((start - now) / 1000))}
            </p>
          )}
          {watching && <p class="ligungi-notice">{r.watching}</p>}
          {race?.kind === 'friends' && phase === 'waiting' && !inActivity && (
            <div class="copy-me">
              <input class="copy-me__target" readOnly spellcheck={false} aria-label={r.linkLabel} value={link} onFocus={(e) => (e.target as HTMLInputElement).select()} />
              <button type="button" class="copy-me__button button" onClick={() => void copy(link)}>
                {copied ? r.copied : r.copy}
              </button>
            </div>
          )}
          {race?.owner && phase === 'waiting' && (
            <button type="button" class="button ligungi-button-good ligungi-racer__start" onClick={() => void startRace()}>
              {r.start}
            </button>
          )}
          {errorLine}
          {track}
          {ghostSwitch}
          {phase === 'over' && (
            <button type="button" class="button" disabled={busy} onClick={again}>
              {r.newRace}
            </button>
          )}
        </section>
      </main>
    );
  }

  const you = race.you;
  const over = phase === 'over';
  const racing = phase === 'racing';
  const left = end === null ? RACE_TIME_MS : Math.max(0, end - now);
  const { info } = entry;
  const solverColor: Color = info.color;
  const { local } = solver;
  const task = info.kind === 'mate' ? t.puzzles.taskMate(solverColor, info.moves) : t.puzzles.taskMaterial(solverColor);
  const players = {
    [solverColor]: { name: t.common.you },
    [opposite(solverColor)]: { name: t.puzzles.opponent },
  } as Record<Color, RoundPlayer>;
  const ranked = [...race.players].sort((a, b) => b.score - a.score);
  const leader = ranked[0];
  const winner = over && leader && leader.score > 0 ? (leader.me ? r.youWon : r.winner(racerName(t, leader))) : null;
  const status = over ? (winner ?? r.over) : phase === 'countdown' && start !== null ? r.startsIn(Math.ceil((start - now) / 1000)) : task;
  const canSkip = racing && !you.skipUsed && solver.stage !== 'done';

  const onMove = (move: Move) => {
    if (!racing) return;
    socket.send({ t: 'raceMove', race: id, puzzle: index, move: moveToString(move) });
    solver.onMove(move);
  };
  const skip = () => {
    if (!canSkip) return;
    socket.send({ t: 'raceSkip', race: id, puzzle: index });
    next(index);
  };

  return (
    <RoundLayout
      training
      board={{ position: local.position, movableColor: racing && solver.yourTurn ? solverColor : null, moves: racing ? solver.moves : [], lastMove: local.lastMove, onMove }}
      orientation={flipped ? opposite(solverColor) : solverColor}
      players={players}
      turn={racing ? local.position.turn : null}
      positions={local.replay.positions}
      moves={local.replay.moves}
      ply={local.ply}
      onPly={local.setPly}
      onFlip={() => setFlipped((f) => !f)}
      myTurn={racing && solver.yourTurn}
      status={status}
      gameKey={entry.puzzle.id}
      goal={racing ? task : null}
      result={over ? `${status} ${r.score}: ${you.score}.` : null}
      timeInfo={`${t.puzzleRuns.timeLeft}: ${formatClock(left)}. ${r.score}: ${you.score}. ${t.puzzleRuns.combo}: ${you.combo}.`}
      controls={
        <div class="follow-up">
          {over ? (
            <button type="button" class="fbt strong glowing" disabled={busy} onClick={again}>
              {r.again}
            </button>
          ) : (
            <button type="button" class="fbt" disabled={!canSkip} title={you.skipUsed ? t.puzzleRuns.skipUsed : undefined} onClick={skip}>
              {t.puzzleRuns.skip}
            </button>
          )}
        </div>
      }
      side={
        <section class="ligungi-card ligungi-game-info ligungi-run ligungi-race">
          <h1 class="ligungi-mates__title">{r.title}</h1>
          {phase === 'countdown' && start !== null ? (
            <p class="ligungi-race__countdown" role="timer">
              {r.startsIn(Math.ceil((start - now) / 1000))}
            </p>
          ) : (
            <div class="ligungi-run__clock">
              <span class={`ligungi-run__time${left < 15_000 && !over ? ' is-low' : ''}`} role="timer" aria-label={t.puzzleRuns.timeLeft}>
                {formatClock(left)}
              </span>
              <span class="ligungi-run__bar" aria-hidden="true">
                <span style={{ width: `${(left / RACE_TIME_MS) * 100}%` }} />
              </span>
            </div>
          )}
          <p class="ligungi-run__score">
            <strong>{you.score}</strong>
            <span>{r.score}</span>
          </p>
          {!over && (
            <p class="ligungi-race__combo">
              {t.puzzleRuns.combo} <strong>{you.combo}</strong>
            </p>
          )}
          {over && (
            <div class="ligungi-run__summary" role="status">
              <p class="ligungi-run__over">{r.over}</p>
              {winner && <p class="ligungi-success">{winner}</p>}
            </div>
          )}
          {errorLine}
          {track}
          {ghostSwitch}
          <p class="ligungi-puzzle__links">
            <a href="/racer">{r.title}</a>
            <a href="/puzzles">{t.puzzles.title}</a>
          </p>
        </section>
      }
    />
  );
};
