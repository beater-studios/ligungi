import { MODES, initialPosition, legalMoves, moveToString, opposite, parseFen, parseMove, toFen, type Color, type Mode, type Move, type Position } from '@ligungi/engine';
import {
  PUZZLE_THEMES,
  puzzleInfo,
  type DailyPuzzle,
  type Puzzle,
  type PuzzleAttemptResult,
  type PuzzleInfo,
  type PuzzleTheme,
  type PuzzleView,
} from '@ligungi/protocol';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { api } from '../api.ts';
import { RoundLayout, type RoundPlayer } from '../components/RoundLayout.tsx';
import { Field, Select } from '../components/ui.tsx';
import { errorText, useT } from '../i18n/index.ts';
import { icons } from '../icons.ts';
import { useLocalGame } from '../localGame.ts';
import { readLocalSolved, useSolvedPuzzles } from '../puzzleProgress.ts';
import { navigate, useLocation } from '../router.ts';
import { session } from '../session.ts';
import { playSound } from '../sound.ts';
import { useStore } from '../store.ts';

/** Solving: the player's turn. Checking: a mating move off the stored line is being checked in the worker. */
type Stage = 'solving' | 'checking' | 'answering' | 'wrong' | 'solved' | 'revealed';

interface Entry {
  readonly puzzle: Puzzle;
  readonly info: PuzzleInfo;
  readonly start: Position;
}

const ANSWER_DELAY_MS = 450;
const WRONG_DELAY_MS = 900;
const PLACEHOLDER = initialPosition('intro');

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

/** Theme and mode filters, kept in the address so a filtered run can be shared and survives a reload. */
const readFilter = (search: string): { theme: PuzzleTheme | null; mode: Mode | null } => {
  const params = new URLSearchParams(search);
  return {
    theme: PUZZLE_THEMES.find((value) => value === params.get('theme')) ?? null,
    mode: MODES.find((value) => value === params.get('mode')) ?? null,
  };
};

const filterQuery = (filter: { theme: PuzzleTheme | null; mode: Mode | null }): string => {
  const params = new URLSearchParams();
  if (filter.theme) params.set('theme', filter.theme);
  if (filter.mode) params.set('mode', filter.mode);
  const query = params.toString();
  return query ? `?${query}` : '';
};

/**
 * Puzzles: mates (every move attacking the Marshal, as in tsume) and material wins, with a rating. The first try at a
 * puzzle counts: solved without a wrong move or a look at the solution wins, anything else loses. Mates accept any
 * other mating move, checked in the mate worker; material puzzles take only the stored line.
 */
