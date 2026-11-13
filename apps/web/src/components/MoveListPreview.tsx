import { Game, initialPosition, parseMove, type Move, type Position } from '@ligungi/engine';
import { useT } from '../i18n/index.ts';
import { moveText, type Notation } from '../notation.ts';
import { prefs, resolveLang } from '../prefs.ts';
import { useStore } from '../store.ts';

const NOTATIONS: readonly Notation[] = ['named', 'rulebook', 'machine'];

/** The first moves of a real Beginner game: plain moves, pieces from the hand and stacks. */
const SAMPLE = ['d1d2', 'a7a6', 'J*a1', 'c7d7=', 'a1b2=', 'J*a6'];

type Step = { readonly position: Position; readonly move: Move };
let cached: readonly Step[] | null | undefined;

/**
 * Played on first use, not at import: this module is in the main bundle, and a sample move made illegal by a future
 * rule change must only hide the preview, never stop the site from loading.
 */
const sample = (): readonly Step[] | null => {
  if (cached !== undefined) return cached;
  try {
    const game = new Game(initialPosition('beginner'));
    cached = SAMPLE.map((text) => {
      const position = game.position;
      const move = parseMove(text);
      if (!move) throw new Error(`bad sample move ${text}`);
      game.play(move);
      return { position, move };
    });
  } catch {
    cached = null;
  }
  return cached;
};

/** A short move list in the chosen notation and piece names, laid out like the one beside the board. */
export const MoveListPreview = () => {
  const t = useT();
  const { notation, pieceNames, lang } = useStore(prefs);
  const local = resolveLang(lang);
  const shown = pieceNames === 'ja' ? 'ja' : local;
  const steps = sample();
  if (!steps) return null;
  const rows = [];
  for (let i = 0; i < steps.length; i += 2) {
    rows.push(
      <span key={`n${i}`} class="ligungi-moves-preview__index">
        {i / 2 + 1}
      </span>,
    );
    for (const j of [i, i + 1]) {
      const step = steps[j]!;
      // Every other notation and naming is laid out invisibly in the same cell, so the preview keeps the width of the
      // longest one and the form beside it does not shift while the player compares the options.
      const others = NOTATIONS.flatMap((n) => [local, 'ja' as const].map((names) => moveText(n, step.position, step.move, t, names)));
      rows.push(
        <span key={j} class={`ligungi-moves-preview__move${j === steps.length - 1 ? ' active' : ''}`}>
          <span>{moveText(notation, step.position, step.move, t, shown)}</span>
          {others.map((text, k) => (
            <span key={k} class="ligungi-moves-preview__sizer">
              {text}
            </span>
          ))}
        </span>,
      );
    }
  }
  return (
    <figure class="ligungi-preview">
      <div class="ligungi-moves-preview" aria-hidden="true">
        {rows}
      </div>
      <figcaption>{t.settings.piecePreview}</figcaption>
    </figure>
  );
};
