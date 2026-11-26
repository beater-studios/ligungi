import type { Shape } from '@ligungi/board';
import { applyMove, legalMoves, moveToString, opposite, type Color, type Move } from '@ligungi/engine';
import { DAY_MS, EXTRA_TIME_SECONDS, isByoyomi, type GameView } from '@ligungi/protocol';
import type { ComponentChildren } from 'preact';
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { usePresence } from '../presence.ts';
import { turnNotice } from '../game/challenges.ts';
import { Crosstable } from '../game/Crosstable.tsx';
import { RoundLayout, type RoundPlayer } from '../game/RoundLayout.tsx';
import { getT, outcomeText, pieceNamesFor, playerName, useT } from '../i18n/index.ts';
import { moveText, useMoveText } from '../game/notation.ts';
import { notify } from '../notify.ts';
import { prefs } from '../prefs/prefs.ts';
import { replayGame } from '../game/replay.ts';
import { socket } from '../core/socket.ts';
import { playSound } from '../sound.ts';
import { moveSound } from '../blind/speech.ts';
import { useStore } from '../core/store.ts';
import { GameControls, gameCommands, type Declined } from './game/GameControls.tsx';
import { GameInfo } from './game/GameInfo.tsx';
import { DraftQueue, draftPlan } from './game/DraftQueue.tsx';
import { useGameSocket } from './game/useGameSocket.ts';

/**
 * The board keeps an option until it is given another, so leaving the draft plan passes no marks rather than leaving
 * the planned squares marked.
 */
const NO_SHAPES: readonly Shape[] = [];

