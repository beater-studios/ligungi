import type { Move, Position } from '@ligungi/engine';
import { useEffect, useRef, useState } from 'preact/hooks';
import { describeMove, matchMoves, type Speaker } from '../blind.ts';
import { usePieceNames, useT } from '../i18n/index.ts';

interface KeyboardMoveProps {
  /** The position shown on the board. */
  readonly position: Position;
  /** Moves the player may make now; empty when it is not their turn. */
  readonly legal: readonly Move[];
  /** The board shows the current position, not an earlier move. */
  readonly live: boolean;
  readonly onMove: (move: Move) => void;
  readonly onLive: () => void;
}

/** Keys that never start a move, so typing them on the page does not jump to the field. */
const isTypingTarget = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement && (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable);

/**
 * A field under the board for typed moves, in the forms the screen reader mode reads (`6-6 samurai`, `6-7 6-6`, the
 * rulebook or machine notation). Typing anywhere on the page jumps to it; `z` is left to the zen mode.
 */
export const KeyboardMove = ({ position, legal, live, onMove, onLive }: KeyboardMoveProps) => {
  const t = useT();
  const speaker: Speaker = { t, names: usePieceNames() };
  const [value, setValue] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [options, setOptions] = useState<readonly Move[] | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target) || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key.length !== 1 || event.key === ' ' || event.key.toLowerCase() === 'z') return;
      input.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => setOptions(null), [position]);

  const play = (move: Move) => {
    setOptions(null);
    setMessage(null);
    setValue('');
    onMove(move);
  };

  const submit = () => {
    const text = value.trim();
    if (!text) return;
    if (!live) {
      onLive();
      setMessage(t.game.keyboardLive);
      return;
    }
    if (legal.length === 0) return setMessage(t.game.keyboardWait);
    const matched = matchMoves(speaker, position, legal, text);
    if (matched === null) return setMessage(t.game.keyboardUnreadable);
    if (matched.length === 0) return setMessage(t.game.keyboardNoMatch);
    if (matched.length === 1) return play(matched[0]!);
    setMessage(t.game.keyboardPick);
    setOptions(matched);
  };

  return (
    <form
      class="ligungi-keyboard-move"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <label class="ligungi-sr-only" for="keyboard-move">
        {t.game.keyboardMove}
      </label>
      <input
        id="keyboard-move"
        ref={input}
        class="form-control"
        autoComplete="off"
        autoCapitalize="off"
        spellcheck={false}
        placeholder={t.game.keyboardMove}
        aria-describedby="keyboard-move-help"
        value={value}
        onInput={(event) => {
          setValue((event.target as HTMLInputElement).value);
          setMessage(null);
        }}
      />
      <p id="keyboard-move-help" class="ligungi-keyboard-move__help" role="status" aria-live="polite">
        {message ?? t.game.keyboardMoveHelp}
      </p>
      {options && (
        <div class="ligungi-keyboard-move__options">
          {options.map((move) => (
            <button key={describeMove(speaker, position, move)} type="button" class="button button-empty" onClick={() => play(move)}>
              {describeMove(speaker, position, move)}
            </button>
          ))}
        </div>
      )}
    </form>
  );
};
