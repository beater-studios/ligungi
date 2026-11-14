import { pieceName, visualSquares } from '@ligungi/board';
import {
  COLORS,
  FIXED_SETUPS,
  MODES,
  ROLES,
  emptyBoard,
  emptyHand,
  fromRulebook,
  initialPosition,
  parseFen,
  pieceLimits,
  positionProblems,
  toFen,
  toRulebook,
  type Color,
  type Mode,
  type Piece,
  type Position,
  type PositionProblem,
  type Role,
  type Square,
} from '@ligungi/engine';
import { useEffect, useState } from 'preact/hooks';
import { PieceGlyph } from '../components/PieceGlyph.tsx';
import { Field, OptionCards, Select } from '../components/ui.tsx';
import { usePieceNames, useT, type Messages } from '../i18n/index.ts';
import { icons } from '../icons.ts';
import { navigate, useLocation } from '../router.ts';

type Tool = { readonly kind: 'piece'; readonly piece: Piece } | { readonly kind: 'erase' };

/** The editor only makes positions in the play phase: a draft is set up by playing it. */
const asPlay = (position: Position): Position => ({ ...position, phase: 'play', freeDraft: false, draftDone: { white: true, black: true } });

/** Both Marshals on their starting squares and nothing else: the usual blank page for a problem. */
const marshalsOnly = (mode: Mode, turn: Color): Position => {
  const board = emptyBoard();
  board[fromRulebook(5, 9)] = [{ role: 'marshal', color: 'white' }];
  board[fromRulebook(5, 1)] = [{ role: 'marshal', color: 'black' }];
  return asPlay({ ...initialPosition(mode), board, hands: { white: emptyHand(), black: emptyHand() }, turn, firstPlayer: 'white' });
};

const fromSearch = (search: string): Position => {
  const fen = new URLSearchParams(search).get('fen');
  if (fen) {
    try {
      return asPlay(parseFen(fen));
    } catch {}
  }
  return initialPosition('intro');
};

const squareLabel = (square: Square): string => {
  const { column, row } = toRulebook(square);
  return `${column}-${row}`;
};

const problemText = (t: Messages, names: ReturnType<typeof usePieceNames>, problem: PositionProblem): string => {
  const e = t.editor.problems;
  switch (problem.kind) {
    case 'marshalCount':
      return e.marshalCount(t.colors[problem.color], problem.count);
    case 'marshalInHand':
      return e.marshalInHand(t.colors[problem.color]);
    case 'tooMany':
      return e.tooMany(t.colors[problem.color], pieceName(problem.role, names), problem.count, problem.max);
    case 'tooHigh':
      return e.tooHigh(squareLabel(problem.square), problem.height, problem.max);
    case 'marshalCovered':
      return e.marshalCovered(squareLabel(problem.square));
    case 'marshalStacked':
      return e.marshalStacked(squareLabel(problem.square));
    case 'waitingInCheck':
      return e.waitingInCheck(t.colors[problem.color]);
  }
};

const MiniPiece = ({ piece, flipped = false }: { piece: Piece; flipped?: boolean }) => (
  <span class={`gg-mini-piece ${piece.color}${flipped ? ' flipped' : ''}`}>
    <PieceGlyph role={piece.role} />
  </span>
);

/**
 * Board editor: place and stack pieces of both sides, fill the hands, pick the mode and who moves. The position is
 * checked against the rules as it changes, and a valid one opens in the analysis or is shared as FEN or link.
 */