/** `tv`: the channel list, shown above the game details when the game is watched on a TV channel. */
export const GamePage = ({ id, tv }: { id: string; tv?: ComponentChildren }) => {
  const t = useT();
  const [notice, setNotice] = useState<string | null>(null);
  const [ply, setPly] = useState<number | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [premove, setPremove] = useState<Move | null>(null);
  /** A move made on the board that waits for Confirm (the move confirmation preference). */
  const [pending, setPending] = useState<Move | null>(null);
  const { confirmMove } = useStore(prefs);
  const listedMove = useMoveText();
  const [confirming, setConfirming] = useState<'resign' | 'draw' | null>(null);
  const previous = useRef<Pick<GameView, 'status' | 'drawOffer' | 'takebackOffer' | 'rematchOffer'> & { plies: number } | null>(null);
  /** The opponent turned down the viewer's offer: said once, until the next move or offer. */
  const [declined, setDeclined] = useState<Declined | null>(null);
  const { view, receivedAt, error } = useGameSocket(id, setNotice);

  useEffect(() => {
    setPly(null);
    setPremove(null);
    setDeclined(null);
    previous.current = null;
  }, [id]);

  // Keyed on the last move too: after a takeback the list can come back with the same length but other moves.
  const replay = useMemo(
    () => (view ? replayGame(view.mode, view.firstPlayer, view.freeDraft, view.moves) : null),
    [view?.id, view?.moves.length, view?.moves[view.moves.length - 1]],
  );

  useEffect(() => {
    if (!view || !replay) return;
    const before = previous.current;
    previous.current = {
      plies: view.moves.length,
      status: view.status,
      drawOffer: view.drawOffer,
      takebackOffer: view.takebackOffer,
      rematchOffer: view.rematchOffer,
    };
    if (!before) {
      if (view.status === 'started' && view.moves.length === 0) playSound('notify');
      return;
    }
    // An offer of ours that vanished with no move and no result was declined (a move by the opponent also clears a
    // draw offer, as on lichess, and needs no message).
    const me = view.you;
    if (me) {
      const samePly = view.moves.length === before.plies;
      if (before.drawOffer === me && !view.drawOffer && samePly && view.status === 'started') setDeclined('draw');
      else if (before.takebackOffer === me && !view.takebackOffer && samePly && view.status === 'started') setDeclined('takeback');
      else if (before.rematchOffer === me && !view.rematchOffer && !view.rematchId) setDeclined('rematch');
      else if (view.drawOffer === me || view.takebackOffer === me || view.rematchOffer === me || !samePly) setDeclined(null);
    }
    if (view.moves.length < before.plies) {
      // A takeback: a browsed move may be gone, and a queued premove was meant for the position that no longer is.
      setPly(null);
      setPremove(null);
    }
    if (view.moves.length > before.plies) {
      const last = replay.moves[replay.moves.length - 1];
      const played = replay.positions[replay.moves.length - 1];
      if (last && played) moveSound(view.you ? 'online' : 'watching', played, last, !view.you ? 'other' : played.turn === view.you ? 'self' : 'opponent');
      setNotice(null);
      // A correspondence game is announced by the `turns` message, on whatever page the player is.
      if (last && played && me && view.status === 'started' && view.daysPerMove === null && replay.game.position.turn === me) {
        const { notation, pieceNames } = prefs.get();
        const t = getT();
        const text = moveText(notation, played, last, t, pieceNamesFor(t, pieceNames));
        notify(turnNotice({ ...view, turn: me }, getT().notify.lastMove(text)));
      }
    }
    if (before.status === 'started' && view.status !== 'started') {
      const winner = view.outcome?.winner;
      if (!view.you || view.status === 'aborted') playSound('notify');
      else if (winner === undefined || winner === null) playSound('draw');
      else playSound(winner === view.you ? 'victory' : 'defeat');
    }
  }, [view, replay]);

  const live = ply === null;
  const you = view?.you ?? null;
  const position = replay ? (live ? replay.game.position : (replay.positions[ply] ?? replay.game.position)) : null;
  const myTurn = Boolean(view && you && view.status === 'started' && position?.turn === you && live);
  usePresence(
    view && {
      kind: 'game',
      mode: view.mode,
      status: view.status,
      role: you ? 'player' : 'spectator',
      ...(you ? { color: you } : {}),
      // Anonymous players have no name to show.
      white: view.players.white.user ? view.players.white.name : '',
      black: view.players.black.user ? view.players.black.name : '',
      rated: String(view.rated),
      correspondence: String(view.daysPerMove !== null),
    },
  );

  const moves = useMemo(() => (replay && myTurn ? legalMoves(replay.game.position) : []), [replay, myTurn]);
  // Correspondence draft, on the opponent's turn: the viewer plans their next placements on the board.
  const queuing = Boolean(
    view && you && live && view.status === 'started' && view.daysPerMove !== null && replay?.game.position.phase === 'draft' && replay.game.position.turn !== you,
  );
  const plan = useMemo(
    () => (queuing && replay && view && you ? draftPlan(replay.game.position, view.draftQueue, you) : null),
    [queuing, replay, view?.draftQueue, you],
  );
  const planMoves = useMemo(() => (plan && !plan.endsWithDone ? legalMoves(plan.position) : []), [plan]);
  const planShapes = useMemo(
    (): readonly Shape[] => plan?.moves.flatMap((m) => (m.kind === 'drop' ? [{ kind: 'square' as const, square: m.to, color: 'blue' }] : [])) ?? NO_SHAPES,
    [plan],
  );
  const sendQueue = useCallback(
    (queued: readonly Move[]) => {
      if (!view) return;
      if (!socket.send({ t: 'queue', game: view.id, moves: queued.map(moveToString) })) setNotice(getT().offline);
    },
    [view],
  );
  const premoveMoves = useMemo(() => {
    if (!replay || !view || !you || !live || view.status !== 'started') return [];
    const current = replay.game.position;
    if (current.turn === you || current.phase !== 'play') return [];
    return legalMoves({ ...current, turn: you });
  }, [replay, view?.status, you, live]);

  const send = useCallback(
    (move: Move) => {
      if (!view) return;
      const sent = socket.send({ t: 'move', game: view.id, move: moveToString(move), ply: view.moves.length });
      if (!sent) setNotice(getT().offline);
    },
    [view],
  );

  useEffect(() => setConfirming(null), [view?.moves.length, view?.status]);
  useEffect(() => setPending(null), [view?.id, view?.moves.length, view?.status, ply]);

  const askConfirm = Boolean(view) && (confirmMove === 'always' || (confirmMove === 'correspondence' && view?.daysPerMove !== null));
  const onBoardMove = useCallback((move: Move) => (askConfirm ? setPending(move) : send(move)), [askConfirm, send]);
  const confirmPending = useCallback(() => {
    if (pending) send(pending);
    setPending(null);
  }, [pending, send]);

  // Enter confirms and Escape cancels, unless the keys go to a field, a button or a link, which have their own.
  useEffect(() => {
    if (!pending) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, button, a, [contenteditable="true"]')) return;
      if (event.key === 'Enter') {
        event.preventDefault();
        confirmPending();
      } else if (event.key === 'Escape') setPending(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pending, confirmPending]);

  useEffect(() => {
    if (!myTurn) return;
    const original = document.title;
    let flash = false;
    const id = setInterval(() => {
      if (!document.hidden) {
        document.title = original;
        return;
      }
      flash = !flash;
      document.title = flash ? getT().game.titleFlash : original;
    }, 1000);
    return () => {
      clearInterval(id);
      document.title = original;
    };
  }, [myTurn]);

  useEffect(() => {
    if (!premove || !replay || !myTurn) return;
    const key = moveToString(premove);
    if (moves.some((m) => moveToString(m) === key)) send(premove);
    setPremove(null);
  }, [myTurn, replay]);

  if (error) {
    return (
      <main class="page-small box box-pad page">
        <h1 class="box__top">{t.game.notFound}</h1>
        <p>{error}</p>
      </main>
    );
  }
  if (!view || !replay || !position) return <main class="round" />;

  const orientation: Color = flipped ? opposite(you ?? 'white') : (you ?? 'white');
  const lastMove = live ? (replay.moves[replay.moves.length - 1] ?? null) : ply > 0 ? replay.moves[ply - 1]! : null;
  const opponent = you ? opposite(you) : null;
  const started = view.status === 'started';
  const turn = replay.game.position.turn;
  const { action, offer } = gameCommands(view.id);
  const giveTime = view.canGiveTime
    ? { label: t.game.giveTime(EXTRA_TIME_SECONDS), onClick: () => socket.send({ t: 'moretime', game: view.id }) }
    : null;
  const doneAvailable = myTurn && position.phase === 'draft' && moves.some((m) => m.kind === 'done');

  const player = (color: Color): RoundPlayer => {
    const p = view.players[color];
    return {
      name: playerName(t, p),
      href: p.user ? `/@/${p.user.name}` : null,
      rating: p.rating,
      provisional: p.provisional,
      ratingDiff: p.ratingDiff,
      online: p.online,
      first: view.firstPlayer === color,
    };
  };

  // Correspondence: the player to move sees their deadline run; the other one has the full days ahead.
  const correspondenceClock = (color: Color) => {
    const running = started && turn === color;
    const ms = running && view.deadlineIn !== null ? view.deadlineIn : (view.daysPerMove ?? 0) * DAY_MS;
    return { ms, since: receivedAt, running, mine: you === color, giveTime: null };
  };
  const byoyomi = isByoyomi(view.timeControl) ? view.timeControl : null;
  const clocks = view.clock
    ? {
        white: { ms: view.clock.white, since: receivedAt, running: started && view.clock.running === 'white', mine: you === 'white', giveTime: opponent === 'white' ? giveTime : null, byoyomi },
        black: { ms: view.clock.black, since: receivedAt, running: started && view.clock.running === 'black', mine: you === 'black', giveTime: opponent === 'black' ? giveTime : null, byoyomi },
      }
    : view.daysPerMove && started
      ? { white: correspondenceClock('white'), black: correspondenceClock('black') }
      : null;

  const status = started
    ? t.turnStatus(position.phase === 'draft', turn, myTurn ? 'you' : null)
    : outcomeText(t, view.outcome, view.status === 'aborted');

  const pendingText = pending ? (({ text, full }) => full ?? text)(listedMove(position, pending)) : null;
  const controls = (
    <GameControls
      view={view}
      doneAvailable={doneAvailable}
      pendingText={pendingText}
      onCancelPending={() => setPending(null)}
      onConfirmPending={confirmPending}
      onDone={() => send({ kind: 'done' })}
      confirming={confirming}
      onConfirming={setConfirming}
      declined={declined}
    />
  );

  const queuePanel = plan ? (
    <DraftQueue plan={plan} canDone={planMoves.some((m) => m.kind === 'done')} onChange={sendQueue} />
  ) : null;
  const info = <GameInfo view={view} notice={notice} premove={premove} />;
  // Between two accounts, their record so far, from the viewer's side when they play; reloaded when the game ends.
  const [whiteUser, blackUser] = [view.players.white.user, view.players.black.user];
  const crosstable =
    whiteUser && blackUser ? (
      <Crosstable
        a={(you === 'black' ? blackUser : whiteUser).name}
        b={(you === 'black' ? whiteUser : blackUser).name}
        version={view.status}
      />
    ) : null;
  const side = (
    <>
      {tv}
      {info}
      {crosstable}
    </>
  );

  return (
    <RoundLayout
      heading={t.game.heading(playerName(t, view.players.white), playerName(t, view.players.black))}
      training={!view.rated}
      board={
        plan && you
          ? {
              // The queued placements are shown placed, each square marked, and a move on the board adds one more.
              position: plan.position,
              movableColor: you,
              moves: planMoves.filter((m) => m.kind !== 'done'),
              lastMove,
              onMove: (move: Move) => sendQueue([...plan.moves, move]),
              shapes: planShapes,
            }
          : {
              // A move waiting for Confirm is shown played, and the board waits for the answer.
              position: pending ? applyMove(position, pending) : position,
              movableColor: live && started && you && !pending ? you : null,
              moves: pending ? [] : moves,
              lastMove: pending ?? lastMove,
              onMove: onBoardMove,
              premoveMoves: pending ? [] : premoveMoves,
              premove,
              onPremove: setPremove,
              shapes: NO_SHAPES,
            }
      }
      onTypedMove={plan ? (move: Move) => sendQueue([...plan.moves, move]) : send}
      {...(plan ? { played: replay.game.position } : {})}
      orientation={orientation}
      players={{ white: player('white'), black: player('black') }}
      clocks={clocks}
      turn={started ? turn : null}
      positions={replay.positions}
      moves={replay.moves}
      ply={ply}
      onPly={setPly}
      onFlip={() => setFlipped((f) => !f)}
      analysisHref={`/analysis?game=${view.id}`}
      gameKey={view.id}
      myTurn={myTurn}
      status={status}
      result={started ? null : outcomeText(t, view.outcome, view.status === 'aborted')}
      notice={
        you && started && view.drawOffer === opponent
          ? t.game.opponentOffersDraw
          : you && started && view.takebackOffer === opponent
            ? t.game.opponentProposesTakeback
            : declined
              ? { draw: t.game.drawDeclined, takeback: t.game.takebackDeclined, rematch: t.game.rematchDeclined }[declined]
              : null
      }
      {...(you && started
        ? { commands: { resign: () => action('resign'), draw: () => offer('draw', view.drawOffer === opponent ? 'accept' : 'offer') } }
        : {})}
      controls={
        <>
          {queuePanel}
          {controls}
        </>
      }
      side={side}
    />
  );
};
