import { pieceName } from '@ligungi/board';
import {
  MODES,
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
import { useEffect, useState } from 'preact/hooks';
import { MiniBoard } from '../components/MiniBoard.tsx';
import { PieceGlyph } from '../components/PieceGlyph.tsx';
import { icons } from '../icons.ts';
import { PieceTrainer } from '../components/PieceTrainer.tsx';
import { useContent } from '../i18n/content/index.ts';
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

type SectionId = 'objective' | 'board' | 'towers' | 'pieces' | 'hand' | 'setup' | 'modes' | 'sources';
const SECTIONS: readonly SectionId[] = ['objective', 'board', 'towers', 'pieces', 'hand', 'setup', 'modes', 'sources'];

/** The section being read: the last one whose top has passed a line near the top of the screen. */
const useCurrentSection = (): SectionId => {
  const [current, setCurrent] = useState<SectionId>('objective');
  useEffect(() => {
    const update = () => {
      let found: SectionId = 'objective';
      for (const id of SECTIONS) {
        const element = document.getElementById(id);
        if (element && element.getBoundingClientRect().top <= 120) found = id;
      }
      setCurrent(found);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);
  return current;
};

/** How to play: a table of contents beside the sections, and the pieces with their diagrams and a trainer. */
export const LearnPage = () => {
  const t = useT();
  const l = t.learn;
  const pieceNames = usePieceNames();
  const content = useContent();
  const [role, setRole] = useState<Role>('lancer');
  const current = useCurrentSection();
  const step = (by: number) => setRole(ROLES[(ROLES.indexOf(role) + by + ROLES.length) % ROLES.length]!);
  const titles: Record<SectionId, string> = {
    objective: l.objectiveTitle,
    board: l.boardTitle,
    towers: l.towersTitle,
    pieces: l.movementTitle,
    hand: l.handTitle,
    setup: l.setupTitle,
    modes: l.modesTitle,
    sources: l.sourcesTitle,
  };

  return (
    <main class="ligungi-page ligungi-learn">
      <nav class="ligungi-card ligungi-learn__toc" aria-label={l.contents}>
        {SECTIONS.map((id) => (
          <a key={id} href={`#${id}`} class={id === current ? 'active' : ''} aria-current={id === current ? 'true' : undefined}>
            {titles[id]}
          </a>
        ))}
      </nav>

      <div class="ligungi-learn__body">
        <header class="ligungi-card ligungi-learn__intro">
          <h1>{l.title}</h1>
          <p>{l.lead}</p>
        </header>

        <section id="objective" class="ligungi-card ligungi-learn__section">
          <h2>{titles.objective}</h2>
          <p>{l.objective}</p>
        </section>

        <section id="board" class="ligungi-card ligungi-learn__section">
          <h2>{titles.board}</h2>
          <p>{l.board}</p>
        </section>

        <section id="towers" class="ligungi-card ligungi-learn__section">
          <h2>{titles.towers}</h2>
          <ul>
            {l.towers.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section id="pieces" class="ligungi-card ligungi-learn__section">
          <h2>{titles.pieces}</h2>
          <p>{l.piecesHint}</p>
          <div class="ligungi-learn__pieces" role="group" aria-label={titles.pieces}>
            {ROLES.map((r) => (
              <button key={r} type="button" class={`ligungi-learn__piece${r === role ? ' is-selected' : ''}`} aria-pressed={r === role} onClick={() => setRole(r)}>
                <span class="gg-palette ligungi-learn__glyph" aria-hidden="true">
                  <span class="gg-mini-piece white">
                    <PieceGlyph role={r} />
                  </span>
                </span>
                <span class="ligungi-learn__piece-text">
                  <span class="ligungi-learn__piece-name">{pieceName(r, pieceNames)}</span>
                  <span class="ligungi-learn__piece-meta">
                    {ROLE_INFO[r].kanji} · ×{ROLE_INFO[r].count}
                  </span>
                </span>
              </button>
            ))}
          </div>

          <PieceTrainer
            role={role}
            head={
              <div class="ligungi-learn__nav">
                <button type="button" class="button button-empty" data-icon={icons.JumpPrev} aria-label={l.previousPiece} title={l.previousPiece} onClick={() => step(-1)} />
                <h3>
                  {ROLE_INFO[role].kanji} {pieceName(role, pieceNames)}
                </h3>
                <button type="button" class="button button-empty" data-icon={icons.JumpNext} aria-label={l.nextPiece} title={l.nextPiece} onClick={() => step(1)} />
              </div>
            }
            description={l.notes[role] && <p>{l.notes[role]}</p>}
          >
            <div class="ligungi-learn__detail">
              <figure class="ligungi-learn__diagram">
                <MiniBoard position={DIAGRAMS[role].position} marks={DIAGRAMS[role].marks} />
                <figcaption class="ligungi-learn__legend">
                  <span class="tier-1">{l.tier(1)}</span> <span class="tier-2">{l.tier(2)}</span> <span class="tier-3">{l.tier(3)}</span>
                </figcaption>
              </figure>
            </div>
          </PieceTrainer>
        </section>

        <section id="hand" class="ligungi-card ligungi-learn__section">
          <h2>{titles.hand}</h2>
          <p>{l.hand}</p>
        </section>

        <section id="setup" class="ligungi-card ligungi-learn__section">
          <h2>{titles.setup}</h2>
          <p>{l.setup}</p>
        </section>

        <section id="modes" class="ligungi-card ligungi-learn__section">
          <h2>{titles.modes}</h2>
          <dl class="ligungi-learn__modes">
            {MODES.map((mode) => (
              <div key={mode}>
                <dt>{t.modes[mode]}</dt>
                <dd>{t.modeDescriptions[mode]}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section id="sources" class="ligungi-card ligungi-learn__section">
          <h2>{titles.sources}</h2>
          {content.sources}
        </section>
      </div>
    </main>
  );
};