export const EditorPage = () => {
  const t = useT();
  const names = usePieceNames();
  const { search } = useLocation();
  const [position, setPosition] = useState<Position>(() => fromSearch(search));
  const [tool, setTool] = useState<Tool>({ kind: 'piece', piece: { role: 'soldier', color: 'white' } });
  const [fenInput, setFenInput] = useState('');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => setPosition(fromSearch(search)), [search]);

  const problems = positionProblems(position);
  const fen = toFen(position);
  const limits = pieceLimits(position.mode);

  const setTower = (square: Square, change: (tower: Piece[]) => Piece[]) => {
    const board = position.board.map((tower) => [...tower]);
    board[square] = change(board[square]!);
    setPosition({ ...position, board });
  };
  const place = (square: Square) =>
    setTower(square, (tower) => (tool.kind === 'erase' ? tower.slice(0, -1) : [...tower, tool.piece]));
  const removeTop = (square: Square, event: Event) => {
    event.preventDefault();
    setTower(square, (tower) => tower.slice(0, -1));
  };
  const changeHand = (color: Color, role: Role, delta: number) =>
    setPosition({
      ...position,
      hands: { ...position.hands, [color]: { ...position.hands[color], [role]: Math.max(0, position.hands[color][role] + delta) } },
    });
  const onBoard = (color: Color, role: Role) =>
    position.board.reduce((sum, tower) => sum + tower.filter((piece) => piece.color === color && piece.role === role).length, 0);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/editor?fen=${encodeURIComponent(fen)}`);
      setMessage({ ok: true, text: t.editor.copied });
    } catch {
      setMessage({ ok: false, text: t.genericError });
    }
  };
  const load = (event: Event) => {
    event.preventDefault();
    try {
      setPosition(asPlay(parseFen(fenInput)));
      setFenInput('');
      setMessage(null);
    } catch {
      setMessage({ ok: false, text: t.editor.invalidFen });
    }
  };

  const describe = (square: Square) => {
    const tower = position.board[square]!;
    const contents = tower.length ? tower.map((piece) => `${pieceName(piece.role, names)} (${t.colors[piece.color]})`).join(', ') : t.editor.emptySquare;
    return t.editor.square(squareLabel(square), contents);
  };

  return (
    <main class="ligungi-page ligungi-editor">
      <header class="ligungi-editor__head">
        <h1>{t.editor.title}</h1>
        <p>{t.editor.intro}</p>
      </header>

      <div class="ligungi-editor__layout">
        <div class="ligungi-editor__board-column">
          <div class="gg-mini gg-palette ligungi-editor__board">
            {visualSquares('white').map((square) => {
              const tower = position.board[square]!;
              const top = tower[tower.length - 1];
              return (
                <button
                  key={square}
                  type="button"
                  class="gg-mini-sq ligungi-editor__sq"
                  aria-label={describe(square)}
                  title={describe(square)}
                  onClick={() => place(square)}
                  onContextMenu={(event) => removeTop(square, event)}
                >
                  {top && (
                    <span class={`gg-mini-piece ${top.color}${top.color === 'black' ? ' flipped' : ''}`}>
                      <PieceGlyph role={top.role} />
                      {tower.length > 1 && <i>{tower.length}</i>}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <p class="ligungi-editor__hint">{t.editor.boardHint}</p>
        </div>

        <div class="ligungi-editor__panel">
          <section class="ligungi-card ligungi-editor__card">
            <h2>{t.editor.pieces}</h2>
            <div class="ligungi-editor__palette gg-palette" role="group" aria-label={t.editor.pieces}>
              {COLORS.map((color) => (
                <div key={color} class="ligungi-editor__palette-row">
                  {ROLES.map((role) => {
                    const active = tool.kind === 'piece' && tool.piece.role === role && tool.piece.color === color;
                    return (
                      <button
                        key={role}
                        type="button"
                        class={`ligungi-editor__tool${active ? ' active' : ''}`}
                        aria-pressed={active}
                        title={`${pieceName(role, names)} (${t.colors[color]})`}
                        aria-label={`${pieceName(role, names)} (${t.colors[color]})`}
                        onClick={() => setTool({ kind: 'piece', piece: { role, color } })}
                      >
                        <MiniPiece piece={{ role, color }} />
                      </button>
                    );
                  })}
                </div>
              ))}
              <button
                type="button"
                class={`button button-empty ligungi-editor__erase${tool.kind === 'erase' ? ' active' : ''}`}
                aria-pressed={tool.kind === 'erase'}
                data-icon={icons.X}
                onClick={() => setTool({ kind: 'erase' })}
              >
                {t.editor.erase}
              </button>
            </div>
          </section>

          <section class="ligungi-card ligungi-editor__card gg-palette">
            <h2>{t.editor.hands}</h2>
            {COLORS.map((color) => (
              <div key={color} class="ligungi-editor__hand">
                <span class="ligungi-editor__hand-title">{t.colors[color]}</span>
                <ul>
                  {ROLES.filter((role) => role !== 'marshal' && limits[role] > 0).map((role) => {
                    const count = position.hands[color][role];
                    const full = onBoard(color, role) + count >= limits[role];
                    const name = pieceName(role, names);
                    return (
                      <li key={role}>
                        <MiniPiece piece={{ role, color }} />
                        <button type="button" class="ligungi-editor__step" aria-label={t.editor.removeFromHand(name)} disabled={count === 0} onClick={() => changeHand(color, role, -1)}>
                          −
                        </button>
                        <span class="ligungi-editor__count">{count}</span>
                        <button type="button" class="ligungi-editor__step" aria-label={t.editor.addToHand(name)} disabled={full} onClick={() => changeHand(color, role, 1)}>
                          +
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </section>

          <section class="ligungi-card ligungi-editor__card form3">
            <Field label={t.common.mode} htmlFor="editor-mode">
              <Select
                id="editor-mode"
                value={position.mode}
                options={MODES.map((mode) => ({ value: mode, label: t.modes[mode] }))}
                onChange={(mode) => setPosition({ ...position, mode })}
              />
            </Field>
            <OptionCards
              name="editor-turn"
              legend={t.editor.turn}
              layout="segmented"
              value={position.turn}
              options={COLORS.map((color) => ({ value: color, label: t.colors[color] }))}
              onChange={(turn) => setPosition({ ...position, turn })}
            />
            <div class="ligungi-editor__buttons">
              <button type="button" class="button button-empty" onClick={() => setPosition(marshalsOnly(position.mode, position.turn))}>
                {t.editor.marshalsOnly}
              </button>
              {FIXED_SETUPS[position.mode] && (
                <button type="button" class="button button-empty" onClick={() => setPosition(initialPosition(position.mode))}>
                  {t.editor.initial}
                </button>
              )}
            </div>
          </section>

          <section class="ligungi-card ligungi-editor__card">
            {problems.length > 0 ? (
              <>
                <h2>{t.editor.problemsTitle}</h2>
                <ul class="ligungi-warnings" role="status">
                  {problems.map((problem, index) => (
                    <li key={index}>{problemText(t, names, problem)}</li>
                  ))}
                </ul>
              </>
            ) : (
              <p class="ligungi-success" role="status">
                {t.editor.valid}
              </p>
            )}
            <label class="ligungi-fen ligungi-editor__fen">
              <span>FEN</span>
              <input class="form-control" readOnly value={fen} onFocus={(e) => (e.target as HTMLInputElement).select()} />
            </label>
            <div class="ligungi-editor__buttons">
              <button type="button" class="button" disabled={problems.length > 0} onClick={() => navigate(`/analysis?fen=${encodeURIComponent(fen)}`)}>
                {t.editor.openAnalysis}
              </button>
              <button type="button" class="button button-empty" onClick={() => void copyLink()}>
                {t.editor.copyLink}
              </button>
            </div>
            <form class="ligungi-editor__load" onSubmit={load}>
              <input
                class="form-control"
                aria-label={t.editor.pasteFen}
                placeholder={t.editor.pasteFen}
                value={fenInput}
                onInput={(e) => setFenInput((e.target as HTMLInputElement).value)}
              />
              <button type="submit" class="button button-empty" disabled={!fenInput.trim()}>
                {t.editor.load}
              </button>
            </form>
            {message && <p class={message.ok ? 'ligungi-success' : 'error'}>{message.text}</p>}
          </section>
        </div>
      </div>
    </main>
  );
};
