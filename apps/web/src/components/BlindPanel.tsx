import { pieceLetters, pieceName, visualSquares } from '@ligungi/board';
import { COLORS, ROLES, legalMoves, moveToString, toFen, topOf, type Color, type Move, type Position, type Role, type Square } from '@ligungi/engine';
import { useEffect, useRef, useState } from 'preact/hooks';
import {
  describeHands,
  describeMove,
  describePosition,
  describeReach,
  describeSquare,
  matchMoves,
  moveNotes,
  parseCommand,
  squareText,
  type Speaker,
} from '../blind.ts';
import { formatClock, usePieceNames, useT } from '../i18n/index.ts';
import { Field } from './ui.tsx';

export interface BlindClock {
  readonly ms: number;
  readonly since: number;
  readonly running: boolean;
  readonly mine: boolean;
}

/** Commands a game page may offer beyond moving: an online game takes resign and draw. */
export interface BlindCommands {
  readonly resign?: () => void;
  readonly draw?: () => void;
}

/** Stepping through the moves, for pages with a move list; a step the page lacks is answered as unavailable. */
export interface BlindNavigation {
  readonly prev?: () => void;
  readonly next?: () => void;
  readonly first?: () => void;
  readonly end?: () => void;
}

export interface BlindPanelProps {
  /** The position on the board, an earlier one while the player steps back through the moves. */
  readonly position: Position;
  /** The moves the player may make now, empty when it is not their turn. */
  readonly legal: readonly Move[];
  readonly onMove?: ((move: Move) => void) | undefined;
  /** The moves played so far, announced as they come. */
  readonly positions: readonly Position[];
  readonly moves: readonly Move[];
  /** The board shows the current position, not an earlier one. */
  readonly live?: boolean;
  /** Brings the board back to the current position. */
  readonly onLive?: (() => void) | undefined;
  readonly names?: Readonly<Record<Color, string>> | undefined;
  readonly orientation?: Color;
  readonly clocks?: Readonly<Record<Color, BlindClock>> | null | undefined;
  /** What `r` answers when the page has no clocks of its own, such as a puzzle run's timer and combo. */
  readonly timeInfo?: string | null | undefined;
  /** The result, once the game is over. */
  readonly result?: string | null | undefined;
  /** Something the page wants said, such as a draw offer or a puzzle's feedback. */
  readonly notice?: string | null | undefined;
  /** The task of the page (a puzzle, a lesson), read on arrival and with `g`. */
  readonly goal?: string | null | undefined;
  /** Where the player stands while stepping through the moves, read each time it changes. */
  readonly where?: string | null | undefined;
  /** For a plain list of moves: the move shown (`null` for the current one), from which `where` is told. */
  readonly ply?: number | null | undefined;
  readonly navigation?: BlindNavigation | undefined;
  readonly commands?: BlindCommands | undefined;
  /** Page commands tried before the shared ones; return the answer, or `null` when the text is not one of them. */
  readonly onCommand?: ((text: string) => string | null) | undefined;
  /** Help of the page's own commands, read after the shared help. */
  readonly help?: string | undefined;
  readonly title?: string | undefined;
  /** Puts the cursor in the field on arrival, as a game page does; the design page does not. */
  readonly autoFocus?: boolean;
}

const LOW_TIME = 20_000;
const LOG_SIZE = 40;
/** More new moves than this at once are a game loaded, not moves played. */
const MANY_MOVES = 3;

const timeLeft = (clock: BlindClock): number => (clock.running ? Math.max(0, clock.ms - (performance.now() - clock.since)) : clock.ms);

const pieceNameOf = (speaker: Speaker, role: Role): string => pieceName(role, speaker.names);

type Pick = { readonly kind: 'square'; readonly square: Square } | { readonly kind: 'hand'; readonly role: Role };

/**
 * The 81 squares as buttons, moved through with the arrow keys (one tab stop), each read as its tower. Enter picks a
 * piece (or a piece from the hand below) and then its destination; Escape cancels.
 */
