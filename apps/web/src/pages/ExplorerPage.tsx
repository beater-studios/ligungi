import { initialPosition, legalMoves, parseMove, toFen, type Move, type Position } from '@ligungi/engine';
import { EXPLORER_BANDS, EXPLORER_MODES, type ExplorerBand, type ExplorerMode, type ExplorerStats, type ExplorerView } from '@ligungi/protocol';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { api } from '../api.ts';
import { BoardView } from '../components/BoardView.tsx';
import { Checkbox, Field, OptionCards, Select } from '../components/ui.tsx';
import { formatDate, useT } from '../i18n/index.ts';
import { icons } from '../icons.ts';
import { useMoveText } from '../notation.ts';
import { replayFrom } from '../replay.ts';

const percent = (part: number, whole: number) => (whole === 0 ? 0 : Math.round((part / whole) * 100));

/** White wins, draws and Black wins as one bar, with the shares written in it when there is room. */
export const ResultBar = ({ stats }: { stats: ExplorerStats }) => {
  const t = useT();
  const shares = [
    { key: 'white', value: percent(stats.white, stats.games) },
    { key: 'draws', value: percent(stats.draws, stats.games) },
    { key: 'black', value: percent(stats.black, stats.games) },
  ];
  return (
    <span class="ligungi-explorer__bar" role="img" aria-label={t.explorer.resultsLabel(shares[0]!.value, shares[1]!.value, shares[2]!.value)}>
      {shares.map(({ key, value }) =>
        value > 0 ? (
          <span key={key} class={`is-${key}`} style={{ width: `${value}%` }}>
            {value >= 25 ? `${value}%` : ''}
          </span>
        ) : null,
      )}
    </span>
  );
};

/**
 * Draft explorer: from a draft position, what players placed next in finished games, how often and with what results,
 * stage by stage. Pick a row or place a piece on the board to go on; the path above the board steps back.
 */
export const ExplorerPage = () => {
  const t = useT();
  const moveText = useMoveText();
  const [mode, setMode] = useState<ExplorerMode>('advanced');
  const [band, setBand] = useState<ExplorerBand>('all');
  const [rated, setRated] = useState(false);
  const [path, setPath] = useState<readonly Move[]>([]);
  const [view, setView] = useState<ExplorerView | null>(null);
  const [error, setError] = useState(false);
  const [hands, setHands] = useState<{ top: HTMLElement; bottom: HTMLElement } | null>(null);
  const top = useRef<HTMLDivElement>(null);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (top.current && bottom.current) setHands({ top: top.current, bottom: bottom.current });
  }, []);

  const replay = useMemo(() => replayFrom(initialPosition(mode), path), [mode, path]);
  const position: Position = replay.game.position;
  const inDraft = position.phase === 'draft';
  const fen = toFen(position);

  useEffect(() => {
    if (!inDraft) return;
    let alive = true;
    setError(false);
    const params = new URLSearchParams({ mode, band, fen });
    if (rated) params.set('rated', '1');
    api
      .get<ExplorerView>(`/api/explorer?${params.toString()}`)
      .then((answer) => alive && setView(answer))
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, [mode, band, rated, fen]);

  const boardMoves = useMemo(() => (inDraft ? legalMoves(position) : []), [position]);
  const go = (move: Move) => setPath([...path, move]);
  const changeMode = (next: ExplorerMode) => {
    setMode(next);
    setPath([]);
  };

  return (
    <main class="ligungi-page ligungi-explorer">
      <header class="ligungi-lessons__head">
        <h1>{t.explorer.title}</h1>
        <p>{t.explorer.intro}</p>
      </header>
      <div class="ligungi-explorer__layout">
        <div class="ligungi-explorer__board">
          <nav class="ligungi-explorer__path" aria-label={t.explorer.path}>
            <button type="button" class="button button-empty" disabled={path.length === 0} onClick={() => setPath([])}>
              {t.explorer.start}
            </button>
            <button type="button" class="button button-empty" data-icon={icons.JumpPrev} aria-label={t.explorer.back} disabled={path.length === 0} onClick={() => setPath(path.slice(0, -1))} />
            {path.map((move, i) => (
              <button key={i} type="button" class={`ligungi-explorer__step${i === path.length - 1 ? ' is-current' : ''}`} onClick={() => setPath(path.slice(0, i + 1))}>
                {moveText(replay.positions[i]!, move).text}
              </button>
            ))}
          </nav>
          <div class="ligungi-lesson__hand" ref={top} />
          {hands && (
            <BoardView
              position={position}
              orientation="white"
              movableColor={inDraft ? position.turn : null}
              moves={boardMoves}
              lastMove={path[path.length - 1] ?? null}
              handElements={hands}
              onMove={go}
            />
          )}
          <div class="ligungi-lesson__hand" ref={bottom} />
        </div>
        <section class="ligungi-card ligungi-explorer__panel">
          <div class="form3 ligungi-explorer__filters">
            <OptionCards
              name="explorer-mode"
              legend={t.common.mode}
              layout="segmented"
              value={mode}
              options={EXPLORER_MODES.map((value) => ({ value, label: t.modes[value] }))}
              onChange={changeMode}
            />
            <Field label={t.explorer.band} htmlFor="explorer-band">
              <Select id="explorer-band" value={band} options={EXPLORER_BANDS.map((value) => ({ value, label: t.explorer.bands[value] }))} onChange={setBand} />
            </Field>
            <Checkbox id="explorer-rated" checked={rated} onChange={setRated} label={t.explorer.ratedOnly} />
          </div>
          {!inDraft ? (
            <p class="ligungi-notice">
              {t.explorer.draftOver}{' '}
              <a href={`/analysis?fen=${encodeURIComponent(fen)}`}>{t.explorer.analyse}</a>
            </p>
          ) : error ? (
            <p class="error">{t.genericError}</p>
          ) : !view ? (
            <p class="ligungi-notice">{t.common.loading}</p>
          ) : (
            <>
              <p class="ligungi-explorer__total">
                {t.explorer.games(view.total.games)}
                {view.total.games > 0 && <ResultBar stats={view.total} />}
              </p>
              {view.moves.length === 0 ? (
                <p class="ligungi-notice">{t.explorer.noGames}</p>
              ) : (
                <table class="slist ligungi-explorer__table">
                  <thead>
                    <tr>
                      <th>{t.explorer.move}</th>
                      <th>{t.explorer.gamesHeader}</th>
                      <th>{t.explorer.results}</th>
                      <th>{t.explorer.rating}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {view.moves.map((row) => {
                      const move = parseMove(row.move);
                      return (
                        <tr key={row.move} tabIndex={0} onClick={() => move && go(move)} onKeyDown={(event) => event.key === 'Enter' && move && go(move)}>
                          <td>{move ? moveText(position, move).text : row.move}</td>
                          <td>
                            {row.games} <small>({percent(row.games, view.total.games)}%)</small>
                          </td>
                          <td>
                            <ResultBar stats={row} />
                          </td>
                          <td>{row.rating ?? '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
              <p class="ligungi-explorer__updated">{t.explorer.updated(formatDate(t, view.updatedAt))}</p>
            </>
          )}
        </section>
      </div>
    </main>
  );
};
