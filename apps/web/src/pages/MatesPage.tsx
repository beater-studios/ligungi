import { MODES, initialPosition, legalMoves, moveToString, opposite, parseFen, parseMove, toFen, type Color, type Mode, type Move, type Position } from '@ligungi/engine';
import type { MateProblem } from '@ligungi/protocol';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { RoundLayout, type RoundPlayer } from '../components/RoundLayout.tsx';
import { Field, Select } from '../components/ui.tsx';
import { useT } from '../i18n/index.ts';
import { icons } from '../icons.ts';
import { useLocalGame } from '../localGame.ts';
import { useSolvedMates } from '../mates.ts';
import { navigate } from '../router.ts';
import { session } from '../session.ts';
import { playSound } from '../sound.ts';
import { useStore } from '../store.ts';

/** Solving: the player's turn. Checking: a move off the stored line is being checked. */
type Stage = 'solving' | 'checking' | 'defending' | 'wrong' | 'solved' | 'revealed';

interface Entry {
  readonly problem: MateProblem;
  readonly start: Position;
}

const DEFENSE_DELAY_MS = 450;
const WRONG_DELAY_MS = 900;

const PLACEHOLDER = initialPosition('intro');

/**
 * Mate problems: the attacking side mates in 1 to 3 moves, each one attacking the Marshal (the tsume convention), and
 * the computer answers with the longest defense. The stored solution answers at once; any other mating move is checked
 * in a worker. Progress is kept on the account, or in the browser without one.
 */
