import { opposite } from '@ligungi/engine';
import type { GameView } from '@ligungi/protocol';
import { useT } from '../../i18n/index.ts';
import { icons } from '../../icons.ts';
import { socket } from '../../core/socket.ts';

/** Sends a game command of the viewer: resign, abort or claim, and the answers to draw, takeback and rematch offers. */
export const gameCommands = (gameId: string) => ({
  action: (kind: 'resign' | 'abort' | 'claim') => socket.send({ t: kind, game: gameId }),
  offer: (kind: 'draw' | 'rematch' | 'takeback', act: 'offer' | 'accept' | 'decline') => socket.send({ t: kind, game: gameId, action: act }),
});

export type Declined = 'draw' | 'takeback' | 'rematch';

/**
 * Under the clocks: the move waiting for Confirm, the player's buttons, the offers to answer or waiting for an answer,
 * and once the game is over, the rematch and a new game.
 */
export const GameControls = ({
  view,
  doneAvailable,
  pendingText,
  onCancelPending,
  onConfirmPending,
  onDone,
  confirming,
  onConfirming,
  declined,
}: {
  view: GameView;
  doneAvailable: boolean;
  /** The move waiting for Confirm, or null. */
  pendingText: string | null;
  onCancelPending: () => void;
  onConfirmPending: () => void;
  onDone: () => void;
  confirming: 'resign' | 'draw' | null;
  onConfirming: (next: 'resign' | 'draw' | null) => void;
  declined: Declined | null;
}) => {
  const t = useT();
  const you = view.you ?? null;
  const opponent = you ? opposite(you) : null;
  const started = view.status === 'started';
  const { action, offer } = gameCommands(view.id);
  return (
  <>
    {pendingText !== null && (
      <div class="question ligungi-confirm-move" role="group" aria-label={t.game.confirmMove}>
        <button type="button" class="no" title={t.game.cancel} aria-label={t.game.cancel} data-icon={icons.X} onClick={onCancelPending} />
        <p>
          {t.game.confirmMove} <strong>{pendingText}</strong>
        </p>
        <button type="button" class="yes" title={t.game.confirm} aria-label={t.game.confirm} data-icon={icons.Checkmark} onClick={onConfirmPending} />
      </div>
    )}
    {you && started && (
      <div class="ricons">
        {doneAvailable && (
          <button type="button" class="fbt text strong glowing ligungi-done" onClick={onDone}>
            {t.done}
          </button>
        )}
        {confirming ? (
          <div class="act-confirm">
            <span class="ligungi-confirm-text">{confirming === 'resign' ? t.game.confirmResign : t.game.confirmDraw}</span>
            <button
              type="button"
              class="fbt yes"
              title={t.game.confirm}
              data-icon={icons.Checkmark}
              onClick={() => {
                if (confirming === 'resign') action('resign');
                else offer('draw', 'offer');
                onConfirming(null);
              }}
            />
            <button type="button" class="fbt no" title={t.game.cancel} data-icon={icons.X} onClick={() => onConfirming(null)} />
          </div>
        ) : view.canAbort ? (
          <button type="button" class="fbt abort ligungi-ctl" title={t.game.abort} data-icon={icons.X} onClick={() => action('abort')}>
            <span>{t.game.ctlAbort}</span>
          </button>
        ) : (
          <>
            {view.canTakeback && view.takebackOffer !== opponent && (
              <button
                type="button"
                class="fbt takeback-yes ligungi-ctl"
                title={view.takebackOffer === you ? t.game.takebackProposed : t.game.proposeTakeback}
                disabled={view.takebackOffer === you}
                data-icon={icons.Back}
                onClick={() => offer('takeback', 'offer')}
              >
                <span>{t.game.ctlTakeback}</span>
              </button>
            )}
            <button
              type="button"
              class="fbt draw-yes ligungi-ctl"
              title={view.drawOffer === you ? t.game.drawOffered : t.game.offerDraw}
              disabled={view.drawOffer === you}
              data-icon={icons.OneHalf}
              onClick={() => onConfirming('draw')}
            >
              <span>{t.game.ctlDraw}</span>
            </button>
            <button type="button" class="fbt resign ligungi-ctl" title={t.game.resign} data-icon={icons.FlagOutline} onClick={() => onConfirming('resign')}>
              <span>{t.game.ctlResign}</span>
            </button>
          </>
        )}
      </div>
    )}
    {you && started && view.drawOffer === opponent && (
      <div class="question">
        <button type="button" class="no" title={t.game.decline} data-icon={icons.X} onClick={() => offer('draw', 'decline')} />
        <p>{t.game.opponentOffersDraw}</p>
        <button type="button" class="yes" title={t.game.accept} data-icon={icons.Checkmark} onClick={() => offer('draw', 'accept')} />
      </div>
    )}
    {you && started && view.takebackOffer === opponent && (
      <div class="question">
        <button type="button" class="no" title={t.game.decline} data-icon={icons.X} onClick={() => offer('takeback', 'decline')} />
        <p>{t.game.opponentProposesTakeback}</p>
        <button type="button" class="yes" title={t.game.accept} data-icon={icons.Checkmark} onClick={() => offer('takeback', 'accept')} />
      </div>
    )}
    {you && started && view.drawOffer === you && (
      <div class="pending">
        <p>{t.game.drawPending}</p>
      </div>
    )}
    {you && started && view.takebackOffer === you && (
      <div class="pending">
        <p>{t.game.takebackPending}</p>
      </div>
    )}
    {declined && (
      <p class="ligungi-declined" role="status">
        {{ draw: t.game.drawDeclined, takeback: t.game.takebackDeclined, rematch: t.game.rematchDeclined }[declined]}
      </p>
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
        {view.arena ? (
          <a class="fbt strong glowing" href={`/arena/${view.arena}`}>
            {t.arena.back}
          </a>
        ) : view.rematchId ? (
          <a class="fbt strong glowing" href={`/${view.rematchId}`}>
            {t.game.goToRematch}
          </a>
        ) : you && view.status === 'ended' && view.rematchOffer === opponent ? (
          <div class="question">
            <button type="button" class="no" title={t.game.decline} data-icon={icons.X} onClick={() => offer('rematch', 'decline')} />
            <p>{t.game.opponentWantsRematch}</p>
            <button type="button" class="yes" title={t.game.accept} data-icon={icons.Checkmark} onClick={() => offer('rematch', 'accept')} />
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
};
