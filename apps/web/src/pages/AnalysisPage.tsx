import {
  MODES,
  initialPosition,
  legalMoves,
  moveToRulebook,
  opposite,
  parseFen,
  parseMove,
  toFen,
  type Color,
  type Mode,
  type Move,
} from '@ligungi/engine';
import type { GameView } from '@ligungi/protocol';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { api } from '../api.ts';
import { BoardView } from '../components/BoardView.tsx';
import { DraftPanel, TowerPanel } from '../components/Panels.tsx';
import { outcomeText, useT } from '../i18n/index.ts';
import { icons } from '../icons.ts';
import { useLocalGame } from '../localGame.ts';
import { useLocation } from '../router.ts';

export const AnalysisPage = () => {
  const t = useT();
  const { search } = useLocation();
  const local = useLocalGame(initialPosition('advanced'));
  const [orientation, setOrientation] = useState<Color>('white');
  const [fenInput, setFenInput] = useState('');
  const [mode, setMode] = useState<Mode>('advanced');
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [hands, setHands] = useState<{ top: HTMLElement; bottom: HTMLElement } | null>(null);
  const topHand = useRef<HTMLDivElement>(null);
  const bottomHand = useRef<HTMLDivElement>(null);
  const tree = useRef<HTMLDivElement>(null);
  const [inspected, setInspected] = useState<number | null>(null);

  useEffect(() => {
    if (topHand.current && bottomHand.current) setHands({ top: topHand.current, bottom: bottomHand.current });
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(search);
    const gameId = params.get('game');
    const fen = params.get('fen');
    const queryMode = params.get('mode') as Mode | null;
    if (gameId) {
      api
        .get<GameView>(`/api/games/${gameId}`)
        .then((game) => {
          const moves = game.moves.map(parseMove).filter((m): m is Move => Boolean(m));
          local.reset(initialPosition(game.mode, game.firstPlayer, { freeDraft: game.freeDraft }), moves);
          setMode(game.mode);
          setSource(gameId);
          if (game.you) setOrientation(game.you);
        })
        .catch((err: Error) => setError(err.message));
    } else if (fen) {
      try {
        local.reset(parseFen(fen));
      } catch {
        setError(t.analysis.invalidFen);
      }
    } else if (queryMode && (MODES as readonly string[]).includes(queryMode)) {
      const first = params.get('first') === 'black' ? 'black' : 'white';
      const moves = (params.get('moves') ?? '').split(',').map(parseMove).filter((m): m is Move => Boolean(m));
      local.reset(initialPosition(queryMode, first, { freeDraft: params.get('free') === '1' }), moves);
      setMode(queryMode);
    }
  }, [search]);

  const position = local.position;
  const legal = useMemo(() => legalMoves(position), [position]);
  const outcome = local.ply === null ? (local.replay.game.outcome ?? null) : null;
  const doneAvailable = position.phase === 'draft' && legal.some((m) => m.kind === 'done');
  const { replay } = local;
  const current = local.ply ?? replay.moves.length;
  const go = (next: number) => {
    const clamped = Math.max(0, Math.min(replay.moves.length, next));
    local.setPly(clamped === replay.moves.length ? null : clamped);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      const keys: Record<string, number> = { ArrowLeft: current - 1, ArrowRight: current + 1, ArrowUp: 0, Home: 0, ArrowDown: replay.moves.length, End: replay.moves.length };
      const next = keys[event.key];
      if (next === undefined) return;
      event.preventDefault();
      go(next);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current, replay.moves.length]);

  useEffect(() => {
    const active = tree.current?.querySelector('move.active') as HTMLElement | null;
    if (active && tree.current) tree.current.scrollTop = active.offsetTop - tree.current.clientHeight / 2;
  }, [current]);

  const loadFen = (event: Event) => {
    event.preventDefault();
    try {
      local.reset(parseFen(fenInput));
      setError(null);
      setSource(null);
    } catch {
      setError(t.analysis.invalidFen);
    }
  };

  const rows = [];
  for (let i = 0; i < replay.moves.length; i += 2) {
    rows.push(<index key={`i${i}`}>{i / 2 + 1}</index>);
    for (const j of [i, i + 1]) {
      const move = replay.moves[j];
      if (!move) continue;
      rows.push(
        <move key={`m${j}`} class={j + 1 === current ? 'active' : ''} onClick={() => go(j + 1)}>
          {moveToRulebook(replay.positions[j]!, move)}
        </move>,
      );
    }
  }

  const status = outcome
    ? outcomeText(t, outcome)
    : t.turnStatus(position.phase === 'draft', position.turn, null);

  return (
    <main class="analyse variant-crazyhouse">
      <div class="analyse__side">
        <div class="game__meta">
          <section>
            <div class="game__meta__infos" data-icon={icons.Microscope}>
              <div>
                <div class="header">
                  <div class="setup">{t.analysis.title} · {t.modes[local.start.mode]}</div>
                </div>
              </div>
            </div>
          </section>
          {source && (
            <section>
              {t.analysis.fromGame(<a href={`/${source}`}>{source}</a>)}
            </section>
          )}
          <section class="status">{status}</section>
          {error && <section class="ligungi-error">{error}</section>}
        </div>
        <div class="ligungi-panels box">
          <DraftPanel position={position} names={t.colors} />
          <TowerPanel position={position} square={inspected} />
        </div>
      </div>
      <div class="analyse__board main-board">
        {hands && (
          <BoardView
            position={position}
            orientation={orientation}
            movableColor={outcome ? null : 'both'}
            moves={outcome ? [] : legal}
            lastMove={local.lastMove}
            onMove={local.play}
            handElements={hands}
            inspector={false}
            onInspect={setInspected}
          />
        )}
      </div>
      <div class="pocket is2d pocket-top" ref={topHand} />
      <div class="pocket is2d pocket-bottom" ref={bottomHand} />
      <div class="analyse__tools">
        <div class="analyse__moves areplay">
          <div class="tview2 tview2-column" ref={tree}>
            {rows.length ? rows : <p class="ligungi-empty">{t.analysis.empty}</p>}
          </div>
        </div>
      </div>
      <div class="analyse__controls analyse-controls">
        <div class="features">
          <button type="button" class="fbt" title={t.common.flip} data-icon={icons.ChasingArrows} onClick={() => setOrientation((o) => opposite(o))} />
          <button type="button" class="fbt" title={t.common.takeback} data-icon={icons.Back} onClick={() => local.undo()} />
        </div>
        <div class="jumps">
          <button type="button" class="fbt" title={t.common.first} data-icon={icons.JumpFirst} onClick={() => go(0)} />
          <button type="button" class="fbt" title={t.common.prev} data-icon={icons.JumpPrev} onClick={() => go(current - 1)} />
          <button type="button" class="fbt" title={t.common.next} data-icon={icons.JumpNext} onClick={() => go(current + 1)} />
          <button type="button" class="fbt" title={t.common.last} data-icon={icons.JumpLast} onClick={() => go(replay.moves.length)} />
        </div>
      </div>
      <div class="analyse__underboard">
        <div class="ligungi-tools box">
          {doneAvailable && (
            <button type="button" class="button ligungi-done" onClick={() => local.play({ kind: 'done' })}>
              済み {t.done}
            </button>
          )}
          <div class="form3 ligungi-row">
            <select class="form-control" value={mode} onChange={(e) => setMode((e.target as HTMLSelectElement).value as Mode)}>
              {MODES.map((m) => (
                <option key={m} value={m}>
                  {t.modes[m]}
                </option>
              ))}
            </select>
            <button type="button" class="button" onClick={() => (local.reset(initialPosition(mode)), setSource(null))}>
              {t.analysis.newPosition}
            </button>
          </div>
          <form class="form3 ligungi-row" onSubmit={loadFen}>
            <input class="form-control" placeholder={t.analysis.pasteFen} value={fenInput} onInput={(e) => setFenInput((e.target as HTMLInputElement).value)} />
            <button type="submit" class="button">
              {t.analysis.load}
            </button>
          </form>
          <label class="ligungi-fen">
            FEN
            <input class="form-control copyable" readOnly value={toFen(position)} onFocus={(e) => (e.target as HTMLInputElement).select()} />
          </label>
        </div>
      </div>
    </main>
  );
};
