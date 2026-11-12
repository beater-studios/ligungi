import { legalMoves, moveToString, opposite, type Color, type Move } from '@ligungi/engine';
import type { GameView } from '@ligungi/protocol';
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { api } from '../api.ts';
import { RoundLayout, type RoundPlayer } from '../components/RoundLayout.tsx';
import { errorText, getT, outcomeText, playerName, timeControlText, useT } from '../i18n/index.ts';
import { icons } from '../icons.ts';
import { replayGame } from '../replay.ts';
import { socket } from '../socket.ts';
import { playSound } from '../sound.ts';

export const GamePage = ({ id }: { id: string }) => {
  const t = useT();
  const [view, setView] = useState<GameView | null>(null);
  const [receivedAt, setReceivedAt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [ply, setPly] = useState<number | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [premove, setPremove] = useState<Move | null>(null);
  const [confirming, setConfirming] = useState<'resign' | 'draw' | null>(null);
  const previous = useRef<{ plies: number; status: string } | null>(null);

  useEffect(() => {
    setView(null);
    setPly(null);
    setPremove(null);
    setError(null);
    previous.current = null;
    let alive = true;
    api
      .get<GameView>(`/api/games/${id}`)
      .then((game) => {
        if (!alive) return;
        setView((current) => current ?? game);
        setReceivedAt(performance.now());
      })
      .catch((err: Error) => alive && setError(err.message));
    const unsubscribe = socket.subscribe(`game:${id}`);
    const off = socket.on((message) => {
      if (message.t === 'game' && message.game.id === id) {
        setView(message.game);
        setReceivedAt(performance.now());
      } else if (message.t === 'error') {
        setNotice(errorText(getT(), message.code, message.message));
        playSound('error');
      }
    });
    return () => {
      alive = false;
      unsubscribe();
      off();
    };
  }, [id]);

  const replay = useMemo(
    () => (view ? replayGame(view.mode, view.firstPlayer, view.freeDraft, view.moves) : null),
    [view?.id, view?.moves.length],
  );

  useEffect(() => {
    if (!view || !replay) return;
    const before = previous.current;
    previous.current = { plies: view.moves.length, status: view.status };
    if (!before) {
      if (view.status === 'started' && view.moves.length === 0) playSound('notify');
      return;
    }
    if (view.moves.length > before.plies) {
      const last = replay.moves[replay.moves.length - 1];
      playSound(last?.kind === 'move' && last.action === 'capture' ? 'capture' : 'move');
      setNotice(null);
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
  const position = replay ? (live ? replay.game.position : replay.positions[ply]!) : null;
  const myTurn = Boolean(view && you && view.status === 'started' && position?.turn === you && live);

  const moves = useMemo(() => (replay && myTurn ? legalMoves(replay.game.position) : []), [replay, myTurn]);
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
  const action = (kind: 'resign' | 'abort' | 'claim') => socket.send({ t: kind, game: view.id });
  const offer = (kind: 'draw' | 'rematch', act: 'offer' | 'accept' | 'decline') => socket.send({ t: kind, game: view.id, action: act });
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

  const clocks = view.clock
    ? {
        white: { ms: view.clock.white, since: receivedAt, running: started && view.clock.running === 'white', mine: you === 'white' },
        black: { ms: view.clock.black, since: receivedAt, running: started && view.clock.running === 'black', mine: you === 'black' },
      }
    : null;

  const status = started
    ? t.turnStatus(position.phase === 'draft', turn, myTurn ? 'you' : null)
    : outcomeText(t, view.outcome, view.status === 'aborted');

  const controls = (
    <>
      {you && started && (
        <div class="ricons">
          {doneAvailable && (
            <button type="button" class="fbt text strong glowing ligungi-done" onClick={() => send({ kind: 'done' })}>
              済み {t.done}
            </button>
          )}
          {confirming ? (
            <div class="act-confirm">
              <span class="ligungi-confirm-text">{confirming === 'resign' ? t.game.confirmResign : t.game.confirmDraw}</span>
              <button
                type="button"
                class="fbt yes active"
                title={t.game.confirm}
                data-icon={icons.Checkmark}
                onClick={() => {
                  if (confirming === 'resign') action('resign');
                  else offer('draw', 'offer');
                  setConfirming(null);
                }}
              />
              <button type="button" class="fbt no" title={t.game.cancel} data-icon={icons.X} onClick={() => setConfirming(null)} />
            </div>
          ) : view.canAbort ? (
            <button type="button" class="fbt abort" title={t.game.abort} data-icon={icons.X} onClick={() => action('abort')} />
          ) : (
            <>
              <button
                type="button"
                class="fbt draw-yes"
                title={view.drawOffer === you ? t.game.drawOffered : t.game.offerDraw}
                disabled={view.drawOffer === you}
                data-icon={icons.OneHalf}
                onClick={() => setConfirming('draw')}
              />
              <button type="button" class="fbt resign" title={t.game.resign} data-icon={icons.FlagOutline} onClick={() => setConfirming('resign')} />
            </>
          )}
        </div>
      )}
      {you && started && view.drawOffer === opponent && (
        <div class="question">
          <button type="button" class="fbt no" title={t.game.decline} data-icon={icons.X} onClick={() => offer('draw', 'decline')} />
          <p>{t.game.opponentOffersDraw}</p>
          <button type="button" class="fbt yes draw-yes" title={t.game.accept} data-icon={icons.Checkmark} onClick={() => offer('draw', 'accept')} />
        </div>
      )}
      {view.canClaimVictory && (
        <div class="suggestion">
          <p>{t.game.opponentLeft}</p>
          <button type="button" class="button" onClick={() => action('claim')}>
            {t.game.claimVictory}
          </button>
        </div>
      )}
      {!started && (
        <div class="follow-up">
          {view.rematchId ? (
            <a class="fbt strong glowing" href={`/${view.rematchId}`}>
              {t.game.goToRematch}
            </a>
          ) : you && view.status === 'ended' && view.rematchOffer === opponent ? (
            <div class="question">
              <button type="button" class="fbt no" title={t.game.decline} data-icon={icons.X} onClick={() => offer('rematch', 'decline')} />
              <p>{t.game.opponentWantsRematch}</p>
              <button type="button" class="fbt yes" title={t.game.accept} data-icon={icons.Checkmark} onClick={() => offer('rematch', 'accept')} />
            </div>
          ) : you && view.status === 'ended' ? (
            <button
              type="button"
              class={`fbt rematch ${view.rematchOffer === you ? 'glowing' : ''}`}
              disabled={view.rematchOffer === you}
              onClick={() => offer('rematch', 'offer')}
            >
              {view.rematchOffer === you ? t.game.rematchOffered : t.game.rematch}
            </button>
          ) : null}
          <a class="fbt" href="/">
            {t.common.newGame}
          </a>
        </div>
      )}
    </>
  );

  const side = (
    <div class="game__meta">
      <section>
        <div class="game__meta__infos" data-icon={icons.Swords}>
          <div>
            <div class="header">
              <div class="setup">
                {timeControlText(t, view.timeControl)} • {view.rated ? t.rated : t.casual} • {t.modes[view.mode]}
                {view.freeDraft && <span title={t.freeDraftHint}> • {t.freeDraft}</span>}
              </div>
            </div>
          </div>
        </div>
        <div class="game__meta__players">
          {(['white', 'black'] as const).map((color) => (
            <div key={color} class={`player color-icon is ${color} text`}>
              {view.players[color].user ? (
                <a class="user-link" href={`/@/${view.players[color].name}`}>
                  {view.players[color].name}
                </a>
              ) : (
                playerName(t, view.players[color])
              )}
              {view.firstPlayer === color && <span class="ligungi-first">先</span>}
            </div>
          ))}
        </div>
      </section>
      {!started && (
        <section class="status">
          {outcomeText(t, view.outcome, view.status === 'aborted')}
        </section>
      )}
      {notice && <section class="ligungi-notice">{notice}</section>}
      {premove && <section class="ligungi-notice">{t.game.premove(moveToString(premove))}</section>}
      <section class="ligungi-links">
        <a href={`/api/games/${view.id}/export`} target="_blank" rel="noopener" data-icon={icons.Download}>
          {t.game.export}
        </a>
      </section>
    </div>
  );

  return (
    <RoundLayout
      board={{
        position,
        movableColor: live && started && you ? you : null,
        moves,
        lastMove,
        onMove: send,
        premoveMoves,
        premove,
        onPremove: setPremove,
      }}
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
      myTurn={myTurn}
      status={status}
      controls={controls}
      side={side}
    />
  );
};
