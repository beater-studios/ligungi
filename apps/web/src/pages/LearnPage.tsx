import { pieceName } from '@ligungi/board';
import {
  ROLES,
  ROLE_INFO,
  emptyBoard,
  emptyHand,
  reachableSquares,
  squareAt,
  type Position,
  type Role,
  type Square,
} from '@ligungi/engine';
import { MiniBoard } from '../components/MiniBoard.tsx';
import { PieceTrainer } from '../components/PieceTrainer.tsx';
import { usePieceNames, useT } from '../i18n/index.ts';

const CENTER = squareAt(4, 4);

/** Squares reached at tier 1, 2 and 3 on an empty board, like the rulebook diagrams. */
const diagram = (role: Role): { position: Position; marks: Map<Square, string> } => {
  const marks = new Map<Square, string>();
  let shown: Position | null = null;
  for (const tier of [3, 2, 1]) {
    const board = emptyBoard();
    board[CENTER] = [...Array.from({ length: tier - 1 }, () => ({ role: 'soldier' as const, color: 'white' as const })), { role, color: 'white' }];
    const position: Position = {
      mode: 'advanced',
      phase: 'play',
      board,
      hands: { white: emptyHand(), black: emptyHand() },
      turn: 'white',
      firstPlayer: 'white',
      freeDraft: false,
      draftDone: { white: true, black: true },
    };
    for (const square of reachableSquares(position, CENTER)) marks.set(square, `tier-${tier}`);
    if (tier === 1) {
      const single = emptyBoard();
      single[CENTER] = [{ role, color: 'white' }];
      shown = { ...position, board: single };
    }
  }
  return { position: shown!, marks };
};

const DIAGRAMS = Object.fromEntries(ROLES.map((role) => [role, diagram(role)])) as Record<Role, ReturnType<typeof diagram>>;

export const LearnPage = () => {
  const t = useT();
  const l = t.learn;
  const pieceNames = usePieceNames();
  return (
    <main class="page-small box box-pad page learn">
      <h1 class="box__top">{l.title}</h1>
      <p class="lead">{l.lead}</p>

      <section>
        <h2>{l.tryIt}</h2>
        <PieceTrainer />
      </section>

      <section>
        <h2>{l.objectiveTitle}</h2>
        <p>{l.objective}</p>
      </section>

      <section>
        <h2>{l.boardTitle}</h2>
        <p>{l.board}</p>
      </section>

      <section>
        <h2>{l.towersTitle}</h2>
        <ul>
          {l.towers.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2>{l.handTitle}</h2>
        <p>{l.hand}</p>
      </section>

      <section>
        <h2>{l.setupTitle}</h2>
        <p>{l.setup}</p>
      </section>

      <section>
        <h2>{l.movementTitle}</h2>
        <p class="legend">
          <span class="tier-1">{l.tier(1)}</span> <span class="tier-2">{l.tier(2)}</span> <span class="tier-3">{l.tier(3)}</span>
        </p>
        <div class="piece-grid">
          {ROLES.map((role) => (
            <figure key={role}>
              <MiniBoard position={DIAGRAMS[role].position} marks={DIAGRAMS[role].marks} />
              <figcaption>
                <b>
                  {ROLE_INFO[role].kanji} {pieceName(role, pieceNames)}
                </b>{' '}
                ×{ROLE_INFO[role].count}
                {l.notes[role] && <small>{l.notes[role]}</small>}
              </figcaption>
            </figure>
          ))}
        </div>
      </section>
    </main>
  );
};
