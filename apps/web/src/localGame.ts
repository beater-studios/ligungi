import { type Move, type Position } from '@ligungi/engine';
import { useCallback, useMemo, useState } from 'preact/hooks';
import { replayFrom } from './replay.ts';

/** A game kept in the browser: history, navigation and branching from an earlier ply. */
export const useLocalGame = (initial: Position) => {
  const [state, setState] = useState<{ start: Position; moves: readonly Move[] }>({ start: initial, moves: [] });
  const [ply, setPly] = useState<number | null>(null);
  const replay = useMemo(() => replayFrom(state.start, state.moves), [state]);

  const play = useCallback(
    (move: Move) => {
      setState((current) => {
        const cut = ply === null ? current.moves : current.moves.slice(0, ply);
        return { start: current.start, moves: [...cut, move] };
      });
      setPly(null);
    },
    [ply],
  );

  const undo = useCallback((count = 1) => {
    setState((current) => ({ start: current.start, moves: current.moves.slice(0, Math.max(0, current.moves.length - count)) }));
    setPly(null);
  }, []);

  const reset = useCallback((start: Position, moves: readonly Move[] = []) => {
    setState({ start, moves });
    setPly(null);
  }, []);

  const position = ply === null ? replay.game.position : replay.positions[ply]!;
  const lastMove = ply === null ? (replay.moves[replay.moves.length - 1] ?? null) : ply > 0 ? replay.moves[ply - 1]! : null;

  return { replay, ply, setPly, play, undo, reset, position, lastMove, start: state.start };
};
