import { coordinateLabels, visualSquares } from '@ligungi/board';
import { squareName, toRulebook, type Color, type Square } from '@ligungi/engine';
import type { ColorChoice } from '@ligungi/protocol';
import { useEffect, useRef, useState } from 'preact/hooks';
import { Checkbox, OptionCards } from '../components/ui.tsx';
import { colorChoiceOptions, useT } from '../i18n/index.ts';
import { prefs } from '../prefs.ts';
import { playSound } from '../sound.ts';
import { useStore } from '../store.ts';

type Mode = 'find' | 'name';
type Style = 'rulebook' | 'machine';

const ROUND_MS = 30_000;
const FLASH_MS = 350;
const BEST_KEY = 'ligungi.coordinates';
const SQUARES = visualSquares('white');

/** A square's name in the chosen notation, split in its column and row parts. */
const parts = (square: Square, style: Style): { column: string; row: string } => {
  if (style === 'machine') {
    const name = squareName(square);
    return { column: name[0]!, row: name.slice(1) };
  }
  const { column, row } = toRulebook(square);
  return { column: String(column), row: String(row) };
};

const label = (square: Square, style: Style): string => {
  const { column, row } = parts(square, style);
  return style === 'machine' ? `${column}${row}` : `${column}-${row}`;
};

/** Best scores by mode and notation, kept in this browser; storage may be missing (prerender) or blocked. */
const readBest = (): Record<string, number> => {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(BEST_KEY) ?? '{}');
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, number>) : {};
  } catch {
    return {};
  }
};

const writeBest = (best: Record<string, number>): void => {
  try {
    localStorage.setItem(BEST_KEY, JSON.stringify(best));
  } catch {}
};

const randomSquare = (except: Square | null): Square => {
  for (;;) {
    const square = SQUARES[Math.floor(Math.random() * SQUARES.length)]!;
    if (square !== except) return square;
  }
};

/**
 * Coordinate trainer: find the square whose name is shown, or name the square that lights up, as many as possible in
 * 30 seconds, in the rulebook's notation (column-row) or the machine one. Best scores stay in the browser.
 */
