import { pieceName } from '@ligungi/board';
import {
  ROLES,
  ROLE_INFO,
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
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { usePieceNames, useT } from '../i18n/index.ts';
import { BoardView } from './BoardView.tsx';
import { Checkbox, RadioGroup } from './ui.tsx';

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

/** Interactive lesson: move one piece on its own, at any tower level, with optional enemies. */
export const PieceTrainer = () => {
  const t = useT();
  const pieceNames = usePieceNames();
  const [role, setRole] = useState<Role>('lancer');
  const [level, setLevel] = useState(1);
  const [enemies, setEnemies] = useState(false);
  const [position, setPosition] = useState(() => setup('lancer', 1, false));
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
        <div class="ligungi-trainer__roles">
          {ROLES.filter((r) => r !== 'marshal').map((r) => (
            <button
              key={r}
              type="button"
              class={`button button-metal${r === role ? ' active' : ''}`}
              title={pieceName(r, pieceNames)}
              onClick={() => setRole(r)}
            >
              <span class="ligungi-trainer__kanji">{ROLE_INFO[r].kanji}</span>
            </button>
          ))}
        </div>
        <p>
          <strong>{pieceName(role, pieceNames)}</strong>. {t.trainer.hint}
        </p>
        <RadioGroup name="trainer-level" value={level} options={[1, 2, 3].map((n) => ({ value: n, label: t.trainer.level(n) }))} onChange={setLevel} />
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
      </div>
    </div>
  );
};
