import type { GameSummary } from '@ligungi/protocol';
import { useEffect, useState } from 'preact/hooks';
import { api } from '../core/api.ts';
import { socket } from '../core/socket.ts';

export interface LiveGames {
  /** Strongest first; `null` until the first list arrives. */
  readonly games: readonly GameSummary[] | null;
  /** When the list arrived (performance.now()), for the clocks to tick from. */
  readonly since: number;
  readonly failed: boolean;
}

/**
 * The live games of the TV and the home page, kept up to date by the server on every move. The first list also comes
 * over HTTP, so the page fills in even before the socket connects.
 */
export const useLiveGames = (): LiveGames => {
  const [state, setState] = useState<LiveGames>({ games: null, since: 0, failed: false });
  useEffect(() => {
    let alive = true;
    const unsubscribe = socket.subscribe('tv');
    const off = socket.on((message) => {
      if (message.t === 'tv') setState({ games: message.games, since: performance.now(), failed: false });
    });
    api
      .get<GameSummary[]>('/api/tv')
      .then((games) => alive && setState((current) => (current.games ? current : { games, since: performance.now(), failed: false })))
      .catch(() => alive && setState((current) => (current.games ? current : { ...current, failed: true })));
    return () => {
      alive = false;
      unsubscribe();
      off();
    };
  }, []);
  return state;
};