export const CoordinatesPage = () => {
  const t = useT();
  const { notation, screenReader } = useStore(prefs);
  const [mode, setMode] = useState<Mode>('find');
  const [style, setStyle] = useState<Style>(notation === 'machine' ? 'machine' : 'rulebook');
  const [colorChoice, setColorChoice] = useState<ColorChoice>('white');
  const [labels, setLabels] = useState(true);
  const [orientation, setOrientation] = useState<Color>('white');
  const [running, setRunning] = useState(false);
  const [left, setLeft] = useState(ROUND_MS);
  const [target, setTarget] = useState<Square | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [flash, setFlash] = useState<{ square: Square; ok: boolean } | null>(null);
  const [column, setColumn] = useState<string | null>(null);
  const [best, setBest] = useState<Record<string, number>>({});
  const [newBest, setNewBest] = useState(false);
  // One tab stop on the board, moved with the arrow keys; the answer is said for screen readers.
  const [focus, setFocus] = useState(0);
  const [said, setSaid] = useState({ text: '', count: 0 });
  const grid = useRef<HTMLDivElement>(null);
  const end = useRef(0);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const key = `${mode}-${style}`;

  useEffect(() => setBest(readBest()), []);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const remaining = Math.max(0, end.current - performance.now());
      setLeft(remaining);
      if (remaining > 0) return;
      setRunning(false);
      setTarget(null);
      playSound('notify');
    }, 100);
    return () => clearInterval(id);
  }, [running]);

  // A finished round may set a new best for its mode and notation.
  useEffect(() => {
    if (running || score === null || score <= (best[key] ?? 0)) return;
    const next = { ...best, [key]: score };
    setBest(next);
    setNewBest(true);
    writeBest(next);
  }, [running]);

  const start = () => {
    const color: Color = colorChoice === 'random' ? (Math.random() < 0.5 ? 'white' : 'black') : colorChoice;
    setOrientation(color);
    setScore(0);
    setNewBest(false);
    setColumn(null);
    setTarget(randomSquare(null));
    end.current = performance.now() + ROUND_MS;
    setLeft(ROUND_MS);
    setRunning(true);
  };

  const answer = (square: Square, ok: boolean) => {
    if (flashTimer.current) clearTimeout(flashTimer.current);
    setFlash({ square, ok });
    flashTimer.current = setTimeout(() => setFlash(null), FLASH_MS);
    setSaid((current) => ({ text: ok ? t.blind.right : t.blind.wrong, count: current.count + 1 }));
    if (ok) {
      setScore((n) => (n ?? 0) + 1);
      setTarget((current) => randomSquare(current));
    } else playSound('error');
    setColumn(null);
  };

  const onSquare = (square: Square) => {
    if (!running || mode !== 'find' || target === null) return;
    answer(square, square === target);
  };

  const onRow = (row: string) => {
    if (!running || target === null || column === null) return;
    const expected = parts(target, style);
    answer(target, expected.column === column && expected.row === row);
  };

  const { columns, rows } = coordinateLabels(orientation, style === 'machine' ? 'algebraic' : 'rulebook');
  const order = visualSquares(orientation);
  /** Where a square stands, counted from the top left, for screen readers: the skill is turning that into its name. */
  const cell = (square: Square) => {
    const index = order.indexOf(square);
    return t.blind.coordsCell((index % 9) + 1, Math.floor(index / 9) + 1);
  };
  const prompt = !running
    ? null
    : mode === 'find'
      ? label(target!, style)
      : screenReader && target !== null
        ? `${t.coordinates.namePrompt} ${t.blind.coordsMarked(cell(target))}`
        : t.coordinates.namePrompt;
  const onGridKey = (event: KeyboardEvent, index: number) => {
    const steps: Record<string, number> = { ArrowUp: -9, ArrowDown: 9, ArrowLeft: -1, ArrowRight: 1 };
    const step = steps[event.key];
    if (step === undefined) return;
    const next = index + step;
    if (next < 0 || next > 80 || (Math.abs(step) === 1 && Math.floor(next / 9) !== Math.floor(index / 9))) return;
    event.preventDefault();
    setFocus(next);
    grid.current?.querySelectorAll<HTMLButtonElement>('button')[next]?.focus();
  };
  const finished = !running && score !== null;

  return (
    <main class="ligungi-page ligungi-coords">
      <div class="ligungi-coords__layout">
        <section class="ligungi-card ligungi-coords__panel">
          <h1>{t.coordinates.title}</h1>
          <p class="ligungi-coords__intro">{t.coordinates.intro}</p>
          {running ? (
            <>
              <p class={`ligungi-coords__prompt${mode === 'name' ? ' is-question' : ''}`} aria-live="polite">
                {prompt}
              </p>
              <p class="ligungi-coords__score">{t.coordinates.score(score ?? 0)}</p>
              <div class="ligungi-coords__time" role="progressbar" aria-valuemin={0} aria-valuemax={30} aria-valuenow={Math.ceil(left / 1000)}>
                <span style={{ width: `${(left / ROUND_MS) * 100}%` }} />
              </div>
              {mode === 'name' && (
                <div class="ligungi-coords__pick">
                  <span>{t.coordinates.column}</span>
                  <div role="group" aria-label={t.coordinates.column}>
                    {columns.map((value) => (
                      <button key={value} type="button" class={`button button-empty${column === value ? ' active' : ''}`} onClick={() => setColumn(value)}>
                        {value}
                      </button>
                    ))}
                  </div>
                  <span>{t.coordinates.row}</span>
                  <div role="group" aria-label={t.coordinates.row}>
                    {rows.map((value) => (
                      <button key={value} type="button" class="button button-empty" disabled={column === null} onClick={() => onRow(value)}>
                        {value}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <form class="form3 ligungi-coords__form" onSubmit={(event) => (event.preventDefault(), start())}>
              {finished && (
                <p class="ligungi-coords__result" role="status">
                  {t.coordinates.result(score)} {newBest ? t.coordinates.newBest : ''}
                </p>
              )}
              <OptionCards
                name="coords-mode"
                legend={t.coordinates.mode}
                layout="segmented"
                value={mode}
                options={[
                  { value: 'find' as const, label: t.coordinates.find },
                  { value: 'name' as const, label: t.coordinates.name },
                ]}
                onChange={setMode}
                help={mode === 'find' ? t.coordinates.findHelp : t.coordinates.nameHelp}
              />
              <OptionCards
                name="coords-style"
                legend={t.coordinates.notation}
                layout="segmented"
                value={style}
                options={[
                  { value: 'rulebook' as const, label: t.coordinates.rulebook },
                  { value: 'machine' as const, label: t.coordinates.machine },
                ]}
                onChange={setStyle}
              />
              <OptionCards name="coords-color" legend={t.coordinates.side} layout="segmented" value={colorChoice} options={colorChoiceOptions(t)} onChange={setColorChoice} />
              <Checkbox id="coords-labels" checked={labels} onChange={setLabels} label={t.coordinates.showLabels} />
              <p class="ligungi-coords__best">{t.coordinates.best(best[key] ?? 0)}</p>
              <button type="submit" class="button">
                {finished ? t.coordinates.again : t.coordinates.start}
              </button>
            </form>
          )}
        </section>
        <div class={`ligungi-coords__board${labels ? ' has-labels' : ''}`}>
          {labels && (
            <div class="ligungi-coords__columns" aria-hidden="true">
              {columns.map((value) => (
                <span key={value}>{value}</span>
              ))}
            </div>
          )}
          <p class="ligungi-sr-only" role="status">
            {/* The same answer twice in a row must still change the text, or it is not read again. */}
            {said.count % 2 ? `${said.text}\u00a0` : said.text}
          </p>
          <div class="gg-mini gg-palette ligungi-coords__grid" ref={grid}>
            {order.map((square, index) => {
              const classes = ['gg-mini-sq', 'ligungi-coords__sq'];
              if (running && mode === 'name' && square === target) classes.push('is-target');
              if (flash?.square === square) classes.push(flash.ok ? 'is-ok' : 'is-bad');
              return (
                <button
                  key={square}
                  type="button"
                  class={classes.join(' ')}
                  aria-label={running && mode === 'find' ? (screenReader ? cell(square) : t.coordinates.squareButton) : label(square, style)}
                  tabIndex={running && mode === 'find' && index === focus ? 0 : -1}
                  onFocus={() => setFocus(index)}
                  onKeyDown={(event) => onGridKey(event, index)}
                  onClick={() => onSquare(square)}
                />
              );
            })}
          </div>
          {labels && (
            <div class="ligungi-coords__rows" aria-hidden="true">
              {rows.map((value) => (
                <span key={value}>{value}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
};
