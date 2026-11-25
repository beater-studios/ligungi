import type { GameView } from '@ligungi/protocol';
import { useEffect, useState } from 'preact/hooks';
import { api } from '../../core/api.ts';
import { errorText, getT } from '../../i18n/index.ts';
import { socket } from '../../core/socket.ts';
import { playSound } from '../../sound.ts';

/** The game `id` as the server sends it: loaded once, then each change over the socket. `onNotice` shows a move the server refused. */
export const useGameSocket = (id: string, onNotice: (text: string) => void) => {
  const [view, setView] = useState<GameView | null>(null);
  const [receivedAt, setReceivedAt] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setView(null);
    setError(null);
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
        onNotice(errorText(getT(), message.code, message.message));
        playSound('error');
      }
    });
    return () => {
      alive = false;
      unsubscribe();
      off();
    };
  }, [id]);

  return { view, receivedAt, error };
};
