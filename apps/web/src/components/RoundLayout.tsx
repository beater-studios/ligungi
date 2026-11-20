import { toFen, type Color, type Move, type Position } from '@ligungi/engine';
import { byoyomiState, type TimeControl } from '@ligungi/protocol';
import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { formatClock, useT } from '../i18n/index.ts';
import { useMoveText } from '../notation.ts';
import { icons } from '../icons.ts';
import { prefs } from '../prefs.ts';
import { useStore } from '../store.ts';
import { playCountdown, playSound, speak } from '../sound.ts';
import { BeginnerHint } from './BeginnerHint.tsx';
import { BlindPanel, type BlindCommands } from './BlindPanel.tsx';
import { BoardView, type BoardProps } from './BoardView.tsx';
import { DraftPanel, TowerPanel, TowerStrip } from './Panels.tsx';
import { useTowerTap } from '../towerTap.ts';

export interface RoundPlayer {
  readonly name: string;
  readonly href?: string | null;
  readonly rating?: number | null;
  readonly provisional?: boolean;
  readonly ratingDiff?: number | null;
  readonly online?: boolean;
  readonly first?: boolean;
}

export interface RoundClock {
  /** Milliseconds left when `since` was recorded (performance.now()). */
  readonly ms: number;
  readonly since: number;
  readonly running: boolean;
  readonly mine: boolean;
  /** A byo-yomi clock: `ms` is then the time until the flag falls, shown as main time, then the current period. */
  readonly byoyomi?: (TimeControl & { readonly byoyomi: number; readonly periods: number }) | null;
  /** Shown on the opponent's clock when the viewer may give them extra time, as lila's "+" button. */
  readonly giveTime?: { readonly label: string; readonly onClick: () => void } | null;
}

interface RoundLayoutProps {
  readonly board: BoardProps;
  readonly orientation: Color;
  readonly players: Readonly<Record<Color, RoundPlayer>>;
  readonly clocks?: Readonly<Record<Color, RoundClock>> | null;
  readonly turn: Color | null;
  readonly positions: readonly Position[];
  readonly moves: readonly Move[];
  readonly ply: number | null;
  readonly onPly: (ply: number | null) => void;
  readonly onFlip: () => void;
  readonly analysisHref?: string;
  readonly status?: ComponentChildren;
  readonly controls?: ComponentChildren;
  readonly side?: ComponentChildren;
  readonly under?: ComponentChildren;
  /** The user is to move: highlights their name and clock. */
  readonly myTurn?: boolean;
  /** The hidden pieces training may apply (not in rated games). */
  readonly training?: boolean;
  /** The result once the game is over, announced in the screen reader mode. */
  readonly result?: string | null;
  /** Something to announce in the screen reader mode, such as a draw offer. */
  readonly notice?: string | null;
  /** Typed commands of the screen reader mode beyond moving. */
  readonly commands?: BlindCommands;
  /** Moves typed in the screen reader mode, when they go somewhere else than the board's (no move confirmation). */
  readonly onTypedMove?: (move: Move) => void;
  /** The task, for the screen reader mode (a puzzle, a practice position). */
  readonly goal?: string | null;
  /** What the screen reader mode answers to `r` without clocks, such as a puzzle run's timer. */
  readonly timeInfo?: string | null;
  /**
   * Tells one game from the next when the page stays (a rematch, the next puzzle), so the screen reader mode starts over
   * instead of reading the change as moves taken back. The start position by default.
   */
  readonly gameKey?: string;
}

const LOW_TIME = 20_000;
/**
 * In byo-yomi the warning comes in the last seconds of every period: ten, or half of a shorter period, so a 10 second
 * period does not warn as soon as it starts.
 */
const periodWarning = (byoyomi: number): number => Math.min(10_000, (byoyomi * 1000) / 2);

/**
 * The last seconds of the player's own byo-yomi period: a beep when the warning starts; with the voice, the browser
 * says that second and every one from five down; with the sound set's countdown, every second plays its sound.
 * `spoken` remembers the last second announced, so each is counted once.
 */
