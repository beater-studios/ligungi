import {
  MODES,
  initialPosition,
  legalMoves,
  opposite,
  parseFen,
  parseMove,
  positionProblems,
  toFen,
  type Color,
  type Mode,
  type Move,
} from '@ligungi/engine';
import type { GameView } from '@ligungi/protocol';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { api } from '../api.ts';
import { sayMove } from '../speech.ts';
import { BlindPanel } from '../components/BlindPanel.tsx';
import { BoardView } from '../components/BoardView.tsx';
import { ImportGame } from '../components/ImportGame.tsx';
import { DraftPanel, TowerPanel, TowerStrip } from '../components/Panels.tsx';
import { Select } from '../components/ui.tsx';
import { outcomeText, useT } from '../i18n/index.ts';
import { useMoveText } from '../notation.ts';
import { icons } from '../icons.ts';
import { useLocalGame } from '../localGame.ts';
import { prefs } from '../prefs.ts';
import { navigate, useLocation } from '../router.ts';
import { useStore } from '../store.ts';
import { useTowerTap } from '../towerTap.ts';

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
  const [importing, setImporting] = useState(false);
  const { screenReader } = useStore(prefs);
  const hidden = screenReader ? 'true' : undefined;
  const tap = useTowerTap(true);

  useEffect(() => {
    if (topHand.current && bottomHand.current) setHands({ top: topHand.current, bottom: bottomHand.current });
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(search);
    const gameId = params.get('game');
    const fen = params.get('fen');
    const queryMode = params.get('mode') as Mode | null;
    // The Tools menu opens the import dialog through ?import.
    if (params.has('import')) setImporting(true);
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
  // Spoken moves: the move that leads to the position shown, each time it changes (a new position says nothing).
  const shownMove = current > 0 ? replay.moves[current - 1] : undefined;
  const firstShown = useRef(true);
  useEffect(() => {
    if (firstShown.current) {
      firstShown.current = false;
      return;
    }
    const before = replay.positions[current - 1];
    if (shownMove && before) sayMove('review', before, shownMove, 'other');
  }, [current, shownMove]);
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
  const moveText = useMoveText();
  for (let i = 0; i < replay.moves.length; i += 2) {
    rows.push(<index key={`i${i}`}>{i / 2 + 1}</index>);
    for (const j of [i, i + 1]) {
      const move = replay.moves[j];
      if (!move) continue;
      const { text, full } = moveText(replay.positions[j]!, move);
      rows.push(
        <move key={`m${j}`} class={j + 1 === current ? 'active' : ''} title={full} aria-label={full} onClick={() => go(j + 1)}>
          {text}
        </move>,
      );
    }
  }

  const status = outcome
    ? outcomeText(t, outcome)
    : t.turnStatus(position.phase === 'draft', position.turn, null);

  return (
    <main class={`analyse variant-crazyhouse${tap.strip ? ' ligungi-has-strip' : ''}`}>
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
          <TowerPanel position={position} square={inspected} training />
        </div>
      </div>
      <div class="analyse__board main-board" aria-hidden={hidden}>
        {hands && (
          <BoardView
            training
            position={position}
            orientation={orientation}
            movableColor={outcome ? null : 'both'}
            moves={outcome ? [] : legal}
            lastMove={local.lastMove}
            onMove={local.play}
            handElements={hands}
            inspector={tap.balloon}
            inspectSelection={tap.balloon}
            onInspect={setInspected}
          />
        )}
      </div>
      {tap.strip && <TowerStrip position={position} square={inspected} />}
      <div class="pocket is2d pocket-top" ref={topHand} aria-hidden={hidden} />
      <div class="pocket is2d pocket-bottom" ref={bottomHand} aria-hidden={hidden} />
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
        {screenReader && (
          <BlindPanel
            title={t.blind.boardTitle}
            position={position}
            legal={outcome ? [] : legal}
            onMove={local.play}
            positions={replay.positions}
            moves={replay.moves}
            ply={local.ply}
            navigation={{ prev: () => go(current - 1), next: () => go(current + 1), first: () => go(0), end: () => go(replay.moves.length) }}
            orientation={orientation}
            result={outcome ? outcomeText(t, outcome) : null}
            notice={error}
          />
        )}
        <div class="ligungi-tools box">
          {doneAvailable && (
            <button type="button" class="button ligungi-done" onClick={() => local.play({ kind: 'done' })}>
              済み {t.done}
            </button>
          )}
          <div class="form3 ligungi-row">
            <Select ariaLabel={t.common.mode} value={mode} options={MODES.map((m) => ({ value: m, label: t.modes[m] }))} onChange={setMode} />
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
          <button type="button" class="button button-empty text ligungi-import-open" data-icon={icons.Download} onClick={() => setImporting(true)}>
            {t.analysis.importTitle}
          </button>
          {positionProblems(position).length === 0 && !local.replay.game.outcome && (
            <a class="button button-empty text ligungi-import-open" data-icon={icons.Swords} href={`/computer?fen=${encodeURIComponent(toFen(position))}`}>
              {t.common.playComputer}
            </a>
          )}
        </div>
      </div>
      {importing && (
        <ImportGame
          onClose={() => {
            setImporting(false);
            // Drop ?import, so the menu link opens the dialog again next time.
            if (new URLSearchParams(search).has('import')) navigate('/analysis', true);
          }}
        />
      )}
    </main>
  );
};
