import { applyMove, parseMove, type Color, type Move, type Position } from '@ligungi/engine';
import { useT } from '../../i18n/index.ts';
import { useMoveText } from '../../game/notation.ts';

export interface DraftPlan {
  /** The queued moves, read from the game view. */
  readonly moves: readonly Move[];
  /** The board as it will be after the queued placements, with the player to move set to the viewer. */
  readonly position: Position;
  /** The position before each queued move, to write it in the chosen notation. */
  readonly before: readonly Position[];
  readonly endsWithDone: boolean;
}

/** Plays the viewer's queued placements on top of the current position, as if each were their turn. */
export const draftPlan = (current: Position, queue: readonly string[], you: Color): DraftPlan => {
  const moves: Move[] = [];
  const before: Position[] = [];
  let position: Position = { ...current, turn: you };
  for (const text of queue) {
    const move = parseMove(text);
    if (!move) break;
    try {
      const next = applyMove(position, move);
      moves.push(move);
      before.push(position);
      position = { ...next, turn: you };
    } catch {
      break;
    }
  }
  return { moves, position, before, endsWithDone: moves[moves.length - 1]?.kind === 'done' };
};

/**
 * The placements a correspondence player queued while the opponent places: the server plays them one per turn, even
 * with the player away. Shown under the board during the draft, on the opponent's turn.
 */
export const DraftQueue = ({
  plan,
  canDone,
  onChange,
}: {
  plan: DraftPlan;
  /** Whether "done" could follow the queued placements. */
  canDone: boolean;
  onChange: (moves: readonly Move[]) => void;
}) => {
  const t = useT();
  const listed = useMoveText();
  const q = t.game.queue;
  return (
    <section class="ligungi-draft-queue" aria-label={q.title}>
      <p class="ligungi-draft-queue__title">{q.title}</p>
      {plan.moves.length === 0 ? (
        <p class="ligungi-draft-queue__hint">{q.hint}</p>
      ) : (
        <ol class="ligungi-draft-queue__list">
          {plan.moves.map((move, i) => (
            <li key={i}>{move.kind === 'done' ? t.done : (({ text, full }) => full ?? text)(listed(plan.before[i]!, move))}</li>
          ))}
        </ol>
      )}
      <div class="ligungi-draft-queue__actions">
        {canDone && !plan.endsWithDone && (
          <button type="button" class="button button-empty" onClick={() => onChange([...plan.moves, { kind: 'done' }])}>
            {q.thenDone}
          </button>
        )}
        {plan.moves.length > 0 && (
          <>
            <button type="button" class="button button-empty" onClick={() => onChange(plan.moves.slice(0, -1))}>
              {q.undo}
            </button>
            <button type="button" class="button button-empty button-red" onClick={() => onChange([])}>
              {q.clear}
            </button>
          </>
        )}
      </div>
      {plan.moves.length > 0 && <p class="ligungi-draft-queue__hint">{q.note}</p>}
    </section>
  );
};