const announcePeriod = (period: number, warning: number, spoken: { current: number | null }, locale: string): void => {
  const second = Math.ceil(period / 1000);
  if (period > warning + 1000) {
    spoken.current = null;
    return;
  }
  if (period > warning || second <= 0 || second === spoken.current) return;
  spoken.current = second;
  const first = second === Math.ceil(warning / 1000);
  const count = prefs.get().byoyomiCount;
  if (count === 'voice') {
    if (first || second <= 5) speak(String(second), locale);
  } else if (count === 'sounds') playCountdown(second);
  else if (first) playSound('lowtime');
};

const ClockBox = ({ color, position, clock }: { color: Color; position: 'top' | 'bottom'; clock: RoundClock }) => {
  const t = useT();
  const [, setTick] = useState(0);
  const warned = useRef(false);
  const spoken = useRef<number | null>(null);
  useEffect(() => {
    if (!clock.running) return;
    const id = setInterval(() => setTick((n) => n + 1), 100);
    return () => clearInterval(id);
  }, [clock.running, clock.since]);
  const left = clock.running ? Math.max(0, clock.ms - (performance.now() - clock.since)) : clock.ms;
  const byoyomi = clock.byoyomi ? byoyomiState(left, clock.byoyomi) : null;
  const inPeriod = byoyomi !== null && byoyomi.main === 0;
  const shown = byoyomi ? (inPeriod ? byoyomi.period : byoyomi.main) : left;
  const warning = clock.byoyomi ? periodWarning(clock.byoyomi.byoyomi) : 0;
  const low = inPeriod ? byoyomi.period <= warning : !byoyomi && left < LOW_TIME;
  if (inPeriod) {
    if (clock.mine && clock.running) announcePeriod(byoyomi.period, warning, spoken, t.locale);
  } else if (!byoyomi) {
    if (clock.mine && clock.running && left < LOW_TIME && !warned.current) {
      warned.current = true;
      playSound('lowtime');
    }
    if (left >= LOW_TIME) warned.current = false;
  }
  const classes = ['rclock', `rclock-${position}`, `rclock-${color}`];
  if (clock.running) classes.push('running');
  if (low) classes.push('emerg');
  if (left <= 0) classes.push('outoftime');
  if (byoyomi) classes.push('ligungi-byoyomi');
  return (
    <div class={classes.join(' ')}>
      <div class={`time${shown >= 3_600_000 ? ' hour' : ''}`}>{formatClock(shown)}</div>
      {byoyomi && clock.byoyomi && byoyomi.periods > 0 && (
        <span class="ligungi-byoyomi__periods" title={t.game.periodsLeft(byoyomi.periods)}>
          {inPeriod ? `×${byoyomi.periods}` : `+${clock.byoyomi.periods > 1 ? `${clock.byoyomi.periods}×` : ''}${clock.byoyomi.byoyomi}s`}
        </span>
      )}
      {clock.giveTime && (
        <button
          type="button"
          class="moretime"
          title={clock.giveTime.label}
          aria-label={clock.giveTime.label}
          data-icon={icons.PlusButton}
          onClick={clock.giveTime.onClick}
        />
      )}
    </div>
  );
};

