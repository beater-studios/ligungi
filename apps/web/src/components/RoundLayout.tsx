import { moveToRulebook, type Color, type Move, type Position } from '@ligungi/engine';
import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { formatClock, useT } from '../i18n/index.ts';
import { icons } from '../icons.ts';
import { playSound } from '../sound.ts';
import { BoardView, type BoardProps } from './BoardView.tsx';
import { DraftPanel, TowerPanel } from './Panels.tsx';

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
}

const LOW_TIME = 20_000;

const ClockBox = ({ color, position, clock }: { color: Color; position: 'top' | 'bottom'; clock: RoundClock }) => {
  const [, setTick] = useState(0);
  const warned = useRef(false);
  useEffect(() => {
    if (!clock.running) return;
    const id = setInterval(() => setTick((n) => n + 1), 100);
    return () => clearInterval(id);
  }, [clock.running, clock.since]);
  const left = clock.running ? Math.max(0, clock.ms - (performance.now() - clock.since)) : clock.ms;
  if (clock.mine && clock.running && left < LOW_TIME && !warned.current) {
    warned.current = true;
    playSound('lowtime');
  }
  if (left >= LOW_TIME) warned.current = false;
  const classes = ['rclock', `rclock-${position}`, `rclock-${color}`];
  if (clock.running) classes.push('running');
  if (left < LOW_TIME) classes.push('emerg');
  if (left <= 0) classes.push('outoftime');
  return (
    <div class={classes.join(' ')}>
      <div class={`time${left >= 3_600_000 ? ' hour' : ''}`}>{formatClock(left)}</div>
    </div>
  );
};

const UserBox = ({ player, position, myTurn = false }: { player: RoundPlayer; position: 'top' | 'bottom'; myTurn?: boolean }) => {
  const t = useT();
  return (
  <div class={`ruser-${position} ruser user-link ${player.online === false ? 'offline' : 'online'}${myTurn ? ' ligungi-my-turn' : ''}`}>
    <i class="line" title={player.online === false ? t.common.offline : t.common.online} />
    {player.href ? (
      <a class="text ulpt" href={player.href}>
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
        先
      </span>
    )}
    {myTurn && <span class="ligungi-turn-badge">{t.common.yourTurn}</span>}
  </div>
  );
};

/** Move list with lila's markup: navigation buttons, then index + moves, two plies per row. */
const MoveTable = ({ positions, moves, ply, onPly, onFlip, analysisHref, status }: Pick<RoundLayoutProps, 'positions' | 'moves' | 'ply' | 'onPly' | 'onFlip' | 'analysisHref' | 'status'>) => {
  const t = useT();
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
      rows.push(
        <z7yx key={`m${j}`} class={j + 1 === current ? 'a1t' : ''} onClick={() => go(j + 1)}>
          {moveToRulebook(positions[j]!, move)}
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

  return (
    <main class="round">
      <aside class="round__side">
        {props.side}
        <div class="ligungi-panels box">
          {props.board.position && (
            <DraftPanel
              position={props.board.position}
              names={{ white: props.players.white.name, black: props.players.black.name }}
            />
          )}
          {props.board.position && <TowerPanel position={props.board.position} square={inspected} />}
        </div>
      </aside>
      <div class="round__app variant-standard">
        <div class="round__app__board main-board">
          {hands && (
            <BoardView
              {...props.board}
              orientation={props.orientation}
              handElements={hands}
              inspector={false}
              onInspect={setInspected}
            />
          )}
        </div>
        <div class="pocket is2d pocket-top" ref={topHand} />
        <div class="pocket is2d pocket-bottom" ref={bottomHand} />
        <div class="round__app__table" />
        <UserBox player={props.players[top]} position="top" />
        <UserBox player={props.players[bottom]} position="bottom" myTurn={props.myTurn ?? false} />
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
      <div class="round__underboard">{props.under}</div>
    </main>
  );
};
