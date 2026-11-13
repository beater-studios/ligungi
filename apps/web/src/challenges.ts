import type { ChallengeView } from '@ligungi/protocol';
import { session } from './session.ts';
import { socket } from './socket.ts';
import { playSound } from './sound.ts';
import { createStore } from './store.ts';

/** Open challenges sent to the signed-in user from their profile, kept up to date by the server. */
export const incoming = createStore<readonly ChallengeView[]>([]);

let started = false;

export const watchIncoming = (): void => {
  if (started) return;
  started = true;
  const known = new Set<string>();
  let seeded = false;
  socket.on((message) => {
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
  });
};