/** A player row: initial, name, rating and first-player mark, with the turn or presence below; the clock shares the row. */
const UserBox = ({ player, color, position, myTurn = false }: { player: RoundPlayer; color: Color; position: 'top' | 'bottom'; myTurn?: boolean }) => {
  const t = useT();
  const presence = player.online === undefined ? null : player.online ? t.common.online : t.common.offline;
  return (
    <div class={`ruser-${position} ruser ligungi-ruser${myTurn ? ' ligungi-my-turn' : ''}`}>
      <span
        class={`ligungi-avatar ligungi-avatar--small ligungi-ruser__color--${color}${player.online ? ' ligungi-avatar--online' : ''}`}
        role="img"
        aria-label={t.colors[color]}
        title={t.colors[color]}
      >
        {player.name.slice(0, 1).toUpperCase()}
      </span>
      <span class="ligungi-ruser__body">
        <span class="ligungi-ruser__name">
          {player.href ? (
            <a class="ulpt" href={player.href}>
              {player.name}
            </a>
          ) : (
            <name>{player.name}</name>
          )}
          {player.rating !== null && player.rating !== undefined && (
            <rating>
              {player.rating}
              {player.provisional ? '?' : ''}
            </rating>
          )}
          {player.ratingDiff !== null && player.ratingDiff !== undefined && (
            <rating class={player.ratingDiff >= 0 ? 'good' : 'bad'}>
              {player.ratingDiff >= 0 ? `+${player.ratingDiff}` : player.ratingDiff}
            </rating>
          )}
          {player.first && (
            <span class="ligungi-first" title={t.common.startsGame}>
              {t.common.firstShort}
            </span>
          )}
        </span>
        {myTurn ? (
          <span class="ligungi-ruser__status ligungi-ruser__status--turn">{t.common.yourTurn}</span>
        ) : (
          presence && <span class="ligungi-ruser__status">{presence}</span>
        )}
      </span>
    </div>
  );
};

/** Move list with lila's markup: navigation buttons, then index + moves, two plies per row. */
const MoveTable = ({ positions, moves, ply, onPly, onFlip, analysisHref, status }: Pick<RoundLayoutProps, 'positions' | 'moves' | 'ply' | 'onPly' | 'onFlip' | 'analysisHref' | 'status'>) => {
  const t = useT();
  const moveText = useMoveText();
  const list = useRef<HTMLElement>(null);
  const current = ply ?? moves.length;
  const go = (next: number) => {
    const clamped = Math.max(0, Math.min(moves.length, next));
    onPly(clamped === moves.length ? null : clamped);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      const keys: Record<string, number> = { ArrowLeft: current - 1, ArrowRight: current + 1, ArrowUp: 0, Home: 0, ArrowDown: moves.length, End: moves.length };
      const next = keys[event.key];
      if (next === undefined) return;
      event.preventDefault();
      go(next);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current, moves.length, onPly]);

  useEffect(() => {
    const active = list.current?.querySelector('.a1t') as HTMLElement | null;
    if (active && list.current) list.current.scrollTop = active.offsetTop - list.current.clientHeight / 2;
  }, [current]);

  const rows = [];
  for (let i = 0; i < moves.length; i += 2) {
    rows.push(<qzm key={`i${i}`}>{i / 2 + 1}</qzm>);
    for (const j of [i, i + 1]) {
      const move = moves[j];
      if (!move) {
        rows.push(<z7yx key={`m${j}`} class="empty" />);
        continue;
      }
      const { text, full } = moveText(positions[j]!, move);
      rows.push(
        <z7yx key={`m${j}`} class={j + 1 === current ? 'a1t' : ''} title={full} aria-label={full} onClick={() => go(j + 1)}>
          {text}
        </z7yx>,
      );
    }
  }

  return (
    <i5d class="rmoves">
      <bo3 class="rbuttons">
        <button type="button" class="fbt flip" title={t.common.flip} data-icon={icons.ChasingArrows} onClick={onFlip} />
        <button type="button" class="fbt" title={t.common.first} data-icon={icons.JumpFirst} disabled={current === 0} onClick={() => go(0)} />
        <button type="button" class="fbt" title={t.common.prev} data-icon={icons.JumpPrev} disabled={current === 0} onClick={() => go(current - 1)} />
        <button type="button" class="fbt" title={t.common.next} data-icon={icons.JumpNext} disabled={current === moves.length} onClick={() => go(current + 1)} />
        <button type="button" class="fbt" title={t.common.last} data-icon={icons.JumpLast} disabled={current === moves.length} onClick={() => go(moves.length)} />
        {analysisHref && <a class="fbt analysis" title={t.common.analyse} href={analysisHref} data-icon={icons.Microscope} />}
      </bo3>
      <app class="moves" ref={list}>
        {rows}
        {status && (
          <div class="result-wrap">
            <p class="status">{status}</p>
          </div>
        )}
      </app>
    </i5d>
  );
};

