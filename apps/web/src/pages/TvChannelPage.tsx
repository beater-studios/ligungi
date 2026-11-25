import { TV_CHANNELS, type TvChannel, type TvChannelView } from '@ligungi/protocol';
import { useState } from 'preact/hooks';
import { api } from '../api.ts';
import { playerName, useT } from '../i18n/index.ts';
import { icons } from '../icons.ts';
import { GamePage } from './GamePage.tsx';
import { usePolling } from '../hooks.ts';

/** The server keeps a channel on its game until a few seconds after it ends, so polling is enough to follow it. */
const POLL_MS = 3_000;

const ChannelList = ({ channels, active }: { channels: readonly TvChannelView[] | null; active: TvChannel }) => {
  const t = useT();
  return (
    <nav class="ligungi-card ligungi-tv-channels" aria-label={t.tv.channels}>
      {TV_CHANNELS.map((channel) => {
        const game = channels?.find((view) => view.channel === channel)?.game ?? null;
        const current = channel === active;
        return (
          <a key={channel} class={`ligungi-tv-channel${current ? ' active' : ''}`} href={`/tv/${channel}`} aria-current={current ? 'page' : undefined}>
            <strong>{channel === 'best' ? t.tv.best : t.modes[channel]}</strong>
            <span>{game ? `${playerName(t, game.players.white)} × ${playerName(t, game.players.black)}` : t.tv.noGame}</span>
          </a>
        );
      })}
      <a class="text ligungi-tv-channels__all" href="/tv" data-icon={icons.AnalogTv}>
        {t.tv.allGames}
      </a>
    </nav>
  );
};

/**
 * A TV channel, as on lichess: the channel's game on a full board, followed live, and the next one once it ends. The
 * channel list sits beside it; the grid of every live game stays on /tv.
 */
export const TvChannelPage = ({ channel }: { channel: TvChannel }) => {
  const t = useT();
  const [channels, setChannels] = useState<TvChannelView[] | null>(null);
  const [failed, setFailed] = useState(false);

  usePolling(
    (alive) =>
      api
        .get<TvChannelView[]>('/api/tv/channels')
        .then((list) => {
          if (!alive()) return;
          setChannels(list);
          setFailed(false);
        })
        .catch(() => alive() && setFailed(true)),
    POLL_MS,
    [],
  );

  const game = channels?.find((view) => view.channel === channel)?.game ?? null;
  const list = <ChannelList channels={channels} active={channel} />;
  if (game) return <GamePage id={game.id} tv={list} />;
  return (
    <main class="ligungi-page ligungi-tv-channel-page">
      <h1 class="ligungi-sr-only">{t.tv.title}</h1>
      {list}
      <p class="ligungi-card ligungi-tv__empty">{channels === null ? (failed ? t.genericError : t.common.loading) : t.tv.channelEmpty}</p>
    </main>
  );
};
