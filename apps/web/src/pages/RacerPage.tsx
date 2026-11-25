import type { RacerLobbyView } from '@ligungi/protocol';
import { useState } from 'preact/hooks';
import { api } from '../core/api.ts';
import { useT } from '../i18n/index.ts';
import { icons } from '../icons.ts';
import { racerRecords } from '../puzzles/racer.ts';
import { navigate } from '../core/router.ts';
import { session } from '../core/session.ts';
import { useStore } from '../core/store.ts';
import { Records } from '../puzzles/Records.tsx';
import { usePolling } from '../core/hooks.ts';

/** How often the page refreshes how many players wait for the public race. */
const LOBBY_POLL_MS = 5_000;

/** Puzzle Racer's entry: join the public race or create one for friends, with the player's records. */
export const RacerPage = () => {
  const t = useT();
  const r = t.racer;
  const { user, loaded } = useStore(session);
  const [lobby, setLobby] = useState<RacerLobbyView | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  usePolling(
    (alive) =>
      api
        .get<RacerLobbyView>('/api/racer')
        .then((view) => alive() && setLobby(view))
        .catch(() => undefined),
    LOBBY_POLL_MS,
    [user?.id],
  );

  const go = async (path: string) => {
    setBusy(true);
    setError(null);
    try {
      const { id } = await api.post<{ id: string }>(path);
      navigate(`/racer/${id}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  const records = lobby?.records ? racerRecords(lobby.records) : null;
  return (
    <main class="ligungi-page ligungi-racer">
      <section class="ligungi-card ligungi-racer__card">
        <h1>{r.title}</h1>
        <p class="ligungi-racer__intro">{r.intro}</p>
        <div class="ligungi-racer__actions">
          <button type="button" class="button ligungi-button-good" disabled={busy} data-icon={icons.PlayTriangle} onClick={() => void go('/api/racer/public')}>
            {r.raceNow}
          </button>
          {lobby && <p class="ligungi-racer__waiting">{r.waitingCount(lobby.waiting)}</p>}
        </div>
        <div class="ligungi-racer__actions">
          <button type="button" class="button button-empty" disabled={busy} onClick={() => void go('/api/racer')}>
            {r.friends}
          </button>
          <p class="ligungi-racer__waiting">{r.friendsHint}</p>
        </div>
        {error && (
          <p class="error" role="alert">
            {error}
          </p>
        )}
        {records && (
          <>
            <h2 class="ligungi-run__heading">{t.puzzleRuns.records}</h2>
            <Records records={records} />
          </>
        )}
        {loaded && !user && (
          <p class="ligungi-drill__login">
            <a href="/login">{r.loginToSave}</a>
          </p>
        )}
        <p class="ligungi-puzzle__links">
          <a href="/puzzles">{t.puzzles.title}</a>
          <a href="/streak">{t.puzzleRuns.streak}</a>
          <a href="/storm">{t.puzzleRuns.storm}</a>
        </p>
      </section>
    </main>
  );
};
