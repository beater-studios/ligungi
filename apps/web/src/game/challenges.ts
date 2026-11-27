import { opposite } from '@ligungi/engine';
import type { ChallengeView, GameSummary, NoticeView } from '@ligungi/protocol';
import { seasonLabel } from '../arena/arena.ts';
import { formatClock, getT, playerName, settingsText, type Messages } from '../i18n/index.ts';
import { notify } from '../notify.ts';
import { session } from '../core/session.ts';
import { socket } from '../core/socket.ts';
import { playSound } from '../sound.ts';
import { createStore } from '../core/store.ts';

/** Open challenges sent to the signed-in user from their profile, kept up to date by the server. */
export const incoming = createStore<readonly ChallengeView[]>([]);

/** The signed-in user's correspondence games waiting for their move, kept up to date by the server. */
export const turns = createStore<readonly GameSummary[]>([]);

/** What the server recorded for the signed-in user while they were away or looking elsewhere: followers and moderation. */
export const notices = createStore<readonly NoticeView[]>([]);

export const noticeText = (t: Messages, notice: NoticeView): string => {
  const n = t.notices;
  const subject = notice.subject ?? '';
  switch (notice.kind) {
    case 'follow':
      return n.follow(notice.actor ?? '');
    case 'reportClosed':
      return n.reportClosed(subject);
    case 'renamed':
      return n.renamed(subject);
    case 'studyHidden':
      return n.studyHidden(subject);
    case 'studyRestored':
      return n.studyRestored(subject);
    case 'studyDeleted':
      return n.studyDeleted(subject);
    case 'studyDrawingsCleared':
      return n.studyDrawingsCleared(subject);
    case 'profileCleared':
    case 'gameVoided':
    case 'suspensionLifted':
    case 'arenaSoon':
      return n[notice.kind];
    case 'seasonChampion':
      return n.seasonChampion(seasonLabel(getT(), subject));
    case 'arenaResult': {
      // `place/players`, with `/trophy` when the place earned one.
      const [place, players, trophy] = subject.split('/');
      return (trophy ? n.arenaTrophy : n.arenaResult)(Number(place), Number(players));
    }
  }
};

/** The page a notice is about, when there is one to open. */
export const noticePath = (notice: NoticeView): string | null => {
  if (notice.kind === 'follow') return notice.actor ? `/@/${notice.actor}` : null;
  if (notice.kind === 'renamed') return notice.subject ? `/@/${notice.subject}` : null;
  if (notice.kind === 'profileCleared') return '/account';
  if (notice.kind === 'gameVoided') return notice.ref ? `/${notice.ref}` : null;
  if (notice.kind === 'studyHidden' || notice.kind === 'studyRestored' || notice.kind === 'studyDrawingsCleared') return notice.ref ? `/study/${notice.ref}` : null;
  if (notice.kind === 'arenaSoon' || notice.kind === 'arenaResult') return notice.ref ? `/arena/${notice.ref}` : '/arena';
  if (notice.kind === 'seasonChampion') return notice.subject ? `/arena/season/${notice.subject}` : '/arena/season';
  return null;
};

/** The notification for a game waiting for the viewer's move; the game page uses the same tag for a live game. */
export const turnNotice = (game: Pick<GameSummary, 'id' | 'mode' | 'players' | 'turn' | 'deadlineIn'>, body?: string) => {
  const t = getT();
  const opponent = game.players[opposite(game.turn ?? 'white')];
  const left = game.deadlineIn !== null ? ` · ${t.nav.timeLeft(formatClock(game.deadlineIn))}` : '';
  return {
    title: t.nav.turnAgainst(playerName(t, opponent)),
    body: body ?? `${t.modes[game.mode]}${left}`,
    tag: `turn:${game.id}`,
    path: `/${game.id}`,
  };
};

let started = false;

export const watchIncoming = (): void => {
  if (started) return;
  started = true;
  const known = new Set<string>();
  let seeded = false;
  // Same idea for games: a move that arrives while the page is open is news, the list on connecting is not.
  let turnsSeeded = false;
  let waiting = new Set<string>();
  let noticesSeeded = false;
  let lastNotice = 0;
  socket.on((message) => {
    if (message.t === 'turns') {
      const arrived = turnsSeeded ? message.games.filter((game) => !waiting.has(game.id)) : [];
      if (arrived.length) playSound('notify');
      for (const game of arrived) notify(turnNotice(game));
      turnsSeeded = true;
      waiting = new Set(message.games.map((game) => game.id));
      turns.set(message.games);
      return;
    }
    if (message.t === 'notices') {
      const arrived = noticesSeeded ? message.notices.filter((entry) => !entry.read && entry.id > lastNotice) : [];
      if (arrived.length) playSound('notify');
      for (const entry of arrived) {
        const t = getT();
        const path = noticePath(entry);
        notify({ title: t.notices.title, body: noticeText(t, entry), tag: `notice:${entry.id}`, ...(path ? { path } : {}) });
      }
      noticesSeeded = true;
      lastNotice = Math.max(lastNotice, ...message.notices.map((entry) => entry.id));
      notices.set(message.notices);
      return;
    }
    if (message.t !== 'incoming') return;
    // Challenges already pending when the page loads are shown without a sound; only new ones ring.
    const fresh = seeded ? message.challenges.filter((challenge) => !known.has(challenge.id)) : [];
    if (fresh.length) playSound('challenge');
    for (const challenge of fresh) {
      const t = getT();
      notify({
        title: t.notify.challenge(playerName(t, challenge.challenger)),
        body: settingsText(t, challenge.settings),
        tag: `challenge:${challenge.id}`,
        path: `/challenge/${challenge.id}`,
      });
    }
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
    noticesSeeded = false;
    lastNotice = 0;
    notices.set([]);
  });
};
