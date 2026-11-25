import { moveToString, opposite, type Move } from '@ligungi/engine';
import type { GameView } from '@ligungi/protocol';
import { ExportGame } from '../../components/ExportGame.tsx';
import { BookmarkPanel } from '../../components/BookmarkPanel.tsx';
import { outcomeText, speedText, useT } from '../../i18n/index.ts';
import { ReportButton } from '../../components/ReportButton.tsx';
import { VoidGame } from '../../components/VoidGame.tsx';
import { session } from '../../session.ts';
import { useStore } from '../../store.ts';

/** The game's card beside the board: its settings, result and notices, export, bookmark, report and void. */
export const GameInfo = ({ view, notice, premove }: { view: GameView; notice: string | null; premove: Move | null }) => {
  const t = useT();
  const { user, moderator } = useStore(session);
  const opponent = view.you ? opposite(view.you) : null;
  const started = view.status === 'started';
  return (
  <section class="ligungi-card ligungi-game-info">
    <p class="ligungi-game-info__setup">
      {t.modes[view.mode]} · {speedText(t, view)} · {view.rated ? t.rated : t.casual}
    </p>
    {view.freeDraft && <p class="ligungi-notice">{t.freeDraftHint}</p>}
    {!started && <p class="ligungi-game-info__status">{outcomeText(t, view.outcome, view.status === 'aborted')}</p>}
    {notice && <p class="ligungi-notice">{notice}</p>}
    {premove && <p class="ligungi-notice">{t.game.premove(moveToString(premove))}</p>}
    {view.voided && <p class="ligungi-notice ligungi-game-info__voided">{t.mod.voided}</p>}
    <ExportGame gameId={view.id} />
    {user && <BookmarkPanel gameId={view.id} />}
    {(() => {
      // A player can report their opponent from the game; a moderator can void a finished rated one.
      const rival = opponent ? view.players[opponent].user : null;
      const canVoid = moderator && view.status === 'ended' && view.rated && !view.voided;
      if (!(user && rival) && !canVoid) return null;
      return (
        <div class="ligungi-game-info__actions">
          {user && rival && <ReportButton username={rival.name} gameId={view.id} />}
          {canVoid && <VoidGame gameId={view.id} />}
        </div>
      );
    })()}
  </section>
  );
};