const KeyboardBoard = ({
  speaker,
  position,
  orientation,
  legal,
  onPlay,
  say,
}: {
  speaker: Speaker;
  position: Position;
  orientation: Color;
  legal: readonly Move[];
  onPlay: (moves: readonly Move[]) => void;
  say: (...lines: string[]) => void;
}) => {
  const b = speaker.t.blind;
  const order = visualSquares(orientation);
  const [focus, setFocus] = useState<Square>(order[72]!);
  const [picked, setPicked] = useState<Pick | null>(null);
  const grid = useRef<HTMLDivElement>(null);

  // Keyed by the position's text: some pages build a new position object on every render, which must not drop the pick.
  const positionKey = toFen(position);
  useEffect(() => setPicked(null), [positionKey]);

  const fromPick = (pick: Pick | null) =>
    pick ? legal.filter((move) => (pick.kind === 'square' ? move.kind === 'move' && move.from === pick.square : move.kind === 'drop' && move.role === pick.role)) : [];
  const targets = new Set(fromPick(picked).map((move) => (move.kind === 'done' ? -1 : move.to)));

  const moveFocus = (square: Square) => {
    setFocus(square);
    grid.current?.querySelector<HTMLButtonElement>(`[data-square="${square}"]`)?.focus();
  };

  const activate = (square: Square) => {
    const candidates = fromPick(picked).filter((move) => move.kind !== 'done' && move.to === square);
    if (candidates.length) {
      setPicked(null);
      return onPlay(candidates);
    }
    const own: Pick = { kind: 'square', square };
    if (fromPick(own).length) {
      setPicked(own);
      const top = topOf(position.board[square]!)!;
      return say(b.selected(b.piece(pieceNameOf(speaker, top.role), top.color), squareText(square)));
    }
    say(describeSquare(speaker, position, square));
  };

  const onKey = (event: KeyboardEvent, square: Square) => {
    const index = order.indexOf(square);
    const row = Math.floor(index / 9);
    const column = index % 9;
    const steps: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    const step = steps[event.key];
    if (step) {
      event.preventDefault();
      const nextRow = Math.max(0, Math.min(8, row + step[0]));
      const nextColumn = Math.max(0, Math.min(8, column + step[1]));
      moveFocus(order[nextRow * 9 + nextColumn]!);
    } else if (event.key === 'Escape' && picked) {
      event.preventDefault();
      setPicked(null);
      say(b.cancelled);
    }
  };

  const hand = position.hands[position.turn];
  const droppable = ROLES.filter((role) => hand[role] > 0 && legal.some((move) => move.kind === 'drop' && move.role === role));

  return (
    <details class="ligungi-blind__board">
      <summary>{b.keyboardBoard}</summary>
      <p class="ligungi-blind__hint">{b.keyboardHelp}</p>
      <div class="ligungi-blind__grid" role="grid" aria-label={b.keyboardBoard} ref={grid}>
        {Array.from({ length: 9 }, (_, row) => (
          <div key={row} role="row">
            {order.slice(row * 9, row * 9 + 9).map((square) => {
              const tower = position.board[square]!;
              const top = topOf(tower);
              const isPicked = picked?.kind === 'square' && picked.square === square;
              const label = `${describeSquare(speaker, position, square)}${targets.has(square) ? ` ${b.target}.` : ''}`;
              return (
                <div key={square} role="gridcell">
                  <button
                    type="button"
                    data-square={square}
                    class={`ligungi-blind__square${top ? ` is-${top.color}` : ''}${targets.has(square) ? ' is-target' : ''}`}
                    tabIndex={square === focus ? 0 : -1}
                    aria-label={label}
                    aria-pressed={isPicked}
                    onFocus={() => setFocus(square)}
                    onKeyDown={(event) => onKey(event, square)}
                    onClick={() => activate(square)}
                  >
                    {top ? `${pieceLetters(top.role, speaker.names)}${tower.length > 1 ? tower.length : ''}` : ''}
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      {droppable.length > 0 && (
        <div class="ligungi-blind__hand" role="group" aria-label={b.handOf(position.turn)}>
          {droppable.map((role) => (
            <button
              key={role}
              type="button"
              class="button button-empty"
              aria-pressed={picked?.kind === 'hand' && picked.role === role}
              onClick={() => {
                setPicked({ kind: 'hand', role });
                say(b.selectedHand(pieceNameOf(speaker, role)));
              }}
            >
              {b.handPiece(pieceNameOf(speaker, role), hand[role])}
            </button>
          ))}
        </div>
      )}
    </details>
  );
};

/**
 * The game as text, for screen readers (docs/accessibility.md): every move and event announced in a live log, a field
 * that takes typed moves and questions about the position, and the board as keyboard buttons.
 */
export const BlindPanel = (props: BlindPanelProps) => {
  const t = useT();
  const b = t.blind;
  const speaker: Speaker = { t, names: usePieceNames() };
  const live = props.live ?? true;
  const names = props.names ?? t.colors;
  const [log, setLog] = useState<Array<{ id: number; text: string }>>([]);
  const [value, setValue] = useState('');
  const [options, setOptions] = useState<readonly Move[] | null>(null);
  const [confirmResign, setConfirmResign] = useState(false);
  const nextId = useRef(0);
  const movesKey = props.moves.map(moveToString).join(' ');
  const seen = useRef(movesKey);
  const warned = useRef(false);
  const lastWhere = useRef<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const logBox = useRef<HTMLDivElement>(null);

  const say = (...lines: string[]) =>
    setLog((current) => [...current, ...lines.filter(Boolean).map((text) => ({ id: nextId.current++, text }))].slice(-LOG_SIZE));

  useEffect(() => {
    if (props.autoFocus !== false) input.current?.focus();
  }, []);

  useEffect(() => {
    if (logBox.current) logBox.current.scrollTop = logBox.current.scrollHeight;
  }, [log]);

  // Compared from the start, so a move played from an earlier position (which cuts the rest) reads as that move, not as
  // a takeback; many moves at once (a game loaded) are summed up instead of read one by one.
  useEffect(() => {
    const { moves, positions } = props;
    const before = seen.current ? seen.current.split(' ') : [];
    const now = movesKey ? movesKey.split(' ') : [];
    seen.current = movesKey;
    let common = 0;
    while (common < before.length && common < now.length && before[common] === now[common]) common++;
    if (common === before.length && common === now.length) return;
    setOptions(null);
    const describe = (i: number): string[] => {
      const from = positions[i];
      const to = positions[i + 1];
      return from ? [describeMove(speaker, from, moves[i]!), ...(to ? moveNotes(speaker, from, to) : [])] : [];
    };
    if (now.length === 0) return say(b.atStart);
    if (common === now.length) return say(b.takeback);
    const added = now.length - common;
    if (added > MANY_MOVES) return say(b.movesLoaded(now.length), ...describe(now.length - 1));
    for (let i = common; i < now.length; i++) say(...describe(i));
  }, [movesKey]);

  useEffect(() => {
    if (props.goal) say(props.goal);
  }, [props.goal]);

  useEffect(() => {
    if (props.result) say(props.result);
  }, [props.result]);

  useEffect(() => {
    if (props.notice) say(props.notice);
  }, [props.notice]);

  const ply = props.ply ?? null;
  const plyWhere =
    ply === null ? null : ply === 0 || !props.positions[ply - 1] ? b.atStart : b.atMove(ply, describeMove(speaker, props.positions[ply - 1]!, props.moves[ply - 1]!));
  const whereText = props.where !== undefined ? props.where : plyWhere;

  useEffect(() => {
    const where = whereText;
    if (where) say(where);
    else if (lastWhere.current) say(b.current);
    lastWhere.current = where;
  }, [whereText]);

  useEffect(() => {
    const mine = props.clocks ? COLORS.map((color) => props.clocks![color]).find((clock) => clock.mine && clock.running) : undefined;
    if (!mine) return;
    const check = () => {
      const left = timeLeft(mine);
      if (left >= LOW_TIME) warned.current = false;
      else if (!warned.current && left > 0) {
        warned.current = true;
        say(b.lowTime);
      }
    };
    check();
    const id = setInterval(check, 1000);
    return () => clearInterval(id);
  }, [props.clocks]);

  /** Plays the only move, or lists them numbered when several match. */
  const offer = (moves: readonly Move[]) => {
    if (moves.length === 1) {
      setOptions(null);
      props.onMove?.(moves[0]!);
      return;
    }
    setOptions(moves);
    say(b.options(moves.length), ...moves.map((move, index) => b.option(index + 1, describeMove(speaker, props.position, move))));
  };

  /** A move typed while looking at an earlier position: back to the current one, and the player types it again there. */
  const backToLive = () => {
    setOptions(null);
    props.onLive?.();
    say(b.history);
  };

  const run = (text: string) => {
    const command = parseCommand(speaker, text);
    if (!command) return;
    if (command.kind !== 'resign') setConfirmResign(false);
    if (command.kind !== 'help' && command.kind !== 'pick') {
      const answer = props.onCommand?.(text);
      if (answer !== null && answer !== undefined) return say(answer);
    }
    const { position, legal, moves, positions, navigation } = props;
    switch (command.kind) {
      case 'help':
        return say(...b.help, ...(props.help ? [props.help] : []));
      case 'goal':
        return say(props.goal ?? b.noGoal);
      case 'prev':
      case 'next':
      case 'first':
      case 'end':
        return navigation?.[command.kind] ? navigation[command.kind]!() : say(b.unavailable);
      case 'position':
        return say(describePosition(speaker, position));
      case 'square':
        return say(describeSquare(speaker, position, command.square));
      case 'hands':
        return say(describeHands(speaker, position));
      case 'reach':
        return say(describeReach(speaker, position, command.square));
      case 'last': {
        const last = moves.length - 1;
        return say(last >= 0 && positions[last] ? describeMove(speaker, positions[last], moves[last]!) : b.noMoveYet);
      }
      case 'clocks': {
        const clocks = props.clocks;
        if (clocks) return say(COLORS.map((color) => b.clock(`${t.colors[color]}, ${names[color]}`, formatClock(timeLeft(clocks[color])))).join(' '));
        return say(props.timeInfo ?? b.noClock);
      }
      case 'draw':
        return props.commands?.draw ? props.commands.draw() : say(b.unavailable);
      case 'resign':
        if (!props.commands?.resign) return say(b.unavailable);
        if (!confirmResign) {
          setConfirmResign(true);
          return say(b.confirmResign);
        }
        setConfirmResign(false);
        return props.commands.resign();
      case 'done': {
        if (!live) return backToLive();
        const done = legal.find((move) => move.kind === 'done');
        return done ? offer([done]) : say(legal.length ? b.noMatch : b.notYourTurn);
      }
      case 'pick': {
        const picked = options?.[command.index - 1];
        if (picked && !live) return backToLive();
        return picked ? offer([picked]) : say(b.unreadable);
      }
      case 'move': {
        if (!live) return backToLive();
        // On a page without moves, only text that reads as a move is told so; anything else is not understood.
        if (!props.onMove) return say(matchMoves(speaker, position, legalMoves(position), command.text) === null ? b.unreadable : b.readOnly);
        if (!legal.length) return say(b.notYourTurn);
        const matched = matchMoves(speaker, position, legal, command.text);
        if (matched === null) return say(b.unreadable);
        if (matched.length === 0) return say(b.noMatch);
        return offer(matched);
      }
    }
  };

  return (
    <section class="ligungi-card ligungi-blind" aria-labelledby="blind-title">
      <h2 id="blind-title">{props.title ?? b.title}</h2>
      <form
        class="form3"
        onSubmit={(event) => {
          event.preventDefault();
          run(value);
          setValue('');
        }}
      >
        <Field label={b.command} htmlFor="blind-command" help={b.commandHelp}>
          <input
            id="blind-command"
            ref={input}
            class="form-control"
            autoComplete="off"
            autoCapitalize="off"
            spellcheck={false}
            value={value}
            onInput={(event) => setValue((event.target as HTMLInputElement).value)}
          />
        </Field>
      </form>
      <h3 id="blind-log">{b.log}</h3>
      <div class="ligungi-blind__log" ref={logBox} role="log" aria-live="polite" aria-labelledby="blind-log">
        {log.map((entry) => (
          <p key={entry.id}>{entry.text}</p>
        ))}
      </div>
      <KeyboardBoard
        speaker={speaker}
        position={props.position}
        orientation={props.orientation ?? 'white'}
        legal={live && props.onMove ? props.legal : []}
        onPlay={offer}
        say={say}
      />
    </section>
  );
};