/** Game screen with lila's round layout (round__app grid areas). */
export const RoundLayout = (props: RoundLayoutProps) => {
  const [hands, setHands] = useState<{ top: HTMLElement; bottom: HTMLElement } | null>(null);
  const [inspected, setInspected] = useState<number | null>(null);
  const topHand = useRef<HTMLDivElement>(null);
  const bottomHand = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (topHand.current && bottomHand.current) setHands({ top: topHand.current, bottom: bottomHand.current });
  }, []);
  const top: Color = props.orientation === 'white' ? 'black' : 'white';
  const bottom: Color = props.orientation;
  const { screenReader } = useStore(prefs);
  const shown = props.board.position;
  const tap = useTowerTap(props.training ?? false);

  return (
    <main class="round">
      <aside class="round__side">
        {props.side}
        <BeginnerHint />
        <div class="ligungi-panels ligungi-card">
          {props.board.position && (
            <DraftPanel
              position={props.board.position}
              names={{ white: props.players.white.name, black: props.players.black.name }}
            />
          )}
          {props.board.position && <TowerPanel position={props.board.position} square={inspected} training={props.training ?? false} />}
        </div>
      </aside>
      <div class={`round__app variant-standard${tap.strip ? ' ligungi-has-strip' : ''}`}>
        <div class="round__app__board main-board" aria-hidden={screenReader ? 'true' : undefined}>
          {hands && (
            <BoardView
              {...props.board}
              training={props.training ?? false}
              orientation={props.orientation}
              handElements={hands}
              inspector={tap.balloon}
              inspectSelection={tap.balloon}
              onInspect={setInspected}
            />
          )}
        </div>
        {tap.strip && shown && <TowerStrip position={shown} square={inspected} />}
        <div class="pocket is2d pocket-top" ref={topHand} aria-hidden={screenReader ? 'true' : undefined} />
        <div class="pocket is2d pocket-bottom" ref={bottomHand} aria-hidden={screenReader ? 'true' : undefined} />
        <div class="round__app__table" />
        <UserBox player={props.players[top]} color={top} position="top" />
        <UserBox player={props.players[bottom]} color={bottom} position="bottom" myTurn={props.myTurn ?? false} />
        {props.clocks && <ClockBox color={top} position="top" clock={props.clocks[top]} />}
        {props.clocks && <ClockBox color={bottom} position="bottom" clock={props.clocks[bottom]} />}
        <MoveTable
          positions={props.positions}
          moves={props.moves}
          ply={props.ply}
          onPly={props.onPly}
          onFlip={props.onFlip}
          status={props.status}
          {...(props.analysisHref ? { analysisHref: props.analysisHref } : {})}
        />
        <div class="rcontrols">{props.controls}</div>
      </div>
      <div class="round__underboard">
        {screenReader && shown && (
          <BlindPanel
            key={props.gameKey ?? (props.positions[0] ? toFen(props.positions[0]) : '')}
            position={shown}
            legal={props.board.moves ?? []}
            onMove={props.onTypedMove ?? props.board.onMove ?? undefined}
            positions={props.positions}
            moves={props.moves}
            live={props.ply === null}
            onLive={() => props.onPly(null)}
            ply={props.ply}
            navigation={{
              prev: () => props.onPly(Math.max(0, (props.ply ?? props.moves.length) - 1)),
              next: () => {
                const next = (props.ply ?? props.moves.length) + 1;
                props.onPly(next >= props.moves.length ? null : next);
              },
              first: () => props.onPly(0),
              end: () => props.onPly(null),
            }}
            orientation={props.orientation}
            goal={props.goal}
            timeInfo={props.timeInfo}
            names={{ white: props.players.white.name, black: props.players.black.name }}
            clocks={props.clocks}
            result={props.result}
            notice={props.notice}
            commands={props.commands}
          />
        )}
        {props.under}
      </div>
    </main>
  );
};
