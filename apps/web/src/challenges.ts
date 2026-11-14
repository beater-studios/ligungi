import type { ChallengeView, GameSummary } from '@ligungi/protocol';
import { session } from './session.ts';
import { socket } from './socket.ts';
import { playSound } from './sound.ts';
import { createStore } from './store.ts';

/** Open challenges sent to the signed-in user from their profile, kept up to date by the server. */
export const incoming = createStore<readonly ChallengeView[]>([]);

/** The signed-in user's correspondence games waiting for their move, kept up to date by the server. */
export const turns = createStore<readonly GameSummary[]>([]);

let started = false;

export const watchIncoming = (): void => {
  if (started) return;
  started = true;
  const known = new Set<string>();
  let seeded = false;
  // Same idea for games: a move that arrives while the page is open is news, the list on connecting is not.
  let turnsSeeded = false;
  let waiting = new Set<string>();
  socket.on((message) => {
    if (message.t === 'turns') {
      if (turnsSeeded && message.games.some((game) => !waiting.has(game.id))) playSound('notify');
      turnsSeeded = true;
      waiting = new Set(message.games.map((game) => game.id));
      turns.set(message.games);
      return;
    }
    if (message.t !== 'incoming') return;
    // Challenges already pending when the page loads are shown without a sound; only new ones ring.
    if (seeded && message.challenges.some((challenge) => !known.has(challenge.id))) playSound('challenge');
    seeded = true;
    for (const challenge of message.challenges) known.add(challenge.id);
    incoming.set(message.challenges);
  });
  let userId = session.get().user?.id ?? null;
  session.subscribe(() => {
    const next = session.get().user?.id ?? null;
    if (next === userId) return;
    // Another account in this browser: its pending challenges are not news, and the old list no longer applies.
    userId = next;
    known.clear();
    seeded = false;
    incoming.set([]);
    turnsSeeded = false;
    waiting = new Set();
    turns.set([]);
  });
};
