import { Gungiground, type Api, type Config } from '@ligungi/board';
import { useEffect, useRef } from 'preact/hooks';
import { usePieceNames, useT } from '../i18n/index.ts';
import { prefs } from '../prefs.ts';
import { useStore } from '../store.ts';

export type BoardProps = Partial<Omit<Config, 'pieceNames' | 'labels' | 'coordinates' | 'animation' | 'hoverReach'>>;

/**
 * Preact wrapper around the framework-free board. Only props that changed identity are pushed,
 * so a re-render of the page does not clear the user's selection.
 */
export const BoardView = (props: BoardProps) => {
  const element = useRef<HTMLDivElement>(null);
  const board = useRef<Api | null>(null);
  const last = useRef<Partial<Config>>({});
  const { coordinates, animation, hoverReach } = useStore(prefs);
  const pieceNames = usePieceNames();
  const labels = useT().board;

  useEffect(() => {
    board.current = Gungiground(element.current!, { ...props, pieceNames, labels, coordinates, animation, hoverReach });
    last.current = { ...props, pieceNames, labels, coordinates, animation, hoverReach };
    return () => board.current?.destroy();
  }, []);

  useEffect(() => {
    const next: Partial<Config> = { ...props, pieceNames, labels, coordinates, animation, hoverReach };
    const changed: Partial<Config> = {};
    for (const key of Object.keys(next) as Array<keyof Config>) {
      if (next[key] !== last.current[key]) (changed as Record<string, unknown>)[key] = next[key];
    }
    last.current = next;
    if (Object.keys(changed).length && board.current) board.current.set(changed);
  });

  return <div class="board-view" ref={element} />;
};
