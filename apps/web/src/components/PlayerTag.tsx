import type { PlayerView } from '@ligungi/protocol';
import { playerName, useT } from '../i18n/index.ts';

type PlayerLike = Pick<PlayerView, 'name' | 'user' | 'rating' | 'ratingDiff'> & Partial<Pick<PlayerView, 'provisional' | 'online'>>;

export const PlayerTag = ({ player, showOnline = false }: { player: PlayerLike; showOnline?: boolean }) => {
  const t = useT();
  return (
  <span class="player-tag">
    {showOnline && <i class={`presence ${player.online ? 'on' : 'off'}`} title={player.online ? t.common.online : t.common.offline} />}
    {player.user ? <a href={`/@/${player.user.name}`}>{player.name}</a> : <span class="anon">{playerName(t, player)}</span>}
    {player.rating !== null && (
      <span class="rating">
        {player.rating}
        {player.provisional ? '?' : ''}
      </span>
    )}
    {player.ratingDiff !== null && player.ratingDiff !== undefined && (
      <span class={`diff ${player.ratingDiff >= 0 ? 'up' : 'down'}`}>
        {player.ratingDiff >= 0 ? `+${player.ratingDiff}` : player.ratingDiff}
      </span>
    )}
  </span>
  );
};
