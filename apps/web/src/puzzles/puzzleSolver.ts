import { applyMove, initialPosition, legalMoves, moveToString, parseFen, parseMove, toFen, type Move, type Position } from '@ligungi/engine';
import { puzzleInfo, type Puzzle, type PuzzleInfo } from '@ligungi/content';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useLocalGame } from '../game/localGame.ts';
import { moveSound } from '../blind/speech.ts';

export interface PuzzleEntry {
  readonly puzzle: Puzzle;
  readonly info: PuzzleInfo;
  readonly start: Position;
}

export interface PuzzleEntries {
  readonly list: readonly PuzzleEntry[];
  readonly byId: ReadonlyMap<string, PuzzleEntry>;
}

let loading: Promise<PuzzleEntries> | null = null;

/** Every puzzle, read once per visit: the collection loads on demand, as it is too big for the first page load. */
const loadEntries = (): Promise<PuzzleEntries> =>
  (loading ??= import('@ligungi/content/puzzles').then(({ PUZZLES }) => {
    const list = PUZZLES.map((puzzle) => ({ puzzle, info: puzzleInfo(puzzle), start: parseFen(puzzle.fen) }));
    return { list, byId: new Map(list.map((entry) => [entry.puzzle.id, entry])) };
  }));

/** The puzzles, once loaded. */
export const usePuzzleEntries = (): PuzzleEntries | null => {
  const [entries, setEntries] = useState<PuzzleEntries | null>(null);
  useEffect(() => {
    let alive = true;
    void loadEntries().then((loaded) => alive && setEntries(loaded));
    return () => {
      alive = false;
    };
  }, []);
  return entries;
};

/** Checking: a mating move off the stored line is being checked in the worker. Answering: the opponent's reply is coming. */
export type SolveStage = 'solving' | 'checking' | 'answering' | 'wrong' | 'done';

export interface SolveEvents {
  /** A move on the solution (or another mate); `finished` when it ends the puzzle. */
  readonly onCorrect: (finished: boolean) => void;
  /** A wrong move, left on the board; `notCheck` when a mate puzzle got a move that does not attack the Marshal. */
  readonly onWrong: (notCheck: boolean) => void;
}

const PLACEHOLDER = initialPosition('intro');

/**
 * Solving one puzzle at a time on a local board: the solver's moves are checked against the stored line, and in mates any
 * other mating move is accepted (checked in the mate worker, which also finds the defense to it). The opponent's replies
 * come after `answerDelay` ms. What a right or wrong move means is up to the page.
 */
export const usePuzzleSolver = (events: SolveEvents, answerDelay = 450) => {
  const local = useLocalGame(PLACEHOLDER);
  const [entry, setEntry] = useState<PuzzleEntry | null>(null);
  const [stage, setStage] = useState<SolveStage>('solving');
  const onLine = useRef(true);
  const worker = useRef<Worker | null>(null);
  const request = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Replies and checks finish later: they call the page's latest callbacks, not the ones of the render that started them.
  const latest = useRef(events);
  latest.current = events;

  useEffect(() => {
    worker.current = new Worker(new URL('./mate.worker.ts', import.meta.url), { type: 'module' });
    return () => {
      worker.current?.terminate();
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  /** Drops a pending reply or check. */
  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    request.current++;
  };

  const begin = (next: PuzzleEntry) => {
    cancel();
    onLine.current = true;
    setEntry(next);
    local.reset(next.start);
    setStage('solving');
  };

  const stop = () => {
    cancel();
    setStage('done');
  };

  /** Takes the wrong move back and lets the solver try again. */
  const retry = () => {
    local.undo();
    setStage('solving');
  };

  const { replay } = local;
  const position = local.position;
  const yourTurn = entry !== null && stage === 'solving' && local.ply === null && position.turn === entry.info.color && !replay.game.outcome;
  const moves = useMemo(() => (yourTurn ? legalMoves(position) : []), [yourTurn, position]);

  /** `from`: the position after the solver's move, which the reply is played from. */
  const answer = (reply: string | null, last: boolean, from: Position) => {
    if (last || reply === null) {
      setStage('done');
      latest.current.onCorrect(true);
      return;
    }
    setStage('answering');
    latest.current.onCorrect(false);
    timer.current = setTimeout(() => {
      const move = parseMove(reply);
      if (move) {
        moveSound('training', from, move, 'opponent');
        local.play(move);
      }
      setStage('solving');
    }, answerDelay);
  };

  const wrong = (notCheck: boolean) => {
    setStage('wrong');
    latest.current.onWrong(notCheck);
  };

  const onMove = (move: Move) => {
    if (!entry) return;
    const { puzzle, info } = entry;
    const before = position;
    const played = replay.moves.length;
    const left = info.moves - Math.floor(played / 2);
    const text = moveToString(move);
    moveSound('training', before, move, 'self');
    local.play(move);
    const after = applyMove(before, move);
    if (onLine.current && puzzle.line[played] === text) return answer(puzzle.line[played + 1] ?? null, left === 1, after);
    if (info.kind === 'material') return wrong(false);
    setStage('checking');
    const ticket = ++request.current;
    const listener = (event: MessageEvent<{ id: number; check: boolean; ok: boolean; defense: string | null }>) => {
      if (event.data.id !== ticket) return;
      worker.current?.removeEventListener('message', listener);
      if (request.current !== ticket) return;
      if (!event.data.ok) return wrong(!event.data.check);
      onLine.current = false;
      answer(event.data.defense, left === 1, after);
    };
    worker.current?.addEventListener('message', listener);
    worker.current?.postMessage({ id: ticket, fen: toFen(before), move: text, moves: left });
  };

  return { local, entry, stage, yourTurn, moves, begin, stop, retry, onMove };
};
