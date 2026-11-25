import { Gungiground, type Api, type Config } from '@ligungi/board';
import { useEffect, useRef } from 'preact/hooks';
import { usePieceNames, useT } from '../i18n/index.ts';
import { guidesShown, prefs } from '../prefs/prefs.ts';
import { useStore } from '../core/store.ts';

export type BoardProps = Partial<Omit<Config, 'pieceNames' | 'moveGuides' | 'pieceStyle' | 'labels' | 'coordinates' | 'coordinateStyle' | 'animation' | 'hoverReach'>>;

/**
 * Preact wrapper around the framework-free board. Only props that changed identity are pushed,
 * so a re-render of the page does not clear the user's selection.
 */
/**
 * `training` marks the boards where the hidden pieces preference applies (casual games, the computer and analysis): a
 * rated game always shows the pieces.
 */
export const BoardView = ({ training = false, ...props }: BoardProps & { readonly training?: boolean }) => {
  const element = useRef<HTMLDivElement>(null);
  const board = useRef<Api | null>(null);
  const last = useRef<Partial<Config>>({});
  const current = useStore(prefs);
  const { coordinates, animation, pieceStyle, notation, hidePieces, peekPieces } = current;
  const moveGuides = guidesShown(current);
  const hidden = training && hidePieces;
  // The reach of a hovered piece tells what it is, so hidden pieces show it only when peeking is allowed.
  const hoverReach = current.hoverReach && (!hidden || peekPieces);
  // The board speaks the same notation as the move list: letters only with the machine notation.
  const coordinateStyle = notation === 'machine' ? 'algebraic' : 'rulebook';
  const pieceNames = usePieceNames();
  const labels = useT().board;

  useEffect(() => {
    board.current = Gungiground(element.current!, { ...props, pieceNames, moveGuides, pieceStyle, labels, coordinates, coordinateStyle, animation, hoverReach });
    last.current = { ...props, pieceNames, moveGuides, pieceStyle, labels, coordinates, coordinateStyle, animation, hoverReach };
    return () => board.current?.destroy();
  }, []);

  useEffect(() => {
    const next: Partial<Config> = { ...props, pieceNames, moveGuides, pieceStyle, labels, coordinates, coordinateStyle, animation, hoverReach };
    const changed: Partial<Config> = {};
    for (const key of Object.keys(next) as Array<keyof Config>) {
      if (next[key] !== last.current[key]) (changed as Record<string, unknown>)[key] = next[key];
    }
    last.current = next;
    if (Object.keys(changed).length && board.current) board.current.set(changed);
  });

  return <div class={`board-view${hidden ? ' gg-hidden-pieces' : ''}${hidden && peekPieces ? ' gg-peek' : ''}`} ref={element} />;
};
