import {
  applyMove,
  emptyBoard,
  emptyHand,
  legalMoves,
  parseSquare,
  type Move,
  type Piece,
  type Position,
  type Role,
} from '@ligungi/engine';
import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useT } from '../i18n/index.ts';
import { BoardView } from './BoardView.tsx';
import { Checkbox, OptionCards } from './ui.tsx';

const ENEMIES: Record<string, Piece[]> = {
  d7: [{ role: 'soldier', color: 'black' }],
  f7: [{ role: 'soldier', color: 'black' }, { role: 'soldier', color: 'black' }],
  e8: [{ role: 'samurai', color: 'black' }],
  c5: [{ role: 'fortress', color: 'black' }],
  g5: [{ role: 'soldier', color: 'black' }, { role: 'soldier', color: 'black' }, { role: 'spy', color: 'black' }],
  e3: [{ role: 'soldier', color: 'white' }],
};

const setup = (role: Role, level: number, enemies: boolean): Position => {
  const board = emptyBoard();
  const tower: Piece[] = Array.from({ length: level - 1 }, () => ({ role: 'soldier', color: 'white' }));
  board[parseSquare('e5')!] = [...tower, { role, color: 'white' }];
  if (enemies) for (const [name, pieces] of Object.entries(ENEMIES)) board[parseSquare(name)!] = pieces;
  return {
    mode: 'advanced',
    phase: 'play',
    board,
    hands: { white: emptyHand(), black: emptyHand() },
    turn: 'white',
    firstPlayer: 'white',
    freeDraft: false,
    draftDone: { white: true, black: true },
  };
};

/**
 * Interactive lesson: move one piece on its own, at any tower level, with optional enemies. The page picks the piece,
 * puts its own heading above the controls (`head`) and anything else under them on wide screens, after the board on
 * phones (`children`).
 */
export const PieceTrainer = ({
  role,
  head,
  description,
  children,
}: {
  role: Role;
  head?: ComponentChildren;
  /** What the page says about the piece, under the heading. */
  description?: ComponentChildren;
  children?: ComponentChildren;
}) => {
  const t = useT();
  const [level, setLevel] = useState(1);
  const [enemies, setEnemies] = useState(false);
  const [position, setPosition] = useState(() => setup(role, 1, false));
  const [lastMove, setLastMove] = useState<Move | null>(null);
  const [hands, setHands] = useState<{ top: HTMLElement; bottom: HTMLElement } | null>(null);
  const top = useRef<HTMLDivElement>(null);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (top.current && bottom.current) setHands({ top: top.current, bottom: bottom.current });
  }, []);

  useEffect(() => {
    setPosition(setup(role, level, enemies));
    setLastMove(null);
  }, [role, level, enemies]);

  const moves = useMemo(() => legalMoves(position).filter((m) => m.kind === 'move'), [position]);

  return (
    <div class="ligungi-trainer">
      <div class="ligungi-trainer__controls">
        {head}
        {description}
        <OptionCards
          name="trainer-level"
          legend={t.trainer.towerLevel}
          layout="segmented"
          value={level}
          options={[1, 2, 3].map((n) => ({ value: n, label: t.trainer.level(n) }))}
          onChange={setLevel}
        />
        <Checkbox id="trainer-enemies" checked={enemies} onChange={setEnemies} label={t.trainer.enemies} />
        <button type="button" class="button button-empty" onClick={() => (setPosition(setup(role, level, enemies)), setLastMove(null))}>
          {t.trainer.restart}
        </button>
      </div>
      <div class="ligungi-trainer__board">
        {hands && (
          <BoardView
            position={position}
            orientation="white"
            movableColor="white"
            moves={moves}
            lastMove={lastMove}
            handElements={hands}
            onMove={(move) => {
              setLastMove(move);
              setPosition({ ...applyMove(position, move), turn: 'white' });
            }}
          />
        )}
        <div hidden ref={top} />
        <div hidden ref={bottom} />
        <p class="ligungi-trainer__hint">{t.trainer.hint}</p>
      </div>
      {children !== undefined && <div class="ligungi-trainer__extra">{children}</div>}
    </div>
  );
};