export const PuzzlesPage = ({ id, daily = false }: { id?: string; daily?: boolean }) => {
  const t = useT();
  const { user, loaded } = useStore(session);
  const { search } = useLocation();
  const filter = readFilter(search);
  const [entries, setEntries] = useState<readonly Entry[] | null>(null);
  const [dailyPuzzle, setDailyPuzzle] = useState<DailyPuzzle | null>(null);
  const [view, setView] = useState<PuzzleView | null>(null);
  const [none, setNone] = useState(false);
  const [stage, setStage] = useState<Stage>('solving');
  const [message, setMessage] = useState<string | null>(null);
  const [onLine, setOnLine] = useState(true);
  const [failed, setFailed] = useState(false);
  const [result, setResult] = useState<PuzzleAttemptResult | null>(null);
  const [flipped, setFlipped] = useState(false);
  const local = useLocalGame(PLACEHOLDER);
  const worker = useRef<Worker | null>(null);
  const request = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reported = useRef(false);

  useEffect(() => {
    void import('@ligungi/protocol/puzzles').then(({ PUZZLES }) =>
      setEntries(PUZZLES.map((puzzle) => ({ puzzle, info: puzzleInfo(puzzle), start: parseFen(puzzle.fen) }))),
    );
    worker.current = new Worker(new URL('../mate.worker.ts', import.meta.url), { type: 'module' });
    return () => {
      worker.current?.terminate();
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  useEffect(() => {
    if (daily) api.get<DailyPuzzle>('/api/puzzles/daily').then(setDailyPuzzle).catch(() => setNone(true));
  }, [daily]);

  const known = useMemo(() => (entries ? new Set(entries.map((entry) => entry.puzzle.id)) : null), [entries]);
  const { solved, markSolved } = useSolvedPuzzles(known);
  const currentId = daily ? (dailyPuzzle?.id ?? null) : (id ?? null);
  const current = entries?.find((entry) => entry.puzzle.id === currentId) ?? null;
  const filtered = useMemo(
    () => (entries ?? []).filter((entry) => (!filter.theme || entry.info.themes.includes(filter.theme)) && (!filter.mode || entry.info.mode === filter.mode)),
    [entries, filter.theme, filter.mode],
  );

  // On /puzzles, ask for a puzzle near the player's rating and put it in the address, so it can be shared.
  useEffect(() => {
    if (daily || id || !loaded || !entries) return;
    setNone(false);
    const params = new URLSearchParams(filterQuery(filter).slice(1));
    if (!user) params.set('exclude', readLocalSolved().join(','));
    api
      .get<{ id: string }>(`/api/puzzles/next?${params.toString()}`)
      .then((next) => navigate(`/puzzles/${next.id}${filterQuery(filter)}`, true))
      .catch(() => setNone(true));
  }, [daily, id, loaded, user?.id, entries !== null, search]);

  const begin = (entry: Entry) => {
    if (timer.current) clearTimeout(timer.current);
    request.current++;
    reported.current = false;
    local.reset(entry.start);
    setStage('solving');
    setMessage(null);
    setOnLine(true);
    setFailed(false);
    setResult(null);
    setView(null);
    api
      .get<PuzzleView>(`/api/puzzles/${entry.puzzle.id}`)
      .then(setView)
      .catch(() => {});
  };
  useEffect(() => {
    if (current) begin(current);
  }, [current?.puzzle.id]);

  /** The first try: a win only when solved cleanly. Signed in, it goes to the rating; without an account, to the browser. */
  const report = (win: boolean) => {
    if (reported.current || !current) return;
    reported.current = true;
    if (win) markSolved(current.puzzle.id);
    if (user) {
      const puzzleId = current.puzzle.id;
      api
        .post<PuzzleAttemptResult>(`/api/puzzles/${puzzleId}/attempt`, { win })
        .then((answer) => {
          setResult(answer);
          // The try moved the puzzle's rating and count too.
          return api.get<PuzzleView>(`/api/puzzles/${puzzleId}`).then(setView);
        })
        .catch(() => {});
    }
  };

  if (!entries || !current) {
    const notFound = (entries && id && !current) || none;
    return (
      <main class="ligungi-page ligungi-mates-loading">
        <h1>{daily ? t.puzzles.daily : t.puzzles.title}</h1>
        <p>{t.puzzles.intro}</p>
        <p class="ligungi-notice">{notFound ? (none && !id ? errorText(t, 'noPuzzleLeft') : t.puzzles.notFound) : t.common.loading}</p>
        {none && !id && (
          <a class="button button-empty" href="/puzzles">
            {t.puzzles.clearFilters}
          </a>
        )}
      </main>
    );
  }

  const { puzzle, info, start } = current;
  const solver: Color = info.color;
  const { replay } = local;
  const position = local.position;
  const yourTurn = stage === 'solving' && local.ply === null && position.turn === solver && !replay.game.outcome;
  const moves = yourTurn ? legalMoves(position) : [];

  const answer = (reply: string | null, last: boolean) => {
    if (last || reply === null) {
      setStage('solved');
      setMessage(failed ? t.puzzles.solvedAfterFail : t.puzzles.solved);
      playSound('victory');
      report(true);
      return;
    }
    setStage('answering');
    setMessage(t.puzzles.correct);
    timer.current = setTimeout(() => {
      const move = parseMove(reply);
      if (move) {
        playSound(move.kind === 'move' && move.action === 'capture' ? 'capture' : 'move');
        local.play(move);
      }
      setStage('solving');
    }, ANSWER_DELAY_MS);
  };

  const wrong = (text: string) => {
    setStage('wrong');
    setMessage(text);
    setFailed(true);
    playSound('error');
    report(false);
    timer.current = setTimeout(() => {
      local.undo();
      setStage('solving');
    }, WRONG_DELAY_MS);
  };

  const onMove = (move: Move) => {
    const before = position;
    const played = replay.moves.length;
    const left = info.moves - Math.floor(played / 2);
    const text = moveToString(move);
    playSound(move.kind === 'move' && move.action === 'capture' ? 'capture' : 'move');
    local.play(move);
    if (onLine && puzzle.line[played] === text) return answer(puzzle.line[played + 1] ?? null, left === 1);
    if (info.kind === 'material') return wrong(t.puzzles.wrong);
    setStage('checking');
    const ticket = ++request.current;
    const listener = (event: MessageEvent<{ id: number; check: boolean; ok: boolean; defense: string | null }>) => {
      if (event.data.id !== ticket) return;
      worker.current?.removeEventListener('message', listener);
      if (request.current !== ticket) return;
      if (!event.data.ok) return wrong(event.data.check ? t.puzzles.wrong : t.puzzles.notCheck);
      setOnLine(false);
      answer(event.data.defense, left === 1);
    };
    worker.current?.addEventListener('message', listener);
    worker.current?.postMessage({ id: ticket, fen: toFen(before), move: text, moves: left });
  };

  const reveal = () => {
    if (timer.current) clearTimeout(timer.current);
    request.current++;
    report(false);
    setFailed(true);
    local.reset(start, puzzle.line.map((text) => parseMove(text)!));
    local.setPly(0);
    setStage('revealed');
    setMessage(t.puzzles.revealed);
  };

  const changeFilter = (next: { theme: PuzzleTheme | null; mode: Mode | null }) => navigate(`/puzzles${filterQuery(next)}`);
  const finished = stage === 'solved' || stage === 'revealed';
  const solvedHere = filtered.filter((entry) => solved?.has(entry.puzzle.id)).length;
  const task = info.kind === 'mate' ? t.puzzles.taskMate(t.colors[solver], info.moves) : t.puzzles.taskMaterial(t.colors[solver]);
  const players = {
    [solver]: { name: t.common.you },
    [opposite(solver)]: { name: t.puzzles.opponent },
  } as Record<Color, RoundPlayer>;

  return (
    <RoundLayout
      training
      board={{ position, movableColor: yourTurn ? solver : null, moves, lastMove: local.lastMove, onMove }}
      orientation={flipped ? opposite(solver) : solver}
      players={players}
      turn={replay.game.outcome ? null : position.turn}
      positions={replay.positions}
      moves={replay.moves}
      ply={local.ply}
      onPly={local.setPly}
      onFlip={() => setFlipped((f) => !f)}
      analysisHref={`/analysis?fen=${encodeURIComponent(puzzle.fen)}`}
      myTurn={yourTurn}
      status={message ?? task}
      controls={
        <div class="follow-up">
          {finished ? (
            <a class="fbt strong glowing" href={`/puzzles${filterQuery(filter)}`}>
              {t.puzzles.next}
            </a>
          ) : (
            <button type="button" class="fbt" onClick={reveal}>
              {t.puzzles.showSolution}
            </button>
          )}
          <button type="button" class="fbt" onClick={() => begin(current)}>
            {t.puzzles.retry}
          </button>
        </div>
      }
      side={
        <section class="ligungi-card ligungi-game-info ligungi-mates">
          <h1 class="ligungi-mates__title">{daily ? t.puzzles.daily : t.puzzles.title}</h1>
          <p class="ligungi-mates__task">
            <strong>{task}</strong>
            {solved?.has(puzzle.id) && <span class="ligungi-tag">{t.puzzles.solvedTag}</span>}
          </p>
          {message && (
            <p class={`ligungi-mates__feedback${stage === 'wrong' ? ' error' : stage === 'solved' ? ' ligungi-success' : ''}`} role="status">
              {message}
            </p>
          )}
          {result &&
            (result.counted ? (
              <p class={`ligungi-puzzle__change ${result.change >= 0 ? 'is-up' : 'is-down'}`}>{t.puzzles.ratingChange(signed(result.change), result.rating.rating)}</p>
            ) : (
              <p class="ligungi-mates__intro">{t.puzzles.alreadyTried}</p>
            ))}
          {finished && view && (
            <p class="ligungi-game-info__setup">
              {t.puzzles.details(puzzle.id, view.rating, view.plays)} · {t.modes[info.mode]} · {info.themes.map((theme) => t.puzzles.themes[theme]).join(', ')}
            </p>
          )}
          {!daily && (
            <div class="form3 ligungi-mates__filters">
              <Field label={t.puzzles.theme} htmlFor="puzzle-theme">
                <Select
                  id="puzzle-theme"
                  value={filter.theme}
                  options={[{ value: null, label: t.puzzles.all }, ...PUZZLE_THEMES.map((value) => ({ value, label: t.puzzles.themes[value] }))]}
                  onChange={(theme) => changeFilter({ ...filter, theme })}
                />
              </Field>
              <Field label={t.common.mode} htmlFor="puzzle-mode">
                <Select
                  id="puzzle-mode"
                  value={filter.mode}
                  options={[{ value: null, label: t.puzzles.all }, ...MODES.map((value) => ({ value, label: t.modes[value] }))]}
                  onChange={(mode) => changeFilter({ ...filter, mode })}
                />
              </Field>
            </div>
          )}
          <p class="ligungi-mates__progress" data-icon={icons.Checkmark}>
            {t.puzzles.progress(solvedHere, filtered.length)}
          </p>
          <p class="ligungi-puzzle__links">
            {daily ? <a href="/puzzles">{t.puzzles.title}</a> : <a href="/puzzles/daily">{t.puzzles.daily}</a>}
            {user && <a href="/puzzles/dashboard">{t.puzzles.dashboard}</a>}
          </p>
          {loaded && !user && (
            <p class="ligungi-mates__login">
              <a href="/login">{t.puzzles.loginToRate}</a>
            </p>
          )}
        </section>
      }
    />
  );
};