export const MatesPage = ({ id }: { id?: string }) => {
  const t = useT();
  const { user, loaded } = useStore(session);
  const [entries, setEntries] = useState<readonly Entry[] | null>(null);
  const [mode, setMode] = useState<Mode | null>(null);
  const [length, setLength] = useState<number | null>(null);
  const [stage, setStage] = useState<Stage>('solving');
  const [message, setMessage] = useState<string | null>(null);
  const [onLine, setOnLine] = useState(true);
  const [revealedOnce, setRevealedOnce] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const local = useLocalGame(PLACEHOLDER);
  const worker = useRef<Worker | null>(null);
  const request = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void import('@ligungi/protocol/mates').then(({ MATE_PROBLEMS }) =>
      setEntries(MATE_PROBLEMS.map((problem) => ({ problem, start: parseFen(problem.fen) }))),
    );
    worker.current = new Worker(new URL('../mate.worker.ts', import.meta.url), { type: 'module' });
    return () => {
      worker.current?.terminate();
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const known = useMemo(() => (entries ? new Set(entries.map((entry) => entry.problem.id)) : null), [entries]);
  const { solved, markSolved } = useSolvedMates(known);
  const filtered = useMemo(
    () => (entries ?? []).filter((entry) => (mode === null || entry.start.mode === mode) && (length === null || entry.problem.moves === length)),
    [entries, mode, length],
  );
  const current = entries?.find((entry) => entry.problem.id === id) ?? null;

  /** The first unsolved problem of the filter after `after` (wrapping around), or the next one when all are solved. */
  const pick = (list: readonly Entry[], after: string | null): Entry | undefined => {
    const start = after === null ? -1 : list.findIndex((entry) => entry.problem.id === after);
    const ordered = [...list.slice(start + 1), ...list.slice(0, start + 1)];
    return ordered.find((entry) => !solved?.has(entry.problem.id)) ?? ordered[0];
  };

  // Without a problem in the address, open one of the filter, so the address can be shared.
  useEffect(() => {
    if (!entries || !solved || current) return;
    const next = pick(filtered, null);
    if (next) navigate(`/problems/${next.problem.id}`, true);
  }, [entries, solved, id]);

  const begin = (entry: Entry) => {
    if (timer.current) clearTimeout(timer.current);
    request.current++;
    local.reset(entry.start);
    setStage('solving');
    setMessage(null);
    setOnLine(true);
    setRevealedOnce(false);
  };
  useEffect(() => {
    if (current) begin(current);
  }, [current?.problem.id]);

  // Also what the prerendered page shows, so search engines read what the page is about.
  if (!entries || !current) {
    return (
      <main class="ligungi-page ligungi-mates-loading">
        <h1>{t.mates.title}</h1>
        <p>{t.mates.intro}</p>
        <p class="ligungi-notice">{entries && id ? t.mates.notFound : t.common.loading}</p>
      </main>
    );
  }

  const { problem, start } = current;
  const attacker: Color = start.turn;
  const { replay } = local;
  const position = local.position;
  const live = local.ply === null;
  const yourTurn = stage === 'solving' && live && position.turn === attacker && !replay.game.outcome;
  const moves = yourTurn ? legalMoves(position) : [];

  const defend = (defense: string | null, last: boolean) => {
    if (last || defense === null) {
      setStage('solved');
      setMessage(t.mates.solved);
      playSound('victory');
      if (!revealedOnce) markSolved(problem.id);
      return;
    }
    setStage('defending');
    setMessage(t.mates.correct);
    timer.current = setTimeout(() => {
      const move = parseMove(defense);
      if (move) {
        playSound(move.kind === 'move' && move.action === 'capture' ? 'capture' : 'move');
        local.play(move);
      }
      setStage('solving');
    }, DEFENSE_DELAY_MS);
  };

  const wrong = (text: string) => {
    setStage('wrong');
    setMessage(text);
    playSound('error');
    timer.current = setTimeout(() => {
      local.undo();
      setStage('solving');
    }, WRONG_DELAY_MS);
  };

  const onMove = (move: Move) => {
    const before = position;
    const played = replay.moves.length;
    const left = problem.moves - Math.floor(played / 2);
    const text = moveToString(move);
    playSound(move.kind === 'move' && move.action === 'capture' ? 'capture' : 'move');
    local.play(move);
    if (onLine && problem.line[played] === text) {
      defend(problem.line[played + 1] ?? null, left === 1);
      return;
    }
    setStage('checking');
    const ticket = ++request.current;
    const listener = (event: MessageEvent<{ id: number; check: boolean; ok: boolean; defense: string | null }>) => {
      if (event.data.id !== ticket) return;
      worker.current?.removeEventListener('message', listener);
      if (request.current !== ticket) return;
      if (!event.data.ok) return wrong(event.data.check ? t.mates.wrong : t.mates.notCheck);
      setOnLine(false);
      defend(event.data.defense, left === 1);
    };
    worker.current?.addEventListener('message', listener);
    worker.current?.postMessage({ id: ticket, fen: toFen(before), move: text, moves: left });
  };

  const reveal = () => {
    if (timer.current) clearTimeout(timer.current);
    request.current++;
    local.reset(start, problem.line.map((text) => parseMove(text)!));
    local.setPly(0);
    setStage('revealed');
    setMessage(t.mates.revealed);
    setRevealedOnce(true);
  };

  const goTo = (entry: Entry | undefined) => entry && navigate(`/problems/${entry.problem.id}`);
  const changeFilter = (nextMode: Mode | null, nextLength: number | null) => {
    setMode(nextMode);
    setLength(nextLength);
    const list = (entries ?? []).filter((entry) => (nextMode === null || entry.start.mode === nextMode) && (nextLength === null || entry.problem.moves === nextLength));
    if (!list.some((entry) => entry.problem.id === problem.id)) goTo(pick(list, null));
  };

  const solvedHere = filtered.filter((entry) => solved?.has(entry.problem.id)).length;
  const isSolved = solved?.has(problem.id) ?? false;
  const task = t.mates.task(t.colors[attacker], problem.moves);
  const players = {
    [attacker]: { name: t.common.you },
    [opposite(attacker)]: { name: t.mates.defender },
  } as Record<Color, RoundPlayer>;

  return (
    <RoundLayout
      training
      board={{ position, movableColor: yourTurn ? attacker : null, moves, lastMove: local.lastMove, onMove }}
      orientation={flipped ? opposite(attacker) : attacker}
      players={players}
      turn={replay.game.outcome ? null : position.turn}
      positions={replay.positions}
      moves={replay.moves}
      ply={local.ply}
      onPly={local.setPly}
      onFlip={() => setFlipped((f) => !f)}
      analysisHref={`/analysis?fen=${encodeURIComponent(problem.fen)}`}
      myTurn={yourTurn}
      status={message ?? task}
      controls={
        <div class="follow-up">
          {stage === 'solved' || stage === 'revealed' ? (
            <button type="button" class="fbt strong glowing" onClick={() => goTo(pick(filtered, problem.id))}>
              {t.mates.next}
            </button>
          ) : (
            <button type="button" class="fbt" onClick={reveal}>
              {t.mates.showSolution}
            </button>
          )}
          <button type="button" class="fbt" onClick={() => begin(current)}>
            {t.mates.retry}
          </button>
        </div>
      }
      side={
        <section class="ligungi-card ligungi-game-info ligungi-mates">
          <h1 class="ligungi-mates__title">{t.mates.title}</h1>
          <p class="ligungi-mates__task">
            <strong>{task}</strong>
            {isSolved && <span class="ligungi-tag">{t.mates.solvedTag}</span>}
          </p>
          {message && (
            <p class={`ligungi-mates__feedback${stage === 'wrong' ? ' error' : stage === 'solved' ? ' ligungi-success' : ''}`} role="status">
              {message}
            </p>
          )}
          <p class="ligungi-game-info__setup">
            {t.modes[start.mode]} · #{problem.id}
          </p>
          <p class="ligungi-mates__intro">{t.mates.intro}</p>
          <div class="form3 ligungi-mates__filters">
            <Field label={t.common.mode} htmlFor="mates-mode">
              <Select
                id="mates-mode"
                value={mode}
                options={[{ value: null, label: t.mates.allModes }, ...MODES.map((value) => ({ value, label: t.modes[value] }))]}
                onChange={(value) => changeFilter(value, length)}
              />
            </Field>
            <Field label={t.mates.length} htmlFor="mates-length">
              <Select
                id="mates-length"
                value={length}
                options={[{ value: null, label: t.mates.allLengths }, ...[1, 2, 3].map((value) => ({ value, label: t.mates.mateIn(value) }))]}
                onChange={(value) => changeFilter(mode, value)}
              />
            </Field>
          </div>
          <p class="ligungi-mates__progress" data-icon={icons.Checkmark}>
            {filtered.length === 0 ? t.mates.none : t.mates.progress(solvedHere, filtered.length)}
          </p>
          {loaded && !user && (
            <p class="ligungi-mates__login">
              <a href="/login">{t.mates.loginToSave}</a>
            </p>
          )}
        </section>
      }
    />
  );
};
